import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  BodyFatEstimateDto,
  CreateMeasurementCommand,
  Database,
  MeasurementDto,
  MeasurementType,
  UpdateMeasurementCommand,
} from '@txg/shared';
import { BODY_FAT_INPUT_TYPES, estimateBodyFatSeries } from '../services/body-composition/body-composition';
import type { MeasurementReading } from '../services/body-composition/body-composition';
import { NotFoundError } from '../utils/errors';

export interface MeasurementQueryOptions {
  types?: MeasurementType[];
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
  sort?: string;
}

export interface BodyFatEstimateQueryOptions {
  date_from?: string;
  date_to?: string;
}

/**
 * How many input rows one estimate query reads at a time.
 *
 * PostgREST truncates any response at `max_rows` (1000, see `supabase/config.toml`) and reports
 * the true total only in a header, so a query matching more rows comes back silently short.
 * Matching the page size to that cap makes a full page the signal that more remain.
 */
const ESTIMATE_PAGE_SIZE = 1000;

/**
 * The ceiling on how many pages one estimate query may walk.
 *
 * Four input types logged weekly is ~208 rows a year, so this covers well over a century and is
 * not reachable by ordinary use. It throws rather than returning what it has, because a silently
 * partial series is the exact defect the paging removes.
 */
const MAX_ESTIMATE_PAGES = 25;

export class MeasurementRepository {
  constructor(
    private supabase: SupabaseClient<Database>,
    private getUserId: () => string
  ) {}

  /**
   * Finds the user's measurements, optionally narrowed by type and date range.
   *
   * @param {MeasurementQueryOptions} options - Filtering, paging and ordering.
   * @returns {Promise<{ data: MeasurementDto[]; totalCount: number }>} The page and its total.
   */
  async findAll(options: MeasurementQueryOptions): Promise<{ data: MeasurementDto[]; totalCount: number }> {
    let query = this.supabase
      .from('measurements')
      .select('*', { count: 'exact' })
      .eq('user_id', this.getUserId());

    if (options.types && options.types.length > 0) {
      query = query.in('type', options.types);
    }
    if (options.date_from) {
      query = query.gte('measured_on', options.date_from);
    }
    if (options.date_to) {
      query = query.lte('measured_on', options.date_to);
    }

    const [column, direction] = (options.sort ?? 'measured_on.desc').split('.');
    query = query.order(column!, { ascending: direction !== 'desc' });

    // A stable tiebreak: several types share a date, and without it their relative order varies
    // between identical requests, which makes `limit=1` non-deterministic.
    query = query.order('type', { ascending: true });

    // `limit=0` is a legitimate request for the count alone (see `optionalLimit`), but it would
    // form the inverted range `(0, -1)`, so it is asked for as an empty page instead.
    if (options.limit === 0) {
      query = query.limit(0);
    } else if (options.limit !== undefined) {
      const offset = options.offset ?? 0;
      query = query.range(offset, offset + options.limit - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    return { data: (data ?? []) as MeasurementDto[], totalCount: count ?? 0 };
  }

  /**
   * Records a round of measurements.
   *
   * Upserts on `(user_id, measured_on, type)` because re-logging a type on a day is an edit, not
   * a second reading - the same thing the UI does when it reopens a day already measured.
   *
   * @param {CreateMeasurementCommand[]} commands - The readings to record.
   * @returns {Promise<MeasurementDto[]>} The stored rows.
   */
  async createMany(commands: CreateMeasurementCommand[]): Promise<MeasurementDto[]> {
    const userId = this.getUserId();
    const rows = commands.map(command => ({ ...command, user_id: userId }));

    const { data, error } = await this.supabase
      .from('measurements')
      .upsert(rows, { onConflict: 'user_id,measured_on,type' })
      .select();

    if (error) {
      throw error;
    }

    return (data ?? []) as MeasurementDto[];
  }

  /**
   * Updates one reading's value.
   *
   * @param {string} measurementId - The row to update.
   * @param {UpdateMeasurementCommand} command - The new value.
   * @returns {Promise<MeasurementDto>} The updated row.
   * @throws {NotFoundError} If the row does not exist or is not the caller's.
   */
  async update(measurementId: string, command: UpdateMeasurementCommand): Promise<MeasurementDto> {
    const { data, error } = await this.supabase
      .from('measurements')
      .update({ value: command.value })
      .eq('id', measurementId)
      .eq('user_id', this.getUserId())
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new NotFoundError('Measurement not found.', 'MEASUREMENT_NOT_FOUND', 'measurement_not_found_error');
    }

    return data as MeasurementDto;
  }

  /**
   * Deletes one reading.
   *
   * @param {string} measurementId - The row to delete.
   * @throws {NotFoundError} If the row does not exist or is not the caller's.
   */
  async delete(measurementId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('measurements')
      .delete()
      .eq('id', measurementId)
      .eq('user_id', this.getUserId())
      .select('id')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new NotFoundError('Measurement not found.', 'MEASUREMENT_NOT_FOUND', 'measurement_not_found_error');
    }
  }

  /**
   * Builds the user's body-fat estimates for a date range.
   *
   * Reads every row a formula could consume rather than only those inside the range, then windows
   * the estimates. Both bounds have to be applied this way round:
   *
   * - A date at the start of the window is routinely estimated from a neck measured before it (see
   *   the carry-forward rule), so a lower bound on the rows would drop the earliest points.
   * - A never-stale input resolves *forwards* as well, so an upper bound would drop it too. Height
   *   is set once, usually on the day the user first opens Settings; filtering it out because it
   *   was recorded after the window collapsed every Navy estimate in that window to nothing.
   *
   * @param {BodyFatEstimateQueryOptions} options - The window to report on.
   * @returns {Promise<BodyFatEstimateDto[]>} The estimates, ascending by date.
   */
  async findBodyFatEstimates(options: BodyFatEstimateQueryOptions): Promise<BodyFatEstimateDto[]> {
    const userId = this.getUserId();

    const [rows, { data: profile, error: profileError }] = await Promise.all([
      this.findEstimateInputs(userId),
      this.supabase
        .from('profiles')
        // `date_of_birth` is a formula term for the skinfold methods; `height_cm` for Navy.
        .select('sex, date_of_birth, height_cm')
        .eq('id', userId)
        .maybeSingle(),
    ]);

    if (profileError) {
      throw profileError;
    }

    const estimates = estimateBodyFatSeries(rows, {
      sex: profile?.sex ?? null,
      date_of_birth: profile?.date_of_birth ?? null,
      height_cm: profile?.height_cm ?? null,
    });

    // Both bounds are applied after estimating, for the reason given above.
    return estimates.filter(estimate =>
      (!options.date_from || estimate.measured_on >= options.date_from)
      && (!options.date_to || estimate.measured_on <= options.date_to));
  }

  /**
   * Reads every measurement a body-fat formula could consume, a page at a time.
   *
   * Unfiltered by date on purpose: the caller windows the estimates instead.
   *
   * @param {string} userId - The owner of the rows.
   * @returns {Promise<MeasurementReading[]>} The rows in page order; the service sorts them.
   */
  private async findEstimateInputs(userId: string): Promise<MeasurementReading[]> {
    const rows: MeasurementReading[] = [];

    for (let page = 0; page < MAX_ESTIMATE_PAGES; page++) {
      const query = this.supabase
        .from('measurements')
        .select('measured_on, type, value')
        .eq('user_id', userId)
        .in('type', BODY_FAT_INPUT_TYPES as MeasurementType[]);

      const offset = page * ESTIMATE_PAGE_SIZE;
      const { data, error } = await query
        // Ordered by id so page boundaries are stable: without a total order PostgREST returns
        // rows in planner order, and the same row can appear on two pages or on none.
        .order('id', { ascending: true })
        .range(offset, offset + ESTIMATE_PAGE_SIZE - 1);

      if (error) {
        throw error;
      }

      const pageRows = (data ?? []) as MeasurementReading[];
      rows.push(...pageRows);

      if (pageRows.length < ESTIMATE_PAGE_SIZE) {
        return rows;
      }
    }

    throw new Error(
      `Body fat estimate query exceeded ${MAX_ESTIMATE_PAGES} pages of ${ESTIMATE_PAGE_SIZE} rows.`
    );
  }
}

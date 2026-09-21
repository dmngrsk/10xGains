import {
  MEASUREMENT_TYPES,
  SKINFOLD_MEASUREMENT_TYPES,
} from '@txg/shared';
import { seriesColorToken } from '@shared/utils/charts/series-colors';
import {
  BODY_FAT_METHOD_REQUIREMENTS,
  MEASUREMENT_TYPE_META,
  isDerivedBodyFatMethod,
} from './measurement-catalog';
import type {
  LastMeasurementValues,
  MeasurementSeriesViewModel,
} from './measurements.viewmodel';
import type {
  BodyFatEstimateDto,
  BodyFatMethod,
  MeasurementDto,
  MeasurementType,
  ProfileDto,
} from '@txg/shared';

/**
 * How prominently a series sits in the chip row, lowest first.
 *
 * The row shows three lines at a time, so this decides what a user sees without scrolling. It
 * runs in the order a round is actually taken and read: the scale, the number that round exists
 * to produce, then the tape, then the calipers. Alphabetical order alone put "Abdomen skinfold"
 * first and buried body weight.
 *
 * Deliberately independent of what is *selected*, so chips do not rearrange themselves under the
 * finger that just tapped one.
 */
const RANK = { BODY_WEIGHT: 0, ESTIMATE: 1, TAPE: 2, CALIPER: 3 } as const;

function rankOf(series: Pick<MeasurementSeriesViewModel, 'id' | 'kind'>): number {
  if (series.id === 'BODY_WEIGHT') {
    return RANK.BODY_WEIGHT;
  }
  if (series.kind === 'ESTIMATED' || series.id === 'BODY_FAT') {
    return RANK.ESTIMATE;
  }

  return (SKINFOLD_MEASUREMENT_TYPES as readonly string[]).includes(series.id)
    ? RANK.CALIPER
    : RANK.TAPE;
}

/**
 * Where a series sits within its group, from `MEASUREMENT_TYPES`.
 *
 * The same list the Settings checklist is built from, so a chip row and the boxes that produced
 * it read in one order. Sorting by label instead made the two disagree for no reason a user could
 * see. Estimates are not measurement types and there is only ever one, so they all take 0.
 */
function orderOf(series: Pick<MeasurementSeriesViewModel, 'id'>): number {
  const index = (MEASUREMENT_TYPES as readonly string[]).indexOf(series.id);
  return index === -1 ? 0 : index;
}

/**
 * The instrument a measurement is taken with, which is how every surface groups them.
 *
 * One source for the order, because three surfaces present the same catalog: the Settings
 * checklist, the log dialog and the chip row. They are grouped this way because that is how a
 * round is actually taken - the tape comes out once, the calipers come out once - and a dialog
 * that asked for a skinfold between two circumferences would have you putting one down to pick
 * the other up.
 */
export type MeasurementInstrument = 'Scale' | 'Tape' | 'Calipers';

interface MeasurementInstrumentGroup {
  instrument: MeasurementInstrument;
  types: MeasurementType[];
}

/** Catalog order within each group, so a grouped list still reads as the chip row does. */
const INSTRUMENT_ORDER: MeasurementInstrument[] = ['Scale', 'Tape', 'Calipers'];

/**
 * A line saying why each instrument's group is worth taking.
 *
 * Shared by the Settings checklist and the log dialog, which present the same catalog in the same
 * order and would otherwise each carry their own wording of the same explanation.
 */
export const MEASUREMENT_INSTRUMENT_HINTS: Record<MeasurementInstrument, string> = {
  Scale: 'The one measurement worth taking whatever protocol you follow',
  Tape: 'Neck and waist feed the US Navy estimate; the rest are yours to watch',
  Calipers: 'Feed the Jackson-Pollock estimates; a round is taken in one sitting',
};

export function instrumentOf(type: MeasurementType): MeasurementInstrument {
  if (type === 'BODY_WEIGHT' || type === 'BODY_FAT') {
    return 'Scale';
  }

  return (SKINFOLD_MEASUREMENT_TYPES as readonly string[]).includes(type) ? 'Calipers' : 'Tape';
}

/**
 * Groups types by instrument, dropping the groups nothing falls into.
 *
 * @param types The types to group, in any order.
 * @returns Scale, then Tape, then Calipers; each group in `MEASUREMENT_TYPES` order.
 */
export function groupByInstrument(types: readonly MeasurementType[]): MeasurementInstrumentGroup[] {
  const ordered = MEASUREMENT_TYPES.filter(type => types.includes(type));

  return INSTRUMENT_ORDER
    .map(instrument => ({
      instrument,
      types: ordered.filter(type => instrumentOf(type) === instrument),
    }))
    .filter(group => group.types.length > 0);
}

/**
 * What the user tracks, resolved from the stored column.
 *
 * The one place that decides what an unset column means, because three surfaces read it - the
 * chart's chips, the log dialog's fields and the Settings checklist - and they disagreed: the
 * chart read `[]` as "track nothing" while the dialog read it as "not chosen", so the first save
 * from a checklist seeded with `[]` emptied the chart.
 *
 * Null and `[]` both mean unset, and both fall back to what has been logged plus body weight.
 * They are the same case in practice: a user tracking literally nothing has no use for the tab,
 * and telling the two apart bought nothing but the bug above.
 *
 * @param stored `profiles.tracked_measurement_types`, as the API returns it.
 * @param logged The types this user has ever recorded, in any order.
 * @returns The tracked types, in `MEASUREMENT_TYPES` order.
 */
export function resolveTrackedTypes(
  stored: readonly MeasurementType[] | null | undefined,
  logged: readonly MeasurementType[]
): MeasurementType[] {
  const set = stored && stored.length > 0
    ? new Set(stored)
    : new Set<MeasurementType>([...logged, 'BODY_WEIGHT']);

  return MEASUREMENT_TYPES.filter(type => set.has(type));
}

const METHOD_LABELS: Record<BodyFatMethod, string> = {
  NAVY: 'US Navy estimate',
  JP3: 'Jackson-Pollock 3 estimate',
  JP7: 'Jackson-Pollock 7 estimate',
  // Never drawn: MANUAL produces no estimate series, only the BODY_FAT rows the user typed in.
  MANUAL: 'Body fat',
};

/**
 * The chip-row form, which names the measurement rather than the formula behind it.
 *
 * One method is charted at a time, so the chip never has to tell two estimates apart - and
 * "Navy" or "JP7" beside "Weight" and "Waist" asks the reader to know what those are before the
 * row makes sense. The chart keeps the method name, in the dataset label and the tooltip, where
 * there is room to say which formula produced the line.
 */
const ESTIMATE_SHORT_LABEL = 'Body fat';

/**
 * Builds the chart's series from stored rows and derived estimates.
 *
 * @param measurements The user's rows, any order.
 * @param estimates The derived body-fat figures.
 * @param isSelected Decides which series start selected, so a reload keeps the user's choice.
 * @param method The body-fat method in use, whose estimate is the one charted.
 * @param tracked The tracked types, already resolved by `resolveTrackedTypes`.
 * @returns The series, ordered for a chip row that shows three lines at a time.
 */
export function mapToMeasurementSeries(
  measurements: MeasurementDto[],
  estimates: BodyFatEstimateDto[],
  isSelected: (seriesId: string) => boolean,
  method: BodyFatMethod | null = null,
  tracked: readonly MeasurementType[] = MEASUREMENT_TYPES
): MeasurementSeriesViewModel[] {
  const byType = new Map<MeasurementType, MeasurementDto[]>();

  for (const row of measurements) {
    if (!tracked.includes(row.type)) {
      continue;
    }
    const bucket = byType.get(row.type);
    if (bucket) {
      bucket.push(row);
    } else {
      byType.set(row.type, [row]);
    }
  }

  const measuredSeries = [...byType.entries()]
    .map<MeasurementSeriesViewModel>(([type, rows]) => {
      const meta = MEASUREMENT_TYPE_META[type];
      return {
        id: type,
        kind: 'MEASURED',
        label: meta.label,
        shortLabel: meta.shortLabel,
        unit: meta.unit,
        precision: meta.precision,
        colorToken: '',
        selected: isSelected(type),
        points: rows
          .map(row => ({ date: row.measured_on, value: row.value, carriedForward: false }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      };
    });

  const byMethod = new Map<BodyFatMethod, BodyFatEstimateDto[]>();
  for (const estimate of estimates) {
    // One estimate series, not three - and none at all until a method is chosen, because an
    // estimate from a formula nobody picked is a number with no author. The API still computes
    // every method the readings support, and nothing is stored, so choosing one in Settings
    // brings its series straight back.
    if (estimate.method !== method) {
      continue;
    }
    const bucket = byMethod.get(estimate.method);
    if (bucket) {
      bucket.push(estimate);
    } else {
      byMethod.set(estimate.method, [estimate]);
    }
  }

  const estimatedSeries = [...byMethod.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map<MeasurementSeriesViewModel>(([method, rows]) => ({
      id: estimateSeriesId(method),
      kind: 'ESTIMATED',
      label: METHOD_LABELS[method],
      shortLabel: ESTIMATE_SHORT_LABEL,
      unit: 'BF%',
      precision: 1,
      colorToken: '',
      selected: isSelected(estimateSeriesId(method)),
      points: rows
        .map(row => ({ date: row.measured_on, value: row.value, carriedForward: row.carried_forward }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    }));

  // Colours are assigned across the combined list so no two visible series share one.
  return [...measuredSeries, ...estimatedSeries]
    .sort((a, b) => rankOf(a) - rankOf(b) || orderOf(a) - orderOf(b))
    .map((series, index) => ({
      ...series,
      colorToken: seriesColorToken(index),
    }));
}

/** Hyphenated, not colon-separated: the id reaches the DOM as a `data-cy`, and `a:b` is not a
 *  valid attribute selector. */
export function estimateSeriesId(method: BodyFatMethod): string {
  return `estimate-${method}`;
}

/**
 * The default selection: body weight and the chosen method's estimate.
 *
 * Everything else starts off, because the chart takes two units at most and a row of chips is
 * quicker to add from than to prune.
 *
 * @param preferredMethod The method chosen in Settings, if any.
 * @returns The series ids to select.
 */
export function defaultSelectedSeriesIds(preferredMethod: BodyFatMethod | null): Set<string> {
  const selected = new Set<string>(['BODY_WEIGHT']);

  if (preferredMethod) {
    // Under MANUAL the body-fat line is a stored series, so it is named by its type rather than
    // by an estimate id that would never exist.
    selected.add(isDerivedBodyFatMethod(preferredMethod) ? estimateSeriesId(preferredMethod) : 'BODY_FAT');
  }

  return selected;
}

/**
 * The most recent value per type, which prefills the log dialog so a round of measuring is a
 * series of small corrections rather than retyping.
 *
 * @param measurements The user's rows, any order.
 * @returns The latest reading per type.
 */
export function mapToLastValues(measurements: MeasurementDto[]): LastMeasurementValues {
  const lastValues: LastMeasurementValues = {};

  for (const row of measurements) {
    const existing = lastValues[row.type];
    if (!existing || row.measured_on > existing.measuredOn) {
      lastValues[row.type] = { value: row.value, measuredOn: row.measured_on };
    }
  }

  return lastValues;
}

/**
 * Says which precondition is stopping a body-fat estimate, or null when nothing is.
 *
 * A silently empty estimate series is the failure this feature will actually hit, so every
 * blocked state names what is missing rather than rendering nothing.
 *
 * @param profile The user's profile, or null when it could not be loaded.
 * @param measurements The user's rows.
 * @param estimates The estimates that were returned.
 * @returns A sentence for the notice, or null.
 */
export function describeEstimateBlocker(
  profile: ProfileDto | null,
  measurements: MeasurementDto[],
  estimates: BodyFatEstimateDto[]
): string | null {
  // Only an estimate the chart would actually draw counts as having one: the API returns every
  // method the readings support, and all but the chosen one are filtered out.
  if (estimates.some(estimate => estimate.method === profile?.body_fat_method)) {
    return null;
  }

  if (!profile?.body_fat_method) {
    return 'Choose a body-fat method in Settings to see an estimate.';
  }

  // Nothing is derived under MANUAL, so there is no estimate to be missing - the figure is either
  // logged or it is not, and an empty series says that plainly enough.
  if (!isDerivedBodyFatMethod(profile.body_fat_method)) {
    return null;
  }

  // What each method needs is declared once, in the catalog, rather than inferred here from the
  // method's name - `method !== 'NAVY'` stood in for "takes an age term" until a fourth method
  // made that reading false.
  const method = profile.body_fat_method;
  const needs = BODY_FAT_METHOD_REQUIREMENTS[method];

  if (needs.sex && !profile.sex) {
    return 'Choose your sex in Settings to see a body-fat estimate.';
  }

  if (needs.height && !profile.height_cm) {
    return 'Add your height in Settings and the estimate will build from the neck and waist you log.';
  }

  const loggedTypes = new Set(measurements.map(row => row.type));

  if (needs.age && !profile.date_of_birth) {
    return 'Add your date of birth in Settings — the skinfold formulas use your age.';
  }

  const missing = needs.measurements(profile.sex!)
    .filter(type => !loggedTypes.has(type))
    .map(type => MEASUREMENT_TYPE_META[type].label.toLowerCase());

  if (missing.length > 0) {
    return `Log your ${formatList(missing)} to see a body-fat estimate.`;
  }

  return 'No recent measurements in range to estimate from. Log a fresh round to continue the series.';
}

function formatList(items: string[]): string {
  if (items.length <= 1) {
    return items[0] ?? '';
  }
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

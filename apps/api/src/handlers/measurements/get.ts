import { z } from 'zod';
import type { Context } from 'hono';
import { MEASUREMENT_TYPES } from '@txg/shared';
import type { MeasurementDto } from '@txg/shared';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers';
import type { AppContext } from '../../context';
import {
  calendarDate,
  optionalCsvList,
  optionalLimit,
  optionalOffset,
  optionalSort,
  validateQueryParams,
  withCoherentDateRange,
} from '../../utils/validation';

const POSTGREST_MAX_ROWS = 1000;

const optionalDate = () => calendarDate().optional();

const QUERY_SCHEMA = withCoherentDateRange(z.object({
  types: optionalCsvList(z.enum(MEASUREMENT_TYPES)),
  date_from: optionalDate(),
  date_to: optionalDate(),
  limit: optionalLimit(POSTGREST_MAX_ROWS, POSTGREST_MAX_ROWS),
  offset: optionalOffset(),
  sort: optionalSort('measured_on', 'desc', ['type', 'created_at']),
}));

export async function handleGetMeasurements(c: Context<AppContext>) {
  const { query, error: queryError } = validateQueryParams(c, QUERY_SCHEMA);
  if (queryError) return queryError;

  const measurementRepository = c.get('measurementRepository');

  try {
    const { data, totalCount } = await measurementRepository.findAll({
      types: query!.types,
      date_from: query!.date_from,
      date_to: query!.date_to,
      limit: query!.limit,
      offset: query!.offset,
      sort: query!.sort,
    });

    const successData = createSuccessData<MeasurementDto[]>(data, { totalCount });
    return c.json(successData, 200);
  } catch (error) {
    const fallbackMessage = 'Failed to fetch measurements';
    return handleRepositoryError(c, error as Error, handleGetMeasurements.name, fallbackMessage);
  }
}

import { z } from 'zod';
import type { Context } from 'hono';
import type { BodyFatEstimateDto } from '@txg/shared';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers';
import type { AppContext } from '../../context';
import { calendarDate, validateQueryParams, withCoherentDateRange } from '../../utils/validation';

const QUERY_SCHEMA = withCoherentDateRange(z.object({
  date_from: calendarDate().optional(),
  date_to: calendarDate().optional(),
}));

export async function handleGetBodyFatEstimates(c: Context<AppContext>) {
  const { query, error: queryError } = validateQueryParams(c, QUERY_SCHEMA);
  if (queryError) return queryError;

  const measurementRepository = c.get('measurementRepository');

  try {
    const estimates = await measurementRepository.findBodyFatEstimates({
      date_from: query!.date_from,
      date_to: query!.date_to,
    });

    const successData = createSuccessData<BodyFatEstimateDto[]>(estimates);
    return c.json(successData, 200);
  } catch (error) {
    const fallbackMessage = 'Failed to fetch body fat estimates';
    return handleRepositoryError(c, error as Error, handleGetBodyFatEstimates.name, fallbackMessage);
  }
}

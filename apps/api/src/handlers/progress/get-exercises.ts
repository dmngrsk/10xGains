import { z } from 'zod';
import type { Context } from 'hono';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers';
import type { ExerciseProgressDto } from '@txg/shared';
import type { AppContext } from '../../context';
import { optionalCsvList, optionalIsoDate, validateQueryParams, withCoherentDateRange } from '../../utils/validation';

const QUERY_SCHEMA = withCoherentDateRange(z.object({
  plan_id: z.string().uuid().optional(),
  exercise_ids: optionalCsvList(z.string().uuid()),
  date_from: optionalIsoDate(),
  date_to: optionalIsoDate(),
}));

export async function handleGetExerciseProgress(c: Context<AppContext>) {
  const { query, error: queryError } = validateQueryParams(c, QUERY_SCHEMA);
  if (queryError) return queryError;

  const progressRepository = c.get('progressRepository');

  try {
    const result = await progressRepository.findExerciseProgress({
      plan_id: query!.plan_id,
      exercise_ids: query!.exercise_ids,
      date_from: query!.date_from,
      date_to: query!.date_to,
    });

    const successData = createSuccessData<ExerciseProgressDto[]>(result);
    return c.json(successData, 200);
  } catch (e) {
    const fallbackMessage = 'Failed to fetch exercise progress';
    return handleRepositoryError(c, e as Error, handleGetExerciseProgress.name, fallbackMessage);
  }
}

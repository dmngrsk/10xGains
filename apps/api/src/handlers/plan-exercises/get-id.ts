import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData, handleRepositoryError } from '../../utils/api-helpers';
import type { PlanExerciseDto } from '@txg/shared';
import type { AppContext } from '../../context';
import { optionalBoolean, validatePathParams, validateQueryParams } from "../../utils/validation";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  dayId: z.string().uuid('Invalid dayId format'),
  exerciseId: z.string().uuid('Invalid exerciseId format'),
});

const QUERY_SCHEMA = z.object({
  include_archived: optionalBoolean('include_archived'),
});

export async function handleGetPlanExerciseById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { query, error: queryError } = validateQueryParams(c, QUERY_SCHEMA);
  if (queryError) return queryError;

  const planRepository = c.get('planRepository');

  try {
    const exercise = await planRepository.findExerciseById(path!.planId, path!.dayId, path!.exerciseId, { includeArchived: query!.include_archived });

    if (!exercise) {
      const errorData = createErrorDataWithLogging(404, 'Plan exercise not found or user does not have access.');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<PlanExerciseDto>(exercise);
    return c.json(successData, 200);
  } catch (error) {
    const fallbackMessage = 'Failed to get plan';
    return handleRepositoryError(c, error as Error, handleGetPlanExerciseById.name, fallbackMessage);
  }
}

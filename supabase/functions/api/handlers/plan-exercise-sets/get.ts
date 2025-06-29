import { z } from 'zod';
import type { Context } from 'hono';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { PlanExerciseSetDto } from '../../models/api.types.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  dayId: z.string().uuid('Invalid dayId format'),
  exerciseId: z.string().uuid('Invalid exerciseId format'),
});

export async function handleGetPlanExerciseSets(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const planRepository = c.get('planRepository');

  try {
    const sets = await planRepository.findSetsByExerciseId(path!.planId, path!.dayId, path!.exerciseId);

    const successData = createSuccessData<PlanExerciseSetDto[]>(sets);
    return c.json(successData, 200);
  } catch (error) {
    const fallbackMessage = 'Failed to get plan exercise sets';
    return handleRepositoryError(c, error as Error, planRepository.handlePlanOwnershipError, handleGetPlanExerciseSets.name, fallbackMessage);
  }
}

import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { TrainingPlanExerciseSetDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  dayId: z.string().uuid('Invalid dayId format'),
  exerciseId: z.string().uuid('Invalid exerciseId format'),
  setId: z.string().uuid('Invalid setId format'),
});

export async function handleGetTrainingPlanExerciseSetById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const planRepository = c.get('planRepository');

  try {
    const set = await planRepository.findSetById(path!.planId, path!.dayId, path!.exerciseId, path!.setId);

    if (!set) {
      const errorData = createErrorDataWithLogging(404, 'Training plan exercise set not found or user does not have access.');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<TrainingPlanExerciseSetDto>(set);
    return c.json(successData, 200);
  } catch (error) {
    const fallbackMessage = 'Failed to get training plan exercise set';
    return handleRepositoryError(c, error as Error, planRepository.handlePlanOwnershipError, handleGetTrainingPlanExerciseSetById.name, fallbackMessage);
  }
}

import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { TrainingPlanExerciseDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  dayId: z.string().uuid('Invalid dayId format'),
  exerciseId: z.string().uuid('Invalid exerciseId format'),
});

export async function handleGetTrainingPlanExerciseById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const planRepository = c.get('planRepository');

  try {
    const exercise = await planRepository.findExerciseById(path!.planId, path!.dayId, path!.exerciseId);

    if (!exercise) {
      const errorData = createErrorDataWithLogging(404, 'Training plan exercise not found or user does not have access.');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<TrainingPlanExerciseDto>(exercise);
    return c.json(successData, 200);
  } catch (error) {
    const fallbackMessage = 'Failed to get training plan exercise';
    return handleRepositoryError(c, error as Error, planRepository.handlePlanOwnershipError, handleGetTrainingPlanExerciseById.name, fallbackMessage);
  }
}

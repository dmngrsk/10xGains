import { z } from 'zod';
import type { Context } from 'hono';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { TrainingPlanExerciseDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  dayId: z.string().uuid('Invalid dayId format'),
});

export async function handleGetTrainingPlanExercises(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const planRepository = c.get('planRepository');

  try {
    const exercises = await planRepository.findExercisesByDayId(path!.planId, path!.dayId);

    const successData = createSuccessData<TrainingPlanExerciseDto[]>(exercises);
    return c.json(successData, 200);
  } catch (error) {
    const fallbackMessage = 'Failed to get training plan exercises';
    return handleRepositoryError(c, error as Error, planRepository.handlePlanOwnershipError, handleGetTrainingPlanExercises.name, fallbackMessage);
  }
}

import { z } from 'zod';
import type { Context } from 'hono';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { TrainingPlanExerciseProgressionDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid(),
});

export async function handleGetTrainingPlanExerciseProgressions(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const planRepository = c.get('planRepository');

  try {
    const progressions = await planRepository.findProgressionsByPlanId(path!.planId);

    const successData = createSuccessData<TrainingPlanExerciseProgressionDto[]>(progressions);
    return c.json(successData, 200);
  } catch (error) {
    const fallbackMessage = 'Failed to get training plan exercise progressions';
    return handleRepositoryError(c, error as Error, planRepository.handlePlanOwnershipError, handleGetTrainingPlanExerciseProgressions.name, fallbackMessage);
  }
}

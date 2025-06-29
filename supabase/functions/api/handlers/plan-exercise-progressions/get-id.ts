import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { PlanExerciseProgressionDto } from '../../models/api.types.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid(),
  exerciseId: z.string().uuid(),
});

export async function handleGetPlanExerciseProgressionById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const planRepository = c.get('planRepository');

  try {
    const progression = await planRepository.findProgressionByExerciseId(path!.planId, path!.exerciseId);

    if (!progression) {
      const errorData = createErrorDataWithLogging(404, 'Plan exercise progression not found or user does not have access.');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<PlanExerciseProgressionDto>(progression);
    return c.json(successData, 200);
  } catch (error) {
    const fallbackMessage = 'Failed to get plan progression';
    return handleRepositoryError(c, error as Error, planRepository.handlePlanOwnershipError, handleGetPlanExerciseProgressionById.name, fallbackMessage);
  }
}

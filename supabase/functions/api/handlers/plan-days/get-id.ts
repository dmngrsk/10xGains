import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { PlanDayDto } from '../../models/api.types.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  dayId: z.string().uuid('Invalid dayId format'),
});

export async function handleGetPlanDayById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const planRepository = c.get('planRepository');

  try {
    const day = await planRepository.findDayById(path!.planId, path!.dayId);

    if (!day) {
      const errorData = createErrorDataWithLogging(404, 'Plan day not found or user does not have access.');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<PlanDayDto>(day);
    return c.json(successData, 200);
  } catch (error) {
    const fallbackMessage = 'Failed to get plan day';
    return handleRepositoryError(c, error as Error, planRepository.handlePlanOwnershipError, handleGetPlanDayById.name, fallbackMessage);
  }
}

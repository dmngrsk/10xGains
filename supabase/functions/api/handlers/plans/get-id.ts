import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { PlanDto } from '../../models/api.types.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
});

export async function handleGetPlanById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const planRepository = c.get('planRepository');

  try {
    const plan = await planRepository.findById(path!.planId);

    if (!plan) {
      const errorData = createErrorDataWithLogging(404, 'Plan not found');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<PlanDto>(plan);
    return c.json(successData, 200);
  } catch (e) {
    const fallbackMessage = 'Failed to fetch plan';
    return handleRepositoryError(c, e as Error, planRepository.handlePlanOwnershipError, handleGetPlanById.name, fallbackMessage);
  }
}

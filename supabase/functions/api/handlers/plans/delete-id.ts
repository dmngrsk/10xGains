import { z } from 'zod';
import type { Context } from 'hono';
import { handleRepositoryError } from '../../utils/api-helpers.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
});

export async function handleDeletePlanById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const planRepository = c.get('planRepository');

  try {
    await planRepository.delete(path!.planId);

    return c.body(null, 204);
  } catch (e) {
    const fallbackMessage = 'Failed to delete plan';
    return handleRepositoryError(c, e as Error, planRepository.handlePlanOwnershipError, handleDeletePlanById.name, fallbackMessage);
  }
}

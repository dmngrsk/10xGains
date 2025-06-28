import { z } from 'zod';
import type { Context } from 'hono';
import { handleRepositoryError } from '../../utils/api-helpers.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  dayId: z.string().uuid('Invalid dayId format'),
});

export async function handleDeleteTrainingPlanDayById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const planRepository = c.get('planRepository');

  try {
    await planRepository.deleteDay(path!.planId, path!.dayId);

    return c.body(null, 204);
  } catch (error) {
    const fallbackMessage = 'Failed to delete training plan day';
    return handleRepositoryError(c, error as Error, planRepository.handlePlanOwnershipError, handleDeleteTrainingPlanDayById.name, fallbackMessage);
  }
}

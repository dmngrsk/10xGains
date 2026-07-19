import { z } from 'zod';
import type { Context } from 'hono';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers';
import type { PlanExerciseProgressionDto } from '@txg/shared';
import type { AppContext } from '../../context';
import { validatePathParams } from "../../utils/validation";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid(),
});

export async function handleGetPlanExerciseProgressions(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const planRepository = c.get('planRepository');

  try {
    const progressions = await planRepository.findProgressionsByPlanId(path!.planId);

    const successData = createSuccessData<PlanExerciseProgressionDto[]>(progressions);
    return c.json(successData, 200);
  } catch (error) {
    const fallbackMessage = 'Failed to get plan exercise progressions';
    return handleRepositoryError(c, error as Error, handleGetPlanExerciseProgressions.name, fallbackMessage);
  }
}

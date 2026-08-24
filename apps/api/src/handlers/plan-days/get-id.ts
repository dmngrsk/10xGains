import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData, handleRepositoryError } from '../../utils/api-helpers';
import type { PlanDayDto } from '@txg/shared';
import type { AppContext } from '../../context';
import { optionalBoolean, validatePathParams, validateQueryParams } from "../../utils/validation";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  dayId: z.string().uuid('Invalid dayId format'),
});

const QUERY_SCHEMA = z.object({
  include_archived: optionalBoolean('include_archived'),
});

export async function handleGetPlanDayById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { query, error: queryError } = validateQueryParams(c, QUERY_SCHEMA);
  if (queryError) return queryError;

  const planRepository = c.get('planRepository');

  try {
    const day = await planRepository.findDayById(path!.planId, path!.dayId, { includeArchived: query!.include_archived });

    if (!day) {
      const errorData = createErrorDataWithLogging(404, 'Plan day not found or user does not have access.');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<PlanDayDto>(day);
    return c.json(successData, 200);
  } catch (error) {
    const fallbackMessage = 'Failed to get plan day';
    return handleRepositoryError(c, error as Error, handleGetPlanDayById.name, fallbackMessage);
  }
}

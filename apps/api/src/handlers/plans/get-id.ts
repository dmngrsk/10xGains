import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData, handleRepositoryError } from '../../utils/api-helpers';
import type { PlanDto } from '@txg/shared';
import type { AppContext } from '../../context';
import { optionalBoolean, validatePathParams, validateQueryParams } from "../../utils/validation";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
});

const QUERY_SCHEMA = z.object({
  include_archived: optionalBoolean('include_archived'),
});

export async function handleGetPlanById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { query, error: queryError } = validateQueryParams(c, QUERY_SCHEMA);
  if (queryError) return queryError;

  const planRepository = c.get('planRepository');

  try {
    const plan = await planRepository.findById(path!.planId, { includeArchived: query!.include_archived });

    if (!plan) {
      const errorData = createErrorDataWithLogging(404, 'Plan not found');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<PlanDto>(plan);
    return c.json(successData, 200);
  } catch (e) {
    const fallbackMessage = 'Failed to fetch plan';
    return handleRepositoryError(c, e as Error, handleGetPlanById.name, fallbackMessage);
  }
}

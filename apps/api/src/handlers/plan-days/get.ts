import { z } from 'zod';
import type { Context } from 'hono';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers';
import type { PlanDayDto } from '@txg/shared';
import type { AppContext } from '../../context';
import { optionalLimit, optionalOffset, validatePathParams, validateQueryParams } from "../../utils/validation";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
});

const QUERY_SCHEMA = z.object({
  limit: optionalLimit(),
  offset: optionalOffset()
});

export async function handleGetPlanDays(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { query, error: queryError } = validateQueryParams(c, QUERY_SCHEMA);
  if (queryError) return queryError;

  const planRepository = c.get('planRepository');

  try {
    const queryOptions = { limit: query!.limit, offset: query!.offset };
    const result = await planRepository.findDaysByPlanId(path!.planId, queryOptions);

    const successData = createSuccessData<PlanDayDto[]>(result.data, { totalCount: result.totalCount });
    return c.json(successData, 200);
  } catch (error) {
    const fallbackMessage = 'Failed to get plan days';
    return handleRepositoryError(c, error as Error, planRepository.handlePlanOwnershipError, handleGetPlanDays.name, fallbackMessage);
  }
}

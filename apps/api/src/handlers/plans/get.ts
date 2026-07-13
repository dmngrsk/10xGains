import type { Context } from 'hono';
import { z } from 'zod';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers';
import type { PlanDto } from '@txg/shared';
import type { AppContext } from '../../context';
import { optionalLimit, optionalOffset, optionalSort, validateQueryParams } from "../../utils/validation";

export const QUERY_SCHEMA = z.object({
  limit: optionalLimit(),
  offset: optionalOffset(),
  sort: optionalSort('created_at', 'desc')
});

export async function handleGetPlans(c: Context<AppContext>) {
  const { query, error: queryError } = validateQueryParams(c, QUERY_SCHEMA);
  if (queryError) return queryError;

  const planRepository = c.get('planRepository');

  try {
    const queryOptions = { limit: query!.limit, offset: query!.offset, sort: query!.sort };
    const result = await planRepository.findAll(queryOptions);

    const successData = createSuccessData<PlanDto[]>(result.data, { totalCount: result.totalCount });
    return c.json(successData, 200);
  } catch (e) {
    const fallbackMessage = 'Failed to retrieve plans';
    return handleRepositoryError(c, e as Error, planRepository.handlePlanOwnershipError, handleGetPlans.name, fallbackMessage);
  }
}

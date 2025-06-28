import type { Context } from 'hono';
import { z } from 'zod';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { TrainingPlanDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validateQueryParams } from "../../utils/validation.ts";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_OFFSET = 0;
const DEFAULT_SORT_COLUMN = 'created_at';
const DEFAULT_SORT_DIRECTION = 'desc';

export const QUERY_SCHEMA = z.object({
  limit: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number().int().positive().max(MAX_LIMIT).optional().default(DEFAULT_LIMIT)
  ),
  offset: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number().int().min(0).optional().default(DEFAULT_OFFSET)
  ),
  sort: z.preprocess(
    (val: unknown) => (val ? String(val) : `${DEFAULT_SORT_COLUMN}.${DEFAULT_SORT_DIRECTION}`),
    z.string()
      .regex(/^[a-zA-Z_]+\.(asc|desc)$/, 'Sort parameter must be in format column_name.(asc|desc)')
      .default(`${DEFAULT_SORT_COLUMN}.${DEFAULT_SORT_DIRECTION}`)
  )
});

export async function handleGetTrainingPlans(c: Context<AppContext>) {
  const { query, error: queryError } = validateQueryParams(c, QUERY_SCHEMA);
  if (queryError) return queryError;

  const planRepository = c.get('planRepository');

  try {
    const queryOptions = { limit: query!.limit, offset: query!.offset, sort: query!.sort };
    const result = await planRepository.findAll(queryOptions);

    const successData = createSuccessData<TrainingPlanDto[]>(result.data, { totalCount: result.totalCount });
    return c.json(successData, 200);
  } catch (e) {
    const fallbackMessage = 'Failed to retrieve training plans';
    return handleRepositoryError(c, e as Error, planRepository.handlePlanOwnershipError, handleGetTrainingPlans.name, fallbackMessage);
  }
}

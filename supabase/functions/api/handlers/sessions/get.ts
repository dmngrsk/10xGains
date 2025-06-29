import { z } from 'zod';
import type { Context } from 'hono';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { SessionDto } from '../../models/api.types.ts';
import type { AppContext } from '../../context.ts';
import { validateQueryParams } from '../../utils/validation.ts';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_OFFSET = 0;
const DEFAULT_SORT_COLUMN = 'session_date';
const DEFAULT_SORT_DIRECTION = 'asc';

const QUERY_SCHEMA = z.object({
  limit: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number().int().nonnegative().max(MAX_LIMIT).optional().default(DEFAULT_LIMIT)
  ),
  offset: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number().int().nonnegative().optional().default(DEFAULT_OFFSET)
  ),
  sort: z.preprocess(
    (val: unknown) => (val ? String(val) : `${DEFAULT_SORT_COLUMN}.${DEFAULT_SORT_DIRECTION}`),
    z.string()
      .regex(/^[a-zA-Z_]+\.(asc|desc)$/, 'Sort parameter must be in format column_name.(asc|desc)')
      .default(`${DEFAULT_SORT_COLUMN}.${DEFAULT_SORT_DIRECTION}`)
  ),
  status: z.preprocess(
    (val) => (typeof val === 'string' ? val.split(',').map(s => s.trim()) : undefined),
    z.array(z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])).optional()
  ),
  date_from: z.preprocess(
    (val) => (val ? new Date(String(val)).toISOString() : undefined),
    z.string().datetime().optional()
  ),
  date_to: z.preprocess(
    (val) => (val ? new Date(String(val)).toISOString() : undefined),
    z.string().datetime().optional()
  ),
  plan_id: z.string().uuid().optional(),
});

export async function handleGetSessions(c: Context<AppContext>) {
  const { query, error: queryError } = validateQueryParams(c, QUERY_SCHEMA);
  if (queryError) return queryError;

  const sessionRepository = c.get('sessionRepository');

  try {
    const result = await sessionRepository.findAll({
      limit: query!.limit,
      offset: query!.offset,
      sort: query!.sort,
      status: query!.status,
      date_from: query!.date_from,
      date_to: query!.date_to,
      plan_id: query!.plan_id,
    });

    const successData = createSuccessData<SessionDto[]>(result.data, { totalCount: result.totalCount });
    return c.json(successData, 200);
  } catch (e) {
    const fallbackMessage = 'Failed to fetch training sessions';
    return handleRepositoryError(c, e as Error, sessionRepository.handleSessionOwnershipError, handleGetSessions.name, fallbackMessage);
  }
}

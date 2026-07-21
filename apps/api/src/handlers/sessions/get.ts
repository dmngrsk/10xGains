import { z } from 'zod';
import type { Context } from 'hono';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers';
import { SESSION_STATUSES, type SessionDto } from '@txg/shared';
import type { AppContext } from '../../context';
import { optionalCsvList, optionalIsoDate, optionalLimit, optionalOffset, optionalSort, validateQueryParams, withCoherentDateRange } from '../../utils/validation';

const QUERY_SCHEMA = withCoherentDateRange(z.object({
  limit: optionalLimit(),
  offset: optionalOffset(),
  sort: optionalSort('session_date', 'asc', ['status']),
  status: optionalCsvList(z.enum(SESSION_STATUSES)),
  date_from: optionalIsoDate(),
  date_to: optionalIsoDate('end'),
  plan_id: z.string().uuid().optional(),
}));

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
    return handleRepositoryError(c, e as Error, handleGetSessions.name, fallbackMessage);
  }
}

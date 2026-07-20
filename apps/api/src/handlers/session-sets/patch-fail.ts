import { z } from 'zod';
import type { Context } from 'hono';
import type { SessionSetDto } from '@txg/shared';
import type { AppContext } from '../../context';
import { patch } from './helpers/patch-base';
import { optionalCount, validatePathParams, validateQueryParams } from "../../utils/validation";

const PATH_SCHEMA = z.object({
  sessionId: z.string().uuid('Invalid sessionId format'),
  setId: z.string().uuid('Invalid setId format'),
});

const QUERY_SCHEMA = z.object({
  reps: optionalCount('Rep count'),
});

export async function handleFailSessionSet(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { query, error: queryError } = validateQueryParams(c, QUERY_SCHEMA);
  if (queryError) return queryError;

  const getUpdateData = (_sessionSet: SessionSetDto) => ({
    status: 'FAILED' as const,
    actual_reps: query!.reps !== undefined ? query!.reps : 0,
    completed_at: new Date().toISOString()
  });

  return await patch(c, path!.sessionId, path!.setId, getUpdateData);
}

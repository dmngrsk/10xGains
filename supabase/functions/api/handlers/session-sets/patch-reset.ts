import { z } from 'zod';
import type { Context } from 'hono';
import type { SessionSetDto } from '../../models/api.types.ts';
import type { AppContext } from '../../context.ts';
import { patch } from './helpers/patch-base.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  sessionId: z.string().uuid('Invalid sessionId format'),
  setId: z.string().uuid('Invalid setId format'),
});

export async function handleResetSessionSet(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const getUpdateData = (_sessionSet: SessionSetDto) => ({
    status: 'PENDING' as const,
    actual_reps: null,
    completed_at: null
  });

  return await patch(c, path!.sessionId, path!.setId, getUpdateData);
}

import { z } from 'zod';
import type { Context } from 'hono';
import type { SessionSetDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { patch } from './helpers/patch-base.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  sessionId: z.string().uuid('Invalid sessionId format'),
  setId: z.string().uuid('Invalid setId format'),
});

export async function handleCompleteTrainingSessionSet(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const getUpdateData = (sessionSet: SessionSetDto) => ({
    status: 'COMPLETED' as const,
    actual_reps: sessionSet.expected_reps,
    completed_at: new Date().toISOString()
  });

  return await patch(c, path!.sessionId, path!.setId, getUpdateData);
}

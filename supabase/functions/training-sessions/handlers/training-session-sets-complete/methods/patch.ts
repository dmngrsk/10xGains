import { z } from 'zod';
import { createErrorResponse } from '@shared/utils/api-helpers.ts';
import { patchSessionSet } from "../../../shared/patch-session-set.ts";
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';
import type { SessionSetDto } from '@shared/models/api-types.ts';

const pathParamsSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID format'),
  setId: z.string().uuid('Invalid set ID format'),
});

export async function handleCompleteTrainingSessionSet(
  { supabaseClient, user, rawPathParams }: Pick<ApiHandlerContext, 'supabaseClient' | 'user' | 'rawPathParams'>
): Promise<Response> {
  const parsedPathParams = pathParamsSchema.safeParse(rawPathParams);
  if (!parsedPathParams.success) {
    return createErrorResponse(400, 'Invalid path parameters.', { issues: parsedPathParams.error.issues });
  }

  const { sessionId, setId } = parsedPathParams.data;
  const getUpdateData = (_: SessionSetDto) => ({ status: 'COMPLETED', actual_reps: _.expected_reps, completed_at: new Date().toISOString() });

  return await patchSessionSet({ supabaseClient, user }, sessionId, setId, getUpdateData);
}

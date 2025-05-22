import { z } from 'zod';
import { createErrorResponse } from '@shared/utils/api-helpers.ts';
import { patchSessionSet } from "../../../shared/patch-session-set.ts";
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';
import type { SessionSetDto } from "@shared/models/api-types.ts";

const pathParamsSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID format'),
  setId: z.string().uuid('Invalid set ID format'),
});

const queryParamsSchema = z.object({
  reps: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number().nonnegative('Rep count must be positive').optional()
  ),
});

export async function handleFailTrainingSessionSet(
  { supabaseClient, user, url, rawPathParams }: Pick<ApiHandlerContext, 'supabaseClient' | 'user' | 'url' | 'rawPathParams'>
): Promise<Response> {
  const parsedPathParams = pathParamsSchema.safeParse(rawPathParams);
  if (!parsedPathParams.success) {
    return createErrorResponse(400, 'Invalid path parameters.', { issues: parsedPathParams.error.issues });
  }

  const queryParams = Object.fromEntries(url.searchParams);
  const parsedQueryParams = queryParamsSchema.safeParse(queryParams);
  if (!parsedQueryParams.success) {
    return createErrorResponse(400, 'Invalid query parameters', parsedQueryParams.error.flatten());
  }

  const { reps } = parsedQueryParams.data;
  const { sessionId, setId } = parsedPathParams.data;
  const getUpdateData = (_: SessionSetDto) => ({ status: 'FAILED', actual_reps: reps, completed_at: new Date().toISOString()});

  return await patchSessionSet({ supabaseClient, user }, sessionId, setId, getUpdateData);
}

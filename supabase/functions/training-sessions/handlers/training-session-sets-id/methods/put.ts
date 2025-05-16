import { z } from 'zod';
import { insertAndNormalizeOrder } from '@shared/services/index-order/index-order.ts';
import { createErrorResponse, createSuccessResponse } from '@shared/utils/api-helpers.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';
import type { SessionSetDto, UpdateSessionSetCommand } from '@shared/models/api-types.ts';

const SessionSetStatusSchema = z.enum(['PENDING', 'COMPLETED', 'FAILED', 'SKIPPED']);

const pathParamsSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID format'),
  setId: z.string().uuid('Invalid set ID format'),
});

const updateSessionSetCommandSchema = z.object({
  set_index: z.number().int().positive('Set index must be a positive integer.').optional(),
  actual_weight: z.number().nonnegative('Actual weight cannot be negative.').optional(),
  actual_reps: z.number().int().nonnegative('Actual reps must be a non-negative integer.').optional(),
  status: SessionSetStatusSchema.optional(),
  completed_at: z.string().datetime({ message: 'Invalid datetime format for completed_at.' }).nullable().optional(), // Allow null to clear it
}).refine(data => !((data.status === 'COMPLETED' || data.status === 'FAILED') && !data.completed_at), {
  message: "completed_at is required if status is COMPLETED or FAILED.",
  path: ["completed_at"],
}).refine(data => (!data.completed_at) || (data.status === 'COMPLETED' || data.status === 'FAILED'), {
  message: "completed_at should only be provided if status is COMPLETED or FAILED.",
  path: ["completed_at"],
});

export async function handleUpdateTrainingSessionSetById(
  { supabaseClient, user, rawPathParams, req }: Pick<ApiHandlerContext, 'supabaseClient' | 'user' | 'rawPathParams' | 'req'>
): Promise<Response> {
  const parsedPathParams = pathParamsSchema.safeParse(rawPathParams);
  if (!parsedPathParams.success) {
    return createErrorResponse(400, 'Invalid path parameters.', { issues: parsedPathParams.error.issues }, 'VALIDATION_ERROR');
  }
  const { sessionId, setId } = parsedPathParams.data;

  let body;
  try {
    if (!req) {
      console.error('Request object is missing in ApiHandlerContext for PUT');
      return createErrorResponse(500, 'Internal server error: Request context missing.', undefined, 'INTERNAL_ERROR');
    }
    body = await req.json();
  } catch (error) {
    return createErrorResponse(400, 'Invalid JSON body.', undefined, 'BAD_REQUEST', error instanceof Error ? error : undefined);
  }

  if (Object.keys(body).length === 0) {
    return createErrorResponse(400, 'Request body must contain at least one field to update.', undefined, 'VALIDATION_ERROR');
  }

  const parsedBody = updateSessionSetCommandSchema.safeParse(body);
  if (!parsedBody.success) {
    return createErrorResponse(400, 'Invalid request body for update.', { issues: parsedBody.error.issues }, 'VALIDATION_ERROR');
  }
  const updateCommand = parsedBody.data as UpdateSessionSetCommand;

  try {
    const { data: trainingSession, error: sessionFetchError } = await supabaseClient
      .from('training_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user!.id)
      .maybeSingle();

    if (sessionFetchError) {
      console.error('Error fetching training session for PUT:', sessionFetchError);
      return createErrorResponse(500, 'Error verifying session access.', { details: sessionFetchError.message });
    }
    if (!trainingSession) {
      return createErrorResponse(404, `Training session with ID ${sessionId} not found or access denied.`);
    }

    const { data: existingSet, error: existingSetError } = await supabaseClient
      .from('session_sets')
      .select('*')
      .eq('id', setId)
      .eq('training_session_id', sessionId)
      .maybeSingle();

    if (existingSetError) {
      console.error('Error fetching existing session set for PUT:', existingSetError);
      return createErrorResponse(500, 'Failed to fetch session set for update.', { details: existingSetError.message });
    }
    if (!existingSet) {
      return createErrorResponse(404, `Session set with ID ${setId} not found in session ${sessionId}.`);
    }

    const setToUpdatePlanExerciseId = existingSet.training_plan_exercise_id;

    const { data: allCurrentSetsForExerciseDb, error: allSetsError } = await supabaseClient
      .from('session_sets')
      .select('*')
      .eq('training_session_id', sessionId)
      .eq('training_plan_exercise_id', setToUpdatePlanExerciseId)
      .order('set_index', { ascending: true });

    if (allSetsError) {
      console.error('Error fetching sibling session sets for reordering:', allSetsError);
      return createErrorResponse(500, 'Failed to fetch sibling sets for reordering.', { details: allSetsError.message });
    }
    const allCurrentSetsForExercise: SessionSetDto[] = (allCurrentSetsForExerciseDb || []) as SessionSetDto[];

    const updatedSetData: SessionSetDto = {
      ...existingSet,
      ...updateCommand,
      set_index: updateCommand.set_index !== undefined ? updateCommand.set_index : existingSet.set_index,
      status: updateCommand.status !== undefined ? updateCommand.status : existingSet.status,
      completed_at: updateCommand.completed_at !== undefined ? updateCommand.completed_at : existingSet.completed_at,
    };

    const normalizedSets = insertAndNormalizeOrder<SessionSetDto>(
      allCurrentSetsForExercise,
      updatedSetData,
      (s) => s.id,
      (s) => s.set_index,
      (s, newIdx) => ({ ...s, set_index: newIdx })
    );

    const setsToUpsertInDb = normalizedSets.map(s => {
      const { id, ...dataToUpsert } = s;
      return { id, ...dataToUpsert };
    });

    const { data: upsertedSets, error: upsertError } = await supabaseClient
      .from('session_sets')
      .upsert(setsToUpsertInDb, { onConflict: 'id' })
      .select();

    if (upsertError) {
      console.error('Error upserting session sets for PUT:', upsertError);
      return createErrorResponse(500, 'Failed to update session set(s).', { details: upsertError.message });
    }

    return createSuccessResponse<SessionSetDto>(200, upsertedSets?.find(s => s.id === setId) as SessionSetDto);
  } catch (e) {
    console.error('Unexpected error in handleUpdateTrainingSessionSetById:', e);
    return createErrorResponse(500, 'An unexpected error occurred while updating the session set.', { details: (e as Error).message });
  }
}

import { ApiHandlerContext } from "@shared/utils/api-handler.ts";
import { SessionSetDto } from "@shared/models/api-types.ts";
import { createErrorResponse, createSuccessResponse } from "@shared/utils/api-helpers.ts";

export async function patchSessionSet(
  { supabaseClient, user }: Pick<ApiHandlerContext, 'supabaseClient' | 'user'>,
  sessionId: string,
  setId: string,
  getUpdateSetData: (set: SessionSetDto) => Partial<SessionSetDto>
): Promise<Response> {
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
    if (trainingSession.status === 'COMPLETED') {
      return createErrorResponse(400, `Training session ${sessionId} is completed. Cannot update set.`);
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

    const updateSetData = getUpdateSetData(existingSet);

    if (updateSetData.status === 'FAILED' && updateSetData.actual_reps && updateSetData.actual_reps > existingSet.expected_reps) {
      return createErrorResponse(400, `Cannot fail a set with ID ${setId} with more reps than expected (expected: ${existingSet.expected_reps}, actual: ${updateSetData.actual_reps}).`);
    }

    if (trainingSession.status === 'PENDING') {
      const { error: updateError } = await supabaseClient
        .from('training_sessions')
        .update({ status: 'IN_PROGRESS', session_date: new Date().toISOString() })
        .eq('id', sessionId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating session status for PATCH:', updateError);
        return createErrorResponse(500, 'Failed to update session status.', { details: updateError.message });
      }
    }

    const { data: updatedSet, error: updateError } = await supabaseClient
      .from('session_sets')
      .update(updateSetData)
      .eq('id', setId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating session set for PATCH:', updateError);
      return createErrorResponse(500, 'Failed to update session set.', { details: updateError.message });
    }

    return createSuccessResponse<SessionSetDto>(200, updatedSet);
  } catch (e) {
    console.error('Unexpected error in handleUpdateTrainingSessionSetById:', e);
    return createErrorResponse(500, 'An unexpected error occurred while updating the session set.', { details: (e as Error).message });
  }
}
import { z } from 'zod';
import { insertAndNormalizeOrder } from '@shared/services/index-order/index-order.ts';
import { createErrorResponse, createSuccessResponse } from '@shared/utils/api-helpers.ts';
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
      status: 'COMPLETED',
      completed_at: new Date().toISOString(),
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

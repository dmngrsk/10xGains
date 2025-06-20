import { z } from 'zod';
import type { Context } from 'hono';
import { insertAndNormalizeOrder } from '../../services/index-order/index-order.ts';
import { createErrorDataWithLogging } from '../../utils/api-helpers.ts';
import type { SessionSetDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  sessionId: z.string().uuid('Invalid sessionId format'),
  setId: z.string().uuid('Invalid setId format'),
});

export async function handleDeleteTrainingSessionSetById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const supabaseClient = c.get('supabase');
  const user = c.get('user');

  try {
    const { data: trainingSession, error: sessionFetchError } = await supabaseClient
      .from('training_sessions')
      .select('*')
      .eq('id', path!.sessionId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (sessionFetchError) {
      console.error('Error fetching training session for PUT:', sessionFetchError);
      const errorData = createErrorDataWithLogging(500, 'Error verifying session access.', { details: sessionFetchError.message }, undefined, sessionFetchError);
      return c.json(errorData, 500);
    }
    if (!trainingSession) {
      const errorData = createErrorDataWithLogging(404, `Training session with ID ${path!.sessionId} not found or access denied.`);
      return c.json(errorData, 404);
    }

    const { data: existingSet, error: existingSetError } = await supabaseClient
      .from('session_sets')
      .select('*')
      .eq('id', path!.setId)
      .eq('training_session_id', path!.sessionId)
      .maybeSingle();

    if (existingSetError) {
      console.error('Error fetching existing session set for PUT:', existingSetError);
      const errorData = createErrorDataWithLogging(500, 'Failed to fetch session set for update.', { details: existingSetError.message }, undefined, existingSetError);
      return c.json(errorData, 500);
    }
    if (!existingSet) {
      const errorData = createErrorDataWithLogging(404, `Session set with ID ${path!.setId} not found in session ${path!.sessionId}.`);
      return c.json(errorData, 404);
    }

    const setToUpdatePlanExerciseId = existingSet.training_plan_exercise_id;

    const { data: allCurrentSetsForExerciseDb, error: allSetsError } = await supabaseClient
      .from('session_sets')
      .select('*')
      .eq('training_session_id', path!.sessionId)
      .eq('training_plan_exercise_id', setToUpdatePlanExerciseId)
      .order('set_index', { ascending: true });

    if (allSetsError) {
      console.error('Error fetching sibling session sets for reordering:', allSetsError);
      const errorData = createErrorDataWithLogging(500, 'Failed to fetch sibling sets for reordering.', { details: allSetsError.message }, undefined, allSetsError);
      return c.json(errorData, 500);
    }
    const allCurrentSetsForExercise: SessionSetDto[] = (allCurrentSetsForExerciseDb.filter(s => s.id !== path!.setId) || []) as SessionSetDto[];

    const normalizedSets = insertAndNormalizeOrder<SessionSetDto>(
      allCurrentSetsForExercise,
      null,
      (s: SessionSetDto) => s.id,
      (s: SessionSetDto) => s.set_index,
      (s: SessionSetDto, newIdx: number) => ({ ...s, set_index: newIdx })
    );

    const setsToUpsertInDb = normalizedSets.map((s: SessionSetDto) => {
      const { id, ...dataToUpsert } = s;
      return { id, ...dataToUpsert };
    });

    // TODO: Refactor this to a transaction, possible via PostgreSQL RPC
    const { error: deleteError } = await supabaseClient
      .from('session_sets')
      .delete()
      .eq('id', path!.setId);

    if (deleteError) {
      console.error('Error deleting session set for DELETE:', deleteError);
      const errorData = createErrorDataWithLogging(500, 'Failed to delete session set.', { details: deleteError.message }, undefined, deleteError);
      return c.json(errorData, 500);
    }

    const { error: upsertError } = await supabaseClient
      .from('session_sets')
      .upsert(setsToUpsertInDb, { onConflict: 'id' })
      .select();

    if (upsertError) {
      console.error('Error upserting session sets for PUT:', upsertError);
      const errorData = createErrorDataWithLogging(500, 'Failed to update session set(s).', { details: upsertError.message }, undefined, upsertError);
      return c.json(errorData, 500);
    }

    return c.body(null, 204);
  } catch (e) {
    console.error('Unexpected error in handleDeleteTrainingSessionSetById:', e);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred while updating the session set.', { details: (e as Error).message }, undefined, e);
    return c.json(errorData, 500);
  }
}

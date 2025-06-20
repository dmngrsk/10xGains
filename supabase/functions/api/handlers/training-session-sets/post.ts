import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import { insertAndNormalizeOrder } from '../../services/index-order/index-order.ts';
import type { CreateSessionSetCommand, SessionSetDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody, validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  sessionId: z.string().uuid('Invalid sessionId format'),
});

const COMMAND_SCHEMA = z.object({
  training_plan_exercise_id: z.string().uuid('Invalid training plan exercise ID format'),
  set_index: z.number().int().positive('Set index must be a positive integer').optional(),
  expected_reps: z.number().int().nonnegative('Expected reps must be a non-negative integer'),
  actual_reps: z.number().int().nonnegative('Actual reps must be a non-negative integer').nullable().optional(),
  actual_weight: z.number().nonnegative('Actual weight cannot be negative'),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'SKIPPED']).default('PENDING').optional(),
  completed_at: z.string().datetime('Invalid datetime format for completed_at').nullable().optional(),
}).refine(data => !((data.status === 'COMPLETED' || data.status === 'FAILED') && !data.completed_at), {
   message: "completed_at is required if status is COMPLETED or FAILED.",
   path: ["completed_at"],
}).refine(data => (!data.completed_at) || (data.status === 'COMPLETED' || data.status === 'FAILED'), {
  message: "completed_at should only be provided if status is COMPLETED or FAILED.",
  path: ["completed_at"],
});

export async function handleCreateTrainingSessionSet(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, CreateSessionSetCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

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

    const { data: allCurrentSetsForExerciseDb, error: allSetsError } = await supabaseClient
      .from('session_sets')
      .select('*')
      .eq('training_session_id', path!.sessionId)
      .eq('training_plan_exercise_id', command!.training_plan_exercise_id)
      .order('set_index', { ascending: true });

    if (allSetsError) {
      console.error('Error fetching sibling session sets for reordering:', allSetsError);
      const errorData = createErrorDataWithLogging(500, 'Failed to fetch sibling sets for reordering.', { details: allSetsError.message }, undefined, allSetsError);
      return c.json(errorData, 500);
    }
    const allCurrentSetsForExercise: SessionSetDto[] = (allCurrentSetsForExerciseDb || []) as SessionSetDto[];

    const newSetId = crypto.randomUUID();
    const newSetForNormalization: SessionSetDto = {
      id: newSetId,
      training_session_id: path!.sessionId,
      training_plan_exercise_id: command!.training_plan_exercise_id,
      set_index: command!.set_index,
      expected_reps: command!.expected_reps,
      actual_reps: command!.actual_reps,
      actual_weight: command!.actual_weight,
      status: command!.status || 'PENDING',
      completed_at: command!.completed_at || null,
    } as SessionSetDto;

    const normalizedSets = insertAndNormalizeOrder<SessionSetDto>(
      allCurrentSetsForExercise,
      newSetForNormalization,
      (s: SessionSetDto) => s.id,
      (s: SessionSetDto) => s.set_index,
      (s: SessionSetDto, newIndex: number) => ({ ...s, set_index: newIndex })
    );

    const setsToUpsertInDb = normalizedSets.map((s: SessionSetDto) => {
      const { id, ...dataToUpsert } = s;
      return { id, ...dataToUpsert };
    });

    const { data: upsertedSets, error: upsertError } = await supabaseClient
      .from('session_sets')
      .upsert(setsToUpsertInDb, { onConflict: 'id' })
      .select();

    if (upsertError) {
      console.error('Error upserting session sets for PUT:', upsertError);
      const errorData = createErrorDataWithLogging(500, 'Failed to update session set(s).', { details: upsertError.message }, undefined, upsertError);
      return c.json(errorData, 500);
    }

    const successData = createSuccessData<SessionSetDto>(upsertedSets?.find((s: SessionSetDto) => s.id === newSetId) as SessionSetDto);
    return c.json(successData, 200);
  } catch (e) {
    console.error('Unexpected error in handleUpdateTrainingSessionSetById:', e);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred while updating the session set.', { details: (e as Error).message }, undefined, e);
    return c.json(errorData, 500);
  }
}

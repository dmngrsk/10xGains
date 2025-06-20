// Disable linting warnings for this file due to many out-of-schema queries
// deno-lint-ignore-file no-explicit-any

import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import { resolveExerciseProgressions } from '../../services/exercise-progressions/exercise-progressions.ts';
import type { SessionSetDto, TrainingPlanExerciseDto, TrainingPlanExerciseProgressionDto, TrainingSessionDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from '../../utils/validation.ts';

const PATH_SCHEMA = z.object({
  sessionId: z.string().uuid({ message: 'Invalid session ID format in path' }),
});

export async function handleCompleteTrainingSession(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const supabaseClient = c.get('supabase');
  const user = c.get('user');

  try {
    // Step 1: Fetch the training session.
    const { data: existingSession, error: fetchSessionError } = await supabaseClient
      .from('training_sessions')
      .select('id, training_plan_id, status, user_id')
      .eq('id', path!.sessionId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchSessionError) {
      console.error(`Error fetching training session ${path!.sessionId} for user ${user.id}:`, fetchSessionError);
      const errorData = createErrorDataWithLogging(500, 'Failed to retrieve training session.', { details: fetchSessionError.message }, undefined, fetchSessionError);
      return c.json(errorData, 500);
    }

    if (!existingSession) {
      const errorData = createErrorDataWithLogging(404, 'Training session not found or not accessible.');
      return c.json(errorData, 404);
    }

    if (existingSession.status !== 'IN_PROGRESS') {
      const errorData = createErrorDataWithLogging(400, `Session cannot be completed. Current status: ${existingSession.status}. Expected: IN_PROGRESS.`);
      return c.json(errorData, 400);
    }

    if (!existingSession.training_plan_id) {
      console.error(`Session ${path!.sessionId} is missing training_plan_id.`);
      const errorData = createErrorDataWithLogging(500, 'Training plan ID missing from the session. Cannot calculate progressions.');
      return c.json(errorData, 500);
    }

    // Step 2: Fetch all session sets and associated training plan exercise data.
    const { data: setData, error: sessionSetsError } = await supabaseClient
      .from('session_sets')
      .select(`
        *,
        plan_exercises:training_plan_exercises!training_plan_exercise_id (
          exercises:exercises!exercise_id (
            *
          )
        )
      `)
      .eq('training_session_id', path!.sessionId);

    if (sessionSetsError) {
      console.error(`Error fetching session sets for ID ${path!.sessionId}:`, sessionSetsError);
      const errorData = createErrorDataWithLogging(500, 'Failed to fetch session sets.', { details: sessionSetsError.message }, undefined, sessionSetsError);
      return c.json(errorData, 500);
    }

    const exerciseIds = [
      ...new Set(setData
        .flatMap((ss: any) => ss.plan_exercises)
        .flatMap((tpe: any) => tpe.exercises)
        .map((e: any) => e.id)
      )
    ];

    const { data: planData, error: planDataError } = await supabaseClient
      .from('training_plan_days')
      .select(`
        exercises:training_plan_exercises!inner (
          *,
          sets:training_plan_exercise_sets!inner (
            *
          ),
          global_exercises:exercises!exercise_id!inner (
            progression:training_plan_exercise_progressions!exercise_id (
              *
            )
          )
        )
      `)
      .eq('training_plan_id', existingSession.training_plan_id)
      .in('exercises.exercise_id', exerciseIds);

    if (planDataError) {
      console.error(`Error fetching training plan data for ID ${existingSession.training_plan_id}:`, planDataError);
      const errorData = createErrorDataWithLogging(500, 'Failed to fetch training plan data.', { details: planDataError.message }, undefined, planDataError);
      return c.json(errorData, 500);
    }

    // Step 3: Recalculate weight and progression rules for each exercise.
    const sessionSets = setData.map(({ plan_exercises: _, ...ss }: any) => ss) as SessionSetDto[];

    const planExercises = [...new Map(
      planData
        .flatMap((s: any) => s.exercises)
        .map(({ global_exercises: _, ...tpe }: any) => [tpe.id, tpe])
      ).values()
    ] as TrainingPlanExerciseDto[];

    const planExerciseProgressions = [...new Map(
      planData
        .flatMap((s: any) => s.exercises)
        .flatMap((pe: any) => pe.global_exercises)
        .flatMap((pe: any) => pe.progression)
        .map((p: any) => [p.id, p])
      ).values()
    ] as TrainingPlanExerciseProgressionDto[];

    const { exerciseSetsToUpdate, exerciseProgressionsToUpdate } = resolveExerciseProgressions(
      sessionSets,
      planExercises,
      planExerciseProgressions
    );

    // Step 4: Update data related to the session and the related training plan.
    // TODO: Refactor this to a transaction, possible via PostgreSQL RPC
    if (exerciseSetsToUpdate.length > 0) {
        const { error: upsertSetsError } = await supabaseClient
          .from('training_plan_exercise_sets')
          .upsert(exerciseSetsToUpdate, { onConflict: 'id' });

      if (upsertSetsError) {
        console.error('Error upserting training plan exercise sets:', upsertSetsError);
        const errorData = createErrorDataWithLogging(500, 'Failed to update exercise sets.', { details: upsertSetsError.message }, undefined, upsertSetsError);
        return c.json(errorData, 500);
      }
    }

    if (exerciseProgressionsToUpdate.length > 0) {
      const { error: upsertProgressionsError } = await supabaseClient
        .from('training_plan_exercise_progressions')
        .upsert(exerciseProgressionsToUpdate, { onConflict: 'id' });

      if (upsertProgressionsError) {
        console.error('Error upserting training plan exercise progressions:', upsertProgressionsError);
        const errorData = createErrorDataWithLogging(500, 'Failed to update exercise progressions.', { details: upsertProgressionsError.message }, undefined, upsertProgressionsError);
        return c.json(errorData, 500);
      }
    }

    if (sessionSets.filter(ss => ss.status === 'PENDING').length > 0) {
      const { error: updatePendingSetsError } = await supabaseClient
        .from('session_sets')
        .update({ status: 'SKIPPED' })
        .eq('training_session_id', path!.sessionId)
        .eq('status', 'PENDING');

      if (updatePendingSetsError) {
        console.error(`Error updating PENDING session sets to SKIPPED for session ${path!.sessionId}:`, updatePendingSetsError);
        const errorData = createErrorDataWithLogging(500, 'Failed to update statuses of pending sets.', { details: updatePendingSetsError.message }, undefined, updatePendingSetsError);
        return c.json(errorData, 500);
      }
    }

    const { data: updatedSessionEntry, error: updateSessionError } = await supabaseClient
      .from('training_sessions')
      .update({ status: 'COMPLETED' })
      .eq('id', path!.sessionId)
      .eq('user_id', user.id)
      .select('*')
      .single();

    if (updateSessionError) {
      console.error(`Error updating session ${path!.sessionId} status to COMPLETED:`, updateSessionError);
      if (updateSessionError.code === 'PGRST116') {
        const errorData = createErrorDataWithLogging(404, 'Session not found or already completed by another process.');
        return c.json(errorData, 404);
      }
      const errorData = createErrorDataWithLogging(500, 'Failed to finalize session completion status.', { details: updateSessionError.message }, undefined, updateSessionError);
      return c.json(errorData, 500);
    }

    if (!updatedSessionEntry) {
      console.error(`Session ${path!.sessionId} was not updated to COMPLETED, though no explicit error was thrown.`);
      const errorData = createErrorDataWithLogging(404, 'Session not found or could not be updated.');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<TrainingSessionDto>(updatedSessionEntry as TrainingSessionDto);
    return c.json(successData, 200);
  } catch (e) {
    console.error('Unexpected error in handleCompleteTrainingSession:', e);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred.', { details: (e as Error).message }, undefined, e);
    return c.json(errorData, 500);
  }
}

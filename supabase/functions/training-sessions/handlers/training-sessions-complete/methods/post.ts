import { z } from 'zod';
import { createErrorResponse, createSuccessResponse, isRequestBodyEmpty } from '@shared/utils/api-helpers.ts';
import { resolveExerciseProgressions } from '@shared/services/exercise-progressions/exercise-progressions.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';
import type { SessionSetDto, TrainingPlanExerciseDto, TrainingPlanExerciseProgressionDto } from '@shared/models/api-types.ts';

const PathParamsSchema = z.object({
  sessionId: z.string().uuid({ message: 'Invalid session ID format in path' }),
});

export async function handleCompleteTrainingSession(
  { supabaseClient, user, rawPathParams, req }: Pick<ApiHandlerContext, 'supabaseClient' | 'user' | 'rawPathParams' | 'req'>
) {
  if (!(await isRequestBodyEmpty(req))) {
    return createErrorResponse(400, 'Request body must be empty.');
  }

  const pathValidationResult = PathParamsSchema.safeParse(rawPathParams);
  if (!pathValidationResult.success) {
    return createErrorResponse(400, 'Invalid session ID in path', pathValidationResult.error.flatten());
  }

  const { sessionId: completedSessionId } = pathValidationResult.data;
  const userId = user!.id;

  try {
    // Step 1: Fetch the training session.
    const { data: existingSession, error: fetchSessionError } = await supabaseClient
      .from('training_sessions')
      .select('id, training_plan_id, status, user_id')
      .eq('id', completedSessionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchSessionError) {
      console.error(`Error fetching training session ${completedSessionId} for user ${userId}:`, fetchSessionError);
      return createErrorResponse(500, 'Failed to retrieve training session.', { details: fetchSessionError.message });
    }

    if (!existingSession) {
      return createErrorResponse(404, 'Training session not found or not accessible.');
    }

    if (existingSession.status !== 'IN_PROGRESS') {
      return createErrorResponse(400, `Session cannot be completed. Current status: ${existingSession.status}. Expected: IN_PROGRESS.`);
    }

    if (!existingSession.training_plan_id) {
      console.error(`Session ${completedSessionId} is missing training_plan_id.`);
      return createErrorResponse(500, 'Training plan ID missing from the session. Cannot calculate progressions.');
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
      .eq('training_session_id', completedSessionId);

    if (sessionSetsError) {
      console.error(`Error fetching session sets for ID ${completedSessionId}:`, sessionSetsError);
      return createErrorResponse(500, 'Failed to fetch session sets.', { details: sessionSetsError.message });
    }

    const exerciseIds = [
      ...new Set(setData
        .flatMap(ss => ss.plan_exercises)
        .flatMap(tpe => tpe.exercises)
        .map(e => e.id)
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
      return createErrorResponse(500, 'Failed to fetch training plan data.', { details: planDataError.message });
    }

    // Step 3: Recalculate weight and progression rules for each exercise.
    const sessionSets = setData.map(({ plan_exercises: _, ...ss }) => ss) as SessionSetDto[];

    const planExercises = [...new Map(
      planData
        .flatMap(s => s.exercises)
        .map(({ global_exercises: _, ...tpe }) => [tpe.id, tpe])
      ).values()
    ] as TrainingPlanExerciseDto[];

    const planExerciseProgressions = [...new Map(
      planData
        .flatMap(s => s.exercises)
        .flatMap(pe => pe.global_exercises)
        .flatMap(pe => pe.progression)
        .map(p => [p.id, p])
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
        return createErrorResponse(500, 'Failed to update exercise sets.', { details: upsertSetsError.message });
      }
    }

    if (exerciseProgressionsToUpdate.length > 0) {
      const { error: upsertProgressionsError } = await supabaseClient
        .from('training_plan_exercise_progressions')
        .upsert(exerciseProgressionsToUpdate, { onConflict: 'id' });

      if (upsertProgressionsError) {
        console.error('Error upserting training plan exercise progressions:', upsertProgressionsError);
        return createErrorResponse(500, 'Failed to update exercise progressions.', { details: upsertProgressionsError.message });
      }
    }

    if (sessionSets.filter(ss => ss.status === 'PENDING').length > 0) {
      const { error: updatePendingSetsError } = await supabaseClient
        .from('session_sets')
        .update({ status: 'SKIPPED' })
        .eq('training_session_id', completedSessionId)
        .eq('status', 'PENDING');

      if (updatePendingSetsError) {
        console.error(`Error updating PENDING session sets to SKIPPED for session ${completedSessionId}:`, updatePendingSetsError);
        return createErrorResponse(500, 'Failed to update statuses of pending sets.', { details: updatePendingSetsError.message });
      }
    }

    const { data: updatedSessionEntry, error: updateSessionError } = await supabaseClient
      .from('training_sessions')
      .update({ status: 'COMPLETED' })
      .eq('id', completedSessionId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (updateSessionError) {
      console.error(`Error updating session ${completedSessionId} status to COMPLETED:`, updateSessionError);
      if (updateSessionError.code === 'PGRST116') {
        return createErrorResponse(404, 'Session not found or already completed by another process.');
      }
      return createErrorResponse(500, 'Failed to finalize session completion status.', { details: updateSessionError.message });
    }

    if (!updatedSessionEntry) {
      console.error(`Session ${completedSessionId} was not updated to COMPLETED, though no explicit error was thrown.`);
      return createErrorResponse(404, 'Session not found or could not be updated.');
    }

    return createSuccessResponse<CompleteTrainingSessionResponseDto>(200, updatedSessionEntry as CompleteTrainingSessionResponseDto);
  } catch (e) {
    console.error('Unexpected error in handleCompleteTrainingSession:', e);
    return createErrorResponse(500, 'An unexpected error occurred.', { details: (e as Error).message });
  }
}

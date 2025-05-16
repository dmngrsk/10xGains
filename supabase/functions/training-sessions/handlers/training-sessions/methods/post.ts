import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from '@shared/utils/api-helpers.ts';
import type { CreateTrainingSessionCommand, SessionSetDto, TrainingSessionDto } from '@shared/models/api-types.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';

const createTrainingSessionCommandSchema = z.object({
  training_plan_id: z.string().uuid({ message: 'Invalid Training Plan ID format' }),
  training_plan_day_id: z.string().uuid({ message: 'Invalid Training Plan Day ID format' }).optional(),
});

export async function handleCreateTrainingSessions(context: ApiHandlerContext) {
  const { supabaseClient, user, req } = context;

  const body = await req.json();
  const validationResult = createTrainingSessionCommandSchema.safeParse(body);
  if (!validationResult.success) {
    return createErrorResponse(400, 'Invalid request body', validationResult.error.flatten());
  }

  const command = validationResult.data as CreateTrainingSessionCommand;
  const userId = user!.id;
  let dayId = command.training_plan_day_id;

  try {
    // Step 1: Fetch the training plan and its days.
    const { data: plan, error: planError } = await supabaseClient
      .from('training_plans')
      .select(`
        days:training_plan_days!inner(
          id,
          order_index,
          exercises:training_plan_exercises!inner(
            sets:training_plan_exercise_sets!inner(
              *
            )
          )
        )
      `)
      .eq('user_id', userId)
      .eq('id', command.training_plan_id as string)
      .single();

    if (planError || !plan) {
      return createErrorResponse(404, 'Training plan not found.');
    }

    const dayIds = plan.days.sort((a, b) => a.order_index - b.order_index).map(d => d.id);

    // Step 2: Fetch the latest completed sessions for the training plan.
    const { data: sessions, error: sessionsError } = await supabaseClient
      .from('training_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('training_plan_id', command.training_plan_id as string)
      .in('status', ['COMPLETED', 'IN_PROGRESS'])
      .order('session_date', { ascending: false })
      .limit(10);

    if (sessionsError) {
      console.error('Error fetching in-progress sessions for plan ', command.training_plan_id, sessionsError);
      return createErrorResponse(500, 'Failed to fetch existing sessions', { details: sessionsError.message });
    }

    if (!dayId) {
      const latestCompletedSession = sessions!
        .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime())
        .find(s => s.status === 'COMPLETED');

      if (latestCompletedSession) {
        const dayIndex = dayIds.indexOf(latestCompletedSession.training_plan_day_id!);
        if (dayIndex !== -1) {
          dayId = dayIds[(dayIndex + 1) % dayIds.length];
        } else {
          console.error('Day index not found in training plan days.', dayIds, latestCompletedSession.training_plan_day_id);
          return createErrorResponse(500, 'Failed to identify next day for training plan', { details: 'Day index not found in training plan days.' });
        }
      } else if (!dayId) {
        dayId = dayIds[0];
      }
    }

    // Step 3: Build training plan entities to upsert, including the new training session and its related session sets.
    const recordsToUpsert: TrainingSessionDto[] = [];
    const sessionsInProgress = sessions!.filter(s => s.status === 'IN_PROGRESS');

    if (sessionsInProgress && sessionsInProgress.length > 0) {
      sessionsInProgress.forEach(s => {
        recordsToUpsert.push({
           ...s,
           training_plan_day_id: s.training_plan_day_id!,
           status: 'CANCELLED', // Override status
        });
      });
    }

    const newSessionId = crypto.randomUUID();
    recordsToUpsert.push({
      id: newSessionId,
      user_id: userId,
      training_plan_id: command.training_plan_id,
      training_plan_day_id: dayId,
      status: 'IN_PROGRESS',
      session_date: new Date().toISOString(),
    });

    const newSessionSets = plan.days
      .find(d => d.id === dayId)!.exercises
      .flatMap(e => (e.sets))
      .map((tpes) => ({
        id: crypto.randomUUID(),
        training_session_id: newSessionId,
        training_plan_exercise_id: tpes.training_plan_exercise_id,
        set_index: tpes.set_index,
        actual_weight: tpes.expected_weight,
        actual_reps: tpes.expected_reps,
        status: 'PENDING',
        completed_at: null
      })) as SessionSetDto[];

    // Step 4: Upsert the training session and its related session sets.
    // TODO: Refactor this to a transaction, possible via PostgreSQL RPC
    const { data: upsertedSessions, error: upsertError } = await supabaseClient
      .from('training_sessions')
      .upsert(recordsToUpsert, { onConflict: 'id' })
      .select();

    if (upsertError || !upsertedSessions || upsertedSessions.length === 0) {
      console.error('Error upserting training sessions:', upsertError);
      return createErrorResponse(500, 'Failed to save training sessions', { details: upsertError?.message });
    }

    const { error: upsertSessionSetsError } = await supabaseClient
      .from('session_sets')
      .insert(newSessionSets)
      .select();

    if (upsertSessionSetsError) {
      console.error('Error inserting session sets:', upsertSessionSetsError);
      return createErrorResponse(500, 'Failed to save session sets', { details: upsertSessionSetsError?.message });
    }

    const newlyCreatedSession = {
      ...upsertedSessions.find(s => s.id === newSessionId),
      sets: newSessionSets
    };

    if (!newlyCreatedSession) {
      console.error('Failed to find the newly created session (ID: ' + newSessionId + ') in upsert result.', upsertedSessions);
      return createErrorResponse(500, 'Failed to identify newly created session after save.');
    }

    return createSuccessResponse<TrainingSessionDto>(201, newlyCreatedSession as TrainingSessionDto);

  } catch (e) {
    console.error('Unexpected error in handleCreateTrainingSessions:', e);
    return createErrorResponse(500, 'An unexpected error occurred.', { details: (e as Error).message });
  }
}

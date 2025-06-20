import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import type { CreateTrainingSessionCommand, SessionSetDto, TrainingSessionDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody } from "../../utils/validation.ts";

const COMMAND_SCHEMA = z.object({
  training_plan_id: z.string().uuid('Invalid training plan ID format'),
  training_plan_day_id: z.string().uuid('Invalid training plan day ID format').nullable().optional(),
});

export async function handleCreateTrainingSession(c: Context<AppContext>) {
  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, CreateTrainingSessionCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const supabaseClient = c.get('supabase');
  const user = c.get('user');

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
      .eq('user_id', user!.id)
      .eq('id', command!.training_plan_id as string)
      .single();

    if (planError || !plan) {
      const errorData = createErrorDataWithLogging(404, 'Training plan not found.');
      return c.json(errorData, 404);
    }

    const dayIds = plan.days.sort((a, b) => a.order_index - b.order_index).map(d => d.id);

    // Step 2: Fetch the latest completed sessions for the training plan.
    const { data: sessions, error: sessionsError } = await supabaseClient
      .from('training_sessions')
      .select('*')
      .eq('user_id', user!.id)
      .eq('training_plan_id', command!.training_plan_id as string)
      .in('status', ['COMPLETED', 'PENDING', 'IN_PROGRESS'])
      .order('session_date', { ascending: false })
      .limit(10);

    if (sessionsError) {
      console.error('Error fetching in-progress sessions for plan ', command!.training_plan_id, sessionsError);
      const errorData = createErrorDataWithLogging(500, 'Failed to fetch existing sessions', { details: sessionsError.message });
      return c.json(errorData, 500);
    }

    let currentDayId = command!.training_plan_day_id;
    if (!currentDayId) {
      const latestCompletedSession = sessions!
        .filter(s => !!s.session_date)
        .sort((a, b) => new Date(b.session_date!).getTime() - new Date(a.session_date!).getTime())
        .find(s => s.status === 'COMPLETED');

      if (latestCompletedSession) {
        const dayIndex = dayIds.indexOf(latestCompletedSession.training_plan_day_id!);
        if (dayIndex !== -1) {
          currentDayId = dayIds[(dayIndex + 1) % dayIds.length];
        } else {
          console.error('Day index not found in training plan days.', dayIds, latestCompletedSession.training_plan_day_id);
          const errorData = createErrorDataWithLogging(500, 'Failed to identify next day for training plan', { details: 'Day index not found in training plan days.' });
          return c.json(errorData, 500);
        }
      } else if (!currentDayId) {
        currentDayId = dayIds[0];
      }
    }

    // Step 3: Build training plan entities to upsert, including the new training session and its related session sets.
    const recordsToUpsert: TrainingSessionDto[] = [];
    const sessionsInProgress = sessions!.filter(s => s.status === 'IN_PROGRESS' || s.status === 'PENDING');

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
      user_id: user!.id,
      training_plan_id: command!.training_plan_id,
      training_plan_day_id: currentDayId,
      status: 'PENDING',
      session_date: null
    });

    const newSessionSets = plan.days
      .find(d => d.id === currentDayId)!.exercises
      .flatMap(e => (e.sets))
      .map((tpes) => ({
        id: crypto.randomUUID(),
        training_session_id: newSessionId,
        training_plan_exercise_id: tpes.training_plan_exercise_id,
        set_index: tpes.set_index,
        expected_reps: tpes.expected_reps,
        actual_reps: null,
        actual_weight: tpes.expected_weight,
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
      const errorData = createErrorDataWithLogging(500, 'Failed to save training sessions', { details: upsertError?.message });
      return c.json(errorData, 500);
    }

    const { error: upsertSessionSetsError } = await supabaseClient
      .from('session_sets')
      .insert(newSessionSets)
      .select();

    if (upsertSessionSetsError) {
      console.error('Error inserting session sets:', upsertSessionSetsError);
      const errorData = createErrorDataWithLogging(500, 'Failed to save session sets', { details: upsertSessionSetsError?.message });
      return c.json(errorData, 500);
    }

    const newlyCreatedSession = {
      ...upsertedSessions.find(s => s.id === newSessionId),
      sets: newSessionSets
    };

    if (!newlyCreatedSession) {
      console.error('Failed to find the newly created session (ID: ' + newSessionId + ') in upsert result.', upsertedSessions);
      const errorData = createErrorDataWithLogging(500, 'Failed to identify newly created session after save.');
      return c.json(errorData, 500);
    }

    const successData = createSuccessData<TrainingSessionDto>(newlyCreatedSession as TrainingSessionDto);
    return c.json(successData, 201);
  } catch (e) {
    console.error('Unexpected error in handleCreateTrainingSession:', e);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred.', { details: (e as Error).message }, undefined, e);
    return c.json(errorData, 500);
  }
}

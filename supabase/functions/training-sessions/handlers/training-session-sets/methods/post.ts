import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from '@shared/utils/api-helpers.ts';
import { insertAndNormalizeOrder } from '@shared/services/index-order/index-order.ts';
import type { CreateSessionSetCommand, SessionSetDto } from '@shared/models/api-types.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';

const SessionSetStatusSchema = z.enum(['PENDING', 'COMPLETED', 'FAILED', 'SKIPPED']);
export type SessionSetStatus = z.infer<typeof SessionSetStatusSchema>;

const createSessionSetCommandSchema = z.object({
  training_plan_exercise_id: z.string().uuid('Invalid training plan exercise ID format.'),
  set_index: z.number().int().positive('Set index must be a positive integer.').optional(),
  expected_reps: z.number().int().nonnegative('Expected reps must be a non-negative integer.'),
  actual_reps: z.number().int().nonnegative('Actual reps must be a non-negative integer.').nullable().optional(),
  actual_weight: z.number().nonnegative('Actual weight cannot be negative.'),
  status: SessionSetStatusSchema.default('PENDING').optional(),
  completed_at: z.string().datetime({ message: 'Invalid datetime format for completed_at.' }).optional(),
}).refine(data => !((data.status === 'COMPLETED' || data.status === 'FAILED') && !data.completed_at), {
   message: "completed_at is required if status is COMPLETED or FAILED.",
   path: ["completed_at"],
}).refine(data => (!data.completed_at) || (data.status === 'COMPLETED' || data.status === 'FAILED'), {
  message: "completed_at should only be provided if status is COMPLETED or FAILED.",
  path: ["completed_at"],
});

const pathParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

export async function handleCreateTrainingSessionSet(
  { supabaseClient, user, rawPathParams, req }: ApiHandlerContext
): Promise<Response> {
  const parsedPathParams = pathParamsSchema.safeParse(rawPathParams);
  if (!parsedPathParams.success) {
    return createErrorResponse(400, 'Invalid session ID format.', { issues: parsedPathParams.error.issues }, 'VALIDATION_ERROR');
  }
  const { sessionId } = parsedPathParams.data;

  let body;
  try {
    if (!req) {
      console.error('Request object is missing in ApiHandlerContext');
      return createErrorResponse(500, 'Internal server error: Request context missing.');
    }
    body = await req.json();
  } catch (e) {
    return createErrorResponse(400, 'Invalid JSON body.', { details: (e as Error).message });
  }

  const parsedBody = createSessionSetCommandSchema.safeParse(body);
  if (!parsedBody.success) {
    return createErrorResponse(400, 'Invalid request body.', { issues: parsedBody.error.issues }, 'VALIDATION_ERROR');
  }

  const createCommand = parsedBody.data as CreateSessionSetCommand;

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

    const { data: allCurrentSetsForExerciseDb, error: allSetsError } = await supabaseClient
      .from('session_sets')
      .select('*')
      .eq('training_session_id', sessionId)
      .eq('training_plan_exercise_id', createCommand.training_plan_exercise_id)
      .order('set_index', { ascending: true });

    if (allSetsError) {
      console.error('Error fetching sibling session sets for reordering:', allSetsError);
      return createErrorResponse(500, 'Failed to fetch sibling sets for reordering.', { details: allSetsError.message });
    }
    const allCurrentSetsForExercise: SessionSetDto[] = (allCurrentSetsForExerciseDb || []) as SessionSetDto[];

    const newSetId = crypto.randomUUID();
    const newSetForNormalization: SessionSetDto = {
      id: newSetId,
      training_session_id: sessionId,
      training_plan_exercise_id: createCommand.training_plan_exercise_id,
      set_index: createCommand.set_index,
      expected_reps: createCommand.expected_reps,
      actual_reps: createCommand.actual_reps,
      actual_weight: createCommand.actual_weight,
      status: createCommand.status || 'PENDING',
      completed_at: createCommand.completed_at || null,
    } as SessionSetDto;

    const normalizedSets = insertAndNormalizeOrder<SessionSetDto>(
      allCurrentSetsForExercise,
      newSetForNormalization,
      (s) => s.id,
      (s) => s.set_index,
      (s, newIndex) => ({ ...s, set_index: newIndex })
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

    return createSuccessResponse<SessionSetDto>(200, upsertedSets?.find(s => s.id === newSetId) as SessionSetDto);
  } catch (e) {
    console.error('Unexpected error in handleUpdateTrainingSessionSetById:', e);
    return createErrorResponse(500, 'An unexpected error occurred while updating the session set.', { details: (e as Error).message });
  }
}

import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from 'shared/api-helpers.ts';
import type { CreateTrainingPlanCommand, TrainingPlanDto } from 'shared/api-types.ts';
import type { ApiHandlerContext } from 'shared/api-routing.ts';

export const createTrainingPlanBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
});

export async function handleCreateTrainingPlan(
  { supabaseClient, user, req, requestInfo }: ApiHandlerContext
): Promise<Response> {
  if (!user) {
    return createErrorResponse(401, 'User authentication required.', undefined, 'AUTH_REQUIRED', undefined, requestInfo);
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return createErrorResponse(
      400,
      'Invalid JSON body',
      { details: (e instanceof Error ? e.message : String(e)) },
      undefined,
      e,
      requestInfo
    );
  }

  const validationResult = createTrainingPlanBodySchema.safeParse(body);
  if (!validationResult.success) {
    return createErrorResponse(
      400,
      'Invalid request body',
      validationResult.error.flatten(),
      undefined,
      undefined,
      requestInfo
    );
  }

  const validatedData = validationResult.data as CreateTrainingPlanCommand;
  const newPlanData = {
    name: validatedData.name,
    description: validatedData.description ?? null,
    user_id: user.id, // Safe now due to check above
  };

  try {
    const { data, error: dbError } = await supabaseClient
      .from('training_plans')
      .insert(newPlanData)
      .select()
      .single();

    if (dbError) {
      return createErrorResponse(
        500,
        'Failed to create training plan',
        { details: dbError.message },
        'DB_ERROR',
        dbError,
        requestInfo
      );
    }

    return createSuccessResponse<TrainingPlanDto>(201, data as TrainingPlanDto);
  } catch (e) {
    return createErrorResponse(
      500,
      'An unexpected error occurred while creating training plan',
      { details: (e instanceof Error ? e.message : String(e)) },
      undefined,
      e,
      requestInfo
    );
  }
} 
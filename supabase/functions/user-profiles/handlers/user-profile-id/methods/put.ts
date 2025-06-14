import { z } from 'zod';
import { createErrorResponse, createSuccessResponse } from '@shared/utils/api-helpers.ts';
import type { UserProfileDto, UpsertUserProfileCommand } from '@shared/models/api-types.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';

const UpsertUserProfilePayloadSchema = z.object({
  first_name: z.string().optional(),
  active_training_plan_id: z.string().uuid({ message: 'Invalid UUID format for active training plan ID.' }).nullable().optional(),
})
.refine(data => Object.keys(data).length > 0, {
  message: "Request body must contain at least one field to update."
});

export async function handleUpsertUserProfile(
  { supabaseClient, user, rawPathParams, req }: Pick<ApiHandlerContext, 'supabaseClient' | 'user' | 'rawPathParams' | 'req'>
): Promise<Response> {
  if (!rawPathParams || !rawPathParams.id) {
    return createErrorResponse(400, 'User ID path parameter is missing.');
  }

  if (user!.id !== rawPathParams.id) {
    return createErrorResponse(403, 'Forbidden: You can only update your own profile.');
  }

  let body: UpsertUserProfileCommand;
  try {
    body = await req.json();
  } catch (e) {
    console.error('Error parsing request body:', e);
    return createErrorResponse(400, 'Invalid JSON body.');
  }

  const validationResult = UpsertUserProfilePayloadSchema.safeParse(body);

  if (!validationResult.success) {
    return createErrorResponse(400, 'Validation failed', validationResult.error.flatten());
  }

  const validatedData = validationResult.data;

  const { data: existingProfile, error } = await supabaseClient
    .from('user_profiles')
    .select('*')
    .eq('id', user!.id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user profile for update:', error);
    return createErrorResponse(500, 'Failed to fetch user profile details for update.', { details: error.message });
  }

  const dataToUpsert: UserProfileDto = {
    id: user!.id,
    first_name: validatedData.first_name || existingProfile?.first_name || '',
    active_training_plan_id: validatedData.active_training_plan_id || existingProfile?.active_training_plan_id || null,
    ai_suggestions_remaining: existingProfile?.ai_suggestions_remaining || 0,
    created_at: existingProfile?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabaseClient
      .from('user_profiles')
      .upsert(dataToUpsert, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('Error updating user profile:', error);
      return createErrorResponse(500, 'Failed to create or update user profile.');
    }

    return createSuccessResponse<UserProfileDto>(200, data as UserProfileDto);
  } catch (e) {
    console.error('Unexpected error in handleUpsertUserProfile:', e);
    return createErrorResponse(500, 'An unexpected error occurred.', { details: (e as Error).message });
  }
}

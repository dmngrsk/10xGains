import { z } from 'zod';
import { createErrorResponse, createSuccessResponse, stripUndefinedValues } from '@shared/utils/api-helpers.ts';
import type { UserProfileDto, UpdateUserProfileCommand } from '@shared/models/api-types.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';

const UpdateUserProfilePayloadSchema = z.object({
  first_name: z.string().optional(),
  active_training_plan_id: z.string().uuid({ message: 'Invalid UUID format for active training plan ID.' }).nullable().optional(),
})
.refine(data => Object.keys(data).length > 0, {
  message: "Request body must contain at least one field to update."
});

export async function handleUpdateUserProfile(
  { supabaseClient, user, rawPathParams, req }: Pick<ApiHandlerContext, 'supabaseClient' | 'user' | 'rawPathParams' | 'req'>
): Promise<Response> {
  if (!rawPathParams || !rawPathParams.id) {
    return createErrorResponse(400, 'User ID path parameter is missing.');
  }

  if (user!.id !== rawPathParams.id) {
    return createErrorResponse(403, 'Forbidden: You can only update your own profile.');
  }

  let body: UpdateUserProfileCommand;
  try {
    body = await req.json();
  } catch (e) {
    console.error('Error parsing request body:', e);
    return createErrorResponse(400, 'Invalid JSON body.');
  }

  const validationResult = UpdateUserProfilePayloadSchema.safeParse(body);

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

  const dataToUpsert: Partial<UserProfileDto> = {
    ...(existingProfile || {}),
    ...stripUndefinedValues(validatedData),
    id: user!.id,
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
    console.error('Unexpected error in handleUpdateUserProfile:', e);
    return createErrorResponse(500, 'An unexpected error occurred.', { details: (e as Error).message });
  }
}

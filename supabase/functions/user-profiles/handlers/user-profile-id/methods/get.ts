import { createErrorResponse, createSuccessResponse } from '@shared/utils/api-helpers.ts';
import type { UserProfileDto } from '@shared/models/api-types.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';

export async function handleGetUserProfile(
  { supabaseClient, user, rawPathParams }: Pick<ApiHandlerContext, 'supabaseClient' | 'user' | 'rawPathParams'>
): Promise<Response> {
  if (!rawPathParams || !rawPathParams.id) {
    return createErrorResponse(400, 'User ID path parameter is missing.');
  }

  if (user!.id !== rawPathParams.id) {
    return createErrorResponse(403, 'Forbidden: You can only access your own profile.');
  }

  try {
    const { data, error } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('id', user!.id)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      if (error.code === 'PGRST116' || !data) {
         return createErrorResponse(404, 'User profile not found.');
      }
      return createErrorResponse(500, 'Failed to retrieve user profile.');
    }

    if (!data) {
      return createErrorResponse(404, 'User profile not found.');
    }

    return createSuccessResponse<UserProfileDto>(200, data as UserProfileDto);
  } catch (e) {
    console.error('Unexpected error in handleGetUserProfile:', e);
    return createErrorResponse(500, 'An unexpected error occurred.');
  }
}

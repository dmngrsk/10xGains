import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import type { UserProfileDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  userId: z.string().uuid('Invalid userId format'),
});

export async function handleGetUserProfile(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const supabaseClient = c.get('supabase');
  const user = c.get('user');

  if (user.id !== path!.userId) {
    const errorData = createErrorDataWithLogging(403, 'Forbidden: You can only access your own profile.');
    return c.json(errorData, 403);
  }

  try {
    const { data, error } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      if (error.code === 'PGRST116' || !data) {
        const errorData = createErrorDataWithLogging(404, 'User profile not found.');
        return c.json(errorData, 404);
      }
      const errorData = createErrorDataWithLogging(500, 'Failed to retrieve user profile.');
      return c.json(errorData, 500);
    }

    if (!data) {
      const errorData = createErrorDataWithLogging(404, 'User profile not found.');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<UserProfileDto>(data as UserProfileDto);
    return c.json(successData, 200);
  } catch (e) {
    console.error('Unexpected error in handleGetUserProfile:', e);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred.');
    return c.json(errorData, 500);
  }
}

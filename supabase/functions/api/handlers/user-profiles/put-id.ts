import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import type { UserProfileDto, UpsertUserProfileCommand } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody, validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  userId: z.string().uuid('Invalid userId format'),
});

const COMMAND_SCHEMA = z.object({
  first_name: z.string().optional(),
  active_training_plan_id: z.string().uuid({ message: 'Invalid UUID format for active training plan ID.' }).nullable().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: "Request body must contain at least one field to update."
});

export async function handleUpsertUserProfile(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, UpsertUserProfileCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const supabaseClient = c.get('supabase');
  const user = c.get('user');

  if (user.id !== path!.userId) {
    const errorData = createErrorDataWithLogging(403, 'Forbidden: You can only update your own profile.');
    return c.json(errorData, 403);
  }

  try {
    const { data: existingProfile, error: existingProfileError } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (existingProfileError) {
      console.error('Error fetching user profile for update:', existingProfileError);
      const errorData = createErrorDataWithLogging(500, 'Failed to fetch user profile details for update.', { details: existingProfileError.message });
      return c.json(errorData, 500);
    }

    const dataToUpsert: UserProfileDto = {
      id: user.id,
      first_name: command!.first_name || existingProfile?.first_name || '',
      active_training_plan_id: command!.active_training_plan_id !== undefined ? command!.active_training_plan_id : existingProfile?.active_training_plan_id || null,
      ai_suggestions_remaining: existingProfile?.ai_suggestions_remaining || 0,
      created_at: existingProfile?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseClient
      .from('user_profiles')
      .upsert(dataToUpsert, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('Error updating user profile:', error);
      const errorData = createErrorDataWithLogging(500, 'Failed to create or update user profile.');
      return c.json(errorData, 500);
    }

    const successData = createSuccessData<UserProfileDto>(data as UserProfileDto);
    return c.json(successData, 200);
  } catch (e) {
    console.error('Unexpected error in handleUpsertUserProfile:', e);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred', { details: (e as Error).message });
    return c.json(errorData, 500);
  }
}

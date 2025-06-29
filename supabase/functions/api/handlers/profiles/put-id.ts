import { z } from 'zod';
import type { Context } from 'hono';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { ProfileDto, UpsertProfileCommand } from '../../models/api.types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody, validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  userId: z.string().uuid('Invalid userId format'),
});

const COMMAND_SCHEMA = z.object({
  first_name: z.string().optional(),
  active_plan_id: z.string().uuid({ message: 'Invalid UUID format for active plan ID.' }).nullable().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: "Request body must contain at least one field to update."
});

export async function handleUpsertProfile(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, UpsertProfileCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const profileRepository = c.get('profileRepository');

  try {
    const updatedProfile = await profileRepository.upsert(path!.userId, command!);

    const successData = createSuccessData<ProfileDto>(updatedProfile);
    return c.json(successData, 200);
  } catch (e) {
    const fallbackMessage = 'Failed to create or update user profile';
    return handleRepositoryError(c, e as Error, profileRepository.handleProfileError, handleUpsertProfile.name, fallbackMessage);
  }
}

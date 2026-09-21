import { z } from 'zod';
import type { Context } from 'hono';
import { BODY_FAT_METHODS, MEASUREMENT_TYPES, SEXES } from '@txg/shared';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers';
import type { ProfileDto, UpsertProfileCommand } from '@txg/shared';
import type { AppContext } from '../../context';
import { calendarDate, validateCommandBody, validatePathParams } from "../../utils/validation";

const PATH_SCHEMA = z.object({
  userId: z.string().uuid('Invalid userId format'),
});

const COMMAND_SCHEMA = z.object({
  first_name: z.string().max(100, 'First name must not exceed 100 characters').optional(),
  active_plan_id: z.string().uuid({ message: 'Invalid UUID format for active plan ID.' }).nullable().optional(),
  date_of_birth: calendarDate('Date of birth').nullable().optional(),
  body_fat_method: z.enum(BODY_FAT_METHODS).nullable().optional(),
  height_cm: z.number().min(50).max(300).nullable().optional(),
  sex: z.enum(SEXES).nullable().optional(),
  measurement_frequency_days: z.number().int().min(1).max(365).nullable().optional(),
  tracked_measurement_types: z.array(z.enum(MEASUREMENT_TYPES)).max(MEASUREMENT_TYPES.length).nullable().optional(),
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
    return handleRepositoryError(c, e as Error, handleUpsertProfile.name, fallbackMessage);
  }
}

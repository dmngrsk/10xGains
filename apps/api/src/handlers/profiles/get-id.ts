import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData, handleRepositoryError } from '../../utils/api-helpers';
import type { ProfileDto } from '@txg/shared';
import type { AppContext } from '../../context';
import { validatePathParams } from "../../utils/validation";

const PATH_SCHEMA = z.object({
  userId: z.string().uuid('Invalid userId format'),
});

export async function handleGetProfile(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const profileRepository = c.get('profileRepository');

  try {
    const profile = await profileRepository.findById(path!.userId);

    if (!profile) {
      const errorData = createErrorDataWithLogging(404, 'User profile not found.');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<ProfileDto>(profile);
    return c.json(successData, 200);
  } catch (e) {
    const fallbackMessage = 'Failed to get user profile';
    return handleRepositoryError(c, e as Error, profileRepository.handleProfileError, handleGetProfile.name, fallbackMessage);
  }
}

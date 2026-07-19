import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData, handleRepositoryError } from '../../../utils/api-helpers';
import type { SessionSetDto } from '@txg/shared';
import type { AppContext } from '../../../context';

export async function patch(
  c: Context<AppContext>,
  sessionId: string,
  setId: string,
  getUpdateSetData: (set: SessionSetDto) => Partial<SessionSetDto>
): Promise<Response> {
  const sessionRepository = c.get('sessionRepository');

  try {
    const currentSet = await sessionRepository.findSetById(sessionId, setId);

    if (!currentSet) {
      const errorData = createErrorDataWithLogging(404, 'Session set not found.');
      return c.json(errorData, 404);
    }

    const updatedSet = await sessionRepository.patchSet(sessionId, setId, getUpdateSetData);

    if (!updatedSet) {
      const errorData = createErrorDataWithLogging(404, 'Session set not found for update.');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData(updatedSet, { message: 'Session set updated successfully.' });
    return c.json(successData, 200);
  } catch (e) {
    // `patchSet` raises a ConflictError for a completed session and a NotFoundError for a missing
    // session or set; `handleRepositoryError` maps both from their type, so the status no longer
    // depends on matching words in the message.
    const fallbackMessage = 'Failed to update training session set';
    return handleRepositoryError(c, e as Error, 'patch', fallbackMessage);
  }
}

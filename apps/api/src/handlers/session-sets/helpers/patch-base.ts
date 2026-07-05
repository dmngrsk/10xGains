import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData, handleRepositoryError } from '../../../utils/api-helpers';
import type { SessionSetDto } from '@txg/shared';
import type { AppContext } from '../../../context';

export async function patch(
  c: Context<AppContext>,
  sessionId: string,
  setId: string,
  getUpdateSetData: (set: SessionSetDto) => Partial<SessionSetDto>,
  afterUpdate?: (updatedSet: SessionSetDto) => Promise<void>
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

    // Best-effort side effect (e.g. scheduling push alerts); must not throw.
    if (afterUpdate) {
      await afterUpdate(updatedSet);
    }

    const successData = createSuccessData(updatedSet, { message: 'Session set updated successfully.' });
    return c.json(successData, 200);
  } catch (e) {
    if ((e as Error).message.includes('Session') && (e as Error).message.includes('is completed')) {
      const errorData = createErrorDataWithLogging(400, (e as Error).message);
      return c.json(errorData, 400);
    }

    const fallbackMessage = 'Failed to update training session set';
    return handleRepositoryError(c, e as Error, sessionRepository.handleSessionOwnershipError, 'patch', fallbackMessage);
  }
}

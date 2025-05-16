import { routeRequestToMethods, type MethodHandlers } from '@shared/utils/api-handler.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';
import { handleCompleteTrainingSession } from './methods/post.ts';

const ABSOLUTE_PATH_PATTERN = '/training-sessions/:sessionId/complete';

const methodHandlers: MethodHandlers = {
  POST: handleCompleteTrainingSession,
};

export async function handleTrainingSessionCompleteRoute(req: Request, context: ApiHandlerContext) {
  return await routeRequestToMethods(req, ABSOLUTE_PATH_PATTERN, methodHandlers, context);
}

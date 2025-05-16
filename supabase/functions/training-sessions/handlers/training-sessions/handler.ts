import { routeRequestToMethods, type MethodHandlers } from '@shared/utils/api-handler.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';
import { handleGetTrainingSessions } from './methods/get.ts';
import { handleCreateTrainingSessions } from './methods/post.ts';

const ABSOLUTE_PATH_PATTERN = '/training-sessions';

const methodHandlers: MethodHandlers = {
  GET: handleGetTrainingSessions,
  POST: handleCreateTrainingSessions,
};

export async function handleTrainingSessionsRoute(req: Request, context: ApiHandlerContext) {
  return await routeRequestToMethods(req, ABSOLUTE_PATH_PATTERN, methodHandlers, context);
}

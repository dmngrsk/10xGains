import { routeRequestToMethods, type MethodHandlers } from '@shared/utils/api-handler.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';
import { handleGetTrainingSessionById } from './methods/get.ts';
import { handlePutTrainingSessionById } from './methods/put.ts';
import { handleDeleteTrainingSessionById } from './methods/delete.ts';

const ABSOLUTE_PATH_PATTERN = '/training-sessions/:sessionId';

const methodHandlers: MethodHandlers = {
  GET: handleGetTrainingSessionById,
  PUT: handlePutTrainingSessionById,
  DELETE: handleDeleteTrainingSessionById,
};

export async function handleTrainingSessionByIdRoute(req: Request, context: ApiHandlerContext) {
  return await routeRequestToMethods(req, ABSOLUTE_PATH_PATTERN, methodHandlers, context);
}

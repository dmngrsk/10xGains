import { routeRequestToMethods, type MethodHandlers } from '@shared/utils/api-handler.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';
import { handleGetTrainingSessionSets } from "./methods/get.ts";
import { handleCreateTrainingSessionSet } from "./methods/post.ts";

export const ABSOLUTE_PATH_PATTERN = '/training-sessions/:sessionId/sets';

const methodHandlers: MethodHandlers = {
  GET: handleGetTrainingSessionSets,
  POST: handleCreateTrainingSessionSet
};

export async function handleTrainingSessionSetsRoute(req: Request, context: ApiHandlerContext) {
  return await routeRequestToMethods(req, ABSOLUTE_PATH_PATTERN, methodHandlers, context);
}

import { routeRequestToMethods, type MethodHandlers } from '@shared/utils/api-handler.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';
import { handleCompleteTrainingSessionSet } from "./methods/patch.ts";

export const ABSOLUTE_PATH_PATTERN = '/training-sessions/:sessionId/sets/:setId/complete';

const methodHandlers: MethodHandlers = {
  PATCH: handleCompleteTrainingSessionSet
};

export async function handleTrainingSessionSetCompleteRoute(req: Request, context: ApiHandlerContext) {
  return await routeRequestToMethods(req, ABSOLUTE_PATH_PATTERN, methodHandlers, context);
}

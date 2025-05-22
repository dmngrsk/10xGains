import { routeRequestToMethods, type MethodHandlers } from '@shared/utils/api-handler.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';
import { handleResetTrainingSessionSet } from "./methods/patch.ts";

export const ABSOLUTE_PATH_PATTERN = '/training-sessions/:sessionId/sets/:setId/reset';

const methodHandlers: MethodHandlers = {
  PATCH: handleResetTrainingSessionSet
};

export async function handleTrainingSessionSetResetRoute(req: Request, context: ApiHandlerContext) {
  return await routeRequestToMethods(req, ABSOLUTE_PATH_PATTERN, methodHandlers, context);
}

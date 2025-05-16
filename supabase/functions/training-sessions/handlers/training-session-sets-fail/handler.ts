import { routeRequestToMethods, type MethodHandlers } from '@shared/utils/api-handler.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';
import { handleFailTrainingSessionSet } from "./methods/patch.ts";

export const ABSOLUTE_PATH_PATTERN = '/training-sessions/:sessionId/sets/:setId/fail';

const methodHandlers: MethodHandlers = {
  PATCH: handleFailTrainingSessionSet
};

export async function handleTrainingSessionSetFailRoute(req: Request, context: ApiHandlerContext) {
  return await routeRequestToMethods(req, ABSOLUTE_PATH_PATTERN, methodHandlers, context);
}

import { routeRequestToMethods, type MethodHandlers } from '@shared/utils/api-handler.ts';
import type { ApiHandlerContext } from '@shared/utils/api-handler.ts';
import { handleGetTrainingSessionSetById } from "./methods/get.ts";
import { handleUpdateTrainingSessionSetById } from "./methods/put.ts";
import { handleDeleteTrainingSessionSetById } from "./methods/delete.ts";

export const ABSOLUTE_PATH_PATTERN = '/training-sessions/:sessionId/sets/:setId';

const methodHandlers: MethodHandlers = {
  GET: handleGetTrainingSessionSetById,
  PUT: handleUpdateTrainingSessionSetById,
  DELETE: handleDeleteTrainingSessionSetById,
};

export async function handleTrainingSessionSetByIdRoute(req: Request, context: ApiHandlerContext) {
  return await routeRequestToMethods(req, ABSOLUTE_PATH_PATTERN, methodHandlers, context);
}

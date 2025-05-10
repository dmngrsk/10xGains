import type { ApiHandlerContext, ApiHandler } from 'shared/api-handler.ts';
import { routeRequestToMethods } from 'shared/api-handler.ts';
import { handleGetExerciseById } from './methods/get.ts';
import { handlePutExerciseById } from './methods/put.ts';
import { handleDeleteExerciseById } from './methods/delete.ts';

export const ABSOLUTE_PATH_PATTERN = '/exercises/:id';

const methodHandlers: Record<string, ApiHandler> = {
  GET: handleGetExerciseById,
  PUT: handlePutExerciseById,
  DELETE: handleDeleteExerciseById,
};

export async function handleExerciseByIdRoute(req: Request, context: ApiHandlerContext) {
  return await routeRequestToMethods(req, ABSOLUTE_PATH_PATTERN, methodHandlers, context);
}

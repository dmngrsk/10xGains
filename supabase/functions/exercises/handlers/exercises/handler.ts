import { routeRequestToMethods } from '@shared/utils/api-handler.ts';
import type { ApiHandlerContext, MethodHandlers } from '@shared/utils/api-handler.ts';
import { handleGetExercises } from './methods/get.ts';
import { handleCreateExercise } from './methods/post.ts';

export const ABSOLUTE_PATH_PATTERN = '/exercises';

const methodHandlers: MethodHandlers = {
  GET: handleGetExercises,
  POST: handleCreateExercise,
};

export async function handleExercisesRoute(req: Request, context: ApiHandlerContext) {
  return await routeRequestToMethods(req, ABSOLUTE_PATH_PATTERN, methodHandlers, context);
}

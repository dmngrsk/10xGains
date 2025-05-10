import type { ApiHandlerContext, ApiHandler } from 'shared/api-handler.ts';
import { routeRequestToMethods } from 'shared/api-handler.ts';
import { handleGetExercises } from './methods/get.ts';
import { handlePostExercise } from './methods/post.ts';

export const ABSOLUTE_PATH_PATTERN = '/exercises';

const methodHandlers: Record<string, ApiHandler> = {
  GET: handleGetExercises,
  POST: handlePostExercise,
};

export async function handleExercisesRoute(req: Request, context: ApiHandlerContext) {
  return await routeRequestToMethods(req, ABSOLUTE_PATH_PATTERN, methodHandlers, context);
}

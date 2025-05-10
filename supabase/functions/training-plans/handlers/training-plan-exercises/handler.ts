import { routeRequestToMethods } from 'shared/api-handler.ts';
import type { ApiHandlerContext } from 'shared/api-types.ts';
import { handleGetTrainingPlanExercises } from './methods/get.ts';
import { handlePostTrainingPlanExercise } from './methods/post.ts';

export const ABSOLUTE_PATH_PATTERN = '/training-plans/:planId/days/:dayId/exercises';

const methodHandlers: Record<string, ApiHandler> = {
  GET: handleGetTrainingPlanExercises,
  POST: handlePostTrainingPlanExercise,
};

export async function handleTrainingPlanExercisesRoute(req: Request, context: ApiHandlerContext) {
  return await routeRequestToMethods(req, ABSOLUTE_PATH_PATTERN, methodHandlers, context);
}

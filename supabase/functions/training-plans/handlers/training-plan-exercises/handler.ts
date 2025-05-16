import { routeRequestToMethods } from '@shared/utils/api-handler.ts';
import type { ApiHandlerContext, MethodHandlers } from '@shared/utils/api-handler.ts';
import { handleGetTrainingPlanExercises } from './methods/get.ts';
import { handleCreateTrainingPlanExercise } from './methods/post.ts';

export const ABSOLUTE_PATH_PATTERN = '/training-plans/:planId/days/:dayId/exercises';

const methodHandlers: MethodHandlers = {
  GET: handleGetTrainingPlanExercises,
  POST: handleCreateTrainingPlanExercise,
};

export async function handleTrainingPlanExercisesRoute(req: Request, context: ApiHandlerContext) {
  return await routeRequestToMethods(req, ABSOLUTE_PATH_PATTERN, methodHandlers, context);
}

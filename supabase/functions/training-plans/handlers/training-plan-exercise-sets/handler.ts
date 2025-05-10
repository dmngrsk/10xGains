import { type ApiHandlerContext, routeRequestToMethods } from '../../../shared/api-handler.ts';
import { handleGetTrainingPlanExerciseSets } from './methods/get.ts';
import { handleCreateTrainingPlanExerciseSet } from './methods/post.ts';

export const ABSOLUTE_PATH_PATTERN = '/training-plans/:planId/days/:dayId/exercises/:exerciseId/sets';

const methodHandlers: Record<string, ApiHandler> = {
  GET: handleGetTrainingPlanExerciseSets,
  POST: handleCreateTrainingPlanExerciseSet,
};

export async function handleTrainingPlanExerciseSetsRoute(req: Request, context: ApiHandlerContext) {
  return await routeRequestToMethods(req, ABSOLUTE_PATH_PATTERN, methodHandlers, context);
}

import { type ApiHandlerContext, routeRequestToMethods } from 'shared/api-handler.ts';
import { handleGetTrainingPlanExerciseSetById } from './methods/get.ts';
import { handleUpdateTrainingPlanExerciseSet } from './methods/put.ts';
import { handleDeleteTrainingPlanExerciseSet } from './methods/delete.ts';

export const ABSOLUTE_PATH_PATTERN = '/training-plans/:planId/days/:dayId/exercises/:exerciseId/sets/:setId';

const methodHandlers: Record<string, ApiHandler> = {
  GET: handleGetTrainingPlanExerciseSetById,
  PUT: handleUpdateTrainingPlanExerciseSet,
  DELETE: handleDeleteTrainingPlanExerciseSet,
};

export async function handleTrainingPlanExerciseSetByIdRoute(req: Request, context: ApiHandlerContext) {
  return await routeRequestToMethods(req, ABSOLUTE_PATH_PATTERN, methodHandlers, context);
}

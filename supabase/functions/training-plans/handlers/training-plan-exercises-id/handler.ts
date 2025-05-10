import { routeRequestToMethods } from 'shared/api-handler.ts';
import type { ApiHandlerContext, ApiHandler } from 'shared/api-types.ts';
import { handleGetTrainingPlanExerciseById } from './methods/get.ts';
import { handlePutTrainingPlanExerciseById } from './methods/put.ts';
import { handleDeleteTrainingPlanExerciseById } from './methods/delete.ts';

export const ABSOLUTE_PATH_PATTERN = '/training-plans/:planId/days/:dayId/exercises/:exerciseId';

const methodHandlers: Record<string, ApiHandler> = {
  GET: handleGetTrainingPlanExerciseById,
  PUT: handlePutTrainingPlanExerciseById,
  DELETE: handleDeleteTrainingPlanExerciseById,
};

export async function handleTrainingPlanExerciseByIdRoute(req: Request, context: ApiHandlerContext) {
  return await routeRequestToMethods(req, ABSOLUTE_PATH_PATTERN, methodHandlers, context);
}

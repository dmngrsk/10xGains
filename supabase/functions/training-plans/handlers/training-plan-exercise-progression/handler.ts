import { type ApiHandlerContext, routeRequestToMethods } from 'shared/api-handler.ts';
import { handleGetTrainingPlanExerciseProgression } from './methods/get.ts';
import { handleUpsertTrainingPlanExerciseProgression } from './methods/put.ts';

const ABSOLUTE_PATH_PATTERN = '/training-plans/:planId/exercises/:exerciseId/progression';

const methodHandlers: Record<string, ApiHandler> = {
  GET: handleGetTrainingPlanExerciseProgression,
  PUT: handleUpsertTrainingPlanExerciseProgression,
};

export async function handleTrainingPlanExerciseProgressionRoute(req: Request, context: ApiHandlerContext) {
  return await routeRequestToMethods(req, ABSOLUTE_PATH_PATTERN, methodHandlers, context);
}

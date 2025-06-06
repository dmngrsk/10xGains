import { routeRequestToMethods } from '@shared/utils/api-handler.ts';
import type { ApiHandlerContext, MethodHandlers } from '@shared/utils/api-handler.ts';
import { handleGetTrainingPlanExerciseProgressions } from './methods/get.ts';

const ABSOLUTE_PATH_PATTERN = '/training-plans/:planId/progressions';

const methodHandlers: MethodHandlers = {
  GET: handleGetTrainingPlanExerciseProgressions
};

export async function handleTrainingPlanExerciseProgressionsRoute(req: Request, context: ApiHandlerContext) {
  return await routeRequestToMethods(req, ABSOLUTE_PATH_PATTERN, methodHandlers, context);
}

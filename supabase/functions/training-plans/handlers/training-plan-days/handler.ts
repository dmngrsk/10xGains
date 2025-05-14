import { routeRequestToMethods } from '@shared/utils/api-handler.ts';
import type { ApiHandlerContext, MethodHandlers } from '@shared/utils/api-handler.ts';
import { handleGetTrainingPlanDays } from './methods/get.ts';
import { handlePostTrainingPlanDay } from './methods/post.ts';

const ABSOLUTE_PATH_PATTERN = '/training-plans/:planId/days';

const methodHandlers: MethodHandlers = {
  GET: handleGetTrainingPlanDays,
  POST: handlePostTrainingPlanDay,
};

export async function handleTrainingPlanDaysRoute(req: Request, context: ApiHandlerContext) {
  return await routeRequestToMethods(req, ABSOLUTE_PATH_PATTERN, methodHandlers, context);
}

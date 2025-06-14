import { routeRequestToMethods } from '@shared/utils/api-handler.ts';
import type { ApiHandlerContext, MethodHandlers } from '@shared/utils/api-handler.ts';
import { handleGetTrainingPlans } from './methods/get.ts';
import { handleCreateTrainingPlan } from './methods/post.ts';

const ABSOLUTE_PATH_PATTERN = '/training-plans';

const methodHandlers: MethodHandlers = {
  GET: handleGetTrainingPlans,
  POST: handleCreateTrainingPlan,
};

export async function handleTrainingPlansRoute(req: Request, context: ApiHandlerContext) {
  return await routeRequestToMethods(req, ABSOLUTE_PATH_PATTERN, methodHandlers, context);
}

import { routeRequestToMethods } from 'shared/api-handler.ts';
import type { ApiHandlerContext, ApiHandler } from 'shared/api-handler.ts';

import { handleGetTrainingPlans } from './methods/get.ts';
import { handleCreateTrainingPlan } from './methods/post.ts';

const ABSOLUTE_PATH_PATTERN = '/training-plans';

const methodHandlers: Record<string, ApiHandler> = {
  GET: handleGetTrainingPlans,
  POST: handleCreateTrainingPlan,
};

export async function handleTrainingPlansRoute(req: Request, context: ApiHandlerContext) {
  return await routeRequestToMethods(req, ABSOLUTE_PATH_PATTERN, methodHandlers, context);
} 

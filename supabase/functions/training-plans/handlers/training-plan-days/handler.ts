import { routeRequestToMethods } from 'shared/api-routing.ts';
import type { ApiHandlerContext, ApiHandler } from 'shared/api-routing.ts';

import { handleGetTrainingPlanDays } from './methods/get.ts';
import { handlePostTrainingPlanDay } from './methods/post.ts';

const ABSOLUTE_PATH_PATTERN = '/training-plans/:planId/days'; // Matched against the full path from the domain root

const methodHandlers: Record<string, ApiHandler> = {
  GET: handleGetTrainingPlanDays,
  POST: handlePostTrainingPlanDay,
};

export async function handleTrainingPlanDaysRoute(req: Request, context: ApiHandlerContext) {
  return await routeRequestToMethods(req, ABSOLUTE_PATH_PATTERN, methodHandlers, context);
} 
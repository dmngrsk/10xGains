import { routeRequestToMethods } from '@shared/utils/api-handler.ts';
import type { ApiHandlerContext, MethodHandlers } from '@shared/utils/api-handler.ts';
import { handleGetTrainingPlanDayById } from './methods/get.ts';
import { handlePutTrainingPlanDayById } from './methods/put.ts';
import { handleDeleteTrainingPlanDayById } from './methods/delete.ts';

export const ABSOLUTE_PATH_PATTERN = '/training-plans/:planId/days/:dayId';

const methodHandlers: MethodHandlers = {
  GET: handleGetTrainingPlanDayById,
  PUT: handlePutTrainingPlanDayById,
  DELETE: handleDeleteTrainingPlanDayById,
};

export async function handleTrainingPlanDayByIdRoute(req: Request, context: ApiHandlerContext) {
  return await routeRequestToMethods(req, ABSOLUTE_PATH_PATTERN, methodHandlers, context);
}

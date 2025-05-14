import { routeRequestToMethods } from '@shared/utils/api-handler.ts';
import type { ApiHandlerContext, MethodHandlers } from '@shared/utils/api-handler.ts';
import { handleGetTrainingPlanById } from './methods/get.ts';
import { handlePutTrainingPlanById } from './methods/put.ts';
import { handleDeleteTrainingPlanById } from './methods/delete.ts';

const ABSOLUTE_PATH_PATTERN = '/training-plans/:planId';

const methodHandlers: MethodHandlers = {
  GET: handleGetTrainingPlanById,
  PUT: handlePutTrainingPlanById,
  DELETE: handleDeleteTrainingPlanById,
};

export async function handleTrainingPlanByIdRoute(req: Request, context: ApiHandlerContext) {
  return await routeRequestToMethods(req, ABSOLUTE_PATH_PATTERN, methodHandlers, context);
}

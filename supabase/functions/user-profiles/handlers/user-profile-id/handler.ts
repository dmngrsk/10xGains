import { routeRequestToMethods, type MethodHandlers } from '@shared/api-handler.ts';
import type { ApiHandlerContext, PASS_ROUTE_INDICATOR } from '@shared/api-handler.ts';
import { handleGetUserProfile } from './methods/get.ts';
import { handleUpdateUserProfile } from './methods/put.ts';

const ABSOLUTE_PATH_PATTERN = '/user-profiles/:id';

const methodHandlers: MethodHandlers = {
  GET: handleGetUserProfile,
  PUT: handleUpdateUserProfile,
};

export async function handleUserProfileByIdRoute(req: Request, context: ApiHandlerContext): Promise<Response | typeof PASS_ROUTE_INDICATOR> {
  return await routeRequestToMethods(req, ABSOLUTE_PATH_PATTERN, methodHandlers, context);
}

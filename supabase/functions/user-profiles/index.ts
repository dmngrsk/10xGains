import { createMainRouterHandler, type ApiRouterHandler } from '@shared/api-handler.ts';
import { handleUserProfileByIdRoute } from "./handlers/user-profile-id/handler.ts";

const MAIN_FUNCTION_MOUNT_PATH = '/user-profiles';

const routeHandlers: ApiRouterHandler[] = [
  handleUserProfileByIdRoute,
];

const handler = createMainRouterHandler(routeHandlers, MAIN_FUNCTION_MOUNT_PATH);

Deno.serve(handler);

import { createMainRouterHandler, type ApiRouterHandler } from '@shared/utils/api-handler.ts';
import { handleTrainingSessionsRoute } from './handlers/training-sessions/handler.ts';
import { handleTrainingSessionByIdRoute } from './handlers/training-sessions-id/handler.ts';
import { handleTrainingSessionCompleteRoute } from './handlers/training-sessions-complete/handler.ts';
import { handleTrainingSessionSetsRoute } from "./handlers/training-session-sets/handler.ts";
import { handleTrainingSessionSetByIdRoute } from "./handlers/training-session-sets-id/handler.ts";
import { handleTrainingSessionSetCompleteRoute } from "./handlers/training-session-sets-complete/handler.ts";
import { handleTrainingSessionSetFailRoute } from "./handlers/training-session-sets-fail/handler.ts";

const MAIN_FUNCTION_MOUNT_PATH = '/training-sessions';

const routeHandlers: ApiRouterHandler[] = [
  handleTrainingSessionsRoute,
  handleTrainingSessionByIdRoute,
  handleTrainingSessionCompleteRoute,
  handleTrainingSessionSetsRoute,
  handleTrainingSessionSetByIdRoute,
  handleTrainingSessionSetCompleteRoute,
  handleTrainingSessionSetFailRoute,
];

const handler = createMainRouterHandler(routeHandlers, MAIN_FUNCTION_MOUNT_PATH);

Deno.serve(handler);

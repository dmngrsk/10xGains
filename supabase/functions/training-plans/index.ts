import { serve } from 'std/http/server.ts';
import { createMainRouterHandler, type ApiRouterHandler } from 'shared/api-routing.ts';

import { handleTrainingPlansRoute } from './handlers/training-plans/handler.ts';
import { handleTrainingPlanByIdRoute } from './handlers/training-plans-id/handler.ts';

const MAIN_FUNCTION_MOUNT_PATH = '/training-plans';

const routeHandlers: ApiRouterHandler[] = [
  handleTrainingPlansRoute,
  handleTrainingPlanByIdRoute,
];

const handler = createMainRouterHandler(routeHandlers, MAIN_FUNCTION_MOUNT_PATH);

serve(handler);

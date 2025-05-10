import { serve } from 'std/http/server.ts';
import { createMainRouterHandler, type ApiRouterHandler } from 'shared/api-handler.ts';

import { handleExercisesRoute } from './handlers/exercises/handler.ts';
import { handleExerciseByIdRoute } from './handlers/exercises-id/handler.ts';

const MAIN_FUNCTION_MOUNT_PATH = '/exercises';

const routeHandlers: ApiRouterHandler[] = [
  handleExercisesRoute,
  handleExerciseByIdRoute,
];

const handler = createMainRouterHandler(routeHandlers, MAIN_FUNCTION_MOUNT_PATH);

serve(handler);

import { createMainRouterHandler, type ApiRouterHandler } from '@shared/utils/api-handler.ts';
import { handleTrainingPlansRoute } from './handlers/training-plans/handler.ts';
import { handleTrainingPlanByIdRoute } from './handlers/training-plans-id/handler.ts';
import { handleTrainingPlanDaysRoute } from './handlers/training-plan-days/handler.ts';
import { handleTrainingPlanDayByIdRoute } from './handlers/training-plan-days-id/handler.ts';
import { handleTrainingPlanExercisesRoute } from './handlers/training-plan-exercises/handler.ts';
import { handleTrainingPlanExerciseByIdRoute } from './handlers/training-plan-exercises-id/handler.ts';
import { handleTrainingPlanExerciseSetsRoute } from './handlers/training-plan-exercise-sets/handler.ts';
import { handleTrainingPlanExerciseSetByIdRoute } from './handlers/training-plan-exercise-sets-id/handler.ts';
import { handleTrainingPlanExerciseProgressionRoute } from './handlers/training-plan-exercise-progression/handler.ts';

const MAIN_FUNCTION_MOUNT_PATH = '/training-plans';

const routeHandlers: ApiRouterHandler[] = [
  handleTrainingPlansRoute,
  handleTrainingPlanByIdRoute,
  handleTrainingPlanDaysRoute,
  handleTrainingPlanDayByIdRoute,
  handleTrainingPlanExercisesRoute,
  handleTrainingPlanExerciseByIdRoute,
  handleTrainingPlanExerciseSetsRoute,
  handleTrainingPlanExerciseSetByIdRoute,
  handleTrainingPlanExerciseProgressionRoute,
];

const handler = createMainRouterHandler(routeHandlers, MAIN_FUNCTION_MOUNT_PATH);

Deno.serve(handler);

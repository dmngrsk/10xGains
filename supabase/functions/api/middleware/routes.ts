import { Context, Hono } from 'hono';
import { requiredAuthMiddleware, optionalAuthMiddleware } from './auth.ts';
import { handleGetExercises } from '../handlers/exercises/get.ts';
import { handleCreateExercise } from '../handlers/exercises/post.ts';
import { handleGetExerciseById } from '../handlers/exercises/get-id.ts';
import { handlePutExerciseById } from '../handlers/exercises/put-id.ts';
import { handleDeleteExerciseById } from '../handlers/exercises/delete-id.ts';
import { handleGetUserProfile } from '../handlers/user-profiles/get-id.ts';
import { handleUpsertUserProfile } from '../handlers/user-profiles/put-id.ts';
import { handleGetTrainingPlans } from '../handlers/training-plans/get.ts';
import { handleCreateTrainingPlan } from '../handlers/training-plans/post.ts';
import { handleGetTrainingPlanById } from '../handlers/training-plans/get-id.ts';
import { handlePutTrainingPlanById } from '../handlers/training-plans/put-id.ts';
import { handleDeleteTrainingPlanById } from '../handlers/training-plans/delete-id.ts';
import { handleGetTrainingSessions } from '../handlers/training-sessions/get.ts';
import { handleCreateTrainingSession } from '../handlers/training-sessions/post.ts';
import { handleGetTrainingSessionById } from '../handlers/training-sessions/get-id.ts';
import { handlePutTrainingSessionById } from '../handlers/training-sessions/put-id.ts';
import { handleDeleteTrainingSessionById } from '../handlers/training-sessions/delete-id.ts';
import { handleCompleteTrainingSession } from '../handlers/training-sessions/post-complete.ts';
import { handleGetTrainingPlanDays } from '../handlers/training-plan-days/get.ts';
import { handleCreateTrainingPlanDay } from '../handlers/training-plan-days/post.ts';
import { handleGetTrainingPlanDayById } from '../handlers/training-plan-days/get-id.ts';
import { handlePutTrainingPlanDayById } from '../handlers/training-plan-days/put-id.ts';
import { handleDeleteTrainingPlanDayById } from '../handlers/training-plan-days/delete-id.ts';
import { handleGetTrainingPlanExercises } from '../handlers/training-plan-exercises/get.ts';
import { handleCreateTrainingPlanExercise } from '../handlers/training-plan-exercises/post.ts';
import { handleGetTrainingPlanExerciseById } from '../handlers/training-plan-exercises/get-id.ts';
import { handlePutTrainingPlanExerciseById } from '../handlers/training-plan-exercises/put-id.ts';
import { handleDeleteTrainingPlanExerciseById } from '../handlers/training-plan-exercises/delete-id.ts';
import { handleGetTrainingPlanExerciseSets } from '../handlers/training-plan-exercise-sets/get.ts';
import { handleCreateTrainingPlanExerciseSet } from '../handlers/training-plan-exercise-sets/post.ts';
import { handleGetTrainingPlanExerciseSetById } from '../handlers/training-plan-exercise-sets/get-id.ts';
import { handleUpdateTrainingPlanExerciseSet } from '../handlers/training-plan-exercise-sets/put-id.ts';
import { handleDeleteTrainingPlanExerciseSet } from '../handlers/training-plan-exercise-sets/delete-id.ts';
import { handleGetTrainingPlanExerciseProgressions } from '../handlers/training-plan-exercise-progressions/get.ts';
import { handleGetTrainingPlanExerciseProgression } from '../handlers/training-plan-exercise-progressions/get-id.ts';
import { handleUpsertTrainingPlanExerciseProgression } from '../handlers/training-plan-exercise-progressions/put-id.ts';
import { handleGetTrainingSessionSets } from '../handlers/training-session-sets/get.ts';
import { handleCreateTrainingSessionSet } from '../handlers/training-session-sets/post.ts';
import { handleGetTrainingSessionSetById } from '../handlers/training-session-sets/get-id.ts';
import { handleUpdateTrainingSessionSetById } from '../handlers/training-session-sets/put-id.ts';
import { handleDeleteTrainingSessionSetById } from '../handlers/training-session-sets/delete-id.ts';
import { handleCompleteTrainingSessionSet } from '../handlers/training-session-sets/patch-complete.ts';
import { handleFailTrainingSessionSet } from '../handlers/training-session-sets/patch-fail.ts';
import { handleResetTrainingSessionSet } from '../handlers/training-session-sets/patch-reset.ts';
import type { AppContext } from '../context.ts';
import { createErrorDataWithLogging } from "../utils/api-helpers.ts";

// /api/exercises
function createExerciseRoutes(): Hono<AppContext> {
  return new Hono<AppContext>()
    .get('/', optionalAuthMiddleware, handleGetExercises)
    .post('/', requiredAuthMiddleware, handleCreateExercise)
    .get('/:exerciseId', optionalAuthMiddleware, handleGetExerciseById)
    .put('/:exerciseId', requiredAuthMiddleware, handlePutExerciseById)
    .delete('/:exerciseId', requiredAuthMiddleware, handleDeleteExerciseById);
}

// /api/user-profiles
function createUserProfileRoutes(): Hono<AppContext> {
  return new Hono<AppContext>()
    .get('/:userId', requiredAuthMiddleware, handleGetUserProfile)
    .put('/:userId', requiredAuthMiddleware, handleUpsertUserProfile);
}

// /api/training-plans
function createTrainingPlanRoutes(): Hono<AppContext> {
  return new Hono<AppContext>()
    .get('/', requiredAuthMiddleware, handleGetTrainingPlans)
    .post('/', requiredAuthMiddleware, handleCreateTrainingPlan)
    .get('/:planId', requiredAuthMiddleware, handleGetTrainingPlanById)
    .put('/:planId', requiredAuthMiddleware, handlePutTrainingPlanById)
    .delete('/:planId', requiredAuthMiddleware, handleDeleteTrainingPlanById)
    .route('/:planId/days', createTrainingPlanDayRoutes())
    .route('/:planId/progressions', createTrainingPlanExerciseProgressionRoutes());
}

// /api/training-plans/:planId/days
function createTrainingPlanDayRoutes(): Hono<AppContext> {
  return new Hono<AppContext>()
    .get('/', requiredAuthMiddleware, handleGetTrainingPlanDays)
    .post('/', requiredAuthMiddleware, handleCreateTrainingPlanDay)
    .get('/:dayId', requiredAuthMiddleware, handleGetTrainingPlanDayById)
    .put('/:dayId', requiredAuthMiddleware, handlePutTrainingPlanDayById)
    .delete('/:dayId', requiredAuthMiddleware, handleDeleteTrainingPlanDayById)
    .route('/:dayId/exercises', createTrainingPlanExerciseRoutes());
}

// /api/training-plans/:planId/exercises
function createTrainingPlanExerciseRoutes(): Hono<AppContext> {
  return new Hono<AppContext>()
    .get('/', requiredAuthMiddleware, handleGetTrainingPlanExercises)
    .post('/', requiredAuthMiddleware, handleCreateTrainingPlanExercise)
    .get('/:exerciseId', requiredAuthMiddleware, handleGetTrainingPlanExerciseById)
    .put('/:exerciseId', requiredAuthMiddleware, handlePutTrainingPlanExerciseById)
    .delete('/:exerciseId', requiredAuthMiddleware, handleDeleteTrainingPlanExerciseById)
    .route('/:exerciseId/sets', createTrainingPlanExerciseSetRoutes());
}

// /api/training-plans/:planId/exercises/:exerciseId/sets
function createTrainingPlanExerciseSetRoutes(): Hono<AppContext> {
  return new Hono<AppContext>()
    .get('/', requiredAuthMiddleware, handleGetTrainingPlanExerciseSets)
    .post('/', requiredAuthMiddleware, handleCreateTrainingPlanExerciseSet)
    .get('/:setId', requiredAuthMiddleware, handleGetTrainingPlanExerciseSetById)
    .put('/:setId', requiredAuthMiddleware, handleUpdateTrainingPlanExerciseSet)
    .delete('/:setId', requiredAuthMiddleware, handleDeleteTrainingPlanExerciseSet);
}

// /api/training-plans/:planId/progressions
function createTrainingPlanExerciseProgressionRoutes(): Hono<AppContext> {
  return new Hono<AppContext>()
    .get('/', requiredAuthMiddleware, handleGetTrainingPlanExerciseProgressions)
    .get('/:exerciseId', requiredAuthMiddleware, handleGetTrainingPlanExerciseProgression)
    .put('/:exerciseId', requiredAuthMiddleware, handleUpsertTrainingPlanExerciseProgression);
}

// /api/training-sessions
function createTrainingSessionRoutes(): Hono<AppContext> {
  return new Hono<AppContext>()
    .get('/', requiredAuthMiddleware, handleGetTrainingSessions)
    .post('/', requiredAuthMiddleware, handleCreateTrainingSession)
    .get('/:sessionId', requiredAuthMiddleware, handleGetTrainingSessionById)
    .put('/:sessionId', requiredAuthMiddleware, handlePutTrainingSessionById)
    .delete('/:sessionId', requiredAuthMiddleware, handleDeleteTrainingSessionById)
    .post('/:sessionId/complete', requiredAuthMiddleware, handleCompleteTrainingSession)
    .route('/:sessionId/sets', createTrainingSessionSetRoutes());
}

// /api/training-sessions/:sessionId/sets
function createTrainingSessionSetRoutes(): Hono<AppContext> {
  return new Hono<AppContext>()
    .get('/', requiredAuthMiddleware, handleGetTrainingSessionSets)
    .post('/', requiredAuthMiddleware, handleCreateTrainingSessionSet)
    .get('/:setId', requiredAuthMiddleware, handleGetTrainingSessionSetById)
    .put('/:setId', requiredAuthMiddleware, handleUpdateTrainingSessionSetById)
    .delete('/:setId', requiredAuthMiddleware, handleDeleteTrainingSessionSetById)
    .patch('/:setId/complete', requiredAuthMiddleware, handleCompleteTrainingSessionSet)
    .patch('/:setId/fail', requiredAuthMiddleware, handleFailTrainingSessionSet)
    .patch('/:setId/reset', requiredAuthMiddleware, handleResetTrainingSessionSet);
}

// Handles health check endpoint
function handleHealthEndpoint(c: Context) {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
}

// Handles any non-existing endpoint
function handleNotFound(c: Context) {
  const errorData = createErrorDataWithLogging(404, 'The requested endpoint was not found.');
  return c.json(errorData, 404);
}

// Handles any unhandled error
function handleOnError(err: Error, c: Context) {
  console.error('Unhandled error:', err);
  const errorData = createErrorDataWithLogging(500, 'Internal Server Error', { details: err.message });
  return c.json(errorData, 500);
}

const routes = new Hono<AppContext>();

routes.route('/exercises', createExerciseRoutes());
routes.route('/user-profiles', createUserProfileRoutes());
routes.route('/training-plans', createTrainingPlanRoutes());
routes.route('/training-sessions', createTrainingSessionRoutes());
routes.get('/health', handleHealthEndpoint);
routes.notFound(handleNotFound);
routes.onError(handleOnError);

export { routes };

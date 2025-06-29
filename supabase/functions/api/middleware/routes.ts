import { Context, Hono } from 'hono';
import { requiredAuthMiddleware, optionalAuthMiddleware } from './auth.ts';
import { handleGetExercises } from '../handlers/exercises/get.ts';
import { handleCreateExercise } from '../handlers/exercises/post.ts';
import { handleGetExerciseById } from '../handlers/exercises/get-id.ts';
import { handlePutExerciseById } from '../handlers/exercises/put-id.ts';
import { handleDeleteExerciseById } from '../handlers/exercises/delete-id.ts';
import { handleGetProfile } from '../handlers/profiles/get-id.ts';
import { handleUpsertProfile } from '../handlers/profiles/put-id.ts';
import { handleGetPlans } from '../handlers/plans/get.ts';
import { handleCreatePlan } from '../handlers/plans/post.ts';
import { handleGetPlanById } from '../handlers/plans/get-id.ts';
import { handlePutPlanById } from '../handlers/plans/put-id.ts';
import { handleDeletePlanById } from '../handlers/plans/delete-id.ts';
import { handleGetSessions } from '../handlers/sessions/get.ts';
import { handleCreateSession } from '../handlers/sessions/post.ts';
import { handleGetSessionById } from '../handlers/sessions/get-id.ts';
import { handlePutSessionById } from '../handlers/sessions/put-id.ts';
import { handleDeleteSessionById } from '../handlers/sessions/delete-id.ts';
import { handleCompleteSession } from '../handlers/sessions/post-complete.ts';
import { handleGetPlanDays } from '../handlers/plan-days/get.ts';
import { handleCreatePlanDay } from '../handlers/plan-days/post.ts';
import { handleGetPlanDayById } from '../handlers/plan-days/get-id.ts';
import { handlePutPlanDayById } from '../handlers/plan-days/put-id.ts';
import { handleDeletePlanDayById } from '../handlers/plan-days/delete-id.ts';
import { handleGetPlanExercises } from '../handlers/plan-exercises/get.ts';
import { handleCreatePlanExercise } from '../handlers/plan-exercises/post.ts';
import { handleGetPlanExerciseById } from '../handlers/plan-exercises/get-id.ts';
import { handlePutPlanExerciseById } from '../handlers/plan-exercises/put-id.ts';
import { handleDeletePlanExerciseById } from '../handlers/plan-exercises/delete-id.ts';
import { handleGetPlanExerciseSets } from '../handlers/plan-exercise-sets/get.ts';
import { handleCreatePlanExerciseSet } from '../handlers/plan-exercise-sets/post.ts';
import { handleGetPlanExerciseSetById } from '../handlers/plan-exercise-sets/get-id.ts';
import { handlePutPlanExerciseSetById } from '../handlers/plan-exercise-sets/put-id.ts';
import { handleDeletePlanExerciseSetById } from '../handlers/plan-exercise-sets/delete-id.ts';
import { handleGetPlanExerciseProgressions } from '../handlers/plan-exercise-progressions/get.ts';
import { handleGetPlanExerciseProgressionById } from '../handlers/plan-exercise-progressions/get-id.ts';
import { handlePutPlanExerciseProgressionById } from '../handlers/plan-exercise-progressions/put-id.ts';
import { handleGetSessionSets } from '../handlers/session-sets/get.ts';
import { handleCreateSessionSet } from '../handlers/session-sets/post.ts';
import { handleGetSessionSetById } from '../handlers/session-sets/get-id.ts';
import { handleUpdateSessionSetById } from '../handlers/session-sets/put-id.ts';
import { handleDeleteSessionSetById } from '../handlers/session-sets/delete-id.ts';
import { handleCompleteSessionSet } from '../handlers/session-sets/patch-complete.ts';
import { handleFailSessionSet } from '../handlers/session-sets/patch-fail.ts';
import { handleResetSessionSet } from '../handlers/session-sets/patch-reset.ts';
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

// /api/profiles
function createProfileRoutes(): Hono<AppContext> {
  return new Hono<AppContext>()
    .get('/:userId', requiredAuthMiddleware, handleGetProfile)
    .put('/:userId', requiredAuthMiddleware, handleUpsertProfile);
}

// /api/plans
function createPlanRoutes(): Hono<AppContext> {
  return new Hono<AppContext>()
    .get('/', requiredAuthMiddleware, handleGetPlans)
    .post('/', requiredAuthMiddleware, handleCreatePlan)
    .get('/:planId', requiredAuthMiddleware, handleGetPlanById)
    .put('/:planId', requiredAuthMiddleware, handlePutPlanById)
    .delete('/:planId', requiredAuthMiddleware, handleDeletePlanById)
    .route('/:planId/days', createPlanDayRoutes())
    .route('/:planId/progressions', createPlanExerciseProgressionRoutes());
}

// /api/plans/:planId/days
function createPlanDayRoutes(): Hono<AppContext> {
  return new Hono<AppContext>()
    .get('/', requiredAuthMiddleware, handleGetPlanDays)
    .post('/', requiredAuthMiddleware, handleCreatePlanDay)
    .get('/:dayId', requiredAuthMiddleware, handleGetPlanDayById)
    .put('/:dayId', requiredAuthMiddleware, handlePutPlanDayById)
    .delete('/:dayId', requiredAuthMiddleware, handleDeletePlanDayById)
    .route('/:dayId/exercises', createPlanExerciseRoutes());
}

// /api/plans/:planId/days/:dayId/exercises
function createPlanExerciseRoutes(): Hono<AppContext> {
  return new Hono<AppContext>()
    .get('/', requiredAuthMiddleware, handleGetPlanExercises)
    .post('/', requiredAuthMiddleware, handleCreatePlanExercise)
    .get('/:exerciseId', requiredAuthMiddleware, handleGetPlanExerciseById)
    .put('/:exerciseId', requiredAuthMiddleware, handlePutPlanExerciseById)
    .delete('/:exerciseId', requiredAuthMiddleware, handleDeletePlanExerciseById)
    .route('/:exerciseId/sets', createPlanExerciseSetRoutes());
}

// /api/plans/:planId/days/:dayId/exercises/:exerciseId/sets
function createPlanExerciseSetRoutes(): Hono<AppContext> {
  return new Hono<AppContext>()
    .get('/', requiredAuthMiddleware, handleGetPlanExerciseSets)
    .post('/', requiredAuthMiddleware, handleCreatePlanExerciseSet)
    .get('/:setId', requiredAuthMiddleware, handleGetPlanExerciseSetById)
    .put('/:setId', requiredAuthMiddleware, handlePutPlanExerciseSetById)
    .delete('/:setId', requiredAuthMiddleware, handleDeletePlanExerciseSetById);
}

// /api/plans/:planId/progressions
function createPlanExerciseProgressionRoutes(): Hono<AppContext> {
  return new Hono<AppContext>()
    .get('/', requiredAuthMiddleware, handleGetPlanExerciseProgressions)
    .get('/:exerciseId', requiredAuthMiddleware, handleGetPlanExerciseProgressionById)
    .put('/:exerciseId', requiredAuthMiddleware, handlePutPlanExerciseProgressionById);
}

// /api/sessions
function createSessionRoutes(): Hono<AppContext> {
  return new Hono<AppContext>()
    .get('/', requiredAuthMiddleware, handleGetSessions)
    .post('/', requiredAuthMiddleware, handleCreateSession)
    .get('/:sessionId', requiredAuthMiddleware, handleGetSessionById)
    .put('/:sessionId', requiredAuthMiddleware, handlePutSessionById)
    .delete('/:sessionId', requiredAuthMiddleware, handleDeleteSessionById)
    .post('/:sessionId/complete', requiredAuthMiddleware, handleCompleteSession)
    .route('/:sessionId/sets', createSessionSetRoutes());
}

// /api/sessions/:sessionId/sets
function createSessionSetRoutes(): Hono<AppContext> {
  return new Hono<AppContext>()
    .get('/', requiredAuthMiddleware, handleGetSessionSets)
    .post('/', requiredAuthMiddleware, handleCreateSessionSet)
    .get('/:setId', requiredAuthMiddleware, handleGetSessionSetById)
    .put('/:setId', requiredAuthMiddleware, handleUpdateSessionSetById)
    .delete('/:setId', requiredAuthMiddleware, handleDeleteSessionSetById)
    .patch('/:setId/complete', requiredAuthMiddleware, handleCompleteSessionSet)
    .patch('/:setId/fail', requiredAuthMiddleware, handleFailSessionSet)
    .patch('/:setId/reset', requiredAuthMiddleware, handleResetSessionSet);
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
routes.route('/profiles', createProfileRoutes());
routes.route('/plans', createPlanRoutes());
routes.route('/sessions', createSessionRoutes());
routes.get('/health', handleHealthEndpoint);
routes.notFound(handleNotFound);
routes.onError(handleOnError);

export { routes };

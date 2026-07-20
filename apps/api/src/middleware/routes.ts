import { Context, Hono } from 'hono';
import { requiredAuthMiddleware } from './auth';
import { handleGetExercises } from '../handlers/exercises/get';
import { handleCreateExercise } from '../handlers/exercises/post';
import { handleGetExerciseById } from '../handlers/exercises/get-id';
import { handlePutExerciseById } from '../handlers/exercises/put-id';
import { handleDeleteExerciseById } from '../handlers/exercises/delete-id';
import { handleGetProfile } from '../handlers/profiles/get-id';
import { handleUpsertProfile } from '../handlers/profiles/put-id';
import { handleGetExerciseProgress } from '../handlers/progress/get-exercises';
import { handleGetPlans } from '../handlers/plans/get';
import { handleCreatePlan } from '../handlers/plans/post';
import { handleGetPlanById } from '../handlers/plans/get-id';
import { handlePutPlanById } from '../handlers/plans/put-id';
import { handleDeletePlanById } from '../handlers/plans/delete-id';
import { handleGetSessions } from '../handlers/sessions/get';
import { handleCreateSession } from '../handlers/sessions/post';
import { handleGetSessionById } from '../handlers/sessions/get-id';
import { handlePutSessionById } from '../handlers/sessions/put-id';
import { handleDeleteSessionById } from '../handlers/sessions/delete-id';
import { handleCompleteSession } from '../handlers/sessions/post-complete';
import { handleGetPlanDays } from '../handlers/plan-days/get';
import { handleCreatePlanDay } from '../handlers/plan-days/post';
import { handleGetPlanDayById } from '../handlers/plan-days/get-id';
import { handlePutPlanDayById } from '../handlers/plan-days/put-id';
import { handleDeletePlanDayById } from '../handlers/plan-days/delete-id';
import { handleGetPlanExercises } from '../handlers/plan-exercises/get';
import { handleCreatePlanExercise } from '../handlers/plan-exercises/post';
import { handleGetPlanExerciseById } from '../handlers/plan-exercises/get-id';
import { handlePutPlanExerciseById } from '../handlers/plan-exercises/put-id';
import { handleDeletePlanExerciseById } from '../handlers/plan-exercises/delete-id';
import { handleGetPlanExerciseSets } from '../handlers/plan-exercise-sets/get';
import { handleCreatePlanExerciseSet } from '../handlers/plan-exercise-sets/post';
import { handleGetPlanExerciseSetById } from '../handlers/plan-exercise-sets/get-id';
import { handlePutPlanExerciseSetById } from '../handlers/plan-exercise-sets/put-id';
import { handleDeletePlanExerciseSetById } from '../handlers/plan-exercise-sets/delete-id';
import { handleGetPlanExerciseProgressions } from '../handlers/plan-exercise-progressions/get';
import { handleGetPlanExerciseProgressionById } from '../handlers/plan-exercise-progressions/get-id';
import { handlePutPlanExerciseProgressionById } from '../handlers/plan-exercise-progressions/put-id';
import { handleGetSessionSets } from '../handlers/session-sets/get';
import { handleCreateSessionSet } from '../handlers/session-sets/post';
import { handleGetSessionSetById } from '../handlers/session-sets/get-id';
import { handleUpdateSessionSetById } from '../handlers/session-sets/put-id';
import { handleDeleteSessionSetById } from '../handlers/session-sets/delete-id';
import { handleCompleteSessionSet } from '../handlers/session-sets/patch-complete';
import { handleFailSessionSet } from '../handlers/session-sets/patch-fail';
import { handleResetSessionSet } from '../handlers/session-sets/patch-reset';
import type { AppContext } from '../context';
import { createErrorDataWithLogging, createServerErrorData } from "../utils/api-helpers";

// /api/exercises
function createExerciseRoutes(): Hono<AppContext> {
  return new Hono<AppContext>()
    // The exercise catalog is shared reference data that anon may read (see the exercises_anon_select
    // policy), and neither read handler looks at the caller. Attaching auth here implied a
    // user-scoping that does not exist, and cost a token verification per request for nothing.
    .get('/', handleGetExercises)
    .post('/', requiredAuthMiddleware, handleCreateExercise)
    .get('/:exerciseId', handleGetExerciseById)
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

// /api/progress
function createProgressRoutes(): Hono<AppContext> {
  return new Hono<AppContext>()
    .get('/exercises', requiredAuthMiddleware, handleGetExerciseProgress);
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
  const errorData = createServerErrorData('Internal Server Error', err);
  return c.json(errorData, 500);
}

const routes = new Hono<AppContext>();

routes.route('/exercises', createExerciseRoutes());
routes.route('/profiles', createProfileRoutes());
routes.route('/plans', createPlanRoutes());
routes.route('/progress', createProgressRoutes());
routes.route('/sessions', createSessionRoutes());
routes.get('/health', handleHealthEndpoint);
routes.notFound(handleNotFound);
routes.onError(handleOnError);

export { routes };

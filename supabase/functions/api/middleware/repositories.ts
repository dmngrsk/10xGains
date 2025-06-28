import type { Context, Next } from 'hono';
import type { AppContext } from '../context.ts';
import { PlanRepository } from '../repositories/plan.repository.ts';
import { ExerciseRepository } from '../repositories/exercise.repository.ts';
import { ProfileRepository } from '../repositories/profile.repository.ts';
import { SessionRepository } from '../repositories/session.repository.ts';

/**
 * Middleware to initialize and inject repositories into the Hono context.
 *
 * This function creates instances of all the data repositories and makes them
 * available on the context for subsequent middleware and route handlers.
 *
 * @param {Context<AppContext>} c - The Hono context.
 * @param {Next} next - The next middleware function in the chain.
 */
export async function repositoriesMiddleware(c: Context<AppContext>, next: Next) {
  const supabase = c.get('supabase');
  const getUserId = () => c.get('user')!.id;

  c.set('planRepository', new PlanRepository(supabase, getUserId));
  c.set('exerciseRepository', new ExerciseRepository(supabase));
  c.set('profileRepository', new ProfileRepository(supabase, getUserId));
  c.set('sessionRepository', new SessionRepository(supabase, getUserId));

  await next();
}

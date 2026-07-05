import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '@txg/shared';
import type { PlanRepository } from './repositories/plan.repository';
import type { ExerciseRepository } from './repositories/exercise.repository';
import type { ProfileRepository } from './repositories/profile.repository';
import type { SessionRepository } from './repositories/session.repository';
import type { PushSubscriptionRepository } from './repositories/push-subscription.repository';

/**
 * Placeholder for TelemetryClient - can be expanded later
 */
export interface TelemetryClient {
  log: (message: string) => void;
}

/**
 * The application context type for Hono.
 *
 * This type defines the structure of the context object that is passed to
 * all middleware and route handlers. It includes:
 * - Supabase client, user information
 * - Telemetry client, request metadata
 * - Repositories for data access
 */
export type AppContext = {
  Variables: {
    supabase: SupabaseClient<Database>;
    user: User;
    telemetry: TelemetryClient;
    startTime: number;
    planRepository: PlanRepository;
    exerciseRepository: ExerciseRepository;
    profileRepository: ProfileRepository;
    sessionRepository: SessionRepository;
    pushSubscriptionRepository: PushSubscriptionRepository;
  };
};

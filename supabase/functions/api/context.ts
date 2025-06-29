import type { SupabaseClient, User } from 'supabase';
import type { Database } from './models/database.types.ts';
import type { PlanRepository } from './repositories/plan.repository.ts';
import type { ExerciseRepository } from './repositories/exercise.repository.ts';
import type { ProfileRepository } from './repositories/profile.repository.ts';
import type { SessionRepository } from './repositories/session.repository.ts';

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
  };
};

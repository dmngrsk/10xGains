import type { SupabaseClient, User } from 'supabase';
import type { Database } from './models/database-types.ts';

// Placeholder for TelemetryClient - can be expanded later
export interface TelemetryClient {
  // Add telemetry methods as needed
  log: (message: string) => void;
}

export type AppContext = {
  Variables: {
    supabase: SupabaseClient<Database>;
    user: User;
    telemetry: TelemetryClient;
    startTime: number;
  };
};

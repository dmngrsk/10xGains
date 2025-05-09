import type { SupabaseClient } from 'supabase';
import type { Database } from 'shared/database-types';
import { routeRequestToMethods } from 'shared/api-routing.ts';
import { handleGetTrainingPlans } from './methods/get.ts';
import { handleCreateTrainingPlan } from './methods/post.ts';

const ABSOLUTE_PATH_PATTERN = '/training-plans';

export async function handleTrainingPlansRoute(
  req: Request,
  supabaseClient: SupabaseClient<Database>
) {
  return routeRequestToMethods(
    req,
    ABSOLUTE_PATH_PATTERN,
    {
      GET: handleGetTrainingPlans,
      POST: handleCreateTrainingPlan,
    },
    supabaseClient
  );
} 
import type { SupabaseClient } from 'supabase';
import type { Database } from 'shared/database-types';
import { routeRequestToMethods } from 'shared/api-routing.ts';
import { handleGetTrainingPlanById } from './methods/get.ts';
import { handlePutTrainingPlanById } from './methods/put.ts';
import { handleDeleteTrainingPlanById } from './methods/delete.ts';

const ABSOLUTE_PATH_PATTERN = '/training-plans/:planId';

export async function handleTrainingPlanByIdRoute(
  req: Request,
  supabaseClient: SupabaseClient<Database>
) {
  return routeRequestToMethods(
    req,
    ABSOLUTE_PATH_PATTERN,
    {
      GET: handleGetTrainingPlanById,
      PUT: handlePutTrainingPlanById,
      DELETE: handleDeleteTrainingPlanById,
    },
    supabaseClient
  );
} 
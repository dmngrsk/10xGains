/**
 * !!! IMPORTANT: AUTO-GENERATED FILE !!!
 *
 * This file is automatically generated from undefined
 * Do not edit this file directly. Make changes to the source file instead.
 *
 * NOTE: This type copying approach is not meant to be a final solution.
 * A more robust approach would involve generating types from a common schema
 * or using a dedicated code generation tool.
 *
 * Recommended improvement: Create a shared npm package containing all type
 * definitions that can be imported by both Angular and Deno environments.
 * This would ensure type consistency and eliminate manual syncing.
 *
 * Last updated: 2025-07-12T14:23:35.676Z
 */

/*
  DTO and Command Model Definitions for API
  Based on database models from supabase/functions/shared/models/database.types.ts and API plan (api-plan.md)

  Each interface directly or indirectly corresponds to a database table:
  - Profiles                      -> Tables<"public", "profiles">
  - Exercises                     -> Tables<"public", "exercises">
  - Plans                         -> Tables<"public", "plans">
  - Plan Days                     -> Tables<"public", "plan_days">
  - Plan Exercises                -> Tables<"public", "plan_exercises">
  - Plan Exercise Sets            -> Tables<"public", "plan_exercise_sets">
  - Plan Exercise Progressions    -> Tables<"public", "plan_exercise_progressions">
  - Sessions                      -> Tables<"public", "sessions">
  - Session Sets                  -> Tables<"public", "session_sets">

  The command models represent the payloads for create/update operations as per API plan.

  Note: Additional properties such as timestamps (created_at, updated_at) are included in DTOs when available.
*/

import type { Database } from '../db/database.types';

// 0. Generic API Response and Query Types
export interface ApiResult<T> {
  data: T;
  totalCount?: number;
}

export interface PagingQueryOptions {
  limit: number;
  offset: number;
}

export interface SortingQueryOptions {
  sort: string;
}

// 1. Profile DTO and Command
export type ProfileDto = Database["public"]["Tables"]["profiles"]["Row"];

export type UpsertProfileCommand = Partial<Pick<ProfileDto, "first_name" | "active_plan_id">>;

// 2. Exercise DTO and Commands (Global Resource)
export type ExerciseDto = Database["public"]["Tables"]["exercises"]["Row"];

export type CreateExerciseCommand = Pick<Database["public"]["Tables"]["exercises"]["Insert"], "name" | "description">;

export type UpdateExerciseCommand = Pick<Database["public"]["Tables"]["exercises"]["Update"], "name" | "description">;

// 3. Plan DTO and Commands
export type PlanDto = Database["public"]["Tables"]["plans"]["Row"] & {
  days?: PlanDayDto[]; // nested plan days
  progressions?: PlanExerciseProgressionDto[]; // nested exercise progression rules
};

export type CreatePlanCommand = Pick<Database["public"]["Tables"]["plans"]["Insert"], "name" | "description">;

export type UpdatePlanCommand = Pick<Database["public"]["Tables"]["plans"]["Update"], "name" | "description">;

// Command for POST /plans/{planId}/suggest
export interface AiSuggestPlanQueryCommand {
  query: string;
}

// DTOs for AI-suggested plan (POST /plans/{planId}/suggest response)
// These types extend base DTOs with an optional 'is_ai_modified' flag
export interface AiSuggestedPlanResponseDto {
  ai_message: string;
  ai_plan_modified: boolean;
  suggested_plan?: AiSuggestedPlanDto; // Can be null if AI only answers a question
}

export type AiSuggestedPlanDto = Omit<PlanDto, 'days'> & {
  days?: AiSuggestedPlanDayDto[];
  is_ai_modified?: boolean;
};

export type AiSuggestedPlanDayDto = Omit<PlanDayDto, 'exercises'> & {
  exercises?: AiSuggestedPlanExerciseDto[];
  is_ai_modified?: boolean;
};

export type AiSuggestedPlanExerciseDto = Omit<PlanExerciseDto, 'sets'> & {
  sets?: AiSuggestedPlanExerciseSetDto[];
  is_ai_modified?: boolean;
};

export type AiSuggestedPlanExerciseSetDto = PlanExerciseSetDto & {
  is_ai_modified?: boolean;
};

// Command and constituent data types for POST /plans/{planId}/composite
// For composite updates, 'id' is optional for new items.
// Days, exercises, sets not included in payload but existing in DB will be DELETED.
// Order is determined by array position.
export type CompositePlanUpdateCommand =
  Pick<Database["public"]["Tables"]["plans"]["Update"], "name" | "description">
  & { id?: string; days: CompositePlanDayData[]; }; // id of the plan is via URL parameter {planId}

export type CompositePlanDayData =
  Pick<Database["public"]["Tables"]["plan_days"]["Insert"], "name" | "description">
  & { id?: string; exercises?: CompositePlanExerciseData[]; }; // id is optional for new, present for existing

export type CompositePlanExerciseData =
  Pick<Database["public"]["Tables"]["plan_exercises"]["Insert"], "exercise_id">
  & { id?: string; sets?: CompositePlanExerciseSetData[]; }; // id is optional for new, present for existing

export type CompositePlanExerciseSetData =
  Pick<Database["public"]["Tables"]["plan_exercise_sets"]["Insert"], "expected_reps" | "expected_weight">
  & { id?: string; }; // id is optional for new, present for existing

// 4. Plan Day DTO and Commands
export type PlanDayDto = Database["public"]["Tables"]["plan_days"]["Row"] & {
  exercises?: PlanExerciseDto[]; // nested exercises
};

// For creation, omit fields that come from URL (plan_id) or are auto-generated (id). order_index is optional.
export type CreatePlanDayCommand = Pick<Database["public"]["Tables"]["plan_days"]["Insert"], "name" | "description"> & { order_index?: number; };

export type UpdatePlanDayCommand = Pick<Database["public"]["Tables"]["plan_days"]["Update"], "name" | "description" | "order_index">;

// Reorder command is covered by UpdatePlanDayCommand by sending only order_index.

// 5. Plan Exercise DTO and Commands
export type PlanExerciseDto = Database["public"]["Tables"]["plan_exercises"]["Row"] & {
  sets?: PlanExerciseSetDto[]; // nested sets
};

// For creation, omit fields from URL (plan_day_id) or auto-generated (id). order_index is optional.
export type CreatePlanExerciseCommand = Pick<Database["public"]["Tables"]["plan_exercises"]["Insert"], "exercise_id"> & { order_index?: number; };

// For updating, only order_index is typically changed directly for this linking entity.
export type UpdatePlanExerciseCommand = Required<Pick<Database["public"]["Tables"]["plan_exercises"]["Update"], "order_index">>;

// Reorder command is covered by UpdatePlanExerciseCommand.

// 6. Plan Exercise Set DTO and Commands
export type PlanExerciseSetDto = Database["public"]["Tables"]["plan_exercise_sets"]["Row"];

// For creation, omit fields from URL (plan_exercise_id) or auto-generated (id). set_index is optional.
export type CreatePlanExerciseSetCommand = Pick<Database["public"]["Tables"]["plan_exercise_sets"]["Insert"], "expected_reps" | "expected_weight"> & { set_index?: number; };

export type UpdatePlanExerciseSetCommand = Pick<Database["public"]["Tables"]["plan_exercise_sets"]["Update"], "set_index" | "expected_reps" | "expected_weight">;

// 7. Plan Exercise Progression DTO and Command
export type PlanExerciseProgressionDto = Database["public"]["Tables"]["plan_exercise_progressions"]["Row"];

// Command to update (or create if not exists) progression rules. Fields like consecutive_failures might be updated by system or user.
export type UpsertPlanExerciseProgressionCommand = Pick<Database["public"]["Tables"]["plan_exercise_progressions"]["Update"], "weight_increment" | "failure_count_for_deload" | "deload_percentage" | "deload_strategy" | "consecutive_failures" | "reference_set_index">;

// 8. Session DTO and Commands
export type SessionDto = Database["public"]["Tables"]["sessions"]["Row"] & {
  sets?: SessionSetDto[]; // nested sets
};

export type CreateSessionCommand = Pick<Database["public"]["Tables"]["sessions"]["Insert"], "plan_id" | "plan_day_id">;

export type UpdateSessionCommand = Required<Pick<Database["public"]["Tables"]["sessions"]["Update"], "status">>;

// For PATCH /sessions/{sessionId}/complete
// Request body is empty.
export type CompleteSessionCommand = Record<string, never>; // Represents an empty request body

// 9. Session Set DTO and Commands
export type SessionSetDto = Database["public"]["Tables"]["session_sets"]["Row"];

export type CreateSessionSetCommand = Pick<Database["public"]["Tables"]["session_sets"]["Insert"], "session_id" | "plan_exercise_id" | "set_index" | "actual_weight" | "actual_reps" | "expected_reps" | "status" | "completed_at">;

export type UpdateSessionSetCommand = Partial<Pick<Database["public"]["Tables"]["session_sets"]["Update"], "set_index" | "actual_reps" | "actual_weight" | "expected_reps" | "status" | "completed_at">>;

// For PATCH /sessions/{sessionId}/sets/{setId}/complete
// Request body is empty.
export type CompleteSessionSetCommand = Record<string, never>; // Represents an empty request body

// For PATCH /sessions/{sessionId}/sets/{setId}/fail
// Request uses query parameter `reps`, body is empty.
export type FailSessionSetCommand = Record<string, never>; // Represents an empty request body

// For PATCH /sessions/{sessionId}/sets/{setId}/reset
// Request body is empty.
export type ResetSessionSetCommand = Record<string, never>; // Represents an empty request body

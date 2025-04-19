/*
  DTO and Command Model Definitions for API
  Based on database models from src/app/shared/db/database.types.ts and API plan (api-plan.md)

  Each interface directly or indirectly corresponds to a database table:
  - User Profiles           -> Tables<"public", "user_profiles">
  - Training Plans          -> Tables<"public", "training_plans">
  - Training Plan Days      -> Tables<"public", "training_plan_days">
  - Exercises               -> Tables<"public", "exercises">
  - Training Plan Exercises -> Tables<"public", "training_plan_exercises">
  - Training Plan Exercise Sets -> Tables<"public", "training_plan_exercise_sets">
  - Training Plan Exercise Progressions -> Tables<"public", "training_plan_exercise_progressions">
  - Training Sessions       -> Tables<"public", "training_sessions">
  - Session Sets            -> Tables<"public", "session_sets">

  The command models represent the payloads for create/update operations as per API plan.

  Note: Additional properties such as timestamps (created_at, updated_at) are included in DTOs when available.
*/

import type { Database } from '../db/database.types';

// 1. User Profile DTO and Command
export type UserProfileDto = Database["public"]["Tables"]["user_profiles"]["Row"];

export type UpdateUserProfileCommand = Pick<UserProfileDto, "first_name" | "active_training_plan_id">;

// 2. Training Plan DTO and Commands
export type TrainingPlanDto = Database["public"]["Tables"]["training_plans"]["Row"] & {
  training_days?: TrainingPlanDayDto[]; // nested training plan days
};

export type CreateTrainingPlanCommand = Pick<Database["public"]["Tables"]["training_plans"]["Insert"], "name" | "description">;

export type UpdateTrainingPlanCommand = Pick<Database["public"]["Tables"]["training_plans"]["Update"], "name" | "description">;

// 3. Training Plan Day DTO and Commands
export type TrainingPlanDayDto = Database["public"]["Tables"]["training_plan_days"]["Row"] & {
  exercises?: TrainingPlanExerciseDto[]; // nested exercises
};

// For creation, omit fields that come from URL (id, training_plan_id)
export type CreateTrainingPlanDayCommand = Omit<Database["public"]["Tables"]["training_plan_days"]["Insert"], "id" | "training_plan_id">;

export type UpdateTrainingPlanDayCommand = Pick<Database["public"]["Tables"]["training_plan_days"]["Update"], "name" | "description" | "order_index">;

export type ReorderTrainingPlanDayCommand = Pick<Database["public"]["Tables"]["training_plan_days"]["Update"], "order_index">;

// 4. Exercise DTO and Commands
export type ExerciseDto = Database["public"]["Tables"]["exercises"]["Row"];

export type CreateExerciseCommand = Pick<Database["public"]["Tables"]["exercises"]["Insert"], "name" | "description">;

export type UpdateExerciseCommand = Pick<Database["public"]["Tables"]["exercises"]["Update"], "name" | "description">;

// 5. Training Plan Exercise DTO and Commands
export type TrainingPlanExerciseDto = Database["public"]["Tables"]["training_plan_exercises"]["Row"];

// For creation, omit id and training_plan_day_id (provided via route)
export type CreateTrainingPlanExerciseCommand = Omit<Database["public"]["Tables"]["training_plan_exercises"]["Insert"], "id" | "training_plan_day_id">;

export type UpdateTrainingPlanExerciseCommand = Pick<Database["public"]["Tables"]["training_plan_exercises"]["Update"], "order_index">;

export type ReorderTrainingPlanExerciseCommand = UpdateTrainingPlanExerciseCommand;

// 6. Training Plan Exercise Set DTO and Commands
export type TrainingPlanExerciseSetDto = Database["public"]["Tables"]["training_plan_exercise_sets"]["Row"];

// For creation, omit id and training_plan_exercise_id (provided via route)
export type CreateTrainingPlanExerciseSetCommand = Omit<Database["public"]["Tables"]["training_plan_exercise_sets"]["Insert"], "id" | "training_plan_exercise_id">;

export type UpdateTrainingPlanExerciseSetCommand = Pick<Database["public"]["Tables"]["training_plan_exercise_sets"]["Update"], "set_index" | "expected_reps" | "expected_weight">;

// 7. Training Plan Exercise Progression DTO and Command
export type TrainingPlanExerciseProgressionDto = Database["public"]["Tables"]["training_plan_exercise_progressions"]["Row"];

export type UpdateTrainingPlanExerciseProgressionCommand = Pick<Database["public"]["Tables"]["training_plan_exercise_progressions"]["Update"], "weight_increment" | "failure_count_for_deload" | "current_weight">;

// 8. Training Session DTO and Commands
export type TrainingSessionDto = Database["public"]["Tables"]["training_sessions"]["Row"];

export type CreateTrainingSessionCommand = Pick<Database["public"]["Tables"]["training_sessions"]["Insert"], "training_plan_id" | "training_plan_day_id">;

export type UpdateTrainingSessionCommand = Pick<Database["public"]["Tables"]["training_sessions"]["Update"], "status">;

export interface CompleteTrainingSessionCommand {
  status: 'COMPLETED';
}

// 9. Session Set DTO and Commands
export type SessionSetDto = Database["public"]["Tables"]["session_sets"]["Row"];

// For creation, omit fields set by the system
export type CreateSessionSetCommand = Omit<Database["public"]["Tables"]["session_sets"]["Insert"], "id" | "actual_reps" | "actual_weight" | "status" | "completed_at" | "training_session_id">;

export type UpdateSessionSetCommand = Pick<Database["public"]["Tables"]["session_sets"]["Update"], "actual_reps" | "actual_weight" | "status">;

export interface CompleteSessionSetCommand {
  status: 'COMPLETED';
}

export interface FailSessionSetCommand {
  status: 'FAILED';
}

// 10. AI-Driven Training Suggestion DTO
export interface ResourceLinkDto {
  title: string;
  url: string;
}

export interface AITrainingSuggestionDto {
  response: string;
  training_plan: TrainingPlanDto; // Detailed training plan with nested days and exercises
  resource_links: ResourceLinkDto[];
}

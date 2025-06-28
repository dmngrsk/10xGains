import type { SupabaseClient } from 'supabase';
import type { Database } from '../models/database-types.ts';
import type {
  TrainingPlanDto,
  CreateTrainingPlanCommand,
  UpdateTrainingPlanCommand,
  TrainingPlanDayDto,
  CreateTrainingPlanDayCommand,
  UpdateTrainingPlanDayCommand,
  TrainingPlanExerciseDto,
  CreateTrainingPlanExerciseCommand,
  UpdateTrainingPlanExerciseCommand,
  TrainingPlanExerciseSetDto,
  CreateTrainingPlanExerciseSetCommand,
  UpdateTrainingPlanExerciseSetCommand,
  TrainingPlanExerciseProgressionDto,
  UpsertTrainingPlanExerciseProgressionCommand
} from '../models/api-types.ts';
import { ApiErrorResponse, createErrorData } from "../utils/api-helpers.ts";

export interface TrainingPlanQueryOptions {
  limit: number;
  offset: number;
  sort: string;
}

export interface TrainingPlanListResult {
  data: TrainingPlanDto[];
  totalCount: number;
}

export interface TrainingPlanDayQueryOptions {
  limit: number;
  offset: number;
}

export class PlanRepository {
  constructor(
    private supabase: SupabaseClient<Database>,
    private getUserId: () => string
  ) {}

  /**
   * Finds all training plans for the current user, with optional sorting and pagination.
   *
   * @param {TrainingPlanQueryOptions} options - Options for sorting and pagination.
   * @returns {Promise<TrainingPlanListResult>} A promise that resolves to the list of training plans and the total count.
   */
  async findAll(options: TrainingPlanQueryOptions): Promise<TrainingPlanListResult> {
    const [sortColumn, sortDirection] = options.sort.split('.');
    if (sortDirection !== 'asc' && sortDirection !== 'desc') {
      throw new Error('Invalid sort direction');
    }

    const { data, count, error } = await this.supabase
      .from('training_plans')
      .select(`
        *,
        days:training_plan_days (
          *,
          exercises:training_plan_exercises (
            *,
            sets:training_plan_exercise_sets (
              *
            )
          )
        ),
        progressions:training_plan_exercise_progressions (
          *
        )
      `, { count: 'exact' })
      .eq('user_id', this.getUserId())
      .range(options.offset, options.offset + options.limit - 1)
      .order(sortColumn, { ascending: sortDirection === 'asc' });

    if (error) {
      throw error;
    }

    // Sort nested data by order indices
    const sortedData = data?.map(plan => ({
      ...plan,
      days: plan.days?.sort((a, b) => a.order_index - b.order_index).map(day => ({
        ...day,
        exercises: day.exercises?.sort((a, b) => a.order_index - b.order_index).map(exercise => ({
          ...exercise,
          sets: exercise.sets?.sort((a, b) => a.set_index - b.set_index)
        }))
      }))
    })) || [];

    return {
      data: sortedData as TrainingPlanDto[],
      totalCount: count ?? 0
    };
  }

  /**
   * Finds a single training plan by its ID.
   *
   * @param {string} planId - The ID of the plan to find.
   * @returns {Promise<TrainingPlanDto | null>} A promise that resolves to the training plan or null if not found.
   */
  async findById(planId: string): Promise<TrainingPlanDto | null> {
    const { data, error } = await this.supabase
      .from('training_plans')
      .select(`
        *,
        days:training_plan_days (
          *,
          exercises:training_plan_exercises (
            *,
            sets:training_plan_exercise_sets (
              *
            )
          )
        ),
        progressions:training_plan_exercise_progressions (
          *
        )
      `)
      .eq('id', planId)
      .eq('user_id', this.getUserId())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw error;
    }

    return data as TrainingPlanDto;
  }

  /**
   * Creates a new training plan.
   *
   * @param {string} userId - The ID of the user creating the plan.
   * @param {CreateTrainingPlanCommand} command - The command containing the plan's details.
   * @returns {Promise<TrainingPlanDto>} A promise that resolves to the newly created training plan.
   */
  async create(userId: string, command: CreateTrainingPlanCommand): Promise<TrainingPlanDto> {
    const newPlanData = {
      name: command.name,
      description: command.description ?? null,
      user_id: userId,
    };

    const { data, error } = await this.supabase
      .from('training_plans')
      .insert(newPlanData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as TrainingPlanDto;
  }

  /**
   * Updates an existing training plan.
   *
   * @param {string} planId - The ID of the plan to update.
   * @param {UpdateTrainingPlanCommand} command - The command with the updated data.
   * @returns {Promise<TrainingPlanDto | null>} A promise that resolves to the updated plan or null if not found.
   */
  async update(planId: string, command: UpdateTrainingPlanCommand): Promise<TrainingPlanDto | null> {
    await this.verifyPlanOwnership(planId);

    const { data, error } = await this.supabase
      .from('training_plans')
      .update(command)
      .eq('id', planId)
      .eq('user_id', this.getUserId())
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw error;
    }

    return data as TrainingPlanDto;
  }

  /**
   * Deletes a training plan.
   *
   * @param {string} planId - The ID of the plan to delete.
   * @returns {Promise<boolean>} A promise that resolves to true if the deletion was successful.
   */
  async delete(planId: string): Promise<boolean> {
    await this.verifyPlanOwnership(planId);

    const { error } = await this.supabase
      .from('training_plans')
      .delete()
      .eq('id', planId)
      .eq('user_id', this.getUserId());

    if (error) {
      throw error;
    }

    return true;
  }

  /**
   * Finds all training days for a given plan.
   *
   * @param {string} planId - The ID of the training plan.
   * @param {TrainingPlanDayQueryOptions} options - Options for pagination.
   * @returns {Promise<TrainingPlanDayDto[]>} A promise that resolves to a list of training days.
   */
  async findDaysByPlanId(planId: string, options: TrainingPlanDayQueryOptions): Promise<TrainingPlanDayDto[]> {
    await this.verifyPlanOwnership(planId);

    const { data, error } = await this.supabase
      .from('training_plan_days')
      .select(`
        *,
        exercises:training_plan_exercises(
          *,
          sets:training_plan_exercise_sets(
            *
          )
        )
      `)
      .eq('training_plan_id', planId)
      .order('order_index', { ascending: true })
      .range(options.offset, options.offset + options.limit - 1);

    if (error) {
      throw error;
    }

    // Sort nested data
    const sortedData = data?.map(day => ({
      ...day,
      exercises: day.exercises?.sort((a, b) => a.order_index - b.order_index).map(exercise => ({
        ...exercise,
        sets: exercise.sets?.sort((a, b) => a.set_index - b.set_index)
      }))
    })) || [];

    return sortedData as TrainingPlanDayDto[];
  }

  /**
   * Finds a single training day by its ID within a plan.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the day to find.
   * @returns {Promise<TrainingPlanDayDto | null>} A promise that resolves to the training day or null if not found.
   */
  async findDayById(planId: string, dayId: string): Promise<TrainingPlanDayDto | null> {
    await this.verifyPlanOwnership(planId);

    const { data, error } = await this.supabase
      .from('training_plan_days')
      .select(`
        *,
        exercises:training_plan_exercises(
          *,
          sets:training_plan_exercise_sets(
            *
          )
        )
      `)
      .eq('id', dayId)
      .eq('training_plan_id', planId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as TrainingPlanDayDto;
  }

  /**
   * Creates a new training day within a plan.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {CreateTrainingPlanDayCommand} command - The command with the new day's data.
   * @returns {Promise<TrainingPlanDayDto>} A promise that resolves to the newly created training day.
   */
  async createDay(planId: string, command: CreateTrainingPlanDayCommand): Promise<TrainingPlanDayDto> {
    await this.verifyPlanOwnership(planId);

    const rpcCommand = {
      p_user_id: this.getUserId(),
      p_plan_id: planId,
      p_name: command.name,
      p_description: command.description,
      p_target_order_index: command.order_index,
    };

    // deno-lint-ignore no-explicit-any
    const { data, error } = await (this.supabase as any).rpc('create_training_plan_day', rpcCommand).single();

    if (error) {
      throw error;
    }

    return data as TrainingPlanDayDto;
  }

  /**
   * Updates a training day.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the day to update.
   * @param {UpdateTrainingPlanDayCommand} command - The command with the updated data.
   * @returns {Promise<TrainingPlanDayDto | null>} A promise that resolves to the updated day or null if not found.
   */
  async updateDay(planId: string, dayId: string, command: UpdateTrainingPlanDayCommand): Promise<TrainingPlanDayDto | null> {
    await this.verifyPlanOwnership(planId, dayId);

    const rpcCommand = {
      p_user_id: this.getUserId(),
      p_day_id: dayId,
      p_name: command.name,
      p_description: command.description,
      p_target_order_index: command.order_index,
    };

    // deno-lint-ignore no-explicit-any
    const { data, error } = await (this.supabase as any).rpc('update_training_plan_day', rpcCommand).single();

    if (error) {
      if (error.message.includes('not found')) {
        return null;
      }
      throw error;
    }

    return data as TrainingPlanDayDto;
  }

  /**
   * Deletes a training day.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the day to delete.
   * @returns {Promise<boolean>} A promise that resolves to true if deletion was successful.
   */
  async deleteDay(planId: string, dayId: string): Promise<boolean> {
    await this.verifyPlanOwnership(planId, dayId);

    const rpcCommand = {
      p_user_id: this.getUserId(),
      p_day_id: dayId,
    };

    // deno-lint-ignore no-explicit-any
    const { error } = await (this.supabase as any).rpc('delete_training_plan_day', rpcCommand);

    if (error) {
      throw error;
    }

    return true;
  }

  /**
   * Finds all exercises for a given training day.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the parent day.
   * @returns {Promise<TrainingPlanExerciseDto[]>} A promise that resolves to a list of exercises.
   */
  async findExercisesByDayId(planId: string, dayId: string): Promise<TrainingPlanExerciseDto[]> {
    await this.verifyPlanOwnership(planId, dayId);

    const { data, error } = await this.supabase
      .from('training_plan_exercises')
      .select('*, sets:training_plan_exercise_sets(*)')
      .eq('training_plan_day_id', dayId)
      .order('order_index', { ascending: true });

    if (error) {
      throw error;
    }

    // Sort nested sets
    const sortedData = data?.map(exercise => ({
      ...exercise,
      sets: exercise.sets?.sort((a, b) => a.set_index - b.set_index)
    })) || [];

    return sortedData as TrainingPlanExerciseDto[];
  }

  /**
   * Finds a single exercise by its ID.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the parent day.
   * @param {string} exerciseId - The ID of the exercise to find.
   * @returns {Promise<TrainingPlanExerciseDto | null>} A promise that resolves to the exercise or null if not found.
   */
  async findExerciseById(planId: string, dayId: string, exerciseId: string): Promise<TrainingPlanExerciseDto | null> {
    await this.verifyPlanOwnership(planId, dayId);

    const { data, error } = await this.supabase
      .from('training_plan_exercises')
      .select('*, sets:training_plan_exercise_sets(*)')
      .eq('id', exerciseId)
      .eq('training_plan_day_id', dayId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as TrainingPlanExerciseDto;
  }

  /**
   * Creates a new exercise within a training day.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the parent day.
   * @param {CreateTrainingPlanExerciseCommand} command - The command with the new exercise's data.
   * @returns {Promise<TrainingPlanExerciseDto>} A promise that resolves to the newly created exercise.
   */
  async createExercise(planId: string, dayId: string, command: CreateTrainingPlanExerciseCommand): Promise<TrainingPlanExerciseDto> {
    await this.verifyPlanOwnership(planId, dayId);

    const rpcCommand = {
      p_user_id: this.getUserId(),
      p_day_id: dayId,
      p_exercise_id: command.exercise_id,
      p_target_order_index: command.order_index,
    };

    // deno-lint-ignore no-explicit-any
    const { data, error } = await (this.supabase as any).rpc('create_training_plan_exercise', rpcCommand).single();

    if (error) {
      throw error;
    }

    return data as TrainingPlanExerciseDto;
  }

  /**
   * Updates an exercise.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the parent day.
   * @param {string} exerciseId - The ID of the exercise to update.
   * @param {UpdateTrainingPlanExerciseCommand} command - The command with the updated data.
   * @returns {Promise<TrainingPlanExerciseDto | null>} A promise that resolves to the updated exercise or null if not found.
   */
  async updateExercise(planId: string, dayId: string, exerciseId: string, command: UpdateTrainingPlanExerciseCommand): Promise<TrainingPlanExerciseDto | null> {
    await this.verifyPlanOwnership(planId, dayId, exerciseId);

    const rpcCommand = {
      p_user_id: this.getUserId(),
      p_training_plan_exercise_id: exerciseId,
      p_target_order_index: command.order_index,
    };

    // deno-lint-ignore no-explicit-any
    const { data, error } = await (this.supabase as any).rpc('update_training_plan_exercise_order', rpcCommand).single();

    if (error) {
      if (error.message.includes('not found')) {
        return null;
      }
      throw error;
    }

    return data as TrainingPlanExerciseDto;
  }

  /**
   * Deletes an exercise.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the parent day.
   * @param {string} exerciseId - The ID of the exercise to delete.
   * @returns {Promise<boolean>} A promise that resolves to true if deletion was successful.
   */
  async deleteExercise(planId: string, dayId: string, exerciseId: string): Promise<boolean> {
    await this.verifyPlanOwnership(planId, dayId, exerciseId);

    const rpcCommand = {
      p_user_id: this.getUserId(),
      p_plan_exercise_id: exerciseId,
    };

    // deno-lint-ignore no-explicit-any
    const { error } = await (this.supabase as any).rpc('delete_training_plan_exercise', rpcCommand);

    if (error) {
      throw error;
    }

    return true;
  }

  /**
   * Finds all sets for a given exercise.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the parent day.
   * @param {string} exerciseId - The ID of the parent exercise.
   * @returns {Promise<TrainingPlanExerciseSetDto[]>} A promise that resolves to a list of sets.
   */
  async findSetsByExerciseId(planId: string, dayId: string, exerciseId: string): Promise<TrainingPlanExerciseSetDto[]> {
    await this.verifyPlanOwnership(planId, dayId, exerciseId);

    const { data, error } = await this.supabase
      .from('training_plan_exercise_sets')
      .select('*')
      .eq('training_plan_exercise_id', exerciseId)
      .order('set_index', { ascending: true });

    if (error) {
      throw error;
    }

    return data as TrainingPlanExerciseSetDto[];
  }

  /**
   * Finds a single set by its ID.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the parent day.
   * @param {string} exerciseId - The ID of the parent exercise.
   * @param {string} setId - The ID of the set to find.
   * @returns {Promise<TrainingPlanExerciseSetDto | null>} A promise that resolves to the set or null if not found.
   */
  async findSetById(planId: string, dayId: string, exerciseId: string, setId: string): Promise<TrainingPlanExerciseSetDto | null> {
    await this.verifyPlanOwnership(planId, dayId, exerciseId);

    const { data, error } = await this.supabase
      .from('training_plan_exercise_sets')
      .select('*')
      .eq('id', setId)
      .eq('training_plan_exercise_id', exerciseId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as TrainingPlanExerciseSetDto;
  }

  /**
   * Creates a new set for an exercise.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the parent day.
   * @param {string} exerciseId - The ID of the parent exercise.
   * @param {CreateTrainingPlanExerciseSetCommand} command - The command with the new set's data.
   * @returns {Promise<TrainingPlanExerciseSetDto>} A promise that resolves to the newly created set.
   */
  async createSet(planId: string, dayId: string, exerciseId: string, command: CreateTrainingPlanExerciseSetCommand): Promise<TrainingPlanExerciseSetDto> {
    await this.verifyPlanOwnership(planId, dayId, exerciseId);

    const rpcCommand = {
      p_user_id: this.getUserId(),
      p_training_plan_exercise_id: exerciseId,
      p_expected_reps: command.expected_reps,
      p_expected_weight: command.expected_weight,
      p_target_set_index: command.set_index,
    };

    // deno-lint-ignore no-explicit-any
    const { data, error } = await (this.supabase as any).rpc('create_training_plan_exercise_set', rpcCommand);

    if (error) {
      throw error;
    }

    return data[0] as TrainingPlanExerciseSetDto;
  }

  /**
   * Updates a set.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the parent day.
   * @param {string} exerciseId - The ID of the parent exercise.
   * @param {string} setId - The ID of the set to update.
   * @param {UpdateTrainingPlanExerciseSetCommand} command - The command with the updated data.
   * @returns {Promise<TrainingPlanExerciseSetDto | null>} A promise that resolves to the updated set or null if not found.
   */
  async updateSet(planId: string, dayId: string, exerciseId: string, setId: string, command: UpdateTrainingPlanExerciseSetCommand): Promise<TrainingPlanExerciseSetDto | null> {
    await this.verifyPlanOwnership(planId, dayId, exerciseId, setId);

    const rpcCommand = {
      p_user_id: this.getUserId(),
      p_set_id: setId,
      p_expected_reps: command.expected_reps,
      p_expected_weight: command.expected_weight,
      p_target_set_index: command.set_index,
    };

    // deno-lint-ignore no-explicit-any
    const { data, error } = await (this.supabase as any).rpc('update_training_plan_exercise_set', rpcCommand).single();

    if (error) {
      if (error.message.includes('not found')) {
        return null;
      }
      throw error;
    }

    return data as TrainingPlanExerciseSetDto;
  }

  /**
   * Deletes a set.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the parent day.
   * @param {string} exerciseId - The ID of the parent exercise.
   * @param {string} setId - The ID of the set to delete.
   * @returns {Promise<boolean>} A promise that resolves to true if deletion was successful.
   */
  async deleteSet(planId: string, dayId: string, exerciseId: string, setId: string): Promise<boolean> {
    await this.verifyPlanOwnership(planId, dayId, exerciseId, setId);

    const rpcCommand = {
      p_user_id: this.getUserId(),
      p_set_id: setId,
    };

    // deno-lint-ignore no-explicit-any
    const { error } = await (this.supabase as any).rpc('delete_training_plan_exercise_set', rpcCommand);

    if (error) {
      throw error;
    }

    return true;
  }

  /**
   * Finds all exercise progressions for a given plan.
   *
   * @param {string} planId - The ID of the training plan.
   * @returns {Promise<TrainingPlanExerciseProgressionDto[]>} A promise that resolves to a list of progressions.
   */
  async findProgressionsByPlanId(planId: string): Promise<TrainingPlanExerciseProgressionDto[]> {
    await this.verifyPlanOwnership(planId);

    const { data, error } = await this.supabase
      .from('training_plan_exercise_progressions')
      .select('*')
      .eq('training_plan_id', planId);

    if (error) {
      throw error;
    }

    return data as TrainingPlanExerciseProgressionDto[];
  }

  /**
   * Finds the progression for a specific exercise in a plan.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} exerciseId - The ID of the exercise.
   * @returns {Promise<TrainingPlanExerciseProgressionDto | null>} A promise that resolves to the progression or null if not found.
   */
  async findProgressionByExerciseId(planId: string, exerciseId: string): Promise<TrainingPlanExerciseProgressionDto | null> {
    await this.verifyPlanOwnership(planId);

    const { data, error } = await this.supabase
      .from('training_plan_exercise_progressions')
      .select('*')
      .eq('training_plan_id', planId)
      .eq('exercise_id', exerciseId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as TrainingPlanExerciseProgressionDto;
  }

  /**
   * Creates or updates an exercise progression.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} exerciseId - The ID of the exercise.
   * @param {UpsertTrainingPlanExerciseProgressionCommand} command - The command with the progression data.
   * @returns {Promise<TrainingPlanExerciseProgressionDto>} A promise that resolves to the created or updated progression.
   */
  async upsertProgression(planId: string, exerciseId: string, command: UpsertTrainingPlanExerciseProgressionCommand): Promise<TrainingPlanExerciseProgressionDto> {
    await this.verifyPlanOwnership(planId);

    const { data: existingProgression, error: existingProgressionError } = await this.supabase
      .from('training_plan_exercise_progressions')
      .select('*')
      .eq('training_plan_id', planId)
      .eq('exercise_id', exerciseId)
      .maybeSingle();

    if (existingProgressionError) {
      throw existingProgressionError;
    }

    const dataToUpsert = {
      id: existingProgression?.id || crypto.randomUUID(),
      training_plan_id: planId,
      exercise_id: exerciseId,
      weight_increment: command.weight_increment ?? existingProgression?.weight_increment ?? 0,
      failure_count_for_deload: command.failure_count_for_deload ?? existingProgression?.failure_count_for_deload ?? 0,
      deload_percentage: command.deload_percentage ?? existingProgression?.deload_percentage ?? 0,
      deload_strategy: command.deload_strategy ?? existingProgression?.deload_strategy ?? 'PROPORTIONAL' as const,
      reference_set_index: command.reference_set_index ?? existingProgression?.reference_set_index ?? null,
      consecutive_failures: command.consecutive_failures ?? existingProgression?.consecutive_failures ?? 0,
      last_updated: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('training_plan_exercise_progressions')
      .upsert(dataToUpsert, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as TrainingPlanExerciseProgressionDto;
  }

  /**
   * Handles errors related to plan ownership, returning a formatted API error response.
   * @param {Error} error - The error to handle.
   * @returns {ApiErrorResponse | null} A formatted error response or null if the error is not applicable.
   */
  handlePlanOwnershipError(error: Error): ApiErrorResponse | null {
    const ownershipErrorMessages = [
      'Training plan not found or user does not have access',
      'Training plan day not found or user does not have access',
      'Training plan exercise not found or user does not have access',
      'Training plan exercise set not found or user does not have access'
    ];

    if (ownershipErrorMessages.some(msg => error.message.includes(msg))) {
      return createErrorData(400, error.message, { type: 'ownership_verification_error' }, 'PLAN_OWNERSHIP_ERROR');
    }

    return null;
  }

  /**
   * Handles errors when an exercise is not found, returning a formatted API error response.
   * @param {Error} error - The error to handle.
   * @returns {ApiErrorResponse | null} A formatted error response or null if the error is not applicable.
   */
  handleExerciseNotFoundError(error: Error): ApiErrorResponse | null {
    if (error.message.includes('Exercise not found')) {
      const errorData = createErrorData(400, error.message, { type: 'exercise_not_found_error' }, 'EXERCISE_NOT_FOUND_ERROR');
      return errorData;
    }

    return null;
  }

  private async verifyPlanOwnership(planId: string, dayId?: string, exerciseId?: string, setId?: string): Promise<void> {
    const { data, error }  = await this.supabase
      .from('training_plans')
      .select('id, days:training_plan_days(id, exercises:training_plan_exercises(id, sets:training_plan_exercise_sets(id)))')
      .eq('id', planId)
      .eq('user_id', this.getUserId())
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('Training plan not found or user does not have access');
    }

    if (dayId) {
      const day = data.days?.find(d => d.id === dayId);
      if (!day) {
        throw new Error('Training plan day not found or user does not have access');
      }

      if (exerciseId) {
        const exercise = day.exercises?.find(e => e.id === exerciseId);
        if (!exercise) {
          throw new Error('Training plan exercise not found or user does not have access');
        }

        if (setId) {
          const set = exercise.sets?.find(s => s.id === setId);
          if (!set) {
            throw new Error('Training plan exercise set not found or user does not have access');
          }
        }
      }
    }
  }
}

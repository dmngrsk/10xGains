import type { SupabaseClient } from 'supabase';
import type { Database } from '../models/database.types.ts';
import type {
  PlanDto,
  CreatePlanCommand,
  UpdatePlanCommand,
  PlanDayDto,
  CreatePlanDayCommand,
  UpdatePlanDayCommand,
  PlanExerciseDto,
  CreatePlanExerciseCommand,
  UpdatePlanExerciseCommand,
  PlanExerciseSetDto,
  CreatePlanExerciseSetCommand,
  UpdatePlanExerciseSetCommand,
  PlanExerciseProgressionDto,
  UpsertPlanExerciseProgressionCommand,
  ApiResult,
  PagingQueryOptions,
  SortingQueryOptions
} from '../models/api.types.ts';
import { ApiErrorResponse, createErrorData } from "../utils/api-helpers.ts";
import {
  createEntityInCollection,
  updateEntityInCollection,
  deleteEntityFromCollection
} from '../utils/supabase.ts';

export interface PlanQueryOptions extends PagingQueryOptions, SortingQueryOptions {}

export interface PlanListResult extends ApiResult<PlanDto[]> {}

export interface PlanDayQueryOptions extends PagingQueryOptions {}

export interface PlanDayListResult extends ApiResult<PlanDayDto[]> {}

export interface PlanExerciseQueryOptions extends PagingQueryOptions {}

export interface PlanExerciseListResult extends ApiResult<PlanExerciseDto[]> {}

export interface PlanExerciseSetQueryOptions extends PagingQueryOptions {}

export interface PlanExerciseSetListResult extends ApiResult<PlanExerciseSetDto[]> {}

export class PlanRepository {
  constructor(
    private supabase: SupabaseClient<Database>,
    private getUserId: () => string
  ) {}

  /**
   * Finds all plans for the current user, with optional sorting and pagination.
   *
   * @param {PlanQueryOptions} options - Options for sorting and pagination.
   * @returns {Promise<PlanListResult>} A promise that resolves to the list of plans and the total count.
   */
  async findAll(options: PlanQueryOptions): Promise<PlanListResult> {
    const [sortColumn, sortDirection] = options.sort.split('.');
    if (sortDirection !== 'asc' && sortDirection !== 'desc') {
      throw new Error('Invalid sort direction');
    }

    const { data, count, error } = await this.supabase
      .from('plans')
      .select(`
        *,
        days:plan_days (
          *,
          exercises:plan_exercises (
            *,
            sets:plan_exercise_sets (
              *
            )
          )
        ),
        progressions:plan_exercise_progressions (
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
      data: sortedData as PlanDto[],
      totalCount: count ?? 0
    };
  }

  /**
   * Finds a single plan by its ID.
   *
   * @param {string} planId - The ID of the plan to find.
   * @returns {Promise<PlanDto | null>} A promise that resolves to the plan or null if not found.
   */
  async findById(planId: string): Promise<PlanDto | null> {
    const { data, error } = await this.supabase
      .from('plans')
      .select(`
        *,
        days:plan_days (
          *,
          exercises:plan_exercises (
            *,
            sets:plan_exercise_sets (
              *
            )
          )
        ),
        progressions:plan_exercise_progressions (
          *
        )
      `)
      .eq('id', planId)
      .eq('user_id', this.getUserId())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as PlanDto;
  }

  /**
   * Creates a new plan.
   *
   * @param {string} userId - The ID of the user creating the plan.
   * @param {CreatePlanCommand} command - The command containing the plan's details.
   * @returns {Promise<PlanDto>} A promise that resolves to the newly created plan.
   */
  async create(userId: string, command: CreatePlanCommand): Promise<PlanDto> {
    const newPlanData = {
      name: command.name,
      description: command.description ?? null,
      user_id: userId,
    };

    const { data, error } = await this.supabase
      .from('plans')
      .insert(newPlanData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as PlanDto;
  }

  /**
   * Updates an existing plan.
   *
   * @param {string} planId - The ID of the plan to update.
   * @param {UpdatePlanCommand} command - The command with the updated data.
   * @returns {Promise<PlanDto | null>} A promise that resolves to the updated plan or null if not found.
   */
  async update(planId: string, command: UpdatePlanCommand): Promise<PlanDto | null> {
    await this.verifyPlanOwnership(planId);

    const { data, error } = await this.supabase
      .from('plans')
      .update(command)
      .eq('id', planId)
      .eq('user_id', this.getUserId())
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as PlanDto;
  }

  /**
   * Deletes a plan.
   *
   * @param {string} planId - The ID of the plan to delete.
   * @returns {Promise<boolean>} A promise that resolves to true if the deletion was successful.
   */
  async delete(planId: string): Promise<boolean> {
    await this.verifyPlanOwnership(planId);

    const { error } = await this.supabase
      .from('plans')
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
   * @param {string} planId - The ID of the plan.
   * @param {PlanDayQueryOptions} options - Options for pagination.
   * @returns {Promise<PlanDayListResult>} A promise that resolves to a list of training days and total count.
   */
  async findDaysByPlanId(planId: string, options: PlanDayQueryOptions): Promise<PlanDayListResult> {
    await this.verifyPlanOwnership(planId);

    const { data, count, error } = await this.supabase
      .from('plan_days')
      .select(`
        *,
        exercises:plan_exercises(
          *,
          sets:plan_exercise_sets(
            *
          )
        )
      `, { count: 'exact' })
      .eq('plan_id', planId)
      .order('order_index', { ascending: true })
      .range(options.offset, options.offset + options.limit - 1);

    if (error) {
      throw error;
    }

    // Sort nested data by order indices
    const sortedData = data?.map(day => ({
      ...day,
      exercises: day.exercises?.sort((a, b) => a.order_index - b.order_index).map(exercise => ({
        ...exercise,
        sets: exercise.sets?.sort((a, b) => a.set_index - b.set_index)
      }))
    })) || [];

    return {
      data: sortedData as PlanDayDto[],
      totalCount: count ?? 0
    };
  }

  /**
   * Finds a single training day by its ID within a plan.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the day to find.
   * @returns {Promise<PlanDayDto | null>} A promise that resolves to the training day or null if not found.
   */
  async findDayById(planId: string, dayId: string): Promise<PlanDayDto | null> {
    await this.verifyPlanOwnership(planId);

    const { data, error } = await this.supabase
      .from('plan_days')
      .select(`
        *,
        exercises:plan_exercises(
          *,
          sets:plan_exercise_sets(
            *
          )
        )
      `)
      .eq('id', dayId)
      .eq('plan_id', planId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as PlanDayDto;
  }

  /**
   * Creates a new training day within a plan.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {CreatePlanDayCommand} command - The command with the new day's data.
   * @returns {Promise<PlanDayDto>} A promise that resolves to the newly created training day.
   */
  async createDay(planId: string, command: CreatePlanDayCommand): Promise<PlanDayDto> {
    await this.verifyPlanOwnership(planId);

    const newDay: PlanDayDto = {
      id: crypto.randomUUID(),
      plan_id: planId,
      name: command.name,
      description: command.description || null,
      order_index: command.order_index || 1,
    };

    const updatedDays = await createEntityInCollection<PlanDayDto>(
      this.supabase,
      'plan_days',
      'plan_id',
      planId,
      'order_index',
      newDay,
      (d: PlanDayDto) => d.id,
      (d: PlanDayDto) => d.order_index,
      (d: PlanDayDto, order: number) => ({ ...d, order_index: order })
    );

    return updatedDays.find(d => d.name === newDay.name && d.description === newDay.description) || updatedDays[updatedDays.length - 1];
  }

  /**
   * Updates a training day.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the day to update.
   * @param {UpdatePlanDayCommand} command - The command with the updated data.
   * @returns {Promise<PlanDayDto | null>} A promise that resolves to the updated day or null if not found.
   */
  async updateDay(planId: string, dayId: string, command: UpdatePlanDayCommand): Promise<PlanDayDto | null> {
    await this.verifyPlanOwnership(planId, dayId);

    const { data: existingDay, error: existingDayError } = await this.supabase
      .from('plan_days')
      .select('*')
      .eq('id', dayId)
      .eq('plan_id', planId)
      .single();

    if (existingDayError) {
      if (existingDayError.code === 'PGRST116') {
        return null;
      }
      throw existingDayError;
    }

    const updatedDay: PlanDayDto = {
      ...existingDay,
      name: command.name !== undefined ? command.name : existingDay.name,
      description: command.description !== undefined ? command.description : existingDay.description,
      order_index: command.order_index !== undefined ? command.order_index : existingDay.order_index,
    };

    const updatedDays = await updateEntityInCollection<PlanDayDto>(
      this.supabase,
      'plan_days',
      'plan_id',
      planId,
      'order_index',
      updatedDay,
      (d: PlanDayDto) => d.id,
      (d: PlanDayDto) => d.order_index,
      (d: PlanDayDto, newIndex: number) => ({ ...d, order_index: newIndex })
    );

    return updatedDays.find(d => d.id === dayId) || null;
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

    await deleteEntityFromCollection<PlanDayDto>(
      this.supabase,
      'plan_days',
      'plan_id',
      planId,
      'order_index',
      dayId,
      (d: PlanDayDto) => d.id,
      (d: PlanDayDto) => d.order_index,
      (d: PlanDayDto, newIndex: number) => ({ ...d, order_index: newIndex })
    );

    return true;
  }

  /**
   * Finds all exercises for a given training day.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the parent day.
   * @param {PlanExerciseQueryOptions} options - Options for pagination.
   * @returns {Promise<PlanExerciseListResult>} A promise that resolves to a list of exercises and total count.
   */
  async findExercisesByDayId(planId: string, dayId: string, options: PlanExerciseQueryOptions): Promise<PlanExerciseListResult> {
    await this.verifyPlanOwnership(planId, dayId);

    const { data, count, error } = await this.supabase
      .from('plan_exercises')
      .select('*, sets:plan_exercise_sets(*)', { count: 'exact' })
      .eq('plan_day_id', dayId)
      .order('order_index', { ascending: true })
      .range(options.offset, options.offset + options.limit - 1);

    if (error) {
      throw error;
    }

    // Sort nested data by order indices
    const sortedData = data?.map(exercise => ({
      ...exercise,
      sets: exercise.sets?.sort((a, b) => a.set_index - b.set_index)
    })) || [];

    return {
      data: sortedData as PlanExerciseDto[],
      totalCount: count ?? 0
    };
  }

  /**
   * Finds a single exercise by its ID.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the parent day.
   * @param {string} exerciseId - The ID of the exercise to find.
   * @returns {Promise<PlanExerciseDto | null>} A promise that resolves to the exercise or null if not found.
   */
  async findExerciseById(planId: string, dayId: string, exerciseId: string): Promise<PlanExerciseDto | null> {
    await this.verifyPlanOwnership(planId, dayId);

    const { data, error } = await this.supabase
      .from('plan_exercises')
      .select('*, sets:plan_exercise_sets(*)')
      .eq('id', exerciseId)
      .eq('plan_day_id', dayId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as PlanExerciseDto;
  }

  /**
   * Creates a new exercise within a training day.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the parent day.
   * @param {CreatePlanExerciseCommand} command - The command with the new exercise's data.
   * @returns {Promise<PlanExerciseDto>} A promise that resolves to the newly created exercise.
   */
  async createExercise(planId: string, dayId: string, command: CreatePlanExerciseCommand): Promise<PlanExerciseDto> {
    await this.verifyPlanOwnership(planId, dayId);

    const newExercise: PlanExerciseDto = {
      id: crypto.randomUUID(),
      plan_day_id: dayId,
      exercise_id: command.exercise_id,
      order_index: command.order_index || 1,
    };

    const updatedExercises = await createEntityInCollection<PlanExerciseDto>(
      this.supabase,
      'plan_exercises',
      'plan_day_id',
      dayId,
      'order_index',
      newExercise,
      (e: PlanExerciseDto) => e.id,
      (e: PlanExerciseDto) => e.order_index,
      (e: PlanExerciseDto, newIndex: number) => ({ ...e, order_index: newIndex })
    );

    return updatedExercises.find(e => e.exercise_id === newExercise.exercise_id) || updatedExercises[updatedExercises.length - 1];
  }

  /**
   * Updates an exercise.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the parent day.
   * @param {string} exerciseId - The ID of the exercise to update.
   * @param {UpdatePlanExerciseCommand} command - The command with the updated data.
   * @returns {Promise<PlanExerciseDto | null>} A promise that resolves to the updated exercise or null if not found.
   */
  async updateExercise(planId: string, dayId: string, exerciseId: string, command: UpdatePlanExerciseCommand): Promise<PlanExerciseDto | null> {
    await this.verifyPlanOwnership(planId, dayId, exerciseId);

    const { data: existingExercise, error: existingExerciseError } = await this.supabase
      .from('plan_exercises')
      .select('*')
      .eq('id', exerciseId)
      .eq('plan_day_id', dayId)
      .single();

    if (existingExerciseError) {
      if (existingExerciseError.code === 'PGRST116') {
        return null;
      }
      throw existingExerciseError;
    }

    const updatedExercise: PlanExerciseDto = {
      ...existingExercise,
      order_index: command.order_index !== undefined ? command.order_index : existingExercise.order_index,
    };

    const updatedExercises = await updateEntityInCollection<PlanExerciseDto>(
      this.supabase,
      'plan_exercises',
      'plan_day_id',
      dayId,
      'order_index',
      updatedExercise,
      (e: PlanExerciseDto) => e.id,
      (e: PlanExerciseDto) => e.order_index,
      (e: PlanExerciseDto, newIndex: number) => ({ ...e, order_index: newIndex })
    );

    return updatedExercises.find(e => e.id === exerciseId) || null;
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

    await deleteEntityFromCollection<PlanExerciseDto>(
      this.supabase,
      'plan_exercises',
      'plan_day_id',
      dayId,
      'order_index',
      exerciseId,
      (e: PlanExerciseDto) => e.id,
      (e: PlanExerciseDto) => e.order_index,
      (e: PlanExerciseDto, newIndex: number) => ({ ...e, order_index: newIndex })
    );

    return true;
  }

  /**
   * Finds all sets for a given exercise.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the parent day.
   * @param {string} exerciseId - The ID of the parent exercise.
   * @param {PlanExerciseSetQueryOptions} options - Options for pagination.
   * @returns {Promise<PlanExerciseSetListResult>} A promise that resolves to a list of sets and total count.
   */
  async findSetsByExerciseId(planId: string, dayId: string, exerciseId: string, options: PlanExerciseSetQueryOptions): Promise<PlanExerciseSetListResult> {
    await this.verifyPlanOwnership(planId, dayId, exerciseId);

    const { data, count, error } = await this.supabase
      .from('plan_exercise_sets')
      .select('*', { count: 'exact' })
      .eq('plan_exercise_id', exerciseId)
      .order('set_index', { ascending: true })
      .range(options.offset, options.offset + options.limit - 1);

    if (error) {
      throw error;
    }

    return {
      data: data as PlanExerciseSetDto[],
      totalCount: count ?? 0
    };
  }

  /**
   * Finds a single set by its ID.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the parent day.
   * @param {string} exerciseId - The ID of the parent exercise.
   * @param {string} setId - The ID of the set to find.
   * @returns {Promise<PlanExerciseSetDto | null>} A promise that resolves to the set or null if not found.
   */
  async findSetById(planId: string, dayId: string, exerciseId: string, setId: string): Promise<PlanExerciseSetDto | null> {
    await this.verifyPlanOwnership(planId, dayId, exerciseId);

    const { data, error } = await this.supabase
      .from('plan_exercise_sets')
      .select('*')
      .eq('id', setId)
      .eq('plan_exercise_id', exerciseId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as PlanExerciseSetDto;
  }

  /**
   * Creates a new set for an exercise.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the parent day.
   * @param {string} exerciseId - The ID of the parent exercise.
   * @param {CreatePlanExerciseSetCommand} command - The command with the new set's data.
   * @returns {Promise<PlanExerciseSetDto>} A promise that resolves to the newly created set.
   */
  async createSet(planId: string, dayId: string, exerciseId: string, command: CreatePlanExerciseSetCommand): Promise<PlanExerciseSetDto> {
    await this.verifyPlanOwnership(planId, dayId, exerciseId);

    const newSet: PlanExerciseSetDto = {
      id: crypto.randomUUID(),
      plan_exercise_id: exerciseId,
      expected_reps: command.expected_reps,
      expected_weight: command.expected_weight,
      set_index: command.set_index || 1,
    };

    const updatedSets = await createEntityInCollection<PlanExerciseSetDto>(
      this.supabase,
      'plan_exercise_sets',
      'plan_exercise_id',
      exerciseId,
      'set_index',
      newSet,
      (s: PlanExerciseSetDto) => s.id,
      (s: PlanExerciseSetDto) => s.set_index,
      (s: PlanExerciseSetDto, newIndex: number) => ({ ...s, set_index: newIndex })
    );

    return updatedSets.find(s => s.expected_reps === newSet.expected_reps && s.expected_weight === newSet.expected_weight) || updatedSets[updatedSets.length - 1];
  }

  /**
   * Updates a set.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the parent day.
   * @param {string} exerciseId - The ID of the parent exercise.
   * @param {string} setId - The ID of the set to update.
   * @param {UpdatePlanExerciseSetCommand} command - The command with the updated data.
   * @returns {Promise<PlanExerciseSetDto | null>} A promise that resolves to the updated set or null if not found.
   */
  async updateSet(planId: string, dayId: string, exerciseId: string, setId: string, command: UpdatePlanExerciseSetCommand): Promise<PlanExerciseSetDto | null> {
    await this.verifyPlanOwnership(planId, dayId, exerciseId, setId);

    const { data: existingSet, error: existingSetError } = await this.supabase
      .from('plan_exercise_sets')
      .select('*')
      .eq('id', setId)
      .eq('plan_exercise_id', exerciseId)
      .single();

    if (existingSetError) {
      if (existingSetError.code === 'PGRST116') {
        return null;
      }
      throw existingSetError;
    }

    const updatedSet: PlanExerciseSetDto = {
      ...existingSet,
      expected_reps: command.expected_reps !== undefined ? command.expected_reps : existingSet.expected_reps,
      expected_weight: command.expected_weight !== undefined ? command.expected_weight : existingSet.expected_weight,
      set_index: command.set_index !== undefined ? command.set_index : existingSet.set_index,
    };

    const updatedSets = await updateEntityInCollection<PlanExerciseSetDto>(
      this.supabase,
      'plan_exercise_sets',
      'plan_exercise_id',
      exerciseId,
      'set_index',
      updatedSet,
      (s: PlanExerciseSetDto) => s.id,
      (s: PlanExerciseSetDto) => s.set_index,
      (s: PlanExerciseSetDto, newIndex: number) => ({ ...s, set_index: newIndex })
    );

    return updatedSets.find(s => s.id === setId) || null;
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

    await deleteEntityFromCollection<PlanExerciseSetDto>(
      this.supabase,
      'plan_exercise_sets',
      'plan_exercise_id',
      exerciseId,
      'set_index',
      setId,
      (s: PlanExerciseSetDto) => s.id,
      (s: PlanExerciseSetDto) => s.set_index,
      (s: PlanExerciseSetDto, newIndex: number) => ({ ...s, set_index: newIndex })
    );

    return true;
  }

  /**
   * Finds all exercise progressions for a given plan.
   *
   * @param {string} planId - The ID of the plan.
   * @returns {Promise<PlanExerciseProgressionDto[]>} A promise that resolves to a list of progressions.
   */
  async findProgressionsByPlanId(planId: string): Promise<PlanExerciseProgressionDto[]> {
    await this.verifyPlanOwnership(planId);

    const { data, error } = await this.supabase
      .from('plan_exercise_progressions')
      .select('*')
      .eq('plan_id', planId);

    if (error) {
      throw error;
    }

    return data as PlanExerciseProgressionDto[];
  }

  /**
   * Finds the progression for a specific exercise in a plan.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} exerciseId - The ID of the exercise.
   * @returns {Promise<PlanExerciseProgressionDto | null>} A promise that resolves to the progression or null if not found.
   */
  async findProgressionByExerciseId(planId: string, exerciseId: string): Promise<PlanExerciseProgressionDto | null> {
    await this.verifyPlanOwnership(planId);

    const { data, error } = await this.supabase
      .from('plan_exercise_progressions')
      .select('*')
      .eq('plan_id', planId)
      .eq('exercise_id', exerciseId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as PlanExerciseProgressionDto;
  }

  /**
   * Creates or updates an exercise progression.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} exerciseId - The ID of the exercise.
   * @param {UpsertPlanExerciseProgressionCommand} command - The command with the progression data.
   * @returns {Promise<PlanExerciseProgressionDto>} A promise that resolves to the created or updated progression.
   */
  async upsertProgression(planId: string, exerciseId: string, command: UpsertPlanExerciseProgressionCommand): Promise<PlanExerciseProgressionDto> {
    await this.verifyPlanOwnership(planId);

    const { data: existingProgression, error: existingProgressionError } = await this.supabase
      .from('plan_exercise_progressions')
      .select('*')
      .eq('plan_id', planId)
      .eq('exercise_id', exerciseId)
      .maybeSingle();

    if (existingProgressionError) {
      throw existingProgressionError;
    }

    const dataToUpsert = {
      id: existingProgression?.id || crypto.randomUUID(),
      plan_id: planId,
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
      .from('plan_exercise_progressions')
      .upsert(dataToUpsert, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as PlanExerciseProgressionDto;
  }

  /**
   * Handles errors related to plan ownership, returning a formatted API error response.
   * @param {Error} error - The error to handle.
   * @returns {ApiErrorResponse | null} A formatted error response or null if the error is not applicable.
   */
  handlePlanOwnershipError(error: Error): ApiErrorResponse | null {
    const ownershipErrorMessages = [
      'Plan not found or user does not have access',
      'Plan day not found or user does not have access',
      'Plan exercise not found or user does not have access',
      'Plan exercise set not found or user does not have access'
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
      .from('plans')
      .select('id, days:plan_days(id, exercises:plan_exercises(id, sets:plan_exercise_sets(id)))')
      .eq('id', planId)
      .eq('user_id', this.getUserId())
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('Plan not found or user does not have access');
    }

    if (dayId) {
      const day = data.days?.find(d => d.id === dayId);
      if (!day) {
        throw new Error('Plan day not found or user does not have access');
      }

      if (exerciseId) {
        const exercise = day.exercises?.find(e => e.id === exerciseId);
        if (!exercise) {
          throw new Error('Plan exercise not found or user does not have access');
        }

        if (setId) {
          const set = exercise.sets?.find(s => s.id === setId);
          if (!set) {
            throw new Error('Plan exercise set not found or user does not have access');
          }
        }
      }
    }
  }


}

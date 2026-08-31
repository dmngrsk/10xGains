import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@txg/shared';
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
} from '@txg/shared';
import { ConflictError, DataIntegrityError, NotFoundError } from '../utils/errors';
import {
  createEntityInCollection,
  updateEntityInCollection,
  deleteEntityFromCollection
} from '../utils/supabase';
import type { CollectionConfig } from '../utils/supabase';

interface PlanOwnershipPath {
  id: string;
  days?: { id: string; exercises?: { id: string; sets?: { id: string }[] | null }[] | null }[] | null;
}

/**
 * Whether a read of the plan tree sees archived structure. Off by default, because the plan as the
 * user now understands it does not contain it; on for callers that resolve past sessions against it.
 */
export interface ArchivedStructureOptions {
  includeArchived?: boolean;
}

export type PlanQueryOptions = PagingQueryOptions & SortingQueryOptions & ArchivedStructureOptions;

export type PlanListResult = ApiResult<PlanDto[]>;

export type PlanDayQueryOptions = PagingQueryOptions & ArchivedStructureOptions;

export type PlanDayListResult = ApiResult<PlanDayDto[]>;

export type PlanExerciseQueryOptions = PagingQueryOptions & ArchivedStructureOptions;

export type PlanExerciseListResult = ApiResult<PlanExerciseDto[]>;

export type PlanExerciseSetQueryOptions = PagingQueryOptions;

export type PlanExerciseSetListResult = ApiResult<PlanExerciseSetDto[]>;

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

    const query = this.supabase
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
        )
      `, { count: 'exact' })
      .eq('user_id', this.getUserId())
      .range(options.offset, options.offset + options.limit - 1)
      .order(sortColumn, { ascending: sortDirection === 'asc' })
      .order('order_index', { referencedTable: 'days', ascending: true })
      .order('order_index', { referencedTable: 'days.exercises', ascending: true })
      .order('set_index', { referencedTable: 'days.exercises.sets', ascending: true });

    // The plan list normally describes plans as they now stand, so archived structure is omitted.
    // See findById for why a caller rendering history must opt back in.
    if (!options.includeArchived) {
      query.is('days.archived_at', null).is('days.exercises.archived_at', null);
    }

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    return {
      data: (data ?? []) as PlanDto[],
      totalCount: count ?? 0
    };
  }

  /**
   * Finds a single plan by its ID.
   *
   * Archived days and exercises are excluded by default: to the plan editor, and to session
   * creation, they no longer exist. Callers that resolve *history* against the plan must opt in, or
   * a session that trained an exercise since archived renders with a hole in it - the session page
   * builds its view model by walking the plan's exercises and matching session sets onto them, so a
   * set whose exercise is missing is silently dropped rather than shown.
   *
   * @param {string} planId - The ID of the plan to find.
   * @param {ArchivedStructureOptions} options - Whether archived structure should be included.
   * @returns {Promise<PlanDto | null>} A promise that resolves to the plan or null if not found.
   */
  async findById(planId: string, options: ArchivedStructureOptions = {}): Promise<PlanDto | null> {
    const query = this.supabase
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
      .order('order_index', { referencedTable: 'days', ascending: true })
      .order('order_index', { referencedTable: 'days.exercises', ascending: true })
      .order('set_index', { referencedTable: 'days.exercises.sets', ascending: true });

    if (!options.includeArchived) {
      query.is('days.archived_at', null).is('days.exercises.archived_at', null);
    }

    const { data, error } = await query.single();

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
   * Archived days and exercises are excluded by default, and a caller resolving history must opt
   * back in - see `findById` for why.
   *
   * @param {string} planId - The ID of the plan.
   * @param {PlanDayQueryOptions} options - Options for pagination, and whether archived structure
   *                                        should be included.
   * @returns {Promise<PlanDayListResult>} A promise that resolves to a list of training days and total count.
   */
  async findDaysByPlanId(planId: string, options: PlanDayQueryOptions): Promise<PlanDayListResult> {
    await this.verifyPlanOwnership(planId);

    const query = this.supabase
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
      .order('order_index', { referencedTable: 'exercises', ascending: true })
      .order('set_index', { referencedTable: 'exercises.sets', ascending: true })
      .range(options.offset, options.offset + options.limit - 1);

    if (!options.includeArchived) {
      query.is('archived_at', null).is('exercises.archived_at', null);
    }

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    return {
      data: (data ?? []) as PlanDayDto[],
      totalCount: count ?? 0
    };
  }

  /**
   * Finds a single training day by its ID within a plan.
   *
   * The day itself is filtered on the same terms as its exercises: without the opt-in an archived
   * day reads as absent, rather than coming back as a day that has mysteriously lost its archived
   * exercises.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the day to find.
   * @param {ArchivedStructureOptions} options - Whether archived structure should be included.
   * @returns {Promise<PlanDayDto | null>} A promise that resolves to the training day or null if not found.
   */
  async findDayById(planId: string, dayId: string, options: ArchivedStructureOptions = {}): Promise<PlanDayDto | null> {
    await this.verifyPlanOwnership(planId);

    const query = this.supabase
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
      .order('order_index', { referencedTable: 'exercises', ascending: true })
      .order('set_index', { referencedTable: 'exercises.sets', ascending: true });

    if (!options.includeArchived) {
      query.is('archived_at', null).is('exercises.archived_at', null);
    }

    const { data, error } = await query.single();

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
      archived_at: null,
    };

    const updatedDays = await createEntityInCollection(this.supabase, this.dayCollection(planId), newDay);

    const createdDay = updatedDays.find(d => d.id === newDay.id);
    if (!createdDay) {
      throw new DataIntegrityError('Failed to create plan day.');
    }

    return createdDay;
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

    const updatedDays = await updateEntityInCollection(this.supabase, this.dayCollection(planId), updatedDay);

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

    const { count, error } = await this.supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('plan_day_id', dayId);

    if (error) {
      throw error;
    }

    if ((count ?? 0) > 0) {
      throw new ConflictError(
        `This day has been trained ${count} time${count === 1 ? '' : 's'}. Deleting it would delete those workouts; archive it instead to remove it from the plan and keep the history.`,
        'PLAN_ITEM_HAS_HISTORY',
        'plan_item_has_history_error',
        409
      );
    }

    await deleteEntityFromCollection(this.supabase, this.dayCollection(planId), dayId);

    return true;
  }

  /**
   * Archives or restores a training day.
   *
   * Archiving is the delete a plan with history is allowed to have: the row survives, so the
   * sessions that reference it stay readable, but the editor and session creation stop seeing it.
   * The day keeps its `order_index`, and siblings are not renumbered around it - safe only because
   * the ordering constraint is partial over the live rows.
   *
   * Restoring therefore cannot put the day back where it was: the live days have been renumbered
   * 1..n in the meantime, and reinstating a stale `order_index` collides with the partial unique
   * index. A restored day is appended after the last live one instead.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the day to archive.
   * @param {boolean} archived - True to archive, false to restore.
   * @returns {Promise<PlanDayDto | null>} The updated day, or null if it does not exist.
   */
  async archiveDay(planId: string, dayId: string, archived: boolean): Promise<PlanDayDto | null> {
    await this.verifyPlanOwnership(planId, dayId);

    const { data: current, error: currentError } = await this.supabase
      .from('plan_days')
      .select('archived_at')
      .eq('id', dayId)
      .eq('plan_id', planId)
      .maybeSingle();

    if (currentError) {
      throw currentError;
    }

    if (!current) {
      return null;
    }

    // Only a day actually coming back out of the archive is re-slotted. Restoring one that is
    // already live would otherwise move it to the end, and the endpoint is idempotent.
    const restoredOrderIndex = !archived && current.archived_at !== null
      ? { order_index: await this.nextActiveDayOrderIndex(planId) }
      : {};

    const { data, error } = await this.supabase
      .from('plan_days')
      .update({ archived_at: archived ? new Date().toISOString() : null, ...restoredOrderIndex })
      .eq('id', dayId)
      .eq('plan_id', planId)
      .select('*')
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data as PlanDayDto | null) ?? null;
  }

  /**
   * Finds all exercises for a given training day.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the parent day.
   * @param {PlanExerciseQueryOptions} options - Options for pagination, and whether archived
   *                                             exercises should be included.
   * @returns {Promise<PlanExerciseListResult>} A promise that resolves to a list of exercises and total count.
   */
  async findExercisesByDayId(planId: string, dayId: string, options: PlanExerciseQueryOptions): Promise<PlanExerciseListResult> {
    await this.verifyPlanOwnership(planId, dayId);

    const query = this.supabase
      .from('plan_exercises')
      .select('*, sets:plan_exercise_sets(*)', { count: 'exact' })
      .eq('plan_day_id', dayId)
      .order('order_index', { ascending: true })
      .order('set_index', { referencedTable: 'sets', ascending: true })
      .range(options.offset, options.offset + options.limit - 1);

    if (!options.includeArchived) {
      query.is('archived_at', null);
    }

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    return {
      data: (data ?? []) as PlanExerciseDto[],
      totalCount: count ?? 0
    };
  }

  /**
   * Finds a single exercise by its ID.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the parent day.
   * @param {string} exerciseId - The ID of the exercise to find.
   * @param {ArchivedStructureOptions} options - Whether an archived exercise should be included.
   * @returns {Promise<PlanExerciseDto | null>} A promise that resolves to the exercise or null if not found.
   */
  async findExerciseById(planId: string, dayId: string, exerciseId: string, options: ArchivedStructureOptions = {}): Promise<PlanExerciseDto | null> {
    await this.verifyPlanOwnership(planId, dayId);

    const query = this.supabase
      .from('plan_exercises')
      .select('*, sets:plan_exercise_sets(*)')
      .eq('id', exerciseId)
      .eq('plan_day_id', dayId)
      .order('set_index', { referencedTable: 'sets', ascending: true });

    if (!options.includeArchived) {
      query.is('archived_at', null);
    }

    const { data, error } = await query.single();

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
      archived_at: null,
    };

    const updatedExercises = await createEntityInCollection(this.supabase, this.exerciseCollection(dayId), newExercise);

    const createdExercise = updatedExercises.find(e => e.id === newExercise.id);
    if (!createdExercise) {
      throw new DataIntegrityError('Failed to create plan exercise.');
    }

    return createdExercise;
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

    const updatedExercises = await updateEntityInCollection(this.supabase, this.exerciseCollection(dayId), updatedExercise);

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

    const { count, error } = await this.supabase
      .from('session_sets')
      .select('id', { count: 'exact', head: true })
      .eq('plan_exercise_id', exerciseId);

    if (error) {
      throw error;
    }

    if ((count ?? 0) > 0) {
      throw new ConflictError(
        `This exercise has ${count} recorded set${count === 1 ? '' : 's'}. Deleting it would delete them; archive it instead to remove it from the plan and keep the history.`,
        'PLAN_ITEM_HAS_HISTORY',
        'plan_item_has_history_error',
        409
      );
    }

    await deleteEntityFromCollection(this.supabase, this.exerciseCollection(dayId), exerciseId);

    return true;
  }

  /**
   * Archives or restores an exercise within a training day.
   *
   * See {@link archiveDay}: the same contract, one level down, including being appended rather than
   * put back on restore. The exercise's sets are left in place - they belong to the exercise, not to
   * the plan, and restoring must bring them back.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the parent day.
   * @param {string} exerciseId - The ID of the exercise to archive.
   * @param {boolean} archived - True to archive, false to restore.
   * @returns {Promise<PlanExerciseDto | null>} The updated exercise, or null if it does not exist.
   */
  async archiveExercise(planId: string, dayId: string, exerciseId: string, archived: boolean): Promise<PlanExerciseDto | null> {
    await this.verifyPlanOwnership(planId, dayId, exerciseId);

    const { data: current, error: currentError } = await this.supabase
      .from('plan_exercises')
      .select('archived_at')
      .eq('id', exerciseId)
      .eq('plan_day_id', dayId)
      .maybeSingle();

    if (currentError) {
      throw currentError;
    }

    if (!current) {
      return null;
    }

    const restoredOrderIndex = !archived && current.archived_at !== null
      ? { order_index: await this.nextActiveExerciseOrderIndex(dayId) }
      : {};

    const { data, error } = await this.supabase
      .from('plan_exercises')
      .update({ archived_at: archived ? new Date().toISOString() : null, ...restoredOrderIndex })
      .eq('id', exerciseId)
      .eq('plan_day_id', dayId)
      .select('*')
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data as PlanExerciseDto | null) ?? null;
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

    const updatedSets = await createEntityInCollection(this.supabase, this.planSetCollection(exerciseId), newSet);

    const createdSet = updatedSets.find(s => s.id === newSet.id);
    if (!createdSet) {
      throw new DataIntegrityError('Failed to create plan exercise set.');
    }

    return createdSet;
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

    const updatedSets = await updateEntityInCollection(this.supabase, this.planSetCollection(exerciseId), updatedSet);

    return updatedSets.find(s => s.id === setId) || null;
  }

  /**
   * Deletes a set.
   *
   * Unlike a day or an exercise, a set has no archived form: deleting one renumbers the
   * `set_index` of every set after it, and progression judges a session by matching its recorded
   * sets to the plan's by that index. So once anything has been recorded against the exercise,
   * the set stays and only its targets may be edited.
   *
   * @param {string} planId - The ID of the parent plan.
   * @param {string} dayId - The ID of the parent day.
   * @param {string} exerciseId - The ID of the parent exercise.
   * @param {string} setId - The ID of the set to delete.
   * @returns {Promise<boolean>} A promise that resolves to true if deletion was successful.
   */
  async deleteSet(planId: string, dayId: string, exerciseId: string, setId: string): Promise<boolean> {
    await this.verifyPlanOwnership(planId, dayId, exerciseId, setId);

    const { count, error } = await this.supabase
      .from('session_sets')
      .select('id', { count: 'exact', head: true })
      .eq('plan_exercise_id', exerciseId);

    if (error) {
      throw error;
    }

    if ((count ?? 0) > 0) {
      throw new ConflictError(
        `This exercise has ${count} recorded set${count === 1 ? '' : 's'}. Deleting a set would renumber the others and change what those workouts are judged against; edit the set's targets instead.`,
        'PLAN_ITEM_HAS_HISTORY',
        'plan_item_has_history_error',
        409
      );
    }

    await deleteEntityFromCollection(this.supabase, this.planSetCollection(exerciseId), setId);

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
   * The ordered collection of a plan's training days.
   *
   * @param {string} planId - The plan whose days form the collection.
   * @returns {CollectionConfig<PlanDayDto>} The collection descriptor.
   */
  private dayCollection(planId: string): CollectionConfig<PlanDayDto> {
    return {
      table: 'plan_days',
      parentColumn: 'plan_id',
      parentId: planId,
      orderColumn: 'order_index',
      getId: (d) => d.id,
      getOrder: (d) => d.order_index,
      setOrder: (d, order) => ({ ...d, order_index: order }),
      activeOnlyColumn: 'archived_at',
    };
  }

  /**
   * The ordered collection of a training day's exercises.
   *
   * @param {string} dayId - The day whose exercises form the collection.
   * @returns {CollectionConfig<PlanExerciseDto>} The collection descriptor.
   */
  private exerciseCollection(dayId: string): CollectionConfig<PlanExerciseDto> {
    return {
      table: 'plan_exercises',
      parentColumn: 'plan_day_id',
      parentId: dayId,
      orderColumn: 'order_index',
      getId: (e) => e.id,
      getOrder: (e) => e.order_index,
      setOrder: (e, order) => ({ ...e, order_index: order }),
      activeOnlyColumn: 'archived_at',
    };
  }

  /**
   * The ordered collection of a plan exercise's sets.
   *
   * @param {string} exerciseId - The exercise whose sets form the collection.
   * @returns {CollectionConfig<PlanExerciseSetDto>} The collection descriptor.
   */
  private planSetCollection(exerciseId: string): CollectionConfig<PlanExerciseSetDto> {
    return {
      table: 'plan_exercise_sets',
      parentColumn: 'plan_exercise_id',
      parentId: exerciseId,
      orderColumn: 'set_index',
      getId: (s) => s.id,
      getOrder: (s) => s.set_index,
      setOrder: (s, index) => ({ ...s, set_index: index }),
    };
  }

  /**
   * The position a restored day takes: one past the last live sibling.
   *
   * Archived rows are excluded, so this is the end of the collection as the editor sees it, and it
   * cannot collide with the partial unique index over the live rows.
   *
   * @param {string} planId - The plan whose live days are counted.
   * @returns {Promise<number>} The 1-based index to place the restored day at.
   */
  private async nextActiveDayOrderIndex(planId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('plan_days')
      .select('order_index')
      .eq('plan_id', planId)
      .is('archived_at', null)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data?.order_index ?? 0) + 1;
  }

  /**
   * The position a restored exercise takes; see {@link nextActiveDayOrderIndex}.
   *
   * @param {string} dayId - The day whose live exercises are counted.
   * @returns {Promise<number>} The 1-based index to place the restored exercise at.
   */
  private async nextActiveExerciseOrderIndex(dayId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('plan_exercises')
      .select('order_index')
      .eq('plan_day_id', dayId)
      .is('archived_at', null)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data?.order_index ?? 0) + 1;
  }

  /**
   * Verifies that the given plan belongs to the current user, and that each id below it really sits
   * on the path implied by the one above.
   *
   * Only the requested path is fetched: the embed is built to the depth the caller asked about and
   * each level is filtered to the single id in question. Selecting the whole tree instead - every
   * day, exercise and set id of the plan - made a one-set edit walk the entire plan on every
   * request, before the collection helper had even fetched the sibling rows.
   *
   * The embeds are deliberately not `!inner`: a non-matching child leaves the plan row in place with
   * an empty array, which is what lets the checks below report *which* level was missing rather than
   * collapsing every failure into "plan not found".
   *
   * @param {string} planId - The plan that must belong to the current user.
   * @param {string} [dayId] - A day that must belong to that plan.
   * @param {string} [exerciseId] - An exercise that must belong to that day.
   * @param {string} [setId] - A set that must belong to that exercise.
   */
  private async verifyPlanOwnership(planId: string, dayId?: string, exerciseId?: string, setId?: string): Promise<void> {
    let select = 'id';
    if (dayId) {
      const exercisesEmbed = exerciseId
        ? `, exercises:plan_exercises(id${setId ? ', sets:plan_exercise_sets(id)' : ''})`
        : '';
      select = `id, days:plan_days(id${exercisesEmbed})`;
    }

    const query = this.supabase
      .from('plans')
      .select(select)
      .eq('id', planId)
      .eq('user_id', this.getUserId());

    if (dayId) {
      query.eq('days.id', dayId);
    }
    if (exerciseId) {
      query.eq('days.exercises.id', exerciseId);
    }
    if (setId) {
      query.eq('days.exercises.sets.id', setId);
    }

    const { data, error } = await query.maybeSingle<PlanOwnershipPath>();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new NotFoundError('Plan not found.', 'PLAN_NOT_FOUND', 'plan_not_found_error');
    }

    if (!dayId) {
      return;
    }

    const day = data.days?.[0];
    if (!day) {
      throw new NotFoundError('Plan day not found.', 'PLAN_DAY_NOT_FOUND', 'plan_day_not_found_error');
    }

    if (!exerciseId) {
      return;
    }

    const exercise = day.exercises?.[0];
    if (!exercise) {
      throw new NotFoundError('Plan exercise not found.', 'PLAN_EXERCISE_NOT_FOUND', 'plan_exercise_not_found_error');
    }

    if (!setId) {
      return;
    }

    if (!exercise.sets?.[0]) {
      throw new NotFoundError('Plan exercise set not found.', 'PLAN_EXERCISE_SET_NOT_FOUND', 'plan_exercise_set_not_found_error');
    }
  }

}

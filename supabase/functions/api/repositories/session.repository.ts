import type { SupabaseClient } from 'supabase';
import type { Database, Json } from '../models/database.types.ts';
import type {
  SessionDto,
  CreateSessionCommand,
  UpdateSessionCommand,
  SessionSetDto,
  CreateSessionSetCommand,
  UpdateSessionSetCommand,
  PlanExerciseDto,
  PlanExerciseProgressionDto
} from '../models/api.types.ts';
import { ApiErrorResponse, createErrorData, createErrorDataWithLogging } from "../utils/api-helpers.ts";
import { resolveExerciseProgressions } from '../services/exercise-progressions/exercise-progressions.ts';
import { createEntityInCollection, updateEntityInCollection, deleteEntityFromCollection } from '../utils/supabase.ts';

export interface SessionQueryOptions {
  limit: number;
  offset: number;
  sort: string;
  status?: SessionDto['status'][];
  date_from?: string;
  date_to?: string;
  plan_id?: string;
}

export interface SessionListResult {
  data: SessionDto[];
  totalCount: number;
}

export class SessionRepository {
  constructor(
    private supabase: SupabaseClient<Database>,
    private getUserId: () => string
  ) {}

  /**
   * Finds all training sessions matching the provided criteria.
   *
   * @param {SessionQueryOptions} options - The query options for filtering and pagination.
   * @returns {Promise<SessionListResult>} A promise that resolves to a list of sessions and the total count.
   */
  async findAll(options: SessionQueryOptions): Promise<SessionListResult> {
    let supabaseQuery = this.supabase
      .from('sessions')
      .select('*, sets:session_sets!session_sets_session_id_fkey(*)', { count: 'exact' })
      .eq('user_id', this.getUserId());

    if (options.status && options.status.length > 0) {
      supabaseQuery = supabaseQuery.in('status', options.status);
    }

    if (options.date_from) {
      supabaseQuery = supabaseQuery.gte('session_date', options.date_from);
    }

    if (options.date_to) {
      supabaseQuery = supabaseQuery.lte('session_date', options.date_to);
    }

    if (options.plan_id) {
      supabaseQuery = supabaseQuery.eq('plan_id', options.plan_id);
    }

    if (options.sort) {
      const [field, direction] = options.sort.split('.');
      supabaseQuery = supabaseQuery.order(field, { ascending: direction === 'asc' });
    } else {
      supabaseQuery = supabaseQuery.order('session_date', { ascending: false });
    }

    if (options.limit !== undefined && options.offset !== undefined) {
      supabaseQuery = supabaseQuery.range(options.offset, options.offset + options.limit - 1);
    } else if (options.limit !== undefined) {
      supabaseQuery = supabaseQuery.limit(options.limit);
    }

    const { data, count, error } = await supabaseQuery;

    if (error) {
      throw error;
    }

    // Sort nested data by order indices
    data?.forEach((session: SessionDto) =>
      session.sets?.sort((a: SessionSetDto, b: SessionSetDto) =>
        a.plan_exercise_id.localeCompare(b.plan_exercise_id) ||
        a.set_index - b.set_index
      )
    );

    return {
      data: data as SessionDto[] || [],
      totalCount: count ?? 0
    };
  }

  /**
   * Finds a single training session by its ID.
   *
   * @param {string} sessionId - The ID of the session to find.
   * @returns {Promise<SessionDto | null>} A promise that resolves to the session or null if not found.
   */
  async findById(sessionId: string): Promise<SessionDto | null> {
    const { data, error } = await this.supabase
      .from('sessions')
      .select('*, sets:session_sets!session_sets_session_id_fkey(*)')
      .eq('id', sessionId)
      .eq('user_id', this.getUserId())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    if (data.sets) {
      data.sets.sort((a: SessionSetDto, b: SessionSetDto) =>
        a.plan_exercise_id.localeCompare(b.plan_exercise_id) ||
        a.set_index - b.set_index
      );
    }

    return data as SessionDto;
  }

  /**
   * Creates a new training session based on a plan.
   *
   * It determines the next day to train and cancels any pending or in-progress sessions
   * before creating the new one.
   *
   * @param {CreateSessionCommand} command - The command containing the details for the new session.
   * @returns {Promise<SessionDto>} A promise that resolves to the newly created session.
   */
  async create(command: CreateSessionCommand): Promise<SessionDto> {
    const userId = this.getUserId();

    // Step 1: Fetch the plan and its days
    const { data: plan, error: planError } = await this.supabase
      .from('plans')
      .select(`
        days:plan_days!inner(
          id,
          order_index,
          exercises:plan_exercises!inner(
            sets:plan_exercise_sets!inner(
              *
            )
          )
        )
      `)
      .eq('user_id', userId)
      .eq('id', command.plan_id as string)
      .single();

    if (planError || !plan) {
      throw new Error('Plan not found.');
    }

    const dayIds = plan.days.sort((a, b) => a.order_index - b.order_index).map(d => d.id);

    // Step 2: Fetch existing sessions to determine next day
    const { data: sessions, error: sessionsError } = await this.supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_id', command.plan_id as string)
      .in('status', ['COMPLETED', 'PENDING', 'IN_PROGRESS'])
      .order('session_date', { ascending: false })
      .limit(10);

    if (sessionsError) {
      throw sessionsError;
    }

    let currentDayId = command.plan_day_id;
    if (!currentDayId) {
      const latestCompletedSession = sessions!
        .filter(s => !!s.session_date)
        .sort((a, b) => new Date(b.session_date!).getTime() - new Date(a.session_date!).getTime())
        .find(s => s.status === 'COMPLETED');

      if (latestCompletedSession) {
        const dayIndex = dayIds.indexOf(latestCompletedSession.plan_day_id!);
        if (dayIndex !== -1) {
          currentDayId = dayIds[(dayIndex + 1) % dayIds.length];
        } else {
          throw new Error('Failed to identify next day for plan');
        }
      } else if (!currentDayId) {
        currentDayId = dayIds[0];
      }
    }

    // Step 3: Build records to upsert
    const recordsToUpsert: SessionDto[] = [];
    const sessionsInProgress = sessions!.filter(s => s.status === 'IN_PROGRESS' || s.status === 'PENDING');

    if (sessionsInProgress && sessionsInProgress.length > 0) {
      sessionsInProgress.forEach(s => {
        recordsToUpsert.push({
           ...s,
           plan_day_id: s.plan_day_id!,
           status: 'CANCELLED',
        });
      });
    }

    const newSessionId = crypto.randomUUID();
    recordsToUpsert.push({
      id: newSessionId,
      user_id: userId,
      plan_id: command.plan_id,
      plan_day_id: currentDayId,
      status: 'PENDING',
      session_date: null
    });

    const newSessionSets = plan.days
      .find(d => d.id === currentDayId)!.exercises
      .flatMap(e => (e.sets))
      .map((tpes) => ({
        id: crypto.randomUUID(),
        session_id: newSessionId,
        plan_exercise_id: tpes.plan_exercise_id,
        set_index: tpes.set_index,
        expected_reps: tpes.expected_reps,
        actual_reps: null,
        actual_weight: tpes.expected_weight,
        status: 'PENDING',
        completed_at: null
      })) as SessionSetDto[];

    // Step 4: Use batch operations to atomically create session and sets
    const batchOperations = [
      {
        table_name: 'sessions',
        records: recordsToUpsert
      },
      {
        table_name: 'session_sets',
        parent_column: 'session_id',
        parent_id: newSessionId,
        records: newSessionSets
      }
    ];

    const { error: batchError } = await this.supabase.rpc('replace_collections_batch', {
      p_operations: batchOperations.filter(op => op.records.length > 0) as Json
    });

    if (batchError) {
      throw batchError;
    }

    const { data: createdSession, error: fetchError } = await this.supabase
      .from('sessions')
      .select('*')
      .eq('id', newSessionId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !createdSession) {
      throw fetchError || new Error('Failed to fetch newly created session');
    }

    const newlyCreatedSession = {
      ...createdSession,
      sets: newSessionSets
    };

    return newlyCreatedSession as SessionDto;
  }

  /**
   * Updates an existing training session.
   *
   * @param {string} sessionId - The ID of the session to update.
   * @param {UpdateSessionCommand} command - The command with the updated data.
   * @returns {Promise<SessionDto | null>} A promise that resolves to the updated session or null if not found.
   */
  async update(sessionId: string, command: UpdateSessionCommand): Promise<SessionDto | null> {
    await this.verifySessionOwnership(sessionId);

    const { data, error } = await this.supabase
      .from('sessions')
      .update(command)
      .eq('id', sessionId)
      .eq('user_id', this.getUserId())
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as SessionDto;
  }

  /**
   * Deletes a training session.
   *
   * @param {string} sessionId - The ID of the session to delete.
   * @returns {Promise<boolean>} A promise that resolves to true if deletion was successful.
   */
  async delete(sessionId: string): Promise<boolean> {
    await this.verifySessionOwnership(sessionId);

    const { error, data } = await this.supabase
      .from('sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', this.getUserId())
      .select();

    if (error) {
      throw error;
    }

    return data && data.length > 0;
  }

  /**
   * Marks a training session as complete and processes exercise progressions.
   *
   * This is a critical operation that calculates progression for each exercise
   * in the completed session and updates the plan accordingly.
   *
   * @param {string} sessionId - The ID of the session to complete.
   * @returns {Promise<SessionDto | null>} A promise that resolves to the completed session.
   */
  async complete(sessionId: string): Promise<SessionDto | null> {
    const userId = this.getUserId();

    // Step 1: Fetch the training session
    const { data: existingSession, error: fetchSessionError } = await this.supabase
      .from('sessions')
      .select('id, plan_id, status, user_id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchSessionError) {
      throw fetchSessionError;
    }

    if (!existingSession) {
      return null;
    }

    if (existingSession.status !== 'IN_PROGRESS') {
      throw new Error(`Session cannot be completed. Current status: ${existingSession.status}. Expected: IN_PROGRESS.`);
    }

    if (!existingSession.plan_id) {
      throw new Error('Plan ID missing from the session. Cannot calculate progressions.');
    }

    // Step 2: Fetch all session sets and associated plan exercise data
    const { data: setData, error: sessionSetsError } = await this.supabase
      .from('session_sets')
      .select(`
        *,
        plan_exercises:plan_exercises!plan_exercise_id (
          exercises:exercises!exercise_id (
            *
          )
        )
      `)
      .eq('session_id', sessionId);

    if (sessionSetsError) {
      throw sessionSetsError;
    }

    const exerciseIds = [
      ...new Set(setData
        // deno-lint-ignore no-explicit-any
        .flatMap((ss: any) => ss.plan_exercises)
        // deno-lint-ignore no-explicit-any
        .flatMap((tpe: any) => tpe.exercises)
        // deno-lint-ignore no-explicit-any
        .map((e: any) => e.id)
      )
    ];

    const { data: planData, error: planDataError } = await this.supabase
      .from('plan_days')
      .select(`
        exercises:plan_exercises!inner (
          *,
          sets:plan_exercise_sets!inner (
            *
          ),
          global_exercises:exercises!exercise_id!inner (
            progression:plan_exercise_progressions!exercise_id (
              *
            )
          )
        )
      `)
      .eq('plan_id', existingSession.plan_id)
      .in('exercises.exercise_id', exerciseIds);

    if (planDataError) {
      throw planDataError;
    }

    // Step 3: Recalculate weight and progression rules for each exercise
    // deno-lint-ignore no-explicit-any
    const sessionSets = setData.map(({ plan_exercises: _, ...ss }: any) => ss) as SessionSetDto[];

    const planExercises = [...new Map(
      planData
        // deno-lint-ignore no-explicit-any
        .flatMap((s: any) => s.exercises)
        // deno-lint-ignore no-explicit-any
        .map(({ global_exercises: _, ...tpe }: any) => [tpe.id, tpe])
      ).values()
    ] as PlanExerciseDto[];

    const planExerciseProgressions = [...new Map(
      planData
        // deno-lint-ignore no-explicit-any
        .flatMap((s: any) => s.exercises)
        // deno-lint-ignore no-explicit-any
        .flatMap((pe: any) => pe.global_exercises)
        // deno-lint-ignore no-explicit-any
        .flatMap((pe: any) => pe.progression)
        // deno-lint-ignore no-explicit-any
        .map((p: any) => [p.id, p])
      ).values()
    ] as PlanExerciseProgressionDto[];

    const { exerciseSetsToUpdate, exerciseProgressionsToUpdate } = resolveExerciseProgressions(
      sessionSets,
      planExercises,
      planExerciseProgressions
    );

    // Step 4: Fetch full session and update all data in a single atomic transaction
    const sessionSetsToUpdate = sessionSets
      .filter(ss => ss.status === 'PENDING')
      .map(ss => ({ ...ss, status: 'SKIPPED' as const }));

    const { data: fullSession, error: fullSessionError } = await this.supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (fullSessionError) {
      if (fullSessionError.code === 'PGRST116') {
        return null;
      }
      throw fullSessionError;
    }

    const completedSession = {
      ...fullSession,
      status: 'COMPLETED' as const
    };

    const batchOperations = [
      {
        table_name: 'session_sets',
        records: sessionSetsToUpdate
      },
      {
        table_name: 'plan_exercise_sets',
        records: exerciseSetsToUpdate
      },
      {
        table_name: 'plan_exercise_progressions',
        records: exerciseProgressionsToUpdate
      },
      {
        table_name: 'sessions',
        records: [completedSession]
      }
    ];

    const { error: batchError } = await this.supabase.rpc('replace_collections_batch', {
      p_operations: batchOperations.filter(op => op.records.length > 0) as Json
    });

    if (batchError) {
      throw batchError;
    }

    return completedSession as SessionDto;
  }

  /**
   * Finds all sets for a given training session.
   *
   * @param {string} sessionId - The ID of the session.
   * @returns {Promise<SessionSetDto[]>} A promise that resolves to an array of session sets.
   */
  async findSetsBySessionId(sessionId: string): Promise<SessionSetDto[]> {
    await this.verifySessionOwnership(sessionId);

    const { data, error } = await this.supabase
      .from('session_sets')
      .select('*')
      .eq('session_id', sessionId)
      .order('plan_exercise_id', { ascending: true })
      .order('set_index', { ascending: true });

    if (error) {
      throw error;
    }

    return data as SessionSetDto[] || [];
  }

  /**
   * Finds a single session set by its ID within a session.
   *
   * @param {string} sessionId - The ID of the session.
   * @param {string} setId - The ID of the set to find.
   * @returns {Promise<SessionSetDto | null>} A promise that resolves to the session set or null if not found.
   */
  async findSetById(sessionId: string, setId: string): Promise<SessionSetDto | null> {
    await this.verifySessionOwnership(sessionId);

    const { data, error } = await this.supabase
      .from('session_sets')
      .select('*')
      .eq('id', setId)
      .eq('session_id', sessionId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as SessionSetDto | null;
  }

  /**
   * Creates a new set within a training session.
   *
   * @param {string} sessionId - The ID of the session to add the set to.
   * @param {CreateSessionSetCommand} command - The command with the data for the new set.
   * @returns {Promise<SessionSetDto>} A promise that resolves to the newly created session set.
   */
  async createSet(sessionId: string, command: CreateSessionSetCommand): Promise<SessionSetDto> {
    await this.verifySessionOwnership(sessionId);

    const newSetId = crypto.randomUUID();
    const newSetData: SessionSetDto = {
      id: newSetId,
      session_id: sessionId,
      plan_exercise_id: command.plan_exercise_id,
      set_index: command.set_index,
      expected_reps: command.expected_reps,
      actual_reps: command.actual_reps,
      actual_weight: command.actual_weight,
      status: command.status || 'PENDING',
      completed_at: command.completed_at || null,
    } as SessionSetDto;

    const updatedSets = await createEntityInCollection<SessionSetDto>(
      this.supabase,
      'session_sets',
      'plan_exercise_id',
      command.plan_exercise_id,
      'set_index',
      newSetData,
      (s: SessionSetDto) => s.id,
      (s: SessionSetDto) => s.set_index,
      (s: SessionSetDto, newIndex: number) => ({ ...s, set_index: newIndex })
    );

    const createdSet = updatedSets.find((s: SessionSetDto) => s.id === newSetId);
    if (!createdSet) {
      throw new Error('Failed to create session set');
    }

    return createdSet;
  }

  /**
   * Updates a session set.
   *
   * @param {string} sessionId - The ID of the parent session.
   * @param {string} setId - The ID of the set to update.
   * @param {UpdateSessionSetCommand} command - The command with the updated data.
   * @returns {Promise<SessionSetDto | null>} A promise that resolves to the updated session set.
   */
  async updateSet(sessionId: string, setId: string, command: UpdateSessionSetCommand): Promise<SessionSetDto | null> {
    await this.verifySessionOwnership(sessionId);

    const { data: existingSet, error: existingSetError } = await this.supabase
      .from('session_sets')
      .select('*')
      .eq('id', setId)
      .eq('session_id', sessionId)
      .maybeSingle();

    if (existingSetError) {
      throw existingSetError;
    }

    if (!existingSet) {
      return null;
    }

    const updatedSetData: SessionSetDto = {
      ...existingSet,
      ...command,
      set_index: command.set_index !== undefined ? command.set_index : existingSet.set_index,
      status: command.status !== undefined ? command.status : existingSet.status,
      completed_at: command.completed_at !== undefined ? command.completed_at : existingSet.completed_at,
    };

    const updatedSets = await updateEntityInCollection<SessionSetDto>(
      this.supabase,
      'session_sets',
      'plan_exercise_id',
      existingSet.plan_exercise_id,
      'set_index',
      updatedSetData,
      (s: SessionSetDto) => s.id,
      (s: SessionSetDto) => s.set_index,
      (s: SessionSetDto, newIdx: number) => ({ ...s, set_index: newIdx })
    );

    return updatedSets.find(s => s.id === setId) || null;
  }

  /**
   * Deletes a session set.
   *
   * @param {string} sessionId - The ID of the parent session.
   * @param {string} setId - The ID of the set to delete.
   * @returns {Promise<boolean>} A promise that resolves to true if deletion was successful.
   */
  async deleteSet(sessionId: string, setId: string): Promise<boolean> {
    await this.verifySessionOwnership(sessionId);

    const { data: existingSet, error: existingSetError } = await this.supabase
      .from('session_sets')
      .select('*')
      .eq('id', setId)
      .eq('session_id', sessionId)
      .maybeSingle();

    if (existingSetError) {
      throw existingSetError;
    }

    if (!existingSet) {
      return false;
    }

    await deleteEntityFromCollection<SessionSetDto>(
      this.supabase,
      'session_sets',
      'plan_exercise_id',
      existingSet.plan_exercise_id,
      'set_index',
      setId,
      (s: SessionSetDto) => s.id,
      (s: SessionSetDto) => s.set_index,
      (s: SessionSetDto, newIdx: number) => ({ ...s, set_index: newIdx })
    );

    return true;
  }

  /**
   * Applies a partial update to a session set.
   *
   * This method retrieves a set, allows a transformation function to be applied,
   * and then saves the result. This is useful for patch-like operations.
   *
   * @param {string} sessionId - The ID of the parent session.
   * @param {string} setId - The ID of the set to patch.
   * @param {(set: SessionSetDto) => Partial<SessionSetDto>} getUpdateData - A function that takes the current set and returns the partial data to update.
   * @returns {Promise<SessionSetDto | null>} A promise that resolves to the patched session set.
   */
  async patchSet(sessionId: string, setId: string, getUpdateData: (set: SessionSetDto) => Partial<SessionSetDto>): Promise<SessionSetDto | null> {
    const { data: sessionData, error: sessionError } = await this.supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', this.getUserId())
      .single();

    if (sessionError || !sessionData) {
      throw new Error('Session not found.');
    }

    if (sessionData.status === 'COMPLETED') {
      throw new Error(`Session ${sessionId} is completed. Cannot update set.`);
    }

    const { data: currentSet, error: fetchError } = await this.supabase
      .from('session_sets')
      .select(`*`)
      .eq('id', setId)
      .eq('session_id', sessionId)
      .single();

    if (fetchError || !currentSet) {
      throw new Error('Session set not found.');
    }

    // Update session status if needed
    if (sessionData.status === 'PENDING') {
      const { error: updateError } = await this.supabase
        .from('sessions')
        .update({ status: 'IN_PROGRESS', session_date: new Date().toISOString() })
        .eq('id', sessionId)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }
    }

    const updateData = getUpdateData(currentSet as SessionSetDto);

    const { data: updatedSet, error: updateError } = await this.supabase
      .from('session_sets')
      .update(updateData as SessionSetDto)
      .eq('id', setId)
      .eq('session_id', sessionId)
      .select(`*`)
      .single();

    if (updateError) {
      throw updateError;
    }

    return updatedSet as SessionSetDto;
  }

  /**
   * Handles errors related to session ownership, returning a formatted API error response.
   * @param {Error} error - The error to handle.
   * @returns {ApiErrorResponse | null} A formatted error response or null if the error is not applicable.
   */
  handleSessionOwnershipError(error: Error): ApiErrorResponse | null {
    const ownershipErrorMessages = [
      'Session not found or user does not have access',
      'Session set not found or user does not have access'
    ];

    if (ownershipErrorMessages.some(msg => error.message.includes(msg))) {
      return createErrorData(400, error.message, { type: 'ownership_verification_error' }, 'SESSION_OWNERSHIP_ERROR');
    }

    return null;
  }

  /**
   * Handles errors when a session is not found, returning a formatted API error response.
   * @param {Error} error - The error to handle.
   * @returns {ApiErrorResponse | null} A formatted error response or null if the error is not applicable.
   */
  handleSessionNotFoundError(error: Error): ApiErrorResponse | null {
    if (error.message.includes('Session not found') || error.message.includes('Session set not found')) {
      return createErrorData(404, error.message, { type: 'session_not_found_error' }, 'SESSION_NOT_FOUND_ERROR');
    }

    return null;
  }

  /**
   * Handles errors when a plan is not found, returning a formatted API error response.
   * @param {Error} error - The error to handle.
   * @returns {ApiErrorResponse | null} A formatted error response or null if the error is not applicable.
   */
  handlePlanNotFoundError(error: Error): ApiErrorResponse | null {
    if (error.message.includes('Plan not found')) {
      return createErrorData(400, 'Plan not found.', { type: 'plan_not_found_error' }, 'PLAN_NOT_FOUND_ERROR');
    }

    return null;
  }

  /**
   * Handles errors during session completion, returning a formatted API error response.
   * @param {Error} error - The error to handle.
   * @returns {ApiErrorResponse | null} A formatted error response or null if the error is not applicable.
   */
  handleSessionCompletionError(error: Error): ApiErrorResponse | null {
    if (error.message.includes('Session cannot be completed')) {
      return createErrorDataWithLogging(400, error.message, { type: 'session_completion_error' }, 'SESSION_COMPLETION_ERROR', error);
    }

    return null;
  }

  /**
   * Handles errors when a required plan is missing, returning a formatted API error response.
   * @param {Error} error - The error to handle.
   * @returns {ApiErrorResponse | null} A formatted error response or null if the error is not applicable.
   */
  handlePlanMissingError(error: Error): ApiErrorResponse | null {
    if (error.message.includes('Plan ID missing')) {
      return createErrorDataWithLogging(500, 'Plan ID missing from the session. Cannot calculate progressions.', { type: 'plan_missing_error' }, 'PLAN_MISSING_ERROR', error);
    }

    return null;
  }

  private async verifySessionOwnership(sessionId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', this.getUserId())
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('Session not found or user does not have access');
    }
  }
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@txg/shared';
import type {
  SessionDto,
  CreateSessionCommand,
  UpdateSessionCommand,
  SessionSetDto,
  CreateSessionSetCommand,
  UpdateSessionSetCommand,
  ApiResult,
  PagingQueryOptions,
  SortingQueryOptions
} from '@txg/shared';
import { resolveExerciseProgressions } from '../services/exercise-progressions/exercise-progressions';
import { buildSessionSets, cancelOutstandingSessions, resolveNextPlanDayId } from '../services/session-creation/session-creation';
import {
  assertSessionCompletable,
  extractPlanProgressionContext,
  extractSessionSetContext,
  skipPendingSets
} from '../services/session-completion/session-completion';
import type { PlanDayWithProgressionsRow, SessionSetWithExerciseRow } from '../services/session-completion/session-completion';
import { createEntityInCollection, updateEntityInCollection, deleteEntityFromCollection } from '../utils/supabase';
import { ConflictError, DataIntegrityError, NotFoundError } from '../utils/errors';

export interface SessionQueryOptions extends PagingQueryOptions, SortingQueryOptions {
  status?: SessionDto['status'][];
  date_from?: string;
  date_to?: string;
  plan_id?: string;
}

export type SessionListResult = ApiResult<SessionDto[]>;

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

    supabaseQuery = supabaseQuery
      .order('plan_exercise_id', { referencedTable: 'sets', ascending: true })
      .order('set_index', { referencedTable: 'sets', ascending: true });

    if (options.limit !== undefined && options.offset !== undefined) {
      supabaseQuery = supabaseQuery.range(options.offset, options.offset + options.limit - 1);
    } else if (options.limit !== undefined) {
      supabaseQuery = supabaseQuery.limit(options.limit);
    }

    const { data, count, error } = await supabaseQuery;

    if (error) {
      throw error;
    }

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
      .order('plan_exercise_id', { referencedTable: 'sets', ascending: true })
      .order('set_index', { referencedTable: 'sets', ascending: true })
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

    // Step 1: Fetch the plan and its days.
    //
    // The embeds are not `!inner`: that dropped any day whose exercises had no sets, so a day that
    // later lost its sets vanished from the rotation. If it happened to be the most recently
    // completed one, `resolveNextPlanDayId` could no longer find it and threw; and a plan with days
    // but no sets anywhere came back as "Plan not found", which is simply wrong. Days are now
    // fetched as they are, and the empty-plan case is reported for what it is.
    const { data: plan, error: planError } = await this.supabase
      .from('plans')
      .select(`
        days:plan_days(
          id,
          order_index,
          exercises:plan_exercises(
            sets:plan_exercise_sets(
              *
            )
          )
        )
      `)
      .eq('user_id', userId)
      .eq('id', command.plan_id as string)
      .single();

    if (planError || !plan) {
      throw new NotFoundError('Plan not found.', 'PLAN_NOT_FOUND', 'plan_not_found_error');
    }

    if (!plan.days?.length) {
      throw new ConflictError(
        'This plan has no training days yet. Add a day before starting a session.',
        'PLAN_HAS_NO_DAYS',
        'plan_has_no_days_error'
      );
    }

    // Step 2: Fetch the sessions that matter, in two queries with different needs.
    //
    // Outstanding sessions are fetched without a limit: every one of them has to be cancelled to
    // preserve the "only one open session" invariant, and they cannot be ordered by session_date
    // because PENDING sessions have none. A single `.limit(10)` ordered by session_date served both
    // purposes before, which let outstanding sessions past the tenth row escape cancellation
    // entirely - the query meant to maintain the invariant could silently break it.
    const { data: outstandingSessions, error: outstandingError } = await this.supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_id', command.plan_id as string)
      .in('status', ['PENDING', 'IN_PROGRESS']);

    if (outstandingError) {
      throw outstandingError;
    }

    // Only the most recent completed session decides which day comes next.
    const { data: lastCompletedSessions, error: completedError } = await this.supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_id', command.plan_id as string)
      .eq('status', 'COMPLETED')
      .not('session_date', 'is', null)
      .order('session_date', { ascending: false })
      .limit(1);

    if (completedError) {
      throw completedError;
    }

    const sessions = [...(outstandingSessions ?? []), ...(lastCompletedSessions ?? [])];

    const currentDayId = resolveNextPlanDayId(plan.days, sessions, command.plan_day_id);

    const currentDay = plan.days.find(d => d.id === currentDayId);
    if (!currentDay) {
      throw new NotFoundError('Plan day not found in the specified plan.', 'PLAN_DAY_NOT_FOUND', 'plan_day_not_found_error');
    }

    // Step 3: Build records to upsert
    const newSessionId = crypto.randomUUID();
    const recordsToUpsert: SessionDto[] = [
      ...cancelOutstandingSessions(outstandingSessions ?? []),
      {
        id: newSessionId,
        user_id: userId,
        plan_id: command.plan_id,
        plan_day_id: currentDayId,
        status: 'PENDING',
        session_date: null,
        notes: null
      }
    ];

    const newSessionSets = buildSessionSets(currentDay, newSessionId);

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

    assertSessionCompletable(existingSession);

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

    const { sessionSets, exerciseIds } = extractSessionSetContext(setData as unknown as SessionSetWithExerciseRow[]);

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
    const { planExercises, planExerciseProgressions } = extractPlanProgressionContext(
      planData as unknown as PlanDayWithProgressionsRow[]
    );

    const { exerciseSetsToUpdate, exerciseProgressionsToUpdate } = resolveExerciseProgressions(
      sessionSets,
      planExercises,
      planExerciseProgressions
    );

    // Step 4: Fetch full session and update all data in a single atomic transaction
    const sessionSetsToUpdate = skipPendingSets(sessionSets);

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
      (s: SessionSetDto, newIndex: number) => ({ ...s, set_index: newIndex }),
      { column: 'session_id', id: sessionId }
    );

    const createdSet = updatedSets.find((s: SessionSetDto) => s.id === newSetId);
    if (!createdSet) {
      throw new DataIntegrityError('Failed to create session set.');
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
      (s: SessionSetDto, newIdx: number) => ({ ...s, set_index: newIdx }),
      { column: 'session_id', id: sessionId }
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
      (s: SessionSetDto, newIdx: number) => ({ ...s, set_index: newIdx }),
      { column: 'session_id', id: sessionId }
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
      throw new NotFoundError('Session not found.', 'SESSION_NOT_FOUND', 'session_not_found_error');
    }

    if (sessionData.status === 'COMPLETED') {
      throw new ConflictError(`Session ${sessionId} is completed. Cannot update set.`, 'SESSION_COMPLETED', 'session_completed_error');
    }

    const { data: currentSet, error: fetchError } = await this.supabase
      .from('session_sets')
      .select(`*`)
      .eq('id', setId)
      .eq('session_id', sessionId)
      .single();

    if (fetchError || !currentSet) {
      throw new NotFoundError('Session set not found.', 'SESSION_SET_NOT_FOUND', 'session_set_not_found_error');
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
      throw new NotFoundError('Session not found.', 'SESSION_NOT_FOUND', 'session_not_found_error');
    }
  }
}

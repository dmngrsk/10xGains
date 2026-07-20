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
  extractPlanExercises,
  extractSessionSetContext,
  skipPendingSets
} from '../services/session-completion/session-completion';
import type { PlanDayWithExercisesRow, SessionSetWithExerciseRow } from '../services/session-completion/session-completion';
import { createEntityInCollection, updateEntityInCollection, deleteEntityFromCollection } from '../utils/supabase';
import type { CollectionConfig } from '../utils/supabase';
import { ConflictError, DataIntegrityError, NotFoundError } from '../utils/errors';

/**
 * The statuses a session may be moved *out of*.
 *
 * COMPLETED and CANCELLED are terminal: a completed session has already applied its weight
 * progressions, and a cancelled one was superseded by a newer session. Reopening either would
 * put it back in a state the completion pipeline accepts.
 */
const TRANSITIONABLE_SESSION_STATUSES = ['PENDING', 'IN_PROGRESS'] as const satisfies readonly SessionDto['status'][];

/**
 * How many times a session creation may be re-attempted after losing a race.
 *
 * Each attempt that loses has already been beaten by one that won, so the invariant holds either
 * way; the retry exists so the loser still ends up with a session rather than an error. Two is
 * enough for the realistic case of a double submit - beyond that, something is wrong that
 * retrying will not fix.
 */
const CREATE_SESSION_ATTEMPTS = 2;

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

    // `optionalSort` has already validated both halves against this endpoint's whitelist and
    // applied its default, so there is no unsorted case to fall back on. The fallback that used to
    // sit here defaulted to descending while the handler defaults to ascending, which made it look
    // as though the two disagreed.
    const [sortColumn, sortDirection] = options.sort.split('.');
    supabaseQuery = supabaseQuery.order(sortColumn, { ascending: sortDirection === 'asc' });

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
    // A create that lands concurrently for the same plan invalidates everything this one decided
    // from its own read - which plan day comes next, which sessions to cancel - so `create_session`
    // refuses the write instead of applying stale decisions. Retrying re-reads the world the winner
    // left behind and produces what the two calls would have produced had they arrived in sequence:
    // the second cancels the first's session and opens its own.
    for (let attempt = 1; attempt <= CREATE_SESSION_ATTEMPTS; attempt++) {
      try {
        return await this.attemptCreate(command);
      } catch (error) {
        const isLastAttempt = attempt === CREATE_SESSION_ATTEMPTS;
        if (isLastAttempt || !(error instanceof Error) || !error.message.includes('SESSION_CREATE_CONFLICT')) {
          throw error;
        }
      }
    }

    // Unreachable: the loop either returns or rethrows on its final attempt.
    throw new Error('Failed to create a training session.');
  }

  /**
   * Performs one attempt at creating a session.
   *
   * @param {CreateSessionCommand} command - The command containing the details for the new session.
   * @returns {Promise<SessionDto>} A promise that resolves to the newly created session.
   * @throws {Error} Carrying SESSION_CREATE_CONFLICT if a concurrent create invalidated this one.
   */
  private async attemptCreate(command: CreateSessionCommand): Promise<SessionDto> {
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

    // Applied through `create_session` rather than the batch RPC directly: it serialises on the
    // user and plan, and re-checks that the outstanding sessions read above are still the whole
    // set. Anything else means a concurrent create got there first and the day chosen and the
    // cancellations built here no longer describe reality.
    const { error: batchError } = await this.supabase.rpc('create_session', {
      p_plan_id: command.plan_id as string,
      p_outstanding_session_ids: (outstandingSessions ?? []).map(session => session.id),
      p_operations: batchOperations.filter(op => op.records.length > 0) as Json
    });

    if (batchError) {
      throw new Error(batchError.message);
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
   * @throws {ConflictError} If the command changes the status of a session that has already finished.
   */
  async update(sessionId: string, command: UpdateSessionCommand): Promise<SessionDto | null> {
    await this.verifySessionOwnership(sessionId);

    let query = this.supabase
      .from('sessions')
      .update(command)
      .eq('id', sessionId)
      .eq('user_id', this.getUserId());

    // A status change is legal only out of a status that has not finished yet, and the predicate
    // has to be part of the write: checking first and updating after leaves a window where a
    // concurrent complete lands in between. The handler already refuses COMPLETED as a *target*,
    // but without this a COMPLETED session could be moved back to IN_PROGRESS and completed
    // again, applying its weight progressions and deloads a second time.
    //
    // Only a status change is restricted. Notes stay editable on a finished session, which is
    // how the history page annotates past workouts.
    if (command.status) {
      query = query.in('status', TRANSITIONABLE_SESSION_STATUSES);
    }

    const { data, error } = await query.select().single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Ownership is already verified, so no matching row means the status predicate rejected
        // the transition rather than the session being missing.
        if (command.status) {
          throw new ConflictError(
            'Session status cannot be changed once the session has finished.',
            'SESSION_NOT_TRANSITIONABLE',
            'session_transition_error'
          );
        }
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
          )
        )
      `)
      .eq('plan_id', existingSession.plan_id)
      .in('exercises.exercise_id', exerciseIds);

    if (planDataError) {
      throw planDataError;
    }

    // Progressions are keyed by (plan_id, exercise_id) and must be read scoped to this session's
    // plan. Reaching them through the global exercise instead returns a row per plan that trains
    // it, and the caller keys them by exercise_id alone - an arbitrary plan's rules would win and
    // then be written back onto that plan's row.
    const { data: progressionData, error: progressionError } = await this.supabase
      .from('plan_exercise_progressions')
      .select('*')
      .eq('plan_id', existingSession.plan_id)
      .in('exercise_id', exerciseIds);

    if (progressionError) {
      throw progressionError;
    }

    // Step 3: Recalculate weight and progression rules for each exercise
    const planExercises = extractPlanExercises(planData as unknown as PlanDayWithExercisesRow[]);
    const planExerciseProgressions = progressionData ?? [];

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

    // Applied through `complete_session` rather than the batch RPC directly: it re-takes the
    // session row lock and re-checks the status inside the transaction. Everything above - the
    // status assertion, the progression maths - happened outside any lock, so a competing
    // completion could have finished the session in the meantime and would otherwise have its
    // progressions applied a second time.
    const { error: batchError } = await this.supabase.rpc('complete_session', {
      p_session_id: sessionId,
      p_operations: batchOperations.filter(op => op.records.length > 0) as Json
    });

    if (batchError) {
      throw this.toCompleteSessionError(batchError.message);
    }

    return completedSession as SessionDto;
  }

  /**
   * Translates the sentinel conditions raised by `complete_session` into domain errors.
   *
   * The function signals its outcomes with fixed sentinel messages rather than prose, so the
   * mapping here does not depend on wording that might be reworded later.
   *
   * @param {string} message - The message from the Postgres error.
   * @returns {Error} The domain error to throw, or the original condition if it is unrecognised.
   */
  private toCompleteSessionError(message: string): Error {
    if (message.includes('SESSION_NOT_FOUND')) {
      return new NotFoundError('Session not found.', 'SESSION_NOT_FOUND', 'session_not_found_error');
    }

    // Raised when a concurrent request completed the session first. The status was IN_PROGRESS
    // when this request checked it, so the same condition maps to the same conflict the
    // pre-flight assertion would have produced.
    if (message.includes('SESSION_NOT_IN_PROGRESS')) {
      return new ConflictError(
        'Session cannot be completed. Current status: COMPLETED. Expected: IN_PROGRESS.',
        'SESSION_NOT_COMPLETABLE',
        'session_completion_error'
      );
    }

    return new Error(message);
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

    const updatedSets = await createEntityInCollection(this.supabase, this.sessionSetCollection(sessionId, command.plan_exercise_id), newSetData);

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

    const updatedSets = await updateEntityInCollection(this.supabase, this.sessionSetCollection(sessionId, existingSet.plan_exercise_id), updatedSetData);

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

    await deleteEntityFromCollection(this.supabase, this.sessionSetCollection(sessionId, existingSet.plan_exercise_id), setId);

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
    // The caller derives the new values from the current set (completing one records its expected
    // reps as actual), so the set still has to be read first. Only immutable-during-a-session
    // fields are used for that, so reading outside the transaction is safe; everything that
    // actually decides the outcome - the session's status, the promotion to IN_PROGRESS and the
    // write itself - happens inside `patch_session_set` under a lock on the session row.
    const currentSet = await this.findSetById(sessionId, setId);

    if (!currentSet) {
      throw new NotFoundError('Session set not found.', 'SESSION_SET_NOT_FOUND', 'session_set_not_found_error');
    }

    const updateData = getUpdateData(currentSet);

    const { data: updatedSet, error: updateError } = await this.supabase
      .rpc('patch_session_set', {
        p_session_id: sessionId,
        p_set_id: setId,
        p_updates: updateData as Json
      })
      .single();

    if (updateError) {
      throw this.toPatchSetError(updateError.message, sessionId);
    }

    return updatedSet as SessionSetDto;
  }

  /**
   * Translates the sentinel conditions raised by `patch_session_set` into domain errors.
   *
   * The function signals its outcomes with fixed sentinel messages rather than prose, so the
   * mapping here does not depend on wording that might be reworded later.
   *
   * @param {string} message - The message from the Postgres error.
   * @param {string} sessionId - The session being patched, for the conflict message.
   * @returns {Error} The domain error to throw, or the original condition if it is unrecognised.
   */
  private toPatchSetError(message: string, sessionId: string): Error {
    if (message.includes('SESSION_SET_NOT_FOUND')) {
      return new NotFoundError('Session set not found.', 'SESSION_SET_NOT_FOUND', 'session_set_not_found_error');
    }

    if (message.includes('SESSION_NOT_FOUND')) {
      return new NotFoundError('Session not found.', 'SESSION_NOT_FOUND', 'session_not_found_error');
    }

    if (message.includes('SESSION_COMPLETED')) {
      return new ConflictError(`Session ${sessionId} is completed. Cannot update set.`, 'SESSION_COMPLETED', 'session_completed_error');
    }

    return new Error(message);
  }

  /**
   * The ordered collection of one session's sets for one plan exercise.
   *
   * The session scope is essential rather than optional: `plan_exercise_id` alone is shared by every
   * session ever trained from the same plan day, so without it the collection would span - and
   * renumber, and delete from - historical sessions.
   *
   * @param {string} sessionId - The session the sets belong to.
   * @param {string} planExerciseId - The plan exercise the sets belong to.
   * @returns {CollectionConfig<SessionSetDto>} The collection descriptor.
   */
  private sessionSetCollection(sessionId: string, planExerciseId: string): CollectionConfig<SessionSetDto> {
    return {
      table: 'session_sets',
      parentColumn: 'plan_exercise_id',
      parentId: planExerciseId,
      orderColumn: 'set_index',
      getId: (s) => s.id,
      getOrder: (s) => s.set_index,
      setOrder: (s, index) => ({ ...s, set_index: index }),
      scope: { column: 'session_id', id: sessionId },
    };
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

import type { SupabaseClient } from 'supabase';
import type { Database } from '../models/database-types.ts';
import type {
  TrainingSessionDto,
  CreateTrainingSessionCommand,
  UpdateTrainingSessionCommand,
  SessionSetDto,
  CreateSessionSetCommand,
  UpdateSessionSetCommand,
  TrainingPlanExerciseDto,
  TrainingPlanExerciseProgressionDto
} from '../models/api-types.ts';
import { ApiErrorResponse, createErrorData, createErrorDataWithLogging } from "../utils/api-helpers.ts";
import { resolveExerciseProgressions } from '../services/exercise-progressions/exercise-progressions.ts';
import { insertAndNormalizeOrder } from '../services/index-order/index-order.ts';

export interface TrainingSessionQueryOptions {
  limit: number;
  offset: number;
  sort: string;
  status?: TrainingSessionDto['status'][];
  date_from?: string;
  date_to?: string;
  plan_id?: string;
}

export interface TrainingSessionListResult {
  data: TrainingSessionDto[];
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
   * @param {TrainingSessionQueryOptions} options - The query options for filtering and pagination.
   * @returns {Promise<TrainingSessionListResult>} A promise that resolves to a list of sessions and the total count.
   */
  async findAll(options: TrainingSessionQueryOptions): Promise<TrainingSessionListResult> {
    let supabaseQuery = this.supabase
      .from('training_sessions')
      .select('*, sets:session_sets!session_sets_training_session_id_fkey(*)', { count: 'exact' })
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
      supabaseQuery = supabaseQuery.eq('training_plan_id', options.plan_id);
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

    // Sort session sets within each session
    data?.forEach((session: TrainingSessionDto) =>
      session.sets?.sort((a: SessionSetDto, b: SessionSetDto) =>
        a.training_plan_exercise_id.localeCompare(b.training_plan_exercise_id) ||
        a.set_index - b.set_index
      )
    );

    return {
      data: data as TrainingSessionDto[] || [],
      totalCount: count ?? 0
    };
  }

  /**
   * Finds a single training session by its ID.
   *
   * @param {string} sessionId - The ID of the session to find.
   * @returns {Promise<TrainingSessionDto | null>} A promise that resolves to the session or null if not found.
   */
  async findById(sessionId: string): Promise<TrainingSessionDto | null> {
    const { data, error } = await this.supabase
      .from('training_sessions')
      .select('*, sets:session_sets!session_sets_training_session_id_fkey(*)')
      .eq('id', sessionId)
      .eq('user_id', this.getUserId())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw error;
    }

    if (data.sets) {
      data.sets.sort((a: SessionSetDto, b: SessionSetDto) =>
        a.training_plan_exercise_id.localeCompare(b.training_plan_exercise_id) ||
        a.set_index - b.set_index
      );
    }

    return data as TrainingSessionDto;
  }

  /**
   * Creates a new training session based on a training plan.
   *
   * It determines the next day to train and cancels any pending or in-progress sessions
   * before creating the new one.
   *
   * @param {CreateTrainingSessionCommand} command - The command containing the details for the new session.
   * @returns {Promise<TrainingSessionDto>} A promise that resolves to the newly created session.
   */
  async create(command: CreateTrainingSessionCommand): Promise<TrainingSessionDto> {
    const userId = this.getUserId();

    // Step 1: Fetch the training plan and its days
    const { data: plan, error: planError } = await this.supabase
      .from('training_plans')
      .select(`
        days:training_plan_days!inner(
          id,
          order_index,
          exercises:training_plan_exercises!inner(
            sets:training_plan_exercise_sets!inner(
              *
            )
          )
        )
      `)
      .eq('user_id', userId)
      .eq('id', command.training_plan_id as string)
      .single();

    if (planError || !plan) {
      throw new Error('Training plan not found.');
    }

    const dayIds = plan.days.sort((a, b) => a.order_index - b.order_index).map(d => d.id);

    // Step 2: Fetch existing sessions to determine next day
    const { data: sessions, error: sessionsError } = await this.supabase
      .from('training_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('training_plan_id', command.training_plan_id as string)
      .in('status', ['COMPLETED', 'PENDING', 'IN_PROGRESS'])
      .order('session_date', { ascending: false })
      .limit(10);

    if (sessionsError) {
      throw sessionsError;
    }

    let currentDayId = command.training_plan_day_id;
    if (!currentDayId) {
      const latestCompletedSession = sessions!
        .filter(s => !!s.session_date)
        .sort((a, b) => new Date(b.session_date!).getTime() - new Date(a.session_date!).getTime())
        .find(s => s.status === 'COMPLETED');

      if (latestCompletedSession) {
        const dayIndex = dayIds.indexOf(latestCompletedSession.training_plan_day_id!);
        if (dayIndex !== -1) {
          currentDayId = dayIds[(dayIndex + 1) % dayIds.length];
        } else {
          throw new Error('Failed to identify next day for training plan');
        }
      } else if (!currentDayId) {
        currentDayId = dayIds[0];
      }
    }

    // Step 3: Build records to upsert
    const recordsToUpsert: TrainingSessionDto[] = [];
    const sessionsInProgress = sessions!.filter(s => s.status === 'IN_PROGRESS' || s.status === 'PENDING');

    if (sessionsInProgress && sessionsInProgress.length > 0) {
      sessionsInProgress.forEach(s => {
        recordsToUpsert.push({
           ...s,
           training_plan_day_id: s.training_plan_day_id!,
           status: 'CANCELLED',
        });
      });
    }

    const newSessionId = crypto.randomUUID();
    recordsToUpsert.push({
      id: newSessionId,
      user_id: userId,
      training_plan_id: command.training_plan_id,
      training_plan_day_id: currentDayId,
      status: 'PENDING',
      session_date: null
    });

    const newSessionSets = plan.days
      .find(d => d.id === currentDayId)!.exercises
      .flatMap(e => (e.sets))
      .map((tpes) => ({
        id: crypto.randomUUID(),
        training_session_id: newSessionId,
        training_plan_exercise_id: tpes.training_plan_exercise_id,
        set_index: tpes.set_index,
        expected_reps: tpes.expected_reps,
        actual_reps: null,
        actual_weight: tpes.expected_weight,
        status: 'PENDING',
        completed_at: null
      })) as SessionSetDto[];

    // Step 4: Upsert session and sets (TODO: Use transaction)
    const { data: upsertedSessions, error: upsertError } = await this.supabase
      .from('training_sessions')
      .upsert(recordsToUpsert, { onConflict: 'id' })
      .select();

    if (upsertError || !upsertedSessions || upsertedSessions.length === 0) {
      throw upsertError || new Error('Failed to save training sessions');
    }

    const { error: upsertSessionSetsError } = await this.supabase
      .from('session_sets')
      .insert(newSessionSets)
      .select();

    if (upsertSessionSetsError) {
      throw upsertSessionSetsError;
    }

    const newlyCreatedSession = {
      ...upsertedSessions.find(s => s.id === newSessionId),
      sets: newSessionSets
    };

    if (!newlyCreatedSession) {
      throw new Error('Failed to identify newly created session after save.');
    }

    return newlyCreatedSession as TrainingSessionDto;
  }

  /**
   * Updates an existing training session.
   *
   * @param {string} sessionId - The ID of the session to update.
   * @param {UpdateTrainingSessionCommand} command - The command with the updated data.
   * @returns {Promise<TrainingSessionDto | null>} A promise that resolves to the updated session or null if not found.
   */
  async update(sessionId: string, command: UpdateTrainingSessionCommand): Promise<TrainingSessionDto | null> {
    await this.verifySessionOwnership(sessionId);

    const { data, error } = await this.supabase
      .from('training_sessions')
      .update(command)
      .eq('id', sessionId)
      .eq('user_id', this.getUserId())
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw error;
    }

    return data as TrainingSessionDto;
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
      .from('training_sessions')
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
   * in the completed session and updates the training plan accordingly.
   *
   * @param {string} sessionId - The ID of the session to complete.
   * @returns {Promise<TrainingSessionDto | null>} A promise that resolves to the completed session.
   */
  async complete(sessionId: string): Promise<TrainingSessionDto | null> {
    const userId = this.getUserId();

    // Step 1: Fetch the training session
    const { data: existingSession, error: fetchSessionError } = await this.supabase
      .from('training_sessions')
      .select('id, training_plan_id, status, user_id')
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

    if (!existingSession.training_plan_id) {
      throw new Error('Training plan ID missing from the session. Cannot calculate progressions.');
    }

    // Step 2: Fetch all session sets and associated training plan exercise data
    const { data: setData, error: sessionSetsError } = await this.supabase
      .from('session_sets')
      .select(`
        *,
        plan_exercises:training_plan_exercises!training_plan_exercise_id (
          exercises:exercises!exercise_id (
            *
          )
        )
      `)
      .eq('training_session_id', sessionId);

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
      .from('training_plan_days')
      .select(`
        exercises:training_plan_exercises!inner (
          *,
          sets:training_plan_exercise_sets!inner (
            *
          ),
          global_exercises:exercises!exercise_id!inner (
            progression:training_plan_exercise_progressions!exercise_id (
              *
            )
          )
        )
      `)
      .eq('training_plan_id', existingSession.training_plan_id)
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
    ] as TrainingPlanExerciseDto[];

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
    ] as TrainingPlanExerciseProgressionDto[];

    const { exerciseSetsToUpdate, exerciseProgressionsToUpdate } = resolveExerciseProgressions(
      sessionSets,
      planExercises,
      planExerciseProgressions
    );

    // Step 4: Update data (TODO: Use transaction)
    if (exerciseSetsToUpdate.length > 0) {
      const { error: upsertSetsError } = await this.supabase
        .from('training_plan_exercise_sets')
        .upsert(exerciseSetsToUpdate, { onConflict: 'id' });

      if (upsertSetsError) {
        throw upsertSetsError;
      }
    }

    if (exerciseProgressionsToUpdate.length > 0) {
      const { error: upsertProgressionsError } = await this.supabase
        .from('training_plan_exercise_progressions')
        .upsert(exerciseProgressionsToUpdate, { onConflict: 'id' });

      if (upsertProgressionsError) {
        throw upsertProgressionsError;
      }
    }

    if (sessionSets.filter(ss => ss.status === 'PENDING').length > 0) {
      const { error: updatePendingSetsError } = await this.supabase
        .from('session_sets')
        .update({ status: 'SKIPPED' })
        .eq('training_session_id', sessionId)
        .eq('status', 'PENDING');

      if (updatePendingSetsError) {
        throw updatePendingSetsError;
      }
    }

    const { data: updatedSessionEntry, error: updateSessionError } = await this.supabase
      .from('training_sessions')
      .update({ status: 'COMPLETED' })
      .eq('id', sessionId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (updateSessionError) {
      if (updateSessionError.code === 'PGRST116') {
        return null;
      }
      throw updateSessionError;
    }

    return updatedSessionEntry as TrainingSessionDto;
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
      .eq('training_session_id', sessionId)
      .order('training_plan_exercise_id', { ascending: true })
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
      .eq('training_session_id', sessionId)
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

    const { data: allCurrentSetsForExerciseDb, error: allSetsError } = await this.supabase
      .from('session_sets')
      .select('*')
      .eq('training_session_id', sessionId)
      .eq('training_plan_exercise_id', command.training_plan_exercise_id)
      .order('set_index', { ascending: true });

    if (allSetsError) {
      throw allSetsError;
    }

    const allCurrentSetsForExercise: SessionSetDto[] = (allCurrentSetsForExerciseDb || []) as SessionSetDto[];

    const newSetId = crypto.randomUUID();
    const newSetForNormalization: SessionSetDto = {
      id: newSetId,
      training_session_id: sessionId,
      training_plan_exercise_id: command.training_plan_exercise_id,
      set_index: command.set_index,
      expected_reps: command.expected_reps,
      actual_reps: command.actual_reps,
      actual_weight: command.actual_weight,
      status: command.status || 'PENDING',
      completed_at: command.completed_at || null,
    } as SessionSetDto;

    const normalizedSets = insertAndNormalizeOrder<SessionSetDto>(
      allCurrentSetsForExercise,
      newSetForNormalization,
      (s: SessionSetDto) => s.id,
      (s: SessionSetDto) => s.set_index,
      (s: SessionSetDto, newIndex: number) => ({ ...s, set_index: newIndex })
    );

    const setsToUpsertInDb = normalizedSets.map((s: SessionSetDto) => {
      const { id, ...dataToUpsert } = s;
      return { id, ...dataToUpsert };
    });

    const { data: upsertedSets, error: upsertError } = await this.supabase
      .from('session_sets')
      .upsert(setsToUpsertInDb, { onConflict: 'id' })
      .select();

    if (upsertError) {
      throw upsertError;
    }

    return upsertedSets?.find((s: SessionSetDto) => s.id === newSetId) as SessionSetDto;
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
      .eq('training_session_id', sessionId)
      .maybeSingle();

    if (existingSetError) {
      throw existingSetError;
    }

    if (!existingSet) {
      return null;
    }

    const setToUpdatePlanExerciseId = existingSet.training_plan_exercise_id;

    const { data: allCurrentSetsForExerciseDb, error: allSetsError } = await this.supabase
      .from('session_sets')
      .select('*')
      .eq('training_session_id', sessionId)
      .eq('training_plan_exercise_id', setToUpdatePlanExerciseId)
      .order('set_index', { ascending: true });

    if (allSetsError) {
      throw allSetsError;
    }

    const allCurrentSetsForExercise: SessionSetDto[] = (allCurrentSetsForExerciseDb || []) as SessionSetDto[];

    const updatedSetData: SessionSetDto = {
      ...existingSet,
      ...command,
      set_index: command.set_index !== undefined ? command.set_index : existingSet.set_index,
      status: command.status !== undefined ? command.status : existingSet.status,
      completed_at: command.completed_at !== undefined ? command.completed_at : existingSet.completed_at,
    };

    const normalizedSets = insertAndNormalizeOrder<SessionSetDto>(
      allCurrentSetsForExercise,
      updatedSetData,
      (s: SessionSetDto) => s.id,
      (s: SessionSetDto) => s.set_index,
      (s: SessionSetDto, newIdx: number) => ({ ...s, set_index: newIdx })
    );

    const setsToUpsertInDb = normalizedSets.map((s: SessionSetDto) => {
      const { id, ...dataToUpsert } = s;
      return { id, ...dataToUpsert };
    });

    const { data: upsertedSets, error: upsertError } = await this.supabase
      .from('session_sets')
      .upsert(setsToUpsertInDb, { onConflict: 'id' })
      .select();

    if (upsertError) {
      throw upsertError;
    }

    return upsertedSets?.find(s => s.id === setId) as SessionSetDto;
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
      .eq('training_session_id', sessionId)
      .maybeSingle();

    if (existingSetError) {
      throw existingSetError;
    }

    if (!existingSet) {
      return false;
    }

    const setToUpdatePlanExerciseId = existingSet.training_plan_exercise_id;

    const { data: allCurrentSetsForExerciseDb, error: allSetsError } = await this.supabase
      .from('session_sets')
      .select('*')
      .eq('training_session_id', sessionId)
      .eq('training_plan_exercise_id', setToUpdatePlanExerciseId)
      .order('set_index', { ascending: true });

    if (allSetsError) {
      throw allSetsError;
    }

    const allCurrentSetsForExercise: SessionSetDto[] = (allCurrentSetsForExerciseDb.filter(s => s.id !== setId) || []) as SessionSetDto[];

    const normalizedSets = insertAndNormalizeOrder<SessionSetDto>(
      allCurrentSetsForExercise,
      null,
      (s: SessionSetDto) => s.id,
      (s: SessionSetDto) => s.set_index,
      (s: SessionSetDto, newIdx: number) => ({ ...s, set_index: newIdx })
    );

    const setsToUpsertInDb = normalizedSets.map((s: SessionSetDto) => {
      const { id, ...dataToUpsert } = s;
      return { id, ...dataToUpsert };
    });

    // TODO: Use transaction
    const { error: deleteError } = await this.supabase
      .from('session_sets')
      .delete()
      .eq('id', setId);

    if (deleteError) {
      throw deleteError;
    }

    const { error: upsertError } = await this.supabase
      .from('session_sets')
      .upsert(setsToUpsertInDb, { onConflict: 'id' })
      .select();

    if (upsertError) {
      throw upsertError;
    }

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
      .from('training_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', this.getUserId())
      .single();

    if (sessionError || !sessionData) {
      throw new Error('Training session not found.');
    }

    if (sessionData.status === 'COMPLETED') {
      throw new Error(`Training session ${sessionId} is completed. Cannot update set.`);
    }

    const { data: currentSet, error: fetchError } = await this.supabase
      .from('session_sets')
      .select(`*`)
      .eq('id', setId)
      .eq('training_session_id', sessionId)
      .single();

    if (fetchError || !currentSet) {
      throw new Error('Training session set not found.');
    }

    // Update session status if needed
    if (sessionData.status === 'PENDING') {
      const { error: updateError } = await this.supabase
        .from('training_sessions')
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
      .eq('training_session_id', sessionId)
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
      'Training session not found or user does not have access',
      'Training session set not found or user does not have access'
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
    if (error.message.includes('Training session not found') || error.message.includes('Training session set not found')) {
      return createErrorData(404, error.message, { type: 'session_not_found_error' }, 'SESSION_NOT_FOUND_ERROR');
    }

    return null;
  }

  /**
   * Handles errors when a training plan is not found, returning a formatted API error response.
   * @param {Error} error - The error to handle.
   * @returns {ApiErrorResponse | null} A formatted error response or null if the error is not applicable.
   */
  handleTrainingPlanNotFoundError(error: Error): ApiErrorResponse | null {
    if (error.message.includes('Training plan not found')) {
      return createErrorData(400, 'Training plan not found.', { type: 'training_plan_not_found_error' }, 'TRAINING_PLAN_NOT_FOUND_ERROR');
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
   * Handles errors when a required training plan is missing, returning a formatted API error response.
   * @param {Error} error - The error to handle.
   * @returns {ApiErrorResponse | null} A formatted error response or null if the error is not applicable.
   */
  handleTrainingPlanMissingError(error: Error): ApiErrorResponse | null {
    if (error.message.includes('Training plan ID missing')) {
      return createErrorDataWithLogging(500, 'Training plan ID missing from the session. Cannot calculate progressions.', { type: 'training_plan_missing_error' }, 'TRAINING_PLAN_MISSING_ERROR', error);
    }

    return null;
  }

  private async verifySessionOwnership(sessionId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('training_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', this.getUserId())
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('Training session not found or user does not have access');
    }
  }
}

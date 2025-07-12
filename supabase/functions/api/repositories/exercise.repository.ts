import type { SupabaseClient } from 'supabase';
import type { Database } from '../models/database.types.ts';
import type {
  ExerciseDto,
  CreateExerciseCommand,
  UpdateExerciseCommand,
  ApiResult,
  PagingQueryOptions,
  SortingQueryOptions
} from '../models/api.types.ts';
import { ApiErrorResponse, createErrorData } from "../utils/api-helpers.ts";

export interface ExerciseQueryOptions extends PagingQueryOptions, SortingQueryOptions {}

export interface ExerciseListResult extends ApiResult<ExerciseDto[]> {}

export class ExerciseRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Finds all exercises with sorting and pagination.
   *
   * @param {ExerciseQueryOptions} options - Options for sorting and pagination.
   * @returns {Promise<ExerciseListResult>} A promise that resolves to the list of exercises and the total count.
   */
  async findAll(options: ExerciseQueryOptions): Promise<ExerciseListResult> {
    const [sortColumn, sortDirection] = options.sort.split('.');
    if (sortDirection !== 'asc' && sortDirection !== 'desc') {
      throw new Error('Invalid sort direction. Must be "asc" or "desc".');
    }

    const { data, count, error } = await this.supabase
      .from('exercises')
      .select('*', { count: 'exact' })
      .range(options.offset, options.offset + options.limit - 1)
      .order(sortColumn, { ascending: sortDirection === 'asc' });

    if (error) {
      throw error;
    }

    return {
      data: data as ExerciseDto[],
      totalCount: count ?? 0,
    };
  }

  /**
   * Finds a single exercise by its ID.
   *
   * @param {string} exerciseId - The ID of the exercise to find.
   * @returns {Promise<ExerciseDto | null>} A promise that resolves to the exercise or null if not found.
   */
  async findById(exerciseId: string): Promise<ExerciseDto | null> {
    const { data, error } = await this.supabase
      .from('exercises')
      .select('*')
      .eq('id', exerciseId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as ExerciseDto;
  }

  /**
   * Creates a new exercise.
   *
   * @param {CreateExerciseCommand} command - The command with the new exercise's data.
   * @returns {Promise<ExerciseDto>} A promise that resolves to the newly created exercise.
   */
  async create(command: CreateExerciseCommand): Promise<ExerciseDto> {
    const { data, error } = await this.supabase
      .from('exercises')
      .insert([command])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as ExerciseDto;
  }

  /**
   * Updates an exercise. (Currently disabled, requires admin role)
   *
   * @param {string} _exerciseId - The ID of the exercise to update.
   * @param {UpdateExerciseCommand} _command - The command with the updated data.
   * @returns {Promise<ExerciseDto | null>} A promise that resolves to the updated exercise.
   */
  async update(_exerciseId: string, _command: UpdateExerciseCommand): Promise<ExerciseDto | null> {
    // TODO: Add admin role check, disable for now
    await new Promise(resolve => setTimeout(resolve, 10));
    throw new Error('Forbidden: You cannot update this exercise');

    /*
    const { data, error } = await this.supabase
      .from('exercises')
      .update(command)
      .eq('id', exerciseId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as ExerciseDto;
    */
  }

  /**
   * Deletes an exercise. (Currently disabled, requires admin role)
   *
   * @param {string} _exerciseId - The ID of the exercise to delete.
   * @returns {Promise<boolean>} A promise that resolves to true if deletion was successful.
   */
  async delete(_exerciseId: string): Promise<boolean> {
    // TODO: Add admin role check, disable for now
    await new Promise(resolve => setTimeout(resolve, 10));
    throw new Error('Forbidden: You cannot delete this exercise');

    /*
    const { error } = await this.supabase
      .from('exercises')
      .delete()
      .eq('id', exerciseId);

    if (error) {
      throw error;
    }

    return true;
    */
  }

  /**
   * Handles exercise-specific errors, returning a formatted API error response.
   *
   * @param {Error} error - The error to handle.
   * @returns {ApiErrorResponse | null} A formatted error response or null if the error is not applicable.
   */
  handleExerciseError(error: Error): ApiErrorResponse | null {
    const errorMessages = [
      'Forbidden: You cannot update this exercise',
      'Forbidden: You cannot delete this exercise'
    ];

    if (errorMessages.some(msg => error.message.includes(msg))) {
      return createErrorData(
        403,
        error.message,
        { type: 'exercise_access_error' },
        'EXERCISE_ACCESS_ERROR'
      );
    }

    return null;
  }
}

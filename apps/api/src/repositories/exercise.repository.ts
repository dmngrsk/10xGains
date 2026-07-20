import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@txg/shared';
import type {
  ExerciseDto,
  CreateExerciseCommand,
  UpdateExerciseCommand,
  ApiResult,
  PagingQueryOptions,
  SortingQueryOptions
} from '@txg/shared';
import { ForbiddenError } from '../utils/errors';

export type ExerciseQueryOptions = PagingQueryOptions & SortingQueryOptions;

export type ExerciseListResult = ApiResult<ExerciseDto[]>;

export class ExerciseRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Finds all exercises with sorting and pagination.
   *
   * @param {ExerciseQueryOptions} options - Options for sorting and pagination.
   * @returns {Promise<ExerciseListResult>} A promise that resolves to the list of exercises and the total count.
   */
  async findAll(options: ExerciseQueryOptions): Promise<ExerciseListResult> {
    // `optionalSort` has already validated both halves against this endpoint's whitelist.
    const [sortColumn, sortDirection] = options.sort.split('.');

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
  update(_exerciseId: string, _command: UpdateExerciseCommand): Promise<ExerciseDto | null> {
    // The catalog is shared between all users, so editing an entry is an administrative action.
    // There is no admin role yet; RLS denies the update as well, so this is not the only guard.
    throw new ForbiddenError('You cannot update this exercise.', 'EXERCISE_FORBIDDEN', 'exercise_forbidden_error');
  }

  /**
   * Deletes an exercise. (Currently disabled, requires admin role)
   *
   * @param {string} _exerciseId - The ID of the exercise to delete.
   * @returns {Promise<boolean>} A promise that resolves to true if deletion was successful.
   */
  delete(_exerciseId: string): Promise<boolean> {
    // See `update`: removing a shared catalog entry is an administrative action, denied by RLS too.
    throw new ForbiddenError('You cannot delete this exercise.', 'EXERCISE_FORBIDDEN', 'exercise_forbidden_error');
  }

}

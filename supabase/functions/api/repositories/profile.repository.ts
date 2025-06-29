import type { SupabaseClient } from 'supabase';
import type { Database } from '../models/database.types.ts';
import type {
  ProfileDto,
  UpsertProfileCommand
} from '../models/api.types.ts';
import { ApiErrorResponse, createErrorData } from "../utils/api-helpers.ts";

export class ProfileRepository {
  constructor(
    private supabase: SupabaseClient<Database>,
    private getUserId: () => string
  ) {}

  /**
   * Finds a user profile by its ID, ensuring the requester can only access their own profile.
   *
   * @param {string} userId - The ID of the user profile to find.
   * @returns {Promise<ProfileDto | null>} A promise that resolves to the user profile or null if not found.
   * @throws {Error} If the user attempts to access another user's profile.
   */
  async findById(userId: string): Promise<ProfileDto | null> {
    if (userId !== this.getUserId()) {
      throw new Error('Forbidden: You can only access your own profile');
    }

    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as ProfileDto;
  }

  /**
   * Creates or updates a user profile, ensuring the user can only modify their own profile.
   *
   * @param {string} userId - The ID of the user profile to upsert.
   * @param {UpsertProfileCommand} command - The command with the profile data.
   * @returns {Promise<ProfileDto>} A promise that resolves to the created or updated user profile.
   * @throws {Error} If the user attempts to modify another user's profile.
   */
  async upsert(userId: string, command: UpsertProfileCommand): Promise<ProfileDto> {
    if (userId !== this.getUserId()) {
      throw new Error('Forbidden: You can only update your own profile');
    }

    const { data: existingProfile, error: existingProfileError } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (existingProfileError) {
      throw existingProfileError;
    }

    // Build the data to upsert with defaults
    const dataToUpsert: ProfileDto = {
      id: userId,
      first_name: command.first_name ?? existingProfile?.first_name ?? '',
      active_plan_id: command.active_plan_id !== undefined
        ? command.active_plan_id
        : existingProfile?.active_plan_id ?? null,
      ai_suggestions_remaining: existingProfile?.ai_suggestions_remaining ?? 0,
      created_at: existingProfile?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('profiles')
      .upsert(dataToUpsert, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as ProfileDto;
  }

  /**
   * Handles profile-specific errors, returning a formatted API error response.
   *
   * @param {Error} error - The error to handle.
   * @returns {ApiErrorResponse | null} A formatted error response or null if the error is not applicable.
   */
  handleProfileError(error: Error): ApiErrorResponse | null {
    if (error.message.includes('Forbidden: You can only access your own profile') ||
        error.message.includes('Forbidden: You can only update your own profile')) {
      return createErrorData(
        403,
        error.message,
        { type: 'profile_access_error' },
        'PROFILE_ACCESS_ERROR'
      );
    }

    return null;
  }
}

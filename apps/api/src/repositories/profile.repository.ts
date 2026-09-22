import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@txg/shared';
import type {
  ProfileDto,
  UpsertProfileCommand
} from '@txg/shared';
import { NotFoundError } from '../utils/errors';

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
   * @throws {NotFoundError} If the id is not the caller's own.
   */
  async findById(userId: string): Promise<ProfileDto | null> {
    if (userId !== this.getUserId()) {
      throw new NotFoundError('Profile not found.', 'PROFILE_NOT_FOUND', 'profile_not_found_error');
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
   * @throws {NotFoundError} If the id is not the caller's own.
   */
  async upsert(userId: string, command: UpsertProfileCommand): Promise<ProfileDto> {
    if (userId !== this.getUserId()) {
      throw new NotFoundError('Profile not found.', 'PROFILE_NOT_FOUND', 'profile_not_found_error');
    }

    const { data: existingProfile, error: existingProfileError } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (existingProfileError) {
      throw existingProfileError;
    }

    if (command.active_plan_id) {
      const { data: plan, error: planError } = await this.supabase
        .from('plans')
        .select('id')
        .eq('id', command.active_plan_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (planError) {
        throw planError;
      }

      if (!plan) {
        throw new NotFoundError('Plan not found.', 'PLAN_NOT_FOUND', 'plan_not_found_error');
      }
    }

    // Build the data to upsert with defaults
    const dataToUpsert: ProfileDto = {
      id: userId,
      first_name: command.first_name ?? existingProfile?.first_name ?? '',
      active_plan_id: command.active_plan_id !== undefined
        ? command.active_plan_id
        : existingProfile?.active_plan_id ?? null,
      date_of_birth: command.date_of_birth !== undefined
        ? command.date_of_birth
        : existingProfile?.date_of_birth ?? null,
      body_fat_method: command.body_fat_method !== undefined
        ? command.body_fat_method
        : existingProfile?.body_fat_method ?? null,
      sex: command.sex !== undefined
        ? command.sex
        : existingProfile?.sex ?? null,
      height_cm: command.height_cm !== undefined
        ? command.height_cm
        : existingProfile?.height_cm ?? null,
      measurement_frequency_days: command.measurement_frequency_days !== undefined
        ? command.measurement_frequency_days
        : existingProfile?.measurement_frequency_days ?? null,
      tracked_measurement_types: command.tracked_measurement_types !== undefined
        ? command.tracked_measurement_types
        : existingProfile?.tracked_measurement_types ?? null,
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

}

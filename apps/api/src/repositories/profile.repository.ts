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
    // 404, not 403. The caller's own id is the only one this endpoint accepts, so answering
    // "forbidden" for any other confirms that the profile exists - exactly the disclosure the
    // project's "404 for anything that is not yours" convention avoids everywhere else.
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
    // 404 for the same reason as findById: a 403 here would distinguish an existing profile from
    // an absent one for an id the caller may not read.
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

    // The foreign key only proves the plan exists, not that it is this user's, so a profile could
    // be pointed at someone else's plan. The home page then fetches that plan, gets a 404 under
    // RLS, and reports "Failed to load some home page data" permanently.
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

}

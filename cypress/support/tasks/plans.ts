import { supabase } from './supabase';

export const plansTasks = {
  /**
   * Clears the user's active plan and removes the sessions that belonged to it.
   *
   * The three statements are sequenced rather than issued together: the delete needs the plan id
   * the profile is about to lose, and when there is no active plan there is nothing to delete at
   * all. Running them unconditionally meant `.eq('plan_id', null)` was issued whenever the profile
   * had no active plan, which does not mean "sessions with no plan" in PostgREST and matched
   * nothing useful.
   */
  async 'plans:resetActive'({ userId }: { userId: string }): Promise<null> {
    const { data: profile, error: profileError } = await supabase!
      .from('profiles')
      .select('active_plan_id')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error reading the profile to reset its active plan:', profileError);
      throw new Error(profileError.message);
    }

    const activePlanId = profile?.active_plan_id;
    if (!activePlanId) {
      return null;
    }

    const { error: updateError } = await supabase!
      .from('profiles')
      .update({ active_plan_id: null })
      .eq('id', userId);

    if (updateError) {
      console.error('Error clearing the active plan:', updateError);
      throw new Error(updateError.message);
    }

    const { error: deleteError } = await supabase!
      .from('sessions')
      .delete()
      .eq('plan_id', activePlanId);

    if (deleteError) {
      console.error('Error deleting the sessions of the former active plan:', deleteError);
      throw new Error(deleteError.message);
    }

    return null;
  }
};

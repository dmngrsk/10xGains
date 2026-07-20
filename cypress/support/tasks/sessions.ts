import { supabase } from './supabase';

/** A session set, reduced to the fields a test asserts on. */
export interface SessionSetSnapshot {
  id: string;
  session_id: string;
  plan_exercise_id: string;
  set_index: number;
  actual_reps: number | null;
  actual_weight: number;
  status: string;
}

export const sessionsTasks = {
  /**
   * Reads a user's completed sessions, newest first, with their sets.
   *
   * Used to assert that recorded history stays exactly as it was left. Reading through the database
   * rather than the history UI keeps the assertion on the stored rows themselves, which is where
   * cross-session corruption would show up first.
   */
  async 'sessions:getCompletedWithSets'({ userId }: { userId: string }): Promise<SessionSetSnapshot[][]> {
    const { data, error } = await supabase!
      .from('sessions')
      .select('id, session_date, sets:session_sets!session_sets_session_id_fkey(id, session_id, plan_exercise_id, set_index, actual_reps, actual_weight, status)')
      .eq('user_id', userId)
      .eq('status', 'COMPLETED')
      .order('session_date', { ascending: false });

    if (error) {
      console.error('Error reading completed sessions:', error);
      throw new Error(error.message);
    }

    return (data ?? []).map(session =>
      [...(session.sets as SessionSetSnapshot[])].sort((a, b) => a.set_index - b.set_index)
    );
  }
};

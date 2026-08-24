import { supabase } from './supabase';

export const plansTasks = {
  async 'plans:setExpectedWeight'({ userId, exerciseName, weight }: { userId: string, exerciseName: string, weight: number }): Promise<null> {
    const { data: profile, error: profileError } = await supabase!
      .from('profiles')
      .select('active_plan_id')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error reading the profile to locate its active plan:', profileError);
      throw new Error(profileError.message);
    }

    const { data: exercise, error: exerciseError } = await supabase!
      .from('exercises')
      .select('id')
      .eq('name', exerciseName)
      .single();

    if (exerciseError) {
      console.error(`Error locating the exercise "${exerciseName}":`, exerciseError);
      throw new Error(exerciseError.message);
    }

    const { data: planExercises, error: planExerciseError } = await supabase!
      .from('plan_exercises')
      .select('id, plan_days!inner(plan_id)')
      .eq('exercise_id', exercise!.id)
      .eq('plan_days.plan_id', profile!.active_plan_id);

    if (planExerciseError) {
      console.error('Error locating the plan exercises to reweight:', planExerciseError);
      throw new Error(planExerciseError.message);
    }

    const { error: updateError } = await supabase!
      .from('plan_exercise_sets')
      .update({ expected_weight: weight })
      .in('plan_exercise_id', (planExercises ?? []).map(pe => pe.id));

    if (updateError) {
      console.error('Error rewriting the prescribed weights:', updateError);
      throw new Error(updateError.message);
    }

    return null;
  },

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

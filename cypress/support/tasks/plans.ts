import { supabase } from './supabase';

export const plansTasks = {
  async 'plans:resetActive'({ userId }: { userId: string }): Promise<null> {
    const { data: profile, error: profileError } = await supabase!.from('profiles').select('active_plan_id').eq('id', userId).single();
    const { error: updateError } = await supabase!.from('profiles').update({ active_plan_id: null }).eq('id', userId);
    const { error: deleteError } = await supabase!.from('sessions').delete().eq('plan_id', profile?.active_plan_id);

    if (profileError || updateError || deleteError) {
      console.error('Error removing active plan:', profileError ?? updateError ?? deleteError);
      throw new Error((profileError ?? updateError ?? deleteError)?.message);
    }

    return null;
  }
};

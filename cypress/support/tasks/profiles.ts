import { supabase } from './supabase';

export const profilesTasks = {
  async 'profiles:get'({ userId }: { userId: string }): Promise<{ first_name: string } | null> {
    const { data, error } = await supabase!.from('profiles').select('first_name').eq('id', userId).maybeSingle();

    if (error) {
      console.error('Error reading profile:', error);
      throw new Error(error.message);
    }

    return data;
  }
};

import { supabase } from './supabase';

export const exercisesTasks = {
  async 'exercises:delete'({ name }: { name: string }): Promise<null> {
    const { data, error: dataError } = await supabase!.from('exercises').select('id').eq('name', name).single();
    const { count, error: deleteError } = await supabase!.from('exercises').delete({ count: 'exact' }).eq('id', data!.id);

    if (dataError || deleteError || count !== 1) {
      console.error('Error deleting exercise:', dataError ?? deleteError ?? `Expected 1 exercise to be deleted, but got ${count}`);
      throw new Error((dataError ?? deleteError)?.message ?? `Expected 1 exercise to be deleted, but got ${count}`);
    }

    return null;
  }
};

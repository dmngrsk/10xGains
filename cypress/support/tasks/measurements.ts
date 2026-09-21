import { supabase } from './supabase';

export interface MeasurementSeed {
  measured_on: string;
  type: string;
  value: number;
}

export const measurementsTasks = {
  async 'measurements:seed'({ userId, measurements }: { userId: string; measurements: MeasurementSeed[] }): Promise<null> {
    if (measurements.length === 0) {
      return null;
    }

    const { error } = await supabase!
      .from('measurements')
      .upsert(measurements.map(m => ({ ...m, user_id: userId })), { onConflict: 'user_id,measured_on,type' });

    if (error) {
      console.error('Error seeding measurements:', error);
      throw new Error(error.message);
    }

    return null;
  },

  async 'measurements:setProfile'(
    { userId, ...fields }: {
      userId: string;
      body_fat_method?: string | null;
      sex?: string | null;
      height_cm?: number | null;
      measurement_frequency_days?: number | null;
      date_of_birth?: string | null;
      tracked_measurement_types?: string[] | null;
    }
  ): Promise<null> {
    const { error } = await supabase!.from('profiles').update(fields).eq('id', userId);

    if (error) {
      console.error('Error setting body composition profile:', error);
      throw new Error(error.message);
    }

    return null;
  },

  async 'measurements:getProfile'({ userId }: { userId: string }): Promise<Record<string, unknown>> {
    const { data, error } = await supabase!
      .from('profiles')
      .select('body_fat_method, sex, height_cm, date_of_birth, measurement_frequency_days, tracked_measurement_types')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error reading body composition profile:', error);
      throw new Error(error.message);
    }

    return data as Record<string, unknown>;
  },

  async 'measurements:list'({ userId }: { userId: string }): Promise<MeasurementSeed[]> {
    const { data, error } = await supabase!
      .from('measurements')
      .select('measured_on, type, value')
      .eq('user_id', userId)
      .order('measured_on', { ascending: true })
      .order('type', { ascending: true });

    if (error) {
      console.error('Error reading measurements:', error);
      throw new Error(error.message);
    }

    return (data ?? []) as MeasurementSeed[];
  },
};

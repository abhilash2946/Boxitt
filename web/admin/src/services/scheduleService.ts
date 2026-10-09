import { supabase } from './supabase';

export interface DaySchedule {
  id?: string;
  location_id: string;
  date: string; // YYYY-MM-DD
  status: 'green' | 'red' | 'normal';
  closed_option?: 'one_time' | 'weekly' | 'monthly' | 'yearly';
  closure_type?: 'full' | 'partial';
  start_time?: string;
  end_time?: string;
  note?: string;
}

const LOCAL_STORAGE_KEY = 'boxit_schedules';

// Helper to get fallback schedules from localStorage
const getLocalSchedules = (): DaySchedule[] => {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

const saveLocalSchedules = (schedules: DaySchedule[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(schedules));
  } catch (e) {
    console.error(e);
  }
};

export const scheduleService = {
  async getSchedules(locationId: string): Promise<DaySchedule[]> {
    try {
      const { data, error } = await supabase
        .from('box_schedules')
        .select('*')
        .eq('location_id', locationId);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn('Supabase box_schedules failed, falling back to localStorage:', err);
      return getLocalSchedules().filter(s => s.location_id === locationId);
    }
  },

  async saveSchedule(schedule: DaySchedule): Promise<boolean> {
    try {
      // Check if item exists
      const { data: existing } = await supabase
        .from('box_schedules')
        .select('id')
        .eq('location_id', schedule.location_id)
        .eq('date', schedule.date)
        .maybeSingle();

      let result;
      if (existing?.id) {
        result = await supabase
          .from('box_schedules')
          .update(schedule)
          .eq('id', existing.id);
      } else {
        result = await supabase
          .from('box_schedules')
          .insert([schedule]);
      }

      if (result.error) throw result.error;

      // Update local storage too as secondary/sync backup
      const local = getLocalSchedules().filter(s => !(s.location_id === schedule.location_id && s.date === schedule.date));
      local.push(schedule);
      saveLocalSchedules(local);

      return true;
    } catch (err) {
      console.warn('Supabase box_schedules save failed, using localStorage fallback:', err);
      const local = getLocalSchedules().filter(s => !(s.location_id === schedule.location_id && s.date === schedule.date));
      local.push(schedule);
      saveLocalSchedules(local);
      return true;
    }
  },

  async saveSchedulesBatch(locationId: string, schedules: DaySchedule[]): Promise<boolean> {
    try {
      // 1. Delete existing rules for this location
      const { error: deleteError } = await supabase
        .from('box_schedules')
        .delete()
        .eq('location_id', locationId);

      if (deleteError) {
        console.error('Delete Error in saveSchedulesBatch:', deleteError);
        throw new Error(`Failed to clear existing schedule: ${deleteError.message}`);
      }

      // 2. Insert new batch if not empty
      if (schedules.length > 0) {
        const payload = schedules.map(s => {
            const row: any = {
                location_id: locationId,
                date: s.date,
                status: s.status,
                note: s.note || null
            };

            // Only send closure fields if status is red
            if (s.status === 'red') {
                row.closed_option = s.closed_option || 'one_time';
                row.closure_type = s.closure_type || 'full';
                row.start_time = s.start_time || null;
                row.end_time = s.end_time || null;
            } else {
                row.closed_option = null;
                row.closure_type = null;
                row.start_time = null;
                row.end_time = null;
            }
            return row;
        });

        const { error: insertError } = await supabase
          .from('box_schedules')
          .insert(payload);

        if (insertError) {
          console.error('Insert Error in saveSchedulesBatch:', insertError);
          throw new Error(`Failed to save new schedule: ${insertError.message}`);
        }
      }

      // 3. Update backup local storage cache
      const local = getLocalSchedules().filter(s => s.location_id !== locationId);
      local.push(...schedules);
      saveLocalSchedules(local);

      return true;
    } catch (err: any) {
      console.error('Cloud synchronization failed:', err);
      // Re-throw so UI can handle error
      throw err;
    }
  }
};

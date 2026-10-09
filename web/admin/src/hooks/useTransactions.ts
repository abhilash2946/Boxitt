import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { Booking, BookingStatus } from '../types';

// Query key factory
export const transactionKeys = {
  all: ['transactions'] as const,
  byUser: (userId: string) => [...transactionKeys.all, 'user', userId] as const,
};

type BookingWithArena = Booking & { arenaName?: string };

/**
 * Fetch all transactions (bookings) for a specific user
 */
export function useUserTransactions(userId: string | undefined) {
  return useQuery({
    queryKey: transactionKeys.byUser(userId || ''),
    queryFn: async (): Promise<BookingWithArena[]> => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('bookings')
        .select(`*, locations ( name )`)
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (error) throw error;

      // Map the Supabase response to our Booking type
      return (data || []).map(b => ({
        id: b.id,
        name: b.name,
        phone: b.phone,
        date: b.date,
        locationId: b.location_id,
        slotId: b.slot_id,
        slotTime: b.slot_time,
        startHour: b.start_hour,
        endHour: b.end_hour,
        duration: b.duration,
        amount: b.amount,
        advancePaid: b.advance_paid,
        status: b.status as BookingStatus,
        paymentMethod: b.payment_method,
        paymentType: b.payment_type,
        checkedIn: b.checked_in,
        createdAt: b.created_at,
        bookedBy: b.booked_by,
        isJoinable: b.is_joinable,
        maxPlayers: b.max_players,
        currentPlayers: b.current_players,
        joinRequests: b.join_requests || [],
        sport: b.sport,
        arenaName: b.locations?.name || 'Unknown Arena',
      }));
    },
    enabled: !!userId,
  });
}

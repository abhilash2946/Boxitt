import { supabase } from './supabase';
import { Booking, BookingStatus } from '../types';
import { getLocalISODate } from '../constants';

export const bookingService = {
  // Fetch bookings for a specific location and optionally a date
  getBookings: async (locationId: string, date?: string): Promise<Booking[]> => {
    try {
      let query = supabase
        .from('bookings')
        .select('*, join_requests(*)')
        .eq('location_id', locationId);

      if (date) {
        query = query.eq('date', date);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(b => ({
        id: b.id,
        name: b.name,
        phone: b.phone,
        date: b.date,
        locationId: b.location_id,
        courtId: b.court_id,
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
        joinRequests: b.join_requests?.map((r: any) => ({
          id: r.id,
          booking_id: r.booking_id,
          requester_id: r.requester_id,
          player_name: r.player_name,
          phone: r.phone,
          group_size: r.group_size,
          status: r.status,
          requester_details: r.requester_details,
          requested_at: r.requested_at,
          accepted_at: r.accepted_at
        })) || [],
        sport: b.sport,
        user_id: b.user_id,
        auto_delete_at: b.auto_delete_at
      }));
    } catch (error) {
      console.error('Error fetching bookings:', error);
      return [];
    }
  },

  // Fetch a single booking or join_request by ID (For Scanner)
  getBookingById: async (id: string): Promise<Booking | null> => {
    try {
      // 1. Try querying bookings table by booking ID
      const { data } = await supabase
        .from('bookings')
        .select('*, join_requests(*)')
        .eq('id', id)
        .maybeSingle();

      if (data) {
        return {
          id: data.id,
          name: data.name,
          phone: data.phone,
          date: data.date,
          locationId: data.location_id,
          courtId: data.court_id,
          slotId: data.slot_id,
          slotTime: data.slot_time,
          startHour: data.start_hour,
          endHour: data.end_hour,
          duration: data.duration,
          amount: data.amount,
          advancePaid: data.advance_paid,
          status: data.status as BookingStatus,
          paymentMethod: data.payment_method,
          paymentType: data.payment_type,
          checkedIn: data.checked_in,
          createdAt: data.created_at,
          bookedBy: data.booked_by,
          isJoinable: data.is_joinable,
          maxPlayers: data.max_players,
          currentPlayers: data.current_players,
          joinRequests: data.join_requests?.map((r: any) => ({
            id: r.id,
            booking_id: r.booking_id,
            requester_id: r.requester_id,
            player_name: r.player_name,
            phone: r.phone,
            group_size: r.group_size,
            status: r.status,
            requester_details: r.requester_details,
            requested_at: r.requested_at,
            accepted_at: r.accepted_at,
            checked_in: r.checked_in
          })) || [],
          sport: data.sport,
          user_id: data.user_id,
          auto_delete_at: data.auto_delete_at
        };
      }

      // 2. Fallback: try querying join_requests table by join_request ID
      const { data: joinReqData } = await supabase
        .from('join_requests')
        .select('*, bookings(*, join_requests(*))')
        .eq('id', id)
        .maybeSingle();

      if (joinReqData && joinReqData.bookings) {
        const b = joinReqData.bookings;
        return {
          id: joinReqData.id,
          name: joinReqData.player_name || b.name || 'Participant',
          phone: joinReqData.phone || b.phone,
          date: b.date,
          locationId: b.location_id,
          courtId: b.court_id,
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
          checkedIn: Boolean(joinReqData.checked_in),
          createdAt: joinReqData.created_at || b.created_at,
          bookedBy: b.booked_by,
          isJoinable: b.is_joinable,
          maxPlayers: b.max_players,
          currentPlayers: b.currentPlayers,
          joinRequests: b.join_requests || [],
          sport: b.sport,
          user_id: joinReqData.requester_id || b.user_id,
          auto_delete_at: b.auto_delete_at
        };
      }

      return null;
    } catch (err) {
      console.error('Error fetching booking by id:', err);
      return null;
    }
  },

  // Fetch a single challenge by ID (For Scanner & Notifications)
  getChallengeById: async (id: string): Promise<any | null> => {
    try {
      // Fetch challenge directly to prevent PostgREST schema cache foreign key join errors
      const { data: challenge, error: challengeError } = await supabase
        .from('challenges')
        .select('*')
        .eq('id', id)
        .single();

      if (challengeError || !challenge) return null;

      const userIds = [challenge.challenger_id, challenge.accepted_by].filter(Boolean);
      const locId = challenge.box_id || challenge.location_id;

      const [profilesRes, locationRes] = await Promise.all([
        userIds.length > 0
          ? supabase.from('user_profiles').select('*').in('id', userIds)
          : Promise.resolve({ data: [] }),
        locId
          ? supabase.from('locations').select('*').eq('id', locId).single()
          : Promise.resolve({ data: null })
      ]);

      const profiles = profilesRes.data || [];
      const challenger = profiles.find((p: any) => p.id === challenge.challenger_id) || null;
      const acceptor = profiles.find((p: any) => p.id === challenge.accepted_by) || null;
      const location = locationRes.data || null;

      return {
        ...challenge,
        challenger,
        acceptor,
        location
      };
    } catch (err) {
      return null;
    }
  },

  // Save a new booking to Supabase
  saveBooking: async (booking: any): Promise<{ data: any; error: any }> => {
    try {
      const bookingData: any = {
        name: booking.name,
        phone: booking.phone,
        date: booking.date,
        location_id: booking.locationId,
        court_id: booking.courtId,
        slot_id: booking.slotId,
        slot_time: booking.slotTime,
        start_hour: booking.startHour,
        end_hour: booking.endHour,
        duration: booking.duration,
        amount: booking.amount,
        advance_paid: booking.advancePaid,
        status: booking.status,
        payment_method: booking.paymentMethod,
        payment_type: booking.paymentType,
        checked_in: booking.checkedIn,
        created_at: booking.createdAt,
        booked_by: booking.bookedBy,
        is_joinable: booking.isJoinable,
        max_players: booking.maxPlayers || booking.max_players,
        current_players: booking.currentPlayers || booking.current_players,
        sport: booking.sport,
        user_id: booking.user_id,
        auto_delete_at: booking.auto_delete_at
      };

      // Always generate or use a valid UUID. Do not use client-side placeholders like BK-...
      if (booking.id && !booking.id.startsWith('BK-')) {
        bookingData.id = booking.id;
      } else {
        bookingData.id = crypto.randomUUID();
      }

      const { data, error } = await supabase
        .from('bookings')
        .insert([bookingData])
        .select()
        .single();

      // Transform the returned data to match Booking interface
      if (data && !error) {
        const transformedData = {
          id: data.id,
          name: data.name,
          phone: data.phone,
          date: data.date,
          locationId: data.location_id,
          courtId: data.court_id,
          slotId: data.slot_id,
          slotTime: data.slot_time,
          startHour: data.start_hour,
          endHour: data.end_hour,
          duration: data.duration,
          amount: data.amount,
          advancePaid: data.advance_paid,
          status: data.status as BookingStatus,
          paymentMethod: data.payment_method,
          paymentType: data.payment_type,
          checkedIn: data.checked_in,
          createdAt: data.created_at,
          bookedBy: data.booked_by,
          isJoinable: data.is_joinable,
          maxPlayers: data.max_players,
          currentPlayers: data.current_players,
          joinRequests: data.join_requests?.map((r: any) => ({
          id: r.id,
          booking_id: r.booking_id,
          requester_id: r.requester_id,
          player_name: r.player_name,
          phone: r.phone,
          group_size: r.group_size,
          status: r.status,
          requester_details: r.requester_details,
          requested_at: r.requested_at,
          accepted_at: r.accepted_at
        })) || [],
          sport: data.sport,
          user_id: data.user_id,
          auto_delete_at: data.auto_delete_at
        };
        return { data: transformedData, error };
      }

      return { data, error };
    } catch (error) {
      console.error('Error saving booking:', error);
      return { data: null, error };
    }
  },

  // Shared logic to check if a booking has expired and update status if needed
  checkAndApplyTimeout: async (booking: Booking): Promise<Booking> => {
    if (booking.status !== BookingStatus.BOOKED &&
        booking.status !== BookingStatus.APPROVED &&
        booking.status !== BookingStatus.PENDING &&
        booking.status !== BookingStatus.TIMED_OUT) {
      return booking;
    }

    try {
      const now = new Date();
      const today = getLocalISODate(now);
      const slotEndHour = booking.endHour;
      const currentHour = now.getHours() + (now.getMinutes() / 60);

      const isToday = booking.date === today;
      const isPastDate = booking.date < today;

      let shouldBeTimedOut = false;

      if (isPastDate) {
        shouldBeTimedOut = true;
      } else if (isToday) {
        // Add 1 minute grace period (1/60 of an hour)
        if (currentHour > (slotEndHour + 0.0166)) {
          shouldBeTimedOut = true;
        }
      }

      if (shouldBeTimedOut && booking.status !== BookingStatus.TIMED_OUT) {
        const success = await bookingService.updateBooking(booking.id, { status: BookingStatus.TIMED_OUT });
        if (success) booking.status = BookingStatus.TIMED_OUT;
      } else if (!shouldBeTimedOut && booking.status === BookingStatus.TIMED_OUT) {
        const success = await bookingService.updateBooking(booking.id, { status: BookingStatus.BOOKED });
        if (success) booking.status = BookingStatus.BOOKED;
      }
    } catch (e) {
      console.error("Timeout check failed", e);
    }
    return booking;
  },

  // Update booking status or other fields
  updateBooking: async (id: string, updates: Partial<Booking>): Promise<boolean> => {
    try {
      const dbUpdates: any = {};
      if (updates.status) dbUpdates.status = updates.status;
      if (updates.checkedIn !== undefined) dbUpdates.checked_in = updates.checkedIn;
      if (updates.isJoinable !== undefined) dbUpdates.is_joinable = updates.isJoinable;

      const { error } = await supabase
        .from('bookings')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating booking:', error);
      return false;
    }
  },

  // Update challenge status or other fields
  updateChallenge: async (id: string, updates: any): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('challenges')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating challenge:', error);
      return false;
    }
  },

  // Accept a pending join request
  addJoinRequest: async (bookingId: string, playerName: string, phone: string, count: number = 1, joinerId?: string) => {
    try {
      const validatedBookingId = String(bookingId || '').trim();
      const validatedJoinerId = String(joinerId || '').trim();
      if (!validatedBookingId || !validatedJoinerId) throw new Error('Missing requester id');

      const { data, error } = await supabase.rpc('accept_match_join_request', {
        p_booking_id: validatedBookingId,
        p_requester_id: validatedJoinerId,
        p_player_name: playerName,
        p_phone: phone,
        p_count: count
      });

      if (error) throw error;
      return !!data;
    } catch (error) {
      console.error('Error joining match:', error);
      return false;
    }
  },

  // Send a join request for a match
  sendJoinRequest: async (booking: any, user: any, count: number = 1, customName?: string, customPhone?: string) => {
    try {
      if (!user?.id || !booking?.user_id) throw new Error('Missing user information');

      const bookingId = String(booking.id || '').trim();
      const requesterId = String(user.id || '').trim();
      const groupSize = Math.max(1, Number(count || 1));

      if (!bookingId || !requesterId) throw new Error('Missing identifiers');

      const { data, error } = await supabase.rpc('submit_match_join_request', {
        p_booking_id: bookingId,
        p_requester_id: requesterId,
        p_player_name: customName || user.display_name || user.username || user.email || 'Player',
        p_phone: customPhone || user.phone_number || 'N/A',
        p_group_size: groupSize,
        p_requester_details: {
          username: user.username,
          display_name: customName || user.display_name,
          phone_number: customPhone || user.phone_number,
          avatar_url: user.avatar_url,
          email: user.email
        }
      });

      if (error) throw error;
      return !!data;
    } catch (error) {
      console.error('Error sending join request:', error);
      throw error;
    }
  },

  // Cancel a join request
  cancelJoinRequest: async (bookingId: string, userId: string, _hostId: string) => {
    try {
      const validatedBookingId = String(bookingId || '').trim();
      const validatedUserId = String(userId || '').trim();
      if (!validatedBookingId || !validatedUserId) return false;

      const { data, error } = await supabase.rpc('cancel_match_join_request', {
        p_booking_id: validatedBookingId,
        p_requester_id: validatedUserId
      });

      if (error) throw error;
      return !!data;
    } catch (error) {
      console.error('Error cancelling join request:', error);
      return false;
    }
  }
};

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
        resourceId: b.resource_id,
        platformId: b.platform_id,
        gameId: b.game_id,
        selectedGame: b.selected_game,
        resource_id: b.resource_id,
        platform_id: b.platform_id,
        game_id: b.game_id,
        selected_game: b.selected_game,
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
          currentPlayers: b.current_players,
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

  // Record a payment in the ledger
  recordPayment: async (payment: {
    booking_id: string;
    challenge_id?: string;
    user_id?: string;
    amount: number;
    payment_type: 'advance' | 'settlement' | 'full';
    payment_method?: string;
    utr?: string;
  }): Promise<boolean> => {
    try {
      const pUserId = payment.user_id || '00000000-0000-0000-0000-000000000000';

      // Deduplication check: skip if an identical payment record already exists
      const { data: existing } = await supabase
        .from('payments')
        .select('id')
        .eq('booking_id', payment.booking_id)
        .eq('payment_type', payment.payment_type)
        .eq('amount', payment.amount)
        .eq('user_id', pUserId)
        .maybeSingle();

      if (existing) {
        console.log('💳 Payment row already recorded in ledger, skipping duplicate creation.');
        return true;
      }

      const { error } = await supabase
        .from('payments')
        .insert([{
          booking_id: payment.booking_id,
          challenge_id: payment.challenge_id || null,
          user_id: pUserId,
          amount: payment.amount,
          payment_type: payment.payment_type,
          payment_method: payment.payment_method || 'cash',
          utr: payment.utr || null,
          status: 'success'
        }]);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error recording payment:', err);
      return false;
    }
  },

  // Save a new booking to Supabase atomically
  saveBooking: async (booking: any): Promise<{ data: any; error: any }> => {
    try {
      const courtIdVal = booking.courtId || booking.court_id;
      const userIdVal = booking.user_id;

      const resourceIdVal = booking.resourceId || booking.resource_id;
      const platformIdVal = booking.platformId || booking.platform_id;
      const gameIdVal = booking.gameId || booking.game_id;
      const selectedGameVal = booking.selectedGame || booking.selected_game;

      const bookingPayload = {
        name: booking.name,
        phone: booking.phone,
        date: booking.date,
        location_id: booking.locationId || booking.location_id,
        court_id: courtIdVal && String(courtIdVal).trim() !== '' ? courtIdVal : null,
        resource_id: resourceIdVal && String(resourceIdVal).trim() !== '' ? resourceIdVal : null,
        platform_id: platformIdVal && String(platformIdVal).trim() !== '' ? platformIdVal : null,
        game_id: gameIdVal && String(gameIdVal).trim() !== '' ? gameIdVal : null,
        selected_game: selectedGameVal || null,
        slot_id: booking.slotId || booking.slot_id || null,
        slot_time: booking.slotTime || booking.slot_time || null,
        start_hour: booking.startHour ?? booking.start_hour ?? 0,
        end_hour: booking.endHour ?? booking.end_hour ?? 1,
        duration: typeof booking.duration === 'number' ? booking.duration : (parseFloat(String(booking.duration || '1')) || 1),
        amount: booking.amount ?? 0,
        advance_paid: booking.advancePaid ?? booking.advance_paid ?? 0,
        advance_price: booking.advance_price ?? 0,
        status: booking.status || 'booked',
        payment_method: booking.paymentMethod || booking.payment_method || 'online',
        payment_type: booking.paymentType || booking.payment_type || 'advance',
        booked_by: booking.bookedBy || booking.booked_by || 'admin',
        is_joinable: !!booking.isJoinable || !!booking.is_joinable,
        max_players: booking.maxPlayers || booking.max_players || 1,
        current_players: booking.currentPlayers || booking.current_players || 1,
        sport: booking.sport || 'Box Cricket',
        user_id: userIdVal && String(userIdVal).trim() !== '' ? userIdVal : null
      };

      // Attempt atomic RPC reservation
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('create_booking_atomic', {
        p_booking: bookingPayload
      });

      if (rpcErr) {
        console.error('Atomic reservation RPC error:', rpcErr);
        return { data: null, error: new Error(rpcErr.message || 'Atomic reservation failed') };
      }

      if (!rpcRes || !rpcRes.success) {
        return { data: null, error: new Error(rpcRes?.message || 'Slot conflict or resource unavailable') };
      }

      const data = rpcRes.booking;
      const error = null;

      // Transform the returned data to match Booking interface
      if (data) {
        const advanceAmount = Number(data.advance_paid || data.advancePaid || 0);
        if (advanceAmount > 0) {
          await bookingService.recordPayment({
            booking_id: data.id,
            user_id: data.user_id || '00000000-0000-0000-0000-000000000000',
            amount: advanceAmount,
            payment_type: data.payment_type === 'full' ? 'full' : 'advance',
            payment_method: data.payment_method?.toLowerCase() || 'online'
          });
        }

        const transformedData = {
          id: data.id,
          name: data.name,
          phone: data.phone,
          date: data.date,
          locationId: data.location_id,
          courtId: data.court_id,
          resourceId: data.resource_id,
          platformId: data.platform_id,
          gameId: data.game_id,
          selectedGame: data.selected_game,
          slotId: data.slot_id,
          slotTime: data.slot_time,
          startHour: data.start_hour,
          endHour: data.end_hour,
          duration: data.duration,
          amount: data.amount,
          advancePaid: data.advance_paid,
          advance_price: data.advance_price,
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

      return { data: null, error: new Error('Failed to create booking') };
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

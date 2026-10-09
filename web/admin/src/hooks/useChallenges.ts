import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { getLocalISODate } from '../constants';

export const challengeKeys = {
  all: ['challenges'] as const,
  feed: (locationId?: string, userId?: string) => [...challengeKeys.all, 'feed', { locationId, userId }] as const,
};

const isVisibleChallengeStatus = (status?: string) => {
  if (!status) return true;
  const normalized = String(status).trim().toLowerCase();
  return ['active', 'pending_confirmation', 'confirmed', 'accepted', 'pending', 'open', 'booked', 'approved'].includes(normalized);
};

const toDateStartTs = (dateStr: string) => {
  if (!dateStr) return 0;
  if (dateStr.includes('-')) {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return 0;
    return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  }
  if (dateStr.includes('/')) {
    const [d, m, y] = dateStr.split('/').map(Number);
    if (!y || !m || !d) return 0;
    return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  }
  return 0;
};

const parseDateParts = (dateStr: string): { year: number; month: number; day: number } | null => {
  if (!dateStr) return null;
  if (dateStr.includes('-')) {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return null;
    return { year: y, month: m, day: d };
  }
  if (dateStr.includes('/')) {
    const [d, m, y] = dateStr.split('/').map(Number);
    if (!y || !m || !d) return null;
    return { year: y, month: m, day: d };
  }
  return null;
};

const getEndTime = (dateStr: string, slotTime: string, startHour?: number, endHour?: number) => {
  try {
    if (!dateStr) return 0;
    if (typeof startHour === 'number' && typeof endHour === 'number') {
      const parts = parseDateParts(dateStr);
      if (parts) {
        const { year, month, day } = parts;
        const startMinutes = Math.round(startHour * 60);
        let endMinutes = Math.round(endHour * 60);
        if (endMinutes <= startMinutes) endMinutes += 24 * 60;
        const d = new Date(year, month - 1, day, 0, 0, 0, 0);
        d.setMinutes(endMinutes);
        const ts = d.getTime();
        return Number.isFinite(ts) ? ts : 0;
      }
    }

    if (!slotTime || slotTime === 'TBA') return 0;
    const rangeParts = slotTime.split('-').map(p => p.trim()).filter(Boolean);
    const lastPart = rangeParts[rangeParts.length - 1] || slotTime.trim();
    const timeMatch = lastPart.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
    if (!timeMatch) return 0;

    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2] || '0', 10);
    const modifier = timeMatch[3].toUpperCase();
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;

    const parts = parseDateParts(dateStr);
    if (!parts) return 0;
    const { year, month, day } = parts;
    const d = new Date(year, month - 1, day, hours, minutes, 0, 0);
    const ts = d.getTime();
    return Number.isFinite(ts) ? ts : 0;
  } catch {
    return 0;
  }
};

async function getChallengeFeed(selectedLocationId?: string, userId?: string) {
  const todayStr = getLocalISODate();

  let challengesQuery = supabase
    .from('challenges')
    .select('*');

  if (selectedLocationId) {
    challengesQuery = challengesQuery.eq('box_id', selectedLocationId);
  }

  let matchesQuery = supabase.from('bookings').select('*').eq('is_joinable', true);
  if (selectedLocationId) {
    matchesQuery = matchesQuery.eq('location_id', selectedLocationId);
  }

  let [challengesRes, matchesRes] = await Promise.all([
    challengesQuery.order('created_at', { ascending: false }),
    matchesQuery.order('date', { ascending: true })
  ]);

  if ((challengesRes.data || []).length === 0 && (matchesRes.data || []).length === 0 && selectedLocationId) {
    const [allChallengesRes, allMatchesRes] = await Promise.all([
      supabase.from('challenges').select('*').order('created_at', { ascending: false }),
      supabase.from('bookings').select('*').eq('is_joinable', true).order('date', { ascending: true })
    ]);
    if (!allChallengesRes.error && !allMatchesRes.error && (((allChallengesRes.data || []).length > 0) || ((allMatchesRes.data || []).length > 0))) {
      challengesRes = allChallengesRes as any;
      matchesRes = allMatchesRes as any;
    }
  }

  if (challengesRes.error) throw challengesRes.error;
  if (matchesRes.error) throw matchesRes.error;

  const allChallenges = challengesRes.data || [];
  const rawChallenges = allChallenges.filter(c => isVisibleChallengeStatus((c as any)?.status));
  const rawMatches = matchesRes.data || [];

  const ownChallengeIds = new Set(
    rawChallenges.filter(c => c.challenger_id === userId).map(c => c.id).filter(Boolean)
  );

  const allUserIds = [...new Set([
    ...rawChallenges.map(c => c.challenger_id),
    ...rawChallenges.map(c => c.accepted_by),
    ...rawMatches.map(m => m.user_id)
  ])].filter(Boolean);

  const allLocationIds = [...new Set([
    ...rawChallenges.map(c => c.box_id),
    ...rawMatches.map(m => m.location_id)
  ])].filter(Boolean);

  const challengeBookingIds = rawChallenges.map(c => c.booking_id).filter(Boolean);

  const [usersRes, locationsRes, bookingsRes, challengeRequestsRes] = await Promise.all([
    allUserIds.length > 0 ? supabase.from('user_profiles').select('*').in('id', allUserIds) : Promise.resolve({ data: [] as any[] }),
    allLocationIds.length > 0 ? supabase.from('locations').select('*').in('id', allLocationIds) : Promise.resolve({ data: [] as any[] }),
    challengeBookingIds.length > 0 ? supabase.from('bookings').select('*').in('id', challengeBookingIds) : Promise.resolve({ data: [] as any[] }),
    userId ? supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }) : Promise.resolve({ data: [] as any[] })
  ]);

  const usersMap = Object.fromEntries((usersRes.data || []).map((u: any) => [u.id, u]));
  const locationsMap = Object.fromEntries((locationsRes.data || []).map((l: any) => [l.id, l]));
  const challengeBookingsMap = Object.fromEntries((bookingsRes.data || []).map((b: any) => [b.id, b]));

  const challengeRequestNotifs = ((challengeRequestsRes as any).data || []) as any[];
  const requestersByChallenge: Record<string, any[]> = {};

  challengeRequestNotifs.forEach((notif) => {
    if (notif?.data?.type !== 'challenge_request') return;
    const challengeId = notif?.data?.challenge_id;
    const requesterId = notif?.data?.requester_id;
    if (!challengeId || !requesterId || !ownChallengeIds.has(challengeId)) return;
    if (!requestersByChallenge[challengeId]) requestersByChallenge[challengeId] = [];
    const alreadyIncluded = requestersByChallenge[challengeId].some(r => r.requester_id === requesterId);
    if (alreadyIncluded) return;

    requestersByChallenge[challengeId].push({
      requester_id: requesterId,
      requester: usersMap[requesterId] || notif?.data?.requester_details || null,
      created_at: notif.created_at,
      notification_id: notif.id
    });
  });

  const userRequestChallengeIds = new Set<string>();
  const userAcceptedChallengeIds = new Set<string>();
  challengeRequestNotifs.forEach((notif) => {
    if (notif?.data?.type === 'challenge_request_sent' && notif?.data?.requester_id === userId) {
      userRequestChallengeIds.add(notif?.data?.challenge_id);
    }
    if (notif?.data?.type === 'challenge_confirmed') {
      userAcceptedChallengeIds.add(notif?.data?.challenge_id);
      userRequestChallengeIds.add(notif?.data?.challenge_id);
    }
  });

  rawChallenges.forEach((c) => {
    if (c.accepted_by === userId) {
      userRequestChallengeIds.add(c.id);
      userAcceptedChallengeIds.add(c.id);
    }
  });

  const formattedChallenges = rawChallenges.map(c => {
    const linkedBooking = challengeBookingsMap[c.booking_id];
    const slotTime = c.slot_time || linkedBooking?.slot_time || linkedBooking?.slotTime || 'TBA';
    const challengeDate = c.date || linkedBooking?.date || (c.created_at ? c.created_at.split('T')[0] : todayStr);
    const box = locationsMap[c.box_id];

    return {
      ...c,
      type: 'challenge',
      challenger: usersMap[c.challenger_id],
      box,
      amount: c.amount || linkedBooking?.amount || box?.defaultPrice,
      requests: requestersByChallenge[c.id] || (c.accepted_by ? [{ requester_id: c.accepted_by, requester: usersMap[c.accepted_by] || null }] : []),
      date: challengeDate,
      slot_time: slotTime,
      start_hour: c.start_hour ?? linkedBooking?.start_hour,
      end_hour: c.end_hour ?? linkedBooking?.end_hour,
      current_players: linkedBooking?.current_players,
      max_players: linkedBooking?.max_players
    };
  });

  const formattedMatches = rawMatches
    .filter(m => {
      const status = String(m.status || '').toLowerCase();
      const hasSpots = Number(m.current_players || 0) < Number(m.max_players || 0);
      const joinableState = status === 'booked' || status === 'confirmed' || status === 'approved' || status === 'pending' || status === 'active' || status === 'open' || !status;
      return hasSpots && joinableState;
    })
    .map(m => ({
    ...m,
    type: 'match',
    challenger: usersMap[m.user_id],
    box: locationsMap[m.location_id],
    slot_time: m.slot_time || m.slotTime || 'TBA',
    date: m.date
  }));

  const combined = [...formattedChallenges, ...formattedMatches];
  const now = new Date().getTime();
  const items = combined
    .map(item => {
      const endTime = getEndTime(item.date, item.slot_time, item.start_hour, item.end_hour);
      const dateStartTs = toDateStartTs(item.date);
      const autoDeleteTs = item.auto_delete_at ? new Date(item.auto_delete_at).getTime() : 0;
      const fallbackRemoveAtTs = dateStartTs > 0 ? (dateStartTs + (26 * 60 * 60 * 1000)) : 0;
      const removeAtTs = autoDeleteTs > 0
        ? autoDeleteTs
        : (endTime > 0 ? endTime + (2 * 60 * 60 * 1000) : fallbackRemoveAtTs);
      return {
        ...item,
        dateStartTs,
        endTime,
        autoDeleteTs,
        removeAtTs,
        isExpired: endTime > 0 && endTime < now
      };
    })
    .filter(item => {
      if (item.removeAtTs > 0) {
        return item.removeAtTs > now;
      }
      return true;
    })
    .sort((a, b) => {
      if (a.isExpired !== b.isExpired) return a.isExpired ? 1 : -1;
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a.endTime - b.endTime;
    });

  return { items, userSentRequests: Array.from(userRequestChallengeIds), userAcceptedChallenges: Array.from(userAcceptedChallengeIds) };
}

export function useChallengeFeed(selectedLocationId?: string, userId?: string) {
  return useQuery({
    queryKey: challengeKeys.feed(selectedLocationId, userId),
    queryFn: () => getChallengeFeed(selectedLocationId, userId),
    enabled: Boolean(userId),
  });
}

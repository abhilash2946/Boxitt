import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, MapPin, Clock, CheckCircle2, XCircle, Users, ArrowLeft, Loader2, AlertCircle, QrCode, Navigation, IndianRupee, Search } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { handleError } from '../services/errorHandler';
import { storage } from '../services/storage';
import { Location, BookingStatus } from '../types';
import QRCodeModal from '../components/QRCodeModal';
import PaymentPage from '../components/PaymentPage';
import SuccessModal from '../components/SuccessModal';
import { bookingService } from '../services/bookingService';
import { userService } from '../services/userService';
import { messagingService } from '../services/messagingService';
import { calculateDistance, formatDistance } from '../services/distanceUtils';

interface ChallengesPageProps {
  user: any;
  selectedLocation?: Location;
  selectedSport?: string;
  onBack: () => void;
  onOpenBooking?: (location?: Location, sport?: any) => void;
  onAlert?: (msg: string, type: 'success' | 'error' | 'info') => void;
  onShowQR?: (booking: any, location: any) => void;
}

interface SquadJoinModalProps {
  match: any;
  user: any;
  theme: any;
  onClose: () => void;
  onConfirm: (matchItem: any, addingCount: number, contributionAmount: number) => void;
  isProcessing?: boolean;
}

const SquadJoinModal: React.FC<SquadJoinModalProps> = ({
  match,
  user,
  theme,
  onClose,
  onConfirm,
  isProcessing = false
}) => {
  const freeSpots = Math.max(0, Number(match.max_players || 10) - Number(match.current_players || 0));
  const maxSelectable = Math.min(freeSpots, 10);
  const [addingPlayers, setAddingPlayers] = useState<number>(1);

  const matchTotal = Number(match.amount || match.total_price || 0);
  const maxPlayers = Number(match.max_players || 10);
  const perPlayerShare = Math.round(matchTotal / maxPlayers);
  const yourContribution = addingPlayers * perPlayerShare;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-sm rounded-[2.5rem] border p-8 space-y-6 relative overflow-hidden text-center shadow-2xl"
        style={{
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          boxShadow: theme.elevation.modal
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 transition-colors"
          style={{ color: theme.colors.textDisabled }}
        >
          <XCircle className="w-6 h-6" />
        </button>

        <div className="pt-2 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg text-white"
            style={{ backgroundColor: theme.colors.accent }}
          >
            <Users className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black uppercase italic tracking-tighter" style={{ color: theme.colors.textPrimary }}>
            SQUAD JOIN
          </h2>
          <p className="text-[10px] font-black uppercase tracking-widest mt-1" style={{ color: theme.colors.accent }}>
            {match.slot_time || match.slotTime || 'TBA'}
          </p>
        </div>

        <div
          className="p-5 rounded-2xl border space-y-3 text-left"
          style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: theme.colors.textDisabled }}>
              ADDING PLAYERS
            </span>
            <span className="text-xl font-black" style={{ color: theme.colors.accent }}>
              {addingPlayers}
            </span>
          </div>

          <div className="flex gap-2 flex-wrap pt-1">
            {Array.from({ length: maxSelectable }, (_, i) => i + 1).map(num => (
              <button
                key={num}
                disabled={isProcessing}
                onClick={() => setAddingPlayers(num)}
                className="min-w-[48px] py-3 rounded-xl text-xs font-black transition-all border-2"
                style={{
                  backgroundColor: addingPlayers === num ? theme.colors.accent : 'transparent',
                  borderColor: addingPlayers === num ? theme.colors.accent : theme.colors.border,
                  color: addingPlayers === num ? 'white' : theme.colors.textSecondary
                }}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        <div
          className="p-5 rounded-2xl border space-y-3 text-left"
          style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}
        >
          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest" style={{ color: theme.colors.textDisabled }}>
            <span>MATCH TOTAL</span>
            <span className="font-black text-xs" style={{ color: theme.colors.textPrimary }}>₹{matchTotal}</span>
          </div>
          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
            <span style={{ color: theme.colors.textSecondary }}>YOUR CONTRIBUTION</span>
            <span className="text-2xl font-black" style={{ color: theme.colors.accent }}>₹{yourContribution}</span>
          </div>
        </div>

        <button
          disabled={isProcessing}
          onClick={() => onConfirm(match, addingPlayers, yourContribution)}
          className="w-full py-5 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95"
          style={{
            background: theme.colors.buttonGradient
              ? `linear-gradient(to right, ${theme.colors.buttonGradient[0]}, ${theme.colors.buttonGradient[1]})`
              : theme.colors.accent
          }}
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            `CONFIRM & JOIN SQUAD`
          )}
        </button>
      </motion.div>
    </div>
  );
};

const ChallengesPage: React.FC<ChallengesPageProps> = ({ user, selectedLocation, selectedSport: propSport, onBack, onOpenBooking, onAlert, onShowQR }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme } = useTheme();

  const [userProfile, setUserProfile] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = React.useRef(0);
  const [hasMore, setHasMore] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedChallengeId, setExpandedChallengeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'challenges' | 'matches' | 'yours'>('all');
  const [searchQuery, setSearchQuery] = useState<string>(() => searchParams.get('arena') || '');

  useEffect(() => {
    const arenaParam = searchParams.get('arena');
    if (arenaParam !== null) {
      setSearchQuery(arenaParam);
    }
  }, [searchParams]);
  const [error, setError] = useState<string | null>(null);
  const [userSentRequests, setUserSentRequests] = useState<Set<string>>(new Set());
  const [userAcceptedChallenges, setUserAcceptedChallenges] = useState<Set<string>>(new Set());
  const [hostAcceptedChallenges, setHostAcceptedChallenges] = useState<Set<string>>(new Set());
  const [userSentMatchRequests, setUserSentMatchRequests] = useState<Set<string>>(new Set());
  const [userAcceptedMatches, setUserAcceptedMatches] = useState<Set<string>>(new Set());
  const [userRejectedChallenges, setUserRejectedChallenges] = useState<Set<string>>(new Set());
  const [matchResults, setMatchResults] = useState<any[]>([]);
  const [isFinalSettlementPayment, setIsFinalSettlementPayment] = useState<boolean>(false);
  const [paymentItem, setPaymentItem] = useState<any | null>(null);
  const [squadJoinMatch, setSquadJoinMatch] = useState<any | null>(null);
  const [squadJoinCount, setSquadJoinCount] = useState<number>(1);
  const [squadJoinAmount, setSquadJoinAmount] = useState<number>(0);
  const [showPaymentSummary, setShowPaymentSummary] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalConfig, setSuccessModalConfig] = useState<{title: string, message: string, onConfirm?: () => void, type?: 'success' | 'notice'} | null>(null);

  const getSortPriority = useCallback((item: any) => {
    const status = String(item.status || '').toLowerCase();
    const isExpired = !!item.isExpired;
    const isPaid = String(item.acceptor_payment_status).toLowerCase() === 'paid' || userAcceptedChallenges.has(String(item.id));

    // Bucket 3: Expired sessions always go to the bottom
    if (isExpired) return 3;

    if (item.type === 'challenge') {
      const isOwn = String(item.challenger_id) === String(user?.id);
      const isAcceptedByMe = String(item.accepted_by) === String(user?.id) || isPaid;
      const isAcceptedByOther = !!item.accepted_by && !isAcceptedByMe;
      const isConfirmed = status === 'confirmed' || status === 'booked' || isPaid;

      // Bucket 0: User's OWN challenges or accepted/sent requests MUST be on top so user can check requests quickly!
      if (isOwn || isAcceptedByMe || userSentRequests.has(String(item.id))) return 0;

      // Bucket 1: Available challenges created by others (Active/Open and NO ONE has accepted yet)
      if ((status === 'active' || status === 'open') && !item.accepted_by) return 1;

      // Bucket 2: Unavailable (Accepted by Other, Closed/Confirmed)
      if (isAcceptedByOther || status === 'closed' || isConfirmed) return 2;

      return 1;
    }

    if (item.type === 'match') {
      const isFull = Number(item.current_players || 0) >= Number(item.max_players || 0);
      const isOwn = String(item.user_id) === String(user?.id);
      const isParticipant = userAcceptedMatches.has(String(item.id)) || userSentMatchRequests.has(String(item.id)) || (Array.isArray(item.join_requests) && item.join_requests.some((r: any) => String(r.requester_id || r.userId) === String(user?.id)));

      // Bucket 0: User's OWN matches or matches where user is participant/requested MUST be on top!
      if (isOwn || isParticipant) return 0;

      // Bucket 1: Available matches created by others (Has open spots)
      if (!isFull) return 1;

      // Bucket 2: Full
      return 2;
    }

    return 2;
  }, [user?.id, userAcceptedChallenges, userAcceptedMatches, userSentRequests, userSentMatchRequests]);

  const showSuccess = (title: string, message: string, onConfirm?: () => void, type: 'success' | 'notice' = 'success') => {
    setSuccessModalConfig({ title, message, onConfirm, type });
    setShowSuccessModal(true);
  };

  const selectedSport = useMemo(() => {
    return propSport || storage.get('selectedSport');
  }, [propSport]);

  useEffect(() => {
    if (!user?.id) return;
    let timeoutId: any;
    const fetchProfile = () => {
      userService.getCurrentUserProfile().then(res => {
        if (res.profile) {
          setUserProfile(res.profile);
          if (res.profile.latitude === null || res.profile.latitude === undefined) {
            timeoutId = setTimeout(fetchProfile, 3000);
          }
        }
      }).catch(err => {
        console.warn('Silent profile fetch error:', err.message);
      });
    };
    fetchProfile();
    return () => clearTimeout(timeoutId);
  }, [user?.id]);

  const isVisibleChallengeStatus = (item: any) => {
    if (!item?.status) return true;
    const status = String(item.status).trim().toLowerCase();
    const isBasicVisible = ['active', 'pending_confirmation', 'confirmed', 'accepted', 'pending', 'open', 'pending_payment'].includes(status);

    if (isBasicVisible) {
      // If it's confirmed but also finished, check settlement
      const isFinished = matchResults.some(r => r.challenge_id === item.id);
      if (isFinished) {
        if (item.settlement_status !== 'completed') return true;

        // If completed, check if 1 hour has passed
        if (item.updated_at) {
          const paidAt = new Date(item.updated_at).getTime();
          const oneHourAgo = new Date().getTime() - (60 * 60 * 1000);
          return paidAt > oneHourAgo;
        }
      }
      return true;
    }

    return false;
  };

  const getLocalTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const toDateStartTs = (dateStr: string) => {
    if (!dateStr) return 0;

    // Supports YYYY-MM-DD and DD/MM/YYYY
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

      // Prefer numeric hours from bookings when available; this avoids parsing issues from display strings.
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

      // Support both "11:00 PM - 12:00 PM" and compact formats like "11:00PM-12:00PM".
      const rangeParts = slotTime.split('-').map(p => p.trim()).filter(Boolean);
      const lastPart = (rangeParts.length > 1 ? rangeParts[rangeParts.length - 1] : rangeParts[0]) || slotTime.trim();

      const timeMatch = lastPart.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
      if (!timeMatch) return 0;

      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2] || '0', 10);
      const modifier = (timeMatch[3] || '').toUpperCase();

      if (modifier === 'PM' && hours < 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;

      const parts = parseDateParts(dateStr);
      if (!parts) return 0;
      const { year, month, day } = parts;

      const d = new Date(year, month - 1, day, hours, minutes, 0, 0);
      // If end time is before start time (e.g. 11 PM to 12 AM), it's next day
      if (rangeParts.length > 1) {
         const firstPart = rangeParts[0];
         const startMatch = firstPart.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
         if (startMatch) {
            let sH = parseInt(startMatch[1], 10);
            const sM = parseInt(startMatch[2] || '0', 10);
            const sMod = (startMatch[3] || '').toUpperCase();
            if (sMod === 'PM' && sH < 12) sH += 12;
            if (sMod === 'AM' && sH === 12) sH = 0;
            if (hours <= sH) {
               d.setDate(d.getDate() + 1);
            }
         }
      }
      const ts = d.getTime();
      return Number.isFinite(ts) ? ts : 0;
    } catch (e) {
      return 0;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  const calculatePaymentDetails = useCallback((item: any) => {
    const total = Number(item.amount || item.box?.defaultPrice || 0);
    const challengerAdvance = Number(item.advance_price || 0);
    const acceptorAdvancePrice = Number(item.advance_price || 0);

    const acceptorPayableAdvance = Math.max(0, Math.min(acceptorAdvancePrice, total - challengerAdvance));
    const settlementBalance = Math.max(0, total - (challengerAdvance + acceptorPayableAdvance));

    return {
      total,
      challengerAdvance,
      acceptorPayableAdvance,
      settlementBalance
    };
  }, []);

  const fetchItems = useCallback(async (isLoadMore: Boolean = false) => {
    const activeSport = propSport || storage.get('selectedSport');

    if (isLoadMore) setLoadingMore(true); else setLoading(true);
    setError(null);
    try {
      if (!isLoadMore) {
        const cleanupRes = await supabase.rpc('cleanup_expired_matchmaking');
        if (cleanupRes.error) console.warn('cleanup_expired_matchmaking RPC failed:', cleanupRes.error.message);
      }

      const todayStr = getLocalTodayString();
      const offset = isLoadMore ? offsetRef.current : 0;
      const limit = 50;

      let challengesQuery = supabase.from('challenges').select('*');
      if (activeSport && activeSport.toLowerCase() !== 'all') {
        challengesQuery = challengesQuery.ilike('sport', `%${activeSport}%`);
      }

      let matchesQuery = supabase.from('bookings').select('*, join_requests(*)').eq('is_joinable', true);
      if (activeSport && activeSport.toLowerCase() !== 'all') {
        matchesQuery = matchesQuery.ilike('sport', `%${activeSport}%`);
      }

      let [challengesRes, matchesRes, resultsRes] = await Promise.all([
        challengesQuery.order('created_at', { ascending: false }).range(offset, offset + limit - 1),
        matchesQuery.order('date', { ascending: true }).range(offset, offset + limit - 1),
        supabase.from('match_results').select('*')
      ]);

      if (resultsRes.data) setMatchResults(resultsRes.data);

      if (challengesRes.error) console.error("Challenges fetch error:", challengesRes.error);
      if (matchesRes.error) console.error("Matches fetch error:", matchesRes.error);
      if (challengesRes.error || matchesRes.error) {
        const rawMessage = challengesRes.error?.message || matchesRes.error?.message || 'Failed to load matchmaking data.';
        setError(rawMessage);
      }

      const newChallenges = challengesRes.data || [];
      const newMatches = matchesRes.data || [];
      const rawChallenges = newChallenges.filter(c => isVisibleChallengeStatus(c?.status));
      const rawMatches = newMatches;

      setHasMore(newChallenges.length >= limit || newMatches.length >= limit);

      const ownChallengeIds = new Set(
        rawChallenges
          .filter(c => String(c.challenger_id) === String(user?.id))
          .map(c => String(c.id))
          .filter(Boolean)
      );

      const ownMatchIds = new Set(
        rawMatches
          .filter(m => String(m.user_id) === String(user?.id))
          .map(m => String(m.id))
          .filter(Boolean)
      );

      // 1.5. Fetch notifications first to get requester IDs for hydration
      const challengeRequestsRes = await (user?.id
        ? supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] as any[], error: null }));

      const challengeRequestNotifs = (challengeRequestsRes.data || []) as any[];

      // Helper to safely extract notification JSON data
      const getNotifData = (n: any) => {
        let d = n?.data;
        if (typeof d === 'string') {
          try { d = JSON.parse(d); } catch (e) {}
        }
        return d || {};
      };

      // 2. Collect unique IDs for hydration
      const notificationRequesters = challengeRequestNotifs
        .map(n => getNotifData(n)?.requester_id || getNotifData(n)?.requesterId)
        .filter(Boolean);

      const matchRequesterIds = rawMatches.flatMap((m: any) => {
        const reqs = Array.isArray(m.join_requests) ? m.join_requests : [];
        return reqs
          .filter((r: any) => String(r?.status || '').toLowerCase() === 'pending')
          .map((r: any) => String(r?.requester_id || r?.userId || ''))
          .filter(Boolean);
      });

      const allUserIds = [...new Set([
        ...rawChallenges.map(c => c.challenger_id),
        ...rawChallenges.map(c => c.accepted_by),
        ...rawMatches.map(m => m.user_id),
        ...notificationRequesters,
        ...matchRequesterIds
      ])].filter(Boolean);

      const allLocationIds = [...new Set([
        ...rawChallenges.map(c => c.box_id),
        ...rawMatches.map(m => m.location_id)
      ])].filter(Boolean);

      const challengeBookingIds = rawChallenges.map(c => c.booking_id).filter(Boolean);

      // 3. Hydrate data in parallel
      const [usersRes, locationsRes, bookingsRes] = await Promise.all([
        allUserIds.length > 0 ? supabase.from('user_profiles').select('*').in('id', allUserIds) : Promise.resolve({ data: [] }),
        allLocationIds.length > 0 ? supabase.from('locations').select('*').in('id', allLocationIds) : Promise.resolve({ data: [], error: null }),
        challengeBookingIds.length > 0 ? supabase.from('bookings').select('*').in('id', challengeBookingIds) : Promise.resolve({ data: [] })
      ]);

      const usersMap = Object.fromEntries((usersRes.data || []).map(u => [u.id, u]));
      const locationsMap = Object.fromEntries((locationsRes.data || []).map(l => [l.id, l]));
      const challengeBookingsMap = Object.fromEntries((bookingsRes.data || []).map(b => [b.id, b]));

      const requestersByChallenge: Record<string, any[]> = {};
      const requestersByMatch: Record<string, any[]> = {};

      challengeRequestNotifs.forEach((notif) => {
        const notifData = getNotifData(notif);
        const type = String(notifData?.type || notifData?.type_name || notif?.type || '');

        if (type === 'challenge_request' || type === 'challenge_waiting_payment' || type === 'challenge_payment_pending') {
          const challengeId = String(notifData?.challenge_id || notifData?.challengeId || notifData?.booking_id || '');
          const requesterId = String(notifData?.requester_id || notifData?.requesterId || '');

          if (!challengeId || !requesterId) return;

          if (!requestersByChallenge[challengeId]) {
            requestersByChallenge[challengeId] = [];
          }

          const alreadyIncluded = requestersByChallenge[challengeId].some(r => String(r.requester_id) === requesterId);
          if (alreadyIncluded) return;

          requestersByChallenge[challengeId].push({
            requester_id: requesterId,
            requester: usersMap[requesterId] || notifData?.requester_details || null,
            created_at: notif.created_at,
            notification_id: notif.id
          });
        }
      });

      rawMatches.forEach((m: any) => {
        const matchId = String(m.id || '');
        if (!matchId) return;

        const reqs = Array.isArray(m.join_requests) ? m.join_requests : [];
        const pendingRequests = reqs.filter((r: any) => String(r?.status || '').toLowerCase() === 'pending');

        requestersByMatch[matchId] = pendingRequests
          .map((r: any) => {
            const requesterId = String(r?.requester_id || r?.userId || '');
            if (!requesterId) return null;

            return {
              requester_id: requesterId,
              requester: usersMap[requesterId] || r?.requester_details || {
                username: r?.player_name || r?.playerName || r?.requesterUsername,
                display_name: r?.player_name || r?.playerName || r?.requesterUsername,
                phone_number: r?.phone || r?.requesterPhone
              },
              created_at: r?.requested_at || null,
              groupSize: Number(r?.group_size || r?.groupSize || 1)
            };
          })
          .filter(Boolean) as any[];
      });

      // Track which challenges/matches current user sent requests for
      const userRequestChallengeIds = new Set<string>();
      const userAcceptedChallengeIds = new Set<string>();
      const userRejectedChallengeIds = new Set<string>();
      const userRequestMatchIds = new Set<string>();
      const userAcceptedMatchIds = new Set<string>();

      challengeRequestNotifs.forEach((notif) => {
        const notifData = getNotifData(notif);
        const type = String(notifData?.type || notifData?.type_name || notif?.type || '');
        const dataChallengeId = String(notifData?.challenge_id || notifData?.challengeId || notifData?.booking_id || '');
        const dataRequesterId = String(notifData?.requester_id || notifData?.requesterId || '');
        const currentUserId = String(user?.id || '');

        // For 'sent' or 'payment_pending' types, check if it relates to current user
        const isMyRequest = dataRequesterId === currentUserId || type === 'challenge_payment_pending' || type === 'challenge_request_sent';
        const isRequestType = type === 'challenge_request_sent' || type === 'challenge_request' ||
                             type === 'match_join_request_sent' || type === 'match_join_request' ||
                             type === 'challenge_payment_pending' || type === 'challenge_waiting_payment';

        if (isRequestType && dataChallengeId) {
          if (type.includes('challenge')) {
            userRequestChallengeIds.add(dataChallengeId);
          } else {
            userRequestMatchIds.add(dataChallengeId);
          }
        }

        if (type === 'challenge_confirmed' || type === 'challenge_confirmed_host' || type === 'challenge_payment_pending' || type === 'challenge_waiting_payment') {
          if (dataChallengeId) {
            userAcceptedChallengeIds.add(dataChallengeId);
            userRequestChallengeIds.add(dataChallengeId);
          }
        }

        if (type === 'challenge_rejected' && dataChallengeId) {
          userRejectedChallengeIds.add(dataChallengeId);
        }
      });

      rawMatches.forEach((m: any) => {
        const matchId = String(m.id || '');
        if (!matchId) return;

        const reqs = Array.isArray(m.join_requests) ? m.join_requests : [];
        const ownPending = reqs.some((r: any) => (
          String(r?.requester_id || r?.userId || '') === String(user?.id || '') &&
          String(r?.status || '').toLowerCase() === 'pending'
        ));
        const ownAccepted = reqs.some((r: any) => (
          String(r?.requester_id || r?.userId || '') === String(user?.id || '') &&
          String(r?.status || '').toLowerCase() === 'accepted'
        ));

        if (ownPending) userRequestMatchIds.add(matchId);
        if (ownAccepted) {
          userAcceptedMatchIds.add(matchId);
        }
      });

      // Also include challenges where current user was accepted (for backward compatibility)
      rawChallenges.forEach((c) => {
        if (c.accepted_by === user?.id) {
          const cid = String(c.id);
          userRequestChallengeIds.add(cid);
          // Only add to confirmed set if truly confirmed or paid
          const status = String(c.status || '').toLowerCase();
          const paid = String(c.acceptor_payment_status || '').toLowerCase() === 'paid';
          if (status === 'confirmed' || paid) {
            userAcceptedChallengeIds.add(cid);
          }
        }
      });

      setUserSentRequests(userRequestChallengeIds);
      setUserAcceptedChallenges(userAcceptedChallengeIds);
      setUserRejectedChallenges(userRejectedChallengeIds);
      setUserSentMatchRequests(userRequestMatchIds);
      setUserAcceptedMatches(userAcceptedMatchIds);

      // 4. Combine and format
      const formattedChallenges = rawChallenges.map(c => {
        const linkedBooking = challengeBookingsMap[c.booking_id];
        const slotTime = c.slot_time || linkedBooking?.slot_time || linkedBooking?.slotTime || 'TBA';
        const challengeDate = c.date || linkedBooking?.date || (c.created_at ? c.created_at.split('T')[0] : todayStr);
        const box = locationsMap[c.box_id];

        return {
          ...c,
          type: 'challenge',
          challenger: usersMap[c.challenger_id],
          acceptor: usersMap[c.accepted_by],
          box,
          amount: c.amount || linkedBooking?.amount || box?.defaultPrice,
          advance_price: c.advance_price || linkedBooking?.advance_price || linkedBooking?.advance_paid || box?.default_advance,
          sport: c.sport || linkedBooking?.sport || box?.supportedSports?.[0],
          requests: requestersByChallenge[c.id] || (c.accepted_by ? [{ requester_id: c.accepted_by, requester: usersMap[c.accepted_by] || null }] : []),
          date: challengeDate,
          slot_time: slotTime,
          start_hour: c.start_hour ?? linkedBooking?.start_hour,
          end_hour: c.end_hour ?? linkedBooking?.end_hour
        };
      });

      const formattedMatches = rawMatches
        .filter(m => {
          // Only include bookings that are explicitly marked as joinable for matchmaking
          if (!m.is_joinable) return false;

          // NEW: Prevent duplicate cards if a challenge is already linked to this booking
          const hasChallenge = rawChallenges.some(c => String(c.booking_id) === String(m.id));
          if (hasChallenge) return false;

          const isOwn = String(m.user_id) === String(user?.id);

          // Check if current user is already a participant or has a pending request
          const requests = Array.isArray(m.join_requests) ? m.join_requests : [];
          const isParticipant = requests.some((r: any) =>
            String(r?.requester_id || r?.userId || '') === String(user?.id || '') &&
            String(r?.status || '').toLowerCase() === 'accepted'
          );
          const isRequester = requests.some((r: any) =>
            String(r?.requester_id || r?.userId || '') === String(user?.id || '') &&
            String(r?.status || '').toLowerCase() === 'pending'
          );

          // Always show to owner, participants, or active requesters
          if (isOwn || isParticipant || isRequester) return true;

          const status = String(m.status || '').toLowerCase();
          const hasSpots = Number(m.current_players || 0) < Number(m.max_players || 0);
          const joinableState = status === 'booked' || status === 'confirmed' || status === 'approved' || status === 'pending' || status === 'active' || status === 'open' || !status;

          // For everyone else, only show if it has open spots
          return hasSpots && joinableState;
        })
        .map(m => {
          const box = locationsMap[m.location_id];
          const requests = Array.isArray(m.join_requests) ? m.join_requests : [];

          let userPendingMembers = 0;
          let userAcceptedMembers = 0;

          if (user?.id) {
            requests.forEach((r: any) => {
              if (String(r?.requester_id || r?.userId || '') === String(user.id)) {
                const count = Number(r?.group_size || r?.groupSize || 1);
                if (String(r?.status || '').toLowerCase() === 'pending') {
                  userPendingMembers += count;
                } else if (String(r?.status || '').toLowerCase() === 'accepted') {
                  userAcceptedMembers += count;
                }
              }
            });
          }

          return {
            ...m,
            type: 'match',
            challenger: usersMap[m.user_id],
            box,
            amount: m.amount || box?.defaultPrice,
            advance_price: m.advance_price || m.advance_paid || box?.default_advance,
            sport: m.sport || box?.supportedSports?.[0],
            requests: requestersByMatch[m.id] || [],
            slot_time: m.slot_time || m.slotTime || 'TBA',
            date: m.date,
            userPendingMembers,
            userAcceptedMembers
          };
        });

      const combined = [...formattedChallenges, ...formattedMatches];
      const now = new Date().getTime();

      const mappedItems = combined.map(item => {
        const endTime = getEndTime(item.date, item.slot_time, item.start_hour, item.end_hour);
        const dateStartTs = toDateStartTs(item.date);
        const autoDeleteTs = item.auto_delete_at ? new Date(item.auto_delete_at).getTime() : 0;
        const fallbackRemoveAtTs = dateStartTs > 0 ? (dateStartTs + (26 * 60 * 60 * 1000)) : 0;

        // Expired sessions are removed from the feed 1 hour after they end.
        const removeAtTs = autoDeleteTs > 0
          ? autoDeleteTs
          : (endTime > 0 ? endTime + (1 * 60 * 60 * 1000) : fallbackRemoveAtTs);

        const isExpired = endTime > 0 && now > (endTime + 60 * 60 * 1000);

        return {
          ...item,
          dateStartTs,
          endTime,
          autoDeleteTs,
          removeAtTs,
          isExpired
        };
      });

      const processedItems = mappedItems.filter(item => {
        if (item.removeAtTs > 0) {
          return item.removeAtTs > now;
        }
        return true;
      });

      if (isLoadMore) {
        setItems(prev => {
          const combinedList = [...prev, ...processedItems];
          return Array.from(new Map(combinedList.map(item => [item.id, item])).values());
        });
        offsetRef.current += limit;
      } else {
        setItems(processedItems);
        offsetRef.current = limit;
      }
      console.log('📥 fetchItems completed', {
        selectedLocationId: selectedLocation?.id,
        challengesFetched: rawChallenges.length,
        matchesFetched: rawMatches.length,
        removedAfter2h: mappedItems.length - processedItems.length,
        processedItems: processedItems.length,
        confirmed: processedItems.filter((p: any) => p.status === 'confirmed').length,
        expiredCount: processedItems.filter((p: any) => p.isExpired).length
      });
    } catch (err) {
      const appErr = handleError(err);
      setError(appErr.message);
      onAlert?.(appErr.message, 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [onAlert, user?.id, selectedSport, selectedLocation?.id]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Real-time subscription to challenge updates
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel('challenges_updates')
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'challenges'
        },
        (payload) => {
          // Update the item in local state when challenge status changes
          const updatedChallenge = payload.new;
          // If current user was accepted, add to request and accepted sets.
          if (updatedChallenge.accepted_by === user?.id) {
            setUserSentRequests(prev => new Set([...prev, String(updatedChallenge.id)]));
            const status = String(updatedChallenge.status || '').toLowerCase();
            const paid = String(updatedChallenge.acceptor_payment_status || '').toLowerCase() === 'paid';
            if (status === 'confirmed' || status === 'booked' || paid) {
              setUserAcceptedChallenges(prev => new Set([...prev, String(updatedChallenge.id)]));
            }
          }

          setItems(prevItems =>
            prevItems.map(item =>
              item.id === updatedChallenge.id
                ? { ...item, ...updatedChallenge }
                : item
            )
          );
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  // Real-time subscription to match_results for status updates
  useEffect(() => {
    const subscription = supabase
      .channel('match_results_updates')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_results'
        },
        () => {
          fetchItems();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchItems]);

  // Re-fetch items on window focus and tab visibility change (ensures fresh state on hard refresh or tab switch)
  useEffect(() => {
    const handleFocus = () => {
      fetchItems();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchItems();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchItems]);

  // Real-time subscription to notification updates for request tracking (All events: INSERT, UPDATE, DELETE)
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel('notifications_updates')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // When notifications change (INSERT, UPDATE, DELETE), immediately update local state and re-fetch
          const notif = payload.new || payload.old;
          const notifData = getNotifData(notif);
          if (notifData?.type === 'challenge_request_sent' && notifData?.requester_id === user?.id) {
            setUserSentRequests(prev => new Set(prev).add(String(notifData?.challenge_id)));
          }

          if (notifData?.type === 'challenge_confirmed') {
            const cid = String(notifData?.challenge_id);
            setUserSentRequests(prev => new Set(prev).add(cid));
            setUserAcceptedChallenges(prev => new Set(prev).add(cid));
          }

          if (notifData?.type === 'match_join_request_sent' && notifData?.requester_id === user?.id) {
            setUserSentMatchRequests(prev => new Set(prev).add(String(notifData?.booking_id)));
          }

          if (notifData?.type === 'match_join_confirmed' && notifData?.requester_id === user?.id) {
            setUserAcceptedMatches(prev => new Set(prev).add(String(notifData?.booking_id)));
          }

          // Always refresh items whenever any notification record changes for the current user
          fetchItems();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, fetchItems]);

  // Real-time subscription to booking updates for join_requests/current_players changes
  useEffect(() => {
    const subscription = supabase
      .channel('bookings_join_requests_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings'
        },
        () => {
          fetchItems();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchItems]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop + 50 >= document.documentElement.offsetHeight) {
        if (!loading && !loadingMore && hasMore) {
          fetchItems(true);
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, loadingMore, hasMore, fetchItems]);

  const handleViewTicket = (item: any) => {
    if (!onShowQR) return;

    const currentUserId = String(user?.id || '');
    const isHost = String(item.challenger_id || item.user_id) === currentUserId;
    const isAcceptor = String(item.accepted_by) === currentUserId;

    const holderName = isHost
      ? (user?.display_name || user?.username || item.challenger?.display_name || item.challenger?.username || 'Challenger Host')
      : (isAcceptor
          ? (user?.display_name || user?.username || item.acceptor?.display_name || item.acceptor?.username || 'Challengee Acceptor')
          : (user?.display_name || user?.username || 'Player'));

    const participantCheckedIn = isHost
      ? Boolean(item.challenger_checked_in)
      : (isAcceptor ? Boolean(item.acceptor_checked_in) : Boolean(item.status === 'confirmed'));

    if (item.type === 'match') {
      const role = isHost ? 'MATCH HOST' : 'MATCH PARTICIPANT';
      const reqs = Array.isArray(item.join_requests) ? item.join_requests : [];
      const userJoinReqs = reqs.filter((r: any) => String(r.requester_id || r.userId) === currentUserId && String(r.status || 'accepted').toLowerCase() === 'accepted');

      const tickets: any[] = [];
      if (isHost) {
        tickets.push({
          id: item.id,
          qrNo: 'QR #1',
          ticketNumber: 1,
          groupSize: 'Host Ticket',
          slotTime: item.slot_time || item.slotTime,
          date: item.date,
          holderName,
          role: 'MATCH HOST',
          qrData: `match:${item.id}:host:${currentUserId || 'guest'}`,
          participantCheckedIn: Boolean(item.host_checked_in || item.checked_in || item.status === 'confirmed'),
          status: item.status || 'booked'
        });

        userJoinReqs.forEach((req: any, idx: number) => {
          tickets.push({
            id: req.id,
            qrNo: `QR #${idx + 2}`,
            ticketNumber: idx + 2,
            groupSize: `${req.group_size || 1} Player(s)`,
            slotTime: item.slot_time || item.slotTime,
            date: item.date,
            holderName: req.player_name || holderName,
            role: 'ADDITIONAL PLAYERS',
            qrData: `match:${req.id}:player:${currentUserId || 'guest'}`,
            participantCheckedIn: Boolean(req.checked_in),
            status: item.status || 'booked'
          });
        });
      } else if (userJoinReqs.length > 0) {
        userJoinReqs.forEach((req: any, idx: number) => {
          tickets.push({
            id: req.id,
            qrNo: `QR #${idx + 1}`,
            ticketNumber: idx + 1,
            groupSize: `${req.group_size || 1} Player(s)`,
            slotTime: item.slot_time || item.slotTime,
            date: item.date,
            holderName: req.player_name || holderName,
            role: 'MATCH PARTICIPANT',
            qrData: `match:${req.id}:player:${currentUserId || 'guest'}`,
            participantCheckedIn: Boolean(req.checked_in),
            status: item.status || 'booked'
          });
        });
      } else {
        tickets.push({
          id: item.id,
          qrNo: 'QR #1',
          ticketNumber: 1,
          groupSize: '1 Ticket',
          slotTime: item.slot_time || item.slotTime,
          date: item.date,
          holderName,
          role,
          qrData: `match:${item.id}:player:${currentUserId || 'guest'}`,
          participantCheckedIn: Boolean(item.checked_in || item.status === 'confirmed'),
          status: item.status || 'booked'
        });
      }

      const adaptedMatchBooking = {
        ...item,
        id: item.id,
        status: item.status || 'booked',
        slotTime: item.slot_time || item.slotTime,
        date: item.date,
        holderName,
        role,
        qrData: tickets[0]?.qrData || `match:${item.id}:${isHost ? 'host' : 'player'}:${currentUserId}`,
        participantCheckedIn: tickets[0]?.participantCheckedIn || false,
        tickets
      };
      onShowQR(adaptedMatchBooking, item.box || item.location);
    } else {
      const role = isHost ? 'CHALLENGER (HOST)' : (isAcceptor ? 'CHALLENGEE (ACCEPTOR)' : 'MATCH PARTICIPANT');
      const qrData = `challenge:${item.id}:${isHost ? 'host' : 'acceptor'}:${currentUserId || 'guest'}`;
      const adaptedChallengeBooking = {
        id: item.id,
        status: item.status || 'booked',
        slotTime: item.slot_time,
        date: item.date,
        holderName,
        opponentName: isHost
          ? (item.acceptor?.display_name || item.acceptor?.username)
          : (item.challenger?.display_name || item.challenger?.username),
        role,
        qrData,
        sport: item.sport,
        participantCheckedIn
      };
      onShowQR(adaptedChallengeBooking, item.box);
    }
  };

  const handlePaymentSuccess = async (paymentDetails: { utr?: string; method: string }) => {
    if (!paymentItem) return;

    setProcessingId(paymentItem.id);
    try {
      if (squadJoinMatch) {
        const newCurrent = Number(squadJoinMatch.current_players || 0) + squadJoinCount;

        await supabase
          .from('bookings')
          .update({ current_players: newCurrent })
          .eq('id', squadJoinMatch.id);

        await supabase
          .from('join_requests')
          .insert([{
            booking_id: squadJoinMatch.id,
            requester_id: user.id,
            player_name: user.display_name || user.username || user.email || 'Player',
            phone: user.phone_number || 'N/A',
            group_size: squadJoinCount,
            status: 'accepted'
          }]);

        const { bookingService } = await import('../services/bookingService');
        await bookingService.recordPayment({
          booking_id: squadJoinMatch.booking_id || squadJoinMatch.id,
          user_id: user.id,
          amount: squadJoinAmount,
          payment_type: 'full',
          payment_method: paymentDetails.method
        });

        const hostId = squadJoinMatch.user_id || squadJoinMatch.challenger_id;
        if (hostId) {
          await supabase.from('notifications').insert([
            {
              user_id: hostId,
              title: 'SQUAD MEMBER JOINED!',
              message: `${user.display_name || user.username || 'A player'} joined your match with ${squadJoinCount} player(s)! (${newCurrent}/${squadJoinMatch.max_players})`,
              is_read: false,
              data: {
                type: 'match_joined_host',
                booking_id: squadJoinMatch.id,
                sport: squadJoinMatch.sport || selectedSport
              }
            },
            {
              user_id: user.id,
              title: 'SQUAD JOINED!',
              message: `You successfully joined the match at ${squadJoinMatch.box?.name || 'Arena'} for ${squadJoinMatch.slot_time}!`,
              is_read: false,
              data: {
                type: 'match_joined_self',
                booking_id: squadJoinMatch.id,
                sport: squadJoinMatch.sport || selectedSport
              }
            }
          ]);
        }

        setUserAcceptedMatches(prev => new Set(prev).add(String(squadJoinMatch.id)));
        setItems(prevItems => prevItems.map(i => {
          if (String(i.id) === String(squadJoinMatch.id)) {
            return {
              ...i,
              current_players: newCurrent,
              userAcceptedMembers: (i.userAcceptedMembers || 0) + squadJoinCount
            };
          }
          return i;
        }));

        setProcessingId(null);
        showSuccess("SQUAD JOINED!", `Successfully joined match for ${squadJoinCount} spot(s)!`, () => {
          setShowSuccessModal(false);
          setSquadJoinMatch(null);
          setPaymentItem(null);
          fetchItems();
        });
        return;
      }

      console.log('💳 Processing payment success for challenge:', paymentItem.id);
      const details = calculatePaymentDetails(paymentItem);

      if (isFinalSettlementPayment) {
        await supabase
          .from('challenges')
          .update({ settlement_status: 'completed' })
          .eq('id', paymentItem.id);

        // Record settlement payment
        if (details.settlementBalance > 0 || paymentDetails.method === 'settled') {
          await bookingService.recordPayment({
            booking_id: paymentItem.booking_id,
            challenge_id: paymentItem.id,
            user_id: user.id,
            amount: details.settlementBalance,
            payment_type: 'settlement',
            payment_method: paymentDetails.method
          });
        }

        setItems(prevItems => prevItems.map(i => i.id === paymentItem.id ? { ...i, settlement_status: 'completed' } : i));
        setProcessingId(null);
        showSuccess("SETTLEMENT SUCCESS", paymentDetails.method === 'settled' ? "Final settlement balance settled in advances!" : "Final settlement balance paid successfully!", () => {
          setShowSuccessModal(false);
          setPaymentItem(null);
          setIsFinalSettlementPayment(false);
        });
        return;
      }

      // 1. Update Challenge status using security definer RPC
      const confirmRpc = await supabase.rpc('confirm_challenge_payment', {
        p_challenge_id: String(paymentItem.id)
      });

      if (confirmRpc.error) {
        console.warn('⚠️ RPC confirm_challenge_payment failed, using direct update fallback:', confirmRpc.error.message);
        const { error: payError } = await supabase
          .from('challenges')
          .update({
            status: 'booked',
            acceptor_payment_status: 'paid'
          })
          .eq('id', paymentItem.id);

        if (payError) {
          console.error('❌ Failed to update challenge status:', payError);
        }
      }

      // Record acceptor advance payment
      await bookingService.recordPayment({
        booking_id: paymentItem.booking_id,
        challenge_id: paymentItem.id,
        user_id: user.id,
        amount: details.acceptorPayableAdvance,
        payment_type: 'advance',
        payment_method: paymentDetails.method
      });

      // 2. If it's linked to a booking, update the booking status too
      if (paymentItem.booking_id) {
        await supabase
          .from('bookings')
          .update({ status: 'booked' })
          .eq('id', paymentItem.booking_id);
      }

      // 3. Immediately update local state to reflect booking
      setItems(prevItems => prevItems.map(i => {
        if (String(i.id) === String(paymentItem.id)) {
          return { ...i, status: 'booked', acceptor_payment_status: 'paid' };
        }
        return i;
      }));
      setUserAcceptedChallenges(prev => new Set(prev).add(String(paymentItem.id)));

      // 4. Send confirmation notifications so fetchItems detects the new state
      try {
        await supabase.from('notifications').insert([
          {
            user_id: paymentItem.challenger_id,
            title: 'CHALLENGE BOOKED - PAYMENT RECEIVED',
            message: `The acceptor has paid the advance. Match booked for ${paymentItem.box?.name || 'Arena'} on ${paymentItem.date} at ${paymentItem.slot_time}!`,
            is_read: false,
            data: {
              type: 'challenge_confirmed',
              challenge_id: paymentItem.id,
              requester_id: user.id,
              date: paymentItem.date,
              slot_time: paymentItem.slot_time,
              sport: paymentItem.sport || selectedSport
            }
          },
          {
            user_id: user.id,
            title: 'CHALLENGE BOOKED!',
            message: `Your payment was successful. Match booked for ${paymentItem.box?.name || 'Arena'} on ${paymentItem.date} at ${paymentItem.slot_time}!`,
            is_read: false,
            data: {
              type: 'challenge_confirmed',
              challenge_id: paymentItem.id,
              challenger_id: paymentItem.challenger_id,
              date: paymentItem.date,
              slot_time: paymentItem.slot_time,
              sport: paymentItem.sport || selectedSport
            }
          }
        ]);
      } catch (notifyErr) {
        console.warn('⚠️ Failed to send payment confirmation notifications:', notifyErr);
      }

      // 5. Show success and prepare for ticket view
      showSuccess("PAYMENT SUCCESS", "Match booked! You can now view your ticket.", () => {
        setShowSuccessModal(false);
        if (paymentItem) {
          handleViewTicket(paymentItem);
        }
        setPaymentItem(null);
      });

      // 6. Background refresh with multiple retries to ensure DB consistency
      setTimeout(fetchItems, 800);
      setTimeout(fetchItems, 2500);
    } catch (e) {
      const err = handleError(e);
      console.error('❌ Payment confirmation failed:', err);
      onAlert?.(err.message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleAction = async (item: any, action: 'request' | 'join' | 'accept-request' | 'cancel-request' | 'reject-request' | 'pay-advance', requesterId?: string) => {
    let modalTriggered = false;
    if (!user?.id) {
      onAlert?.("Please log in first", 'error');
      return;
    }

    if (action === 'cancel-request') {
      setProcessingId(item.id);
      try {
        const { bookingService } = await import('../services/bookingService');
        const hostId = item.user_id || item.challenger_id;

        // 1. Call RPC cancel_match_join_request (SECURITY DEFINER) which deletes notification records for BOTH host and requester
        try {
          await bookingService.cancelJoinRequest(item.id, user.id, hostId);
        } catch (e) {
          console.warn("RPC cancel failed", e);
        }

        // 2. Direct fallback delete for user's own notifications
        try {
          await supabase
            .from('notifications')
            .delete()
            .eq('user_id', user.id)
            .or(`data->>challenge_id.eq.${item.id},data->>booking_id.eq.${item.id}`);
        } catch (e) {
          console.warn("Cleanup failed", e);
        }

        // 3. Send Cancellation Notifications (Always send if cleanup succeeded)
        const cancelNotifs = [
          {
            user_id: hostId,
            title: 'REQUEST CANCELLED',
            message: `${user.display_name || user.email || 'A player'} cancelled their request for ${item.box?.name || 'Arena'} on ${item.date} at ${item.slot_time}.`,
            is_read: false,
            data: {
              type: 'request_cancelled',
              booking_id: item.id,
              challenge_id: item.id,
              requester_id: user.id,
              date: item.date,
              slot_time: item.slot_time,
              sport: item.sport || selectedSport
            }
          },
          {
            user_id: user.id,
            title: 'REQUEST CANCELLED',
            message: `Your request for ${item.box?.name || 'Arena'} on ${item.date} at ${item.slot_time} has been cancelled.`,
            is_read: false,
            data: {
              type: 'request_cancelled_self',
              booking_id: item.id,
              challenge_id: item.id,
              host_id: hostId,
              date: item.date,
              slot_time: item.slot_time,
              sport: item.sport || selectedSport
            }
          }
        ];
        await supabase.from('notifications').insert(cancelNotifs);

      setSuccessModalConfig({
        title: "NOTICE",
        message: "Request cancelled",
        onConfirm: () => {
          setSuccessModalConfig(null);
          setShowSuccessModal(false);
          setTimeout(fetchItems, 800);
        }
      });
      setShowSuccessModal(true);
      modalTriggered = true;

      if (item.type === 'challenge') {
        setUserSentRequests(prev => {
          const next = new Set(prev);
          next.delete(String(item.id));
          return next;
        });
      } else {
        setUserSentMatchRequests(prev => {
          const next = new Set(prev);
          next.delete(String(item.id));
          return next;
        });
      }
      fetchItems();
    } catch (err) {
      onAlert?.(handleError(err).message, 'error');
    } finally {
      setProcessingId(null);
    }
    return;
  }



    if (item.type === 'match' && action === 'accept-request') {
      if (!requesterId) throw new Error('Missing requester id');

      setProcessingId(item.id);
      try {
        const { bookingService } = await import('../services/bookingService');
        const request = item.requests.find((r: any) => r.requester_id === requesterId);

        const success = await bookingService.addJoinRequest(
          item.id,
          request?.requester?.username || request?.requester?.display_name || 'Player',
          request?.requester?.phone_number || 'N/A',
          request?.groupSize || 1,
          requesterId
        );

        if (success) {
          // Auto-create/join match chat room
          try {
            const roomName = `Joinable ${item.sport || 'Match'} (${item.date || ''})`;
            await messagingService.createMatchRoom(item.id, user.id, requesterId, roomName, item.max_players || 10);
          } catch (chatErr) {
            console.error('Error creating match chat room:', chatErr);
          }

          // Send manual notification to requester and host for match acceptance
          try {
            await supabase.from('notifications').insert([
              {
                user_id: requesterId,
                title: 'JOINABLE REQUEST ACCEPTED!',
                message: `${user.username || user.display_name || 'A player'} (${user.phone_number || 'N/A'}) accepted your join request for the match at ${item.box?.name || 'Arena'} on ${item.date} at ${item.slot_time}.`,
                is_read: false,
                data: {
                  type: 'match_join_confirmed',
                  booking_id: item.id,
                  requester_id: requesterId,
                  date: item.date,
                  slot_time: item.slot_time,
                  start_hour: item.start_hour,
                  end_hour: item.end_hour,
                  sport: item.sport || selectedSport
                }
              },
              {
                user_id: user.id,
                title: 'JOINABLE REQUEST ACCEPTED!',
                message: `You have accepted the request from ${request?.requester?.username || request?.requester?.display_name || 'a player'} (${request?.requester?.phone_number || 'N/A'}) for the match at ${item.box?.name || 'Arena'} on ${item.date} at ${item.slot_time}.`,
                is_read: false,
                data: {
                  type: 'match_join_confirmed_host',
                  booking_id: item.id,
                  requester_id: requesterId,
                  date: item.date,
                  slot_time: item.slot_time,
                  start_hour: item.start_hour,
                  end_hour: item.end_hour,
                  sport: item.sport || selectedSport
                }
              }
            ]);
          } catch (notifyErr) {
            console.error('Error sending notification:', notifyErr);
          }

          setSuccessModalConfig({
            title: "SUCCESS",
            message: "Request accepted!",
            onConfirm: () => {
              setSuccessModalConfig(null);
              setShowSuccessModal(false);
              fetchItems();
            }
          });
          setShowSuccessModal(true);

          // Update item state
          setItems(prevItems => prevItems.map(i => {
            if (i.id === item.id) {
              const newCurrent = (i.current_players || 0) + (request?.groupSize || 1);
              return {
                ...i,
                current_players: newCurrent,
                requests: i.requests.filter((r: any) => String(r.requester_id) !== String(requesterId))
              };
            }
            return i;
          }));
        }
      } catch (err) {
        onAlert?.(handleError(err).message, 'error');
      } finally {
        setProcessingId(null);
      }
      return;
    }

    setProcessingId(item.id);
    try {
      if (item.type === 'challenge') {
        if (action === 'request') {
          if (item.status !== 'active') {
            setSuccessModalConfig({
              title: "NOTICE",
              message: "This challenge is no longer open for requests.",
              onConfirm: () => {
                setSuccessModalConfig(null);
                setShowSuccessModal(false);
              }
            });
            setShowSuccessModal(true);
            modalTriggered = true;
            return;
          }

          if (userRejectedChallenges.has(String(item.id))) {
            onAlert?.('Your request for this challenge was rejected and you cannot re-apply.', 'error');
            return;
          }

          const { data: existingRequestRows, error: existingRequestError } = await supabase
            .from('notifications')
            .select('id, data')
            .eq('user_id', item.challenger_id)
            .order('created_at', { ascending: false })
            .limit(100);

          if (existingRequestError) throw existingRequestError;

          const existingRequest = (existingRequestRows || []).find((row: any) => (
            row?.data?.type === 'challenge_request' &&
            String(row?.data?.challenge_id) === String(item.id) &&
            String(row?.data?.requester_id) === String(user.id)
          ));

          if (existingRequest) {
            setSuccessModalConfig({
              title: "NOTICE",
              message: "Request already sent. Please wait for challenger approval.",
              onConfirm: () => {
                setSuccessModalConfig(null);
                setShowSuccessModal(false);
              }
            });
            setShowSuccessModal(true);
            modalTriggered = true;
            return;
          }

          const { error: requestInsertError } = await supabase.from('notifications').insert([
            {
              user_id: item.challenger_id,
              title: 'NEW CHALLENGE REQUEST',
              message: `${user.email || user.username || user.display_name || 'A player'} (${user.phone_number || 'N/A'}) requested to accept your challenge at ${item.box?.name || 'Arena'} for ${item.date} at ${item.slot_time}.`,
              is_read: false,
              data: {
                type: 'challenge_request',
                challenge_id: item.id,
                requester_id: user.id,
                date: item.date,
                slot_time: item.slot_time,
                start_hour: item.start_hour,
                end_hour: item.end_hour,
                sport: item.sport || selectedSport,
                requester_details: {
                  username: user.username,
                  display_name: user.display_name,
                  phone_number: user.phone_number,
                  avatar_url: user.avatar_url
                }
              }
            },
            {
              user_id: user.id,
              title: 'Request Sent',
              message: `Request sent to ${item.challenger?.username || item.challenger?.display_name || 'challenger'} (${item.challenger?.phone_number || 'N/A'}) for ${item.box?.name || 'Arena'} on ${item.date} at ${item.slot_time}.`,
              is_read: false,
              data: {
                type: 'challenge_request_sent',
                challenge_id: item.id,
                requester_id: user.id,
                challenger_id: item.challenger_id,
                date: item.date,
                slot_time: item.slot_time,
                start_hour: item.start_hour,
                end_hour: item.end_hour,
                sport: item.sport || selectedSport
              }
            }
          ]);

          if (requestInsertError) throw requestInsertError;

          // Immediately update local state
          setUserSentRequests(prev => new Set(prev).add(String(item.id)));

          showSuccess("SUCCESS", "Request sent to challenger.", () => {
            setShowSuccessModal(false);
            setTimeout(fetchItems, 800);
          });
          modalTriggered = true;
        } else if (action === 'accept-request') {
          if (!requesterId) throw new Error('Missing requester id');

          // Verify user is the challenger
          if (item.challenger_id !== user.id) {
            throw new Error('Only the challenger can accept requests');
          }

          let initialStatus = 'pending_payment';
          let isAdvance = true;

          // Call security definer RPC function for atomic update and notification handling
          const rpcRes = await supabase.rpc('accept_challenge_request', {
            p_challenge_id: String(item.id),
            p_requester_id: String(requesterId)
          });

          if (rpcRes.error) {
            console.warn('RPC accept_challenge_request failed, using direct fallback:', rpcRes.error.message);
            isAdvance = item.payment_type === 'advance' || (item.box?.min_advance && item.box.min_advance > 0) || (item.box?.minAdvance && item.box.minAdvance > 0);
            initialStatus = isAdvance ? 'pending_payment' : 'booked';

            const updatePayload = {
              status: initialStatus,
              accepted_by: requesterId,
              acceptor_payment_status: isAdvance ? 'pending' : 'paid'
            };

            const updateResponse = await supabase
              .from('challenges')
              .update(updatePayload)
              .eq('id', item.id)
              .select();

            if (updateResponse.error) throw updateResponse.error;

            const requesterDetails = item.requests?.find((r: any) => r.requester_id === requesterId)?.requester;

            const { error: confirmInsertError } = await supabase.from('notifications').insert([
              {
                user_id: requesterId,
                title: isAdvance ? 'CHALLENGE REQUEST ACCEPTED - PAYMENT REQUIRED' : 'CHALLENGE REQUEST ACCEPTED!',
                message: isAdvance
                  ? `${user.display_name || 'Host'} accepted your request. Please pay the advance to confirm the match.`
                  : `${user.email || user.username || user.display_name || 'A player'} (${user.phone_number || 'N/A'}) accepted your challenge request. Match booked for ${item.box?.name || 'Arena'} at ${item.slot_time}!`,
                is_read: false,
                target_url: isAdvance ? `/challenges?id=${item.id}` : undefined,
                data: {
                  type: isAdvance ? 'challenge_payment_pending' : 'challenge_confirmed',
                  challenge_id: item.id,
                  challenger_id: user.id,
                  requester_id: requesterId,
                  date: item.date,
                  slot_time: item.slot_time,
                  sport: item.sport || selectedSport
                }
              },
              {
                user_id: user.id,
                title: isAdvance ? 'WAITING FOR ACCEPTOR PAYMENT' : 'CHALLENGE REQUEST ACCEPTED!',
                message: isAdvance
                  ? `You accepted ${requesterDetails?.display_name || 'a player'}. Match will be confirmed once they pay the advance.`
                  : `You have accepted the request from ${requesterDetails?.username || requesterDetails?.display_name || 'a player'} (${requesterDetails?.phone_number || 'N/A'}) for ${item.box?.name || 'Arena'} at ${item.slot_time}. Match booked!`,
                is_read: false,
                data: {
                  type: isAdvance ? 'challenge_waiting_payment' : 'challenge_confirmed_host',
                  challenge_id: item.id,
                  requester_id: requesterId,
                  challenger_id: user.id,
                  date: item.date,
                  slot_time: item.slot_time,
                  sport: item.sport || selectedSport
                }
              }
            ]);

            if (confirmInsertError) throw confirmInsertError;
          } else {
            isAdvance = rpcRes.data?.is_advance ?? true;
            initialStatus = rpcRes.data?.status || (isAdvance ? 'pending_payment' : 'booked');
          }

          // Auto-create/join match chat room
          try {
            const roomName = `${item.sport || 'Cricket'} Match (${item.date || ''} ${item.slot_time || ''})`;
            await messagingService.createMatchRoom(item.id, user.id, requesterId, roomName, 10);
          } catch (chatErr) {
            console.error('Error creating match chat room:', chatErr);
          }

          setSuccessModalConfig({
            title: "SUCCESS",
            message: isAdvance ? 'Request accepted! Waiting for acceptor payment.' : 'Request accepted and match booked!',
            onConfirm: () => {
              setSuccessModalConfig(null);
              setShowSuccessModal(false);
              fetchItems();
            }
          });
          setShowSuccessModal(true);
          modalTriggered = true;

          // Immediately update local state
          const updatePayload = {
            status: initialStatus,
            accepted_by: requesterId,
            acceptor_payment_status: isAdvance ? 'pending' : 'paid'
          };
          setHostAcceptedChallenges(prev => new Set(prev).add(String(item.id)));
          setItems(prevItems => prevItems.map(i => {
            if (i.id === item.id) {
              return { ...i, ...updatePayload };
            }
            return i;
          }));
        } else if (action === 'pay-advance') {
          console.log('💰 Opening payment for item:', item.id, 'Box details:', item.box);
          setPaymentItem(item);
          setShowPaymentSummary(true);
          modalTriggered = true; // Technically a different modal but counts
          return;
        } else if (action === 'reject-request') {
          if (!requesterId) throw new Error('Missing requester id');

          // Verify user is the challenger
          if (item.challenger_id !== user.id) {
            throw new Error('Only the challenger can reject requests');
          }

          const requesterDetails = item.requests.find((r: any) => r.requester_id === requesterId)?.requester;

          // Send rejection notification
          const { error: rejectInsertError } = await supabase.from('notifications').insert([
            {
              user_id: requesterId,
              title: 'CHALLENGE REQUEST REJECTED',
              message: `${user.username || user.display_name || 'The challenger'} declined your request for the match at ${item.box?.name || 'Arena'} on ${item.date}.`,
              is_read: false,
              data: {
                type: 'challenge_rejected',
                challenge_id: item.id,
                challenger_id: user.id,
                date: item.date,
                slot_time: item.slot_time,
                sport: item.sport || selectedSport
              }
            }
          ]);

          if (rejectInsertError) throw rejectInsertError;

          // Cleanup notifications for BOTH parties via RPC (SECURITY DEFINER)
          try {
            await supabase.rpc('reject_challenge_request', {
              p_challenge_id: String(item.id),
              p_requester_id: String(requesterId)
            });
          } catch (e) {
            console.warn('Failed to cleanup notification via RPC:', e);
            const hostReqNotif = item.requests.find((r: any) => String(r.requester_id) === String(requesterId));
            if (hostReqNotif?.notification_id) {
              await supabase.from('notifications').delete().eq('id', hostReqNotif.notification_id);
            }
          }

          showSuccess("NOTICE", "Request declined.", () => {
            setShowSuccessModal(false);
            setTimeout(fetchItems, 800);
          }, 'notice');
          modalTriggered = true;

          // Update local items state
          setItems(prevItems => prevItems.map(i => {
            if (i.id === item.id) {
              return {
                ...i,
                requests: i.requests.filter((r: any) => String(r.requester_id) !== String(requesterId))
              };
            }
            return i;
          }));

          // If no more requests, close the expanded list
          const remainingReqs = item.requests.filter((r: any) => String(r.requester_id) !== String(requesterId));
          if (remainingReqs.length === 0) {
            setExpandedChallengeId(null);
          }
        }
      } else {
        setProcessingId(item.id);
        const { bookingService } = await import('../services/bookingService');
        const success = await bookingService.sendJoinRequest(item, user, 1);

        if (success) {
          // Send manual notification to host and joiner
          await supabase.from('notifications').insert([
            {
              user_id: item.user_id,
              title: 'NEW JOINABLE REQUEST',
              message: `${user.display_name || user.email || 'A player'} (${user.phone_number || 'N/A'}) requested to join with 1 player(s) for your match on ${item.date} at ${item.slot_time}.`,
              is_read: false,
              data: {
                type: 'match_join_request',
                booking_id: item.id,
                requester_id: user.id,
                groupSize: 1,
                playerName: user.display_name || user.username || user.email,
                phone: user.phone_number,
                sport: item.sport || selectedSport
              }
            },
            {
              user_id: user.id,
              title: 'Request Sent',
              message: `Your join request for the match at ${item.box?.name || 'Arena'} on ${item.date} at ${item.slot_time} has been sent.`,
              is_read: false,
              data: {
                type: 'match_join_request_sent',
                booking_id: item.id,
                host_id: item.user_id,
                sport: item.sport || selectedSport
              }
            }
          ]);

          showSuccess("SUCCESS", "Join request sent!", () => {
            setShowSuccessModal(false);
            setTimeout(fetchItems, 800);
          });
          modalTriggered = true;
          setUserSentMatchRequests(prev => new Set(prev).add(String(item.id)));
        }
      }

      // If no modal is shown, refresh immediately
      if (!modalTriggered) {
        await new Promise(resolve => setTimeout(resolve, 500));
        await fetchItems();
      }
    } catch (err) {
      onAlert?.(handleError(err).message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const getItemSearchScore = (item: any, q: string) => {
    const challengerName = (item.challenger?.username || item.challenger?.display_name || item.host?.username || item.host?.display_name || item.name || '').toLowerCase();
    const challengerEmail = (item.challenger?.email || item.host?.email || '').toLowerCase();
    const arenaName = (item.box?.name || item.location?.name || '').toLowerCase();
    const arenaAddress = (item.box?.address || item.location?.address || '').toLowerCase();
    const sportName = (item.sport || '').toLowerCase();
    const slotTime = (item.slot_time || item.slotTime || '').toLowerCase();
    const dateStr = (item.date || '').toLowerCase();

    const getScore = (text: string, query: string) => {
      const t = text.toLowerCase();
      if (!t) return 0;
      if (t === query) return 10;
      if (t.startsWith(query)) return 8;
      const words = t.split(/[\s,/@._-]+/);
      if (words.some(word => word.startsWith(query))) {
        if (words.some(word => word === query)) return 6;
        return 4;
      }
      if (t.includes(query)) return 2;
      return 0;
    };

    const maxSingleScore = Math.max(
      getScore(challengerName, q),
      getScore(challengerEmail, q),
      getScore(arenaName, q),
      getScore(arenaAddress, q),
      getScore(sportName, q),
      getScore(slotTime, q),
      getScore(dateStr, q)
    );

    if (maxSingleScore > 0) return maxSingleScore;

    const qWords = q.split(/\s+/).filter(Boolean);
    if (qWords.length > 1) {
      const combinedText = `${challengerName} ${challengerEmail} ${arenaName} ${arenaAddress} ${sportName} ${slotTime} ${dateStr}`.toLowerCase();
      if (qWords.every(word => combinedText.includes(word))) {
        return 3;
      }
    }

    return 0;
  };

  const isSportMatch = (itemSport?: string, targetSport?: string) => {
    if (!targetSport) return true;
    if (!itemSport) return false;
    const s1 = String(itemSport).toLowerCase().replace(/[-_ ]/g, '');
    const s2 = String(targetSport).toLowerCase().replace(/[-_ ]/g, '');
    return s1.includes(s2) || s2.includes(s1);
  };

  const filteredItems = items.filter(item => {
    // 1. Filter by Sport if selected
    if (selectedSport && !isSportMatch(item.sport, selectedSport)) {
      return false;
    }

    if (activeTab === 'challenges' && item.type !== 'challenge') return false;
    if (activeTab === 'matches' && item.type !== 'match') return false;
    if (activeTab === 'yours') {
      const isOwner = String(item.challenger_id) === String(user?.id) || String(item.user_id) === String(user?.id);
      const isAcceptedChallenge = String(item.accepted_by) === String(user?.id) || userAcceptedChallenges.has(String(item.id));
      const isAcceptedMatch = userAcceptedMatches.has(String(item.id)) || (item.userAcceptedMembers || 0) > 0;
      const isParticipant = Array.isArray(item.join_requests) && item.join_requests.some((r: any) => String(r.requester_id || r.userId) === String(user?.id) && String(r.status || 'accepted').toLowerCase() === 'accepted');

      if (!isOwner && !isAcceptedChallenge && !isAcceptedMatch && !isParticipant) return false;
    }

    // 2. Filter by Search Query
    if (searchQuery && searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const score = getItemSearchScore(item, q);
      if (score <= 0) return false;
    }

    return true;
  });

  const getStartMinutes = (item: any): number => {
    const sh = item.start_hour ?? item.startHour;
    if (typeof sh === 'number' && !isNaN(sh) && sh > 0) {
      return Math.round(sh * 60);
    }
    const slotStr = item.slot_time || item.slotTime || '';
    if (!slotStr || slotStr === 'TBA') return 0;

    try {
      const rangeParts = slotStr.split('-').map((p: string) => p.trim()).filter(Boolean);
      const firstPart = rangeParts[0] || slotStr.trim();
      const match = firstPart.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const m = match[2] ? parseInt(match[2], 10) : 0;
        const ampm = match[3] ? match[3].toUpperCase() : null;

        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;

        return h * 60 + m;
      }
    } catch (e) {
      // fallback
    }
    return 0;
  };

  const sortedFilteredItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      // 0. Search Relevance Scoring (Prioritize items starting with or matching search query)
      if (searchQuery && searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const scoreA = getItemSearchScore(a, q);
        const scoreB = getItemSearchScore(b, q);
        if (scoreA !== scoreB) return scoreB - scoreA;
      }

      // 1. Priority Sorting (User's own/requested items first = 0, open/available = 1, unavailable = 2, expired = 3)
      const pA = getSortPriority(a);
      const pB = getSortPriority(b);
      if (pA !== pB) return pA - pB;

      // 2. Date Sorting (Chronological Ascending: Earliest/Upcoming dates first)
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;

      // 3. Time Sorting (Chronological Ascending: Earliest time slots e.g. 4-5am before 5-6am)
      const startMinsA = getStartMinutes(a);
      const startMinsB = getStartMinutes(b);
      if (startMinsA !== startMinsB) return startMinsA - startMinsB;

      // 4. Distance Sorting (Fallback)
      if (userProfile && userProfile.latitude != null && userProfile.longitude != null) {
        const distA = calculateDistance(userProfile.latitude, userProfile.longitude, a.box?.latitude || a.location?.latitude, a.box?.longitude || a.location?.longitude);
        const distB = calculateDistance(userProfile.latitude, userProfile.longitude, b.box?.latitude || b.location?.latitude, b.box?.longitude || b.location?.longitude);

        if (distA !== distB) {
          if (distA === Infinity) return 1;
          if (distB === Infinity) return -1;
          if (Math.abs(distA - distB) > 0.01) return distA - distB;
        }
      }

      return 0;
    });
  }, [filteredItems, userProfile, getSortPriority, searchQuery]);

  return (
    <div className="min-h-screen pb-32 max-w-2xl lg:max-w-7xl mx-auto px-4 md:px-4 transition-all duration-300">
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-between mb-8 pt-8 md:pt-6"
      >
        <div className="flex items-center gap-5 md:gap-4">
          <button onClick={onBack} className="p-3.5 md:p-3 rounded-2xl md:rounded-2xl bg-card border border-border hover:bg-background-secondary transition-all shadow-theme-card active:scale-90 md:active:scale-100">
            <ArrowLeft className="w-6 h-6 md:w-5 md:h-5" style={{ color: theme.colors.textPrimary }} />
          </button>
          <div>
            <h1 className="text-3xl md:text-2xl font-black italic md:not-italic uppercase tracking-tighter md:tracking-normal" style={{ color: theme.colors.textPrimary }}>Matchmaking</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] md:tracking-widest opacity-50 md:opacity-50" style={{ color: theme.colors.accent }}>Find your competition</p>
          </div>
        </div>
      </motion.header>

      <div className="flex p-1 bg-card md:bg-card border border-border rounded-2xl md:rounded-2xl mb-6 overflow-x-auto no-scrollbar max-w-md shadow-theme-card md:shadow-none">
        {(['all', 'challenges', 'matches', 'yours'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3.5 md:py-3 px-5 md:px-4 rounded-xl md:rounded-xl text-[10px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-widest transition-all whitespace-nowrap ${activeTab === tab ? 'bg-accent text-white shadow-theme-elevated italic md:not-italic' : 'text-text-secondary hover:text-text-primary'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative mb-8">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="w-5 h-5 opacity-40" style={{ color: theme.colors.textPrimary }} />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search arena, player name, time, joinables..."
          className="w-full pl-12 pr-10 py-4 rounded-2xl border bg-card text-xs md:text-sm font-bold shadow-theme-card transition-all focus:outline-none focus:ring-2 focus:ring-accent"
          style={{ borderColor: theme.colors.border, color: theme.colors.textPrimary }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-4 flex items-center"
          >
            <XCircle className="w-5 h-5 opacity-40 hover:opacity-100 transition-opacity" style={{ color: theme.colors.textPrimary }} />
          </button>
        )}
      </div>

      {error && (
        <div className="mb-8 p-4 rounded-2xl bg-error/10 border border-error/20 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-error" />
          <p className="text-xs font-bold text-error">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 animate-spin" style={{ color: theme.colors.accent }} />
          <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Syncing arena data...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-24 bg-card/50 rounded-[3rem] border border-dashed border-border px-8 max-w-2xl mx-auto">
          <div className="w-20 h-20 bg-accent/5 rounded-full flex items-center justify-center mx-auto mb-6">
            <Users className="w-10 h-10 opacity-20" />
          </div>
          <h2 className="text-lg font-black uppercase italic tracking-tight mb-2" style={{ color: theme.colors.textPrimary }}>Empty Arena</h2>
          <p className="text-xs font-bold opacity-50 mb-8 max-w-[200px] mx-auto">No items found in this category.</p>
          <button onClick={onBack} className="px-8 py-3 bg-accent text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-theme-elevated">Return to Base</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnimatePresence mode="popLayout">
            {sortedFilteredItems.map((item) => (
              <motion.div
                layout
                key={item.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`p-6 md:p-6 rounded-[2rem] md:rounded-[2.5rem] border relative overflow-hidden transition-all shadow-theme-card ${item.isExpired ? 'opacity-60 grayscale-[0.5]' : ''} bg-card`}
                style={{ borderColor: theme.colors.border }}
              >
                {/* Mobile Specific Header Row */}
                <div className="flex lg:hidden justify-between items-start mb-6 md:mb-4">
                  <div className="flex items-center gap-4 md:gap-3">
                    <div className="w-14 h-14 md:w-12 md:h-12 rounded-[1.25rem] md:rounded-xl bg-background-secondary border border-border overflow-hidden shadow-inner flex items-center justify-center transition-transform duration-500">
                      {item.challenger?.avatar_url || item.host?.avatar_url ? (
                        <img src={item.challenger?.avatar_url || item.host?.avatar_url} alt="Host" className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-6 h-6 md:w-5 md:h-5 opacity-40 md:opacity-30" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-black italic uppercase tracking-tighter md:tracking-tight text-base md:text-sm leading-tight text-text-primary">
                        {item.challenger?.username || item.challenger?.display_name || item.host?.username || item.host?.display_name || item.name || 'Private Player'}
                      </h3>
                      <p className="text-[10px] md:text-[10px] font-black uppercase md:normal-case tracking-widest md:tracking-normal opacity-40 md:opacity-60 text-accent md:text-blue-600">
                        @{item.challenger?.username || item.host?.username || item.challenger?.display_name?.toLowerCase().replace(/\s+/g, '_') || item.host?.display_name?.toLowerCase().replace(/\s+/g, '_') || 'user'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 md:gap-1">
                    <span className="text-[9px] md:text-[8px] font-black uppercase tracking-[0.2em] text-right" style={{
                      color: item.isExpired ? theme.colors.textDisabled :
                             item.type === 'challenge'
                               ? (matchResults.some(r => r.challenge_id === item.id) ? theme.colors.accent : (item.status === 'active' ? theme.colors.error : (item.status === 'booked' ? theme.colors.accent : (item.status === 'confirmed' || String(item.acceptor_payment_status).toLowerCase() === 'paid' ? theme.colors.success : (item.status === 'pending_payment' ? theme.colors.accent : theme.colors.textDisabled)))))
                               : theme.colors.success
                    }}>
                      {item.isExpired ? 'EXPIRED' :
                       item.type === 'challenge'
                         ? (matchResults.some(r => r.challenge_id === item.id) ? (item.lose_to_pay ? 'LOSE TO PAY' : 'FINISHED') : (item.status === 'active' ? 'OPEN' : (item.status === 'booked' ? 'BOOKED' : (item.status === 'confirmed' || String(item.acceptor_payment_status).toLowerCase() === 'paid' ? 'CONFIRMED' : (item.status === 'pending_payment' ? 'PENDING PAYMENT' : 'CLOSED')))))
                         : 'JOINABLE'}
                    </span>
                    {item.type === 'challenge' && item.lose_to_pay && (
                      <span className="text-[7px] md:text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-accent text-white shadow-sm italic md:not-italic">
                        LOSE TO PAY
                      </span>
                    )}
                  </div>
                </div>

                {/* Desktop Absolute Header (Strictly Hidden on Mobile/Tablet) */}
                <div className="hidden lg:flex absolute top-0 right-0 px-6 py-2 rounded-bl-[1.5rem] border-l border-b bg-background-secondary/50 backdrop-blur-md flex-col items-end gap-1" style={{ borderColor: theme.colors.border }}>
                  <span className="text-[8px] font-black uppercase tracking-[0.2em]" style={{
                    color: item.isExpired ? theme.colors.textDisabled :
                           item.type === 'challenge'
                             ? (matchResults.some(r => r.challenge_id === item.id) ? theme.colors.accent : (item.status === 'active' ? theme.colors.error : (item.status === 'booked' ? theme.colors.accent : (item.status === 'confirmed' || String(item.acceptor_payment_status).toLowerCase() === 'paid' ? theme.colors.success : (item.status === 'pending_payment' ? theme.colors.accent : theme.colors.textDisabled)))))
                             : theme.colors.success
                  }}>
                    {item.isExpired ? 'EXPIRED' :
                     item.type === 'challenge'
                       ? (matchResults.some(r => r.challenge_id === item.id) ? (item.lose_to_pay ? 'LOSE TO PAY' : 'FINISHED') : (item.status === 'active' ? 'OPEN' : (item.status === 'booked' ? 'BOOKED' : (item.status === 'confirmed' || String(item.acceptor_payment_status).toLowerCase() === 'paid' ? 'CONFIRMED' : (item.status === 'pending_payment' ? 'PENDING PAYMENT' : 'CLOSED')))))
                       : 'JOINABLE'}
                  </span>
                  {item.type === 'challenge' && item.lose_to_pay && (
                    <span className="text-[7px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full bg-accent text-white shadow-sm animate-pulse">
                      LOSE TO PAY
                    </span>
                  )}
                </div>

                {/* Desktop Header Identity (Hidden on Mobile/Tablet) */}
                <div className="hidden lg:flex items-center gap-4 mb-6 pt-2">
                  <div className="w-14 h-14 rounded-2xl bg-background-secondary border border-border overflow-hidden shadow-inner flex items-center justify-center">
                    {item.challenger?.avatar_url || item.host?.avatar_url ? (
                      <img src={item.challenger?.avatar_url || item.host?.avatar_url} alt="Host" className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-6 h-6 opacity-30" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-black uppercase tracking-widest text-base italic leading-tight" style={{ color: theme.colors.textPrimary }}>
                      {item.challenger?.username || item.challenger?.display_name || item.host?.username || item.host?.display_name || item.name || 'Private Player'}
                    </h3>
                    <p className="text-[11px] font-black opacity-60" style={{ color: theme.colors.accent }}>
                      @{item.challenger?.username || item.host?.username || item.challenger?.display_name?.toLowerCase().replace(/\s+/g, '_') || item.host?.display_name?.toLowerCase().replace(/\s+/g, '_') || 'user'}
                    </p>
                  </div>
                </div>

                {/* Property Blocks (Mobile Optimized) */}
                <div className="space-y-3 md:space-y-2 mb-6">
                  {/* Location Row */}
                  <div
                    onClick={() => {
                      const arenaName = item.box?.name || item.location?.name;
                      const sport = item.sport || selectedSport || 'cricket';
                      if (arenaName) {
                        navigate(`/arenas/${sport.toLowerCase()}?search=${encodeURIComponent(arenaName)}`);
                      }
                    }}
                    className="flex items-center justify-between p-3.5 md:p-2.5 bg-background-secondary/50 md:bg-slate-50 border border-border/50 md:border-slate-200/60 rounded-2xl md:rounded-xl cursor-pointer hover:bg-background-secondary transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-[9px] md:text-[8px] font-black uppercase tracking-widest md:tracking-wider opacity-40 md:text-slate-400">Arena</p>
                      <p className="text-[11px] md:text-[10px] font-black uppercase italic md:not-italic text-text-primary md:text-slate-700 truncate">{item.box?.name || item.location?.name || 'Main Arena'}</p>
                      {(item.box?.address || item.location?.address) && (
                        <p className="text-[9px] md:text-[8px] font-medium text-text-disabled md:text-slate-400 truncate">
                          {item.box?.address || item.location?.address}
                        </p>
                      )}
                    </div>
                    {(() => {
                      const boxLat = item.box?.latitude || item.location?.latitude;
                      const boxLng = item.box?.longitude || item.location?.longitude;

                      if (userProfile?.latitude != null && userProfile?.longitude != null && boxLat != null && boxLng != null) {
                        const d = calculateDistance(userProfile.latitude, userProfile.longitude, boxLat, boxLng);
                        if (d !== Infinity) {
                          return (
                            <div className="bg-accent/10 border border-accent/20 px-3 py-1.5 md:px-2.5 md:py-1 rounded-xl md:rounded-lg flex items-center gap-2 md:gap-1.5 shadow-sm">
                              <Navigation className="w-3 h-3 md:w-2.5 md:h-2.5 text-accent" />
                              <span className="text-[10px] md:text-[9px] font-black text-accent tracking-tighter italic">
                                {formatDistance(d)}
                              </span>
                            </div>
                          );
                        }
                      }
                      return null;
                    })()}
                  </div>

                  {/* Slot Track */}
                  <div className="flex items-center gap-3 md:gap-2.5 p-3.5 md:p-2.5 bg-blue-500/5 md:bg-blue-50/50 border border-blue-500/10 md:border-blue-100/50 rounded-2xl md:rounded-xl text-blue-500 md:text-blue-700">
                    <Clock className="w-4 h-4 md:w-3.5 md:h-3.5 text-blue-500" />
                    <div className="flex items-center gap-3 md:gap-2 text-[11px] md:text-[10px] font-black uppercase tracking-widest md:tracking-wide">
                      <span className="italic md:not-italic">{formatDate(item.date)}</span>
                      {item.slot_time && item.slot_time !== 'TBA' && (
                        <>
                          <div className="w-1.5 h-1.5 md:w-1 md:h-1 rounded-full bg-blue-300" />
                          <span className="text-text-primary md:text-blue-900">{item.slot_time}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Player Status / Format */}
                {(item.type === 'match' || item.type === 'challenge') && (
                  <div className="mb-8 md:mb-6 bg-background-secondary/30 md:bg-slate-50/50 p-4 md:p-2.5 rounded-2xl md:rounded-xl border border-border md:border-slate-100">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] md:text-[9px] font-black uppercase tracking-widest md:tracking-wider opacity-40 md:text-slate-400">
                        {item.type === 'challenge' ? 'Match Format' : 'Availability'}
                      </p>
                      <div className="flex items-center gap-3 md:gap-2">
                        <span className="text-sm md:text-xs font-black text-text-primary md:text-slate-800 italic md:not-italic">
                          {item.type === 'challenge'
                            ? `${item.max_players / 2}v${item.max_players / 2}`
                            : `${item.current_players} / ${item.max_players}`}
                        </span>
                        {item.type === 'match' && (
                          <div className="w-20 md:w-16 h-2 md:h-1.5 bg-background-secondary md:bg-slate-200 rounded-full overflow-hidden shadow-inner">
                            <div className="h-full bg-accent transition-all duration-500 shadow-accentGlow" style={{ width: `${(item.current_players / item.max_players) * 100}%` }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}


                {item.type === 'match' ? (
                  <div className="flex flex-col gap-3">
                    {(String(item.user_id) === String(user?.id) || String(item.challenger_id) === String(user?.id) || userAcceptedMatches.has(String(item.id)) || (item.userAcceptedMembers || 0) > 0 || (Array.isArray(item.join_requests) && item.join_requests.some((r: any) => String(r.requester_id || r.userId) === String(user?.id) && String(r.status || 'accepted').toLowerCase() === 'accepted'))) ? (
                      <>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleViewTicket(item)}
                          className="w-full py-4 rounded-2xl bg-accent text-white font-black uppercase text-xs tracking-[0.2em] shadow-theme-elevated transition-all flex items-center justify-center gap-3"
                        >
                          <QrCode className="w-5 h-5" /> View Your Ticket
                        </motion.button>
                        {Number(item.current_players || 0) < Number(item.max_players || 10) && (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setSquadJoinMatch(item)}
                            className="w-full py-4 rounded-2xl bg-background-secondary border border-border text-text-primary font-black uppercase text-xs tracking-[0.2em] shadow-theme-card transition-all flex items-center justify-center gap-3"
                          >
                            <Users className="w-5 h-5" /> Add More Players
                          </motion.button>
                        )}
                      </>
                    ) : Number(item.current_players || 0) >= Number(item.max_players || 10) ? (
                      <div className="p-5 rounded-2xl bg-white/5 border border-white/10 border-dashed text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest italic opacity-40" style={{ color: theme.colors.textDisabled }}>
                          MATCH FULL ({item.current_players} / {item.max_players})
                        </p>
                      </div>
                    ) : (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={!!processingId || item.isExpired}
                        onClick={() => setSquadJoinMatch(item)}
                        className={`w-full py-5 rounded-2xl ${item.isExpired ? 'bg-background-secondary text-text-disabled cursor-not-allowed opacity-50' : 'bg-accent text-white shadow-theme-elevated'} font-black uppercase text-xs tracking-[0.2em] transition-all flex items-center justify-center gap-3`}
                      >
                        {item.isExpired ? 'Session Expired' : <><Users className="w-5 h-5" /> Join Match</>}
                      </motion.button>
                    )}
                  </div>
                ) : (item.challenger_id === user?.id || item.user_id === user?.id) ? (
                  // Host view: review incoming requests and accept them.
                  (item.type === 'challenge' && (item.status === 'confirmed' || item.status === 'booked' || item.status === 'pending_payment' || !!item.accepted_by || userAcceptedChallenges.has(String(item.id)) || hostAcceptedChallenges.has(String(item.id)))) ? (
                    <div className="flex flex-col gap-3">
                      <div className="p-5 rounded-2xl bg-success/10 border border-success/20 border-dashed text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest italic" style={{ color: theme.colors.success }}>
                          {(() => {
                            if (item.status === 'pending_payment' && String(item.acceptor_payment_status).toLowerCase() !== 'paid') {
                              const acceptorUser = item.acceptor?.username ? `@${item.acceptor.username}` : (item.acceptor?.display_name || 'Acceptor');
                              return `Request Approved - Waiting for ${acceptorUser} Payment`;
                            }
                            return item.status === 'booked' ? 'Request Accepted - Match Booked' : 'Request Accepted - Match Confirmed';
                          })()}
                        </p>
                      </div>
                      {(item.status === 'confirmed' || item.status === 'booked' || String(item.acceptor_payment_status).toLowerCase() === 'paid') && (
                        <>
                          {(() => {
                            const details = calculatePaymentDetails(item);
                            const res = matchResults.find(r => String(r.challenge_id) === String(item.id));

                            if (item.settlement_status === 'completed') {
                              let payerInfo = "Settled in advances";
                              if (details.settlementBalance > 0 && res) {
                                const isTie = res.winner_id === null && res.loser_id === null;
                                if (isTie) payerInfo = `Paid by Challenger (${item.challenger?.display_name || 'Host'})`;
                                else if (!item.lose_to_pay) payerInfo = `Paid by Challenger (${item.challenger?.display_name || 'Host'})`;
                                else {
                                  const loser = String(res.loser_id) === String(item.challenger_id) ? item.challenger : item.acceptor;
                                  payerInfo = `Paid by Loser (${loser?.display_name || 'Player'})`;
                                }
                              }
                              return (
                                <div className="p-4 rounded-2xl bg-success/10 border border-success/20 border-dashed text-center mb-2">
                                  <p className="text-[10px] font-black uppercase tracking-widest italic" style={{ color: theme.colors.success }}>
                                    Settlement Completed • {payerInfo}
                                  </p>
                                </div>
                              );
                            }

                            let shouldShow = false;
                            if (!res) {
                              shouldShow = false; // Don't show settlement if no result yet
                            } else {
                              const isTie = res.winner_id === null && res.loser_id === null;
                              if (isTie) shouldShow = true;
                              else if (!item.lose_to_pay) shouldShow = true;
                              else if (String(res.loser_id) === String(user?.id)) shouldShow = true;
                            }
                            if (!shouldShow) return null;
                            return (
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => { setPaymentItem(item); setIsFinalSettlementPayment(true); setShowPaymentSummary(true); }}
                                className="w-full py-4 rounded-2xl bg-error text-white font-black uppercase text-xs tracking-[0.2em] shadow-theme-elevated transition-all flex items-center justify-center gap-3 mb-2"
                              >
                                <IndianRupee className="w-5 h-5" /> {details.settlementBalance === 0 ? 'Complete Settlement' : 'Pay Final Settlement'}
                              </motion.button>
                            );
                          })()}
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleViewTicket(item)}
                            className="w-full py-4 rounded-2xl bg-accent text-white font-black uppercase text-xs tracking-[0.2em] shadow-theme-elevated transition-all flex items-center justify-center gap-3"
                          >
                            <QrCode className="w-5 h-5" /> View Ticket
                          </motion.button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setExpandedChallengeId(prev => prev === item.id ? null : item.id)}
                        className="w-full py-4 rounded-2xl bg-accent text-white font-black uppercase text-xs tracking-[0.2em] shadow-theme-elevated transition-all flex items-center justify-center gap-3"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        Accept Request ({item.requests?.length || 0})
                      </motion.button>

                      {expandedChallengeId === item.id && (
                        <div className="space-y-2 p-3 rounded-2xl border" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.backgroundSecondary }}>
                          {(item.requests || []).length === 0 ? (
                            <p className="text-[10px] font-black uppercase tracking-widest text-center" style={{ color: theme.colors.textDisabled }}>
                              No requests yet
                            </p>
                          ) : (
                            (item.requests || []).map((req: any) => (
                              <div key={`${item.id}-${req.requester_id}`} className="p-3 rounded-xl border flex items-center justify-between gap-3" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.card }}>
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-9 h-9 rounded-lg bg-background-secondary border border-border overflow-hidden flex items-center justify-center">
                                    {req.requester?.avatar_url ? (
                                      <img src={req.requester.avatar_url} alt="R" className="w-full h-full object-cover" />
                                    ) : (
                                      <Users className="w-4 h-4 opacity-40" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-black uppercase tracking-wider dynamic-text" style={{ color: theme.colors.textPrimary }}>
                                      {req.requester?.username || req.requester?.display_name || 'Player'}
                                    </p>
                                    <p className="text-[10px] font-bold dynamic-text" style={{ color: theme.colors.textSecondary }}>
                                      @{req.requester?.username || req.requester?.display_name?.toLowerCase().replace(/\s+/g, '_') || 'user'} {req.groupSize > 1 ? `(+${req.groupSize} players)` : ''}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    disabled={!!processingId}
                                    onClick={() => handleAction(item, 'accept-request', req.requester_id)}
                                    className="px-3 py-2 rounded-lg bg-success text-white text-[9px] font-black uppercase tracking-widest disabled:opacity-70"
                                  >
                                    {processingId === item.id ? '...' : 'Accept'}
                                  </button>
                                  <button
                                    disabled={!!processingId}
                                    onClick={() => handleAction(item, 'reject-request', req.requester_id)}
                                    className="px-3 py-2 rounded-lg bg-error text-white text-[9px] font-black uppercase tracking-widest disabled:opacity-70"
                                  >
                                    {processingId === item.id ? '...' : 'Reject'}
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )
                ) : item.type === 'challenge' && (String(item.accepted_by) === String(user?.id) || userAcceptedChallenges.has(String(item.id))) ? (
                  <div className="flex flex-col gap-3">
                    {(item.status === 'pending_payment' && String(item.acceptor_payment_status).toLowerCase() !== 'paid') ? (
                      <>
                        <div className="p-5 rounded-2xl bg-accent/10 border border-accent/20 border-dashed text-center">
                          <p className="text-[10px] font-black uppercase tracking-widest italic" style={{ color: theme.colors.accent }}>
                            PAYMENT REQUIRED TO CONFIRM MATCH
                          </p>
                          <p className="text-[9px] font-bold mt-1 opacity-60">Pay the advance to get your ticket</p>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleAction(item, 'pay-advance')}
                          disabled={!!processingId}
                          className="w-full py-4 rounded-2xl bg-success text-white font-black uppercase text-xs tracking-[0.2em] shadow-theme-elevated transition-all flex items-center justify-center gap-3"
                        >
                          {processingId === item.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <IndianRupee className="w-5 h-5" />}
                          Pay Advance
                        </motion.button>
                      </>
                    ) : (item.status === 'pending_payment' && String(item.acceptor_payment_status).toLowerCase() !== 'paid' && !userAcceptedChallenges.has(String(item.id))) ? (
                      <div className="p-5 rounded-2xl bg-accent/10 border border-accent/20 border-dashed text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest italic" style={{ color: theme.colors.accent }}>
                          Waiting for Confirmation from {item.challenger?.display_name || item.challenger?.username || item.host?.display_name || item.host?.username || item.name || 'Host'} (@{item.challenger?.username || item.host?.username || 'player'})
                        </p>
                      </div>
                    ) : item.status === 'booked' ? (
                      <>
                        <div className="p-5 rounded-2xl bg-success/10 border border-success/20 border-dashed text-center">
                          <p className="text-[10px] font-black uppercase tracking-widest italic" style={{ color: theme.colors.success }}>
                            Request Accepted - Match Booked
                          </p>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleViewTicket(item)}
                          className="w-full py-4 rounded-2xl bg-accent text-white font-black uppercase text-xs tracking-[0.2em] shadow-theme-elevated transition-all flex items-center justify-center gap-3"
                        >
                          <QrCode className="w-5 h-5" /> View Ticket
                        </motion.button>
                      </>
                    ) : (
                      <>
                        <div className="p-5 rounded-2xl bg-success/10 border border-success/20 border-dashed text-center">
                          <p className="text-[10px] font-black uppercase tracking-widest italic" style={{ color: theme.colors.success }}>
                            Request Accepted - Match Confirmed
                          </p>
                        </div>
                        {(() => {
                          const details = calculatePaymentDetails(item);
                          const res = matchResults.find(r => String(r.challenge_id) === String(item.id));

                          if (item.settlement_status === 'completed') {
                            let payerInfo = "Settled in advances";
                            if (details.settlementBalance > 0 && res) {
                              const isTie = res.winner_id === null && res.loser_id === null;
                              if (isTie) payerInfo = `Paid by Challenger (${item.challenger?.display_name || 'Host'})`;
                              else if (!item.lose_to_pay) payerInfo = `Paid by Challenger (${item.challenger?.display_name || 'Host'})`;
                              else {
                                const loser = String(res.loser_id) === String(item.challenger_id) ? item.challenger : item.acceptor;
                                payerInfo = `Paid by Loser (${loser?.display_name || 'Player'})`;
                              }
                            }
                            return (
                              <div className="p-4 rounded-2xl bg-success/10 border border-success/20 border-dashed text-center mb-2 mt-2">
                                <p className="text-[10px] font-black uppercase tracking-widest italic" style={{ color: theme.colors.success }}>
                                  Settlement Completed • {payerInfo}
                                </p>
                              </div>
                            );
                          }

                          if (!res) return null;
                          const isTie = res.winner_id === null && res.loser_id === null;
                          if (!isTie && item.lose_to_pay && String(res.loser_id) === String(user?.id)) {
                            return (
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => { setPaymentItem(item); setIsFinalSettlementPayment(true); setShowPaymentSummary(true); }}
                                className="w-full py-4 rounded-2xl bg-error text-white font-black uppercase text-xs tracking-[0.2em] shadow-theme-elevated transition-all flex items-center justify-center gap-3 mb-2"
                              >
                                <IndianRupee className="w-5 h-5" /> {details.settlementBalance === 0 ? 'Complete Settlement' : 'Pay Final Settlement'}
                              </motion.button>
                            );
                          }
                          return null;
                        })()}
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleViewTicket(item)}
                          className="w-full py-4 rounded-2xl bg-accent text-white font-black uppercase text-xs tracking-[0.2em] shadow-theme-elevated transition-all flex items-center justify-center gap-3"
                        >
                          <QrCode className="w-5 h-5" /> View Ticket
                        </motion.button>
                      </>
                    )}
                  </div>
                ) : item.type === 'challenge' && item.status !== 'active' && !userSentRequests.has(String(item.id)) ? (
                  <div className="p-5 rounded-2xl bg-white/5 border border-white/10 border-dashed text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest italic opacity-40" style={{ color: theme.colors.textDisabled }}>Not Available</p>
                  </div>
                ) : item.type === 'challenge' && (item.status === 'confirmed' || item.status === 'booked' || item.status === 'pending_payment' || !!item.accepted_by) && userSentRequests.has(String(item.id)) ? (
                  <div className="p-5 rounded-2xl bg-white/5 border border-white/10 border-dashed text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest italic" style={{ color: theme.colors.textSecondary }}>
                      Challenge was accepted for other person
                    </p>
                  </div>
                ) : item.type === 'challenge' && userRejectedChallenges.has(String(item.id)) ? (
                  <div className="p-5 rounded-2xl bg-error/10 border border-error/20 border-dashed text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest italic" style={{ color: theme.colors.error }}>
                      Challenge Rejected
                    </p>
                  </div>
                ) : userSentRequests.has(String(item.id)) ? (
                  <div className="space-y-3">
                    <div className="p-5 rounded-2xl bg-accent/10 border border-accent/20 border-dashed text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest italic" style={{ color: theme.colors.accent }}>
                        Request Sent - Waiting for {item.challenger?.display_name || item.challenger?.username || item.host?.display_name || item.host?.username || item.name || 'Host'} (@{item.challenger?.username || item.host?.username || 'player'})
                      </p>
                    </div>
                    <button
                      onClick={() => handleAction(item, 'cancel-request')}
                      className="w-full py-2 text-[10px] font-black uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity"
                      style={{ color: theme.colors.error }}
                    >
                      Cancel Request
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      disabled={!!processingId || item.isExpired}
                      onClick={() => handleAction(item, 'request')}
                      className={`w-full py-5 rounded-2xl ${item.isExpired ? 'bg-background-secondary text-text-disabled cursor-not-allowed opacity-50' : 'bg-accent text-white shadow-theme-elevated'} font-black uppercase text-xs tracking-[0.2em] transition-all flex items-center justify-center gap-3`}
                    >
                      {processingId === item.id ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                        item.isExpired ? 'Session Expired' : <><img src="/logo.png" className="w-5 h-5 object-contain" alt="Boxitt" /> Send Request</>
                      )}
                    </motion.button>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {loadingMore && (
        <div className="flex justify-center py-10">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: theme.colors.accent }} />
        </div>
      )}

      {squadJoinMatch && !showPaymentSummary && !paymentItem && (
        <SquadJoinModal
          match={squadJoinMatch}
          user={user}
          theme={theme}
          onClose={() => setSquadJoinMatch(null)}
          onConfirm={(matchItem, addingCount, contributionAmount) => {
            setSquadJoinMatch(matchItem);
            setSquadJoinCount(addingCount);
            setSquadJoinAmount(contributionAmount);
            setPaymentItem(matchItem);
            setIsFinalSettlementPayment(false);
            setShowPaymentSummary(true);
          }}
          isProcessing={!!processingId}
        />
      )}

      {createPortal(
        <AnimatePresence>
          {paymentItem && showPaymentSummary && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl text-center relative overflow-hidden border space-y-6"
            style={{
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              boxShadow: theme.elevation.modal
            }}
          >
            <button
              onClick={() => {
                setPaymentItem(null);
                setShowPaymentSummary(false);
                setIsFinalSettlementPayment(false);
              }}
              className="absolute top-5 right-5 transition-colors"
              style={{ color: theme.colors.textDisabled }}
            >
              <XCircle className="w-6 h-6" />
            </button>

            <div className="pt-2 text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg text-white"
                style={{ backgroundColor: theme.colors.accent }}
              >
                <IndianRupee className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-black uppercase italic tracking-tighter" style={{ color: theme.colors.textPrimary }}>
                {squadJoinMatch
                  ? 'SQUAD JOIN PAYMENT'
                  : isFinalSettlementPayment
                  ? 'FINAL SETTLEMENT SUMMARY'
                  : 'PAYMENT SUMMARY'}
              </h2>
              <p className="text-[10px] font-black uppercase tracking-widest mt-1" style={{ color: theme.colors.accent }}>
                {paymentItem.box?.name || 'Arena'} • {paymentItem.slot_time || paymentItem.slotTime || 'TBA'}
              </p>
            </div>

            {(() => {
              const details = calculatePaymentDetails(paymentItem);
              const isSquad = !!squadJoinMatch || paymentItem.type === 'match';

              if (isSquad) {
                const matchTotal = Number(paymentItem.amount || paymentItem.total_price || 0);
                const maxPlayers = Number(paymentItem.max_players || 6);
                const addingCount = squadJoinCount || 1;
                const payableNow = squadJoinAmount || (addingCount * Math.round(matchTotal / maxPlayers));

                return (
                  <>
                    <div className="p-5 rounded-2xl border space-y-3 text-left" style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}>
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest" style={{ color: theme.colors.textDisabled }}>
                        <span>TOTAL ARENA FEE</span>
                        <span className="font-black text-xs" style={{ color: theme.colors.textPrimary }}>₹{matchTotal}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest" style={{ color: theme.colors.textDisabled }}>
                        <span>TOTAL PLAYERS</span>
                        <span className="font-black text-xs" style={{ color: theme.colors.textPrimary }}>{maxPlayers}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest" style={{ color: theme.colors.textDisabled }}>
                        <span>ADDING PLAYERS</span>
                        <span className="font-black text-xs" style={{ color: theme.colors.accent }}>{addingCount}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest pt-3 border-t" style={{ borderColor: theme.colors.border }}>
                        <span style={{ color: theme.colors.textSecondary }}>YOUR CONTRIBUTION</span>
                        <span className="text-2xl font-black" style={{ color: theme.colors.accent }}>₹{payableNow}</span>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <button
                        onClick={() => {
                          setShowPaymentSummary(false);
                        }}
                        className="w-full py-5 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                        style={{
                          background: theme.colors.buttonGradient
                            ? `linear-gradient(to right, ${theme.colors.buttonGradient[0]}, ${theme.colors.buttonGradient[1]})`
                            : theme.colors.accent
                        }}
                      >
                        PAY ₹{payableNow} NOW
                      </button>
                      <button
                        onClick={() => { setPaymentItem(null); setSquadJoinMatch(null); setShowPaymentSummary(false); setIsFinalSettlementPayment(false); }}
                        className="text-[9px] font-black uppercase tracking-[0.2em] transition-colors"
                        style={{ color: theme.colors.textDisabled }}
                      >
                        DISCARD
                      </button>
                    </div>
                  </>
                );
              }

              const payableNow = isFinalSettlementPayment ? details.settlementBalance : details.acceptorPayableAdvance;

              return (
                <>
                  <div className="p-5 rounded-2xl border space-y-3 text-left" style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}>
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest" style={{ color: theme.colors.textDisabled }}>
                      <span>TOTAL MATCH FEE</span>
                      <span className="font-black text-xs" style={{ color: theme.colors.textPrimary }}>₹{details.total}</span>
                    </div>
                    {isFinalSettlementPayment ? (
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest" style={{ color: theme.colors.textDisabled }}>
                        <span>ADVANCES PAID</span>
                        <span className="font-black text-xs" style={{ color: theme.colors.textPrimary }}>₹{details.total - details.settlementBalance}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest" style={{ color: theme.colors.textDisabled }}>
                        <span>CHALLENGER ADVANCE</span>
                        <span className="font-black text-xs" style={{ color: theme.colors.textPrimary }}>₹{details.challengerAdvance}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest pt-3 border-t" style={{ borderColor: theme.colors.border }}>
                      <span style={{ color: theme.colors.textSecondary }}>
                        {isFinalSettlementPayment ? 'REMAINING SETTLEMENT' : 'PAYABLE NOW'}
                      </span>
                      <span className="text-2xl font-black" style={{ color: theme.colors.accent }}>₹{payableNow}</span>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <button
                      onClick={() => {
                        if (payableNow === 0) {
                          handlePaymentSuccess({ method: 'settled' });
                        }
                        setShowPaymentSummary(false);
                      }}
                      className="w-full py-5 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        background: theme.colors.buttonGradient
                          ? `linear-gradient(to right, ${theme.colors.buttonGradient[0]}, ${theme.colors.buttonGradient[1]})`
                          : theme.colors.accent
                      }}
                    >
                      {payableNow === 0 ? 'CONFIRM SETTLEMENT' : `PAY ₹${payableNow} NOW`}
                    </button>
                    <button
                      onClick={() => { setPaymentItem(null); setShowPaymentSummary(false); setIsFinalSettlementPayment(false); }}
                      className="text-[9px] font-black uppercase tracking-[0.2em] transition-colors"
                      style={{ color: theme.colors.textDisabled }}
                    >
                      DISCARD
                    </button>
                  </div>
                </>
              );
            })()}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )}

      {paymentItem && !showPaymentSummary && (
        <div className="fixed inset-0 z-[300] flex items-start justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-lg my-auto">
            {(() => {
              const details = calculatePaymentDetails(paymentItem);
              const payableNow = squadJoinMatch
                ? squadJoinAmount
                : isFinalSettlementPayment
                ? details.settlementBalance
                : details.acceptorPayableAdvance;
              return (
                <PaymentPage
                  amount={payableNow}
                  bookingId={paymentItem.id.slice(0, 8).toUpperCase()}
                  locationName={paymentItem.box?.name || 'Arena'}
                  date={paymentItem.date}
                  slotTime={paymentItem.slot_time}
                  totalFee={squadJoinMatch ? Number(paymentItem.amount || paymentItem.total_price || 0) : details.total}
                  onBack={() => { setPaymentItem(null); setSquadJoinMatch(null); }}
                  onPay={() => handlePaymentSuccess({ method: 'online' })}
                  isLoading={processingId === paymentItem.id}
                />
              );
            })()}
          </div>
        </div>
      )}

      {squadJoinMatch && (
        <SquadJoinModal
          match={squadJoinMatch}
          user={user}
          theme={theme}
          onClose={() => setSquadJoinMatch(null)}
          onConfirm={(matchItem, addingCount, contributionAmount) => {
            setSquadJoinMatch(matchItem);
            setSquadJoinCount(addingCount);
            setSquadJoinAmount(contributionAmount);
            setPaymentItem(matchItem);
            setShowPaymentSummary(true);
          }}
          isProcessing={!!processingId}
        />
      )}

      <SuccessModal
        isOpen={showSuccessModal}
        title={successModalConfig?.title || "SUCCESS"}
        message={successModalConfig?.message || ""}
        onConfirm={() => {
          if (successModalConfig?.onConfirm) {
            successModalConfig.onConfirm();
          } else {
            setShowSuccessModal(false);
          }
        }}
      />
    </div>
  );
};

export default ChallengesPage;

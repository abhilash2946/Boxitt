import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Booking, User, BookingStatus, PaymentType, SportType } from '../types';
import LoadingButton from '../components/LoadingButton';
import { motion, AnimatePresence } from 'framer-motion';
import { IndianRupee, CalendarSearch, Filter, History, PieChart, ArrowUpRight, QrCode, XCircle, ChevronLeft, ChevronDown, ChevronUp, Receipt, UserCheck, CheckCircle2 } from 'lucide-react';
import { handleError } from '../services/errorHandler';
import { useTheme } from '../contexts/ThemeContext';
import { DatePickerModal } from '../components/CustomPickers';
import QRCodeModal from '../components/QRCodeModal';
import SuccessModal from '../components/SuccessModal';
import { bookingService } from '../services/bookingService';
import PaymentPage from '../components/PaymentPage';
import { queryClient } from '../providers/QueryProvider';
import { storage } from '../services/storage';

interface TransactionsPageProps {
  user: User | null;
  onAlert?: (msg: string, type: 'success' | 'error' | 'info') => void;
  onShowQR?: (booking: Booking, location: Location) => void;
}

type PeriodType = 'daily' | 'monthly' | 'yearly' | 'all';

const TransactionsPage: React.FC<TransactionsPageProps> = ({ user, onAlert, onShowQR }) => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<(Booking & { arenaName?: string; courtName?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<'day' | 'month' | 'year' | 'all'>('day');
  const [payments, setPayments] = useState<any[]>([]);
  const [allPaymentsList, setAllPaymentsList] = useState<any[]>([]);
  const [userProfilesMap, setUserProfilesMap] = useState<Map<string, any>>(new Map());
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [loadingQR, setLoadingQR] = useState(false);
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [matchResults, setMatchResults] = useState<any[]>([]);
  const [challengesList, setChallengesList] = useState<any[]>([]);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [showPaymentSummary, setShowPaymentSummary] = useState(false);
  const [paymentItem, setPaymentItem] = useState<any>(null);
  const [isFinalSettlementPayment, setIsFinalSettlementPayment] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successTitle, setSuccessTitle] = useState('PAYMENT SUCCESSFUL');
  const [successMsg, setSuccessMsg] = useState('Payment recorded successfully!');

  const calculatePaymentDetails = useCallback((item: any) => {
    if (!item) return { total: 0, alreadyPaid: 0, settlementBalance: 0 };
    const total = Number(item.amount || item.booking?.amount || 0);
    const bookingId = item.booking?.id || item.id || item.booking_id;
    const ch = challengesList.find(c => String(c.booking_id) === String(bookingId) || String(c.id) === String(bookingId));
    const res = matchResults.find(r => String(r.challenge_id) === String(ch?.id));

    // If current user is the winner of a Lose-To-Pay challenge, settlement balance is 0
    if (ch && ch.lose_to_pay && res && res.winner_id && String(res.winner_id) === String(user?.id)) {
      return {
        total,
        alreadyPaid: total,
        settlementBalance: 0
      };
    }

    const bookingPayments = allPaymentsList.filter(p => String(p.booking_id) === String(bookingId));

    const bookingAdvance = Number(
      item.advance_paid ?? item.advancePaid ?? item.advance_price ??
      item.booking?.advance_paid ?? item.booking?.advancePaid ?? item.booking?.advance_price ?? 0
    );

    const advanceInLedgerSum = bookingPayments
      .filter(p => p.payment_type === 'advance' || p.payment_type === 'full')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const otherLedgerSum = bookingPayments
      .filter(p => p.payment_type !== 'advance' && p.payment_type !== 'full')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const effectiveAdvance = Math.max(advanceInLedgerSum, bookingAdvance);
    const alreadyPaid = effectiveAdvance + otherLedgerSum;

    // Friendly Challenge: split match total 50/50 between Challenger and Challengee
    if (ch && !ch.lose_to_pay) {
      const myPayments = bookingPayments.filter(p => String(p.user_id) === String(user?.id));
      const myAdvanceInLedger = myPayments
        .filter(p => p.payment_type === 'advance' || p.payment_type === 'full')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const myOtherLedger = myPayments
        .filter(p => p.payment_type !== 'advance' && p.payment_type !== 'full')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      const isPayer = String(item.user_id) === String(user?.id) || String(ch.challenger_id) === String(user?.id);
      const myBookingAdvance = isPayer ? bookingAdvance : 0;
      const myEffectiveAdvance = Math.max(myAdvanceInLedger, myBookingAdvance);
      const myAlreadyPaid = myEffectiveAdvance + myOtherLedger;

      const myShare = Math.round(total / 2);
      const settlementBalance = Math.max(0, myShare - myAlreadyPaid);

      return {
        total,
        alreadyPaid,
        settlementBalance
      };
    }

    const settlementBalance = Math.max(0, total - alreadyPaid);

    return {
      total,
      alreadyPaid,
      settlementBalance
    };
  }, [allPaymentsList, challengesList, matchResults, user?.id]);

  const fetchUserTransactions = useCallback(async (isInitial = false) => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    if (isInitial) setLoading(true);
    try {
      // 1. Fetch user payments from ledger and join_requests
      const [{ data: paymentsData }, { data: joinReqsData }] = await Promise.all([
        supabase
          .from('payments')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('join_requests')
          .select('*')
          .eq('requester_id', user.id)
      ]);

      setPayments(paymentsData || []);

      const paymentBookingIds = (paymentsData || []).map(p => p.booking_id).filter(Boolean);
      const joinBookingIds = (joinReqsData || []).map(r => r.booking_id).filter(Boolean);
      const allUserBookingIds = [...new Set([...paymentBookingIds, ...joinBookingIds])];

      // 2. Fetch direct user bookings OR bookings matching payment/join IDs
      let query = supabase
        .from('bookings')
        .select('*, join_requests(*)')
        .order('created_at', { ascending: false });

      if (allUserBookingIds.length > 0) {
        query = query.or(`user_id.eq.${user.id},id.in.(${allUserBookingIds.join(',')})`);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data: bookingsData, error: bookingsError } = await query;
      if (bookingsError) throw bookingsError;

      const bookingMap = new Map<string, any>();
      (bookingsData || []).forEach(b => bookingMap.set(String(b.id), b));

      const allBookingIds = [...new Set((bookingsData || []).map(b => b.id))];

      // 3. Fetch locations, courts, and all payments for these bookings
      const [{ data: locationsData }, { data: courtsData }, { data: allPaymentsData }] = await Promise.all([
        supabase.from('locations').select('id, name'),
        supabase.from('courts').select('id, name, court_number'),
        allBookingIds.length > 0
          ? supabase.from('payments').select('*').in('booking_id', allBookingIds)
          : Promise.resolve({ data: [] })
      ]);

      const locationMap = new Map((locationsData || []).map(l => [l.id, l.name]));
      const courtMap = new Map((courtsData || []).map(c => [c.id, c.name || `Court ${c.court_number}`]));

      const createBookingObj = (b: any) => {
        const bookingSport = b.sport || 'Cricket';
        const courtNameStr = courtMap.get(b.court_id) || 'Court 1';
        const arenaNameStr = locationMap.get(b.location_id) || 'Boxitt Arena';
        return {
          id: b.id,
          name: b.name,
          phone: b.phone,
          date: b.date,
          locationId: b.location_id,
          courtId: b.court_id,
          slotId: b.slot_id,
          slotTime: b.slot_time || `${b.start_hour}:00`,
          startHour: b.start_hour,
          endHour: b.end_hour,
          duration: b.duration,
          amount: Number(b.amount || 0),
          advancePaid: Number(b.advance_paid ?? b.advancePaid ?? b.advance_price ?? 0),
          advance_paid: Number(b.advance_paid ?? b.advancePaid ?? b.advance_price ?? 0),
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
          sport: bookingSport,
          user_id: b.user_id,
          arenaName: arenaNameStr,
          courtName: courtNameStr
        };
      };

      // Group user's payments by booking_id sorted by created_at ascending
      const userPaymentsByBooking = new Map<string, any[]>();
      (paymentsData || []).forEach(p => {
        const key = String(p.booking_id);
        if (!userPaymentsByBooking.has(key)) userPaymentsByBooking.set(key, []);
        userPaymentsByBooking.get(key)!.push(p);
      });

      userPaymentsByBooking.forEach(list => {
        list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });

      const mappedBookings: any[] = [];
      const processedBookingIds = new Set<string>();

      // Map each unique booking as ONE distinct card in the Booking List
      (bookingsData || []).forEach(b => {
        const bId = String(b.id);
        if (processedBookingIds.has(bId)) return;
        processedBookingIds.add(bId);

        const bookingObj = createBookingObj(b);

        // Fetch all payments for this booking across all users and deduplicate duplicate advance entries
        const rawPayments = (allPaymentsData || []).filter((item: any) => String(item.booking_id) === bId);
        const uniquePayments: any[] = [];
        const seenKeys = new Set<string>();

        rawPayments.forEach((p: any) => {
          const pType = String(p.payment_type || '').toLowerCase();
          const pAmt = Number(p.amount || 0);
          const pUser = String(p.user_id || '');
          const key = `${pType}-${pAmt}-${pUser}`;
          if (pType === 'advance' || pType === 'full') {
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              uniquePayments.push(p);
            }
          } else {
            uniquePayments.push(p);
          }
        });

        const collectedFromLedger = uniquePayments.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
        const totalCollected = Math.max(collectedFromLedger, Number(b.advance_paid || b.advancePaid || 0));

        const isHost = String(b.user_id) === String(user.id);
        const reqs = Array.isArray(b.join_requests) ? b.join_requests : [];
        const userJoinReqs = reqs.filter((r: any) => String(r.requester_id) === String(user.id) && String(r.status || 'accepted').toLowerCase() === 'accepted');

        const isCheckedIn = isHost
          ? Boolean(b.host_checked_in || b.checked_in || b.status === 'confirmed')
          : (userJoinReqs.length > 0 ? Boolean(userJoinReqs[0]?.checked_in) : Boolean(b.checked_in || b.status === 'confirmed'));

        const cardStatus = isCheckedIn
          ? BookingStatus.CONFIRMED
          : (b.status === BookingStatus.CONFIRMED ? BookingStatus.CONFIRMED : (b.status || BookingStatus.BOOKED));

        mappedBookings.push({
          id: b.id,
          amount: Number(b.advance_paid || b.advancePaid || b.amount || 0),
          payment_method: b.payment_method || 'Online',
          payment_type: b.payment_type || 'advance',
          created_at: b.created_at,
          booking: bookingObj,
          totalCollected: totalCollected,
          ticketIndex: 0,
          checkedIn: isCheckedIn,
          cardStatus: cardStatus
        });
      });

      mappedBookings.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setBookings(mappedBookings as any);

      // 4. Fetch match results and challenges for settlement handling
      const [{ data: resultsData }, { data: challengesData }] = await Promise.all([
        supabase.from('match_results').select('*'),
        supabase.from('challenges').select('*')
      ]);

      setMatchResults(resultsData || []);
      setChallengesList(challengesData || []);
      setAllPaymentsList(allPaymentsData || []);

      // Fetch user profiles for all players involved
      const involvedUserIds = new Set<string>();
      (bookingsData || []).forEach(b => { if (b.user_id) involvedUserIds.add(String(b.user_id)); });
      (allPaymentsData || []).forEach(p => { if (p.user_id) involvedUserIds.add(String(p.user_id)); });
      (challengesData || []).forEach(c => {
        if (c.challenger_id) involvedUserIds.add(String(c.challenger_id));
        if (c.accepted_by) involvedUserIds.add(String(c.accepted_by));
      });
      (resultsData || []).forEach(r => {
        if (r.winner_id) involvedUserIds.add(String(r.winner_id));
        if (r.loser_id) involvedUserIds.add(String(r.loser_id));
      });

      const userIdsArr = Array.from(involvedUserIds).filter(Boolean);
      if (userIdsArr.length > 0) {
        const { data: profilesData } = await supabase
          .from('user_profiles')
          .select('id, display_name, username, phone_number')
          .in('id', userIdsArr);

        const pMap = new Map<string, any>();
        (profilesData || []).forEach(u => pMap.set(String(u.id), u));
        setUserProfilesMap(pMap);
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
      const appError = handleError(err);
      if (onAlert) onAlert(appError.message, 'error');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [user?.id, onAlert]);

  const handlePaymentSuccess = async (paymentDetails: { utr?: string; method: string }) => {
    if (!paymentItem) return;

    const bookingId = paymentItem.booking?.id || paymentItem.id;
    setSettlingId(bookingId);
    try {
      const details = calculatePaymentDetails(paymentItem);
      const ch = challengesList.find(c => String(c.booking_id) === String(bookingId) || String(c.id) === String(bookingId));

      if (isFinalSettlementPayment) {
        if (ch) {
          await supabase
            .from('challenges')
            .update({ settlement_status: 'completed' })
            .eq('id', ch.id);
        }

        // Record settlement payment
        await bookingService.recordPayment({
          booking_id: bookingId,
          challenge_id: ch?.id || null,
          user_id: user?.id || '',
          amount: details.settlementBalance,
          payment_type: 'settlement',
          payment_method: paymentDetails.method
        });

        onAlert?.('Settlement paid successfully!', 'success');
        setSuccessTitle("SETTLEMENT COMPLETED");
        setSuccessMsg("Final settlement balance paid! Transaction ledger updated.");
      } else {
        // Handle Advance Payment (if triggered from history)
        if (ch) {
            const confirmRpc = await supabase.rpc('confirm_challenge_payment', {
              p_challenge_id: String(ch.id)
            });
            if (confirmRpc.error) {
              await supabase
                .from('challenges')
                .update({
                  status: 'booked',
                  acceptor_payment_status: 'paid'
                })
                .eq('id', ch.id);
            }
        }

        await bookingService.recordPayment({
          booking_id: bookingId,
          challenge_id: ch?.id || null,
          user_id: user?.id || '',
          amount: details.settlementBalance || paymentItem.advancePaid || paymentItem.advance_paid || 0,
          payment_type: 'advance',
          payment_method: paymentDetails.method
        });

        if (bookingId) {
          await supabase
            .from('bookings')
            .update({ status: 'confirmed' })
            .eq('id', bookingId);
        }

        onAlert?.('Advance paid successfully! Match confirmed.', 'success');
        setSuccessTitle("PAYMENT SUCCESSFUL");
        setSuccessMsg("Advance payment recorded! Match status confirmed.");
      }

      // Close payment modals cleanly
      setPaymentItem(null);
      setShowPaymentSummary(false);
      setIsFinalSettlementPayment(false);
      setShowSuccessModal(true);

      // Seamless background update of transaction data and cache invalidation without page refresh!
      queryClient.invalidateQueries();
      storage.bumpDataVersion();
      await fetchUserTransactions(false);
    } catch (e) {
      onAlert?.(handleError(e).message, 'error');
    } finally {
      setSettlingId(null);
    }
  };

  const getLocalDateString = (date: Date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleViewTicket = async (p: any) => {
    const booking = p.booking || p;
    setFetchingId(p.id || booking.id);
    setLoadingQR(true);
    try {
        const { data: loc } = await supabase.from('locations').select('*').eq('id', booking.locationId).single();
        if (loc && onShowQR) {
            const ch = challengesList.find(c => String(c.booking_id) === String(booking.id) || String(c.id) === String(booking.id));
            const currentUserId = String(user?.id || '');
            const isHost = String(booking.user_id || ch?.challenger_id) === currentUserId;
            const isAcceptor = ch && String(ch.accepted_by) === currentUserId;

            const holderName = isHost
              ? (user?.display_name || user?.username || 'Challenger Host')
              : (isAcceptor ? (user?.display_name || user?.username || 'Challengee Acceptor') : (user?.display_name || user?.username || 'Player'));

            const role = ch
              ? (isHost ? 'CHALLENGER (HOST)' : (isAcceptor ? 'CHALLENGEE (ACCEPTOR)' : 'MATCH PARTICIPANT'))
              : (booking.isJoinable ? (isHost ? 'MATCH HOST' : 'MATCH PARTICIPANT') : 'BOOKING HOLDER');

            const reqs = Array.isArray(booking.joinRequests) ? booking.joinRequests : [];
            const userJoinReqs = reqs.filter((r: any) => String(r.requester_id) === currentUserId && String(r.status || 'accepted').toLowerCase() === 'accepted');
            userJoinReqs.sort((a: any, b: any) => new Date(a.created_at || a.requested_at || 0).getTime() - new Date(b.created_at || b.requested_at || 0).getTime());

            const tickets: any[] = [];
            if (isHost) {
              tickets.push({
                id: booking.id,
                qrNo: 'QR #1',
                ticketNumber: 1,
                groupSize: 'Host Ticket',
                slotTime: booking.slotTime || booking.slot_time,
                date: booking.date,
                holderName,
                role: 'MATCH HOST',
                qrData: ch ? `challenge:${ch.id}:host:${currentUserId}` : `match:${booking.id}:host:${currentUserId}`,
                participantCheckedIn: Boolean(booking.checkedIn || booking.host_checked_in || booking.status === 'confirmed'),
                status: booking.status || 'booked'
              });

              userJoinReqs.forEach((req: any, idx: number) => {
                tickets.push({
                  id: req.id,
                  qrNo: `QR #${idx + 2}`,
                  ticketNumber: idx + 2,
                  groupSize: `${req.group_size || 1} Player(s)`,
                  slotTime: booking.slotTime || booking.slot_time,
                  date: booking.date,
                  holderName: req.player_name || holderName,
                  role: 'ADDITIONAL PLAYERS',
                  qrData: `match:${req.id}:player:${currentUserId}`,
                  participantCheckedIn: Boolean(req.checked_in),
                  status: req.checked_in ? 'confirmed' : (booking.status || 'booked')
                });
              });
            } else if (userJoinReqs.length > 0) {
              userJoinReqs.forEach((req: any, idx: number) => {
                tickets.push({
                  id: req.id,
                  qrNo: `QR #${idx + 1}`,
                  ticketNumber: idx + 1,
                  groupSize: `${req.group_size || 1} Player(s)`,
                  slotTime: booking.slotTime || booking.slot_time,
                  date: booking.date,
                  holderName: req.player_name || holderName,
                  role: 'MATCH PARTICIPANT',
                  qrData: `match:${req.id}:player:${currentUserId}`,
                  participantCheckedIn: Boolean(req.checked_in),
                  status: req.checked_in ? 'confirmed' : (booking.status || 'booked')
                });
              });
            } else {
              tickets.push({
                id: booking.id,
                qrNo: 'QR #1',
                ticketNumber: 1,
                groupSize: '1 Ticket',
                slotTime: booking.slotTime || booking.slot_time,
                date: booking.date,
                holderName,
                role,
                qrData: ch ? `challenge:${ch.id}:${isHost ? 'host' : 'acceptor'}:${currentUserId}` : `match:${booking.id}:${isHost ? 'host' : 'player'}:${currentUserId}`,
                participantCheckedIn: Boolean(booking.checkedIn || booking.host_checked_in || booking.status === 'confirmed'),
                status: booking.status || 'booked'
              });
            }

            const targetIdx = typeof p.ticketIndex === 'number' && p.ticketIndex < tickets.length ? p.ticketIndex : 0;
            const activeTkt = tickets[targetIdx] || tickets[0];

            const adaptedBooking = {
              ...booking,
              id: activeTkt.id || p.id || booking.id,
              status: activeTkt.status || (ch ? (ch.status || 'booked') : (booking.status || 'booked')),
              holderName: activeTkt.holderName || holderName,
              role: activeTkt.role || role,
              qrData: activeTkt.qrData || `match:${booking.id}:host:${currentUserId}`,
              participantCheckedIn: Boolean(activeTkt.participantCheckedIn),
              tickets,
              initialIndex: targetIdx
            };

            onShowQR(adaptedBooking, loc as Location);
        }
    } catch (e) {
        onAlert?.(handleError(e).message, 'error');
    } finally {
        setLoadingQR(false);
        setFetchingId(null);
    }
  };

  const [filterDate, setFilterDate] = useState(() => getLocalDateString());

  useEffect(() => {
    fetchUserTransactions(true);

    const channel = supabase
      .channel('transactions_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_results' }, () => fetchUserTransactions(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges' }, () => fetchUserTransactions(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchUserTransactions(false))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUserTransactions]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((p: any) => {
      const b = p.booking;
      if (!b || !b.date) return false;
      const bDate = b.date;

      if (timeFilter === 'day') return bDate === filterDate;
      if (timeFilter === 'month') return bDate.startsWith(filterDate.slice(0, 7));
      if (timeFilter === 'year') return bDate.startsWith(filterDate.slice(0, 4));
      return true;
    });
  }, [bookings, timeFilter, filterDate]);

  const totalCost = useMemo(() => filteredBookings.reduce((sum, p: any) => {
    return sum + Number(p.amount || 0);
  }, 0), [filteredBookings]);

  return (
    <div className="max-w-4xl lg:max-w-7xl mx-auto p-5 md:p-8 space-y-8 md:space-y-10 min-h-screen relative overflow-hidden transition-all duration-300"
         style={{ backgroundColor: theme.colors.background }}>
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none opacity-20 md:block hidden" style={{ backgroundColor: theme.colors.accent }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none opacity-20 md:block hidden" style={{ backgroundColor: theme.colors.success }} />

      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative z-50 flex flex-col gap-4 pt-4 md:pt-0">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-card hover:bg-card-elevated text-text-primary rounded-theme-md transition-all border border-border shadow-theme-card active:translate-y-0.5 w-fit mb-4 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-xs font-black uppercase tracking-widest">Back</span>
          </button>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter italic md:not-italic uppercase leading-none drop-shadow-2xl md:drop-shadow-none text-text-primary">
              Transaction <span className="text-accent">History</span>
            </h1>
            <div className="flex items-center gap-3 mt-3 md:mt-4">
              <History className="w-4 h-4 text-accent md:text-text-disabled" />
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-text-disabled">Track your bookings</p>
            </div>
        </div>
      </motion.header>

      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} whileHover={{ scale: 1.02 }}
        className="rounded-[2.5rem] p-8 md:p-12 text-white shadow-theme-elevated relative overflow-hidden group transition-all duration-300 border border-white/10"
        style={{ background: `linear-gradient(to bottom right, ${theme.colors.buttonGradient[0]}, ${theme.colors.buttonGradient[1]})` }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-white/20 transition-all duration-1000 animate-pulse" />
        <PieChart className="absolute -left-10 -bottom-10 w-48 h-48 text-white/5 rotate-12" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8 lg:gap-12">
          <div className="space-y-4 min-w-0 lg:flex-1">
            <h2 className="text-[11px] font-black text-white/70 uppercase tracking-[0.4em] flex items-center gap-2"><IndianRupee className="w-3 h-3" /> Total Spending</h2>
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4 min-w-0">
              <span className="text-4xl md:text-[clamp(2rem,6vw,4rem)] font-black italic tracking-tighter leading-[0.9] drop-shadow-2xl break-words">₹{totalCost.toLocaleString()}</span>
              <span className="w-fit font-black uppercase text-[10px] tracking-[0.2em] bg-white/10 px-3 py-1 rounded-lg border border-white/10">Filter: {timeFilter.toUpperCase()}</span>
            </div>
          </div>

          <div className="w-full lg:w-auto grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-10 lg:gap-12 border-t lg:border-t-0 lg:border-l border-white/10 pt-8 lg:pt-0 lg:pl-12">
            <div className="space-y-1">
              <p className="text-white/70 font-black uppercase text-[10px] tracking-widest opacity-60 md:opacity-100">Bookings</p>
              <p className="text-4xl sm:text-4xl font-black italic text-white tracking-tighter leading-none">{filteredBookings.length}</p>
            </div>
            <div className="space-y-1">
              <p className="text-white/70 font-black uppercase text-[10px] tracking-widest opacity-60 md:opacity-100">Average</p>
              <p className="text-4xl sm:text-4xl font-black italic text-white tracking-tighter leading-none break-words">₹{filteredBookings.length > 0 ? Math.round(totalCost / filteredBookings.length).toLocaleString() : 0}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Date & Time Filter Bar */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}
        className="p-6 md:p-6 border shadow-theme-card flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden transition-all rounded-[2rem] md:rounded-theme-lg z-10 bg-card"
        style={{ borderColor: theme.colors.border }}
      >
        <div className="absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full opacity-5 pointer-events-none bg-accent md:hidden" />
        <div className="flex p-1.5 rounded-2xl w-full md:w-auto border shadow-inner bg-background-secondary" style={{ borderColor: theme.colors.border }}>
          {(['day', 'month', 'year', 'all'] as const).map(p => (
            <button
              key={p}
              onClick={() => setTimeFilter(p)}
              className={`flex-1 px-8 py-2.5 md:px-8 md:py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${
                timeFilter === p
                  ? 'bg-accent text-white shadow-theme-elevated scale-105 italic md:not-italic'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {timeFilter !== 'all' && (
          <div className="relative group w-full md:w-auto">
            <input
              type={timeFilter === 'day' ? 'date' : timeFilter === 'month' ? 'month' : 'number'}
              value={timeFilter === 'year' ? filterDate.slice(0, 4) : filterDate.slice(0, timeFilter === 'day' ? 10 : 7)}
              onChange={(e) => {
                let val = e.target.value;
                setFilterDate(timeFilter === 'year' ? `${val}-01-01` : (val.length === 7 ? `${val}-01` : val));
              }}
              className="w-full md:w-[250px] p-4 md:p-3 border-2 border-transparent rounded-2xl font-black outline-none transition-all shadow-inner text-sm bg-background-secondary"
              style={{ color: theme.colors.textPrimary }}
            />
          </div>
        )}
      </motion.div>

      <div className="space-y-6 relative z-10">
        <div className="flex items-center gap-4 px-4">
          <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-text-disabled">Booking List</h2>
          <div className="h-px flex-1 bg-border" />
        </div>

        <AnimatePresence mode="popLayout">
          {loading ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-32">
              <div className="w-14 h-14 border-4 border-border rounded-full animate-spin mb-6" style={{ borderTopColor: theme.colors.accent }} />
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-text-disabled">Loading history...</p>
            </motion.div>
          ) : filteredBookings.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-32 rounded-[2.5rem] border-2 border-dashed border-border shadow-inner bg-background-secondary/30">
              <p className="font-black uppercase text-xs tracking-[0.3em] text-text-disabled opacity-50">No bookings found</p>
            </motion.div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredBookings.map((p: any, idx) => {
                const b = p.booking;
                return (
                  <motion.div layout initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: idx * 0.05 }} key={p.id} whileHover={{ scale: 1.01, x: 4 }}
                    className="p-4 md:p-5 border shadow-theme-card hover:shadow-theme-elevated transition-all group relative overflow-hidden flex flex-col gap-2.5"
                    style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radius.large }}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full opacity-5" style={{ backgroundColor: theme.colors.accent }} />

                    {/* Top Row: Icon + Slot Time + Status Badge */}
                    <div className="flex items-center justify-between gap-3 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center border shadow-sm shrink-0" style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}>
                          <span className="text-xl">{b.sport.includes('Football') ? '⚽' : '🏏'}</span>
                        </div>
                        <div>
                          <h3 className="text-sm md:text-base font-black italic tracking-tighter uppercase leading-none" style={{ color: theme.colors.textPrimary }}>{b.slotTime || b.slot_time || 'TBA'}</h3>
                          <p className="text-[10px] font-black uppercase tracking-widest mt-0.5 flex items-center gap-1.5" style={{ color: theme.colors.textDisabled }}>
                            <CalendarSearch className="w-2.5 h-2.5" style={{ color: theme.colors.accent }} /> {b.date}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Status Badge */}
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-white shadow-sm"
                              style={{
                                backgroundColor: (p.cardStatus === BookingStatus.CONFIRMED || p.checkedIn) ? theme.colors.success :
                                               b.status === BookingStatus.TIMED_OUT ? theme.colors.warning :
                                               b.status === BookingStatus.BOOKED ? theme.colors.accent :
                                               b.status === BookingStatus.DECLINED ? theme.colors.error :
                                               theme.colors.textDisabled
                              }}>
                          {(p.cardStatus === BookingStatus.CONFIRMED || p.checkedIn) ? 'Confirmed' :
                           b.status === BookingStatus.BOOKED ? 'Booked' :
                           b.status === BookingStatus.CONFIRMED ? 'Confirmed' :
                           b.status === BookingStatus.TIMED_OUT ? 'Timed Out' :
                           b.status === BookingStatus.DECLINED ? 'Declined' :
                           b.status}
                        </span>
                      </div>
                    </div>

                    {/* Middle Row: Arena & Court Name + Match Type Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/30 relative z-10 text-[10px]">
                      <div className="flex items-center gap-2 font-black uppercase tracking-wider cursor-pointer hover:underline" onClick={() => navigate(`/arena/${b.location_id}`)} style={{ color: theme.colors.textDisabled }}>
                        <span>{b.arenaName} - {b.courtName}</span>
                        <span className="text-border">|</span>
                        <span>ID: {b.id.slice(0, 8).toUpperCase()}</span>
                      </div>

                      {/* Match Type Badge */}
                      {(() => {
                        const isGameZone = b.sport === 'Game Zone' || b.sport === SportType.GAME_ZONE;
                        const ch = !isGameZone ? challengesList.find(c => String(c.booking_id) === String(b.id) || String(c.id) === String(b.id)) : null;
                        const res = matchResults.find(r => String(r.challenge_id) === String(ch?.id));
                        const isJoinableMatch = !isGameZone && (b.isJoinable || b.is_joinable || b.type === 'match');

                        let label = isGameZone ? 'Game Zone Booking' : 'Normal Booking';
                        let textColor = isGameZone ? theme.colors.accent : theme.colors.textDisabled;
                        let bgColor = isGameZone ? 'rgba(168, 85, 247, 0.1)' : `${theme.colors.textDisabled}15`;

                        if (ch) {
                          if (ch.lose_to_pay) {
                            if (res) {
                              const isWinner = String(res.winner_id) === String(user?.id);
                              const isTie = res.winner_id === null && res.loser_id === null;
                              label = isTie ? 'Challenge Lose to Pay (Tie)' : (isWinner ? 'Challenge Lose to Pay (Won)' : 'Challenge Lose to Pay (Lost)');
                            } else {
                              label = 'Challenge Lose to Pay';
                            }
                            textColor = theme.colors.error;
                            bgColor = 'rgba(239, 68, 68, 0.1)';
                          } else {
                            label = 'Friendly Challenge';
                            textColor = theme.colors.success;
                            bgColor = 'rgba(34, 197, 94, 0.1)';
                          }
                        } else if (isJoinableMatch) {
                          label = 'Joinable Match';
                          textColor = theme.colors.accent;
                          bgColor = 'rgba(59, 130, 246, 0.1)';
                        } else {
                          label = 'Normal Booking';
                          textColor = theme.colors.textDisabled;
                          bgColor = 'rgba(156, 163, 175, 0.1)';
                        }

                        return (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border flex items-center gap-1"
                                style={{ color: textColor, backgroundColor: bgColor, borderColor: `${textColor}30` }}>
                            {label}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Bottom Row: Financial Summary & Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/30 relative z-10">
                      <div className="flex items-center gap-5">
                        <div>
                          <p className="text-[8px] uppercase font-black tracking-wider text-text-disabled">Total Paid</p>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-sm md:text-base font-black text-text-primary">₹{Number(p.totalCollected || 0).toLocaleString()}</span>
                            <span className={`text-[8px] font-black uppercase ${p.totalCollected >= b.amount ? 'text-success' : 'text-accent'}`}>
                              {p.totalCollected >= b.amount ? 'Fully Paid' : 'Partial Paid'}
                            </span>
                          </div>
                        </div>
                        <div className="border-l border-border pl-5">
                          <p className="text-[8px] uppercase font-black tracking-wider text-text-disabled">Match Total</p>
                          <p className="text-sm md:text-base font-black text-text-primary">₹{Number(b.amount || 0).toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedBookingId(prev => prev === b.id ? null : b.id);
                          }}
                          className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all flex items-center gap-1 cursor-pointer"
                          style={{
                            backgroundColor: expandedBookingId === b.id ? `${theme.colors.accent}20` : `${theme.colors.backgroundSecondary}`,
                            borderColor: expandedBookingId === b.id ? theme.colors.accent : theme.colors.border,
                            color: expandedBookingId === b.id ? theme.colors.accent : theme.colors.textPrimary
                          }}
                        >
                          <Receipt className="w-3 h-3" />
                          <span>Ledger</span>
                          {expandedBookingId === b.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {(b.status === BookingStatus.APPROVED || b.status === BookingStatus.BOOKED || b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.COMPLETED) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleViewTicket(p); }}
                            className="px-3.5 py-1.5 rounded-xl bg-accent text-white text-[9px] font-black uppercase tracking-wider shadow-sm active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <QrCode className="w-3 h-3" /> View Ticket
                          </button>
                        )}

                        {(() => {
                          const ch = challengesList.find(c => String(c.booking_id) === String(b.id) || String(c.id) === String(b.id));
                          const res = matchResults.find(r => String(r.challenge_id) === String(ch?.id));
                          const isAcceptor = ch && String(ch.accepted_by) === String(user?.id);
                          const needsAdvance = isAcceptor && ch.status === 'pending_payment' && String(ch.acceptor_payment_status).toLowerCase() !== 'paid';

                          if (needsAdvance) {
                            return (
                              <button
                                onClick={(e) => { e.stopPropagation(); setPaymentItem(b); setIsFinalSettlementPayment(false); setShowPaymentSummary(true); }}
                                className="px-3.5 py-1.5 rounded-xl bg-success text-white text-[9px] font-black uppercase tracking-wider shadow-sm active:scale-95 transition-all cursor-pointer"
                              >
                                Pay Advance
                              </button>
                            );
                          }

                          const totalPaid = p.totalCollected || Number(p.amount || 0);
                          const isFullyPaid = totalPaid >= b.amount;
                          const hasRemainingBalance = b.amount > totalPaid;
                          if (isFullyPaid || !hasRemainingBalance) return null;
                          if (!ch && String(b.user_id) !== String(user?.id)) return null;

                          let shouldShowSettlement = false;
                          if (!ch) {
                            if (String(b.user_id) === String(user?.id)) shouldShowSettlement = true;
                          } else {
                            if (ch.lose_to_pay) {
                              if (res) {
                                const isWinner = res.winner_id && String(res.winner_id) === String(user?.id);
                                const isLoser = res.loser_id && String(res.loser_id) === String(user?.id);
                                if (isLoser) {
                                  shouldShowSettlement = true;
                                } else if (isWinner) {
                                  shouldShowSettlement = false; // Winner owes 0
                                } else if (res.winner_id === null && res.loser_id === null) {
                                  // Tie: Challenger settles
                                  shouldShowSettlement = (String(b.user_id) === String(user?.id) || String(ch.challenger_id) === String(user?.id));
                                }
                              } else {
                                // Match not finished yet -> No settlement until loser is declared
                                shouldShowSettlement = false;
                              }
                            } else {
                              // Friendly challenge: split 50/50 between participants
                              const isHost = String(b.user_id) === String(user?.id);
                              const isChallenger = ch && String(ch.challenger_id) === String(user?.id);
                              const isAcceptor = ch && String(ch.accepted_by) === String(user?.id);

                              if (isHost || isChallenger || isAcceptor) {
                                const myPayments = allPaymentsList.filter(pay => String(pay.booking_id) === String(b.id) && String(pay.user_id) === String(user?.id));
                                let myAlreadyPaid = myPayments.reduce((sum, pay) => sum + Number(pay.amount || 0), 0);
                                if (myAlreadyPaid === 0 && (isHost || isChallenger)) {
                                  myAlreadyPaid = Number(b.advance_paid || b.advancePaid || 0);
                                }
                                const myShare = Math.round(b.amount / 2);
                                const myRemaining = Math.max(0, myShare - myAlreadyPaid);

                                if (myRemaining > 0) {
                                  shouldShowSettlement = true;
                                }
                              }
                            }
                          }

                          if (shouldShowSettlement) {
                            return (
                              <button
                                onClick={(e) => { e.stopPropagation(); setPaymentItem(b); setIsFinalSettlementPayment(true); setShowPaymentSummary(true); }}
                                className="px-3.5 py-1.5 rounded-xl bg-error text-white text-[9px] font-black uppercase tracking-wider shadow-sm active:scale-95 transition-all cursor-pointer"
                              >
                                Settlement
                              </button>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>

                    {/* Option B: Itemized Expandable Ledger Drawer */}
                    <AnimatePresence>
                      {expandedBookingId === b.id && (() => {
                        const rawBookingPayments = allPaymentsList.filter(pay => String(pay.booking_id) === String(b.id));
                        const bookingPayments: any[] = [];
                        const seenLedgerKeys = new Set<string>();

                        rawBookingPayments.forEach(pay => {
                          const pType = String(pay.payment_type || '').toLowerCase();
                          const pAmt = Number(pay.amount || 0);
                          const pUser = String(pay.user_id || '');
                          const key = `${pType}-${pAmt}-${pUser}`;
                          if (pType === 'advance' || pType === 'full') {
                            if (!seenLedgerKeys.has(key)) {
                              seenLedgerKeys.add(key);
                              bookingPayments.push(pay);
                            }
                          } else {
                            bookingPayments.push(pay);
                          }
                        });

                        const ch = challengesList.find(c => String(c.booking_id) === String(b.id) || String(c.id) === String(b.id));
                        const res = matchResults.find(r => String(r.challenge_id) === String(ch?.id));

                        // Synthesize initial advance row if no explicit advance/full payment row exists in payments table
                        const displayPayments = [...bookingPayments];
                        const hasAdvanceInLedger = displayPayments.some(pay => {
                          const pType = String(pay.payment_type || '').toLowerCase();
                          return pType === 'advance' || pType === 'full';
                        });

                        const initialAdvanceAmt = Number(b.advancePaid || b.advance_paid || 0);
                        if (!hasAdvanceInLedger && initialAdvanceAmt > 0) {
                          const hostProfile = userProfilesMap.get(String(b.user_id));
                          const hostName = hostProfile?.display_name || hostProfile?.username || b.name || 'Host';
                          const hostHandle = hostProfile?.username ? `@${hostProfile.username}` : '';
                          displayPayments.unshift({
                            id: `synthetic-adv-${b.id}`,
                            booking_id: b.id,
                            user_id: b.user_id,
                            amount: initialAdvanceAmt,
                            payment_type: b.payment_type || 'advance',
                            payment_method: b.paymentMethod || b.payment_method || 'Online',
                            created_at: b.createdAt || b.created_at,
                            isSynthetic: true,
                            syntheticRole: ch ? 'Challenger Advance' : (b.payment_type === 'full' ? 'Initial Full Payment' : 'Initial Advance Paid'),
                            syntheticName: `${hostName} ${hostHandle}`.trim()
                          });
                        }

                        const getPayerInfo = (pay: any) => {
                          if (pay.isSynthetic) {
                            return { role: pay.syntheticRole, name: pay.syntheticName };
                          }

                          const payerProfile = userProfilesMap.get(String(pay.user_id));
                          const payerName = payerProfile?.display_name || payerProfile?.username || 'Player';
                          const payerHandle = payerProfile?.username ? `@${payerProfile.username}` : '';

                          const pType = String(pay.payment_type || '').toLowerCase();
                          if (pType === 'advance') {
                            if (ch && String(pay.user_id) === String(ch.challenger_id)) {
                              return { role: 'Challenger Advance', name: `${payerName} ${payerHandle}` };
                            }
                            if (ch && String(pay.user_id) === String(ch.accepted_by)) {
                              return { role: 'Challengee Advance', name: `${payerName} ${payerHandle}` };
                            }
                            return { role: 'Host Advance', name: `${payerName} ${payerHandle}` };
                          }
                          if (pType === 'settlement') {
                            if (ch) {
                              if (ch.lose_to_pay && res) {
                                if (res.loser_id) {
                                  const loserProfile = userProfilesMap.get(String(res.loser_id));
                                  const loserName = loserProfile?.display_name || loserProfile?.username || 'Loser';
                                  const loserHandle = loserProfile?.username ? `@${loserProfile.username}` : '';
                                  return { role: 'Final Settlement (Lose to Pay)', name: `Paid by Loser: ${loserName} ${loserHandle}` };
                                }
                                if (res.winner_id === null && res.loser_id === null) {
                                  return { role: 'Final Settlement (Tie)', name: `Paid by Challenger: ${payerName} ${payerHandle}` };
                                }
                              }
                              if (!ch.lose_to_pay) {
                                const isChallengerPay = String(pay.user_id) === String(ch.challenger_id);
                                const isChallengeePay = String(pay.user_id) === String(ch.accepted_by);
                                const label = isChallengerPay ? 'Paid by Challenger' : (isChallengeePay ? 'Paid by Challengee' : 'Paid by Player');
                                return { role: 'Final Settlement (Friendly)', name: `${label}: ${payerName} ${payerHandle}` };
                              }
                            }
                            return { role: 'Final Settlement', name: `Paid by Host: ${payerName} ${payerHandle}` };
                          }
                          if (pType === 'full') {
                            return { role: 'Full Payment', name: `Paid by Host: ${payerName} ${payerHandle}` };
                          }
                          return { role: 'Contribution', name: `Paid by Player: ${payerName} ${payerHandle}` };
                        };

                        return (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="pt-3 border-t border-border/40 space-y-2 relative z-10 overflow-hidden"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-black uppercase tracking-widest text-accent flex items-center gap-1.5">
                                <Receipt className="w-3 h-3" /> Itemized Payment Ledger
                              </span>
                              <span className="text-[8px] font-black uppercase tracking-wider text-text-disabled">
                                {displayPayments.length} Transaction(s)
                              </span>
                            </div>

                            {displayPayments.length === 0 ? (
                              <div className="p-3 rounded-xl bg-background-secondary/40 text-center text-[9px] font-black uppercase text-text-disabled tracking-wider border border-border/20">
                                No direct ledger rows recorded yet
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1.5">
                                {displayPayments.map((pay: any, pIdx: number) => {
                                  const info = getPayerInfo(pay);
                                  const payDate = pay.created_at ? new Date(pay.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A';
                                  const isCurrentTx = String(pay.id) === String(p.id) || (pay.isSynthetic && String(p.id) === String(b.id));

                                  return (
                                    <div
                                      key={pay.id || pIdx}
                                      className={`p-2.5 rounded-xl flex items-center justify-between border text-[10px] transition-all ${
                                        isCurrentTx
                                          ? 'bg-accent/15 border-accent shadow-md ring-1 ring-accent/30'
                                          : 'bg-background-secondary/50 border-border/30'
                                      }`}
                                    >
                                      {(() => {
                                        const pType = String(pay.payment_type || '').toLowerCase();
                                        const badgeText = pType === 'settlement' ? 'SETTLEMENT' : (pType === 'full' ? 'FULL PAID' : 'ADVANCE');
                                        const badgeBg = pType === 'settlement' ? 'bg-error' : (pType === 'full' ? 'bg-success' : 'bg-accent');
                                        return (
                                          <div className="flex items-center gap-2.5">
                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border ${
                                              isCurrentTx ? 'bg-accent text-white border-accent' : 'bg-accent/10 border-accent/20'
                                            }`}>
                                              <IndianRupee className={`w-3 h-3 ${isCurrentTx ? 'text-white' : 'text-accent'}`} />
                                            </div>
                                            <div>
                                              <div className="flex items-center gap-1.5">
                                                <p className="font-black uppercase text-text-primary text-[10px] leading-tight">{info.role}</p>
                                                <span className={`px-1.5 py-0.2 rounded ${badgeBg} text-white font-black text-[7px] uppercase tracking-wider`}>
                                                  {badgeText}
                                                </span>
                                              </div>
                                              <p className="text-[9px] font-bold text-accent italic">{info.name}</p>
                                            </div>
                                          </div>
                                        );
                                      })()}

                                      <div className="text-right shrink-0">
                                        <p className="font-black text-text-primary text-xs">₹{Number(pay.amount || 0).toLocaleString()}</p>
                                        <p className="text-[8px] font-black uppercase text-text-disabled">{payDate} • {pay.payment_method || 'ONLINE'}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {(() => {
                              const isLtpWinner = ch && ch.lose_to_pay && res && res.winner_id && String(res.winner_id) === String(user?.id);
                              const isLtpPending = ch && ch.lose_to_pay && !res;

                              return (
                                <div className="p-2.5 rounded-xl bg-accent/5 border border-accent/20 flex items-center justify-between text-[9px] font-black uppercase tracking-wider">
                                  <span className="text-text-disabled">Total Paid: <strong className="text-text-primary">₹{p.totalCollected.toLocaleString()}</strong> / ₹{b.amount.toLocaleString()}</span>
                                  {isLtpWinner ? (
                                    <span className="text-success font-black">✓ Winner (No Payment Required)</span>
                                  ) : isLtpPending ? (
                                    <span className="text-accent font-black">Match Pending (Settlement on Finish)</span>
                                  ) : (
                                    <span className={p.totalCollected >= b.amount ? 'text-success font-black' : 'text-error font-black'}>
                                      {p.totalCollected >= b.amount ? '✓ Fully Settled' : `Due: ₹${Math.max(0, b.amount - p.totalCollected).toLocaleString()}`}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </motion.div>
                        );
                      })()}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>

      <DatePickerModal
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        selectedDate={filterDate}
        onSelect={(date) => setFilterDate(date)}
      />

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
                {paymentItem.is_joinable
                  ? 'SQUAD JOIN PAYMENT'
                  : isFinalSettlementPayment
                  ? 'FINAL SETTLEMENT SUMMARY'
                  : 'PAYMENT SUMMARY'}
              </h2>
              <p className="text-[10px] font-black uppercase tracking-widest mt-1" style={{ color: theme.colors.accent }}>
                ID: {paymentItem.id.slice(0, 8).toUpperCase()}
              </p>
            </div>

            {(() => {
              const details = calculatePaymentDetails(paymentItem);
              const isSquad = paymentItem.is_joinable || paymentItem.type === 'match';

              if (isSquad) {
                const matchTotal = Number(paymentItem.amount || paymentItem.total_price || 0);
                const maxPlayers = Number(paymentItem.max_players || 6);
                const payableNow = Math.round(matchTotal / maxPlayers);

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
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest pt-3 border-t" style={{ borderColor: theme.colors.border }}>
                        <span style={{ color: theme.colors.textSecondary }}>YOUR CONTRIBUTION</span>
                        <span className="text-2xl font-black" style={{ color: theme.colors.accent }}>₹{payableNow}</span>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <button
                        onClick={() => {
                          handlePaymentSuccess({ method: 'online' });
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
                    </div>
                  </>
                );
              }

              return (
                <>
                  <div className="p-5 rounded-2xl border space-y-3 text-left" style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}>
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest" style={{ color: theme.colors.textDisabled }}>
                      <span>MATCH TOTAL</span>
                      <span className="font-black text-xs" style={{ color: theme.colors.textPrimary }}>₹{details.total}</span>
                    </div>

                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest" style={{ color: theme.colors.textDisabled }}>
                      <span>ALREADY PAID</span>
                      <span className="font-black text-xs" style={{ color: theme.colors.success }}>₹{details.alreadyPaid}</span>
                    </div>

                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest pt-3 border-t" style={{ borderColor: theme.colors.border }}>
                      <span style={{ color: theme.colors.textSecondary }}>SETTLEMENT BALANCE</span>
                      <span className="text-2xl font-black" style={{ color: theme.colors.accent }}>
                        ₹{details.settlementBalance}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <button
                      onClick={() => {
                        setShowPaymentSummary(false);
                      }}
                      className="w-full py-5 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                      style={{
                        background: theme.colors.buttonGradient
                          ? `linear-gradient(to right, ${theme.colors.buttonGradient[0]}, ${theme.colors.buttonGradient[1]})`
                          : theme.colors.accent
                      }}
                    >
                      PAY ₹{details.settlementBalance} NOW
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
              const payableNow = details.settlementBalance;
              return (
                <PaymentPage
                  amount={payableNow}
                  bookingId={paymentItem.id.slice(0, 8).toUpperCase()}
                  locationName={paymentItem.arenaName || 'Arena'}
                  date={paymentItem.date}
                  slotTime={paymentItem.slotTime || paymentItem.slot_time}
                  totalFee={details.total}
                  onBack={() => { setPaymentItem(null); setShowPaymentSummary(false); setIsFinalSettlementPayment(false); }}
                  onPay={() => handlePaymentSuccess({ method: 'online' })}
                  isLoading={settlingId === paymentItem.id}
                />
              );
            })()}
          </div>
        </div>
      )}

      <SuccessModal
        isOpen={showSuccessModal}
        title={successTitle}
        message={successMsg}
        onConfirm={() => setShowSuccessModal(false)}
      />
    </div>
  );
};

export default TransactionsPage;

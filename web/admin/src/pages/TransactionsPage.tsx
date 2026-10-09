import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Booking, User, BookingStatus, Location } from '../types';
import LoadingButton from '../components/LoadingButton';
import { motion, AnimatePresence } from 'framer-motion';
import { IndianRupee, CalendarSearch, Filter, History, PieChart, ArrowUpRight, QrCode, ChevronDown, ChevronUp, Receipt } from 'lucide-react';
import { handleError } from '../services/errorHandler';
import { useTheme } from '../contexts/ThemeContext';
import { DatePickerModal } from '../components/CustomPickers';
import { bookingService } from '../services/bookingService';

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

  const getLocalDateString = (date: Date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleViewTicket = async (booking: any) => {
    setFetchingId(booking.id);
    setLoadingQR(true);
    try {
        const { data: loc } = await supabase.from('locations').select('*').eq('id', booking.locationId).single();
        if (loc && onShowQR) {
            onShowQR(booking, loc as Location);
        }
    } catch (e) {
        onAlert?.(handleError(e).message, 'error');
    } finally {
        setLoadingQR(false);
        setFetchingId(null);
    }
  };

  const handlePaySettlement = async (booking: any, challengeId: string) => {
    setSettlingId(booking.id);
    try {
      const { error: updateError } = await supabase
        .from('challenges')
        .update({ settlement_status: 'completed' })
        .eq('id', challengeId);

      if (updateError) throw updateError;

      onAlert?.('Settlement paid successfully!', 'success');
      setChallengesList(prev => prev.map(c => c.id === challengeId ? { ...c, settlement_status: 'completed' } : c));
    } catch (e) {
      onAlert?.(handleError(e).message, 'error');
    } finally {
      setSettlingId(null);
    }
  };

  const [selectedDate, setSelectedDate] = useState(getLocalDateString());

  useEffect(() => {
    const fetchUserTransactions = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // 1. Fetch user payments from ledger
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('payments')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (paymentsError) throw paymentsError;
        setPayments(paymentsData || []);

        // 2. Fetch associated bookings to show slot details
        const bookingIds = [...new Set((paymentsData || []).map(p => p.booking_id))];

        const [{ data: locationsData }, { data: courtsData }, { data: bookingsData }] = await Promise.all([
          supabase.from('locations').select('id, name'),
          supabase.from('courts').select('id, name, court_number'),
          bookingIds.length > 0
            ? supabase.from('bookings').select('*, join_requests(*)').in('id', bookingIds)
            : Promise.resolve({ data: [] })
        ]);

        const locationMap = new Map((locationsData || []).map(l => [l.id, l.name]));
        const courtMap = new Map((courtsData || []).map(c => [c.id, c.name || `Court ${c.court_number}`]));

        const mappedBookings = (bookingsData || []).map(b => ({
          id: b.id, name: b.name, phone: b.phone, date: b.date, locationId: b.location_id,
          courtId: b.court_id, slotId: b.slot_id, slotTime: b.slot_time, startHour: b.start_hour, endHour: b.end_hour,
          duration: b.duration, amount: b.amount, advancePaid: b.advance_paid,
          status: b.status as BookingStatus, paymentMethod: b.payment_method,
          paymentType: b.payment_type, checkedIn: b.checked_in, createdAt: b.created_at,
          bookedBy: b.booked_by, isJoinable: b.is_joinable, maxPlayers: b.max_players,
          currentPlayers: b.current_players, joinRequests: b.join_requests || [],
          sport: b.sport, user_id: b.user_id,
          arenaName: locationMap.get(b.location_id) || 'Unknown Arena',
          courtName: courtMap.get(b.court_id) || 'Unknown Court'
        }));

        const bookingsMap = new Map(mappedBookings.map(b => [b.id, b]));

        // Match payments to their booking details
        const enrichedPayments = (paymentsData || []).map(p => {
          const b = bookingsMap.get(p.booking_id);
          if (!b) return null;

          return {
            ...p,
            booking: b
          };
        }).filter(Boolean);

        setBookings(enrichedPayments as any);

        const [{ data: resultsData }, { data: challengesData }] = await Promise.all([
          supabase.from('match_results').select('*'),
          supabase.from('challenges').select('*')
        ]);

        setMatchResults(resultsData || []);
        setChallengesList(challengesData || []);

        // Fetch all payments for booking IDs
        const allBkIds = [...new Set(mappedBookings.map(b => b.id))];
        const { data: allPayData } = allBkIds.length > 0
          ? await supabase.from('payments').select('*').in('booking_id', allBkIds)
          : { data: [] };

        setAllPaymentsList(allPayData || paymentsData || []);

        const involvedUserIds = new Set<string>();
        mappedBookings.forEach(b => { if (b.user_id) involvedUserIds.add(String(b.user_id)); });
        (allPayData || []).forEach(p => { if (p.user_id) involvedUserIds.add(String(p.user_id)); });
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
        if (onAlert && !bookings.length) onAlert(appError.message, 'error');
      }
      finally { setLoading(false); }
    };
    fetchUserTransactions();
  }, [user?.id, onAlert]);

  const [filterDate, setFilterDate] = useState(() => getLocalDateString());

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
    <div className="max-w-4xl lg:max-w-7xl mx-auto p-5 md:p-8 space-y-8 md:space-y-10 min-h-screen relative overflow-hidden transition-all duration-300 bg-background"
         style={{ backgroundColor: theme.colors.background }}>
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none opacity-20 md:block hidden" style={{ backgroundColor: theme.colors.accent }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none opacity-20 md:block hidden" style={{ backgroundColor: theme.colors.success }} />

      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative z-50 flex justify-between items-start pt-4 md:pt-0">
        <div className="px-1 md:px-0">
            <h1 className="text-3xl md:text-5xl font-black italic md:not-italic tracking-tighter md:tracking-normal uppercase leading-none text-text-primary">
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
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-text-disabled">Loading records...</p>
            </motion.div>
          ) : filteredBookings.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-32 rounded-[2.5rem] border-2 border-dashed border-border shadow-inner bg-background-secondary/30">
              <p className="font-black uppercase text-xs tracking-[0.3em] text-text-disabled opacity-50">No bookings found</p>
            </motion.div>
          ) : (
            <div className="flex flex-col gap-5 md:gap-6">
              {filteredBookings.map((p: any, idx) => {
                const b = p.booking;
                return (
                  <motion.div layout initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: idx * 0.05 }} key={p.id} whileHover={{ scale: 1.02, x: 10 }}
                    className="p-[5vw] md:p-8 border shadow-theme-card hover:shadow-theme-elevated transition-all group relative overflow-hidden"
                    style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radius.large }}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full opacity-5" style={{ backgroundColor: theme.colors.accent }} />

                    {/* Mobile View Structure */}
                    <div className="flex sm:hidden flex-col gap-3.5 relative z-10 w-full">
                      {/* Row 1: Sport Icon + Slot Time and Status Badge */}
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center border bg-slate-50">
                            <span className="text-xl">{b.sport.includes('Football') ? '⚽' : '🏏'}</span>
                          </div>
                          <h3 className="text-base font-black italic tracking-tight text-slate-800">{b.slotTime}</h3>
                        </div>
                        <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter"
                              style={{
                                backgroundColor: b.status === BookingStatus.CONFIRMED ? `${theme.colors.success}20` :
                                                 b.status === BookingStatus.TIMED_OUT ? `${theme.colors.warning}20` :
                                                 b.status === BookingStatus.BOOKED ? `${theme.colors.accent}20` :
                                                 b.status === BookingStatus.DECLINED ? `${theme.colors.error}20` :
                                                 `${theme.colors.textDisabled}20`,
                                color: b.status === BookingStatus.CONFIRMED ? theme.colors.success :
                                       b.status === BookingStatus.TIMED_OUT ? theme.colors.warning :
                                       b.status === BookingStatus.BOOKED ? theme.colors.accent :
                                       b.status === BookingStatus.DECLINED ? theme.colors.error :
                                       theme.colors.textDisabled
                              }}>
                          {b.status === BookingStatus.BOOKED ? 'Booked' :
                           b.status === BookingStatus.CONFIRMED ? 'Confirmed' :
                           b.status === BookingStatus.TIMED_OUT ? 'Timed Out' :
                           b.status === BookingStatus.DECLINED ? 'Declined' :
                           b.status}
                        </span>
                      </div>

                      {/* Row 2: Secondary Attributes Track */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[9px] font-black uppercase text-slate-600 flex items-center gap-1">
                          <CalendarSearch className="w-2.5 h-2.5 text-blue-600" /> {b.date}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[9px] font-black uppercase text-slate-600">
                          {b.arenaName} - {b.courtName}
                        </span>
                        {(() => {
                          const ch = challengesList.find(c => String(c.booking_id) === String(b.id) || String(c.id) === String(b.id));
                          const res = matchResults.find(r => String(r.challenge_id) === String(ch?.id));
                          const isJoinableMatch = b.isJoinable || b.is_joinable || b.type === 'match';

                          let label = 'Normal Booking';
                          let bgColor = `${theme.colors.textDisabled}10`;
                          let textColor = theme.colors.textDisabled;

                          if (ch) {
                            if (ch.lose_to_pay) {
                              if (res) {
                                const isWinner = String(res.winner_id) === String(user?.id);
                                const isTie = res.winner_id === null && res.loser_id === null;
                                label = isTie ? 'Challenge Lose to Pay (Tie)' : (isWinner ? 'Challenge Lose to Pay (Won)' : 'Challenge Lose to Pay (Lost)');
                              } else {
                                label = 'Challenge Lose to Pay';
                              }
                              bgColor = `${theme.colors.error}15`;
                              textColor = theme.colors.error;
                            } else {
                              label = 'Friendly Challenge';
                              bgColor = `${theme.colors.success}15`;
                              textColor = theme.colors.success;
                            }
                          } else if (isJoinableMatch) {
                            label = 'Joinable Match';
                            bgColor = `${theme.colors.accent}15`;
                            textColor = theme.colors.accent;
                          } else {
                            label = 'Normal Booking';
                            bgColor = `${theme.colors.textDisabled}15`;
                            textColor = theme.colors.textDisabled;
                          }

                          return (
                            <span className="px-2 py-0.5 rounded bg-slate-100 border text-[9px] font-black uppercase tracking-wide"
                                  style={{ color: textColor, borderColor: `${textColor}30` }}>
                              {label}
                            </span>
                          );
                        })()}
                      </div>

                      {/* Row 3: Transaction Finances box */}
                      <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl grid grid-cols-2 gap-2 text-xs">
                        <div className="space-y-0.5">
                          <p className="text-[9px] uppercase font-black tracking-wider text-slate-400">Ledger Amount</p>
                          <p className="text-base font-black text-slate-800">₹{Number(p.amount || 0).toLocaleString()}</p>
                          <p className="text-[8px] font-black uppercase tracking-wider text-blue-600">
                            {p.payment_type === 'full' ? 'Paid Full' : p.payment_type === 'settlement' ? 'Settlement Paid' : 'Advance Paid'}
                          </p>
                        </div>
                        <div className="space-y-0.5 text-right border-l border-slate-200/60 pl-3">
                          <p className="text-[9px] uppercase font-black tracking-wider text-slate-400">Match Total</p>
                          <p className="text-base font-black text-slate-800">₹{b.amount.toLocaleString()}</p>
                        </div>
                      </div>

                      {/* Row 4: Action Footer Toolbar */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="text-[9px] font-bold text-slate-400">
                          {new Date(b.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                        <div className="flex items-center gap-2">
                          {(b.status === BookingStatus.APPROVED || b.status === BookingStatus.BOOKED || b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.COMPLETED) && (
                            <LoadingButton
                              loading={loadingQR && fetchingId === b.id}
                              onClick={(e) => { e.stopPropagation(); handleViewTicket(b); }}
                              className="px-3 py-1.5 rounded-lg bg-accent text-white text-[9px] font-black uppercase tracking-wider"
                              loadingText="Loading..."
                              icon={<QrCode className="w-3 h-3" />}
                            >
                              View Ticket
                            </LoadingButton>
                          )}

                          {(() => {
                            const ch = challengesList.find(c => String(c.booking_id) === String(b.id) || String(c.id) === String(b.id));
                            if (!ch || ch.settlement_status === 'completed' || ch.status !== 'confirmed') return null;

                            const res = matchResults.find(r => String(r.challenge_id) === String(ch.id));
                            let shouldShow = false;

                            if (String(ch.challenger_id) === String(user?.id)) {
                              if (!res) {
                                shouldShow = true;
                              } else {
                                const isTie = res.winner_id === null && res.loser_id === null;
                                if (isTie) shouldShow = true;
                                else if (!ch.lose_to_pay) shouldShow = true;
                                else if (String(res.loser_id) === String(user?.id)) shouldShow = true;
                              }
                            } else if (String(ch.accepted_by) === String(user?.id)) {
                              if (res) {
                                const isTie = res.winner_id === null && res.loser_id === null;
                                if (!isTie && ch.lose_to_pay && String(res.loser_id) === String(user?.id)) {
                                  shouldShow = true;
                                }
                              }
                            }

                            if (!shouldShow) return null;

                            return (
                              <LoadingButton
                                loading={settlingId === b.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePaySettlement(b, ch.id);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-error text-white text-[9px] font-black uppercase tracking-wider"
                                loadingText="Processing..."
                                icon={<IndianRupee className="w-3 h-3" />}
                              >
                                Settlement
                              </LoadingButton>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Desktop View Structure */}
                    <div className="hidden sm:flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10 w-full">
                      <div className="flex items-center gap-6 cursor-pointer" onClick={() => navigate(`/arena/${b.locationId}`)}>
                        <div className="w-16 h-16 rounded-[1.25rem] flex items-center justify-center group-hover:scale-110 group-hover:rotate-12 transition-all shadow-theme-elevated border" style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}>
                          <span className="text-3xl drop-shadow-lg">{b.sport.includes('Football') ? '⚽' : '🏏'}</span>
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-2xl font-black italic tracking-tighter uppercase leading-none" style={{ color: theme.colors.textPrimary }}>{b.slotTime}</h3>
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: theme.colors.textDisabled }}><CalendarSearch className="w-3 h-3" style={{ color: theme.colors.accent }} /> {b.date}</p>
                            <span className="w-1 h-1 rounded-full opacity-20" style={{ backgroundColor: theme.colors.textPrimary }} />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] italic" style={{ color: theme.colors.textDisabled }}>{b.arenaName} - {b.courtName}</p>
                            <span className="w-1 h-1 rounded-full opacity-20" style={{ backgroundColor: theme.colors.textPrimary }} />

                            {/* Match Type Badge */}
                            {(() => {
                              const ch = challengesList.find(c => String(c.booking_id) === String(b.id) || String(c.id) === String(b.id));
                              const res = matchResults.find(r => String(r.challenge_id) === String(ch?.id));
                              const isJoinableMatch = b.isJoinable || b.is_joinable || b.type === 'match';

                              let label = 'Normal Booking';
                              let bgColor = `${theme.colors.textDisabled}10`;
                              let textColor = theme.colors.textDisabled;

                              if (ch) {
                                if (ch.lose_to_pay) {
                                  if (res) {
                                    const isWinner = String(res.winner_id) === String(user?.id);
                                    const isTie = res.winner_id === null && res.loser_id === null;
                                    label = isTie ? 'Challenge Lose to Pay (Tie)' : (isWinner ? 'Challenge Lose to Pay (Won)' : 'Challenge Lose to Pay (Lost)');
                                  } else {
                                    label = 'Challenge Lose to Pay';
                                  }
                                  bgColor = `${theme.colors.error}15`;
                                  textColor = theme.colors.error;
                                } else {
                                  label = 'Friendly Challenge';
                                  bgColor = `${theme.colors.success}15`;
                                  textColor = theme.colors.success;
                                }
                              } else if (isJoinableMatch) {
                                label = 'Joinable Match';
                                bgColor = `${theme.colors.accent}15`;
                                textColor = theme.colors.accent;
                              } else {
                                label = 'Normal Booking';
                                bgColor = `${theme.colors.textDisabled}15`;
                                textColor = theme.colors.textDisabled;
                              }

                              return (
                                <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border border-current"
                                      style={{ backgroundColor: bgColor, color: textColor, borderColor: `${textColor}40` }}>
                                  {label}
                                </span>
                              );
                            })()}

                            <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter"
                                  style={{
                                    backgroundColor: b.status === BookingStatus.CONFIRMED ? `${theme.colors.success}20` :
                                                     b.status === BookingStatus.TIMED_OUT ? `${theme.colors.warning}20` :
                                                     b.status === BookingStatus.BOOKED ? `${theme.colors.accent}20` :
                                                     b.status === BookingStatus.DECLINED ? `${theme.colors.error}20` :
                                                     `${theme.colors.textDisabled}20`,
                                    color: b.status === BookingStatus.CONFIRMED ? theme.colors.success :
                                           b.status === BookingStatus.TIMED_OUT ? theme.colors.warning :
                                           b.status === BookingStatus.BOOKED ? theme.colors.accent :
                                           b.status === BookingStatus.DECLINED ? theme.colors.error :
                                           theme.colors.textDisabled
                                  }}>
                              {b.status === BookingStatus.BOOKED ? 'Booked' :
                               b.status === BookingStatus.CONFIRMED ? 'Confirmed' :
                               b.status === BookingStatus.TIMED_OUT ? 'Timed Out' :
                               b.status === BookingStatus.DECLINED ? 'Declined' :
                               b.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="flex flex-col gap-2">
                          {(b.status === BookingStatus.APPROVED || b.status === BookingStatus.BOOKED || b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.COMPLETED) && (
                                    <LoadingButton
                              loading={loadingQR && fetchingId === b.id}
                              onClick={(e) => { e.stopPropagation(); handleViewTicket(b); }}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white text-[10px] font-black uppercase tracking-widest shadow-theme-elevated"
                              loadingText="Loading..."
                              icon={<QrCode className="w-4 h-4" />}
                            >
                              View Ticket
                            </LoadingButton>
                          )}

                          {(() => {
                            const ch = challengesList.find(c => String(c.booking_id) === String(b.id) || String(c.id) === String(b.id));
                            if (!ch || ch.settlement_status === 'completed' || ch.status !== 'confirmed') return null;

                            const res = matchResults.find(r => String(r.challenge_id) === String(ch.id));
                            let shouldShow = false;

                            if (String(ch.challenger_id) === String(user?.id)) {
                              if (!res) {
                                shouldShow = true;
                              } else {
                                const isTie = res.winner_id === null && res.loser_id === null;
                                if (isTie) shouldShow = true;
                                else if (!ch.lose_to_pay) shouldShow = true;
                                else if (String(res.loser_id) === String(user?.id)) shouldShow = true;
                              }
                            } else if (String(ch.accepted_by) === String(user?.id)) {
                              if (res) {
                                const isTie = res.winner_id === null && res.loser_id === null;
                                if (!isTie && ch.lose_to_pay && String(res.loser_id) === String(user?.id)) {
                                  shouldShow = true;
                                }
                              }
                            }

                            if (!shouldShow) return null;

                            return (
                              <LoadingButton
                                loading={settlingId === b.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePaySettlement(b, ch.id);
                                }}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-error text-white text-[10px] font-black uppercase tracking-widest shadow-theme-elevated"
                                loadingText="Processing..."
                                icon={<IndianRupee className="w-4 h-4" />}
                              >
                                Pay Final Settlement
                              </LoadingButton>
                            );
                          })()}
                        </div>
                        <div className="flex flex-col items-end gap-3 min-w-[150px]">
                          {/* Primary Amount Display: Ledger Amount */}
                          <div className="text-right px-1">
                            <p className="text-3xl font-black italic tracking-tighter" style={{ color: theme.colors.textPrimary }}>
                              ₹{Number(p.amount || 0).toLocaleString()}
                            </p>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60" style={{ color: theme.colors.textDisabled }}>
                              {p.payment_type === 'full' ? 'Paid Full' : p.payment_type === 'settlement' ? 'Settlement Paid' : 'Advance Paid'}
                            </p>
                          </div>

                          {/* 3. Total Match (Contextual Footer) */}
                          <div className="pt-2 border-t w-full flex justify-between items-center gap-4 mt-1" style={{ borderColor: theme.colors.border }}>
                            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: theme.colors.textDisabled }}>Match Total</p>
                            <p className="text-sm font-black" style={{ color: theme.colors.textPrimary }}>₹{b.amount.toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="w-12 h-12 rounded-full border-2 flex items-center justify-center group-hover:rotate-45 transition-transform cursor-pointer" onClick={() => navigate(`/arena/${b.locationId}`)} style={{ borderColor: theme.colors.border }}>
                          <ArrowUpRight className="w-5 h-5" style={{ color: theme.colors.accent }} />
                        </div>
                      </div>
                    </div>
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

      {loadingQR && (
        <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

export default TransactionsPage;

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { DURATIONS, SPORT_CONFIG, getLocalISODate } from '../constants';
import { Booking, BookingStatus, PaymentMethod, PaymentType, Location, User, SportType, getSportCapability, SportCategory } from '../types';
import { bookingService } from '../services/bookingService';
import { locationService } from '../services/locationService';
import { validateBookingSlot } from '../services/bookingValidation';
import QRCodeModal from '../components/QRCodeModal';
import { getPricingForLocation, Pricing } from '../services/pricingService';
import { DurationPickerModal, DatePickerModal } from '../components/CustomPickers';
import { storage } from '../services/storage';
import { supabase } from '../services/supabase';
import { scheduleService } from '../services/scheduleService';
import LoadingButton from '../components/LoadingButton';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import { handleError } from '../services/errorHandler';
import { useTheme } from '../contexts/ThemeContext';
import { usePermissions } from '../hooks/usePermissions';
import PaymentPage from '../components/PaymentPage';
import SuccessModal from '../components/SuccessModal';
import GameZoneBooking from './GameZoneBooking';
import { forceScrollTop } from '../utils/scroll';

const ImageCarousel: React.FC<{ images: string[] }> = ({ images }) => {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<number | null>(null);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (images.length <= 1) return;
    timerRef.current = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 5000);
  };

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [images]);

  useEffect(() => {
    setIndex(0);
  }, [images]);

  if (!images || images.length === 0) return <div className="w-full h-full bg-slate-900/50" />;

  return (
    <div className="relative w-full h-full overflow-hidden">
      <motion.div
        animate={{ x: `-${index * 100}%` }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -50 && index < images.length - 1) {
            setIndex(index + 1);
            startTimer();
          } else if (info.offset.x > 50 && index > 0) {
            setIndex(index - 1);
            startTimer();
          }
        }}
        className="flex h-full w-full cursor-grab active:cursor-grabbing"
      >
        {images.map((img, i) => (
          <div key={i} className="flex-shrink-0 w-full h-full">
            <img src={img} className="w-full h-full object-cover opacity-30 pointer-events-none" alt="" />
          </div>
        ))}
      </motion.div>
      {images.length > 1 && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-1.5 z-20 pointer-events-none">
          {images.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/30'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const HorizontalDateSelector: React.FC<{
  dates: string[];
  selectedDate: string;
  onSelect: (date: string) => void;
  theme: any;
}> = ({ dates, selectedDate, onSelect, theme }) => {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar snap-x">
      {dates.map((dStr) => {
        const d = new Date(dStr);
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
        const dayNum = d.getDate();
        const monthName = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
        const isSelected = dStr === selectedDate;

        return (
          <button
            key={dStr}
            onClick={() => onSelect(dStr)}
            className={`flex-shrink-0 w-16 h-20 rounded-2xl border-2 flex flex-col items-center justify-center transition-all snap-center ${
              isSelected ? 'shadow-theme-elevated' : 'border-transparent'
            }`}
            style={{
              backgroundColor: isSelected ? theme.colors.accent : `${theme.colors.backgroundSecondary}40`,
              borderColor: isSelected ? theme.colors.accent : 'transparent',
              color: isSelected ? 'white' : theme.colors.textPrimary,
            }}
          >
            <span className={`text-[8px] font-black mb-1 ${isSelected ? 'text-white/80' : 'text-text-disabled'}`}>{dayName}</span>
            <span className="text-xl font-black italic leading-none">{dayNum}</span>
            <span className={`text-[8px] font-black mt-1 ${isSelected ? 'text-white/80' : 'text-text-disabled'}`}>{monthName}</span>
          </button>
        );
      })}
    </div>
  );
};

interface BookingPageProps {
  location: Location;
  isAdminManual?: boolean;
  onComplete?: () => void;
  userRole?: string;
  user: User | null;
  onBack?: () => void;
  onAlert?: (msg: string, type: 'success' | 'error' | 'info') => void;
  onShowQR?: (booking: Booking, location: Location) => void;
  selectedSport?: string | null;
}

const BookingPage: React.FC<BookingPageProps> = ({ location, isAdminManual = false, onComplete, userRole = 'user', user, onBack, onAlert, onShowQR, selectedSport: propSport }) => {
  const { theme } = useTheme();
  const { checkAndPrompt, permissions } = usePermissions();
  const slotsRef = useRef<HTMLDivElement>(null);
  const slotsGridRef = useRef<HTMLDivElement>(null);
  const hasAutoScrolled = useRef<string>('');
  const notificationsUnavailableRef = useRef<boolean>(
    typeof window !== 'undefined' && sessionStorage.getItem('boxit_notifications_unavailable') === '1'
  );

  const [now, setNow] = useState(() => new Date());
  const todayStr = useMemo(() => getLocalISODate(now), [now]);

  useEffect(() => {
    const refreshNow = () => setNow(new Date());
    const intervalId = window.setInterval(refreshNow, 30 * 1000);
    window.addEventListener('focus', refreshNow);

    const onVisibilityChange = () => {
      if (!document.hidden) refreshNow();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshNow);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const PAGE_ID = `booking_${location.id}`;
  const savedState = storage.getPageState<any>(PAGE_ID) || {};

  const [name, setName] = useState(savedState.name || '');
  const [phone, setPhone] = useState(savedState.phone || '');

  // Flag to ensure profile sync only happens once if state was empty
  const profileSyncedRef = useRef(!!savedState.name);

  useEffect(() => {
    if (user && !profileSyncedRef.current) {
      if (!name) setName(user.display_name || '');
      if (!phone) setPhone(user.phone_number || '');
      profileSyncedRef.current = true;
    }
  }, [user]);
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(savedState.selectedCourtId || null);
  const [duration, setDuration] = useState(savedState.duration || '1');
  const [date, setDate] = useState(() => todayStr);

  // Force date to today on mount, bypassing savedState.date
  useEffect(() => {
    setDate(todayStr);
  }, [todayStr]);

  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(savedState.selectedSlotId || null);
  const [isJoinable, setIsJoinable] = useState(savedState.isJoinable || false);
  const [isChallengeEnabled, setIsChallengeEnabled] = useState(savedState.isChallengeEnabled || false);
  const [paymentChoice, setPaymentChoice] = useState<PaymentType>(
    (savedState.isChallengeEnabled || savedState.isJoinable)
      ? PaymentType.ADVANCE
      : (savedState.paymentChoice || (location.advanceBookingRequired ? PaymentType.ADVANCE : PaymentType.FULL))
  );

  useEffect(() => {
    if (isChallengeEnabled || isJoinable) {
      setPaymentChoice(PaymentType.ADVANCE);
    } else if (!location.advanceBookingRequired) {
      setPaymentChoice(PaymentType.FULL);
    }
  }, [location.advanceBookingRequired, isChallengeEnabled, isJoinable]);

  const selectedSport = useMemo(() => {
    if (propSport && location.supportedSports.some(s => s.toLowerCase() === propSport.toLowerCase())) {
      return propSport as SportType;
    }
    return location.supportedSports[0] || SportType.CRICKET;
  }, [location, propSport]);
  const sportConfig = useMemo(() => SPORT_CONFIG[selectedSport] || SPORT_CONFIG[SportType.CRICKET], [selectedSport]);
  const sportCap = useMemo(() => getSportCapability(selectedSport), [selectedSport]);

  useEffect(() => {
    if (!sportCap.supportsChallenge && !sportCap.supportsJoinable) {
      setIsChallengeEnabled(false);
      setIsJoinable(false);
    }
  }, [sportCap]);

  const handleToggleJoinable = (val: boolean) => {
    setIsJoinable(val);
    if (val) {
      setIsChallengeEnabled(false);
      setPaymentChoice(PaymentType.ADVANCE);
    } else if (!location.advanceBookingRequired && !isChallengeEnabled) {
      setPaymentChoice(PaymentType.FULL);
    }
  };

  const handleToggleChallenge = (val: boolean) => {
    setIsChallengeEnabled(val);
    if (val) {
      setIsJoinable(false);
      setPaymentChoice(PaymentType.ADVANCE);
    } else if (!location.advanceBookingRequired && !isJoinable) {
      setPaymentChoice(PaymentType.FULL);
    }
  };
  const [maxPlayersLimit, setMaxPlayersLimit] = useState(savedState.maxPlayersLimit || sportConfig.defaultCapacity);
  const [playersIHave, setPlayersIHave] = useState(savedState.playersIHave || 1);
  const [swimmingTicketsCount, setSwimmingTicketsCount] = useState<number>(savedState.swimmingTicketsCount || 1);

  // Update capacity if sport changes
  useEffect(() => {
    if (!savedState.maxPlayersLimit) {
      setMaxPlayersLimit(sportConfig.defaultCapacity);
    }
  }, [sportConfig, savedState.maxPlayersLimit]);

  const [validationError, setValidationError] = useState<string>('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [joiningBooking, setJoiningBooking] = useState<Booking | null>(null);
  const [joiningPlayersCount, setJoiningPlayersCount] = useState(1);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [pricing, setPricing] = useState<Pricing[]>([]);
  const [loading, setLoading] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location>(location);

  // Force scroll to top when switching internal views (Payment, Join Booking, Confirm)
  useEffect(() => {
    return forceScrollTop();
  }, [showPayment, joiningBooking, showConfirm, showSuccess]);

  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [userSentMatchRequests, setUserSentMatchRequests] = useState<Set<string>>(new Set());
  const [userAcceptedMatches, setUserAcceptedMatches] = useState<Set<string>>(new Set());

  const insertNotificationsSafely = async (rows: any[]): Promise<{ success: boolean; count: number }> => {
    if (!rows?.length) return { success: false, count: 0 };

    if (notificationsUnavailableRef.current) {
      console.log('Skipping notification insert: marked as unavailable for this session.');
      return { success: false, count: 0 };
    }

    const payload = rows
      .filter((row: any) => row?.user_id)
      .map((row: any) => ({
        ...row,
        user_id: typeof row.user_id === 'string' ? row.user_id.trim() : row.user_id
      }));

    if (payload.length === 0) {
      console.log('Skipping notification insert: empty payload (no valid user_ids).');
      return { success: false, count: 0 };
    }

    const { error, status } = await supabase.from('notifications').insert(payload);
    if (!error) return { success: true, count: payload.length };

    const errorCode = String((error as any)?.code || '');
    const errorMessage = String((error as any)?.message || '').toLowerCase();

    console.error('Notification insert failed:', { error, status, errorCode });

    const isMissingTable = status === 404 || errorCode === '42P01' || errorCode === 'PGRST205';
    const isTypeMismatch = errorCode === '42883' || errorMessage.includes('text = uuid');

    if (isMissingTable || isTypeMismatch) {
      notificationsUnavailableRef.current = true;
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('boxit_notifications_unavailable', '1');
      }
      return { success: false, count: 0 };
    }

    return { success: false, count: 0 };
  };

  // Fetch match requests for the user
  const fetchUserRequests = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, join_requests(*)')
        .eq('is_joinable', true);

      if (error) {
        console.warn('Error fetching user match requests:', error.message);
        return;
      }

      const requestedIds = new Set<string>();
      const acceptedIds = new Set<string>();
      (data || []).forEach((b: any) => {
        const reqs = Array.isArray(b?.join_requests) ? b.join_requests : [];
        const hasPending = reqs.some((r: any) => (
          String(r?.requester_id || r?.userId || '') === String(user.id) &&
          String(r?.status || '').toLowerCase() === 'pending'
        ));
        const hasAccepted = reqs.some((r: any) => (
          String(r?.requester_id || r?.userId || '') === String(user.id) &&
          String(r?.status || '').toLowerCase() === 'accepted'
        ));
        if (hasPending) requestedIds.add(String(b.id));
        if (hasAccepted) acceptedIds.add(String(b.id));
      });
      setUserSentMatchRequests(requestedIds);
      setUserAcceptedMatches(acceptedIds);
    } catch (err) {
      console.error('Error fetching user requests:', err);
    }
  };

  useEffect(() => {
    fetchUserRequests();
  }, [user?.id]);

  useEffect(() => {
    const existingState = storage.getPageState<any>(PAGE_ID) || {};
    storage.setPageState(PAGE_ID, {
      name,
      phone,
      duration,
      date,
      selectedSlotId,
      selectedCourtId,
      paymentChoice,
      isJoinable,
      isChallengeEnabled,
      maxPlayersLimit,
      playersIHave,
      preJoinBookingId: existingState.preJoinBookingId
    }, ['isJoinable', 'isChallengeEnabled']);
  }, [PAGE_ID, name, phone, duration, date, selectedSlotId, selectedCourtId, paymentChoice, isJoinable, isChallengeEnabled, maxPlayersLimit, playersIHave]);

  const triggerAlert = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (onAlert) onAlert(msg, type);
  };

  const normalizeDateOnly = (value?: string) => {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const hasSameDuration = (ruleDuration: number, selectedDuration: number) => {
    return Math.abs(ruleDuration - selectedDuration) < 0.0001;
  };

  const getBestPricingRule = (rules: Pricing[], selectedDate: string, dayOfWeek: number) => {
    const normalizedSelectedDate = normalizeDateOnly(selectedDate);
    const dayOfWeekStr = String(dayOfWeek);

    // 1. Specific Date Match (Highest Priority)
    let priceRule = rules.find(r => {
      const type = (r.ruleType || r.rule_type || 'default').toLowerCase();
      const date = r.specificDate || r.specific_date;
      return type === 'date' && normalizeDateOnly(date) === normalizedSelectedDate;
    });

    // 2. Specific Day Match (e.g. Sunday)
    if (!priceRule) {
      priceRule = rules.find(r => {
        const type = (r.ruleType || r.rule_type || 'default').toLowerCase();
        const day = r.dayOfWeek !== undefined ? r.dayOfWeek : r.day_of_week;
        return type === 'day' && String(day) === dayOfWeekStr;
      });
    }

    // 3. Default Match (Fallback)
    if (!priceRule) {
      priceRule = rules.find(r => {
        const type = (r.ruleType || r.rule_type || 'default').toLowerCase();
        return type === 'default';
      });
    }

    return priceRule;
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [bookingsData, pricingData, locationData, schedData] = await Promise.all([
        bookingService.getBookings(location.id, date),
        getPricingForLocation(location.id),
        locationService.getLocationById(location.id),
        scheduleService.getSchedules(location.id)
      ]);

      const bookingsWithTimeouts = await Promise.all(
        bookingsData.map(b => bookingService.checkAndApplyTimeout(b))
      );

      setAllBookings(bookingsWithTimeouts);
      setPricing(pricingData);
      setSchedules(schedData || []);
      if (locationData) {
        setCurrentLocation(locationData);
      }
      if (pricingData.length > 0 && !savedState.duration) {
        const firstPrice = pricingData[0];
        const val = firstPrice.durationHours || firstPrice.duration_hours || 1;
        setDuration(String(val));
      }
    } catch (err) {
      const appError = handleError(err);
      triggerAlert(appError.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [location.id, date]);

  useEffect(() => {
    if (location.courts?.length && !selectedCourtId) {
      setSelectedCourtId(location.courts[0].id);
    }
  }, [location.courts, selectedCourtId]);

  const availableDates = useMemo(() => {
    if (!schedules || schedules.length === 0) return [];

    // Window size = explicitly green days + explicitly partially closed days
    const totalGreenConfigured = schedules.filter(s =>
        s.status === 'green' || (s.status === 'red' && s.closure_type === 'partial')
    ).length;

    if (totalGreenConfigured === 0) return [];

    // CRITICAL: Use local date to start search
    const baseMinDate = getLocalISODate(now);

    const dates: string[] = [];
    let searchDate = new Date(now);

    // helper to get closure rule for a date
    const getClosureForDate = (dStr: string) => {
        const d = new Date(dStr);
        const dayOfWeek = d.getDay();
        const month = d.getMonth();
        const day = d.getDate();

        // 1. Direct match
        const direct = schedules.find(s => s.status === 'red' && s.date === dStr);
        if (direct) return direct;

        // 2. Weekly match
        const weekly = schedules.find(s => s.status === 'red' && s.closed_option === 'weekly' && new Date(s.date).getDay() === dayOfWeek);
        if (weekly) return weekly;

        // 3. Monthly match
        const monthly = schedules.find(s => s.status === 'red' && s.closed_option === 'monthly' && new Date(s.date).getDate() === day);
        if (monthly) return monthly;

        // 4. Yearly match
        const yearly = schedules.find(s => s.status === 'red' && s.closed_option === 'yearly' && new Date(s.date).getMonth() === month && new Date(s.date).getDate() === day);
        if (yearly) return yearly;

        return null;
    };

    // limit to 60 iterations to prevent infinite loops if something goes wrong
    let iterations = 0;
    while (dates.length < totalGreenConfigured && iterations < 60) {
      const cStr = getLocalISODate(searchDate);
      const closure = getClosureForDate(cStr);

      if (!closure || closure.closure_type !== 'full') {
        dates.push(cStr);
      }
      searchDate.setDate(searchDate.getDate() + 1);
      iterations++;
    }
    return dates;
  }, [schedules, now]);

  const isOpenToday = useMemo(() => {
    if (!currentLocation) return false;
    if (schedules.length === 0) return currentLocation.is_open;

    const directSched = schedules.find(s => s.date === date);
    if (directSched) return directSched.status === 'green';

    if (availableDates.length > 0) {
      return availableDates.includes(date);
    }

    return currentLocation.is_open;
  }, [currentLocation, schedules, date, availableDates]);

  const refreshBookings = async () => {
    try {
      const bookingsData = await bookingService.getBookings(location.id, date);
      const bookingsWithTimeouts = await Promise.all(
        bookingsData.map(b => bookingService.checkAndApplyTimeout(b))
      );
      setAllBookings(bookingsWithTimeouts);
    } catch (err) {
      const appError = handleError(err);
      triggerAlert(appError.message, 'error');
    }
  };

  const activePricingRules = useMemo(() => {
    if (pricing.length === 0) return [];

    const [year, month, d] = date.split('-').map(Number);
    const selectedDateObj = new Date(year, month - 1, d);
    const dayOfWeek = selectedDateObj.getDay();
    const dayOfWeekStr = String(dayOfWeek);
    const normalizedDate = normalizeDateOnly(date);

    // 1. Filter by court (with fallback to court 1)
    const court1 = location.courts?.find(c => c.courtNumber === 1);
    let courtRules = pricing.filter(p => (p.courtId === selectedCourtId || p.court_id === selectedCourtId));
    if (courtRules.length === 0 && court1) {
        courtRules = pricing.filter(p => (p.courtId === court1.id || p.court_id === court1.id));
    }

    // 2. Global Hierarchy for the Day: Specific Date > Specific Day > Default
    const dateRules = courtRules.filter(r => (r.ruleType || r.rule_type || 'default').toLowerCase() === 'date' && normalizeDateOnly(r.specificDate || r.specific_date) === normalizedDate);
    if (dateRules.length > 0) return dateRules;

    const dayRules = courtRules.filter(r => {
      const rType = (r.ruleType || r.rule_type || 'default').toLowerCase();
      const rDay = r.dayOfWeek !== undefined ? r.dayOfWeek : r.day_of_week;
      return rType === 'day' && String(rDay) === dayOfWeekStr;
    });
    if (dayRules.length > 0) return dayRules;

    return courtRules.filter(r => (r.ruleType || r.rule_type || 'default').toLowerCase() === 'default');
  }, [pricing, date, selectedCourtId, location.courts]);

  const availableSlots = useMemo(() => {
    if (availableDates.length === 0 || !date || !availableDates.includes(date) || !selectedCourtId) return [];
    const slots = [];
    const durRaw = parseFloat(duration);
    const durMinutes = Math.round(durRaw * 60);

    const targetCourt = currentLocation.courts?.find(c => c.id === selectedCourtId) || currentLocation.courts?.[0];
    if (!targetCourt) return [];

    // Use dynamic timing from court (fallback to location)
    const startHour = targetCourt.open_hour ?? currentLocation.open_hour ?? 6;
    const endHour = targetCourt.close_hour ?? currentLocation.close_hour ?? 23;

    const startMinsTotal = startHour * 60;
    const endMinsTotal = endHour * 60;
    const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();

    const [year, month, day] = date.split('-').map(Number);
    const selectedDateObj = new Date(year, month - 1, day);
    const dayOfWeek = selectedDateObj.getDay();

    // Closure logic for this specific date
    const getClosureForSelected = () => {
        const direct = schedules.find(s => s.status === 'red' && s.date === date);
        if (direct) return direct;

        const weekly = schedules.find(s => s.status === 'red' && s.closed_option === 'weekly' && new Date(s.date).getDay() === dayOfWeek);
        if (weekly) return weekly;

        const monthly = schedules.find(s => s.status === 'red' && s.closed_option === 'monthly' && new Date(s.date).getDate() === day);
        if (monthly) return monthly;

        const yearly = schedules.find(s => s.status === 'red' && s.closed_option === 'yearly' && new Date(s.date).getMonth() === (month-1) && new Date(s.date).getDate() === day);
        if (yearly) return yearly;

        return null;
    };

    const activeClosure = getClosureForSelected();

    const morningStartMins = (targetCourt.morning_start ?? currentLocation.morning_start ?? 6) * 60;
    const morningEndMins = (targetCourt.morning_end ?? currentLocation.morning_end ?? 18) * 60;
    const nightStartMins = (targetCourt.night_start ?? currentLocation.night_start ?? 18) * 60;
    const nightEndMins = (targetCourt.night_end ?? currentLocation.night_end ?? 24) * 60;

    const isTimeInClosure = (startMins: number, endMins: number) => {
        if (!activeClosure || activeClosure.closure_type !== 'partial') return false;
        const [cS_h, cS_m] = (activeClosure.start_time || '00:00').split(':').map(Number);
        const [cE_h, cE_m] = (activeClosure.end_time || '23:59').split(':').map(Number);
        const closureStart = cS_h * 60 + cS_m;
        const closureEnd = cE_h * 60 + cE_m;
        return startMins < closureEnd && endMins > closureStart;
    };

    // Generate slots
    for (let currentStartMins = startMinsTotal; currentStartMins + durMinutes <= endMinsTotal; currentStartMins += 30) {
      const currentEndMins = currentStartMins + durMinutes;
      const midPointMins = currentStartMins + (durMinutes / 2);
      const isMorning = midPointMins >= morningStartMins && midPointMins < morningEndMins;
      const category = isMorning ? 'morning' : 'night';

      // Find the specific rule for this duration and category from active rules
      const priceRule = activePricingRules.find(
        p => hasSameDuration(p.durationHours || p.duration_hours || 0, durRaw) && (p.category ?? 'morning') === category
      );

      if (!priceRule) continue;
      const price = priceRule.price;

      const isClosed = activeClosure?.closure_type === 'full' || isTimeInClosure(currentStartMins, currentEndMins);
      const isPast = (date === todayStr && currentStartMins < currentTimeInMinutes) || isClosed;

      const advancePrice = priceRule.advancePrice || priceRule.advance_price || 0;

      const formatTimeStr = (totalMins: number) => {
        const roundedMins = Math.round(totalMins);
        const h24 = Math.floor(roundedMins / 60);
        const m = roundedMins % 60;
        const normalizedH24 = ((h24 % 24) + 24) % 24;
        const period = normalizedH24 >= 12 ? 'PM' : 'AM';
        let h12 = normalizedH24 % 12;
        if (h12 === 0) h12 = 12;
        const mStr = m < 10 ? `0${m}` : `${m}`;
        return `${h12}:${mStr} ${period}`;
      };

      slots.push({
        id: `slot-${selectedCourtId}-${date}-${currentStartMins}-${durMinutes}`,
        startTime: formatTimeStr(currentStartMins),
        endTime: formatTimeStr(currentEndMins),
        startHour: currentStartMins / 60,
        endHour: currentEndMins / 60,
        timeRange: `${formatTimeStr(currentStartMins)} - ${formatTimeStr(currentEndMins)}`,
        price,
        advancePrice: advancePrice,
        isPast,
        isCurrent: !isPast && currentStartMins >= currentTimeInMinutes && currentStartMins < currentTimeInMinutes + 60
      });
    }
    return slots;
  }, [duration, date, now, todayStr, selectedCourtId, location, activePricingRules, currentLocation.is_open]);

  // Ensure current selected date is valid or fallback to first available
  useEffect(() => {
    if (!isAdminManual && availableDates.length > 0 && !availableDates.includes(date)) {
      setDate(availableDates[0]);
    } else if (availableDates.length === 0) {
      setSelectedSlotId(null);
    }
  }, [availableDates, isAdminManual]);

  const joinableBookings = useMemo(() => {
    const currentTimeInHours = now.getHours() + now.getMinutes() / 60;
    return allBookings
      .filter(b => {
        const isPast = date === todayStr && b.endHour <= currentTimeInHours;
        return (
          b.locationId === currentLocation.id &&
          (selectedCourtId ? b.courtId === selectedCourtId : true) &&
          b.date === date &&
          b.isJoinable &&
          !isPast &&
          b.currentPlayers < b.maxPlayers &&
          [BookingStatus.APPROVED, BookingStatus.PENDING].includes(b.status)
        );
      })
      .sort((a, b) => a.startHour - b.startHour);
  }, [allBookings, currentLocation.id, selectedCourtId, date, now, todayStr]);

  useEffect(() => {
    if (joiningBooking) return;
    const state = storage.getPageState<any>(PAGE_ID) || {};
    const preJoinBookingId = state.preJoinBookingId;
    if (!preJoinBookingId) return;

    const targetBooking = joinableBookings.find(jb => jb.id === preJoinBookingId);
    if (!targetBooking) return;

    setJoiningBooking(targetBooking);
    storage.setPageState(PAGE_ID, { ...state, preJoinBookingId: null, view: null });
    fetchUserRequests();

    const { preJoinBookingId: _discard, ...rest } = state;
    storage.setPageState(PAGE_ID, rest);
  }, [PAGE_ID, joinableBookings, joiningBooking, userAcceptedMatches]);

  useEffect(() => {
    if (loading || joiningBooking) {
      hasAutoScrolled.current = 'PENDING';
      return;
    }

    // Keep this key narrow to avoid re-scrolling the grid unnecessarily.
    const contextKey = `${location.id}-${date}-${duration}-${allBookings.length}`;
    if (hasAutoScrolled.current === contextKey) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 12;

    const scrollGridToFirstAvailable = () => {
      if (cancelled) return;

      const gridContainer = slotsGridRef.current;
      if (!gridContainer) {
        if (attempts < maxAttempts) {
          attempts += 1;
          window.setTimeout(scrollGridToFirstAvailable, 80);
        }
        return;
      }

      const firstAvailable = gridContainer.querySelector('button:not(:disabled)') as HTMLElement | null;
      if (firstAvailable) {
        const topPos = firstAvailable.offsetTop;
        const rowHeightWithGap = firstAvailable.offsetHeight + 12;
        const scrollOffset = Math.max(0, topPos - rowHeightWithGap);
        gridContainer.scrollTo({ top: scrollOffset, behavior: 'smooth' });
        hasAutoScrolled.current = contextKey;
        return;
      }

      // No enabled slots yet; still keep scroll inside the grid (not the page).
      const anySlotButton = gridContainer.querySelector('button') as HTMLElement | null;
      if (anySlotButton || attempts >= maxAttempts) {
        gridContainer.scrollTo({ top: 0, behavior: 'smooth' });
        hasAutoScrolled.current = contextKey;
        return;
      }

      attempts += 1;
      window.setTimeout(scrollGridToFirstAvailable, 80);
    };

    const timer = window.setTimeout(scrollGridToFirstAvailable, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loading, joiningBooking, location.id, date, duration, allBookings.length]);

  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    setSelectedSlotId(null);
  }, [date, duration, location.id]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(value);
  };

  const getSlotBookingStats = (startH: number, endH: number) => {
    const targetCourt = currentLocation.courts?.find(c => c.id === selectedCourtId) || currentLocation.courts?.[0];
    const courtMaxCap = targetCourt?.maxCapacity || targetCourt?.max_capacity || currentLocation?.maxCapacity || currentLocation?.max_capacity;

    const isSwimming = selectedSport === SportType.SWIMMING;
    // For Swimming, capacity is ticket/occupancy capacity (e.g. 50).
    // For Court sports, capacity is 1 booking per court/time slot!
    const slotCapacity = isSwimming ? (courtMaxCap || 50) : 1;

    const overlappingBookings = allBookings.filter(b =>
      b.date === date &&
      b.locationId === location.id &&
      (selectedCourtId ? b.courtId === selectedCourtId : true) &&
      ![BookingStatus.CANCELLED, BookingStatus.REJECTED, BookingStatus.DECLINED, BookingStatus.TIMED_OUT].includes(b.status) &&
      (startH < b.endHour && b.startHour < endH)
    );

    const bookedCount = isSwimming
      ? overlappingBookings.reduce((sum, b) => sum + (Number(b.currentPlayers) || Number((b as any).group_size) || 1), 0)
      : overlappingBookings.length;

    const isFree = bookedCount < slotCapacity;
    const isFull = bookedCount >= slotCapacity;

    return { bookedCount, slotCapacity, isFree, isFull };
  };

  const isSlotFree = (startH: number, endH: number) => {
    return getSlotBookingStats(startH, endH).isFree;
  };

  const availableDurations = useMemo(() => {
    // Only show durations that exist in active pricing rules for the selected date/day
    if (activePricingRules.length === 0) return [];

    const targetCourt = currentLocation.courts?.find(c => c.id === selectedCourtId) || currentLocation.courts?.[0];
    if (!targetCourt) return [];

    const startHour = targetCourt.open_hour ?? currentLocation.open_hour ?? 6;
    const endHour = targetCourt.close_hour ?? currentLocation.close_hour ?? 23;
    const startMinsTotal = startHour * 60;
    const endMinsTotal = endHour * 60;

    const morningStartMins = (targetCourt.morning_start ?? currentLocation.morning_start ?? 6) * 60;
    const morningEndMins = (targetCourt.morning_end ?? currentLocation.morning_end ?? 18) * 60;

    const uniqueDurations = Array.from(new Set(activePricingRules.map(p => p.durationHours || p.duration_hours))).sort((a, b) => (a as any) - (b as any));

    // Filter durations to only show those that have at least one valid slot
    return uniqueDurations.filter(durRaw => {
      if (durRaw === undefined || durRaw === null) return false;
      const durMinutes = Math.round(Number(durRaw) * 60);

      for (let currentStartMins = startMinsTotal; currentStartMins + durMinutes <= endMinsTotal; currentStartMins += 30) {
        const midPointMins = currentStartMins + (durMinutes / 2);
        const isMorning = midPointMins >= morningStartMins && midPointMins < morningEndMins;
        const category = isMorning ? 'morning' : 'night';

        const priceRule = activePricingRules.find(
          p => hasSameDuration(p.durationHours || p.duration_hours || 0, Number(durRaw)) && (p.category ?? 'morning') === category
        );

        if (priceRule) return true;
      }
      return false;
    }).map(durationHours => ({
      value: String(durationHours || '1'),
      label: `${durationHours || 1} ${durationHours === 1 ? 'Hour' : 'Hours'}`
    }));
  }, [activePricingRules, date, now, todayStr, selectedCourtId, location]);

  const handleOpenConfirm = async () => {
    if (!isAdminManual) {
      if (!selectedSlotId) {
        triggerAlert("Please select a time slot", 'error');
        return;
      }
      if (!name.trim()) {
        triggerAlert("Please enter your name", 'error');
        return;
      }
      if (phone.length !== 10) {
        triggerAlert("Phone number must be 10 digits", 'error');
        return;
      }
      if (!isJoinableValid) {
        triggerAlert("Invalid player count for joinable match", 'error');
        return;
      }
    }

    const slot = availableSlots.find(s => s.id === selectedSlotId);
    if (!slot) return;
    setValidationError('');
    setLoading(true);
    try {
      const effectiveTickets = selectedSport === SportType.SWIMMING ? swimmingTicketsCount : 1;
      const stats = getSlotBookingStats(slot.startHour, slot.endHour);
      const validation = await validateBookingSlot(
        location.id,
        date,
        slot.startHour,
        slot.endHour,
        userRole,
        selectedCourtId || undefined,
        undefined,
        effectiveTickets,
        stats.slotCapacity,
        selectedSport
      );
      setLoading(false);
      if (!validation.valid) {
        setValidationError(validation.error || 'This slot cannot fit the requested number of tickets.');
        await refreshBookings();
        return;
      }
      setShowConfirm(true);
    } catch (err) {
      const appError = handleError(err);
      triggerAlert(appError.message, 'error');
      setLoading(false);
    }
  };

  const handleBooking = async (): Promise<boolean> => {
    if (isBooking) return false;
    const slot = availableSlots.find(s => s.id === selectedSlotId);
    if (!slot) return false;

    setIsBooking(true);
    const effectiveTickets = selectedSport === SportType.SWIMMING ? swimmingTicketsCount : 1;
    const totalSlotFee = slot.price * effectiveTickets;
    const singleAdvance = slot.advancePrice || currentLocation.minAdvance || 0;
    const totalAdvance = singleAdvance * effectiveTickets;
    const finalAdvanceAmount = paymentChoice === PaymentType.FULL ? totalSlotFee : totalAdvance;

    const newBooking: any = {
      id: `BK-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      name: name.trim() || (isAdminManual ? 'Admin Entry' : ''),
      phone: phone.trim() || (isAdminManual ? '0000000000' : ''),
      date,
      locationId: location.id,
      courtId: selectedCourtId,
      slotId: slot.id,
      slotTime: slot.timeRange,
      startHour: slot.startHour,
      endHour: slot.endHour,
      duration: duration,
      amount: totalSlotFee,
      advancePaid: finalAdvanceAmount,
      advance_price: totalAdvance,
      status: BookingStatus.BOOKED,
      paymentMethod: isAdminManual ? PaymentMethod.CASH : PaymentMethod.ONLINE,
      paymentType: paymentChoice,
      checkedIn: false,
      createdAt: new Date().toISOString(),
      bookedBy: isAdminManual ? 'Admin' : 'User',
      isJoinable: isJoinable,
      maxPlayers: (isJoinable || isChallengeEnabled) ? maxPlayersLimit : (selectedSport === SportType.SWIMMING ? (currentLocation.maxCapacity || 50) : 10),
      currentPlayers: selectedSport === SportType.SWIMMING ? effectiveTickets : (isJoinable ? playersIHave : (isChallengeEnabled ? maxPlayersLimit / 2 : 1)),
      joinRequests: [],
      sport: selectedSport || SportType.CRICKET,
      user_id: user?.id,
      is_challenge: isChallengeEnabled
    };

    try {
      const { data: savedBooking, error } = await bookingService.saveBooking(newBooking);
      if (error) {
        const appError = handleError(error);
        setValidationError('Failed to save booking: ' + appError.message);
        triggerAlert('Booking failed: ' + appError.message, 'error');
        setIsBooking(false);
        return false;
      }

      const realBookingId = savedBooking?.id;

      if ((isChallengeEnabled || isJoinable) && user?.id && realBookingId) {
        try {
          // Use arena coordinates instead of user's current location
          let latitude = location.latitude || 0;
          let longitude = location.longitude || 0;

          // Insert into challenges table if challenge is enabled
          if (isChallengeEnabled) {
            const { error: challengeError } = await supabase.from('challenges').insert([{
              box_id: location.id,
              challenger_id: user.id,
              latitude,
              longitude,
              radius: 5,
              status: 'active',
              slot_time: newBooking.slotTime,
              booking_id: realBookingId,
              date: newBooking.date,
              max_players: newBooking.maxPlayers,
              current_players: newBooking.currentPlayers,
              sport: selectedSport,
              amount: newBooking.amount,
              start_hour: newBooking.startHour,
              end_hour: newBooking.endHour
            }]);

            if (challengeError) {
              console.error("Challenge creation failed:", challengeError);
            } else {
              console.log("Challenge created successfully");
            }
          }

          // Background Logic: Notifications are triggered but NOT awaited
          // This lets the user see the success screen immediately.
          (async () => {
            try {
              const { data: nearbyUsers, error: rpcError } = await supabase.rpc('get_nearby_users', {
                lat: latitude,
                lng: longitude,
                radius_km: 5
              });

              let usersToNotify = [];
              if (rpcError) {
                const { data: allUsers } = await supabase.from('user_profiles').select('id');
                usersToNotify = allUsers || [];
              } else {
                usersToNotify = nearbyUsers || [];
              }

              const otherUsers = usersToNotify.filter((u: any) => String(u.id).trim() !== String(user.id).trim());

              // Helper to broadcast one type of notification
              const broadcast = async (type: 'challenge' | 'joinable') => {
                const isTypeChallenge = type === 'challenge';
                const creatorTitle = isTypeChallenge ? 'CHALLENGE CREATED!' : 'JOINABLE CREATED!';
                const broadcastTitle = isTypeChallenge ? 'NEW CHALLENGE NEARBY!' : 'NEW JOINABLE NEARBY!';
                const creatorMsgType = isTypeChallenge ? 'challenge' : 'joinable match';
                const broadcastMsgVerb = isTypeChallenge ? 'challenged others' : 'shared a joinable match';

                const creatorNote = {
                  user_id: user.id,
                  title: creatorTitle,
                  message: `Your ${creatorMsgType} at ${location.name} on ${newBooking.date} for ${newBooking.slotTime} has been created and is being shared with nearby players...`,
                  is_read: false,
                  data: {
                    type: isTypeChallenge ? 'challenge_created' : 'joinable_created',
                    booking_id: realBookingId,
                    location_name: location.name,
                    date: newBooking.date,
                    slot_time: newBooking.slotTime,
                    start_hour: newBooking.startHour,
                    end_hour: newBooking.endHour,
                    sport: selectedSport
                  }
                };

                const { success: creatorNoteSuccess } = await insertNotificationsSafely([creatorNote]);

                if (otherUsers.length > 0) {
                  const notifications = otherUsers.map((u: any) => ({
                    user_id: String(u.id).trim(),
                    title: broadcastTitle,
                    message: `${user.display_name || 'A player'} (${user.phone_number || 'N/A'}) has ${broadcastMsgVerb} at ${location.name} on ${newBooking.date} for the ${newBooking.slotTime} slots`,
                    is_read: false,
                    data: {
                      type: isTypeChallenge ? 'challenge' : 'joinable_match',
                      booking_id: String(realBookingId).trim(),
                      challenger_id: String(user.id).trim(),
                      location_name: location.name,
                      date: newBooking.date,
                      slot_time: newBooking.slotTime,
                      start_hour: newBooking.startHour,
                      end_hour: newBooking.endHour,
                      sport: selectedSport
                    }
                  }));

                  const { success: sentSuccess, count: sentCount } = await insertNotificationsSafely(notifications);

                  if (sentSuccess && creatorNoteSuccess) {
                    const { data: latestNote } = await supabase
                      .from('notifications')
                      .select('id')
                      .eq('user_id', user.id)
                      .eq('title', creatorTitle)
                      .order('created_at', { ascending: false })
                      .limit(1)
                      .single();

                    if (latestNote) {
                      await supabase
                        .from('notifications')
                        .update({
                          message: `Your ${creatorMsgType} at ${location.name} on ${newBooking.date} for ${newBooking.slotTime} has been created and shared with nearby ${sentCount} players.`
                        })
                        .eq('id', latestNote.id);
                    }
                  }
                } else {
                  const { data: latestNote } = await supabase
                    .from('notifications')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('title', creatorTitle)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                  if (latestNote) {
                    await supabase
                      .from('notifications')
                      .update({
                        message: `Your ${creatorMsgType} at ${location.name} on ${newBooking.date} for ${newBooking.slotTime} has been created, but no other players were found nearby.`
                      })
                      .eq('id', latestNote.id);
                  }
                }
              };

              if (isChallengeEnabled) await broadcast('challenge');
              if (isJoinable) await broadcast('joinable');

            } catch (bgErr) {
              console.error("Background notification task failed:", bgErr);
            }
          })();

        } catch (err) {
          console.error("Challenge core logic failed:", err);
        }
      }
      await refreshBookings();
      storage.clearPageState(PAGE_ID);

      if (isAdminManual) {
        if (onComplete) onComplete();
        setShowConfirm(false);
      } else {
        // Regular user flow: we've already saved the booking via the PaymentPage
        // which calls handleBooking() via onPay.
        // We set confirmedBooking so the QR code can be shown by onPay's next step.
        setConfirmedBooking(savedBooking || newBooking);
      }

      // Reset slot and toggles but keep name/phone for persistence
      setSelectedSlotId(null);
      setIsJoinable(false);
      setIsChallengeEnabled(false);
      return true;
    } catch (err) {
      const appError = handleError(err);
      setValidationError(appError.message);
      triggerAlert('Booking failed: ' + appError.message, 'error');
      return false;
    } finally {
      setIsBooking(false);
    }
  };

  const handleJoin = async () => {
    if (isBooking || !joiningBooking || !user) return;
    setIsBooking(true);
    try {
      // Check if already requested
      if (userSentMatchRequests.has(joiningBooking.id)) {
        triggerAlert("Request already sent for this match", 'info');
        setIsBooking(false);
        return;
      }

      const success = await bookingService.sendJoinRequest(joiningBooking, user, joiningPlayersCount, name, phone);
      if (success) {
        // Send manual notification to host and joiner
        await insertNotificationsSafely([
          {
            user_id: joiningBooking.user_id,
            title: 'NEW JOINABLE REQUEST',
            message: `${name || user.display_name || 'A player'} (${phone || user.phone_number || 'N/A'}) requested to join with ${joiningPlayersCount} player(s) for your match on ${joiningBooking.date} at ${joiningBooking.slotTime}.`,
            is_read: false,
            data: {
              type: 'match_join_request',
              booking_id: joiningBooking.id,
              requester_id: user.id,
              groupSize: joiningPlayersCount,
              playerName: name || user.display_name,
              phone: phone || user.phone_number,
              sport: selectedSport
            }
          },
          {
            user_id: user.id,
            title: 'Request Sent',
            message: `Your join request for the match at ${location.name} on ${joiningBooking.date} at ${joiningBooking.slotTime} has been sent.`,
            is_read: false,
            data: {
              type: 'match_join_request_sent',
              booking_id: joiningBooking.id,
              host_id: joiningBooking.user_id,
              sport: selectedSport
            }
          }
        ]);

        setShowSuccess(true);
        setUserSentMatchRequests(prev => new Set(prev).add(joiningBooking.id));
        setJoiningBooking(null);
        setJoiningPlayersCount(1);
        setName('');
        setPhone('');
      }
    } catch (err: any) {
      const appError = handleError(err);
      triggerAlert(appError.message || "Failed to send join request", 'error');
    } finally {
      setIsBooking(false);
    }
  };

  const isFormValid = (name.trim().length > 0 || isAdminManual) && (phone.length === 10 || isAdminManual);
  const isJoinableValid = !isJoinable || (playersIHave >= 1 && playersIHave <= maxPlayersLimit);
  const canBook = isFormValid && selectedSlotId !== null && isJoinableValid && isOpenToday;

  const currentSelectedSlot = useMemo(() => availableSlots.find(s => s.id === selectedSlotId), [availableSlots, selectedSlotId]);
  const hasAnyAvailableSlots = useMemo(() => {
    return availableSlots.some(slot => !slot.isPast && isSlotFree(slot.startHour, slot.endHour));
  }, [availableSlots, allBookings]);
  const joiningSpotsLeft = joiningBooking ? joiningBooking.maxPlayers - joiningBooking.currentPlayers : 0;

  const effectiveTickets = selectedSport === SportType.SWIMMING ? swimmingTicketsCount : 1;
  const unitPrice = currentSelectedSlot ? currentSelectedSlot.price : 0;
  const unitAdvance = currentSelectedSlot ? (currentSelectedSlot.advancePrice || currentLocation.minAdvance || 0) : 0;
  const totalSlotFee = unitPrice * effectiveTickets;
  const totalSlotAdvance = unitAdvance * effectiveTickets;
  const payableNowAmount = paymentChoice === PaymentType.FULL ? totalSlotFee : totalSlotAdvance;

  if (showPayment && currentSelectedSlot) {
    return (
      <PaymentPage
        amount={payableNowAmount}
        bookingId={Math.random().toString(36).substr(2, 6).toUpperCase()}
        locationName={location.name}
        courtName={location.courts?.find(c => c.id === selectedCourtId)?.name || 'Court 1'}
        date={date}
        slotTime={`${currentSelectedSlot.timeRange} ${effectiveTickets > 1 ? `(${effectiveTickets} Tickets)` : ''}`}
        totalFee={totalSlotFee}
        onBack={() => setShowPayment(false)}
        onPay={async () => {
          const ok = await handleBooking();
          if (ok) {
            setShowPayment(false);
            setShowSuccess(true);
          }
        }}
        isLoading={isBooking}
      />
    );
  }

  const isGameZone = selectedSport === SportType.GAME_ZONE || sportCap.category === SportCategory.RESOURCE_BASED || (currentLocation?.sportType === SportType.GAME_ZONE);

  if (isGameZone) {
    return (
      <GameZoneBooking
        location={currentLocation || location}
        user={user}
        onBack={onBack}
        onAlert={triggerAlert}
        isAdminManual={isAdminManual}
        onSuccess={(booking) => {
          if (isAdminManual) {
            triggerAlert('Manual Game Zone booking created successfully!', 'success');
            if (onComplete) onComplete(booking);
          } else {
            setConfirmedBooking(booking);
            setShowSuccess(true);
          }
        }}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`mx-auto ${isAdminManual ? 'max-w-md w-full py-4' : 'max-w-md lg:max-w-7xl pb-24 md:pb-8 lg:pb-12'}`}
    >
      <div className={`flex flex-col ${isAdminManual ? '' : 'lg:grid lg:grid-cols-12 lg:items-start lg:gap-8'}`}>

        {/* Left Column: Location Info & Inputs */}
        <div className={`${isAdminManual ? 'w-full' : 'lg:col-span-4'} space-y-6`}>
          <div className={`backdrop-blur-3xl overflow-hidden border relative transition-all duration-300`}
               style={{
                   backgroundColor: theme.colors.card,
                   borderColor: theme.colors.border,
                   borderRadius: '28px',
                   boxShadow: theme.elevation.card
               }}>
            {!isAdminManual && (
              <div className="h-48 relative group overflow-hidden" style={{ backgroundColor: theme.colors.backgroundSecondary }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedCourtId || 'default'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0"
                  >
                    <ImageCarousel
                      images={location.courts?.find(c => c.id === selectedCourtId)?.imageUrls?.length
                        ? location.courts.find(c => c.id === selectedCourtId)!.imageUrls
                        : (location.imageUrls || [])}
                    />
                  </motion.div>
                </AnimatePresence>
                <div className="absolute inset-0 bg-gradient-to-t via-transparent to-transparent pointer-events-none" style={{ backgroundImage: `linear-gradient(to top, ${theme.colors.background}, transparent)` }} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                  <motion.h1
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="text-3xl font-black italic tracking-tighter uppercase drop-shadow-2xl"
                    style={{ color: theme.colors.textPrimary }}
                  >
                    {location.name}
                  </motion.h1>
                  <p className="text-[9px] font-black tracking-[0.3em] uppercase mt-1 drop-shadow-md" style={{ color: theme.colors.accent }}>{location.address}</p>
                </div>
              </div>
            )}

            <div className={`p-6 md:p-8 ${isAdminManual ? 'pt-6' : ''} space-y-4 md:space-y-6 relative z-10`}>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1 block mb-2" style={{ color: theme.colors.textDisabled }}>Player Name</label>
                  <input type="text" placeholder="Your Name" value={name} onChange={e => setName(e.target.value)}
                         className="w-full p-4 bg-white/5 rounded-2xl border-2 border-transparent transition-all font-bold outline-none"
                         style={{ color: theme.colors.textPrimary, backgroundColor: `${theme.colors.backgroundSecondary}40` }} />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1 block mb-2" style={{ color: theme.colors.textDisabled }}>Phone Number</label>
                  <input type="tel" maxLength={10} placeholder="10 Digits" value={phone} onChange={handlePhoneChange}
                         className="w-full p-4 bg-white/5 rounded-2xl border-2 border-transparent transition-all font-bold outline-none"
                         style={{ color: theme.colors.textPrimary, backgroundColor: `${theme.colors.backgroundSecondary}40` }} />
                </div>

                {!joiningBooking && (
                  <>
                    <div className="relative col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1 block mb-2" style={{ color: theme.colors.textDisabled }}>Match Duration</label>
                      <button
                        onClick={() => setShowDurationPicker(true)}
                        className="w-full p-4 rounded-2xl border-2 border-transparent hover:border-white/20 transition-all font-bold text-left flex justify-between items-center"
                        style={{ backgroundColor: `${theme.colors.backgroundSecondary}40`, color: theme.colors.textPrimary }}
                      >
                        <span className="text-sm">{availableDurations.find(d => d.value === duration)?.label || 'Select'}</span>
                        <svg className="w-4 h-4" style={{ color: theme.colors.accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Middle Column: Slots Selection */}
        <div className={`${isAdminManual ? 'mt-6' : 'lg:col-span-4 mt-6 lg:mt-0'} space-y-6`}>
          <div className={`backdrop-blur-3xl p-6 md:p-8 border relative transition-all duration-300 h-full`}
               style={{
                   backgroundColor: theme.colors.card,
                   borderColor: theme.colors.border,
                   borderRadius: '28px',
                   boxShadow: theme.elevation.card
               }}>
            <AnimatePresence mode="wait">
              {loading && !showConfirm ? (
                <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: theme.colors.accent }}></div>
                  <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: theme.colors.accent }}>Searching Slots...</p>
                </motion.div>
              ) : (
                <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest px-1" style={{ color: theme.colors.textDisabled }}>Select Date</label>
                    {availableDates.length > 0 ? (
                      <HorizontalDateSelector dates={availableDates} selectedDate={date} onSelect={setDate} theme={theme} />
                    ) : (
                      <div className="p-8 text-center bg-white/5 rounded-[2.5rem] border border-dashed" style={{ borderColor: `${theme.colors.border}40` }}>
                        <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed" style={{ color: theme.colors.textDisabled }}>No dates available for booking</p>
                      </div>
                    )}
                  </div>
                  {!joiningBooking && (
                    <div ref={slotsRef} className="space-y-4 h-full">
                      <div className="flex flex-col gap-4 mb-4">
                        <label className="text-[10px] font-black uppercase tracking-widest px-1" style={{ color: theme.colors.textDisabled }}>Select Court</label>
                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                          {location.courts?.map((court) => (
                            <button
                              key={court.id}
                              onClick={() => { setSelectedCourtId(court.id); setSelectedSlotId(null); }}
                              className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border shrink-0 ${selectedCourtId === court.id ? 'bg-accent text-white border-accent' : 'bg-background-secondary text-text-secondary border-border'}`}
                            >
                              {court.name || `Court ${court.courtNumber}`}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: theme.colors.textDisabled }}>
                          Select Time
                          <span className="ml-2 text-[8px] opacity-60">
                            ({(currentLocation.courts?.find(c => c.id === selectedCourtId) || currentLocation).open_hour ?? 6}:00 - {(currentLocation.courts?.find(c => c.id === selectedCourtId) || currentLocation).close_hour ?? 23}:00)
                          </span>
                        </label>
                        {date === todayStr && hasAnyAvailableSlots && isOpenToday && (
                          <span className="text-[8px] font-black animate-pulse uppercase tracking-wider px-2 py-1 rounded-full"
                                style={{ backgroundColor: `${theme.colors.success}20`, color: theme.colors.success }}>Available Now</span>
                        )}
                      </div>

                      {availableDates.length === 0 ? (
                        <div className="p-12 text-center bg-white/5 rounded-[2.5rem] border border-dashed" style={{ borderColor: `${theme.colors.border}40` }}>
                          <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed" style={{ color: theme.colors.textDisabled }}>No slots available</p>
                        </div>
                      ) : !isOpenToday ? (
                        <div className="p-12 text-center bg-white/5 rounded-[2.5rem] border border-dashed" style={{ borderColor: `${theme.colors.error}40` }}>
                          <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed" style={{ color: theme.colors.error }}>This arena is currently closed for bookings</p>
                        </div>
                      ) : !hasAnyAvailableSlots ? (
                        <div className="p-12 text-center bg-white/5 rounded-[2.5rem] border border-dashed" style={{ borderColor: `${theme.colors.border}40` }}>
                          <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed" style={{ color: theme.colors.textDisabled }}>No slots found</p>
                        </div>
                      ) : (
                        <div ref={slotsGridRef} className="grid grid-cols-2 gap-3 max-h-[450px] lg:max-h-[600px] overflow-y-auto pr-2 custom-scrollbar perspective-1000 relative">
                          {availableSlots.map(slot => {
                            const { bookedCount, slotCapacity, isFree, isFull } = getSlotBookingStats(slot.startHour, slot.endHour);
                            const isAvailable = !slot.isPast && isFree;
                            const isSelected = selectedSlotId === slot.id;

                            const badgeText = slot.isPast
                              ? 'PASSED'
                              : isFull
                                ? (selectedSport === SportType.SWIMMING ? `FULL (${bookedCount}/${slotCapacity})` : 'BOOKED')
                                : selectedSport === SportType.SWIMMING
                                  ? `${bookedCount}/${slotCapacity}`
                                  : 'AVAILABLE';

                            const badgeStyleClass = slot.isPast
                              ? 'bg-gray-500/20 text-gray-400'
                              : isFull
                                ? 'bg-red-500/20 text-red-400'
                                : isSelected
                                  ? 'bg-accent text-white'
                                  : 'bg-emerald-500/15 text-emerald-500';

                            return (
                              <motion.button
                                key={slot.id}
                                whileHover={isAvailable ? { scale: 1.05 } : {}}
                                whileTap={isAvailable ? { scale: 0.95 } : {}}
                                disabled={!isAvailable || isBooking}
                                onClick={() => setSelectedSlotId(slot.id)}
                                className={`p-4 rounded-3xl border-2 flex flex-col items-center justify-center transition-all ${isSelected ? 'shadow-xl' :
                                  isAvailable ? 'border-transparent' : 'opacity-20 grayscale cursor-not-allowed'
                                  }`}
                                style={{
                                    backgroundColor: isSelected ? `${theme.colors.accent}20` : isAvailable ? `${theme.colors.backgroundSecondary}40` : 'transparent',
                                    borderColor: isSelected ? theme.colors.accent : 'transparent',
                                    boxShadow: isSelected ? `0 10px 30px ${theme.colors.accent}40` : 'none'
                                }}
                              >
                                <span className={`text-sm font-black leading-none mb-1`} style={{ color: isSelected ? theme.colors.textPrimary : theme.colors.textSecondary }}>{slot.startTime}</span>
                                <span className="text-[9px] font-black" style={{ color: theme.colors.textDisabled }}>{slot.endTime}</span>
                                <div className="flex items-center justify-between w-full mt-2 pt-1.5 border-t border-border/30">
                                  <span className={`text-[10px] font-black`} style={{ color: theme.colors.accent }}>₹{slot.price}</span>
                                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${badgeStyleClass}`}>
                                    {badgeText}
                                  </span>
                                </div>
                              </motion.button>
                            )
                          })}
                        </div>
                      )}

                      {selectedSport === SportType.SWIMMING && selectedSlotId && (() => {
                        const currentSlot = availableSlots.find(s => s.id === selectedSlotId);
                        const stats = currentSlot ? getSlotBookingStats(currentSlot.startHour, currentSlot.endHour) : null;
                        const spotsAvailable = stats ? Math.max(0, stats.slotCapacity - stats.bookedCount) : 50;
                        const ticketOptions = [1, 2, 3, 4, 5, 6, 8, 10, 15, 20].filter(num => num <= spotsAvailable);

                        return (
                          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="p-4 rounded-2xl border space-y-3 mt-4" style={{ backgroundColor: `${theme.colors.backgroundSecondary}40`, borderColor: `${theme.colors.border}30` }}>
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: theme.colors.textDisabled }}>
                                Select Tickets / Swimmers ({spotsAvailable} spots left)
                              </label>
                              <span className="text-lg font-black" style={{ color: theme.colors.accent }}>{swimmingTicketsCount} {swimmingTicketsCount === 1 ? 'Ticket' : 'Tickets'}</span>
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                              {ticketOptions.length > 0 ? (
                                ticketOptions.map(num => (
                                  <button
                                    key={num}
                                    disabled={isBooking}
                                    onClick={() => setSwimmingTicketsCount(num)}
                                    className={`min-w-[45px] py-3 rounded-xl text-xs font-black transition-all border-2 ${swimmingTicketsCount === num ? 'shadow-lg' : ''}`}
                                    style={{
                                      backgroundColor: swimmingTicketsCount === num ? theme.colors.accent : 'transparent',
                                      borderColor: swimmingTicketsCount === num ? theme.colors.accent : `${theme.colors.border}40`,
                                      color: swimmingTicketsCount === num ? 'white' : theme.colors.textDisabled
                                    }}
                                  >
                                    {num}
                                  </button>
                                ))
                              ) : (
                                <p className="text-xs font-semibold text-rose-500">No spots remaining for this slot.</p>
                              )}
                            </div>
                          </motion.div>
                        );
                      })()}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {joiningBooking && (
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          className="p-6 rounded-[2.5rem] border space-y-4 relative overflow-hidden"
                          style={{ backgroundColor: `${theme.colors.accent}10`, borderColor: `${theme.colors.accent}30` }}>
                <div className="absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full opacity-10" style={{ backgroundColor: theme.colors.accent }} />
                <button onClick={() => !isBooking && setJoiningBooking(null)} className="absolute top-4 right-4 transition-colors" style={{ color: theme.colors.accentGlow }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-[1.25rem] flex items-center justify-center mx-auto mb-3 shadow-xl transform rotate-3"
                       style={{ backgroundColor: theme.colors.accent, color: 'white' }}>
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3.005 3.005 0 013.75-2.906z" /></svg>
                  </div>
                  <h3 className="text-lg font-black italic tracking-tighter uppercase" style={{ color: theme.colors.textPrimary }}>
                    {user && String(joiningBooking.user_id) === String(user.id) ? 'Your Match' : 'Match Join'}
                  </h3>
                  <p className="text-[9px] font-black uppercase tracking-widest mt-1" style={{ color: theme.colors.accentGlow }}>{joiningBooking.slotTime}</p>
                </div>

                <div className="p-4 rounded-2xl space-y-3 border shadow-inner" style={{ backgroundColor: `${theme.colors.backgroundSecondary}40`, borderColor: `${theme.colors.border}20` }}>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: theme.colors.textDisabled }}>Adding Players</label>
                    <span className="text-lg font-black" style={{ color: theme.colors.accent }}>{joiningPlayersCount}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap pb-2">
                    {Array.from({ length: joiningSpotsLeft }, (_, i) => i + 1).map(num => (
                      <button
                        key={num}
                        disabled={isBooking}
                        onClick={() => setJoiningPlayersCount(num)}
                        className={`min-w-[45px] py-3 rounded-xl text-xs font-black transition-all border-2 ${joiningPlayersCount === num ? 'shadow-lg' : ''}`}
                        style={{
                            backgroundColor: joiningPlayersCount === num ? theme.colors.accent : 'transparent',
                            borderColor: joiningPlayersCount === num ? theme.colors.accent : `${theme.colors.border}40`,
                            color: joiningPlayersCount === num ? 'white' : theme.colors.textDisabled
                        }}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-5 rounded-2xl space-y-2 border" style={{ backgroundColor: `${theme.colors.backgroundSecondary}60`, borderColor: `${theme.colors.accent}20` }}>
                  <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest" style={{ color: theme.colors.textDisabled }}>
                    <span>Match Total</span>
                    <span style={{ color: theme.colors.textPrimary }}>₹{joiningBooking.amount}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                    <span style={{ color: theme.colors.textPrimary }}>You Pay</span>
                    <span className="text-xl font-black" style={{ color: theme.colors.accent }}>₹{Math.ceil(joiningBooking.amount / (joiningBooking.currentPlayers + joiningPlayersCount))}</span>
                  </div>
                </div>
                <LoadingButton
                  loading={isBooking}
                  disabled={!isFormValid || userSentMatchRequests.has(joiningBooking.id) || (user && String(joiningBooking.user_id) === String(user.id)) || false}
                  onClick={handleJoin}
                  className="w-full py-5 text-white rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl"
                  style={{
                      background: (user && String(joiningBooking.user_id) === String(user.id)) ? theme.colors.textDisabled :
                                  userSentMatchRequests.has(joiningBooking.id) ? theme.colors.textDisabled :
                                  `linear-gradient(to right, ${theme.colors.buttonGradient[0]}, ${theme.colors.buttonGradient[1]})`
                  }}
                  loadingText="Joining..."
                >
                  {(user && String(joiningBooking.user_id) === String(user.id)) ? 'Host Cannot Join' :
                   userSentMatchRequests.has(joiningBooking.id) || userAcceptedMatches.has(joiningBooking.id) ? 'Send Another Join Request' : 'Confirm & Join Match'}
                </LoadingButton>
              </motion.div>
            )}
          </div>
        </div>

        {/* Right Column: Extras & Confirm */}
        <div className={`${isAdminManual ? 'mt-6' : 'lg:col-span-4 mt-6 lg:mt-0'} space-y-6 lg:space-y-10 lg:sticky lg:top-8`}>
          <div className={`backdrop-blur-3xl p-6 md:p-8 border relative transition-all duration-300 h-fit`}
               style={{
                   backgroundColor: theme.colors.card,
                   borderColor: theme.colors.border,
                   borderRadius: '28px',
                   boxShadow: theme.elevation.card
               }}>
            {!joiningBooking && (
              <>
                {selectedSlotId && (location.advanceBookingRequired || isChallengeEnabled || isJoinable || selectedSport === SportType.SWIMMING) && (
                  <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-3 mb-6">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1 block" style={{ color: theme.colors.textDisabled }}>Payment Strategy</label>
                      <div className="p-1.5 rounded-2xl flex gap-2 border" style={{ backgroundColor: `${theme.colors.backgroundSecondary}40`, borderColor: `${theme.colors.border}20` }}>
                        <button
                          disabled={isBooking}
                          onClick={() => setPaymentChoice(PaymentType.ADVANCE)}
                          className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl flex flex-col items-center justify-center`}
                          style={{
                              backgroundColor: paymentChoice === PaymentType.ADVANCE ? theme.colors.accent : 'transparent',
                              color: paymentChoice === PaymentType.ADVANCE ? 'white' : theme.colors.textDisabled
                          }}
                        >
                          <span>Security Advance</span>
                          <span className="text-[11px] font-black mt-0.5" style={{ color: paymentChoice === PaymentType.ADVANCE ? 'white' : theme.colors.accent }}>
                            ₹{totalSlotAdvance.toLocaleString('en-IN')}
                          </span>
                        </button>
                        {!(isChallengeEnabled || isJoinable) && (
                          <button
                            disabled={isBooking}
                            onClick={() => setPaymentChoice(PaymentType.FULL)}
                            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl flex flex-col items-center justify-center`}
                            style={{
                                backgroundColor: paymentChoice === PaymentType.FULL ? theme.colors.accent : 'transparent',
                                color: paymentChoice === PaymentType.FULL ? 'white' : theme.colors.textDisabled
                            }}
                          >
                            <span>Pre-paid Full</span>
                            <span className="text-[11px] font-black mt-0.5" style={{ color: paymentChoice === PaymentType.FULL ? 'white' : theme.colors.accent }}>
                              ₹{totalSlotFee.toLocaleString('en-IN')}
                            </span>
                          </button>
                        )}
                      </div>
                  </motion.div>
                )}

                {!isAdminManual && selectedSport !== SportType.SWIMMING && (
                  <div className="space-y-6">
                  </div>
                )}

                {validationError && (
                  <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="p-4 rounded-xl border-l-4 mt-6" style={{ backgroundColor: `${theme.colors.error}10`, borderLeftColor: theme.colors.error }}>
                    <p className="text-[11px] font-bold" style={{ color: theme.colors.error }}>{validationError}</p>
                  </motion.div>
                )}

                {/* Confirm Button */}
                <div className="mt-8">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={loading || isBooking}
                    onClick={handleOpenConfirm}
                    className={`w-full py-5 text-white rounded-[1.5rem] font-black text-lg shadow-2xl ${!canBook ? 'opacity-50' : ''} transition-all uppercase tracking-[0.2em] flex items-center justify-center gap-3`}
                    style={{
                        background: `linear-gradient(to right, ${theme.colors.buttonGradient[0]}, ${theme.colors.buttonGradient[1]})`,
                    }}
                  >
                    {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : (isAdminManual ? 'Submit Manual' : 'Confirm Arena')}
                  </motion.button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {createPortal(
        <AnimatePresence>
          {showConfirm && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-xl p-6">
              <motion.div initial={{ scale: 0.9, opacity: 0, rotateX: 20 }} animate={{ scale: 1, opacity: 1, rotateX: 0 }} exit={{ scale: 0.9, opacity: 0 }}
                          className="border rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl perspective-1000"
                          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
                <div className="p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl"
                       style={{ backgroundColor: theme.colors.accent, color: 'white' }}>
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </div>
                  <h3 className="text-xl font-black mb-6 uppercase italic tracking-tighter" style={{ color: theme.colors.textPrimary }}>{isAdminManual ? 'Final Check' : 'Payment Summary'}</h3>
                  <div className="rounded-2xl p-5 text-left space-y-2.5 mb-6 border" style={{ backgroundColor: `${theme.colors.backgroundSecondary}40`, borderColor: `${theme.colors.border}20` }}>
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="uppercase text-[9px] font-black tracking-widest" style={{ color: theme.colors.textDisabled }}>Sport</span>
                      <span className="font-black uppercase" style={{ color: theme.colors.textPrimary }}>{selectedSport || 'Arena'}</span>
                    </div>

                    {selectedSport === SportType.SWIMMING ? (
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="uppercase text-[9px] font-black tracking-widest" style={{ color: theme.colors.textDisabled }}>Tickets</span>
                        <span className="font-black" style={{ color: theme.colors.textPrimary }}>{effectiveTickets} {effectiveTickets === 1 ? 'Ticket' : 'Tickets'}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="uppercase text-[9px] font-black tracking-widest" style={{ color: theme.colors.textDisabled }}>Court</span>
                        <span className="font-black uppercase" style={{ color: theme.colors.textPrimary }}>{currentLocation.courts?.find(c => c.id === selectedCourtId)?.name || 'Court 1'}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="uppercase text-[9px] font-black tracking-widest" style={{ color: theme.colors.textDisabled }}>Date</span>
                      <span className="font-black" style={{ color: theme.colors.textPrimary }}>{new Date(date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}</span>
                    </div>

                    {currentSelectedSlot && (
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="uppercase text-[9px] font-black tracking-widest" style={{ color: theme.colors.textDisabled }}>Time Slot</span>
                        <span className="font-black" style={{ color: theme.colors.accent }}>{currentSelectedSlot.timeRange}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="uppercase text-[9px] font-black tracking-widest" style={{ color: theme.colors.textDisabled }}>Duration</span>
                      <span className="font-black" style={{ color: theme.colors.textPrimary }}>
                        {availableDurations.find(d => d.value === duration)?.label || `${duration} ${Number(duration) === 1 ? 'Hour' : 'Hours'}`}
                      </span>
                    </div>

                    <div className="h-px my-1" style={{ backgroundColor: `${theme.colors.border}20` }} />

                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="uppercase text-[9px] font-black tracking-widest" style={{ color: theme.colors.textDisabled }}>Total Arena Fee</span>
                      <span className="font-black" style={{ color: theme.colors.textPrimary }}>₹{totalSlotFee.toLocaleString('en-IN')}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="uppercase text-[9px] font-black tracking-widest" style={{ color: theme.colors.accent }}>Payable Now</span>
                      <span className="text-xl font-black" style={{ color: theme.colors.accent }}>₹{payableNowAmount.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                  <LoadingButton
                    loading={isBooking}
                    onClick={() => {
                      if (isAdminManual) {
                        handleBooking();
                      } else {
                        setShowConfirm(false);
                        setShowPayment(true);
                      }
                    }}
                    className="w-full py-4 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl mb-3"
                    style={{ backgroundColor: theme.colors.accent }}
                    loadingText="Processing..."
                  >
                    Pay Now
                  </LoadingButton>
                  <button disabled={isBooking} onClick={() => setShowConfirm(false)} className="w-full py-2 font-black uppercase text-[9px] tracking-widest transition-colors" style={{ color: theme.colors.textDisabled }}>Discard</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <SuccessModal
        isOpen={showSuccess}
        onConfirm={() => {
          setShowSuccess(false);
          if (confirmedBooking && onShowQR) onShowQR(confirmedBooking, location);
        }}
        title="SUCCESS"
        message={joiningBooking ? "Join request sent to host!" : "Booking successful! Your ticket is ready."}
      />

      <DurationPickerModal
        isOpen={showDurationPicker}
        onClose={() => setShowDurationPicker(false)}
        options={availableDurations}
        selectedValue={duration}
        onSelect={(val) => { setDuration(val); setSelectedSlotId(null); setValidationError(''); }}
      />

      <DatePickerModal
        isOpen={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        selectedDate={date}
        minDate={todayStr}
        locationId={location.id}
        bypassSchedule={isAdminManual}
        onSelect={(d) => { setDate(d); setSelectedSlotId(null); }}
      />
    </motion.div>
  );
};

export default BookingPage;

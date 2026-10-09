import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gamepad2,
  Tv,
  Monitor,
  Sparkles,
  ChevronRight,
  Clock,
  Calendar as CalendarIcon,
  Users,
  CheckCircle2,
  XCircle,
  Plus,
  Minus,
  ArrowLeft,
  ChevronDown,
  Info
} from 'lucide-react';
import { DurationPickerModal } from '../components/CustomPickers';
import { Location, User, SportType, PaymentType, PaymentMethod, BookingStatus } from '../types';
import { gameZoneService } from '../services/gameZoneService';
import { bookingService } from '../services/bookingService';
import { scheduleService } from '../services/scheduleService';
import { getPricingForLocation } from '../services/pricingService';
import { useTheme } from '../contexts/ThemeContext';
import { getLocalISODate, DURATIONS, DAY_START_HOUR, DAY_END_HOUR } from '../constants';
import PaymentPage from '../components/PaymentPage';

interface GameZoneBookingProps {
  location: Location;
  user: User | null;
  onBack?: () => void;
  onAlert?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onSuccess?: (booking: any) => void;
}

const formatHourToStr = (hDecimal: number): string => {
  const totalMins = Math.round(hDecimal * 60);
  const h24 = Math.floor(totalMins / 60) % 24;
  const mins = totalMins % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  const minsStr = mins < 10 ? `0${mins}` : `${mins}`;
  return `${h12}:${minsStr} ${ampm}`;
};

export const GameZoneBooking: React.FC<GameZoneBookingProps> = ({
  location,
  user,
  onBack,
  onAlert,
  onSuccess
}) => {
  const { theme } = useTheme();

  const [platforms, setPlatforms] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [existingBookings, setExistingBookings] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [pricingRules, setPricingRules] = useState<any[]>([]);

  const [selectedPlatform, setSelectedPlatform] = useState<any | null>(null);
  const [selectedResourceId, setSelectedResource] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getLocalISODate());
  const [selectedDuration, setSelectedDuration] = useState<string>('1 hr');
  const [showDurationPicker, setShowDurationPicker] = useState<boolean>(false);
  const [selectedSlotHour, setSelectedSlotHour] = useState<number | null>(null);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [playerCount, setPlayerCount] = useState<number>(2);

  const [paymentChoice, setPaymentChoice] = useState<PaymentType>(PaymentType.ADVANCE);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);

  const [name, setName] = useState<string>(user?.display_name || user?.email?.split('@')[0] || '');
  const [phone, setPhone] = useState<string>(user?.phone_number || '');
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Load Game Zone catalog, schedules, and pricing from backend
  useEffect(() => {
    let isMounted = true;
    const loadCatalog = async () => {
      setLoading(true);
      try {
        const [dbPlatforms, dbResources, dbGames, dbBookings, dbSchedules, dbPricing] = await Promise.all([
          gameZoneService.getPlatforms(location.id),
          gameZoneService.getResources(location.id),
          gameZoneService.getGames(location.id),
          bookingService.getBookings(location.id, selectedDate),
          scheduleService.getSchedules(location.id),
          getPricingForLocation(location.id)
        ]);

        if (isMounted) {
          setPlatforms(dbPlatforms || []);
          setResources(dbResources || []);
          setGames(dbGames || []);
          setExistingBookings(dbBookings || []);
          setSchedules(dbSchedules || []);
          setPricingRules(dbPricing || []);

          if (dbPlatforms && dbPlatforms.length > 0 && !selectedPlatform) {
            setSelectedPlatform(dbPlatforms[0]);
          }
          if (dbResources && dbResources.length > 0 && !selectedResourceId) {
            setSelectedResource(dbResources[0].id);
          }
        }
      } catch (err) {
        console.error('Error loading Game Zone catalog:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadCatalog();
    return () => { isMounted = false; };
  }, [location.id, selectedDate]);

  // Today ISO date
  const todayStr = useMemo(() => getLocalISODate(new Date()), []);

  // Compute available dates dynamically based on Admin Schedule Settings (schedules)
  const availableDates = useMemo(() => {
    if (!schedules || schedules.length === 0) {
      // Fallback: 14 dates
      const datesList = [];
      const base = new Date();
      for (let i = 0; i < 14; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        datesList.push(getLocalISODate(d));
      }
      return datesList;
    }

    // Check total green dates configured in admin schedule
    const totalGreenConfigured = schedules.filter(s =>
      s.status === 'green' && s.date >= todayStr
    ).length;

    if (totalGreenConfigured === 0) return [];

    const dates: string[] = [];
    const base = new Date();
    let iterations = 0;

    while (dates.length < totalGreenConfigured && iterations < 60) {
      const c = new Date(base);
      c.setDate(base.getDate() + iterations);
      const cStr = getLocalISODate(c);

      const directClosed = schedules.find(s => s.status === 'red' && s.date === cStr);
      if (!directClosed) {
        dates.push(cStr);
      }
      iterations++;
    }
    return dates;
  }, [schedules, todayStr]);

  // Keep selected date valid against schedule available dates
  useEffect(() => {
    if (availableDates.length > 0 && !availableDates.includes(selectedDate)) {
      setSelectedDate(availableDates[0]);
      setSelectedSlotHour(null);
    } else if (availableDates.length === 0) {
      setSelectedSlotHour(null);
    }
  }, [availableDates, selectedDate]);

  // Selected station object
  const currentResource = useMemo(() => {
    return resources.find(r => r.id === selectedResourceId) || resources[0] || null;
  }, [resources, selectedResourceId]);

  // Active platform resources filtered by selected platform
  const activePlatformResources = useMemo(() => {
    if (!selectedPlatform) return resources;
    return resources.filter(r =>
      r.platform_id === selectedPlatform.id ||
      r.platform_type?.toLowerCase() === selectedPlatform.name?.toLowerCase()
    );
  }, [resources, selectedPlatform]);

  // Games filtered by selected platform
  const currentPlatformGames = useMemo(() => {
    if (!selectedPlatform) return games;
    return games.filter(g =>
      !g.platform_type ||
      g.platform_type.toLowerCase() === selectedPlatform.name?.toLowerCase() ||
      g.platform_type.toLowerCase() === selectedPlatform.type?.toLowerCase()
    );
  }, [games, selectedPlatform]);

  // Station-specific pricing rules matching selected station ID (or venue default fallback)
  const stationPricingRules = useMemo(() => {
    if (!currentResource || !pricingRules) return pricingRules || [];
    const matched = pricingRules.filter(p =>
      p.courtId === currentResource.id || p.court_id === currentResource.id
    );
    return matched.length > 0 ? matched : pricingRules;
  }, [pricingRules, currentResource]);

  // Available durations derived from station-specific pricing rules
  const availableDurations = useMemo(() => {
    const formatLabel = (dStr: string) => {
      const h = parseFloat(dStr);
      if (isNaN(h)) return dStr.toUpperCase();
      return `${h} ${h === 1 ? 'Hour' : 'Hours'}`;
    };

    if (!stationPricingRules || stationPricingRules.length === 0) {
      return DURATIONS.map(d => ({ value: d, label: formatLabel(d) }));
    }

    const uniqueHours = Array.from(new Set(stationPricingRules.map(p => p.durationHours || p.duration_hours)))
      .filter(Boolean)
      .sort((a, b) => Number(a) - Number(b));

    if (uniqueHours.length === 0) {
      return DURATIONS.map(d => ({ value: d, label: formatLabel(d) }));
    }

    return uniqueHours.map(h => ({
      value: `${h} hr${Number(h) > 1 ? 's' : ''}`,
      label: `${h} ${Number(h) === 1 ? 'Hour' : 'Hours'}`
    }));
  }, [stationPricingRules]);

  // Synchronize selectedDuration with availableDurations whenever station/platform changes
  useEffect(() => {
    if (availableDurations.length > 0) {
      const exists = availableDurations.some(d => d.value === selectedDuration);
      if (!exists) {
        setSelectedDuration(availableDurations[0].value);
        setSelectedSlotHour(null);
      }
    }
  }, [availableDurations, selectedDuration]);

  // Duration calculations
  const parsedDurationHours = useMemo(() => {
    const parsed = parseFloat(selectedDuration);
    if (!isNaN(parsed) && parsed > 0) return parsed;
    if (selectedDuration.includes('1.5')) return 1.5;
    if (selectedDuration.includes('2')) return 2;
    if (selectedDuration.includes('3')) return 3;
    return 1;
  }, [selectedDuration]);

  // Active pricing rule matching selected duration
  const activePricingRule = useMemo(() => {
    if (!stationPricingRules || stationPricingRules.length === 0) return null;
    return stationPricingRules.find(p =>
      Number(p.durationHours || p.duration_hours) === Number(parsedDurationHours)
    ) || null;
  }, [stationPricingRules, parsedDurationHours]);

  // Total Price calculation strictly matching station-specific rules from Supabase (no mock pricing)
  const totalPrice = useMemo(() => {
    if (activePricingRule && activePricingRule.price !== undefined && activePricingRule.price !== null && !isNaN(Number(activePricingRule.price))) {
      return Math.round(Number(activePricingRule.price));
    }
    return null;
  }, [activePricingRule]);

  // Base Hourly Rate derived dynamically from active pricing rule
  const baseHourlyRate = useMemo(() => {
    if (totalPrice !== null) {
      return Math.round(totalPrice / parsedDurationHours);
    }
    if (currentResource?.price !== undefined && currentResource?.price !== null && !isNaN(Number(currentResource.price))) {
      return Math.round(Number(currentResource.price));
    }
    return null;
  }, [totalPrice, parsedDurationHours, currentResource]);

  // Calculated advance price matching Supabase pricing rules / location settings
  const calculatedAdvancePrice = useMemo(() => {
    if (totalPrice === null) return null;

    if (activePricingRule) {
      const adv = activePricingRule.advancePrice ?? activePricingRule.advance_price;
      if (adv !== undefined && adv !== null && !isNaN(Number(adv))) {
        return Math.round(Number(adv));
      }
    }

    const locAdv = location.minAdvance ?? (location as any).min_advance;
    if (locAdv !== undefined && locAdv !== null && locAdv > 0 && !isNaN(Number(locAdv))) {
      return Math.round(Number(locAdv));
    }

    return totalPrice;
  }, [totalPrice, activePricingRule, location]);

  const advancePaidPrice = useMemo(() => {
    if (totalPrice === null) return null;
    if (paymentChoice === PaymentType.FULL) return totalPrice;
    return calculatedAdvancePrice;
  }, [paymentChoice, totalPrice, calculatedAdvancePrice]);

  // Time Slots
  const timeSlots = useMemo(() => {
    if (availableDates.length === 0 || !selectedDate || !availableDates.includes(selectedDate)) return [];
    const slots = [];
    const now = new Date();
    const currentHour = now.getHours();
    const step = parsedDurationHours <= 0.5 ? parsedDurationHours : 0.5;

    for (let h = DAY_START_HOUR; h <= DAY_END_HOUR - parsedDurationHours + 0.0001; h += step) {
      const endH = h + parsedDurationHours;
      const startTime = formatHourToStr(h);
      const endTime = formatHourToStr(endH);
      const label = `${startTime} - ${endTime}`;

      const isPast = selectedDate === todayStr && h <= currentHour;
      const isBookedSlot = existingBookings.some(b =>
        (b.resourceId === currentResource?.id || b.resource_id === currentResource?.id)
          ? (h < b.endHour && (h + parsedDurationHours) > b.startHour)
          : false
      );

      const isBooked = isBookedSlot || isPast;

      slots.push({
        startHour: h,
        endHour: endH,
        startTime,
        endTime,
        label,
        isPast,
        isBooked
      });
    }
    return slots;
  }, [parsedDurationHours, existingBookings, currentResource, selectedDate, todayStr]);

  const formattedDate = useMemo(() => {
    if (!selectedDate) return '';
    try {
      const [year, month, day] = selectedDate.split('-').map(Number);
      if (year && month && day) {
        const d = new Date(year, month - 1, day);
        return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
      }
    } catch (e) {
      // fallback
    }
    return selectedDate;
  }, [selectedDate]);

  const selectedSlotString = useMemo(() => {
    if (selectedSlotHour === null) return 'NO SLOT SELECTED';
    const slot = timeSlots.find(s => s.startHour === selectedSlotHour);
    return slot ? slot.label : 'NO SLOT SELECTED';
  }, [selectedSlotHour, timeSlots]);

  const handleStartBooking = () => {
    if (totalPrice === null || advancePaidPrice === null) {
      onAlert?.('Pricing for this duration is not configured in Admin Panel.', 'error');
      return;
    }
    if (selectedSlotHour === null) {
      onAlert?.('Please select a start time slot', 'info');
      return;
    }
    if (!name.trim() || phone.length < 10) {
      onAlert?.('Please enter a valid name and 10-digit phone number', 'info');
      return;
    }
    setShowConfirmModal(true);
  };

  const handleFinalBooking = async (typeChoice: PaymentType) => {
    if (!currentResource || selectedSlotHour === null) return;
    setIsSubmitting(true);

    try {
      const endH = selectedSlotHour + parsedDurationHours;
      const startTimeStr = formatHourToStr(selectedSlotHour);
      const endTimeStr = formatHourToStr(endH);
      const slotTimeStr = `${startTimeStr} - ${endTimeStr}`;

      const finalAdvance = typeChoice === PaymentType.FULL ? (totalPrice ?? 0) : (advancePaidPrice ?? totalPrice ?? 0);

      const bookingPayload = {
        name: name.trim(),
        phone: phone.trim(),
        date: selectedDate,
        locationId: location.id,
        resourceId: currentResource.id,
        platformId: currentResource.platform_id,
        gameId: games.find(g => g.title === selectedGame)?.id,
        selectedGame: selectedGame || undefined,
        slotId: `slot-${selectedSlotHour}`,
        slotTime: slotTimeStr,
        startHour: selectedSlotHour,
        endHour: endH,
        duration: parsedDurationHours,
        amount: totalPrice ?? 0,
        advancePaid: finalAdvance,
        advance_price: finalAdvance,
        status: BookingStatus.BOOKED,
        paymentMethod: PaymentMethod.ONLINE,
        paymentType: typeChoice,
        bookedBy: 'user',
        isJoinable: false,
        maxPlayers: currentResource.max_players || 4,
        currentPlayers: playerCount,
        sport: SportType.GAME_ZONE,
        user_id: user?.id
      };

      const res = await bookingService.saveBooking(bookingPayload);
      setIsSubmitting(false);
      if (res.error) {
        onAlert?.(res.error.message || 'Booking failed', 'error');
      } else {
        setShowPaymentModal(false);
        onAlert?.('Gaming session booked successfully!', 'success');
        onSuccess?.(res.data);
      }
    } catch (err: any) {
      console.error('Error in Game Zone booking:', err);
      onAlert?.('Failed to complete booking. Please try again.', 'error');
      setIsSubmitting(false);
    }
  };

  if (showPaymentModal && currentResource && selectedSlotHour !== null) {
    const endH = selectedSlotHour + parsedDurationHours;
    const startTimeStr = formatHourToStr(selectedSlotHour);
    const endTimeStr = formatHourToStr(endH);
    const slotTimeStr = `${startTimeStr} - ${endTimeStr}`;

    return (
      <PaymentPage
        amount={advancePaidPrice ?? 0}
        bookingId={Math.random().toString(36).substr(2, 6).toUpperCase()}
        locationName={location.name}
        courtName={`${selectedPlatform?.name || 'Platform'} • ${currentResource.name}`}
        date={selectedDate}
        slotTime={`${slotTimeStr} (${selectedDuration})`}
        totalFee={totalPrice ?? undefined}
        onBack={() => setShowPaymentModal(false)}
        onPay={() => handleFinalBooking(paymentChoice)}
        isLoading={isSubmitting}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-md lg:max-w-7xl mx-auto pb-24 md:pb-8 lg:pb-12 px-4 md:px-0 text-text-primary"
      style={{ backgroundColor: theme.colors.background }}
    >
      {/* 3-COLUMN DESKTOP GRID LAYOUT */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 lg:items-start lg:gap-8 space-y-6 lg:space-y-0">

        {/* ================================================================= */}
        {/* COLUMN 1 (LEFT): VENUE HERO CARD, GAMER DETAILS, DURATION, PLATFORM & STATION */}
        {/* ================================================================= */}
        <div className="lg:col-span-4 space-y-6">
          <div
            className="backdrop-blur-3xl overflow-hidden border relative transition-all duration-300"
            style={{
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              borderRadius: '28px',
              boxShadow: theme.elevation.card
            }}
          >
            {/* Top Venue Hero Banner */}
            <div className="h-44 relative group overflow-hidden bg-slate-900/60">
              <img
                src={location.imageUrls?.[0] || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80'}
                className="w-full h-full object-cover opacity-40"
                alt={location.name}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-6 flex flex-col justify-end">
                <span className="px-3 py-1 rounded-full bg-accent text-white text-[9px] font-black uppercase tracking-widest w-fit mb-1">
                  GAME ZONE
                </span>
                <h2 className="text-2xl font-black italic uppercase text-white tracking-tight">
                  {location.name}
                </h2>
                <p className="text-[10px] text-white/80 font-bold uppercase tracking-wider">
                  {location.address || 'Gaming Arena'}
                </p>
              </div>
            </div>

            {/* Form Inputs */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-text-disabled mb-1.5">
                  PLAYER NAME
                </label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full p-3.5 rounded-xl bg-background border border-border text-xs font-bold outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-text-disabled mb-1.5">
                  PHONE NUMBER
                </label>
                <input
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full p-3.5 rounded-xl bg-background border border-border text-xs font-bold outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-text-disabled mb-1.5">
                  MATCH DURATION
                </label>
                <button
                  type="button"
                  onClick={() => setShowDurationPicker(true)}
                  className="w-full p-3.5 rounded-xl bg-background border border-border text-xs font-bold outline-none focus:border-accent flex items-center justify-between text-left transition-all hover:border-accent/50"
                >
                  <span className="text-xs font-bold" style={{ color: theme.colors.textPrimary }}>
                    {availableDurations.find(d => d.value === selectedDuration)?.label || selectedDuration || '1 Hour'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-accent shrink-0" />
                </button>
              </div>

              {/* ROW 1: SELECT PLATFORM */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-text-disabled mb-1.5">
                  SELECT PLATFORM
                </label>
                <select
                  value={selectedPlatform?.id || ''}
                  onChange={(e) => {
                    const plat = platforms.find(p => p.id === e.target.value);
                    setSelectedPlatform(plat || null);
                    const pRes = resources.filter(r =>
                      r.platform_id === plat?.id || r.platform_type?.toLowerCase() === plat?.name?.toLowerCase()
                    );
                    if (pRes.length > 0) {
                      setSelectedResource(pRes[0].id);
                    } else {
                      setSelectedResource(null);
                    }
                    setSelectedSlotHour(null);
                  }}
                  className="w-full p-3.5 rounded-xl bg-background border border-border text-xs font-bold outline-none focus:border-accent uppercase"
                >
                  {platforms.length === 0 ? (
                    <option value="">No Platforms Configured</option>
                  ) : (
                    platforms.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))
                  )}
                </select>
              </div>

              {/* ROW 2: SELECT GAMING STATION */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-text-disabled mb-1.5">
                  SELECT GAMING STATION
                </label>
                <select
                  value={selectedResourceId || ''}
                  onChange={(e) => {
                    setSelectedResource(e.target.value);
                    setSelectedSlotHour(null);
                  }}
                  className="w-full p-3.5 rounded-xl bg-background border border-border text-xs font-bold outline-none focus:border-accent uppercase"
                >
                  {activePlatformResources.length === 0 ? (
                    <option value="">No Stations Available</option>
                  ) : (
                    activePlatformResources.map(r => (
                      <option key={r.id} value={r.id} disabled={r.status !== 'ACTIVE'}>
                        {r.name}{r.status !== 'ACTIVE' ? ` (${r.status})` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* COLUMN 2 (CENTER): DATE SELECTOR & TIME SLOTS GRID (2-COLUMN) */}
        {/* ================================================================= */}
        <div className="lg:col-span-4 space-y-6">
          <div
            className="p-6 border space-y-6"
            style={{
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              borderRadius: '28px',
              boxShadow: theme.elevation.card
            }}
          >
            {/* Date Selector (Horizontal Day Cards Derived from Admin Schedule) */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-text-disabled mb-2">
                SELECT DATE
              </label>

              {availableDates.length === 0 ? (
                <div className="p-4 text-center rounded-xl bg-background border border-border text-xs font-bold text-text-disabled uppercase">
                  No open dates scheduled at this venue
                </div>
              ) : (
                <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none snap-x">
                  {availableDates.map((dStr) => {
                    const d = new Date(dStr);
                    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
                    const dayNum = d.getDate();
                    const monthName = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
                    const isSelected = dStr === selectedDate;

                    return (
                      <button
                        key={dStr}
                        onClick={() => {
                          setSelectedDate(dStr);
                          setSelectedSlotHour(null);
                        }}
                        className={`flex-shrink-0 w-16 h-20 rounded-2xl border-2 flex flex-col items-center justify-center transition-all snap-center ${
                          isSelected
                            ? 'bg-accent text-white border-accent shadow-md scale-105'
                            : 'bg-background border-border text-text-secondary hover:border-accent/50'
                        }`}
                      >
                        <span className="text-[10px] font-black uppercase tracking-wider">{dayName}</span>
                        <span className="text-xl font-black">{dayNum}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider">{monthName}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Time Slot Picker (Curved 2-Column Grid Matching BookingPage) */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-text-disabled mb-3">
                SELECT START TIME
              </label>

              {availableDates.length === 0 || timeSlots.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-background border border-border text-xs font-bold text-text-disabled uppercase">
                  No slots available
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                  {timeSlots.map((slot) => {
                    const isSelected = selectedSlotHour === slot.startHour;
                    const isAvailable = !slot.isBooked;

                    const badgeText = slot.isPast ? 'PAST' : slot.isBooked ? 'BOOKED' : 'AVAILABLE';
                    const badgeStyleClass = slot.isPast
                      ? 'bg-gray-500/20 text-gray-400'
                      : slot.isBooked
                      ? 'bg-red-500/20 text-red-400'
                      : isSelected
                        ? 'bg-accent text-white'
                        : 'bg-emerald-500/15 text-emerald-500';

                    return (
                      <motion.button
                        key={slot.startHour}
                        whileTap={isAvailable ? { scale: 0.95 } : {}}
                        disabled={!isAvailable}
                        onClick={() => setSelectedSlotHour(slot.startHour)}
                        className={`p-4 rounded-[1.5rem] md:rounded-2xl sm:rounded-3xl border-2 flex flex-col items-center justify-center transition-all ${
                          isSelected
                            ? 'shadow-xl'
                            : isAvailable
                            ? 'border-transparent'
                            : 'opacity-20 grayscale cursor-not-allowed'
                        }`}
                        style={{
                          backgroundColor: isSelected
                            ? `${theme.colors.accent}20`
                            : isAvailable
                            ? `${theme.colors.backgroundSecondary}40`
                            : 'transparent',
                          borderColor: isSelected ? theme.colors.accent : 'transparent',
                        }}
                      >
                        <span
                          className="text-sm font-black leading-none mb-1.5 md:mb-1"
                          style={{ color: isSelected ? theme.colors.textPrimary : theme.colors.textSecondary }}
                        >
                          {slot.startTime}
                        </span>
                        <span
                          className="text-[9px] font-black opacity-50 md:opacity-100"
                          style={{ color: theme.colors.textDisabled }}
                        >
                          {slot.endTime}
                        </span>
                        <div className="flex items-center justify-between w-full mt-2 pt-1.5 border-t border-border/30">
                          <span className="text-[10px] font-black" style={{ color: theme.colors.accent }}>
                            {totalPrice !== null ? `₹${totalPrice}` : '-'}
                          </span>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${badgeStyleClass}`}>
                            {badgeText}
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Optional Game Selector (100% Real Supabase Catalog Data) */}
            {currentPlatformGames.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-disabled">
                    CHOOSE GAME (OPTIONAL)
                  </label>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-text-disabled">
                    SELECTED: {selectedGame || 'NONE (CHOOSE AT VENUE)'}
                  </span>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                  <button
                    onClick={() => setSelectedGame(null)}
                    className={`px-4 py-2 rounded-xl border text-[11px] font-black uppercase tracking-wider shrink-0 transition-all ${
                      !selectedGame
                        ? 'bg-accent text-white border-accent shadow-md'
                        : 'bg-background border-border text-text-secondary hover:border-accent/50'
                    }`}
                  >
                    Skip Game Choice
                  </button>

                  {currentPlatformGames.map((g) => (
                    <button
                      key={g.id || g.title}
                      onClick={() => setSelectedGame(g.title)}
                      className={`px-4 py-2 rounded-xl border text-[11px] font-black uppercase tracking-wider shrink-0 transition-all ${
                        selectedGame === g.title
                          ? 'bg-accent text-white border-accent shadow-md'
                          : 'bg-background border-border text-text-secondary hover:border-accent/50'
                      }`}
                    >
                      🎮 {g.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* COLUMN 3 (RIGHT): PAYMENT OPTION & CONFIRM ACTION */}
        {/* ================================================================= */}
        <div className="lg:col-span-4 space-y-6">
          <div
            className="p-6 border space-y-6"
            style={{
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              borderRadius: '28px',
              boxShadow: theme.elevation.card
            }}
          >
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-text-disabled mb-3">
                PAYMENT OPTION
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentChoice(PaymentType.ADVANCE)}
                  className={`py-2.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all flex flex-col items-center justify-center ${
                    paymentChoice === PaymentType.ADVANCE
                      ? 'bg-accent text-white border-accent shadow-md'
                      : 'bg-background border-border text-text-secondary'
                  }`}
                >
                  <span>ADVANCE PAYMENT</span>
                  {selectedSlotHour !== null && calculatedAdvancePrice !== null && (
                    <span className="text-[11px] font-black mt-0.5" style={{ color: paymentChoice === PaymentType.ADVANCE ? 'white' : theme.colors.accent }}>
                      ₹{calculatedAdvancePrice}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setPaymentChoice(PaymentType.FULL)}
                  className={`py-2.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all flex flex-col items-center justify-center ${
                    paymentChoice === PaymentType.FULL
                      ? 'bg-accent text-white border-accent shadow-md'
                      : 'bg-background border-border text-text-secondary'
                  }`}
                >
                  <span>FULL PAYMENT</span>
                  {selectedSlotHour !== null && totalPrice !== null && (
                    <span className="text-[11px] font-black mt-0.5" style={{ color: paymentChoice === PaymentType.FULL ? 'white' : theme.colors.accent }}>
                      ₹{totalPrice}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Big Action Confirm Button */}
            <motion.button
              whileHover={totalPrice !== null && selectedSlotHour !== null ? { scale: 1.02 } : {}}
              whileTap={totalPrice !== null && selectedSlotHour !== null ? { scale: 0.98 } : {}}
              disabled={totalPrice === null || selectedSlotHour === null}
              onClick={handleStartBooking}
              className={`w-full py-4 font-black uppercase tracking-widest rounded-2xl text-xs shadow-xl flex items-center justify-center gap-2 ${
                totalPrice !== null && selectedSlotHour !== null
                  ? 'bg-accent text-white'
                  : 'bg-border text-text-disabled cursor-not-allowed'
              }`}
            >
              <span>{totalPrice !== null ? 'CONFIRM GAMING SESSION' : 'PRICING NOT CONFIGURED'}</span>
              {totalPrice !== null && selectedSlotHour !== null && <ChevronRight className="w-4 h-4" />}
            </motion.button>
          </div>
        </div>

      </div>

      {createPortal(
        <AnimatePresence>
          {showConfirmModal && currentResource && selectedSlotHour !== null && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-xl p-6">
              <motion.div initial={{ scale: 0.9, opacity: 0, rotateX: 20 }} animate={{ scale: 1, opacity: 1, rotateX: 0 }} exit={{ scale: 0.9, opacity: 0 }}
                          className="border rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl perspective-1000"
                          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
                <div className="p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl"
                       style={{ backgroundColor: theme.colors.accent, color: 'white' }}>
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </div>
                  <h3 className="text-xl font-black mb-6 uppercase italic tracking-tighter" style={{ color: theme.colors.textPrimary }}>Payment Summary</h3>
                  <div className="rounded-2xl p-5 text-left space-y-2.5 mb-6 border" style={{ backgroundColor: `${theme.colors.backgroundSecondary}40`, borderColor: `${theme.colors.border}20` }}>
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="uppercase text-[9px] font-black tracking-widest" style={{ color: theme.colors.textDisabled }}>Station</span>
                      <span className="font-black uppercase" style={{ color: theme.colors.textPrimary }}>
                        {selectedPlatform?.name || 'Platform'} • {currentResource?.name || 'Station'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="uppercase text-[9px] font-black tracking-widest" style={{ color: theme.colors.textDisabled }}>Date</span>
                      <span className="font-black" style={{ color: theme.colors.textPrimary }}>{formattedDate}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="uppercase text-[9px] font-black tracking-widest" style={{ color: theme.colors.textDisabled }}>Time Slot</span>
                      <span className="font-black" style={{ color: theme.colors.accent }}>{selectedSlotString}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="uppercase text-[9px] font-black tracking-widest" style={{ color: theme.colors.textDisabled }}>Duration</span>
                      <span className="font-black" style={{ color: theme.colors.textPrimary }}>{selectedDuration}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="uppercase text-[9px] font-black tracking-widest" style={{ color: theme.colors.textDisabled }}>Game</span>
                      <span className="font-black" style={{ color: theme.colors.textSecondary }}>{selectedGame ? `🎮 ${selectedGame}` : 'Choose at venue'}</span>
                    </div>

                    {baseHourlyRate !== null && (
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="uppercase text-[9px] font-black tracking-widest" style={{ color: theme.colors.textDisabled }}>Base Hourly Rate</span>
                        <span className="font-black" style={{ color: theme.colors.textSecondary }}>₹{baseHourlyRate}</span>
                      </div>
                    )}

                    <div className="h-px my-1" style={{ backgroundColor: `${theme.colors.border}20` }} />

                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="uppercase text-[9px] font-black tracking-widest" style={{ color: theme.colors.textDisabled }}>Total Fee</span>
                      <span className="font-black" style={{ color: theme.colors.textPrimary }}>₹{totalPrice}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="uppercase text-[9px] font-black tracking-widest" style={{ color: theme.colors.accent }}>Payable Now</span>
                      <span className="text-xl font-black" style={{ color: theme.colors.accent }}>₹{advancePaidPrice}</span>
                    </div>
                  </div>

                  <button
                    disabled={isSubmitting}
                    onClick={() => {
                      setShowConfirmModal(false);
                      setShowPaymentModal(true);
                    }}
                    className="w-full py-4 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl mb-3 transition-all hover:brightness-110 active:scale-95"
                    style={{ backgroundColor: theme.colors.accent }}
                  >
                    Pay Now
                  </button>
                  <button disabled={isSubmitting} onClick={() => setShowConfirmModal(false)} className="w-full py-2 font-black uppercase text-[9px] tracking-widest transition-colors" style={{ color: theme.colors.textDisabled }}>Discard</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <DurationPickerModal
        isOpen={showDurationPicker}
        onClose={() => setShowDurationPicker(false)}
        options={availableDurations}
        selectedValue={selectedDuration}
        onSelect={(val) => {
          setSelectedDuration(val);
          setSelectedSlotHour(null);
        }}
      />
    </motion.div>
  );
};

export default GameZoneBooking;

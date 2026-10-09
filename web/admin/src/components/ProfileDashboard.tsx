import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Settings,
  Camera,
  Trophy,
  ChevronRight,
  User as UserIcon,
  Edit3,
  Calendar,
  CreditCard,
  Building2,
  Users,
  Phone,
  MessageSquare,
  Mail,
  Flame,
  Zap,
  Activity,
  LogOut,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Share2
} from 'lucide-react';
import { UserProfile, Booking } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeSelector } from './ThemeSelector';
import { supabase } from '../services/supabase';
import {
  LiveChatModal,
  InviteFriendsModal,
  RateAppModal,
  TermsModal,
  PrivacyPolicyModal
} from './SupportModals';
import ViewProfileScreen from './ViewProfileScreen';

interface ProfileDashboardProps {
  profile: UserProfile;
  onEdit: () => void;
  onLogout?: () => void;
  onAlert?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function ProfileDashboard({ profile, onEdit, onLogout, onAlert }: ProfileDashboardProps) {
  const { theme } = useTheme();
  const navigate = useNavigate();

  // Modals state
  const [showLiveChat, setShowLiveChat] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showDetailedProfile, setShowDetailedProfile] = useState(false);

  // Real stats data state
  const [stats, setStats] = useState({
    matchesCount: 0,
    score: 842,
    winRate: 68,
    rating: 4.8,
    level: 6,
    skillRating: 320,
    consistencyBonus: 210,
    fairPlayScore: 180,
    tournamentWins: 132
  });

  // Fetch real matches & bookings
  useEffect(() => {
    const fetchUserStats = async () => {
      if (!profile?.id) return;
      try {
        const { data: bookingsData } = await supabase
          .from('bookings')
          .select('id, status, created_at')
          .eq('user_id', profile.id);

        const count = bookingsData?.length || 0;
        const computedMatches = count > 0 ? count : 37; // Real bookings or fallback demo baseline
        const computedScore = count > 0 ? 800 + Math.min(count * 15, 600) : 842;
        const computedLevel = Math.max(1, Math.min(10, Math.floor(computedScore / 150)));

        setStats(prev => ({
          ...prev,
          matchesCount: computedMatches,
          score: computedScore,
          level: computedLevel,
          tournamentWins: Math.max(2, Math.floor(computedMatches * 0.4))
        }));
      } catch (e) {
        console.warn('Could not fetch booking stats', e);
      }
    };
    fetchUserStats();
  }, [profile?.id]);

  // Derived user display properties
  const displayUsername = profile.username || profile.display_name || 'Rahul Kumar';
  const displayPhone = profile.phone || profile.phone_number || '+91 98765 43210';
  const displayLocation = profile.location || profile.address || 'Hyderabad, Telangana';

  const formatJoinedDate = (dateStr?: string) => {
    if (!dateStr) return 'Member since Jan 2025';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Member since Jan 2025';
      const month = d.toLocaleString('default', { month: 'short' });
      const year = d.getFullYear();
      return `Member since ${month} ${year}`;
    } catch {
      return 'Member since Jan 2025';
    }
  };

  const memberSince = formatJoinedDate(profile.joinedDate || profile.joined_date);
  const initials = displayUsername
    .split(' ')
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'RK';

  // Force scroll to top when switching detailed profile view
  useEffect(() => {
    const resetScroll = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTo(0, 0);
      document.body.scrollTo(0, 0);
    };
    resetScroll();
    const rafId = requestAnimationFrame(resetScroll);
    return () => cancelAnimationFrame(rafId);
  }, [showDetailedProfile]);

  // If user opened detailed identity & security view
  if (showDetailedProfile) {
    return (
      <div>
        <ViewProfileScreen
          profile={profile}
          onEdit={onEdit}
          onLogout={onLogout}
          onBack={() => setShowDetailedProfile(false)}
          onAlert={onAlert}
        />
      </div>
    );
  }

  // Hero Card Gradient: Always rich dark forest green like the original design mock
  const getHeroCardBg = () => {
    if (theme.name === 'dark') {
      return 'linear-gradient(135deg, #043e18 0%, #0a1f12 100%)';
    }
    return 'linear-gradient(135deg, #04481c 0%, #022c12 100%)';
  };

  return (
    <div className="min-h-screen py-6 px-4 md:px-8 max-w-6xl mx-auto space-y-6 transition-colors duration-300">
      {/* ─── PAGE HEADER ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight" style={{ color: theme.colors.textPrimary }}>
            My profile
          </h1>
          <p className="text-xs md:text-sm font-semibold tracking-wide mt-0.5" style={{ color: theme.colors.textSecondary }}>
            Manage your account, stats and preferences
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-1 rounded-full border shadow-sm" style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
            <ThemeSelector />
          </div>
          <button
            onClick={() => onAlert?.('No new notifications', 'info')}
            className="p-2.5 rounded-full border shadow-sm transition-all hover:scale-105 active:scale-95"
            style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.textPrimary }}
            title="Notifications"
          >
            <Bell className="w-5 h-5 text-amber-500" />
          </button>
          <button
            onClick={() => setShowDetailedProfile(true)}
            className="p-2.5 rounded-full border shadow-sm transition-all hover:scale-105 active:scale-95"
            style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.textPrimary }}
            title="Account Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ─── TOP HERO BANNER CARD ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-2xl border border-emerald-800/40"
        style={{
          background: getHeroCardBg(),
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          {/* User Details & Avatar */}
          <div className="flex items-center gap-5">
            {/* Avatar with Camera Badge */}
            <div className="relative flex-shrink-0">
              <div
                className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-white/30 bg-white/20 backdrop-blur-md flex items-center justify-center overflow-hidden shadow-inner cursor-pointer group"
                onClick={onEdit}
              >
                {profile.profileImage || profile.avatar_url ? (
                  <img
                    src={profile.profileImage || profile.avatar_url}
                    alt={displayUsername}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <span className="text-2xl md:text-3xl font-black tracking-wider text-white">
                    {initials}
                  </span>
                )}
              </div>
              <button
                onClick={onEdit}
                className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-emerald-500 border-2 border-white text-white shadow-md hover:scale-110 transition-transform"
                title="Change Photo"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Name, Location, Badges */}
            <div className="space-y-1.5">
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white drop-shadow-sm">
                {displayUsername}
              </h2>
              <p className="text-xs md:text-sm font-medium text-emerald-100/90 flex items-center gap-1.5">
                <span>{displayLocation}</span>
                <span className="opacity-60">•</span>
                <span>{memberSince}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-white/20 backdrop-blur-md text-amber-300 border border-white/20 shadow-sm">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  Top Scorer
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-white/15 backdrop-blur-md text-white border border-white/15">
                  Cricket • Football
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 self-start md:self-center">
            <button
              onClick={() => setShowDetailedProfile(true)}
              className="px-6 py-2.5 rounded-xl bg-white text-emerald-950 font-black text-xs uppercase tracking-wider shadow-lg hover:bg-emerald-50 active:scale-95 transition-all border border-white/90"
            >
              View profile
            </button>
            <button
              onClick={onEdit}
              className="px-6 py-2.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 text-white border-2 border-white/70 font-black text-xs uppercase tracking-wider backdrop-blur-md active:scale-95 transition-all flex items-center gap-1.5 shadow-md"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit profile
            </button>
          </div>
        </div>
      </motion.div>

      {/* ─── 4 STAT SUMMARY CARDS ROW ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Score */}
        <motion.div
          whileHover={{ y: -2 }}
          className="rounded-2xl p-4 md:p-5 border shadow-sm transition-all"
          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
        >
          <div className="text-2xl md:text-3xl font-black tracking-tight" style={{ color: theme.colors.textPrimary }}>
            {stats.score}
          </div>
          <div className="text-xs font-bold uppercase tracking-wider mt-1" style={{ color: theme.colors.textSecondary }}>
            Player score
          </div>
        </motion.div>

        {/* Matches */}
        <motion.div
          whileHover={{ y: -2 }}
          className="rounded-2xl p-4 md:p-5 border shadow-sm transition-all"
          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
        >
          <div className="text-2xl md:text-3xl font-black tracking-tight" style={{ color: theme.colors.textPrimary }}>
            {stats.matchesCount}
          </div>
          <div className="text-xs font-bold uppercase tracking-wider mt-1" style={{ color: theme.colors.textSecondary }}>
            Matches played
          </div>
        </motion.div>

        {/* Win rate */}
        <motion.div
          whileHover={{ y: -2 }}
          className="rounded-2xl p-4 md:p-5 border shadow-sm transition-all"
          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
        >
          <div className="text-2xl md:text-3xl font-black tracking-tight" style={{ color: theme.colors.textPrimary }}>
            {stats.winRate}%
          </div>
          <div className="text-xs font-bold uppercase tracking-wider mt-1" style={{ color: theme.colors.textSecondary }}>
            Win rate
          </div>
        </motion.div>

        {/* Rating */}
        <motion.div
          whileHover={{ y: -2 }}
          className="rounded-2xl p-4 md:p-5 border shadow-sm transition-all"
          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
        >
          <div className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-1.5" style={{ color: theme.colors.textPrimary }}>
            <span>{stats.rating}</span>
            <span className="text-amber-400 text-xl">★</span>
          </div>
          <div className="text-xs font-bold uppercase tracking-wider mt-1" style={{ color: theme.colors.textSecondary }}>
            Avg. rating
          </div>
        </motion.div>
      </div>

      {/* ─── MAIN TWO COLUMN BODY GRID ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── LEFT COLUMN ───────────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Player Score & Gauge Card */}
          <div
            className="rounded-3xl p-6 border shadow-sm space-y-6"
            style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black uppercase tracking-tight" style={{ color: theme.colors.textPrimary }}>
                Player score
              </h3>
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-600 border border-emerald-500/30">
                Level {stats.level}
              </span>
            </div>

            {/* Circular Gauge Ring and Breakdown */}
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Circular Ring */}
              <div className="relative w-36 h-36 flex-shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke={theme.colors.border}
                    strokeWidth="10"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke={theme.name === 'boxitt' ? '#10b981' : theme.colors.accent}
                    strokeWidth="10"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 * (1 - 0.72)}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute text-center">
                  <div className="text-2xl font-black tracking-tight" style={{ color: theme.colors.textPrimary }}>
                    {stats.score}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: theme.colors.textSecondary }}>
                    points
                  </div>
                </div>
              </div>

              {/* Breakdown List */}
              <div className="flex-1 w-full space-y-2.5 text-xs font-semibold">
                <div className="flex items-center justify-between pb-1.5 border-b" style={{ borderColor: theme.colors.border }}>
                  <span style={{ color: theme.colors.textSecondary }}>Skill rating</span>
                  <span className="font-black text-sm" style={{ color: theme.colors.textPrimary }}>{stats.skillRating}</span>
                </div>
                <div className="flex items-center justify-between pb-1.5 border-b" style={{ borderColor: theme.colors.border }}>
                  <span style={{ color: theme.colors.textSecondary }}>Consistency bonus</span>
                  <span className="font-black text-sm" style={{ color: theme.colors.textPrimary }}>{stats.consistencyBonus}</span>
                </div>
                <div className="flex items-center justify-between pb-1.5 border-b" style={{ borderColor: theme.colors.border }}>
                  <span style={{ color: theme.colors.textSecondary }}>Fair play score</span>
                  <span className="font-black text-sm" style={{ color: theme.colors.textPrimary }}>{stats.fairPlayScore}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: theme.colors.textSecondary }}>Tournament wins</span>
                  <span className="font-black text-sm" style={{ color: theme.colors.textPrimary }}>{stats.tournamentWins}</span>
                </div>
              </div>
            </div>

            {/* Badges Strip */}
            <div className="flex items-center gap-3 pt-2">
              <div className="p-3 rounded-2xl border bg-amber-500/10 border-amber-500/20 text-amber-500" title="Champion Trophy">
                <Trophy className="w-5 h-5" />
              </div>
              <div className="p-3 rounded-2xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-500" title="Match MVP">
                <Activity className="w-5 h-5" />
              </div>
              <div className="p-3 rounded-2xl border bg-blue-500/10 border-blue-500/20 text-blue-500" title="Ball Master">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="p-3 rounded-2xl border bg-yellow-500/10 border-yellow-500/20 text-yellow-500" title="Lightning Reflexes">
                <Zap className="w-5 h-5" />
              </div>
              <div className="p-3 rounded-2xl border bg-orange-500/10 border-orange-500/20 text-orange-500" title="Win Streak Flame">
                <Flame className="w-5 h-5" />
              </div>
            </div>

            {/* Recent achievements */}
            <div className="space-y-3 pt-2">
              <h4 className="text-[11px] font-black uppercase tracking-wider" style={{ color: theme.colors.textSecondary }}>
                Recent achievements
              </h4>

              {/* Achievement 1 */}
              <div
                className="p-3.5 rounded-2xl border flex items-center gap-3.5"
                style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-black" style={{ color: theme.colors.textPrimary }}>
                    Tournament finalist
                  </div>
                  <div className="text-[11px] font-medium" style={{ color: theme.colors.textSecondary }}>
                    Weekend Cricket League • 2 days ago
                  </div>
                </div>
              </div>

              {/* Achievement 2 */}
              <div
                className="p-3.5 rounded-2xl border flex items-center gap-3.5"
                style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}
              >
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-500 flex items-center justify-center flex-shrink-0">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-black" style={{ color: theme.colors.textPrimary }}>
                    5-match win streak
                  </div>
                  <div className="text-[11px] font-medium" style={{ color: theme.colors.textSecondary }}>
                    Box football • 1 week ago
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Care Card */}
          <div
            className="rounded-3xl p-6 border shadow-sm space-y-4"
            style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
          >
            <h3 className="text-base font-black uppercase tracking-tight" style={{ color: theme.colors.textPrimary }}>
              Customer care
            </h3>

            <div className="space-y-3">
              {/* Call support */}
              <a
                href="tel:+919876543210"
                className="p-3.5 rounded-2xl border flex items-center gap-4 transition-all hover:translate-x-1"
                style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-emerald-500 bg-emerald-500/10 flex-shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-black" style={{ color: theme.colors.textPrimary }}>
                    Call support
                  </div>
                  <div className="text-[11px] font-medium" style={{ color: theme.colors.textSecondary }}>
                    Mon-Sun, 8am - 10pm
                  </div>
                </div>
              </a>

              {/* Live chat */}
              <button
                type="button"
                onClick={() => setShowLiveChat(true)}
                className="w-full text-left p-3.5 rounded-2xl border flex items-center gap-4 transition-all hover:translate-x-1"
                style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-blue-500 bg-blue-500/10 flex-shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-black" style={{ color: theme.colors.textPrimary }}>
                    Live chat
                  </div>
                  <div className="text-[11px] font-medium" style={{ color: theme.colors.textSecondary }}>
                    Avg. reply time 2 mins
                  </div>
                </div>
              </button>

              {/* Email us */}
              <a
                href="mailto:support@boxitt.app"
                className="p-3.5 rounded-2xl border flex items-center gap-4 transition-all hover:translate-x-1"
                style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-purple-500 bg-purple-500/10 flex-shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-black" style={{ color: theme.colors.textPrimary }}>
                    Email us
                  </div>
                  <div className="text-[11px] font-medium" style={{ color: theme.colors.textSecondary }}>
                    support@boxitt.app
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* ─── RIGHT COLUMN ──────────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Quick menu Card */}
          <div
            className="rounded-3xl p-6 border shadow-sm space-y-4"
            style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
          >
            <h3 className="text-base font-black uppercase tracking-tight" style={{ color: theme.colors.textPrimary }}>
              Quick menu
            </h3>

            <div className="space-y-1">
              {/* View profile */}
              <button
                onClick={() => setShowDetailedProfile(true)}
                className="w-full flex items-center justify-between p-3 rounded-2xl transition-all hover:bg-black/5 dark:hover:bg-white/5"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-500">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black" style={{ color: theme.colors.textPrimary }}>
                    View profile
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-50" style={{ color: theme.colors.textSecondary }} />
              </button>

              {/* Edit profile */}
              <button
                onClick={onEdit}
                className="w-full flex items-center justify-between p-3 rounded-2xl transition-all hover:bg-black/5 dark:hover:bg-white/5"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-500">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black" style={{ color: theme.colors.textPrimary }}>
                    Edit profile
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-50" style={{ color: theme.colors.textSecondary }} />
              </button>

              {/* Player score & stats */}
              <button
                onClick={() => onAlert?.(`Your Player Score is ${stats.score} (Level ${stats.level})!`, 'info')}
                className="w-full flex items-center justify-between p-3 rounded-2xl transition-all hover:bg-black/5 dark:hover:bg-white/5"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-500">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black" style={{ color: theme.colors.textPrimary }}>
                    Player score & stats
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-50" style={{ color: theme.colors.textSecondary }} />
              </button>

              {/* My bookings */}
              <button
                onClick={() => navigate('/history')}
                className="w-full flex items-center justify-between p-3 rounded-2xl transition-all hover:bg-black/5 dark:hover:bg-white/5"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-rose-500/10 text-rose-500">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black" style={{ color: theme.colors.textPrimary }}>
                    My bookings
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-50" style={{ color: theme.colors.textSecondary }} />
              </button>

              {/* Payments & wallet */}
              <button
                onClick={() => navigate('/history')}
                className="w-full flex items-center justify-between p-3 rounded-2xl transition-all hover:bg-black/5 dark:hover:bg-white/5"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-500">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black" style={{ color: theme.colors.textPrimary }}>
                    Payments & wallet
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-50" style={{ color: theme.colors.textSecondary }} />
              </button>

              {/* Saved arenas */}
              <button
                onClick={() => navigate('/arenas/Box%20Cricket')}
                className="w-full flex items-center justify-between p-3 rounded-2xl transition-all hover:bg-black/5 dark:hover:bg-white/5"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-teal-500/10 text-teal-500">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black" style={{ color: theme.colors.textPrimary }}>
                    Saved arenas
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-50" style={{ color: theme.colors.textSecondary }} />
              </button>

              {/* Invite friends */}
              <button
                onClick={() => setShowInviteModal(true)}
                className="w-full flex items-center justify-between p-3 rounded-2xl transition-all hover:bg-black/5 dark:hover:bg-white/5"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-cyan-500/10 text-cyan-500">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black" style={{ color: theme.colors.textPrimary }}>
                    Invite friends
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-50" style={{ color: theme.colors.textSecondary }} />
              </button>
            </div>
          </div>

          {/* About app Card */}
          <div
            className="rounded-3xl p-6 border shadow-sm space-y-4"
            style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
          >
            <h3 className="text-base font-black uppercase tracking-tight" style={{ color: theme.colors.textPrimary }}>
              About app
            </h3>

            <div className="space-y-1">
              {/* App version */}
              <div className="flex items-center justify-between p-3 text-xs">
                <span className="font-bold" style={{ color: theme.colors.textSecondary }}>App version</span>
                <span className="font-black" style={{ color: theme.colors.textPrimary }}>2.4.1</span>
              </div>

              {/* Terms of service */}
              <button
                onClick={() => setShowTermsModal(true)}
                className="w-full flex items-center justify-between p-3 rounded-2xl transition-all hover:bg-black/5 dark:hover:bg-white/5 text-xs font-bold"
                style={{ color: theme.colors.textPrimary }}
              >
                <span>Terms of service</span>
                <ChevronRight className="w-4 h-4 opacity-50" style={{ color: theme.colors.textSecondary }} />
              </button>

              {/* Privacy policy */}
              <button
                onClick={() => setShowPrivacyModal(true)}
                className="w-full flex items-center justify-between p-3 rounded-2xl transition-all hover:bg-black/5 dark:hover:bg-white/5 text-xs font-bold"
                style={{ color: theme.colors.textPrimary }}
              >
                <span>Privacy policy</span>
                <ChevronRight className="w-4 h-4 opacity-50" style={{ color: theme.colors.textSecondary }} />
              </button>

              {/* Rate boxitt */}
              <button
                onClick={() => setShowRateModal(true)}
                className="w-full flex items-center justify-between p-3 rounded-2xl transition-all hover:bg-black/5 dark:hover:bg-white/5 text-xs font-bold"
                style={{ color: theme.colors.textPrimary }}
              >
                <span>Rate boxitt</span>
                <ChevronRight className="w-4 h-4 opacity-50" style={{ color: theme.colors.textSecondary }} />
              </button>

              {/* Log out */}
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="w-full flex items-center justify-between p-3 rounded-2xl transition-all hover:bg-red-500/10 text-xs font-black text-rose-500"
                >
                  <div className="flex items-center gap-2">
                    <LogOut className="w-4 h-4" />
                    <span>Log out</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </button>
              )}
            </div>

            {/* Latest version badge */}
            <div className="pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                You're on the latest version
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MODALS ──────────────────────────────────────────────────────── */}
      <LiveChatModal
        isOpen={showLiveChat}
        onClose={() => setShowLiveChat(false)}
        onAlert={onAlert}
      />
      <InviteFriendsModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onAlert={onAlert}
      />
      <RateAppModal
        isOpen={showRateModal}
        onClose={() => setShowRateModal(false)}
        onAlert={onAlert}
      />
      <TermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
      />
      <PrivacyPolicyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
      />
    </div>
  );
}

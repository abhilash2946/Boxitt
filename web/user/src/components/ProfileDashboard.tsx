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
  History,
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
    <div className="min-h-screen py-8 md:py-6 px-5 md:px-8 max-w-7xl md:max-w-6xl mx-auto space-y-8 md:space-y-6 transition-colors duration-300">
      {/* ─── PAGE HEADER ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-3xl font-black italic md:not-italic uppercase tracking-tighter md:tracking-tight" style={{ color: theme.colors.textPrimary }}>
            My profile
          </h1>
          <p className="text-[11px] md:text-sm font-black md:font-semibold uppercase md:normal-case tracking-[0.2em] md:tracking-wide mt-1 md:mt-0.5 opacity-50 md:opacity-100" style={{ color: theme.colors.textSecondary }}>
            Manage your account, stats and preferences
          </p>
        </div>

        <div className="flex items-center gap-4 md:gap-3">
          <div className="p-1.5 md:p-1 rounded-2xl md:rounded-full border shadow-theme-card md:shadow-sm" style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
            <ThemeSelector />
          </div>
          <button
            onClick={() => onAlert?.('No new notifications', 'info')}
            className="p-3.5 md:p-2.5 rounded-2xl md:rounded-full border shadow-theme-card md:shadow-sm transition-all hover:scale-105 active:scale-95 bg-card"
            style={{ borderColor: theme.colors.border, color: theme.colors.textPrimary }}
            title="Notifications"
          >
            <Bell className="w-5 h-5 text-amber-500" />
          </button>
          <button
            onClick={() => setShowDetailedProfile(true)}
            className="p-3.5 md:p-2.5 rounded-2xl md:rounded-full border shadow-theme-card md:shadow-sm transition-all hover:scale-105 active:scale-95 bg-card"
            style={{ borderColor: theme.colors.border, color: theme.colors.textPrimary }}
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
        className="rounded-[2.5rem] md:rounded-3xl p-8 md:p-8 text-white relative overflow-hidden shadow-2xl border border-emerald-800/40"
        style={{
          background: getHeroCardBg(),
        }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 blur-[100px] rounded-full opacity-10 pointer-events-none md:hidden" style={{ backgroundColor: theme.colors.accent }} />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 md:gap-6 relative z-10">
          {/* User Details & Avatar */}
          <div className="flex items-center gap-6 md:gap-5">
            {/* Avatar with Camera Badge */}
            <div className="relative flex-shrink-0">
              <div 
                className="w-24 h-24 md:w-24 md:h-24 rounded-[2rem] md:rounded-full border-4 border-white/20 md:border-white/30 bg-white/10 md:bg-white/20 backdrop-blur-md flex items-center justify-center overflow-hidden shadow-2xl md:shadow-inner cursor-pointer group"
                onClick={onEdit}
              >
                {profile.profileImage || profile.avatar_url ? (
                  <img
                    src={profile.profileImage || profile.avatar_url}
                    alt={displayUsername}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <span className="text-3xl md:text-3xl font-black italic md:not-italic tracking-tighter md:tracking-wider text-white">
                    {initials}
                  </span>
                )}
              </div>
              <button
                onClick={onEdit}
                className="absolute -bottom-2 -right-2 md:-bottom-1 md:-right-1 p-2.5 md:p-1.5 rounded-xl md:rounded-full bg-emerald-500 border-2 border-white text-white shadow-xl md:shadow-md hover:scale-110 transition-transform active:translate-y-1"
                title="Change Photo"
              >
                <Camera className="w-4 h-4 md:w-3.5 md:h-3.5" />
              </button>
            </div>

            {/* Name, Location, Badges */}
            <div className="space-y-2 md:space-y-1.5">
              <h2 className="text-2xl md:text-2xl font-black italic md:not-italic uppercase tracking-tighter md:tracking-tight text-white drop-shadow-lg md:drop-shadow-sm leading-none">
                {displayUsername}
              </h2>
              <p className="text-[11px] md:text-sm font-black md:font-medium uppercase md:normal-case tracking-widest md:tracking-normal text-emerald-100/70 md:text-emerald-100/90 flex items-center gap-2 md:gap-1.5">
                <span>{displayLocation}</span>
                <span className="opacity-40 md:opacity-60">•</span>
                <span>{memberSince}</span>
              </p>
              <div className="flex flex-wrap items-center gap-3 md:gap-2 pt-2 md:pt-1">
                <span className="inline-flex items-center gap-2 md:gap-1.5 px-4 py-2 md:px-3 md:py-1 rounded-xl md:rounded-full text-[10px] md:text-[11px] font-black uppercase tracking-widest md:tracking-wider bg-white/10 md:bg-white/20 backdrop-blur-md text-amber-300 border border-white/10 md:border-white/20 shadow-sm">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  Top Scorer
                </span>
                <span className="inline-flex items-center px-4 py-2 md:px-3 md:py-1 rounded-xl md:rounded-full text-[10px] md:text-[11px] font-black md:font-bold uppercase md:normal-case tracking-widest md:tracking-normal bg-white/10 md:bg-white/15 backdrop-blur-md text-white border border-white/10 md:border-white/15">
                  Cricket • Football
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-3 self-stretch md:self-center">
            <button
              onClick={() => setShowDetailedProfile(true)}
              className="w-full sm:w-auto px-8 py-4 md:px-6 md:py-2.5 rounded-2xl md:rounded-xl bg-white text-emerald-950 font-black text-xs uppercase tracking-[0.2em] md:tracking-wider shadow-2xl md:shadow-lg hover:bg-emerald-50 active:scale-95 transition-all border-b-4 border-emerald-100 md:border md:border-white/90"
            >
              View profile
            </button>
            <button
              onClick={onEdit}
              className="w-full sm:w-auto px-8 py-4 md:px-6 md:py-2.5 rounded-2xl md:rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 text-white border-2 border-white/30 md:border-white/70 font-black text-xs uppercase tracking-[0.2em] md:tracking-wider backdrop-blur-md active:scale-95 transition-all flex items-center justify-center gap-3 md:gap-1.5 shadow-xl md:shadow-md"
            >
              <Edit3 className="w-4 h-4 md:w-3.5 md:h-3.5" />
              Edit profile
            </button>
          </div>
        </div>
      </motion.div>

      {/* ─── 4 STAT SUMMARY CARDS ROW ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-4">
        {/* Score */}
        <motion.div
          whileHover={{ y: -4, scale: 1.02 }}
          className="rounded-[1.5rem] md:rounded-2xl p-6 md:p-5 border border-border shadow-theme-card md:shadow-sm transition-all relative overflow-hidden group bg-card"
        >
          <div className="absolute top-0 right-0 w-24 h-24 blur-[50px] rounded-full opacity-5 group-hover:opacity-10 transition-opacity bg-accent md:hidden" />
          <div className="text-3xl md:text-2xl font-black italic md:not-italic tracking-tighter md:tracking-tight text-text-primary">
            {stats.score}
          </div>
          <div className="text-[10px] md:text-xs font-black md:font-bold uppercase tracking-widest md:tracking-wider mt-2 md:mt-1 opacity-50 md:opacity-100 text-text-secondary">
            Player score
          </div>
        </motion.div>

        {/* Matches */}
        <motion.div
          whileHover={{ y: -4, scale: 1.02 }}
          className="rounded-[1.5rem] md:rounded-2xl p-6 md:p-5 border border-border shadow-theme-card md:shadow-sm transition-all relative overflow-hidden group bg-card"
        >
          <div className="absolute top-0 right-0 w-24 h-24 blur-[50px] rounded-full opacity-5 group-hover:opacity-10 transition-opacity bg-success md:hidden" />
          <div className="text-3xl md:text-2xl font-black italic md:not-italic tracking-tighter md:tracking-tight text-text-primary">
            {stats.matchesCount}
          </div>
          <div className="text-[10px] md:text-xs font-black md:font-bold uppercase tracking-widest md:tracking-wider mt-2 md:mt-1 opacity-50 md:opacity-100 text-text-secondary">
            Matches played
          </div>
        </motion.div>

        {/* Win rate */}
        <motion.div
          whileHover={{ y: -4, scale: 1.02 }}
          className="rounded-[1.5rem] md:rounded-2xl p-6 md:p-5 border border-border shadow-theme-card md:shadow-sm transition-all relative overflow-hidden group bg-card"
        >
          <div className="absolute top-0 right-0 w-24 h-24 blur-[50px] rounded-full opacity-5 group-hover:opacity-10 transition-opacity bg-accent md:hidden" />
          <div className="text-3xl md:text-2xl font-black italic md:not-italic tracking-tighter md:tracking-tight text-text-primary">
            {stats.winRate}%
          </div>
          <div className="text-[10px] md:text-xs font-black md:font-bold uppercase tracking-widest md:tracking-wider mt-2 md:mt-1 opacity-50 md:opacity-100 text-text-secondary">
            Win rate
          </div>
        </motion.div>

        {/* Rating */}
        <motion.div
          whileHover={{ y: -4, scale: 1.02 }}
          className="rounded-[1.5rem] md:rounded-2xl p-6 md:p-5 border border-border shadow-theme-card md:shadow-sm transition-all relative overflow-hidden group bg-card"
        >
          <div className="absolute top-0 right-0 w-24 h-24 blur-[50px] rounded-full opacity-5 group-hover:opacity-10 transition-opacity bg-amber-500 md:hidden" />
          <div className="text-3xl md:text-2xl font-black italic md:not-italic tracking-tighter md:tracking-tight flex items-center gap-2 md:gap-1.5 text-text-primary">
            <span>{stats.rating}</span>
            <span className="text-amber-400 text-3xl md:text-xl">★</span>
          </div>
          <div className="text-[10px] md:text-xs font-black md:font-bold uppercase tracking-widest md:tracking-wider mt-2 md:mt-1 opacity-50 md:opacity-100 text-text-secondary">
            Avg. rating
          </div>
        </motion.div>
      </div>

      {/* ─── MAIN TWO COLUMN BODY GRID ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-6">
        {/* ─── LEFT COLUMN ───────────────────────────────────────────────── */}
        <div className="space-y-8 md:space-y-6">
          {/* Player Score & Gauge Card */}
          <div
            className="rounded-[2.5rem] md:rounded-3xl p-8 md:p-6 border border-border shadow-theme-card md:shadow-sm space-y-8 md:space-y-6 relative overflow-hidden bg-card"
          >
            <div className="absolute top-0 right-0 w-32 h-32 blur-[60px] rounded-full opacity-5 pointer-events-none bg-success md:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-lg md:text-base font-black uppercase italic md:not-italic tracking-tighter md:tracking-tight text-text-primary">
                Player score
              </h3>
              <span className="px-4 py-1.5 md:px-3 md:py-1 rounded-xl md:rounded-full text-[10px] font-black uppercase tracking-widest md:tracking-wider bg-emerald-500/10 md:bg-emerald-500/20 text-emerald-600 border border-emerald-500/20 md:border-emerald-500/30 shadow-inner md:shadow-none">
                Tier {stats.level}
              </span>
            </div>

            {/* Circular Gauge Ring and Breakdown */}
            <div className="flex flex-col sm:flex-row items-center gap-10 md:gap-6">
              {/* Circular Ring */}
              <div className="relative w-44 h-44 md:w-36 md:h-36 flex-shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke={theme.colors.border}
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke={theme.name === 'boxitt' ? '#10b981' : theme.colors.accent}
                    strokeWidth="10"
                    strokeDasharray="263.8"
                    strokeDashoffset={263.8 * (1 - 0.72)}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute text-center">
                  <div className="text-4xl md:text-2xl font-black italic md:not-italic tracking-tighter md:tracking-tight text-text-primary">
                    {stats.score}
                  </div>
                  <div className="text-[10px] font-black md:font-bold uppercase tracking-[0.3em] md:tracking-widest opacity-40 md:opacity-100 text-text-secondary">
                    PTS
                  </div>
                </div>
              </div>

              {/* Breakdown List */}
              <div className="flex-1 w-full space-y-4 md:space-y-2.5 font-black md:font-semibold uppercase md:normal-case text-[9px] md:text-xs tracking-widest md:tracking-normal">
                <div className="flex items-center justify-between pb-2 md:pb-1.5 border-b border-dashed md:border-solid border-border/50 md:border-border">
                  <span className="text-text-secondary">Skill rating</span>
                  <span className="text-xs md:text-sm font-black italic md:not-italic text-text-primary">{stats.skillRating}</span>
                </div>
                <div className="flex items-center justify-between pb-2 md:pb-1.5 border-b border-dashed md:border-solid border-border/50 md:border-border">
                  <span className="text-text-secondary">Consistency</span>
                  <span className="text-xs md:text-sm font-black italic md:not-italic text-text-primary">+{stats.consistencyBonus}</span>
                </div>
                <div className="flex items-center justify-between pb-2 md:pb-1.5 border-b border-dashed md:border-solid border-border/50 md:border-border">
                  <span className="text-text-secondary">Fair play</span>
                  <span className="text-xs md:text-sm font-black italic md:not-italic text-text-primary">{stats.fairPlayScore}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Tournament</span>
                  <span className="text-xs md:text-sm font-black italic md:not-italic text-text-primary">{stats.tournamentWins}</span>
                </div>
              </div>
            </div>

            {/* Badges Strip */}
            <div className="flex items-center justify-between md:justify-start gap-3 pt-4 md:pt-2 border-t md:border-none border-border/50">
              {[Trophy, Activity, Sparkles, Zap, Flame].map((Icon, i) => (
                <div key={i} className="p-4 md:p-3 rounded-2xl md:rounded-2xl bg-background-secondary/50 md:bg-white/10 border border-border md:border-transparent shadow-inner md:shadow-none transition-all hover:scale-110 cursor-help">
                  <Icon className="w-5 h-5 opacity-80 md:opacity-100" style={{ color: i === 0 ? '#F59E0B' : (i === 1 ? '#10B981' : (i === 2 ? '#3B82F6' : (i === 3 ? '#EAB308' : '#F97316'))) }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── RIGHT COLUMN ──────────────────────────────────────────────── */}
        <div className="space-y-8 md:space-y-6">
          {/* Quick menu Card */}
          <div
            className="rounded-[2.5rem] md:rounded-3xl p-8 md:p-6 border border-border shadow-theme-card md:shadow-sm space-y-6 md:space-y-4 relative overflow-hidden bg-card"
          >
            <h3 className="text-lg md:text-base font-black uppercase italic md:not-italic tracking-tighter md:tracking-tight text-text-primary px-1 md:px-0">
              Quick menu
            </h3>

            <div className="space-y-2 md:space-y-1">
              {[
                { icon: UserIcon, label: 'View profile', color: 'blue', onClick: () => setShowDetailedProfile(true) },
                { icon: Edit3, label: 'Edit profile', color: 'emerald', onClick: onEdit },
                { icon: Trophy, label: 'Player score & stats', color: 'amber', onClick: () => onAlert?.(`Your Player Score is ${stats.score} (Level ${stats.level})!`, 'info') },
                { icon: History, label: 'History', color: 'purple', onClick: () => navigate('/history') },
                { icon: Calendar, label: 'My bookings', color: 'rose', onClick: () => navigate('/history') },
                { icon: CreditCard, label: 'Payments & wallet', color: 'amber', onClick: () => navigate('/history') },
                { icon: Building2, label: 'Saved arenas', color: 'teal', onClick: () => navigate('/arenas/Box%20Cricket') },
                { icon: Users, label: 'Invite friends', color: 'cyan', onClick: () => setShowInviteModal(true) },
              ].map((item, i) => (
                <button
                  key={i}
                  onClick={item.onClick}
                  className="w-full flex items-center justify-between p-4 md:p-3 rounded-2xl md:rounded-2xl transition-all hover:bg-background-secondary active:scale-[0.98] border border-transparent hover:border-border/30 group shadow-sm md:shadow-none bg-background-secondary/30 md:bg-transparent"
                >
                  <div className="flex items-center gap-4 md:gap-3.5">
                    <div className={`w-10 h-10 md:w-9 md:h-9 rounded-xl md:rounded-xl flex items-center justify-center bg-${item.color}-500/10 text-${item.color}-500 shadow-inner md:shadow-none group-hover:scale-110 transition-transform`}>
                      <item.icon className="w-5 h-5 md:w-4 md:h-4" />
                    </div>
                    <span className="text-[11px] md:text-xs font-black md:font-black uppercase md:normal-case tracking-widest md:tracking-normal text-text-primary">
                      {item.label}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-30 md:opacity-50 text-text-secondary group-hover:translate-x-1 transition-transform" />
                </button>
              ))}
            </div>
          </div>

          {/* About app Card */}
          <div
            className="rounded-[2.5rem] md:rounded-3xl p-8 md:p-6 border border-border shadow-theme-card md:shadow-sm space-y-6 md:space-y-4 relative overflow-hidden bg-card"
          >
            <h3 className="text-lg md:text-base font-black uppercase italic md:not-italic tracking-tighter md:tracking-tight text-text-primary px-1 md:px-0">
              About app
            </h3>

            <div className="space-y-2 md:space-y-1">
              {/* App version */}
              <div className="flex items-center justify-between p-4 md:p-3 text-[10px] md:text-xs rounded-2xl md:rounded-none bg-background-secondary/30 md:bg-transparent shadow-inner md:shadow-none">
                <span className="font-black md:font-bold uppercase md:normal-case tracking-widest md:tracking-normal opacity-50 md:opacity-100 text-text-secondary">App version</span>
                <span className="font-black italic md:not-italic text-text-primary">2.4.1</span>
              </div>

              {[
                { label: 'Terms of service', onClick: () => setShowTermsModal(true) },
                { label: 'Privacy policy', onClick: () => setShowPrivacyModal(true) },
                { label: 'Rate boxitt', onClick: () => setShowRateModal(true) },
              ].map((item, i) => (
                <button
                  key={i}
                  onClick={item.onClick}
                  className="w-full flex items-center justify-between p-4 md:p-3 rounded-2xl md:rounded-2xl transition-all hover:bg-background-secondary group text-[10px] md:text-xs font-black md:font-bold uppercase md:normal-case tracking-widest md:tracking-normal bg-background-secondary/30 md:bg-transparent shadow-sm md:shadow-none"
                  style={{ color: theme.colors.textPrimary }}
                >
                  <span className="opacity-70 group-hover:opacity-100">{item.label}</span>
                  <ChevronRight className="w-4 h-4 opacity-30 md:opacity-50 text-text-secondary group-hover:translate-x-1 transition-transform" />
                </button>
              ))}

              {/* Log out */}
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="w-full flex items-center justify-between p-4 md:p-3 rounded-2xl md:rounded-2xl transition-all hover:bg-red-500/10 group shadow-sm md:shadow-none bg-background-secondary/30 md:bg-transparent"
                >
                  <div className="flex items-center gap-3 md:gap-2 text-rose-500">
                    <LogOut className="w-5 h-5 md:w-4 md:h-4 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-[10px] md:text-xs font-black uppercase md:normal-case tracking-widest md:tracking-normal">Log out</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-30 md:opacity-50 text-rose-500 group-hover:translate-x-1 transition-transform" />
                </button>
              )}
            </div>

            {/* Latest version badge */}
            <div className="pt-4 md:pt-2 flex md:block justify-center">
              <span className="inline-flex items-center gap-2 md:gap-1.5 px-5 py-2.5 md:px-3 md:py-1.5 rounded-2xl md:rounded-xl text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] md:tracking-wider bg-emerald-500/10 md:bg-emerald-500/15 text-emerald-600 border border-emerald-500/20 shadow-inner md:shadow-none italic md:not-italic">
                <CheckCircle2 className="w-4 h-4 md:w-3.5 md:h-3.5" />
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

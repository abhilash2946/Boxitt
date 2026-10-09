import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Location, User, SportType, Match, parseSportParam } from '../types';
import CricketScorer from './CricketScorer';
import FootballScorer from './FootballScorer';
import BasketballScorer from './BasketballScorer';
import TennisScorer from './TennisScorer';
import BadmintonScorer from './BadmintonScorer';
import SwimmingScorer from './SwimmingScorer';
import { storage } from '../services/storage';
import { supabase } from '../services/supabase';
import LoadingButton from '../components/LoadingButton';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Play, Edit2, BarChart2, ArrowLeft, History, Loader2 } from 'lucide-react';
import { handleError } from '../services/errorHandler';
import { useTheme } from '../contexts/ThemeContext';
import { forceScrollTop } from '../utils/scroll';

interface ScorerProps {
  location: Location;
  user: User;
  initialSport?: SportType | null;
  onAlert?: (msg: string, type: 'success' | 'error' | 'info') => void;
  onConfirm?: (config: {
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
  }) => void;
  onBack?: () => void;
}

const HISTORY_PAGE_SIZE = 20;

const Scorer: React.FC<ScorerProps> = ({ location, user, onAlert, onConfirm, initialSport, onBack }) => {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const PAGE_ID = `scorer_${location.id}`;
  const savedState = storage.getPageState<any>(PAGE_ID) || {};

  const getValidSport = (sport: SportType | null | undefined): SportType | null => {
    if (!sport) return null;
    if (!location.supportedSports || location.supportedSports.length === 0) return sport;
    const found = location.supportedSports.find(
      s => s === sport || parseSportParam(s) === parseSportParam(sport)
    );
    return found || null;
  };

  const effectiveInitialSport = getValidSport(initialSport) || SportType.CRICKET;

  // Start as null so the user lands on the Match Board page first for this location
  const [selectedSport, setSelectedSport] = useState<SportType | null>(null);
  const [liveMatches, setLiveMatches] = useState<Match[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);

  // Full Screen Scorer History View State
  const [showHistory, setShowHistory] = useState(false);
  const [historyMatches, setHistoryMatches] = useState<Match[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [historyPage, setHistoryPage] = useState(0);

  const handleBackClick = () => {
    if (showHistory) {
      setShowHistory(false);
    } else if (selectedSport) {
      setSelectedSport(null);
    } else if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  useEffect(() => {
    // Reset selected sport when location changes
    setSelectedSport(null);
    setShowHistory(false);
  }, [location.id]);

  useEffect(() => {
    return forceScrollTop();
  }, [selectedSport, showHistory]);

  const availableSports = React.useMemo(() => {
    const active = effectiveInitialSport || SportType.CRICKET;
    if (location?.supportedSports && location.supportedSports.length > 0) {
      const filtered = location.supportedSports.filter(
        s => s === active || parseSportParam(s) === parseSportParam(active)
      );
      if (filtered.length > 0) return filtered;
    }
    return [active];
  }, [location?.supportedSports, effectiveInitialSport]);

  // Check if a finished match completed within 1 hour post slot end time
  const isRecentlyFinished = (match: Match) => {
    if (match.status?.toLowerCase() !== 'finished') return true;

    const now = new Date().getTime();
    const ONE_HOUR = 60 * 60 * 1000;

    if (match.end_time) {
      const endTime = new Date(match.end_time).getTime();
      if (!isNaN(endTime)) {
        return (now - endTime) < ONE_HOUR;
      }
    }

    const matchData = (match.match_data || {}) as any;
    if (matchData.date && (matchData.slotTime || matchData.slot_time)) {
      const timeStr = matchData.slotTime || matchData.slot_time;
      if (timeStr.includes('-')) {
        const parts = timeStr.split('-');
        const startTimeStr = parts[0].trim();
        const endTimeStr = parts[1].trim();

        const startDate = new Date(`${matchData.date} ${startTimeStr}`);
        const endDate = new Date(`${matchData.date} ${endTimeStr}`);

        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          if (endDate.getTime() <= startDate.getTime()) {
            endDate.setDate(endDate.getDate() + 1);
          }
          return (now - endDate.getTime()) < ONE_HOUR;
        }
      }
    }

    const refTime = new Date(match.updated_at || match.created_at || '').getTime();
    if (!isNaN(refTime)) {
      return (now - refTime) < ONE_HOUR;
    }

    return false;
  };

  const filteredLiveMatches = React.useMemo(() => {
    const active = effectiveInitialSport || SportType.CRICKET;
    return (liveMatches || []).filter(m => {
      const s = m.sport;
      const matchesSport = s === active || parseSportParam(s) === parseSportParam(active);
      return matchesSport && isRecentlyFinished(m);
    });
  }, [liveMatches, effectiveInitialSport]);

  const formatSlotTiming = (match: Match) => {
    if (match.start_time) {
      const startDate = new Date(match.start_time);
      const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const formatDate = (d: Date) => {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}/${d.getFullYear()}`;
      };

      if (match.end_time) {
        const endDate = new Date(match.end_time);
        return `${formatDate(startDate)} • ${formatTime(startDate)} - ${formatTime(endDate)}`;
      }
      return `${formatDate(startDate)} • ${formatTime(startDate)}`;
    }

    const matchData = (match.match_data || {}) as any;
    if (matchData.slotTime || matchData.slot_time) {
      const dateStr = matchData.date ? `${matchData.date} • ` : '';
      return `${dateStr}${matchData.slotTime || matchData.slot_time}`;
    }

    if (match.created_at) {
      return new Date(match.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return 'N/A';
  };

  useEffect(() => {
    const fetchMatches = async () => {
      if (!user?.id) return;
      try {
        if (!location.id.startsWith('general_')) {
          await supabase.rpc('refresh_match_statuses', { p_location_id: location.id });
        }

        let query = supabase
          .from('matches')
          .select('*')
          .in('status', ['live', 'not started', 'finished']);

        if (location.id.startsWith('general_')) {
          const targetSport = effectiveInitialSport || SportType.CRICKET;
          query = query.ilike('sport', `%${targetSport}%`);
        } else {
          query = query.eq('location_id', location.id);
        }

        const { data, error } = await query;

        if (error) throw error;
        setLiveMatches(data || []);
      } catch (e) {
        console.error('Error fetching matches:', e);
      } finally {
        setLoadingMatches(false);
      }
    };
    fetchMatches();

    // Subscribe to real-time updates for matches at this location
    const channel = supabase
      .channel(`location_matches_${location.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `location_id=eq.${location.id}`
        },
        () => {
          fetchMatches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [location.id, user?.id]);

  useEffect(() => {
    storage.setPageState(PAGE_ID, { selectedSport });
  }, [PAGE_ID, selectedSport]);

  const openScorerHistory = async () => {
    setShowHistory(true);
    setLoadingHistory(true);
    setHistoryPage(0);
    setHasMoreHistory(true);
    try {
      let query = supabase
        .from('matches')
        .select('*')
        .eq('status', 'finished')
        .order('created_at', { ascending: false })
        .range(0, HISTORY_PAGE_SIZE - 1);

      if (location.id.startsWith('general_')) {
        const targetSport = effectiveInitialSport || SportType.CRICKET;
        query = query.ilike('sport', `%${targetSport}%`);
      } else {
        query = query.eq('location_id', location.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const results = data || [];
      setHistoryMatches(results);
      if (results.length < HISTORY_PAGE_SIZE) {
        setHasMoreHistory(false);
      }
    } catch (err) {
      console.error('Error fetching scorer history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadMoreHistory = async () => {
    if (loadingMoreHistory || !hasMoreHistory) return;
    setLoadingMoreHistory(true);
    const nextPage = historyPage + 1;
    const from = nextPage * HISTORY_PAGE_SIZE;
    const to = from + HISTORY_PAGE_SIZE - 1;

    try {
      let query = supabase
        .from('matches')
        .select('*')
        .eq('status', 'finished')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (location.id.startsWith('general_')) {
        const targetSport = effectiveInitialSport || SportType.CRICKET;
        query = query.ilike('sport', `%${targetSport}%`);
      } else {
        query = query.eq('location_id', location.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const newMatches = data || [];
      if (newMatches.length > 0) {
        setHistoryMatches(prev => [...prev, ...newMatches]);
        setHistoryPage(nextPage);
      }
      if (newMatches.length < HISTORY_PAGE_SIZE) {
        setHasMoreHistory(false);
      }
    } catch (err) {
      console.error('Error loading more history:', err);
    } finally {
      setLoadingMoreHistory(false);
    }
  };

  // Window scroll listener for infinite scrolling in full screen Scorer History View
  useEffect(() => {
    if (!showHistory) return;

    const handleWindowScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
        loadMoreHistory();
      }
    };

    window.addEventListener('scroll', handleWindowScroll);
    return () => window.removeEventListener('scroll', handleWindowScroll);
  }, [showHistory, loadingMoreHistory, hasMoreHistory, historyPage]);

  const formatMatchScore = (match: Match) => {
    const mData = (match.match_data || {}) as any;
    if (mData.gamesWonA !== undefined && mData.gamesWonB !== undefined) {
      return `${mData.gamesWonA} - ${mData.gamesWonB}`;
    }
    const sa = String(match.score_a || '').trim();
    const sb = String(match.score_b || '').trim();
    if (sa.includes('vs') || sa.includes('VS')) {
      return '1 - 0';
    }
    return `${sa || '0'} - ${sb || '0'}`;
  };

  const handleResumeMatch = (match: Match) => {
    // Determine sport and set state
    setSelectedSport(match.sport as SportType);

    const isFinished = match.status?.toLowerCase() === 'finished';

    // Defensive check for Cricket: if squad is missing, force setup view
    let targetView = isFinished ? 'review' : 'live';
    if (!isFinished && (match.sport === SportType.CRICKET || match.sport === 'Box Cricket')) {
      const data = match.match_data || {};
      const innings = data.innings?.[data.currentInningsIdx || 0];
      if (!innings || !innings.batsmen || innings.batsmen.length === 0) {
        targetView = 'setup';
      }
    }

    const matchData = {
      ...(match.match_data || {}),
      id: match.id,
      challengeId: match.challenge_id,
      challenge_id: match.challenge_id,
      locationId: match.location_id,
      sport: match.sport,
      status: isFinished ? 'Finished' : (match.match_data?.status || 'Live')
    };

    const sportKey = match.sport.toLowerCase().includes('cricket') ? 'cricket' : match.sport.toLowerCase().replace(/ /g, '_');
    const storageKey = `${sportKey}_scorer_${location.id}`;

    // Store match data in storage so the specific scorer can pick it up
    storage.setPageState(storageKey, {
      currentMatch: matchData,
      view: targetView
    });
  };

  const handleEditMatch = (match: Match) => {
    setSelectedSport(match.sport as SportType);

    const matchData = {
      ...(match.match_data || {}),
      id: match.id,
      challengeId: match.challenge_id,
      challenge_id: match.challenge_id,
      locationId: match.location_id,
      sport: match.sport
    };

    const sportKey = match.sport.toLowerCase().includes('cricket') ? 'cricket' : match.sport.toLowerCase().replace(/ /g, '_');
    const storageKey = `${sportKey}_scorer_${location.id}`;

    storage.setPageState(storageKey, {
      currentMatch: matchData,
      view: 'setup'
    });
  };

  const renderScorer = () => {
    // Full Screen Scorer History View
    if (showHistory) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="flex flex-col p-6 md:p-8 flex-1 relative z-10"
        >
          <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex items-center justify-between mb-8 pt-8 md:pt-6"
          >
            <div className="flex items-center gap-5 md:gap-4">
              <button
                onClick={handleBackClick}
                className="p-3.5 md:p-3 rounded-2xl md:rounded-2xl bg-card border border-border hover:bg-background-secondary transition-all shadow-theme-card active:scale-90 md:active:scale-100 cursor-pointer"
                title="Go back to Match Board"
              >
                <ArrowLeft className="w-6 h-6 md:w-5 md:h-5" style={{ color: theme.colors.textPrimary }} />
              </button>
              <div>
                <h1 className="text-3xl md:text-2xl font-black italic md:not-italic uppercase tracking-tighter md:tracking-normal" style={{ color: theme.colors.textPrimary }}>
                  Scorer <span style={{ color: theme.colors.accent }}>History</span>
                </h1>
                <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em] mt-1 px-3 py-1 rounded-full border shadow-theme-card inline-block"
                   style={{ color: theme.colors.textDisabled, borderColor: theme.colors.border, backgroundColor: theme.colors.backgroundSecondary }}>
                  {location.name} • Completed Match Archives
                </p>
              </div>
            </div>
          </motion.header>

          <h2 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-50 px-2 mb-6">Past Matches ({historyMatches.length})</h2>

          {loadingHistory ? (
            <div className="py-20 text-center opacity-50">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-accent" />
              <p className="text-[10px] font-black uppercase tracking-widest">Loading match history...</p>
            </div>
          ) : historyMatches.length === 0 ? (
            <div className="py-20 text-center bg-card/30 rounded-3xl border border-dashed border-border/50">
              <p className="font-black uppercase text-[10px] tracking-[0.4em] text-text-disabled">No completed matches found</p>
            </div>
          ) : (
            <div className="flex flex-col flex-1">
              {/* 2-Column Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8">
                {historyMatches.map((match) => (
                  <motion.div
                    whileHover={{ y: -5, scale: 1.02 }}
                    key={match.id}
                    className="p-8 border shadow-theme-card bg-card rounded-[2rem] border-border hover:border-accent/30 transition-all group flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="space-y-1">
                        <span className="text-[8px] font-black uppercase tracking-widest text-text-disabled block">{match.sport}</span>
                        <h3 className="text-xl font-black italic uppercase tracking-tighter text-text-primary">{match.team_a_name || 'Team A'} vs {match.team_b_name || 'Team B'}</h3>
                      </div>
                      <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm bg-background-secondary text-text-disabled">
                        FINISHED
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 mb-8">
                      <div className="bg-background-secondary/50 px-4 py-2 rounded-xl border border-border/50">
                        <span className="text-[7px] font-black text-text-disabled uppercase tracking-widest block mb-0.5">Score</span>
                        <span className="text-lg font-black italic text-accent">{formatMatchScore(match)}</span>
                      </div>
                      <div className="text-right">
                         <span className="text-[7px] font-black text-text-disabled uppercase tracking-widest block mb-0.5">Slot Timing</span>
                         <span className="text-[9px] font-bold text-text-primary">{formatSlotTiming(match)}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setShowHistory(false);
                        handleResumeMatch(match);
                      }}
                      className="w-full py-3 bg-accent text-white rounded-xl font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-theme-elevated flex items-center justify-center gap-3 text-xs cursor-pointer"
                    >
                      <BarChart2 className="w-4 h-4" /> View Performance
                    </button>
                  </motion.div>
                ))}
              </div>

              {/* Infinite Scroll Loading Symbol */}
              {loadingMoreHistory && (
                <div className="py-8 text-center flex items-center justify-center gap-3 col-span-full">
                  <Loader2 className="w-6 h-6 animate-spin text-accent" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-text-disabled">
                    Loading 20 more matches...
                  </span>
                </div>
              )}

              {!hasMoreHistory && historyMatches.length > 0 && (
                <div className="py-6 text-center opacity-40 col-span-full">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-text-disabled">
                    End of match history
                  </span>
                </div>
              )}
            </div>
          )}
        </motion.div>
      );
    }

    if (!selectedSport) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col p-6 md:p-8 flex-1 relative z-10"
        >
          <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex items-center justify-between mb-8 pt-8 md:pt-6"
          >
            <div className="flex items-center gap-5 md:gap-4">
              <button
                onClick={handleBackClick}
                className="p-3.5 md:p-3 rounded-2xl md:rounded-2xl bg-card border border-border hover:bg-background-secondary transition-all shadow-theme-card active:scale-90 md:active:scale-100 cursor-pointer"
                title="Go back"
              >
                <ArrowLeft className="w-6 h-6 md:w-5 md:h-5" style={{ color: theme.colors.textPrimary }} />
              </button>
              <div>
                <h1 className="text-3xl md:text-2xl font-black italic md:not-italic uppercase tracking-tighter md:tracking-normal" style={{ color: theme.colors.textPrimary }}>
                  Match <span style={{ color: theme.colors.accent }}>Board</span>
                </h1>
                <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em] mt-1 px-3 py-1 rounded-full border shadow-theme-card inline-block"
                   style={{ color: theme.colors.textDisabled, borderColor: theme.colors.border, backgroundColor: theme.colors.backgroundSecondary }}>
                  {location.name}
                </p>
              </div>
            </div>
          </motion.header>

          <h2 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-50 px-2 mb-6">Upcoming & Live Matches</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-12">
            {loadingMatches ? (
              <div className="col-span-full py-12 text-center opacity-30">
                 <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                 <p className="text-[10px] font-black uppercase tracking-widest">Synchronizing matches...</p>
              </div>
            ) : filteredLiveMatches.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-card/30 rounded-3xl border border-dashed border-border/50">
                 <p className="font-black uppercase text-[10px] tracking-[0.4em] text-text-disabled">No active sessions found</p>
              </div>
            ) : (
              [...filteredLiveMatches].sort((a,b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()).map((match) => (
                <motion.div
                  whileHover={{ y: -5, scale: 1.02 }}
                  key={match.id}
                  className="p-8 border shadow-theme-card bg-card rounded-[2rem] border-border hover:border-accent/30 transition-all group flex flex-col justify-between"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="space-y-1">
                      <span className="text-[8px] font-black uppercase tracking-widest text-text-disabled block">{match.sport}</span>
                      <h3 className="text-xl font-black italic uppercase tracking-tighter text-text-primary">{match.team_a_name || 'Team A'} vs {match.team_b_name || 'Team B'}</h3>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm ${match.status === 'live' ? 'bg-success text-white animate-pulse' : 'bg-background-secondary text-text-disabled'}`}>
                      {match.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4 mb-8">
                    <div className="bg-background-secondary/50 px-4 py-2 rounded-xl border border-border/50">
                      <span className="text-[7px] font-black text-text-disabled uppercase tracking-widest block mb-0.5">Score</span>
                      <span className="text-lg font-black italic text-accent">{formatMatchScore(match)}</span>
                    </div>
                    <div className="text-right">
                       <span className="text-[7px] font-black text-text-disabled uppercase tracking-widest block mb-0.5">Slot Timing</span>
                       <span className="text-[9px] font-bold text-text-primary">{formatSlotTiming(match)}</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => handleEditMatch(match)} className="w-12 h-12 bg-background-secondary hover:bg-accent/10 rounded-xl border border-border flex items-center justify-center transition-all group/btn cursor-pointer" title="Edit Match Setup">
                       <Edit2 className="w-4 h-4 text-text-secondary group-hover/btn:text-accent" />
                    </button>
                    {match.status?.toLowerCase() === 'finished' ? (
                      <button
                        onClick={() => handleResumeMatch(match)}
                        className="flex-1 py-3 bg-accent text-white rounded-xl font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-theme-elevated flex items-center justify-center gap-3 text-xs cursor-pointer"
                      >
                        <BarChart2 className="w-4 h-4" /> View Performance
                      </button>
                    ) : (
                      <button onClick={() => handleResumeMatch(match)} className="flex-1 py-3 bg-text-primary text-background rounded-xl font-black uppercase tracking-widest hover:bg-accent hover:text-white transition-all shadow-theme-elevated flex items-center justify-center gap-3 text-xs cursor-pointer">
                         <Play className="w-4 h-4 fill-current" /> Resume Scoring
                      </button>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>

          <h2 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-50 px-2 mb-6 italic">Initialize Manual Match</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 perspective-1000 mb-8">
            {availableSports.map((sport, index) => (
              <LoadingButton
                key={sport || index}
                onClick={() => setSelectedSport(sport)}
                className="p-6 md:p-8 border shadow-theme-card flex items-center justify-between group"
                style={{
                    backgroundColor: theme.colors.card,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.large
                }}
                loadingText="Entering..."
              >
                <div className="flex flex-col items-start">
                  <span className="font-black text-xl md:text-2xl uppercase tracking-widest group-hover:text-accent transition-colors"
                        style={{ color: theme.colors.textPrimary }}>{sport}</span>
                  <span className="text-[10px] md:text-xs font-black uppercase tracking-widest mt-1" style={{ color: theme.colors.textDisabled }}>Start manual match</span>
                </div>
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-theme-md flex items-center justify-center group-hover:rotate-12 transition-all shadow-theme-elevated border border-border"
                     style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textDisabled }}>
                  <ChevronRight className="w-6 h-6" />
                </div>
              </LoadingButton>
            ))}

            {/* Scorer History Button - exact same size and layout as Box Cricket button in the 2-column grid! */}
            <motion.button
              whileHover={{ y: -5, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={openScorerHistory}
              className="p-6 md:p-8 border shadow-theme-card flex items-center justify-between group cursor-pointer text-left w-full transition-all"
              style={{
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                borderRadius: theme.radius.large
              }}
            >
              <div className="flex flex-col items-start">
                <span className="font-black text-xl md:text-2xl uppercase tracking-widest group-hover:text-accent transition-colors"
                      style={{ color: theme.colors.textPrimary }}>Scorer History</span>
                <span className="text-[10px] md:text-xs font-black uppercase tracking-widest mt-1" style={{ color: theme.colors.textDisabled }}>View past completed matches</span>
              </div>
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-theme-md flex items-center justify-center group-hover:rotate-12 transition-all shadow-theme-elevated border border-border"
                   style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textDisabled }}>
                <History className="w-6 h-6 text-accent" />
              </div>
            </motion.button>
          </div>
        </motion.div>
      );
    }

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedSport}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          className="flex-1"
        >
          {(() => {
            try {
              switch (selectedSport) {
                case SportType.CRICKET:
                  return <CricketScorer location={location} user={user} onAlert={onAlert} onBack={() => setSelectedSport(null)} />;
                case SportType.FOOTBALL:
                  return <FootballScorer location={location} user={user} onAlert={onAlert} onBack={() => setSelectedSport(null)} />;
                case SportType.BASKETBALL:
                  return <BasketballScorer location={location} user={user} onAlert={onAlert} onBack={() => setSelectedSport(null)} />;
                case SportType.TENNIS:
                  return <TennisScorer location={location} user={user} onAlert={onAlert} onBack={() => setSelectedSport(null)} />;
                case SportType.BADMINTON:
                case SportType.PICKLEBALL:
                  return <BadmintonScorer location={location} user={user} sport={selectedSport} onAlert={onAlert} onBack={() => setSelectedSport(null)} />;
                case SportType.SWIMMING:
                  return <SwimmingScorer location={location} user={user} onBack={() => setSelectedSport(null)} onAlert={onAlert} onConfirm={onConfirm} />;
                default:
                  return (
                    <div className="p-10 text-center">
                      <p className="font-black uppercase italic" style={{ color: theme.colors.textDisabled }}>Sport Not Found</p>
                      <button onClick={() => setSelectedSport(null)} className="mt-6 font-black uppercase text-xs tracking-widest transition-colors" style={{ color: theme.colors.accent }}>Go Back</button>
                    </div>
                  );
              }
            } catch (err) {
              const appError = handleError(err);
              return (
                <div className="p-10 text-center">
                  <p className="font-black uppercase italic" style={{ color: theme.colors.error }}>{appError.message}</p>
                  <button onClick={() => setSelectedSport(null)} className="mt-6 font-black uppercase text-xs tracking-widest transition-colors" style={{ color: theme.colors.accent }}>Back to Selection</button>
                </div>
              );
            }
          })()}
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <div className="max-w-md md:max-w-none mx-auto min-h-screen flex flex-col pb-24 relative overflow-hidden transition-all duration-300"
         style={{ backgroundColor: theme.colors.background }}>
      {/* Background Decorative Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] rounded-full blur-[120px] pointer-events-none opacity-20"
           style={{ backgroundColor: theme.colors.accent }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[100px] pointer-events-none opacity-20"
           style={{ backgroundColor: theme.colors.success }} />

      {renderScorer()}
    </div>
  );
};

export default Scorer;

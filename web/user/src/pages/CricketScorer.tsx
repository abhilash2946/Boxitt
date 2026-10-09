import React, { useState, useEffect, useCallback } from 'react';
import { CricketMatch, CricketInnings, Location, SportType, User, Booking } from '../types';
import GenericScorer from '../components/GenericScorer';
import { bookingService } from '../services/bookingService';
import { supabase } from '../services/supabase';
import { storage } from '../services/storage';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Clock, History, Play, CheckCircle2, XCircle, RotateCcw, Swords, Target, Users, Settings } from 'lucide-react';
import { handleError } from '../services/errorHandler';
import { useTheme } from '../contexts/ThemeContext';
import { forceScrollTop } from '../utils/scroll';

const MATCHES_STORAGE_KEY = 'cricket_matches';

interface CricketScorerProps {
  location: Location;
  user: User;
  onAlert?: (msg: string, type: 'success' | 'error' | 'info') => void;
  onBack?: () => void;
}

const CricketScorer: React.FC<CricketScorerProps> = ({ location: initialLocation, user, onAlert, onBack }) => {
  const { theme } = useTheme();
  const PAGE_ID = `cricket_scorer_${initialLocation.id}`;
  const savedState = storage.getPageState<any>(PAGE_ID) || {};

  const [location, setLocation] = useState<Location & { averageRating?: number, ratingCount?: number }>(initialLocation as Location & { averageRating?: number, ratingCount?: number });
  const [cricketMatches, setCricketMatches] = useState<CricketMatch[]>([]);

  const [currentMatch, setCurrentMatch] = useState<CricketMatch | Booking | null>(savedState.currentMatch || null);
  const [view, setView] = useState<'history' | 'setup' | 'live' | 'review'>(savedState.view || 'history');

  useEffect(() => {
    return forceScrollTop();
  }, [view]);
  const [showEndConfirm, setShowEndConfirm] = useState<'innings' | 'match' | null>(null);

  const [hostTeam, setHostTeam] = useState(savedState.hostTeam || '');
  const [visitorTeam, setVisitorTeam] = useState(savedState.visitorTeam || '');
  const [tossWinner, setTossWinner] = useState<'host' | 'visitor' | null>(savedState.tossWinner || null);
  const [optedTo, setOptedTo] = useState<'Bat' | 'Bowl'>(savedState.optedTo || 'Bat');
  const [overs, setOvers] = useState<number | ''>(savedState.overs !== undefined ? savedState.overs : 16);

  const [hostTeamSize, setHostTeamSize] = useState<number | ''>(savedState.hostTeamSize !== undefined ? savedState.hostTeamSize : 11);
  const [visitorTeamSize, setVisitorTeamSize] = useState<number | ''>(savedState.visitorTeamSize !== undefined ? savedState.visitorTeamSize : 11);
  const [namingMode, setNamingMode] = useState<'default' | 'custom'>(savedState.namingMode || 'default');
  const [hostPlayerNames, setHostPlayerNames] = useState<string[]>(savedState.hostPlayerNames || []);
  const [visitorPlayerNames, setVisitorPlayerNames] = useState<string[]>(savedState.visitorPlayerNames || []);
  const [bestOf, setBestOf] = useState<number>(savedState.bestOf || 1);

  const [showToss, setShowToss] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showScorecardModal, setShowScorecardModal] = useState(false);
  const [tossResult, setTossResult] = useState<string | null>(null);
  const [showInningsEndPopup, setShowInningsEndPopup] = useState(false);
  const [showSeriesResult, setShowSeriesResult] = useState(false);
  const [seriesResultData, setSeriesResultData] = useState<{ winner: string, score: string, isFinal: boolean } | null>(null);
  const [coinAngle, setCoinAngle] = useState(0);
  const [coinSpinDuration, setCoinSpinDuration] = useState(2.6);
  const [isCoinSpinning, setIsCoinSpinning] = useState(false);
  const [spinKey, setSpinKey] = useState(0);

  useEffect(() => {
    storage.setPageState(PAGE_ID, {
      currentMatch, view, hostTeam, visitorTeam, tossWinner, optedTo, overs,
      hostTeamSize, visitorTeamSize, namingMode, hostPlayerNames, visitorPlayerNames,
      bestOf
    });
  }, [PAGE_ID, currentMatch, view, hostTeam, visitorTeam, tossWinner, optedTo, overs,
      hostTeamSize, visitorTeamSize, namingMode, hostPlayerNames, visitorPlayerNames, bestOf]);

  useEffect(() => {
    if (view === 'setup' && isCricketMatch(currentMatch)) {
      setHostTeam(currentMatch.teamA);
      setVisitorTeam(currentMatch.teamB);
      setOvers(currentMatch.overs);
      setHostTeamSize(currentMatch.teamASize);
      setVisitorTeamSize(currentMatch.teamBSize);
      setHostPlayerNames(currentMatch.teamAPlayers);
      setVisitorPlayerNames(currentMatch.teamBPlayers);
      if (currentMatch.bestOf) setBestOf(currentMatch.bestOf);
    }
  }, [view, currentMatch]);

  const isCricketMatch = (match: any): match is CricketMatch => match?.sport === SportType.CRICKET && 'innings' in match;

  const syncMatchResult = async (match: CricketMatch) => {
    if (!match.id || match.status !== 'Finished') {
      console.warn('syncMatchResult: Match not finished or missing ID', match);
      return;
    }

    try {
      // Determine winner and loser based on scores
      const inn1 = match.innings[0];
      const inn2 = match.innings[1];
      if (!inn1 || !inn2) {
        console.warn('syncMatchResult: Innings data missing', match.innings);
        return;
      }

      let winnerTeam = '';
      let isTie = false;
      if (inn1.runs > inn2.runs) winnerTeam = match.teamA;
      else if (inn2.runs > inn1.runs) winnerTeam = match.teamB;
      else isTie = true;

      // Extract challenge ID: prioritization is critical
      const challengeId = match.challengeId || (match as any).challenge_id;

      if (!challengeId) {
        console.warn('syncMatchResult: No challenge ID found. This might be a manual match.', match);
        return;
      }

      // Verify challenge exists
      const { data: challenge, error: chError } = await supabase
        .from('challenges')
        .select('id, challenger_id, accepted_by')
        .eq('id', challengeId)
        .maybeSingle();

      if (chError || !challenge) {
        console.error('syncMatchResult: Challenge verification failed', chError || 'Challenge not found');
        return;
      }

      const winnerId = isTie ? null : (winnerTeam === match.teamA ? challenge.challenger_id : challenge.accepted_by);
      const loserId = isTie ? null : (winnerTeam === match.teamA ? challenge.accepted_by : challenge.challenger_id);

      if (isTie || !winnerId || !loserId) {
          console.log('Match is a tie or missing participant IDs, skipping DB sync for results.');
          return;
      }

      const summary = match.bestOf && match.bestOf > 1
                      ? `${match.teamA} ${match.gamesWonA} - ${match.gamesWonB} ${match.teamB} (Series)`
                      : `${match.teamA} ${inn1.runs}/${inn1.wickets} vs ${match.teamB} ${inn2.runs}/${inn2.wickets}`;

      const { error: insError } = await supabase.from('match_results').insert({
        challenge_id: challenge.id,
        winner_id: winnerId,
        loser_id: loserId,
        score_summary: summary
      });

      if (insError) {
        console.error('Supabase Insert Error:', insError);
        throw new Error(insError.message);
      }
      triggerAlert('Match result synced! Results are now visible in history.', 'success');
    } catch (e: any) {
      console.error('Failed to sync match result:', e);
      const msg = e?.message || 'Failed to sync results to server. Please try again.';
      triggerAlert(msg, 'error');
    }
  };

  const triggerAlert = (msg: string, type: 'success' | 'error' | 'info' = 'info') => onAlert?.(msg, type);

  useEffect(() => { setLocation(initialLocation as Location & { averageRating?: number, ratingCount?: number }); }, [initialLocation]);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        await bookingService.getBookings(initialLocation.id);
      } catch (e) {
        console.error(handleError(e));
      }
    };
    fetchBookings();
  }, [initialLocation.id]);

  const resetMatchSetup = () => {
    setHostTeam(''); setVisitorTeam(''); setTossWinner(null); setOptedTo('Bat');
    setOvers(16); setHostTeamSize(11); setVisitorTeamSize(11); setNamingMode('default');
    setHostPlayerNames([]); setVisitorPlayerNames([]); setTossResult(null);
  };

  useEffect(() => {
    const size = Number(hostTeamSize) || 0;
    setHostPlayerNames(current => Array.from({ length: size }, (_, i) => current[i] || ''));
  }, [hostTeamSize]);

  useEffect(() => {
    const size = Number(visitorTeamSize) || 0;
    setVisitorPlayerNames(current => Array.from({ length: size }, (_, i) => current[i] || ''));
  }, [visitorTeamSize]);

  const handlePlayerNameChange = (team: 'host' | 'visitor', index: number, name: string) => {
    if (team === 'host') { const newNames = [...hostPlayerNames]; newNames[index] = name; setHostPlayerNames(newNames); }
    else { const newNames = [...visitorPlayerNames]; newNames[index] = name; setVisitorPlayerNames(newNames); }
  };

  const cleanupExpiredMatches = useCallback((allMatches: CricketMatch[]) => {
    const now = new Date().getTime();
    const RETENTION_PERIOD_MS = 24 * 60 * 60 * 1000;
    let hasChanges = false;
    const cleaned = allMatches.map(match => {
      if (match.status === 'Finished' && match.finishedAt && !match.isExpired) {
        if (now - new Date(match.finishedAt).getTime() >= RETENTION_PERIOD_MS) {
          hasChanges = true;
          return { ...match, isExpired: true, innings: [] };
        }
      }
      return {
        ...match,
        innings: match.innings || [],
        teamAPlayers: match.teamAPlayers || [],
        teamBPlayers: match.teamBPlayers || []
      };
    });
    if (hasChanges) localStorage.setItem(MATCHES_STORAGE_KEY, JSON.stringify(cleaned));
    return cleaned;
  }, []);

  const [supabaseMatches, setSupabaseMatches] = useState<CricketMatch[]>([]);

  useEffect(() => {
    const fetchSupabaseMatches = async () => {
      try {
        // Run lifecycle check before fetching
        await supabase.rpc('refresh_match_statuses', { p_location_id: initialLocation.id });

        const { data, error } = await supabase
          .from('matches')
          .select('*')
          .eq('location_id', initialLocation.id)
          .ilike('sport', '%Cricket%')
          .in('status', ['live', 'not started', 'finished']);

        if (data) {
          const mapped = data.map(m => {
            const matchData = (m.match_data || {}) as Partial<CricketMatch>;
            return {
              ...matchData,
              id: m.id,
              challengeId: m.challenge_id,
              locationId: m.location_id,
              teamA: m.team_a_name || matchData.teamA || 'Team A',
              teamB: m.team_b_name || matchData.teamB || 'Team B',
              status: m.status === 'not started' ? 'Not Started' : m.status === 'finished' ? 'Finished' : 'Live',
              createdAt: m.created_at,
              startTime: m.start_time,
              endTime: m.end_time,
              sport: SportType.CRICKET,
              innings: matchData.innings || [],
              teamAPlayers: matchData.teamAPlayers || [],
              teamBPlayers: matchData.teamBPlayers || [],
              teamASize: matchData.teamASize || 11,
              teamBSize: matchData.teamBSize || 11,
              overs: matchData.overs || 16,
              currentInningsIdx: matchData.currentInningsIdx || 0
            } as CricketMatch;
          });
          setSupabaseMatches(mapped);

          // If we have a current match that is synced from Supabase, update it
          setCurrentMatch(prev => {
            if (prev && 'id' in prev) {
              const updated = mapped.find(m => m.id === prev.id);
              if (updated) return updated;
            }
            return prev;
          });
        }
      } catch (e) { console.error(e); }
    };
    fetchSupabaseMatches();

    const channel = supabase
      .channel(`cricket_matches_${initialLocation.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `location_id=eq.${initialLocation.id}`
        },
        () => {
          fetchSupabaseMatches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialLocation.id]);

  useEffect(() => {
    const saved = localStorage.getItem(MATCHES_STORAGE_KEY);
    let localMatches: CricketMatch[] = [];
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          localMatches = cleanupExpiredMatches(parsed)
            .filter(m => m && m.locationId === initialLocation.id);
        }
      } catch (e) { console.error(e); }
    }

    // Merge local and supabase matches
    const combined = [...supabaseMatches, ...localMatches];
    const unique = Array.from(new Map(combined.filter(m => m && m.id).map(m => [m.id, m])).values());
    setCricketMatches(unique.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }, [cleanupExpiredMatches, initialLocation.id, supabaseMatches]);

  const saveMatches = (updatedArenaMatches: CricketMatch[]) => {
    const saved = localStorage.getItem(MATCHES_STORAGE_KEY);
    const allMatches: CricketMatch[] = saved ? JSON.parse(saved) : [];
    localStorage.setItem(MATCHES_STORAGE_KEY, JSON.stringify([...updatedArenaMatches, ...allMatches.filter(m => m.locationId !== initialLocation.id)]));
    setCricketMatches(updatedArenaMatches);
  };

  const persistCurrentMatch = async (updatedMatch: CricketMatch) => {
    setCurrentMatch(updatedMatch);
    const saved = localStorage.getItem(MATCHES_STORAGE_KEY);
    const allMatches: CricketMatch[] = saved ? JSON.parse(saved) : [];
    const index = allMatches.findIndex(m => m.id === updatedMatch.id);
    if (index !== -1) allMatches[index] = updatedMatch; else allMatches.unshift(updatedMatch);
    localStorage.setItem(MATCHES_STORAGE_KEY, JSON.stringify(allMatches));
    setCricketMatches(allMatches.filter(m => m.locationId === initialLocation.id));

    // Supabase sync for challenge-based matches
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(updatedMatch.id);
    if (isUuid) {
      try {
        const scoreA = updatedMatch.gamesWonA !== undefined && updatedMatch.bestOf && updatedMatch.bestOf > 1
          ? updatedMatch.gamesWonA.toString()
          : (updatedMatch.innings[0]?.runs?.toString() || '0');
        const scoreB = updatedMatch.gamesWonB !== undefined && updatedMatch.bestOf && updatedMatch.bestOf > 1
          ? updatedMatch.gamesWonB.toString()
          : (updatedMatch.innings[1]?.runs?.toString() || '0');

        await supabase.from('matches').update({
          match_data: updatedMatch,
          score_a: scoreA,
          score_b: scoreB,
          status: updatedMatch.status?.toLowerCase() === 'finished' ? 'finished' : 'live',
          updated_at: new Date().toISOString()
        }).or(`id.eq.${updatedMatch.id},challenge_id.eq.${updatedMatch.id}`);
      } catch (e) { console.error('Supabase sync error:', e); }
    }
  };

  const handleToss = () => {
    if (isCoinSpinning) return;
    
    setTossResult('flipping');
    setIsCoinSpinning(true);
    setSpinKey(prev => prev + 1);

    // Crypto-secure independent randomness for a true coin toss
    const randomArray = new Uint32Array(1);
    window.crypto.getRandomValues(randomArray);
    const isHostWinner = randomArray[0] % 2 === 0;
    const winner = isHostWinner ? 'host' : 'visitor';

    // Randomized physical properties for every single flip
    const extraRotations = 7 + Math.floor(Math.random() * 8); // 7 to 15 full rotations
    const landingFaceAngle = isHostWinner ? 0 : 180;
    const durationMs = 2800 + Math.random() * 800; // 2.8s to 3.6s

    setCoinSpinDuration(durationMs / 1000);
    setCoinAngle(extraRotations * 360 + landingFaceAngle);
    
    setTimeout(() => {
      setTossResult(winner === 'host' ? hostTeam || 'heads' : visitorTeam || 'tails');
      setTossWinner(winner);
      setIsCoinSpinning(false);
    }, durationMs);
  };

  const [showMatchInProgressModal, setShowMatchInProgressModal] = useState(false);

  const handleStartScoringClick = () => {
    if (!hostTeam || !visitorTeam) return triggerAlert("Team names required", 'error');
    if (!tossWinner) return triggerAlert("Please perform coin toss", 'error');
    const finalOvers = Number(overs);
    if (!finalOvers || finalOvers < 1) return triggerAlert("Invalid overs", 'error');

    const hasProgress = currentMatch && isCricketMatch(currentMatch) && currentMatch.innings.some(inn => (inn.runs || 0) > 0 || (inn.wickets || 0) > 0 || (inn.balls || 0) > 0 || (inn.ballByBall || []).length > 0);
    if (hasProgress) {
      setShowMatchInProgressModal(true);
    } else {
      startMatch('fresh');
    }
  };

  const startMatch = (mode: 'fresh' | 'continue') => {
    const finalOvers = Number(overs) || 16;
    const finalHostSize = Number(hostTeamSize) || 11;
    const finalVisitorSize = Number(visitorTeamSize) || 11;
    const getPlayers = (size: number, custom: string[]) => namingMode === 'custom' ? Array.from({ length: size }, (_, i) => custom[i]?.trim() || `Player ${i + 1}`) : Array.from({ length: size }, (_, i) => `Player ${i + 1}`);
    const hostPlayers = getPlayers(finalHostSize, hostPlayerNames);
    const visitorPlayers = getPlayers(finalVisitorSize, visitorPlayerNames);

    if (mode === 'continue' && currentMatch && isCricketMatch(currentMatch)) {
      const updated = { ...currentMatch } as CricketMatch;
      updated.teamA = hostTeam;
      updated.teamB = visitorTeam;
      updated.overs = finalOvers;
      updated.teamASize = finalHostSize;
      updated.teamBSize = finalVisitorSize;
      updated.teamAPlayers = hostPlayers;
      updated.teamBPlayers = visitorPlayers;

      updated.innings = updated.innings.map((inn, idx) => {
        const battingFirst = (tossWinner === 'host' && optedTo === 'Bat') || (tossWinner === 'visitor' && optedTo === 'Bowl') ? hostTeam : visitorTeam;
        const currentBattingTeam = idx === 0 ? battingFirst : (battingFirst === hostTeam ? visitorTeam : hostTeam);
        inn.battingTeam = currentBattingTeam;
        const freshPlayers = currentBattingTeam === hostTeam ? hostPlayers : visitorPlayers;
        const existingBatsmen = inn.batsmen || [];
        inn.batsmen = freshPlayers.map((name, i) => {
          if (existingBatsmen[i]) return { ...existingBatsmen[i], name };
          return { name, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false };
        });
        return inn;
      });
      persistCurrentMatch(updated);
      setView('live');
    } else {
      const battingFirst = (tossWinner === 'host' && optedTo === 'Bat') || (tossWinner === 'visitor' && optedTo === 'Bowl') ? hostTeam : visitorTeam;
      const battingPlayers = battingFirst === hostTeam ? hostPlayers : visitorPlayers;
      const newInnings: CricketInnings = { battingTeam: battingFirst, runs: 0, wickets: 0, balls: 0, overs: 0, isFreeHit: false, isNoBallRunPending: false, extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 }, batsmen: battingPlayers.map(name => ({ name, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false })), bowlers: [{ name: 'Bowler 1', overs: 0, maidens: 0, runs: 0, wickets: 0 }], strikerIdx: 0, nonStrikerIdx: 1, currentBowlerIdx: 0, ballByBall: [], nextBatsmanIdx: 2 };
      const matchId = (currentMatch && 'id' in currentMatch && currentMatch.id) ? currentMatch.id : `MATCH-${Date.now()}`;
      const chId = (currentMatch as any)?.challengeId || (currentMatch as any)?.challenge_id;
      const newMatch: CricketMatch = {
        id: matchId,
        challengeId: chId,
        challenge_id: chId,
        locationId: initialLocation.id,
        teamA: hostTeam,
        teamB: visitorTeam,
        tossWinner: tossWinner === 'host' ? hostTeam : visitorTeam,
        optedTo,
        overs: finalOvers,
        innings: [newInnings],
        currentInningsIdx: 0,
        status: 'Live',
        createdAt: new Date().toISOString(),
        teamASize: finalHostSize,
        teamBSize: finalVisitorSize,
        teamAPlayers: hostPlayers,
        teamBPlayers: visitorPlayers,
        sport: SportType.CRICKET
      };
      persistCurrentMatch(newMatch);
      setView('live');
    }
    setShowMatchInProgressModal(false);
  };

  const getWickets = (innings?: CricketInnings): number => {
    if (!innings || !innings.batsmen) return 0;
    return (innings.batsmen || []).filter(p => p.isOut).length;
  };

  const handleRun = (runValue: number) => {
    if (!currentMatch || !isCricketMatch(currentMatch) || currentMatch.status === 'Finished') return;
    const updated = JSON.parse(JSON.stringify(currentMatch)) as CricketMatch;
    const innings = updated.innings[updated.currentInningsIdx];

    // Defensive check for initialized squad data
    if (!innings || !innings.batsmen || innings.batsmen.length === 0 || innings.strikerIdx === undefined || !innings.batsmen[innings.strikerIdx]) {
      triggerAlert("Squad not initialized. Please go to Edit Squad/Details (gear icon) to set up players.", "error");
      return;
    }

    if (innings.isNoBallRunPending) {
      innings.runs += runValue; innings.batsmen[innings.strikerIdx].runs += runValue;
      if (runValue === 4) innings.batsmen[innings.strikerIdx].fours += 1;
      if (runValue === 6) innings.batsmen[innings.strikerIdx].sixes += 1;
      if (runValue % 2 === 1) [innings.strikerIdx, innings.nonStrikerIdx] = [innings.nonStrikerIdx, innings.strikerIdx];
      innings.isNoBallRunPending = false; innings.ballByBall.push(`NB+${runValue}`);
    } else {
      innings.runs += runValue; innings.batsmen[innings.strikerIdx].runs += runValue; innings.batsmen[innings.strikerIdx].balls += 1;
      if (runValue === 4) innings.batsmen[innings.strikerIdx].fours += 1;
      if (runValue === 6) innings.batsmen[innings.strikerIdx].sixes += 1;
      if (runValue % 2 === 1) [innings.strikerIdx, innings.nonStrikerIdx] = [innings.nonStrikerIdx, innings.strikerIdx];
      innings.ballByBall.push(runValue === 0 ? '-' : runValue.toString());
      innings.balls += 1; if (innings.balls === 6) { innings.overs += 1; innings.balls = 0; [innings.strikerIdx, innings.nonStrikerIdx] = [innings.nonStrikerIdx, innings.strikerIdx]; }
      if (innings.isFreeHit) innings.isFreeHit = false;
    }
    checkCompletion(updated);
  };

  const handleWicket = () => {
    if (!currentMatch || !isCricketMatch(currentMatch) || currentMatch.status === 'Finished') return;
    const updated = JSON.parse(JSON.stringify(currentMatch)) as CricketMatch;
    const innings = updated.innings[updated.currentInningsIdx];

    // Defensive check for initialized squad data
    if (!innings || !innings.batsmen || innings.batsmen.length === 0 || innings.strikerIdx === undefined || !innings.batsmen[innings.strikerIdx]) {
      triggerAlert("Squad not initialized. Please go to Edit Squad/Details (gear icon) to set up players.", "error");
      return;
    }

    if (innings.isFreeHit) { innings.ballByBall.push('FH-W'); innings.balls += 1; if (innings.balls === 6) { innings.overs += 1; innings.balls = 0; } innings.isFreeHit = false; }
    else {
      innings.wickets += 1; innings.batsmen[innings.strikerIdx].isOut = true; innings.batsmen[innings.strikerIdx].balls += 1; innings.ballByBall.push('W');
      if (innings.nextBatsmanIdx < innings.batsmen.length) innings.strikerIdx = innings.nextBatsmanIdx++;
      innings.balls += 1; if (innings.balls === 6) { innings.overs += 1; innings.balls = 0; [innings.strikerIdx, innings.nonStrikerIdx] = [innings.nonStrikerIdx, innings.strikerIdx]; }
    }
    checkCompletion(updated);
  };

  const checkCompletion = (updated: CricketMatch) => {
    const innings = updated.innings[updated.currentInningsIdx];
    const battingSize = innings.battingTeam === updated.teamA ? updated.teamASize : updated.teamBSize;
    const isTargetReached = updated.currentInningsIdx === 1 && innings.runs > updated.innings[0].runs;
    const isAllOut = getWickets(innings) >= battingSize - 1;
    const isOversFinished = innings.overs >= updated.overs;
    persistCurrentMatch(updated);
    if (isTargetReached || isAllOut || isOversFinished) {
      setTimeout(() => { setShowInningsEndPopup(true); setTimeout(() => { finalizeInnings(updated); setShowInningsEndPopup(false); }, 2500); }, 500);
    }
  };

  const finalizeInnings = (matchToFinalize?: CricketMatch) => {
    const match = matchToFinalize || (currentMatch as CricketMatch);
    if (!match || !isCricketMatch(match)) return;
    const updated = JSON.parse(JSON.stringify(match)) as CricketMatch;
    if (updated.currentInningsIdx === 0) {
      updated.currentInningsIdx = 1;
      const bowlingTeam = updated.teamA === updated.innings[0].battingTeam ? updated.teamB : updated.teamA;
      const players = bowlingTeam === updated.teamA ? updated.teamAPlayers : updated.teamBPlayers;
      updated.innings.push({ battingTeam: bowlingTeam, runs: 0, wickets: 0, balls: 0, overs: 0, isFreeHit: false, isNoBallRunPending: false, extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 }, batsmen: players.map(name => ({ name, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false })), bowlers: [{ name: 'Bowler 1', overs: 0, maidens: 0, runs: 0, wickets: 0 }], strikerIdx: 0, nonStrikerIdx: 1, currentBowlerIdx: 0, ballByBall: [], nextBatsmanIdx: 2 });
      persistCurrentMatch(updated);
    } else {
        const inn1 = updated.innings[0];
        const inn2 = updated.innings[1];
        let gA = updated.gamesWonA || 0;
        let gB = updated.gamesWonB || 0;
        const gHistory = [...(updated.gameHistory || []), `${inn1.runs}/${getWickets(inn1)} vs ${inn2.runs}/${getWickets(inn2)}` ];

        if (inn1.runs > inn2.runs) {
           if (inn1.battingTeam === updated.teamA) gA++; else gB++;
        } else if (inn2.runs > inn1.runs) {
           if (inn2.battingTeam === updated.teamA) gA++; else gB++;
        }

        const targetGames = bestOf === 1 ? 1 : Math.floor(bestOf / 2) + 1;
        if (gA === targetGames || gB === targetGames || bestOf === 1) {
            updated.status = 'Finished';
            updated.finishedAt = new Date().toISOString();
            updated.gamesWonA = gA;
            updated.gamesWonB = gB;
            updated.gameHistory = gHistory;
            persistCurrentMatch(updated);
            storage.clearPageState(PAGE_ID);
            syncMatchResult(updated);
            setSeriesResultData({
                winner: gA > gB ? updated.teamA : updated.teamB,
                score: `${gA} - ${gB}`,
                isFinal: true
            });
            setShowSeriesResult(true);
        } else {
            const battingFirst = (tossWinner === 'host' && optedTo === 'Bat') || (tossWinner === 'visitor' && optedTo === 'Bowl') ? hostTeam : visitorTeam;
            const battingPlayers = battingFirst === hostTeam ? updated.teamAPlayers : updated.teamBPlayers;
            const freshInnings: CricketInnings = { battingTeam: battingFirst, runs: 0, wickets: 0, balls: 0, overs: 0, isFreeHit: false, isNoBallRunPending: false, extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 }, batsmen: battingPlayers.map(name => ({ name, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false })), bowlers: [{ name: 'Bowler 1', overs: 0, maidens: 0, runs: 0, wickets: 0 }], strikerIdx: 0, nonStrikerIdx: 1, currentBowlerIdx: 0, ballByBall: [], nextBatsmanIdx: 2 };

            updated.currentInningsIdx = 0;
            updated.innings = [freshInnings];
            updated.gamesWonA = gA;
            updated.gamesWonB = gB;
            updated.gameHistory = gHistory;
            persistCurrentMatch(updated);

            // Sync result to DB if it's a challenge and not a tie
            syncMatchResult(updated);

            setSeriesResultData({
                winner: inn1.runs === inn2.runs ? 'Match Tied' : (inn1.runs > inn2.runs ? inn1.battingTeam : inn2.battingTeam),
                score: `${gA} - ${gB}`,
                isFinal: false
            });
            setShowSeriesResult(true);
        }
    }
    setShowEndConfirm(null);
  };

  const currentInnings = (currentMatch && isCricketMatch(currentMatch)) ? (currentMatch.innings?.[currentMatch.currentInningsIdx]) : undefined;

  const groupBallsIntoOvers = (balls: string[] = []) => {
    const overs: string[][] = [];
    if (!balls) return overs;
    let currentOver: string[] = [];
    let legalBallsInOver = 0;

    (balls || []).filter(b => b).forEach(ball => {
      currentOver.push(ball);
      // WD and NB don't count towards the 6 balls
      if (!ball.includes('WD') && !ball.includes('NB')) {
        legalBallsInOver++;
      }

      if (legalBallsInOver === 6) {
        overs.push(currentOver);
        currentOver = [];
        legalBallsInOver = 0;
      }
    });

    if (currentOver.length > 0) {
      overs.push(currentOver);
    }
    return overs;
  };

  return (
    <div className="flex flex-col flex-1 min-h-screen relative overflow-hidden transition-all duration-300"
         style={{ backgroundColor: theme.colors.background }}>
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] rounded-full blur-[120px] pointer-events-none opacity-20" style={{ backgroundColor: theme.colors.success }} />
      <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] rounded-full blur-[120px] pointer-events-none opacity-20" style={{ backgroundColor: theme.colors.accent }} />

      <header className="backdrop-blur-3xl p-4 md:p-6 flex justify-between items-center border-b sticky top-0 z-50 transition-all shadow-theme-card"
              style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-theme-sm flex items-center justify-center shadow-theme-elevated"
               style={{ backgroundColor: theme.colors.success, color: 'white' }}>
            <img src="/logo.png" className="w-6 h-6 md:w-8 md:h-8 object-contain" alt="Boxitt" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black italic tracking-tighter uppercase leading-none" style={{ color: theme.colors.textPrimary }}>Boxitt <span style={{ color: theme.colors.success }}>Cricket</span></h1>
            <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em] mt-1" style={{ color: theme.colors.textDisabled }}>Live Scoreboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {view === 'live' && (
            <button
              onClick={() => {
                // Pre-load setup state if currentMatch is valid
                if (currentMatch && isCricketMatch(currentMatch)) {
                  setHostTeam(currentMatch.teamA);
                  setVisitorTeam(currentMatch.teamB);
                  setHostTeamSize(currentMatch.teamASize);
                  setVisitorTeamSize(currentMatch.teamBSize);
                  setHostPlayerNames(currentMatch.teamAPlayers);
                  setVisitorPlayerNames(currentMatch.teamBPlayers);
                  setOvers(currentMatch.overs);
                }
                setView('setup');
              }}
              className="px-5 py-2.5 md:px-6 md:py-3 rounded-theme-sm text-[10px] md:text-xs font-black uppercase tracking-widest transition-all shadow-theme-elevated border"
              style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border, color: theme.colors.textPrimary }}
            >
              Edit
            </button>
          )}
          {(view === 'live' || view === 'review') && (
            <button
              onClick={() => setView('history')}
              className="w-10 h-10 md:w-12 md:h-12 rounded-theme-sm flex items-center justify-center transition-all border shadow-theme-card"
              style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border, color: theme.colors.textPrimary }}
            >
              <History className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          )}
          <button
            onClick={() => {
              if (view === 'live' || view === 'review') setView('history');
              else onBack?.();
            }}
            className="px-5 py-2.5 md:px-6 md:py-3 rounded-theme-sm text-xs md:text-sm font-black uppercase tracking-widest transition-all shadow-theme-elevated"
            style={{ backgroundColor: theme.colors.textPrimary, color: theme.colors.background }}
          >
            Exit
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 relative z-10 overflow-hidden">
        <AnimatePresence mode="wait">
          {view === 'history' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8 md:space-y-10">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em] mb-2" style={{ color: theme.colors.textDisabled }}>{location.name}</h2>
                  <div className="flex items-center gap-3 px-4 py-2 rounded-full border shadow-theme-card"
                       style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}>
                    <span className="text-amber-500 font-black text-sm md:text-base">★ {location.averageRating || '0.0'}</span>
                    <span className="text-[10px] md:text-xs font-black uppercase tracking-widest" style={{ color: theme.colors.textDisabled }}>{location.ratingCount || 0} reviews</span>
                  </div>
                </div>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { resetMatchSetup(); setView('setup'); }}
                               className="text-white px-8 py-4 rounded-theme-md text-xs md:text-sm font-black uppercase tracking-widest shadow-theme-elevated flex items-center gap-3 transition-all"
                               style={{ backgroundColor: theme.colors.success }}>
                  <Play className="w-4 h-4 md:w-5 md:h-5" /> New Match
                </motion.button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                {cricketMatches.length === 0 ? (
                  <div className="py-24 text-center rounded-theme-lg border-2 border-dashed col-span-full shadow-inner"
                       style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}>
                    <p className="font-black uppercase text-xs md:text-sm tracking-[0.3em]" style={{ color: theme.colors.textDisabled }}>No Match History Found</p>
                  </div>
                ) : (
                  cricketMatches.map((match, idx) => (
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }} key={match.id}
                                className="p-8 md:p-10 border shadow-theme-card relative overflow-hidden group transition-all duration-300 backdrop-blur-xl"
                                style={{ backgroundColor: `${theme.colors.card}dd`, borderColor: theme.colors.border, borderRadius: theme.radius.large }}>
                      <div className="absolute top-0 right-0 w-32 h-32 blur-[60px] rounded-full opacity-5 group-hover:opacity-20 transition-opacity" style={{ backgroundColor: theme.colors.success }} />

                      <div className="flex justify-between items-center mb-10">
                        <span className="text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center gap-3 opacity-70 animate-fade-in" style={{ color: theme.colors.textPrimary }}>
                          <div className="w-10 h-[1px] bg-border" />
                          {match.startTime ? (() => {
                            const formatTimeStr = (iso: string) => {
                              const d = new Date(iso);
                              let hours = d.getHours();
                              const minutes = String(d.getMinutes()).padStart(2, '0');
                              const ampm = hours >= 12 ? 'PM' : 'AM';
                              hours = hours % 12;
                              hours = hours ? hours : 12; // the hour '0' should be '12'
                              return `${hours}:${minutes} ${ampm}`;
                            };
                            const formatDateStr = (iso: string) => {
                              const d = new Date(iso);
                              const day = String(d.getDate()).padStart(2, '0');
                              const month = String(d.getMonth() + 1).padStart(2, '0');
                              return `${day}/${month}/${d.getFullYear()}`;
                            };

                            if (match.endTime) {
                              return `Scheduled Time: ${formatTimeStr((match as any).startTime)} - ${formatTimeStr((match as any).endTime)} • ${formatDateStr((match as any).startTime)}`;
                            }
                            return `Scheduled Time: ${formatTimeStr((match as any).startTime)} • ${formatDateStr((match as any).startTime)}`;
                          })() : new Date(match.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-40">CRICKET</span>
                          <span className={`px-5 py-2 rounded-full text-[10px] md:text-xs font-black uppercase tracking-[0.2em] shadow-theme-elevated transition-all ${match.status === 'Live' ? 'text-white animate-pulse' : ''}`}
                                style={{ backgroundColor: match.status === 'Live' ? theme.colors.success : theme.colors.backgroundSecondary,
                                        color: match.status === 'Live' ? 'white' : theme.colors.textDisabled }}>
                            {match.status === 'Live' ? '● Live Now' : match.status === 'Not Started' ? 'Upcoming' : match.status}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-8 mb-12 relative">
                        <div className="flex flex-col items-center flex-1">
                          <p className="font-black text-xl md:text-2xl uppercase tracking-tighter italic text-center mb-3 line-clamp-2 break-words" style={{ color: theme.colors.textPrimary }}>{match.teamA}</p>
                          {match?.innings?.[0] && (
                            <span className="text-xl md:text-2xl font-black px-5 py-2 rounded-xl shadow-inner border border-success/20"
                                  style={{ backgroundColor: `${theme.colors.success}10`, color: theme.colors.success }}>
                              {match.innings[0].runs}/{getWickets(match.innings[0])}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col items-center">
                          <div className="w-14 h-14 rounded-full border-2 flex items-center justify-center shadow-theme-card backdrop-blur-md"
                               style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}>
                             <span className="text-sm font-black italic opacity-40 text-accent">VS</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-center flex-1">
                          <p className="font-black text-xl md:text-2xl uppercase tracking-tighter italic text-center mb-3 line-clamp-2 break-words" style={{ color: theme.colors.textPrimary }}>{match.teamB}</p>
                          {match?.innings?.[1] && (match.innings[1].runs > 0 || match.innings[1].balls > 0 || getWickets(match.innings[1]) > 0) && (
                            <span className="text-xl md:text-2xl font-black px-5 py-2 rounded-xl shadow-inner border border-success/20"
                                  style={{ backgroundColor: `${theme.colors.success}10`, color: theme.colors.success }}>
                              {match.innings[1].runs}/{getWickets(match.innings[1])}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-4">
                        {match.status?.toLowerCase() === 'live' && !match.isExpired && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              setCurrentMatch(match);
                              setHostTeam(match.teamA);
                              setVisitorTeam(match.teamB);
                              setHostTeamSize(match.teamASize);
                              setVisitorTeamSize(match.teamBSize);
                              setHostPlayerNames(match.teamAPlayers);
                              setVisitorPlayerNames(match.teamBPlayers);
                              setOvers(match.overs);
                              setView('setup');
                            }}
                            className="w-14 h-14 rounded-xl bg-background-secondary border border-border flex items-center justify-center transition-all shadow-theme-card hover:border-accent"
                          >
                            <Settings className="w-6 h-6" style={{ color: theme.colors.textSecondary }} />
                          </motion.button>
                        )}
                        <motion.button
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setCurrentMatch(match);
                            setView('live');
                          }}
                          disabled={match.isExpired}
                          className="flex-1 py-5 rounded-theme-md text-xs md:text-sm font-black uppercase tracking-widest transition-all shadow-theme-elevated flex items-center justify-center gap-3 border-2 border-transparent hover:border-white/10"
                          style={{
                            backgroundColor: theme.colors.textPrimary,
                            color: theme.colors.background,
                            opacity: match.isExpired ? 0.3 : 1
                          }}
                        >
                          <Play className="w-5 h-5 fill-current" />
                          {match.isExpired ? 'Data Cleared' : 'Resume Match Scoring'}
                        </motion.button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {view === 'setup' && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="space-y-8 md:space-y-10 pb-24 max-w-7xl mx-auto">
              <div>
                <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter mb-2" style={{ color: theme.colors.textPrimary }}>New <span style={{ color: theme.colors.success }}>Match</span></h2>
                <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em]" style={{ color: theme.colors.textDisabled }}>Set up your match details</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Column: Teams & Players */}
                <div className="lg:col-span-7 space-y-8">
                  <div className="p-6 md:p-8 border shadow-theme-card space-y-8 transition-all duration-300 backdrop-blur-xl relative overflow-hidden"
                       style={{ backgroundColor: `${theme.colors.card}dd`, borderColor: theme.colors.border, borderRadius: theme.radius.large }}>
                    <div className="absolute top-0 left-0 w-64 h-64 blur-[120px] rounded-full opacity-10" style={{ backgroundColor: theme.colors.success }} />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.4em] ml-1 opacity-50" style={{ color: theme.colors.textPrimary }}>Team A(heads)</label>
                        <input value={hostTeam} onChange={e => setHostTeam(e.target.value)} placeholder="ENTER TEAM NAME"
                               className="w-full p-4 md:p-5 rounded-theme-md font-black italic text-lg md:text-xl outline-none transition-all shadow-inner border-2 border-transparent focus:border-success/50 uppercase tracking-tighter"
                               style={{ backgroundColor: `${theme.colors.backgroundSecondary}88`, color: theme.colors.textPrimary }} />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.4em] ml-1 opacity-50" style={{ color: theme.colors.textPrimary }}>Team B(tails)</label>
                        <input value={visitorTeam} onChange={e => setVisitorTeam(e.target.value)} placeholder="ENTER TEAM NAME"
                               className="w-full p-4 md:p-5 rounded-theme-md font-black italic text-lg md:text-xl outline-none transition-all shadow-inner border-2 border-transparent focus:border-success/50 uppercase tracking-tighter"
                               style={{ backgroundColor: `${theme.colors.backgroundSecondary}88`, color: theme.colors.textPrimary }} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 pt-6 border-t border-border/30">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.4em] ml-1 opacity-50" style={{ color: theme.colors.textPrimary }}>Squad Size Team A</label>
                        <input type="number" value={hostTeamSize} onChange={e => setHostTeamSize(e.target.value === '' ? '' : parseInt(e.target.value))}
                               className="w-full p-4 md:p-5 rounded-theme-md font-black text-xl outline-none border-2 border-transparent focus:border-success/30 shadow-inner"
                               style={{ backgroundColor: `${theme.colors.backgroundSecondary}88`, color: theme.colors.textPrimary }} />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.4em] ml-1 opacity-50" style={{ color: theme.colors.textPrimary }}>Squad Size Team B</label>
                        <input type="number" value={visitorTeamSize} onChange={e => setVisitorTeamSize(e.target.value === '' ? '' : parseInt(e.target.value))}
                               className="w-full p-4 md:p-5 rounded-theme-md font-black text-xl outline-none border-2 border-transparent focus:border-success/30 shadow-inner"
                               style={{ backgroundColor: `${theme.colors.backgroundSecondary}88`, color: theme.colors.textPrimary }} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="p-1.5 rounded-theme-lg flex border shadow-theme-card transition-all"
                         style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}>
                      <button onClick={() => setNamingMode('default')} className={`flex-1 py-3 md:py-4 rounded-theme-md text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${namingMode === 'default' ? 'bg-text-primary text-background shadow-theme-elevated' : 'text-text-disabled'}`}
                              style={namingMode === 'default' ? { backgroundColor: theme.colors.textPrimary, color: theme.colors.background } : {}}>Auto Names</button>
                      <button onClick={() => setNamingMode('custom')} className={`flex-1 py-3 md:py-4 rounded-theme-md text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${namingMode === 'custom' ? 'bg-text-primary text-background shadow-theme-elevated' : 'text-text-disabled'}`}
                              style={namingMode === 'custom' ? { backgroundColor: theme.colors.textPrimary, color: theme.colors.background } : {}}>Custom Names</button>
                    </div>

                    {namingMode === 'custom' && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-6 md:p-8 rounded-theme-lg border max-h-[400px] overflow-y-auto no-scrollbar shadow-inner transition-all"
                             style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}>
                           <h3 className="text-[10px] md:text-xs font-black uppercase tracking-widest mb-6 flex items-center gap-2" style={{ color: theme.colors.success }}><Users className="w-5 h-5" /> Team A Players</h3>
                           <div className="space-y-3">{Array.from({ length: Number(hostTeamSize) || 0 }).map((_, i) => (<input key={`h-${i}`} value={hostPlayerNames[i] || ''} onChange={e => handlePlayerNameChange('host', i, e.target.value)} placeholder={`Player ${i + 1}`} className="w-full p-3 rounded-theme-sm text-sm font-bold outline-none border shadow-inner" style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.textPrimary }} />))}</div>
                        </div>
                        <div className="p-6 md:p-8 rounded-theme-lg border max-h-[400px] overflow-y-auto no-scrollbar shadow-inner transition-all"
                             style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}>
                           <h3 className="text-[10px] md:text-xs font-black uppercase tracking-widest mb-6 flex items-center gap-2" style={{ color: theme.colors.accent }}><Users className="w-5 h-5" /> Team B Players</h3>
                           <div className="space-y-3">{Array.from({ length: Number(visitorTeamSize) || 0 }).map((_, i) => (<input key={`v-${i}`} value={visitorPlayerNames[i] || ''} onChange={e => handlePlayerNameChange('visitor', i, e.target.value)} placeholder={`Player ${i + 1}`} className="w-full p-3 rounded-theme-sm text-sm font-bold outline-none border shadow-inner" style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.textPrimary }} />))}</div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Right Column: Toss & Match Length */}
                <div className="lg:col-span-5 space-y-8 lg:sticky lg:top-24">
                  <div className="p-6 md:p-10 border shadow-theme-card space-y-8 relative overflow-hidden transition-all duration-300"
                       style={{ backgroundColor: `${theme.colors.card}dd`, borderColor: theme.colors.border, borderRadius: theme.radius.large }}>
                    <div className="absolute top-0 right-0 w-64 h-64 md:w-96 md:h-96 blur-[100px] rounded-full opacity-10" style={{ backgroundColor: theme.colors.accent }} />

                    <div className="flex justify-between items-center relative z-10">
                      <label className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em]" style={{ color: theme.colors.textDisabled }}>Match Toss</label>
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleToss}
                                     disabled={isCoinSpinning}
                                     className="px-5 py-2 text-white rounded-theme-md text-[10px] md:text-xs font-black uppercase tracking-widest shadow-theme-elevated flex items-center gap-2 border border-white/20 transition-all active:translate-y-0.5 disabled:opacity-50"
                                     style={{ backgroundColor: '#D97706' }}>
                          <RotateCcw className={`w-4 h-4 ${isCoinSpinning ? 'animate-spin' : ''}`} /> {isCoinSpinning ? 'Flipping...' : 'Spin Coin'}
                      </motion.button>
                    </div>

                    {/* Interactive 3D Coin Embedded */}
                    <div className="relative py-6 flex flex-col items-center justify-center z-10">
                      <div className="relative" style={{ width: '120px', height: '120px', transformStyle: 'preserve-3d', perspective: '1000px' }}>
                        <motion.div
                          key={spinKey}
                          initial={{ rotateY: 0, y: 0, scale: 1 }}
                          animate={{
                            rotateY: coinAngle,
                            scale: isCoinSpinning ? [1, 1.1, 1] : 1,
                            y: isCoinSpinning ? [0, -30, 0] : 0,
                          }}
                          transition={isCoinSpinning ? {
                            rotateY: { duration: coinSpinDuration, ease: [0.22, 0.95, 0.36, 1] },
                            scale: { duration: coinSpinDuration, times: [0, 0.45, 1], ease: "easeInOut" },
                            y: { duration: coinSpinDuration, times: [0, 0.45, 1], ease: "easeInOut" },
                          } : {
                            rotateY: { type: "spring", damping: 16, stiffness: 130 },
                            scale: { duration: 0.25 },
                            y: { duration: 0.25 },
                          }}
                          className="relative w-full h-full"
                          style={{ transformStyle: 'preserve-3d' }}
                        >
                          {/* Front Face - Heads */}
                          <div className="absolute inset-0 rounded-full flex flex-col items-center justify-center font-black shadow-2xl border-[6px]"
                               style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', background: 'linear-gradient(145deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)', borderColor: '#fcd34d', transform: 'rotateY(0deg) translateZ(1px)' }}>
                            <span className="text-4xl text-amber-900 opacity-80">H</span>
                            <span className="text-[8px] text-amber-900/60 tracking-widest mt-1">HEADS</span>
                          </div>
                          {/* Back Face - Tails */}
                          <div className="absolute inset-0 rounded-full flex flex-col items-center justify-center font-black shadow-2xl border-[6px]"
                               style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', background: 'linear-gradient(145deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)', borderColor: '#60a5fa', transform: 'rotateY(180deg) translateZ(1px)' }}>
                            <span className="text-4xl text-blue-950 opacity-80">T</span>
                            <span className="text-[8px] text-blue-950/60 tracking-widest mt-1">TAILS</span>
                          </div>
                        </motion.div>
                      </div>

                      <AnimatePresence mode="wait">
                        {tossResult && tossResult !== 'flipping' && (
                          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} className="mt-6 text-center">
                            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-success mb-1">Toss Won By</p>
                            <h4 className="text-xl font-black italic uppercase" style={{ color: theme.colors.textPrimary }}>{tossResult}</h4>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="space-y-6 relative z-10 pt-4 border-t border-border/20">
                      <div className="space-y-3">
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-40 ml-1">Manual Winner Override</p>
                        <div className="p-1.5 rounded-theme-lg flex border shadow-theme-card" style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}>
                          <button onClick={() => setTossWinner('host')} className={`flex-1 py-3 md:py-4 rounded-theme-md text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${tossWinner === 'host' ? 'bg-success text-white shadow-theme-elevated' : 'text-text-disabled'}`} style={tossWinner === 'host' ? { backgroundColor: theme.colors.success, color: 'white' } : {}}>{hostTeam || 'heads'}</button>
                          <button onClick={() => setTossWinner('visitor')} className={`flex-1 py-3 md:py-4 rounded-theme-md text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${tossWinner === 'visitor' ? 'bg-success text-white shadow-theme-elevated' : 'text-text-disabled'}`} style={tossWinner === 'visitor' ? { backgroundColor: theme.colors.success, color: 'white' } : {}}>{visitorTeam || 'tails'}</button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-40 ml-1">Decision</p>
                        <div className="p-1.5 rounded-theme-lg flex border shadow-theme-card" style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}>
                          <button onClick={() => setOptedTo('Bat')} className={`flex-1 py-3 md:py-4 rounded-theme-md text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${optedTo === 'Bat' ? 'bg-success text-white shadow-theme-elevated' : 'text-text-disabled'}`} style={optedTo === 'Bat' ? { backgroundColor: theme.colors.success, color: 'white' } : {}}>Choose Bat</button>
                          <button onClick={() => setOptedTo('Bowl')} className={`flex-1 py-3 md:py-4 rounded-theme-md text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${optedTo === 'Bowl' ? 'bg-success text-white shadow-theme-elevated' : 'text-text-disabled'}`} style={optedTo === 'Bowl' ? { backgroundColor: theme.colors.success, color: 'white' } : {}}>Choose Bowl</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 md:p-8 border shadow-theme-card transition-all"
                       style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radius.large }}>
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em]" style={{ color: theme.colors.textDisabled }}>Series Format</span>
                        <div className="flex items-center gap-2 p-1 rounded-theme-sm bg-background-secondary border border-border">
                            {[1, 3, 5, 7].map(num => (
                                <button key={num} onClick={() => setBestOf(num)}
                                        className={`px-3 py-1.5 rounded-theme-sm text-[10px] font-black transition-all ${bestOf === num ? 'bg-success text-white shadow-sm' : 'text-text-disabled hover:text-text-primary'}`}
                                        style={bestOf === num ? { backgroundColor: theme.colors.success } : {}}>
                                    Best of {num}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em]" style={{ color: theme.colors.textDisabled }}>Match Length</span>
                      <div className="flex items-center gap-4 px-5 py-2 rounded-theme-md border shadow-inner" style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}>
                        <input type="number" value={overs} onChange={e => { const v = e.target.value; setOvers(v === '' ? '' : parseInt(v)); }} className="w-12 md:w-16 bg-transparent font-black text-2xl md:text-3xl text-center outline-none" style={{ color: theme.colors.textPrimary }} />
                        <span className="text-[10px] md:text-xs font-black uppercase tracking-widest opacity-50">Overs</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleStartScoringClick}
                                   className="w-full py-5 md:py-6 text-white rounded-theme-lg font-black uppercase tracking-[0.3em] text-sm shadow-theme-elevated flex items-center justify-center gap-3 transition-all active:translate-y-1"
                                   style={{ backgroundColor: theme.colors.success }}>
                      <Play className="w-5 h-5 fill-current" /> Start Scoring
                    </motion.button>
                    <button onClick={() => setView('history')} className="w-full py-2 font-black uppercase text-[10px] md:text-xs tracking-widest transition-colors" style={{ color: theme.colors.textDisabled }}>Cancel Setup</button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'review' && isCricketMatch(currentMatch) && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-10 pb-32 max-w-6xl mx-auto">
              <div className="p-10 border rounded-theme-lg shadow-theme-card relative overflow-hidden backdrop-blur-xl" style={{ backgroundColor: `${theme.colors.card}dd`, borderColor: theme.colors.border }}>
                <div className="absolute top-0 right-0 w-64 h-64 blur-[100px] rounded-full opacity-10" style={{ backgroundColor: theme.colors.success }} />
                <h3 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter mb-4" style={{ color: theme.colors.textPrimary }}>Match <span style={{ color: theme.colors.success }}>Report</span></h3>
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  <div className="px-4 py-1.5 rounded-full bg-background-secondary border border-border text-[10px] font-black uppercase tracking-widest text-text-disabled self-start">
                    {currentMatch.teamA} vs {currentMatch.teamB}
                  </div>

                  <div className="px-4 py-1.5 rounded-full bg-success/10 border border-success/20 text-[10px] font-black uppercase tracking-widest text-success self-start">
                    {(() => {
                      const m = currentMatch as any;
                      if (m.startTime) {
                          const d = new Date(m.startTime);
                          return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} • ${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
                      }
                      return new Date(currentMatch.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
                    })()}
                  </div>
                </div>

                {bestOf && bestOf > 1 && (
                  <div className="mt-8 bg-background-secondary/40 rounded-[2rem] p-6 border border-border/50 backdrop-blur-md relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent pointer-events-none" />

                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                        <div className="flex items-center gap-6 flex-1 justify-center md:justify-start">
                           <div className="w-12 h-12 bg-success/20 text-success rounded-xl flex items-center justify-center rotate-12 shadow-sm flex-shrink-0">
                              <Trophy className="w-6 h-6" />
                           </div>
                           <div>
                              <p className="text-[9px] font-black uppercase text-success tracking-[0.3em] mb-1">Official Series Standing</p>
                              <h4 className="text-sm font-black text-text-primary uppercase tracking-widest">{(currentMatch.gamesWonA || 0) > (currentMatch.gamesWonB || 0) ? hostTeam : visitorTeam} Leading</h4>
                           </div>
                        </div>

                        <div className="flex items-center gap-10 bg-card/50 px-8 py-4 rounded-[1.5rem] border border-border/40 shadow-xl">
                            <div className="text-center">
                                <p className="text-[8px] font-black text-text-disabled uppercase mb-1">Wins</p>
                                <p className="text-4xl font-black italic text-text-primary">{currentMatch.gamesWonA || 0}</p>
                            </div>
                            <div className="text-lg font-black italic opacity-10">VS</div>
                            <div className="text-center">
                                <p className="text-[8px] font-black text-text-disabled uppercase mb-1">Wins</p>
                                <p className="text-4xl font-black italic text-text-primary">{currentMatch.gamesWonB || 0}</p>
                            </div>
                        </div>
                    </div>

                    {currentMatch.gameHistory && currentMatch.gameHistory.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-border/30">
                            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                {currentMatch.gameHistory.map((gh: any, i: number) => (
                                    <div key={i} className="flex-shrink-0 px-4 py-2 bg-card/40 border border-border/20 rounded-xl flex items-center gap-3">
                                        <span className="text-[8px] font-black text-text-disabled uppercase">G{i+1}</span>
                                        <span className="text-[10px] font-black text-success italic">{gh}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                  </div>
                )}
              </div>

              {(currentMatch?.innings || []).map((innings, idx) => {
                const groupedOvers: string[][] = [];
                const balls = innings.ballByBall || [];
                for (let i = 0; i < balls.length; i += 6) groupedOvers.push(balls.slice(i, i + 6));
                return (
                  <div key={idx} className="space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1.8fr] gap-8">
                      <div className="p-8 border rounded-theme-lg shadow-theme-card flex flex-col justify-center backdrop-blur-md" style={{ backgroundColor: `${theme.colors.card}bb`, borderColor: theme.colors.border }}>
                        <div className="flex items-center justify-between mb-8">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] block mb-1" style={{ color: theme.colors.textDisabled }}>Batting Team</span>
                            <span className="text-2xl font-black uppercase italic" style={{ color: theme.colors.textPrimary }}>{innings.battingTeam}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] block mb-1" style={{ color: theme.colors.textDisabled }}>Total Score</span>
                            <span className="text-5xl font-black" style={{ color: theme.colors.success }}>{innings.runs}<span className="text-2xl opacity-50 ml-1">/{innings.wickets}</span></span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-5 rounded-theme-md border bg-background-secondary/30" style={{ borderColor: theme.colors.border }}>
                            <p className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-50" style={{ color: theme.colors.textPrimary }}>Overs Completed</p>
                            <p className="text-3xl font-black" style={{ color: theme.colors.textPrimary }}>{innings.overs}.{innings.balls}</p>
                          </div>
                          <div className="p-5 rounded-theme-md border bg-background-secondary/30" style={{ borderColor: theme.colors.border }}>
                            <p className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-50" style={{ color: theme.colors.textPrimary }}>Run Rate</p>
                            <p className="text-3xl font-black text-accent" style={{ color: theme.colors.accent }}>{(innings.runs / Math.max(1, (innings.overs * 6 + innings.balls) / 6)).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="border rounded-theme-lg overflow-hidden shadow-theme-card backdrop-blur-md" style={{ backgroundColor: `${theme.colors.card}bb`, borderColor: theme.colors.border }}>
                        <div className="p-6 border-b flex items-center gap-3" style={{ backgroundColor: `${theme.colors.backgroundSecondary}44`, borderColor: theme.colors.border }}>
                          <Users className="w-5 h-5 opacity-40" />
                          <span className="text-xs font-black uppercase tracking-[0.4em]" style={{ color: theme.colors.textDisabled }}>Player Performance</span>
                        </div>
                        <div className="overflow-x-auto max-h-[400px] no-scrollbar">
                          <table className="w-full text-left">
                            <thead className="text-[10px] font-black uppercase tracking-widest border-b sticky top-0 z-10" style={{ backgroundColor: theme.colors.card, color: theme.colors.textDisabled, borderColor: theme.colors.border }}>
                              <tr><th className="p-5">Player</th><th className="p-5 text-center">Runs</th><th className="p-5 text-center">Balls</th><th className="p-5 text-center">S/R</th></tr>
                            </thead>
                            <tbody className="divide-y" style={{ borderColor: `${theme.colors.border}44` }}>
                              {(innings?.batsmen || []).filter(p => p && (p.balls > 0 || p.runs > 0)).map((p, pIdx) => (
                                <tr key={pIdx} className="hover:bg-white/5 transition-colors">
                                  <td className="p-5 font-black uppercase text-sm" style={{ color: theme.colors.textPrimary }}>{p.name}</td>
                                  <td className="p-5 text-center font-black text-lg" style={{ color: theme.colors.textPrimary }}>{p.runs}</td>
                                  <td className="p-5 text-center font-black text-sm opacity-40">{p.balls}</td>
                                  <td className="p-5 text-center font-black text-xs text-emerald-500">{(p.runs / Math.max(1, p.balls) * 100).toFixed(1)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <div className="border rounded-theme-lg overflow-hidden shadow-theme-card backdrop-blur-md" style={{ backgroundColor: `${theme.colors.card}bb`, borderColor: theme.colors.border }}>
                      <div className="p-6 border-b flex items-center gap-3" style={{ backgroundColor: `${theme.colors.backgroundSecondary}44`, borderColor: theme.colors.border }}>
                        <Clock className="w-5 h-5 opacity-40" />
                        <span className="text-xs font-black uppercase tracking-[0.4em]" style={{ color: theme.colors.textDisabled }}>Innings Timeline</span>
                      </div>
                      <div className="p-8 space-y-6">
                        {groupBallsIntoOvers(innings.ballByBall).map((over, overIdx) => (
                          <div key={overIdx} className="relative pl-8 border-l-2" style={{ borderColor: `${theme.colors.border}44` }}>
                            <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full border-4 border-background" style={{ backgroundColor: theme.colors.success }} />
                            <p className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-40">Over {overIdx + 1}</p>
                            <div className="flex flex-wrap gap-3">
                              {over.map((ball, ballIdx) => (
                                <span key={ballIdx} className={`h-12 min-w-[48px] px-3 rounded-theme-sm border flex items-center justify-center text-sm font-black shadow-theme-card ${
                                  ball === 'W' || ball === 'FH-W' ? 'bg-red-600 text-white border-red-500' :
                                  ball.includes('WD') || ball.includes('NB') ? 'bg-amber-500 text-slate-900 border-amber-400' : 'bg-background-secondary border-border'
                                }`}>
                                  {ball}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}

              <motion.button whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => setView('history')}
                             className="w-full py-6 rounded-theme-lg font-black uppercase tracking-[0.4em] text-sm shadow-theme-elevated flex items-center justify-center gap-4 transition-all"
                             style={{ backgroundColor: theme.colors.textPrimary, color: theme.colors.background }}>
                <History className="w-6 h-6" />
                <span>Back to Session History</span>
              </motion.button>
            </motion.div>
          )}

          {view === 'live' && isCricketMatch(currentMatch) && currentInnings && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="animate-in fade-in pb-24 md:pb-32">
              <div className="flex justify-end gap-3 mb-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setView('setup')}
                  className="px-6 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
                  style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.textPrimary }}
                >
                  Edit Squad / Details
                </motion.button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 md:gap-8 items-start">
                <div className="space-y-6">
                  {/* 1. Scoreboard - Balanced sizing */}
                  <div className={`p-6 md:p-10 shadow-theme-card border relative overflow-hidden transition-all duration-700 backdrop-blur-md`}
                       style={{
                         backgroundColor: `${theme.colors.card}bb`,
                         borderColor: theme.colors.border,
                         borderRadius: theme.radius.large
                       }}>
                    <div className="absolute top-0 right-0 w-48 h-48 md:w-96 md:h-96 blur-[120px] rounded-full opacity-5" style={{ backgroundColor: theme.colors.success }} />

                    <div className="flex justify-between items-center mb-8 relative z-10">
                       <div className="flex items-center gap-3">
                          <Swords className="w-5 h-5 md:w-6 md:h-6" style={{ color: theme.colors.success }} />
                          <span className="text-[10px] md:text-sm font-black uppercase tracking-[0.3em]" style={{ color: theme.colors.textDisabled }}>{currentInnings?.battingTeam || 'TBA'}</span>
                       </div>
                       {currentMatch?.status === 'Live' && currentInnings && (
                         <div className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full border shadow-sm backdrop-blur-md"
                              style={{ backgroundColor: `${theme.colors.success}10`, borderColor: `${theme.colors.success}20` }}>
                           <div className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: theme.colors.success }} />
                           <span className="text-[11px] md:text-sm font-black uppercase" style={{ color: theme.colors.success }}>CRR: {(currentInnings.runs / Math.max(1, (currentInnings.overs * 6 + currentInnings.balls) / 6)).toFixed(2)}</span>
                         </div>
                       )}
                    </div>

                    <AnimatePresence mode="wait">
                      {currentInnings?.isFreeHit && currentMatch?.status === 'Live' && (
                        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                                    className="mb-6 inline-flex items-center px-6 py-2 bg-amber-500 text-white text-xs md:text-sm font-black uppercase rounded-full shadow-theme-elevated border-2 border-amber-300">
                          FREE HIT ACTIVE
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="relative z-10 mb-4 text-center">
                      <motion.span key={currentInnings?.runs || 0} initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                                   className="text-7xl md:text-9xl font-black tracking-tighter italic"
                                   style={{ color: theme.colors.textPrimary }}>
                        {currentInnings?.runs || 0}
                      </motion.span>
                      <span className="text-3xl md:text-5xl font-black ml-4 tracking-tighter" style={{ color: theme.colors.success }}>/ {getWickets(currentInnings)}</span>
                    </div>

                    <div className="flex items-center justify-center gap-3 relative z-10">
                       <Clock className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
                       <span className="text-xl md:text-2xl font-black italic uppercase tracking-widest" style={{ color: theme.colors.textDisabled }}>
                         {currentInnings?.overs || 0}.{currentInnings?.balls || 0} <span className="text-sm md:text-base">Overs</span>
                       </span>
                    </div>
                  </div>

                  {/* 2. Last Balls (Over-based) */}
                  {currentMatch?.status === 'Live' && currentInnings && (
                    <div className="space-y-4 p-5 md:p-6 border rounded-theme-lg shadow-theme-card"
                         style={{ backgroundColor: `${theme.colors.card}bb`, borderColor: theme.colors.border }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <div className="w-1 h-4 rounded-full" style={{ backgroundColor: theme.colors.success }} />
                           <span className="text-[11px] md:text-sm font-black uppercase tracking-[0.4em]" style={{ color: theme.colors.textDisabled }}>Current Over</span>
                        </div>
                        <button onClick={() => setShowHistoryModal(true)}
                                className="p-2 hover:bg-white/5 rounded-full transition-colors"
                                style={{ color: theme.colors.textDisabled }}>
                          <History className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                      </div>
                      <div className="flex overflow-x-auto no-scrollbar gap-3 md:gap-4 pb-1 snap-x snap-mandatory">
                        {groupBallsIntoOvers(currentInnings?.ballByBall || []).slice(-1)[0]?.map((b, i) => (
                          <motion.div initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} key={i}
                                     className={`h-11 w-11 md:h-14 md:w-14 flex-shrink-0 rounded-theme-sm border flex items-center justify-center text-xs md:text-sm font-black shadow-theme-card transition-all snap-start ${
                                       b === 'W' || b === 'FH-W' ? 'bg-red-600 text-white border-red-500' :
                                       b.includes('WD') || b.includes('NB') ? 'bg-amber-500 text-slate-900 border-amber-400' : 'bg-card border-border'
                                     }`}
                                     style={{
                                          backgroundColor: !(b === 'W' || b === 'FH-W' || b.includes('WD') || b.includes('NB')) ? `${theme.colors.backgroundSecondary}88` : undefined,
                                          color: !(b === 'W' || b === 'FH-W' || b.includes('WD') || b.includes('NB')) ? theme.colors.textPrimary : undefined }}>
                            {b}
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 4. Batting Stats */}
                  <div className="rounded-theme-lg border overflow-hidden shadow-theme-card"
                       style={{ backgroundColor: `${theme.colors.card}bb`, borderColor: theme.colors.border }}>
                    <div className="p-4 md:p-6 border-b flex items-center justify-between" style={{ backgroundColor: `${theme.colors.backgroundSecondary}44`, borderColor: theme.colors.border }}>
                      <div className="flex items-center gap-3">
                        <Target className="w-4 h-4 md:w-5 md:h-5" style={{ color: theme.colors.accent }} />
                        <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em]" style={{ color: theme.colors.textDisabled }}>Batting Stats</span>
                      </div>
                      <button onClick={() => setShowScorecardModal(true)} className="p-1.5 hover:bg-white/5 rounded-full transition-colors" style={{ color: theme.colors.textDisabled }}>
                        <Users className="w-4 h-4 md:w-5 md:h-5" />
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="text-[10px] md:text-xs font-black uppercase tracking-widest border-b" style={{ color: theme.colors.textDisabled, borderColor: theme.colors.border }}>
                          <tr><th className="p-4 md:p-6">Player</th><th className="p-4 md:p-6 text-center">Runs</th><th className="p-4 md:p-6 text-center">Balls</th><th className="p-4 md:p-6 text-center">S/R</th></tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: theme.colors.border }}>
                          {[(currentInnings?.strikerIdx ?? 0), (currentInnings?.nonStrikerIdx ?? 1)].map((idx) => {
                            const p = currentInnings?.batsmen?.[idx];
                            if (!p) return null;
                            const isStriker = idx === currentInnings?.strikerIdx;
                            return (
                              <tr key={idx} style={{ backgroundColor: isStriker ? `${theme.colors.success}08` : 'transparent' }}>
                                <td className="p-4 md:p-6">
                                  <div className="flex items-center gap-2 md:gap-3">
                                    <span className="font-black uppercase italic text-xs md:text-base" style={{ color: isStriker ? theme.colors.success : theme.colors.textPrimary }}>{p.name}</span>
                                    {isStriker && <div className="w-2 h-2 rounded-full animate-pulse shadow-theme-elevated" style={{ backgroundColor: theme.colors.success }} />}
                                  </div>
                                </td>
                                <td className="p-4 md:p-6 text-center"><span className="text-base md:text-xl font-black" style={{ color: theme.colors.textPrimary }}>{p.runs}</span></td>
                                <td className="p-4 md:p-6 text-center"><span className="text-xs md:text-sm font-black" style={{ color: theme.colors.textDisabled }}>{p.balls}</span></td>
                                <td className="p-4 md:p-6 text-center"><span className="text-[10px] md:text-xs font-black" style={{ color: theme.colors.accent }}>{(p.runs / Math.max(1, p.balls) * 100).toFixed(1)}</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 lg:sticky lg:top-24">
                  {/* 3. Scorer Pad */}
                  {currentMatch.status === 'Live' ? (
                    <div className="p-6 md:p-8 border shadow-theme-card relative overflow-hidden transition-all duration-300"
                         style={{ backgroundColor: `${theme.colors.card}bb`, borderColor: theme.colors.border, borderRadius: theme.radius.large }}>

                      <div className="grid grid-cols-3 gap-4 mb-8 relative z-10">
                        <motion.button whileTap={{ scale: 0.9 }} onClick={handleWicket}
                                       className="py-4 md:py-6 bg-red-600/20 text-red-500 rounded-theme-md text-xs md:text-sm font-black uppercase tracking-[0.2em] border border-red-500/30 hover:bg-red-600 hover:text-white transition-all shadow-sm">
                          Out
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => { if (!currentMatch || !isCricketMatch(currentMatch)) return; const upd = JSON.parse(JSON.stringify(currentMatch)); const inn = upd.innings[upd.currentInningsIdx];[inn.strikerIdx, inn.nonStrikerIdx] = [inn.nonStrikerIdx, inn.strikerIdx]; persistCurrentMatch(upd); }}
                                       className="py-4 md:py-6 rounded-theme-md text-xs md:text-sm font-black uppercase tracking-[0.2em] border transition-all flex flex-col items-center justify-center gap-1 md:gap-2 hover:bg-white/5"
                                       style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border, color: theme.colors.textPrimary }}>
                          <RotateCcw className="w-4 h-4 md:w-5 md:h-5" /> Swap
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowEndConfirm(currentMatch.currentInningsIdx === 0 ? 'innings' : 'match')}
                                       className="py-4 md:py-6 bg-amber-500/20 text-amber-500 rounded-theme-md text-xs md:text-sm font-black uppercase tracking-[0.2em] border border-amber-500/30 hover:bg-amber-500 hover:text-slate-900 transition-all shadow-sm">
                          Pause
                        </motion.button>
                      </div>

                      <div className="grid grid-cols-4 gap-4 relative z-10">
                        {[0, 1, 2, 3, 4, 6].map(r => (
                          <motion.button key={r} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }} onClick={() => handleRun(r)}
                                         className={`h-16 md:h-24 rounded-theme-md flex items-center justify-center text-2xl md:text-4xl font-black shadow-theme-elevated transition-all border ${
                                           [4, 6].includes(r) ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-background-secondary border-border'
                                         }`}
                                         style={{ color: [4, 6].includes(r) ? 'white' : theme.colors.textPrimary }}>
                            {r}
                          </motion.button>
                        ))}
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => { if (!currentMatch || !isCricketMatch(currentMatch)) return; const upd = JSON.parse(JSON.stringify(currentMatch)); const inn = upd.innings[upd.currentInningsIdx]; inn.runs += 1; inn.extras.wides += 1; inn.ballByBall.push('WD'); persistCurrentMatch(upd); checkCompletion(upd); }}
                                       className="h-16 md:h-24 rounded-theme-md bg-amber-600 text-white text-base md:text-xl font-black shadow-theme-elevated border-2 border-amber-400">
                          WD
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => { if (!currentMatch || !isCricketMatch(currentMatch)) return; const upd = JSON.parse(JSON.stringify(currentMatch)); const inn = upd.innings[upd.currentInningsIdx]; inn.runs += 1; inn.extras.noBalls += 1; inn.isFreeHit = true; inn.isNoBallRunPending = true; persistCurrentMatch(upd); }}
                                       className="h-16 md:h-24 rounded-theme-md bg-blue-600 text-white text-base md:text-xl font-black shadow-theme-elevated border-2 border-blue-400">
                          NB
                        </motion.button>
                      </div>
                    </div>
                  ) : (
                    <motion.button whileHover={{ scale: 1.02 }} onClick={() => setView('review')}
                                   className="w-full py-6 md:py-8 rounded-theme-lg font-black uppercase tracking-[0.3em] text-sm md:text-base shadow-theme-elevated flex items-center justify-center gap-3 active:translate-y-1 transition-all"
                                   style={{ backgroundColor: theme.colors.textPrimary, color: theme.colors.background }}>
                      <Trophy className="w-6 h-6 md:w-8 md:h-8" />
                      <span>View Performance</span>
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Popups */}
      <AnimatePresence>
        {showInningsEndPopup && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xl p-6">
            <motion.div initial={{ scale: 0.8, rotateX: 45 }} animate={{ scale: 1, rotateX: 0 }} exit={{ scale: 0.8, rotateX: -45 }}
                        className="border rounded-theme-lg w-full max-w-sm p-10 md:p-12 text-center shadow-theme-modal transition-all"
                        style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
               <div className="w-20 h-20 md:w-24 md:h-24 rounded-theme-md flex items-center justify-center mx-auto mb-8 shadow-theme-elevated transform rotate-12"
                    style={{ backgroundColor: theme.colors.accent, color: 'white' }}><Clock className="w-10 h-10 md:w-12 md:h-12" /></div>
               <h3 className="text-3xl md:text-4xl font-black mb-4 uppercase italic tracking-tighter" style={{ color: theme.colors.textPrimary }}>Innings Over</h3>
               <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em] animate-pulse" style={{ color: theme.colors.textDisabled }}>Switching Sides...</p>
            </motion.div>
          </motion.div>
        )}

        {showEndConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xl p-6">
            <motion.div initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 50 }}
                        className="border rounded-theme-lg w-full max-w-sm p-10 md:p-12 text-center shadow-theme-modal transition-all"
                        style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
               <div className="w-16 h-16 md:w-20 md:h-20 bg-red-600/20 text-red-500 rounded-theme-sm flex items-center justify-center mx-auto mb-8 transition-all"><XCircle className="w-8 h-8 md:w-10 md:h-10" /></div>
               <h3 className="text-2xl md:text-3xl font-black mb-10 uppercase italic tracking-tighter" style={{ color: theme.colors.textPrimary }}>{showEndConfirm === 'innings' ? 'End Innings?' : 'End Match?'}</h3>
               <div className="space-y-4">
                  <motion.button whileHover={{ scale: 1.05 }} onClick={() => finalizeInnings()} className="w-full py-4 bg-red-600 text-white rounded-theme-md font-black uppercase tracking-widest text-xs md:text-sm shadow-theme-elevated active:translate-y-1">Confirm</motion.button>
                  <button onClick={() => setShowEndConfirm(null)} className="w-full py-2 font-black uppercase text-[10px] md:text-xs tracking-widest transition-colors" style={{ color: theme.colors.textDisabled }}>Cancel</button>
               </div>
            </motion.div>
          </motion.div>
        )}

        {showMatchInProgressModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xl p-6">
            <motion.div initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 50 }}
                        className="border rounded-theme-lg w-full max-w-sm p-10 md:p-12 text-center shadow-theme-modal transition-all"
                        style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
               <div className="w-16 h-16 bg-accent/20 text-accent rounded-full flex items-center justify-center mx-auto mb-6"><Settings className="w-8 h-8" /></div>
               <h3 className="text-2xl font-black mb-4 uppercase italic tracking-tighter" style={{ color: theme.colors.textPrimary }}>Match In Progress</h3>
               <p className="text-sm opacity-70 mb-8" style={{ color: theme.colors.textPrimary }}>An active session already has recorded scores/progress. Would you like to continue it with your settings or clear it?</p>
               <div className="space-y-4">
                  <motion.button whileHover={{ scale: 1.02 }} onClick={() => startMatch('continue')} className="w-full py-4 bg-accent text-white rounded-theme-md font-black uppercase tracking-widest text-xs shadow-theme-elevated">Continue Session</motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} onClick={() => startMatch('fresh')} className="w-full py-4 bg-red-600 text-white rounded-theme-md font-black uppercase tracking-widest text-xs shadow-theme-elevated">Reset & Start New</motion.button>
                  <button onClick={() => setShowMatchInProgressModal(false)} className="w-full py-2 font-black uppercase text-[10px] tracking-widest transition-colors" style={{ color: theme.colors.textDisabled }}>Cancel</button>
               </div>
            </motion.div>
          </motion.div>
        )}

        {showHistoryModal && currentInnings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xl p-4 md:p-6">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                        className="border rounded-theme-lg w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-theme-modal transition-all"
                        style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
               <div className="p-6 border-b flex justify-between items-center" style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}>
                 <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter" style={{ color: theme.colors.textPrimary }}>Match History</h3>
                 <button onClick={() => setShowHistoryModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors" style={{ color: theme.colors.textDisabled }}><XCircle className="w-6 h-6" /></button>
               </div>
               <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                 {groupBallsIntoOvers(currentInnings?.ballByBall || []).map((over, idx) => (
                   <div key={idx} className="p-4 rounded-theme-md border" style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}>
                     <p className="text-[10px] md:text-xs font-black uppercase tracking-widest mb-3" style={{ color: theme.colors.textDisabled }}>Over {idx + 1}</p>
                     <div className="flex flex-wrap gap-2">
                       {(over || []).map((ball, bIdx) => (
                         <span key={bIdx} className={`h-10 min-w-[40px] px-2 rounded-theme-sm border flex items-center justify-center text-sm font-black ${ball === 'W' || ball === 'FH-W' ? 'bg-red-600 text-white border-red-500' : ball.includes('WD') || ball.includes('NB') ? 'bg-amber-500 text-slate-900 border-amber-400' : ''}`}
                               style={{ backgroundColor: !(ball === 'W' || ball === 'FH-W' || ball.includes('WD') || ball.includes('NB')) ? theme.colors.card : undefined,
                                        borderColor: !(ball === 'W' || ball === 'FH-W' || ball.includes('WD') || ball.includes('NB')) ? theme.colors.border : undefined,
                                        color: !(ball === 'W' || ball === 'FH-W' || ball.includes('WD') || ball.includes('NB')) ? theme.colors.textPrimary : undefined }}>{ball}</span>
                       ))}
                     </div>
                   </div>
                 ))}
               </div>
            </motion.div>
          </motion.div>
        )}

        {showScorecardModal && currentInnings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xl p-4 md:p-6">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                        className="border rounded-theme-lg w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-theme-modal transition-all"
                        style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
               <div className="p-6 border-b flex justify-between items-center" style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}>
                 <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter" style={{ color: theme.colors.textPrimary }}>{currentInnings?.battingTeam || 'TBA'} Scorecard</h3>
                 <button onClick={() => setShowScorecardModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors" style={{ color: theme.colors.textDisabled }}><XCircle className="w-6 h-6" /></button>
               </div>
               <div className="flex-1 overflow-y-auto no-scrollbar">
                 <table className="w-full text-left">
                   <thead className="text-[10px] md:text-xs font-black uppercase tracking-widest border-b sticky top-0" style={{ backgroundColor: theme.colors.card, color: theme.colors.textDisabled, borderColor: theme.colors.border }}>
                     <tr><th className="p-4">Batsman</th><th className="p-4 text-center">Runs</th><th className="p-4 text-center">Balls</th><th className="p-4 text-center">4s/6s</th><th className="p-4 text-center">S/R</th></tr>
                   </thead>
                   <tbody className="divide-y" style={{ borderColor: theme.colors.border }}>
                     {(currentInnings?.batsmen || []).filter(p => p).map((p, idx) => (
                       <tr key={idx} style={{ opacity: p.balls > 0 || p.isOut ? 1 : 0.5 }}>
                         <td className="p-4">
                           <div className="flex flex-col">
                             <span className="font-black uppercase text-xs md:text-sm" style={{ color: theme.colors.textPrimary }}>{p.name}</span>
                             {p.isOut && <span className="text-[9px] uppercase font-bold text-red-500">Out</span>}
                             {!p.isOut && p.balls > 0 && <span className="text-[9px] uppercase font-bold text-emerald-500">Not Out</span>}
                           </div>
                         </td>
                         <td className="p-4 text-center font-black text-sm md:text-base" style={{ color: theme.colors.textPrimary }}>{p.runs}</td>
                         <td className="p-4 text-center font-black text-xs md:text-sm" style={{ color: theme.colors.textDisabled }}>{p.balls}</td>
                         <td className="p-4 text-center font-black text-[10px] md:text-xs" style={{ color: theme.colors.textDisabled }}>{p.fours}/{p.sixes}</td>
                         <td className="p-4 text-center font-black text-[10px] md:text-xs" style={{ color: theme.colors.accent }}>{p.balls > 0 ? (p.runs / p.balls * 100).toFixed(1) : '0.0'}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </motion.div>
          </motion.div>
        )}

        {showSeriesResult && seriesResultData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 md:p-6">
            <motion.div initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 50 }}
                        className="border rounded-[2.5rem] w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
                        style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
               <div className="absolute top-0 right-0 w-48 h-48 blur-[100px] rounded-full opacity-10" style={{ backgroundColor: theme.colors.success }} />

               <div className="relative z-10 flex flex-col p-8 md:p-10 overflow-hidden">
                 <div className="overflow-y-auto no-scrollbar pr-1">
                   <div className="w-16 h-16 bg-success/20 text-success rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner rotate-12 flex-shrink-0">
                      <Trophy className="w-8 h-8" />
                   </div>

                   <h3 className="text-3xl md:text-4xl font-black mb-1 uppercase italic tracking-tighter text-center" style={{ color: theme.colors.textPrimary }}>
                      {seriesResultData.isFinal ? 'Series ' : 'Game '}<span style={{ color: theme.colors.success }}>{seriesResultData.isFinal ? 'Won!' : 'Over!'}</span>
                   </h3>
                   <p className="text-[9px] font-black uppercase tracking-[0.5em] text-text-disabled mb-8 text-center">Official Classification</p>

                   <div className="bg-background-secondary/50 rounded-3xl p-6 mb-8 border border-border/50 backdrop-blur-md relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent pointer-events-none" />
                      <p className="text-[10px] font-black uppercase text-success tracking-[0.3em] mb-6 relative z-10 text-center">Series Standings</p>

                      <div className="flex items-center justify-between gap-2 relative z-10">
                         <div className="flex-1 space-y-2 text-center">
                            <p className="text-[9px] font-black uppercase text-text-disabled truncate px-1">{hostTeam}</p>
                            <div className="text-5xl md:text-6xl font-black italic tracking-tighter text-text-primary drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                               {seriesResultData.score.split('-')[0].trim()}
                            </div>
                            <div className="h-1 w-10 bg-success rounded-full mx-auto" />
                         </div>

                         <div className="flex flex-col items-center">
                            <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center bg-background shadow-sm">
                               <span className="text-[10px] font-black italic opacity-20">VS</span>
                            </div>
                         </div>

                         <div className="flex-1 space-y-2 text-center">
                            <p className="text-[9px] font-black uppercase text-text-disabled truncate px-1">{visitorTeam}</p>
                            <div className="text-5xl md:text-6xl font-black italic tracking-tighter text-text-primary drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                               {seriesResultData.score.split('-')[1].trim()}
                            </div>
                            <div className="h-1 w-10 bg-success rounded-full mx-auto" />
                         </div>
                      </div>
                   </div>

                   {isCricketMatch(currentMatch) && currentMatch.gameHistory && currentMatch.gameHistory.length > 0 && (
                       <div className="mb-8">
                           <div className="flex items-center gap-4 mb-4">
                              <div className="h-px flex-1 bg-border/30" />
                              <span className="text-[8px] font-black uppercase tracking-widest text-text-disabled opacity-60">Session Timeline</span>
                              <div className="h-px flex-1 bg-border/30" />
                           </div>
                           <div className="flex gap-2 overflow-x-auto no-scrollbar justify-center px-2">
                               {currentMatch.gameHistory.map((gh: string, i: number) => (
                                   <div key={i} className="flex-shrink-0 px-4 py-3 bg-background-secondary border border-border/40 rounded-2xl flex flex-col items-center min-w-[80px]">
                                       <span className="text-[7px] font-black text-text-disabled uppercase block mb-1">Game {i+1}</span>
                                       <span className="text-[10px] font-black text-text-primary italic tracking-tight">{gh}</span>
                                   </div>
                               ))}
                           </div>
                       </div>
                   )}
                 </div>

                 <div className="pt-2 flex-shrink-0 mt-auto px-8 pb-10">
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                   onClick={() => {
                                      setShowSeriesResult(false);
                                      if (seriesResultData.isFinal) setView('review');
                                   }}
                                   className="w-full py-5 bg-text-primary text-background rounded-2xl font-black uppercase tracking-[0.3em] text-xs md:text-sm shadow-2xl transition-all">
                       {seriesResultData.isFinal ? 'Analyze Performance' : 'Proceed to Next Game'}
                    </motion.button>
                 </div>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CricketScorer;

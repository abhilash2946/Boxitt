import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Location, User, SportType } from '../types';
import RatingModal from '../components/RatingModal';
import { storage } from '../services/storage';
import { supabase } from '../services/supabase';
import LoadingButton from '../components/LoadingButton';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Trophy, History, Play, CheckCircle2, Timer, XCircle, RotateCcw,
    Plus, Settings, Users, Activity, Flag, ShieldAlert,
    ListOrdered, ArrowRightLeft, Target, Clock
} from 'lucide-react';
import { handleError } from '../services/errorHandler';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeSelector } from '../components/ThemeSelector';
import { forceScrollTop } from '../utils/scroll';

const MATCHES_STORAGE_KEY = 'football_matches';

interface FootballEvent {
    id: string;
    type: 'Goal' | 'YellowCard' | 'RedCard' | 'Substitution';
    team: 'A' | 'B';
    playerName: string;
    playerNameIn?: string;
    minute: number;
    stoppageMinute?: number;
}

interface FootballStats {
    corners: number;
    shotsOnTarget: number;
    offsides: number;
    yellowCards: number;
    redCards: number;
    freeKicks: number;
}

interface FootballMatch {
    id: string;
    locationId: string;
    challengeId?: string;
    teamA: string;
    teamB: string;
    scoreA: number;
    scoreB: number;
    period: number;
    status: 'Live' | 'Finished' | 'HalfTime' | 'Not Started';
    createdAt: string;
    finishedAt?: string;
    startTime?: string;
    endTime?: string;
    isExpired?: boolean;
    sport: SportType.FOOTBALL;
    teamAPlayers: string[];
    teamBPlayers: string[];
    teamASubs: string[];
    teamBSubs: string[];
    events: FootballEvent[];
    statsA: FootballStats;
    statsB: FootballStats;
    tossWinner?: string;
    kickOffTeam?: string;
    bestOf?: number;
    gamesWonA?: number;
    gamesWonB?: number;
    gameHistory?: any[];
}

interface FootballScorerProps {
    location: Location;
    user: User;
    onAlert?: (msg: string, type: 'success' | 'error' | 'info') => void;
    onBack?: () => void;
}

const FootballScorer: React.FC<FootballScorerProps> = ({ location: initialLocation, user, onAlert, onBack }) => {
    const { theme } = useTheme();
    const PAGE_ID = `football_scorer_${initialLocation.id}`;
    const savedState = storage.getPageState<any>(PAGE_ID) || {};

    const [matches, setMatches] = useState<FootballMatch[]>([]);
    const [currentMatch, setCurrentMatch] = useState<FootballMatch | null>(savedState.currentMatch || null);
    const [view, setView] = useState<'history' | 'setup' | 'live' | 'review'>(savedState.view || 'history');

    useEffect(() => {
        return forceScrollTop();
    }, [view]);

    // Setup State
    const [teamA, setTeamA] = useState(savedState.teamA || '');
    const [teamB, setTeamB] = useState(savedState.teamB || '');
    const [namingMode, setNamingMode] = useState<'default' | 'custom'>(savedState.namingMode || 'default');
    const [teamASize, setTeamASize] = useState<number>(savedState.teamASize || 11);
    const [teamBSize, setTeamBSize] = useState<number>(savedState.teamBSize || 11);
    const [teamASubsSize, setTeamASubsSize] = useState<number>(savedState.teamASubsSize || 5);
    const [teamBSubsSize, setTeamBSubsSize] = useState<number>(savedState.teamBSubsSize || 5);
    const [teamAPlayers, setTeamAPlayers] = useState<string[]>(savedState.teamAPlayers || []);
    const [teamBPlayers, setTeamBPlayers] = useState<string[]>(savedState.teamBPlayers || []);
    const [teamASubs, setTeamASubs] = useState<string[]>(savedState.teamASubs || []);
    const [teamBSubs, setTeamBSubs] = useState<string[]>(savedState.teamBSubs || []);
    const [bestOf, setBestOf] = useState<number>(savedState.bestOf || 1);

    // Toss State
    const [tossWinner, setTossWinner] = useState<'A' | 'B' | null>(savedState.tossWinner || null);
    const [kickOffTeam, setKickOffTeam] = useState<'A' | 'B' | null>(savedState.kickOffTeam || null);
    const [isCoinSpinning, setIsCoinSpinning] = useState(false);
    const [coinAngle, setCoinAngle] = useState(0);
    const [coinSpinDuration, setCoinSpinDuration] = useState(2.6);
    const [spinKey, setSpinKey] = useState(0);
    const [tossResult, setTossResult] = useState<string | null>(null);

    // Live State
    const [scoreA, setScoreA] = useState(savedState.scoreA || 0);
    const [scoreB, setScoreB] = useState(savedState.scoreB || 0);
    const [period, setPeriod] = useState(savedState.period || 1);
    const [events, setEvents] = useState<FootballEvent[]>(savedState.events || []);
    const [statsA, setStatsA] = useState<FootballStats>(savedState.statsA || { corners: 0, shotsOnTarget: 0, offsides: 0, yellowCards: 0, redCards: 0, freeKicks: 0 });
    const [statsB, setStatsB] = useState<FootballStats>(savedState.statsB || { corners: 0, shotsOnTarget: 0, offsides: 0, yellowCards: 0, redCards: 0, freeKicks: 0 });

    // Series State
    const [showSeriesResult, setShowSeriesResult] = useState(false);
    const [seriesResultData, setSeriesResultData] = useState<{ winner: string, score: string, isFinal: boolean } | null>(null);

    // Timer State
    const [matchTime, setMatchTime] = useState(savedState.matchTime || 0); // Total seconds
    const [isTimerRunning, setIsTimerRunning] = useState(savedState.isTimerRunning || false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const [showRating, setShowRating] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState<{ team: 'A' | 'B', type: 'Goal' | 'YellowCard' | 'RedCard' | 'Substitution', playerOut?: string } | null>(null);

    const syncMatchResult = async (match: FootballMatch) => {
        if (!match.id || match.status !== 'Finished') return;
        try {
            let winnerId = null;
            let loserId = null;

            const challengeId = match.challengeId || (match as any).challenge_id;
            if (!challengeId) return;

            const { data: challenge } = await supabase.from('challenges').select('id, challenger_id, accepted_by').eq('id', challengeId).maybeSingle();
            if (!challenge) return;

            if (match.scoreA > match.scoreB) {
                winnerId = challenge.challenger_id;
                loserId = challenge.accepted_by;
            } else if (match.scoreB > match.scoreA) {
                winnerId = challenge.accepted_by;
                loserId = challenge.challenger_id;
            }

            if (!winnerId || !loserId) {
                console.log('Match is a draw or missing participant IDs, skipping DB sync.');
                return;
            }

            const summary = match.bestOf && match.bestOf > 1
                            ? `${match.teamA} ${match.gamesWonA} - ${match.gamesWonB} ${match.teamB} (Series)`
                            : `${match.teamA} ${match.scoreA} - ${match.scoreB} ${match.teamB}`;

            const { error } = await supabase.from('match_results').insert({
                challenge_id: challenge.id,
                winner_id: winnerId,
                loser_id: loserId,
                score_summary: summary
            });
            if (error) throw error;
            onAlert?.('Match result synced! History updated.', 'success');
        } catch (e) {
            console.error("Sync failed:", e);
            onAlert?.('Failed to sync results to server.', 'error');
        }
    };

    useEffect(() => {
        storage.setPageState(PAGE_ID, {
            currentMatch, view, teamA, teamB, namingMode, teamASize, teamBSize, teamASubsSize, teamBSubsSize,
            teamAPlayers, teamBPlayers, teamASubs, teamBSubs, tossWinner, kickOffTeam, scoreA, scoreB,
            period, events, statsA, statsB, matchTime, isTimerRunning, bestOf
        });
    }, [PAGE_ID, currentMatch, view, teamA, teamB, namingMode, teamASize, teamBSize, teamASubsSize, teamBSubsSize,
        teamAPlayers, teamBPlayers, teamASubs, teamBSubs, tossWinner, kickOffTeam, scoreA, scoreB,
        period, events, statsA, statsB, matchTime, isTimerRunning, bestOf]);

    useEffect(() => {
        if (view === 'setup' && currentMatch) {
            setTeamA(currentMatch.teamA);
            setTeamB(currentMatch.teamB);
            setTeamASize(currentMatch.teamAPlayers.length);
            setTeamBSize(currentMatch.teamBPlayers.length);
            setTeamASubsSize(currentMatch.teamASubs.length);
            setTeamBSubsSize(currentMatch.teamBSubs.length);
            setTeamAPlayers(currentMatch.teamAPlayers);
            setTeamBPlayers(currentMatch.teamBPlayers);
            setTeamASubs(currentMatch.teamASubs);
            setTeamBSubs(currentMatch.teamBSubs);
            if (currentMatch.bestOf) setBestOf(currentMatch.bestOf);
        }
    }, [view, currentMatch]);

    const [supabaseMatches, setSupabaseMatches] = useState<FootballMatch[]>([]);

    useEffect(() => {
        const fetchSupabaseMatches = async () => {
            try {
                const { data, error } = await supabase
                    .from('matches')
                    .select('*')
                    .eq('location_id', initialLocation.id)
                    .ilike('sport', '%Football%')
                    .in('status', ['live', 'not started', 'finished']);

                if (data) {
                    const mapped = data.map(m => {
                        const matchData = (m.match_data || {}) as any;
                        return {
                            ...matchData,
                            id: m.id,
                            challengeId: m.challenge_id,
                            locationId: m.location_id,
                            teamA: m.team_a_name || matchData?.teamA || 'Team A',
                            teamB: m.team_b_name || matchData?.teamB || 'Team B',
                            scoreA: Number(m.score_a) || matchData?.scoreA || 0,
                            scoreB: Number(m.score_b) || matchData?.scoreB || 0,
                            status: m.status === 'not started' ? 'Not Started' : m.status === 'finished' ? 'Finished' : 'Live',
                            createdAt: m.created_at,
                            startTime: m.start_time,
                            endTime: m.end_time,
                            sport: SportType.FOOTBALL,
                            events: matchData?.events || [],
                            statsA: matchData?.statsA || { corners: 0, shotsOnTarget: 0, offsides: 0, yellowCards: 0, redCards: 0, freeKicks: 0 },
                            statsB: matchData?.statsB || { corners: 0, shotsOnTarget: 0, offsides: 0, yellowCards: 0, redCards: 0, freeKicks: 0 },
                            teamAPlayers: matchData?.teamAPlayers || [],
                            teamBPlayers: matchData?.teamBPlayers || [],
                            teamASubs: matchData?.teamASubs || [],
                            teamBSubs: matchData?.teamBSubs || []
                        } as FootballMatch;
                    });
                    setSupabaseMatches(mapped);

                    setCurrentMatch(prev => {
                        if (prev && prev.id) {
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
            .channel(`football_matches_${initialLocation.id}`)
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
        let localMatches: FootballMatch[] = [];
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    localMatches = parsed.map(m => ({
                        ...m,
                        events: m.events || [],
                        statsA: m.statsA || { corners: 0, shotsOnTarget: 0, offsides: 0, yellowCards: 0, redCards: 0, freeKicks: 0 },
                        statsB: m.statsB || { corners: 0, shotsOnTarget: 0, offsides: 0, yellowCards: 0, redCards: 0, freeKicks: 0 },
                        teamAPlayers: m.teamAPlayers || [],
                        teamBPlayers: m.teamBPlayers || [],
                        teamASubs: m.teamASubs || [],
                        teamBSubs: m.teamBSubs || []
                    })).filter(m => m && m.locationId === initialLocation.id);
                }
            } catch (e) {
                console.error("Failed to parse matches:", e);
            }
        }
        const combined = [...supabaseMatches, ...localMatches];
        const unique = Array.from(new Map(combined.filter(m => m && m.id).map(m => [m.id, m])).values());
        setMatches(unique.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, [initialLocation.id, supabaseMatches]);

    useEffect(() => {
        if (isTimerRunning) {
            timerRef.current = setInterval(() => {
                setMatchTime((prev: number) => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [isTimerRunning]);

    const persistCurrentMatch = async (match: FootballMatch) => {
        try {
            setCurrentMatch(match);
            const saved = localStorage.getItem(MATCHES_STORAGE_KEY);
            const all: FootballMatch[] = saved ? JSON.parse(saved) : [];
            const idx = all.findIndex(m => m.id === match.id);
            if (idx !== -1) all[idx] = match;
            else all.unshift(match);
            localStorage.setItem(MATCHES_STORAGE_KEY, JSON.stringify(all));
            setMatches(all.filter(m => m.locationId === initialLocation.id));

            // Supabase sync for challenge-based matches
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(match.id);
            if (isUuid) {
                await supabase.from('matches').update({
                    match_data: match,
                    score_a: match.scoreA.toString(),
                    score_b: match.scoreB.toString(),
                    status: match.status.toLowerCase() === 'halftime' ? 'live' : match.status.toLowerCase(),
                    updated_at: new Date().toISOString()
                }).or(`id.eq.${match.id},challenge_id.eq.${match.id}`);
            }
        } catch (e) {
            console.error(handleError(e));
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
        const isAWinner = randomArray[0] % 2 === 0;
        const winner = isAWinner ? 'A' : 'B';

        // Randomized physical properties for every single flip
        const extraRotations = 7 + Math.floor(Math.random() * 8); // 7 to 15 full rotations
        const landingFaceAngle = isAWinner ? 0 : 180;
        const durationMs = 2800 + Math.random() * 800; // 2.8s to 3.6s

        setCoinSpinDuration(durationMs / 1000);
        setCoinAngle(extraRotations * 360 + landingFaceAngle);

        setTimeout(() => {
            setTossWinner(winner);
            setTossResult(winner === 'A' ? (teamA || 'Home Team') : (teamB || 'Away Team'));
            setIsCoinSpinning(false);
            setKickOffTeam(winner);
        }, durationMs);
    };

    const [showMatchInProgressModal, setShowMatchInProgressModal] = useState(false);

    const handleStartScoringClick = () => {
        if (!teamA || !teamB) {
            onAlert?.("Enter both team names", 'error');
            return;
        }
        if (!tossWinner) {
            onAlert?.("Perform the toss first", 'error');
            return;
        }
        const hasProgress = currentMatch && 'scoreA' in currentMatch && (currentMatch.scoreA > 0 || currentMatch.scoreB > 0 || (currentMatch.events || []).length > 0);
        if (hasProgress) {
            setShowMatchInProgressModal(true);
        } else {
            startMatch('fresh');
        }
    };

    const startMatch = (mode: 'fresh' | 'continue') => {
        if (!teamA || !teamB) {
            onAlert?.("Enter both team names", 'error');
            return;
        }
        if (!tossWinner) {
            onAlert?.("Perform the toss first", 'error');
            return;
        }

        const finalAPlayers = namingMode === 'custom' ? teamAPlayers.slice(0, teamASize) : Array.from({ length: teamASize }, (_, i) => `A Player ${i + 1}`);
        const finalBPlayers = namingMode === 'custom' ? teamBPlayers.slice(0, teamBSize) : Array.from({ length: teamBSize }, (_, i) => `B Player ${i + 1}`);
        const finalASubs = namingMode === 'custom' ? teamASubs.slice(0, teamASubsSize) : Array.from({ length: teamASubsSize }, (_, i) => `A Sub ${i + 1}`);
        const finalBSubs = namingMode === 'custom' ? teamBSubs.slice(0, teamBSubsSize) : Array.from({ length: teamBSubsSize }, (_, i) => `B Sub ${i + 1}`);

        if (mode === 'continue' && currentMatch && 'scoreA' in currentMatch) {
            const updated = { ...currentMatch } as FootballMatch;
            updated.teamA = teamA;
            updated.teamB = teamB;
            updated.teamAPlayers = finalAPlayers;
            updated.teamBPlayers = finalBPlayers;
            updated.teamASubs = finalASubs;
            updated.teamBSubs = finalBSubs;
            persistCurrentMatch(updated);
            resumeMatch(updated);
        } else {
            const matchId = (currentMatch && 'id' in currentMatch && currentMatch.id) ? currentMatch.id : `FB-${Date.now()}`;

            const newMatch: FootballMatch = {
                id: matchId,
                locationId: initialLocation.id,
                teamA, teamB, scoreA: 0, scoreB: 0, period: 1,
                status: 'Live',
                createdAt: new Date().toISOString(),
                sport: SportType.FOOTBALL,
                teamAPlayers: finalAPlayers,
                teamBPlayers: finalBPlayers,
                teamASubs: finalASubs,
                teamBSubs: finalBSubs,
                events: [],
                statsA: { corners: 0, shotsOnTarget: 0, offsides: 0, yellowCards: 0, redCards: 0, freeKicks: 0 },
                statsB: { corners: 0, shotsOnTarget: 0, offsides: 0, yellowCards: 0, redCards: 0, freeKicks: 0 },
                tossWinner: tossWinner === 'A' ? teamA : teamB,
                kickOffTeam: kickOffTeam === 'A' ? teamA : teamB
            };

            persistCurrentMatch(newMatch);
            setScoreA(0); setScoreB(0); setPeriod(1); setEvents([]); setMatchTime(0);
            setStatsA({ corners: 0, shotsOnTarget: 0, offsides: 0, yellowCards: 0, redCards: 0, freeKicks: 0 });
            setStatsB({ corners: 0, shotsOnTarget: 0, offsides: 0, yellowCards: 0, redCards: 0, freeKicks: 0 });
            setView('live');
            setIsTimerRunning(true);
        }
        setShowMatchInProgressModal(false);
    };

    const addEvent = (type: 'Goal' | 'YellowCard' | 'RedCard' | 'Substitution', team: 'A' | 'B', playerName: string, playerNameIn?: string) => {
        const currentMinute = Math.floor(matchTime / 60);
        const standardMinute = period === 1 ? Math.min(45, currentMinute) : Math.min(90, currentMinute);
        const stoppage = currentMinute > standardMinute ? currentMinute - standardMinute : undefined;

        const newEvent: FootballEvent = {
            id: `EV-${Date.now()}`,
            type, team, playerName, playerNameIn,
            minute: standardMinute,
            stoppageMinute: stoppage
        };

        const updatedEvents = [newEvent, ...events];
        setEvents(updatedEvents);

        if (type === 'Goal') {
            if (team === 'A') setScoreA((prev: number) => prev + 1);
            else setScoreB((prev: number) => prev + 1);
        } else if (type === 'YellowCard') {
            if (team === 'A') setStatsA(prev => ({ ...prev, yellowCards: prev.yellowCards + 1 }));
            else setStatsB(prev => ({ ...prev, yellowCards: prev.yellowCards + 1 }));
        } else if (type === 'RedCard') {
            if (team === 'A') setStatsA(prev => ({ ...prev, redCards: prev.redCards + 1 }));
            else setStatsB(prev => ({ ...prev, redCards: prev.redCards + 1 }));
        } else if (type === 'Substitution' && playerNameIn && currentMatch) {
            const updatedMatch = { ...currentMatch };
            if (team === 'A') {
                const outIdx = updatedMatch.teamAPlayers.indexOf(playerName);
                const inIdx = updatedMatch.teamASubs.indexOf(playerNameIn);
                if (outIdx !== -1 && inIdx !== -1) {
                    updatedMatch.teamAPlayers[outIdx] = playerNameIn;
                    updatedMatch.teamASubs[inIdx] = playerName;
                }
            } else {
                const outIdx = updatedMatch.teamBPlayers.indexOf(playerName);
                const inIdx = updatedMatch.teamBSubs.indexOf(playerNameIn);
                if (outIdx !== -1 && inIdx !== -1) {
                    updatedMatch.teamBPlayers[outIdx] = playerNameIn;
                    updatedMatch.teamBSubs[inIdx] = playerName;
                }
            }
            persistCurrentMatch(updatedMatch);
        }

        if (currentMatch) {
            persistCurrentMatch({
                ...currentMatch,
                events: updatedEvents,
                scoreA: team === 'A' && type === 'Goal' ? scoreA + 1 : scoreA,
                scoreB: team === 'B' && type === 'Goal' ? scoreB + 1 : scoreB,
                statsA: team === 'A' ? {
                    ...statsA,
                    yellowCards: type === 'YellowCard' ? statsA.yellowCards + 1 : statsA.yellowCards,
                    redCards: type === 'RedCard' ? statsA.redCards + 1 : statsA.redCards
                } : statsA,
                statsB: team === 'B' ? {
                    ...statsB,
                    yellowCards: type === 'YellowCard' ? statsB.yellowCards + 1 : statsB.yellowCards,
                    redCards: type === 'RedCard' ? statsB.redCards + 1 : statsB.redCards
                } : statsB,
            });
        }
        setSelectedPlayer(null);
    };

    const updateStat = (team: 'A' | 'B', stat: keyof FootballStats, delta: number) => {
        if (team === 'A') {
            const newVal = Math.max(0, statsA[stat] + delta);
            setStatsA(prev => ({ ...prev, [stat]: newVal }));
            if (currentMatch) persistCurrentMatch({ ...currentMatch, statsA: { ...statsA, [stat]: newVal } });
        } else {
            const newVal = Math.max(0, statsB[stat] + delta);
            setStatsB(prev => ({ ...prev, [stat]: newVal }));
            if (currentMatch) persistCurrentMatch({ ...currentMatch, statsB: { ...statsB, [stat]: newVal } });
        }
    };

    const handleFinish = () => {
        if (!currentMatch) return;
        setIsTimerRunning(false);

        const targetGames = bestOf === 1 ? 1 : Math.floor(bestOf / 2) + 1;
        let gA = currentMatch.gamesWonA || 0;
        let gB = currentMatch.gamesWonB || 0;
        const gHistory = [...(currentMatch.gameHistory || []), `${scoreA}-${scoreB}`];

        if (scoreA > scoreB) gA++;
        else if (scoreB > scoreA) gB++;

        if (gA === targetGames || gB === targetGames || bestOf === 1) {
            const updated: FootballMatch = {
                ...currentMatch,
                scoreA, scoreB, period,
                status: 'Finished',
                finishedAt: new Date().toISOString(),
                events, statsA, statsB,
                gamesWonA: gA,
                gamesWonB: gB,
                gameHistory: gHistory
            };
            persistCurrentMatch(updated);
            storage.clearPageState(PAGE_ID);
            syncMatchResult(updated);
            setSeriesResultData({
                winner: gA > gB ? teamA : teamB,
                score: `${gA} - ${gB}`,
                isFinal: true
            });
            setShowSeriesResult(true);
        } else {
            const updated: FootballMatch = {
                ...currentMatch,
                scoreA: 0, scoreB: 0, period: 1,
                gamesWonA: gA,
                gamesWonB: gB,
                gameHistory: gHistory,
                events: [],
                statsA: { corners: 0, shotsOnTarget: 0, offsides: 0, yellowCards: 0, redCards: 0, freeKicks: 0 },
                statsB: { corners: 0, shotsOnTarget: 0, offsides: 0, yellowCards: 0, redCards: 0, freeKicks: 0 }
            };
            persistCurrentMatch(updated);
            setScoreA(0); setScoreB(0); setPeriod(1); setEvents([]); setMatchTime(0);
            setStatsA({ corners: 0, shotsOnTarget: 0, offsides: 0, yellowCards: 0, redCards: 0, freeKicks: 0 });
            setStatsB({ corners: 0, shotsOnTarget: 0, offsides: 0, yellowCards: 0, redCards: 0, freeKicks: 0 });
            setSeriesResultData({
                winner: scoreA > scoreB ? teamA : teamB,
                score: `${gA} - ${gB}`,
                isFinal: false
            });
            setShowSeriesResult(true);
        }
    };

    const resumeMatch = (match: FootballMatch) => {
        const sanitizedStats = { corners: 0, shotsOnTarget: 0, offsides: 0, yellowCards: 0, redCards: 0, freeKicks: 0 };
        setCurrentMatch(match);
        setTeamA(match.teamA);
        setTeamB(match.teamB);
        setScoreA(match.scoreA);
        setScoreB(match.scoreB);
        setPeriod(match.period);
        setEvents(match.events || []);
        setStatsA(match.statsA || sanitizedStats);
        setStatsB(match.statsB || sanitizedStats);
        setView(match.status === 'Finished' ? 'review' : 'live');
        if (match.status === 'Live') setIsTimerRunning(true);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const currentHalfMax = period === 1 ? 45 : 90;

        if (mins >= currentHalfMax) {
            const stoppage = mins - currentHalfMax;
            return `${currentHalfMax}:00 +${stoppage}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const getPlayerName = (team: 'A' | 'B', index: number) => {
        const players = team === 'A' ? currentMatch?.teamAPlayers : currentMatch?.teamBPlayers;
        return players?.[index] || `Player ${index + 1}`;
    };

    return (
        <div className="flex flex-col flex-1 min-h-screen relative overflow-hidden transition-all duration-300"
             style={{ backgroundColor: theme.colors.background }}>
            {/* Background Decor */}
            <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] pointer-events-none opacity-20" style={{ backgroundColor: theme.colors.accent }} />
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] pointer-events-none opacity-20" style={{ backgroundColor: theme.colors.success }} />

            <header className="backdrop-blur-3xl p-4 md:p-6 flex justify-between items-center border-b sticky top-0 z-50 transition-all shadow-theme-card"
                    style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center shadow-theme-elevated"
                         style={{ backgroundColor: theme.colors.accent, color: 'white' }}>
                        <img src="/logo.png" className="w-6 h-6 md:w-7 md:h-7 object-contain" alt="Boxitt" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-black italic tracking-tighter uppercase leading-none" style={{ color: theme.colors.textPrimary }}>Boxitt <span style={{ color: theme.colors.accent }}>Football</span></h1>
                        <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em] mt-1" style={{ color: theme.colors.textDisabled }}>Live Pro Scorer</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 md:gap-4">
                    <ThemeSelector />
                    {view === 'live' && (
                        <button
                            onClick={() => setView('setup')}
                            className="px-5 py-2.5 md:px-6 md:py-3 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all shadow-theme-elevated border"
                            style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border, color: theme.colors.textPrimary }}
                        >
                            Edit
                        </button>
                    )}
                    {(view === 'live' || view === 'review') && (
                        <button
                            onClick={() => setView('history')}
                            className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all border shadow-theme-card"
                            style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border, color: theme.colors.textPrimary }}
                        >
                            <History className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                    )}
                    <button
                        onClick={onBack}
                        className="px-5 py-2.5 md:px-8 md:py-4 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all shadow-theme-elevated active:translate-y-0.5"
                        style={{ backgroundColor: theme.colors.textPrimary, color: theme.colors.background }}
                    >
                        Exit
                    </button>
                </div>
            </header>

            <main className="flex-1 p-6 md:p-10 relative z-10 overflow-hidden max-w-7xl mx-auto w-full">
                <AnimatePresence mode="wait">
                    {view === 'history' && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                            <div className="flex justify-between items-center">
                                <div className="space-y-1">
                                    <h2 className="text-xs font-black uppercase tracking-[0.4em] text-text-disabled">{initialLocation.name}</h2>
                                    <div className="flex items-center gap-2 text-accent">
                                        <History className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Match Archives</span>
                                    </div>
                                </div>
                                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setView('setup')}
                                               className="bg-accent text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 transition-all">
                                    <Plus className="w-4 h-4" /> New Session
                                </motion.button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {matches.length === 0 ? (
                                    <div className="py-20 text-center bg-card/30 rounded-3xl border-2 border-dashed border-border/50 col-span-full">
                                        <p className="font-black uppercase text-[10px] tracking-[0.4em] text-text-disabled">No match records in database</p>
                                    </div>
                                ) : (
                                    matches.map((m, idx) => (
                                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} key={m.id}
                                                    className="p-8 md:p-10 border border-border bg-card rounded-2xl shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-text-disabled">
                                                    <Timer className="w-3 h-3" />
                                                    {m.startTime ? (() => {
                                                        const formatTimeStr = (iso: string) => {
                                                            const d = new Date(iso);
                                                            let hours = d.getHours();
                                                            const minutes = String(d.getMinutes()).padStart(2, '0');
                                                            const ampm = hours >= 12 ? 'PM' : 'AM';
                                                            hours = hours % 12 || 12;
                                                            return `${hours}:${minutes} ${ampm}`;
                                                        };
                                                        const formatDateStr = (iso: string) => {
                                                            const d = new Date(iso);
                                                            const day = String(d.getDate()).padStart(2, '0');
                                                            const month = String(d.getMonth() + 1).padStart(2, '0');
                                                            return `${day}/${month}/${d.getFullYear()}`;
                                                        };
                                                        if (m.endTime) return `${formatTimeStr(m.startTime)} - ${formatTimeStr(m.endTime)} • ${formatDateStr(m.startTime)}`;
                                                        return `${formatTimeStr(m.startTime)} • ${formatDateStr(m.startTime)}`;
                                                    })() : new Date(m.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                  <span className="text-[10px] font-black uppercase tracking-widest opacity-40">FOOTBALL</span>
                                                  <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${m.status === 'Live' ? 'bg-accent text-white animate-pulse' : 'bg-text-disabled/10 text-text-disabled'}`}>
                                                      {m.status}
                                                  </span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 items-center gap-8 mb-10">
                                                <div className="text-center">
                                                    <p className="text-lg md:text-xl font-black uppercase italic mb-2 line-clamp-2 break-words">{m.teamA}</p>
                                                    <p className="text-4xl md:text-5xl font-black italic text-accent">{m.scoreA}</p>
                                                </div>
                                                <div className="flex flex-col items-center">
                                                  <div className="w-12 h-12 rounded-full border-2 flex items-center justify-center shadow-theme-card bg-background-secondary border-border">
                                                     <span className="text-xs font-black italic opacity-40 text-accent">VS</span>
                                                  </div>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-lg md:text-xl font-black uppercase italic mb-2 line-clamp-2 break-words">{m.teamB}</p>
                                                    <p className="text-4xl md:text-5xl font-black italic text-accent">{m.scoreB}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-4">
                                                {m.status?.toLowerCase() === 'live' && (
                                                    <button
                                                        onClick={() => {
                                                            setCurrentMatch(m);
                                                            setTeamA(m.teamA);
                                                            setTeamB(m.teamB);
                                                            setTeamAPlayers(m.teamAPlayers);
                                                            setTeamBPlayers(m.teamBPlayers);
                                                            setView('setup');
                                                        }}
                                                        className="w-14 h-14 rounded-xl bg-background-secondary border border-border flex items-center justify-center hover:border-accent transition-all shadow-sm"
                                                    >
                                                        <Settings className="w-6 h-6 text-text-secondary" />
                                                    </button>
                                                )}
                                                <button onClick={() => resumeMatch(m)} className="flex-1 py-4 bg-text-primary text-background rounded-xl font-black uppercase tracking-widest hover:bg-accent hover:text-white transition-all shadow-theme-elevated flex items-center justify-center gap-3 text-xs md:text-sm">
                                                    {m.status === 'Finished' ? <Trophy className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                                                    {m.status === 'Finished' ? 'View Final Report' : 'Resume Live Session'}
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}

                    {view === 'setup' && (
                        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="max-w-4xl mx-auto py-6 space-y-8">
                            <div className="text-center">
                                <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter text-text-primary">Match <span className="text-accent">Initialization</span></h2>
                                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-text-disabled mt-1">Configure teams and toss</p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="bg-card p-6 border border-border rounded-[2rem] shadow-xl space-y-6">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-[9px] font-black uppercase tracking-widest ml-1 text-text-disabled">Home Team</label>
                                                <input value={teamA} onChange={e => setTeamA(e.target.value)} placeholder="Home Team Name"
                                                    className="w-full p-3 bg-background-secondary border-2 border-transparent focus:border-accent rounded-xl font-bold outline-none transition-all uppercase text-sm" />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-black uppercase tracking-widest ml-1 text-text-disabled">Away Team</label>
                                                <input value={teamB} onChange={e => setTeamB(e.target.value)} placeholder="Away Team Name"
                                                    className="w-full p-3 bg-background-secondary border-2 border-transparent focus:border-accent rounded-xl font-bold outline-none transition-all uppercase text-sm" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                            <div>
                                                <label className="text-[9px] font-black uppercase tracking-widest ml-1 text-text-disabled">Squad A Size</label>
                                                <input type="number" value={teamASize} onChange={e => setTeamASize(parseInt(e.target.value) || 0)}
                                                    className="w-full p-2.5 bg-background-secondary rounded-lg font-bold outline-none text-sm" />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-black uppercase tracking-widest ml-1 text-text-disabled">Subs A Size</label>
                                                <input type="number" value={teamASubsSize} onChange={e => setTeamASubsSize(parseInt(e.target.value) || 0)}
                                                    className="w-full p-2.5 bg-background-secondary rounded-lg font-bold outline-none text-sm" />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-black uppercase tracking-widest ml-1 text-text-disabled">Squad B Size</label>
                                                <input type="number" value={teamBSize} onChange={e => setTeamBSize(parseInt(e.target.value) || 0)}
                                                    className="w-full p-2.5 bg-background-secondary rounded-lg font-bold outline-none text-sm" />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-black uppercase tracking-widest ml-1 text-text-disabled">Subs B Size</label>
                                                <input type="number" value={teamBSubsSize} onChange={e => setTeamBSubsSize(parseInt(e.target.value) || 0)}
                                                    className="w-full p-2.5 bg-background-secondary rounded-lg font-bold outline-none text-sm" />
                                            </div>
                                        </div>

                                        <div className="p-1 rounded-xl bg-background-secondary flex border border-border">
                                            <button onClick={() => setNamingMode('default')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${namingMode === 'default' ? 'bg-text-primary text-background shadow-lg' : 'text-text-disabled'}`}>Auto Names</button>
                                            <button onClick={() => setNamingMode('custom')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${namingMode === 'custom' ? 'bg-text-primary text-background shadow-lg' : 'text-text-disabled'}`}>Custom Squad</button>
                                        </div>
                                    </div>

                                    {namingMode === 'custom' && (
                                        <div className="grid grid-cols-2 gap-4 max-h-[300px] overflow-y-auto no-scrollbar p-1">
                                            <div className="space-y-3">
                                                <h4 className="text-[8px] font-black uppercase tracking-widest text-accent">Team A Players</h4>
                                                <div className="space-y-1.5">
                                                    {Array.from({ length: teamASize }).map((_, i) => (
                                                        <input key={`a-${i}`} value={teamAPlayers[i] || ''} onChange={e => { const n = [...teamAPlayers]; n[i] = e.target.value; setTeamAPlayers(n); }}
                                                            placeholder={`A Player ${i+1}`} className="w-full p-2 bg-card border border-border rounded-lg text-[11px] font-bold" />
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <h4 className="text-[8px] font-black uppercase tracking-widest text-accent">Team B Players</h4>
                                                <div className="space-y-1.5">
                                                    {Array.from({ length: teamBSize }).map((_, i) => (
                                                        <input key={`b-${i}`} value={teamBPlayers[i] || ''} onChange={e => { const n = [...teamBPlayers]; n[i] = e.target.value; setTeamBPlayers(n); }}
                                                            placeholder={`B Player ${i+1}`} className="w-full p-2 bg-card border border-border rounded-lg text-[11px] font-bold" />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-6">
                                    <div className="bg-card p-6 border border-border rounded-[2rem] shadow-xl space-y-6 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 blur-[60px] rounded-full bg-accent/10 pointer-events-none" />

                                        <div className="flex justify-between items-center relative z-10">
                                            <h3 className="text-[10px] font-black uppercase tracking-widest text-text-disabled">Kick-off Toss</h3>
                                            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleToss} disabled={isCoinSpinning}
                                                className="px-4 py-2 bg-amber-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 disabled:opacity-50">
                                                <RotateCcw className={`w-3 h-3 ${isCoinSpinning ? 'animate-spin' : ''}`} /> {isCoinSpinning ? 'Spinning...' : 'Spin Coin'}
                                            </motion.button>
                                        </div>

                                        <div className="flex flex-col items-center justify-center py-2 relative z-10">
                                            <div style={{ perspective: '1000px' }}>
                                                <motion.div key={spinKey}
                                                    initial={{ rotateY: 0, y: 0, scale: 1 }}
                                                    animate={{
                                                        rotateY: coinAngle,
                                                        scale: isCoinSpinning ? [1, 1.1, 1] : 1,
                                                        y: isCoinSpinning ? [0, -40, 0] : 0,
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
                                                    className="w-20 h-24 relative" style={{ transformStyle: 'preserve-3d' }}>
                                                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border-4 border-amber-300 flex items-center justify-center shadow-2xl"
                                                         style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(0deg) translateZ(1px)' }}>
                                                        <Trophy className="w-8 h-8 text-amber-900/50" />
                                                    </div>
                                                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-4 border-blue-300 flex items-center justify-center shadow-2xl"
                                                         style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg) translateZ(1px)' }}>
                                                        <Activity className="w-8 h-8 text-blue-900/50" />
                                                    </div>
                                                </motion.div>
                                            </div>

                                            <AnimatePresence mode="wait">
                                                {tossResult && tossResult !== 'flipping' && (
                                                    <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} className="mt-4 text-center">
                                                        <p className="text-[8px] font-black uppercase tracking-[0.4em] text-accent mb-1">Toss Won By</p>
                                                        <h4 className="text-lg font-black italic uppercase text-text-primary">{tossResult}</h4>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        <div className="pt-4 border-t border-border/50 space-y-4">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[8px] font-black uppercase tracking-widest text-text-disabled ml-1">Series Format</span>
                                                <div className="flex gap-2">
                                                    {[1, 3, 5, 7].map(num => (
                                                        <button key={num} onClick={() => setBestOf(num)}
                                                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black transition-all border ${bestOf === num ? 'bg-accent text-white border-accent shadow-sm' : 'border-border text-text-disabled hover:border-accent/30'}`}>
                                                            B of {num}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button onClick={() => setKickOffTeam('A')} className={`py-2.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${kickOffTeam === 'A' ? 'bg-accent text-white shadow-lg' : 'bg-background-secondary text-text-disabled'}`}>{teamA || 'Team Alpha'} Starts</button>
                                                <button onClick={() => setKickOffTeam('B')} className={`py-2.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${kickOffTeam === 'B' ? 'bg-accent text-white shadow-lg' : 'bg-background-secondary text-text-disabled'}`}>{teamB || 'Team Beta'} Starts</button>
                                            </div>
                                        </div>
                                    </div>

                                    <button onClick={handleStartScoringClick}
                                        className="w-full py-4 bg-accent text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl flex items-center justify-center gap-3">
                                        <Play className="w-4 h-4 fill-current" /> Initialize Match
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {view === 'live' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-20">
                            <div className="flex justify-end mb-4">
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
                            {/* PROFESSIONAL HUD */}
                            <div className="bg-slate-950 rounded-[2rem] border-4 border-slate-900 shadow-2xl overflow-hidden relative">
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />

                                <div className="bg-slate-900/80 backdrop-blur-md px-6 py-3 flex justify-between items-center border-b border-white/5">
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col">
                                            <span className="text-[7px] font-black uppercase tracking-[0.4em] text-slate-500">Live Clock</span>
                                            <span className="text-lg font-black text-white italic tracking-tighter tabular-nums">{formatTime(matchTime)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setIsTimerRunning(!isTimerRunning)} className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${isTimerRunning ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                                                {isTimerRunning ? <XCircle className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                            </button>
                                            <button onClick={() => setMatchTime(0)} className="w-7 h-7 rounded-full flex items-center justify-center bg-white/5 text-white/40 hover:text-white transition-all">
                                                <RotateCcw className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <span className="text-[7px] font-black uppercase tracking-[0.4em] text-slate-500">Period</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-accent uppercase tracking-widest">
                                                    {matchTime >= 5400 ? 'Full Time' : matchTime >= 2700 ? '2nd Half' : '1st Half'}
                                                </span>
                                                <div className="flex gap-0.5">
                                                    <button onClick={() => setPeriod(1)} className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${period === 1 ? 'bg-accent text-white' : 'bg-white/5 text-white/40'}`}>H1</button>
                                                    <button onClick={() => setPeriod(2)} className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${period === 2 ? 'bg-accent text-white' : 'bg-white/5 text-white/40'}`}>H2</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 md:p-10 grid grid-cols-3 items-center relative z-10">
                                    <div className="text-center space-y-3">
                                        <div className="flex justify-center gap-0.5 mb-1">
                                            {Array.from({ length: statsA.yellowCards }).map((_, i) => <div key={i} className="w-1 h-2 bg-yellow-400 rounded-sm shadow-[0_0_8px_rgba(250,204,21,0.5)]" />)}
                                            {Array.from({ length: statsA.redCards }).map((_, i) => <div key={i} className="w-1 h-2 bg-red-500 rounded-sm shadow-[0_0_8px_rgba(239,68,68,0.5)]" />)}
                                        </div>
                                        <h3 className="text-sm md:text-base font-black uppercase tracking-tighter text-white line-clamp-2 break-words mx-auto px-2">{teamA}</h3>
                                        <motion.div key={scoreA} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                            className="text-6xl md:text-8xl font-black italic tracking-tighter text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]">
                                            {scoreA}
                                        </motion.div>
                                    </div>

                                    <div className="flex flex-col items-center">
                                        <div className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mb-4 backdrop-blur-xl">
                                            <span className="text-[10px] font-black italic text-accent tracking-[0.2em]">VS</span>
                                        </div>
                                        <div className="h-12 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent" />
                                    </div>

                                    <div className="text-center space-y-3">
                                        <div className="flex justify-center gap-0.5 mb-1">
                                            {Array.from({ length: statsB.yellowCards }).map((_, i) => <div key={i} className="w-1 h-2 bg-yellow-400 rounded-sm shadow-[0_0_8px_rgba(250,204,21,0.5)]" />)}
                                            {Array.from({ length: statsB.redCards }).map((_, i) => <div key={i} className="w-1 h-2 bg-red-500 rounded-sm shadow-[0_0_8px_rgba(239,68,68,0.5)]" />)}
                                        </div>
                                        <h3 className="text-sm md:text-base font-black uppercase tracking-tighter text-white line-clamp-2 break-words mx-auto px-2">{teamB}</h3>
                                        <motion.div key={scoreB} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                            className="text-6xl md:text-8xl font-black italic tracking-tighter text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]">
                                            {scoreB}
                                        </motion.div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* TACTICAL CONTROLS */}
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        {/* Team A Controls */}
                                        <div className="bg-card p-6 border border-border rounded-[2.5rem] space-y-5 shadow-xl relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-2 h-full bg-accent opacity-20" />
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-accent truncate max-w-[120px]">{teamA}</span>
                                                <Users className="w-4 h-4 text-text-disabled" />
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <button onClick={() => setSelectedPlayer({ team: 'A', type: 'Goal' })}
                                                    className="col-span-2 py-5 bg-accent text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] transition-all">
                                                    <Trophy className="w-4 h-4" /> Add Goal
                                                </button>
                                                <button onClick={() => setSelectedPlayer({ team: 'A', type: 'YellowCard' })} className="py-4 bg-yellow-400/10 text-yellow-600 border border-yellow-400/20 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-yellow-400 hover:text-white transition-all">Yellow</button>
                                                <button onClick={() => setSelectedPlayer({ team: 'A', type: 'RedCard' })} className="py-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Red Card</button>
                                                <button onClick={() => setSelectedPlayer({ team: 'A', type: 'Substitution' })} className="col-span-2 py-4 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-500 hover:text-white transition-all">
                                                    <ArrowRightLeft className="w-3.5 h-3.5" /> Substitution
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 pt-4 border-t border-border/50">
                                                <button onClick={() => updateStat('A', 'corners', 1)} className="flex items-center justify-between px-4 py-3 bg-background-secondary rounded-xl group">
                                                    <div className="flex items-center gap-2">
                                                        <Flag className="w-3.5 h-3.5 text-text-disabled group-hover:text-accent transition-colors" />
                                                        <span className="text-[9px] font-black uppercase text-text-disabled">Corners</span>
                                                    </div>
                                                    <span className="text-xs font-black text-text-primary">{statsA.corners}</span>
                                                </button>
                                                <button onClick={() => updateStat('A', 'shotsOnTarget', 1)} className="flex items-center justify-between px-4 py-3 bg-background-secondary rounded-xl group">
                                                    <div className="flex items-center gap-2">
                                                        <Target className="w-3.5 h-3.5 text-text-disabled group-hover:text-accent transition-colors" />
                                                        <span className="text-[9px] font-black uppercase text-text-disabled">Shots</span>
                                                    </div>
                                                    <span className="text-xs font-black text-text-primary">{statsA.shotsOnTarget}</span>
                                                </button>
                                                <button onClick={() => updateStat('A', 'offsides', 1)} className="flex items-center justify-between px-4 py-3 bg-background-secondary rounded-xl group">
                                                    <div className="flex items-center gap-2">
                                                        <Activity className="w-3.5 h-3.5 text-text-disabled group-hover:text-accent transition-colors" />
                                                        <span className="text-[9px] font-black uppercase text-text-disabled">Offside</span>
                                                    </div>
                                                    <span className="text-xs font-black text-text-primary">{statsA.offsides}</span>
                                                </button>
                                                <button onClick={() => updateStat('A', 'freeKicks', 1)} className="flex items-center justify-between px-4 py-3 bg-background-secondary rounded-xl group">
                                                    <div className="flex items-center gap-2">
                                                        <ShieldAlert className="w-3.5 h-3.5 text-text-disabled group-hover:text-accent transition-colors" />
                                                        <span className="text-[9px] font-black uppercase text-text-disabled">Freekick</span>
                                                    </div>
                                                    <span className="text-xs font-black text-text-primary">{statsA.freeKicks}</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Team B Controls */}
                                        <div className="bg-card p-6 border border-border rounded-[2.5rem] space-y-5 shadow-xl relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-2 h-full bg-accent opacity-20" />
                                            <div className="flex items-center justify-between mb-2">
                                                <Users className="w-4 h-4 text-text-disabled" />
                                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-accent truncate max-w-[120px] text-right">{teamB}</span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <button onClick={() => setSelectedPlayer({ team: 'B', type: 'Goal' })}
                                                    className="col-span-2 py-5 bg-accent text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] transition-all">
                                                    <Trophy className="w-4 h-4" /> Add Goal
                                                </button>
                                                <button onClick={() => setSelectedPlayer({ team: 'B', type: 'YellowCard' })} className="py-4 bg-yellow-400/10 text-yellow-600 border border-yellow-400/20 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-yellow-400 hover:text-white transition-all">Yellow</button>
                                                <button onClick={() => setSelectedPlayer({ team: 'B', type: 'RedCard' })} className="py-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Red Card</button>
                                                <button onClick={() => setSelectedPlayer({ team: 'B', type: 'Substitution' })} className="col-span-2 py-4 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-500 hover:text-white transition-all">
                                                    <ArrowRightLeft className="w-3.5 h-3.5" /> Substitution
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 pt-4 border-t border-border/50">
                                                <button onClick={() => updateStat('B', 'corners', 1)} className="flex items-center justify-between px-4 py-3 bg-background-secondary rounded-xl group">
                                                    <div className="flex items-center gap-2">
                                                        <Flag className="w-3.5 h-3.5 text-text-disabled group-hover:text-accent transition-colors" />
                                                        <span className="text-[9px] font-black uppercase text-text-disabled">Corners</span>
                                                    </div>
                                                    <span className="text-xs font-black text-text-primary">{statsB.corners}</span>
                                                </button>
                                                <button onClick={() => updateStat('B', 'shotsOnTarget', 1)} className="flex items-center justify-between px-4 py-3 bg-background-secondary rounded-xl group">
                                                    <div className="flex items-center gap-2">
                                                        <Target className="w-3.5 h-3.5 text-text-disabled group-hover:text-accent transition-colors" />
                                                        <span className="text-[9px] font-black uppercase text-text-disabled">Shots</span>
                                                    </div>
                                                    <span className="text-xs font-black text-text-primary">{statsB.shotsOnTarget}</span>
                                                </button>
                                                <button onClick={() => updateStat('B', 'offsides', 1)} className="flex items-center justify-between px-4 py-3 bg-background-secondary rounded-xl group">
                                                    <div className="flex items-center gap-2">
                                                        <Activity className="w-3.5 h-3.5 text-text-disabled group-hover:text-accent transition-colors" />
                                                        <span className="text-[9px] font-black uppercase text-text-disabled">Offside</span>
                                                    </div>
                                                    <span className="text-xs font-black text-text-primary">{statsB.offsides}</span>
                                                </button>
                                                <button onClick={() => updateStat('B', 'freeKicks', 1)} className="flex items-center justify-between px-4 py-3 bg-background-secondary rounded-xl group">
                                                    <div className="flex items-center gap-2">
                                                        <ShieldAlert className="w-3.5 h-3.5 text-text-disabled group-hover:text-accent transition-colors" />
                                                        <span className="text-[9px] font-black uppercase text-text-disabled">Freekick</span>
                                                    </div>
                                                    <span className="text-xs font-black text-text-primary">{statsB.freeKicks}</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-xl">
                                        <div className="flex items-center justify-between mb-6">
                                            <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-text-disabled flex items-center gap-3">
                                                <ListOrdered className="w-5 h-5 text-accent" /> Match Timeline
                                            </h4>
                                            <div className="px-3 py-1 bg-background-secondary rounded-full text-[8px] font-black uppercase tracking-widest text-text-disabled">Live Log</div>
                                        </div>
                                        <div className="space-y-4 max-h-[400px] overflow-y-auto no-scrollbar pr-4">
                                            {events.length === 0 ? (
                                                <div className="py-20 text-center opacity-20 flex flex-col items-center gap-4">
                                                    <History className="w-12 h-12" />
                                                    <p className="text-[10px] font-black uppercase tracking-[0.5em]">Waiting for match action</p>
                                                </div>
                                            ) : (
                                                (events || []).filter(ev => ev).map((ev, i) => (
                                                    <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} key={ev.id}
                                                        className={`flex items-center gap-5 p-5 rounded-[1.5rem] border-2 transition-all ${
                                                            ev.type === 'Goal' ? 'bg-accent/5 border-accent/20' :
                                                            ev.type === 'Substitution' ? 'bg-blue-500/5 border-blue-500/20' :
                                                            'bg-background-secondary border-border'
                                                        }`}>
                                                        <div className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-card border border-border shadow-sm">
                                                            <span className="text-lg font-black italic text-accent">{ev.minute}'</span>
                                                            {ev.stoppageMinute && <span className="text-[9px] font-bold text-text-disabled mt-[-4px]">+{ev.stoppageMinute}</span>}
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-[9px] font-black uppercase text-text-disabled tracking-widest mb-1">{ev.team === 'A' ? teamA : teamB}</p>
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-sm font-black uppercase text-text-primary">{ev.playerName}</span>
                                                                {ev.type === 'Substitution' && (
                                                                    <>
                                                                        <ArrowRightLeft className="w-3 h-3 text-blue-500" />
                                                                        <span className="text-sm font-black uppercase text-blue-500">{ev.playerNameIn}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3 px-4 py-2 bg-card rounded-xl border border-border shadow-sm">
                                                            {ev.type === 'Goal' && <Trophy className="w-4 h-4 text-accent" />}
                                                            {ev.type === 'YellowCard' && <div className="w-3 h-4 bg-yellow-400 rounded-sm shadow-[0_0_8px_rgba(250,204,21,0.5)]" />}
                                                            {ev.type === 'RedCard' && <div className="w-3 h-4 bg-red-500 rounded-sm shadow-[0_0_8px_rgba(239,68,68,0.5)]" />}
                                                            {ev.type === 'Substitution' && <ArrowRightLeft className="w-4 h-4 text-blue-500" />}
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-text-primary">{ev.type}</span>
                                                        </div>
                                                    </motion.div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* SIDEBAR METRICS */}
                                <div className="space-y-6">
                                    <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-8 space-y-8 shadow-2xl relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 blur-[60px] rounded-full bg-accent/5" />
                                        <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-500 flex items-center gap-3">
                                            <Activity className="w-5 h-5 text-accent" /> Density Metrics
                                        </h4>
                                        <div className="space-y-6">
                                            {[
                                                { label: 'Corners', valA: statsA.corners, valB: statsB.corners, icon: Flag },
                                                { label: 'Shots on Target', valA: statsA.shotsOnTarget, valB: statsB.shotsOnTarget, icon: Target },
                                                { label: 'Offsides', valA: statsA.offsides, valB: statsB.offsides, icon: Activity },
                                                { label: 'Free Kicks', valA: statsA.freeKicks, valB: statsB.freeKicks, icon: ShieldAlert }
                                            ].map((m, i) => (
                                                <div key={i} className="space-y-3">
                                                    <div className="flex justify-between items-center text-[10px] font-black uppercase text-white/60 tracking-widest">
                                                        <span className="text-white text-sm italic">{m.valA}</span>
                                                        <span className="flex items-center gap-2 opacity-40"><m.icon className="w-3.5 h-3.5" /> {m.label}</span>
                                                        <span className="text-white text-sm italic">{m.valB}</span>
                                                    </div>
                                                    <div className="h-2 bg-white/5 rounded-full overflow-hidden flex shadow-inner">
                                                        <motion.div initial={{ width: 0 }} animate={{ width: `${(m.valA / Math.max(1, m.valA + m.valB)) * 100}%` }}
                                                            className="h-full bg-accent" />
                                                        <motion.div initial={{ width: 0 }} animate={{ width: `${(m.valB / Math.max(1, m.valA + m.valB)) * 100}%` }}
                                                            className="h-full bg-slate-700" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-card border-2 border-border rounded-[2.5rem] p-8 space-y-6 shadow-xl relative overflow-hidden group">
                                        <div className="absolute inset-0 bg-red-500/0 group-hover:bg-red-500/5 transition-colors duration-500" />
                                        <div className="flex items-center justify-between relative z-10">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                                                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-text-primary">Match Protocol</span>
                                            </div>
                                            <ShieldAlert className="w-5 h-5 text-red-500/30" />
                                        </div>
                                        <button onClick={handleFinish} className="w-full py-5 bg-red-500 text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-[11px] shadow-lg shadow-red-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 relative z-10">
                                            <CheckCircle2 className="w-5 h-5" /> End Match Official
                                        </button>
                                        <p className="text-[9px] font-black uppercase text-center text-text-disabled tracking-[0.3em] relative z-10">Verification Required</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {view === 'review' && currentMatch && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-5xl mx-auto pb-20">
                            <div className="bg-slate-950 rounded-[2.5rem] p-10 text-center relative overflow-hidden shadow-2xl border-4 border-slate-900">
                                <div className="absolute top-0 right-0 w-80 h-80 blur-[100px] rounded-full bg-accent/10" />

                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12 }}
                                    className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-accent/30 shadow-[0_0_40px_rgba(255,59,48,0.2)]">
                                    <Trophy className="w-10 h-10 text-accent" />
                                </motion.div>

                                <h2 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-white mb-2">Match <span className="text-accent">Summary</span></h2>
                                <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-500 mb-4">Official Performance Certificate</p>
                                <div className="mb-8 flex justify-center">
                                    <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        {(() => {
                                            const m = currentMatch as any;
                                            if (m.startTime) {
                                                const d = new Date(m.startTime);
                                                const datePart = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                                                const formatT = (date: Date) => {
                                                    let h = date.getHours();
                                                    const min = String(date.getMinutes()).padStart(2, '0');
                                                    const a = h >= 12 ? 'PM' : 'AM';
                                                    h = h % 12 || 12;
                                                    return `${h}:${min} ${a}`;
                                                };
                                                if (m.endTime) return `${formatT(d)} - ${formatT(new Date(m.endTime))} • ${datePart}`;
                                                return `${formatT(d)} • ${datePart}`;
                                            }
                                            return new Date(currentMatch.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
                                        })()}
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 items-center gap-4 md:gap-8 mb-12 relative z-10">
                                    <div className="flex-1 space-y-3 text-center">
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest truncate">{teamA}</p>
                                        <div className="text-6xl md:text-7xl font-black italic tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                                            {bestOf > 1 ? currentMatch.gamesWonA : scoreA}
                                        </div>
                                        <div className="h-1.5 w-12 bg-accent rounded-full mx-auto" />
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">{bestOf > 1 ? 'Games Won' : 'Final Score'}</p>
                                    </div>

                                    <div className="flex flex-col items-center">
                                        <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center bg-white/5">
                                            <span className="text-xs font-black italic text-accent/40">VS</span>
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-3 text-center">
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest truncate">{teamB}</p>
                                        <div className="text-6xl md:text-7xl font-black italic tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                                            {bestOf > 1 ? currentMatch.gamesWonB : scoreB}
                                        </div>
                                        <div className="h-1.5 w-12 bg-accent rounded-full mx-auto" />
                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">{bestOf > 1 ? 'Games Won' : 'Final Score'}</p>
                                    </div>
                                </div>

                                {bestOf > 1 && currentMatch.gameHistory && (
                                    <div className="mt-12 flex justify-center gap-3 overflow-x-auto no-scrollbar pb-2">
                                        {currentMatch.gameHistory.map((gh, i) => (
                                            <div key={i} className="flex-shrink-0 px-5 py-3 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center min-w-[100px] backdrop-blur-sm">
                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter mb-1.5">Game {i+1}</span>
                                                <span className="text-[11px] font-black text-accent italic tracking-tighter uppercase">{gh}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="bg-card border border-border rounded-[2.5rem] p-10 space-y-10 shadow-xl">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-black uppercase tracking-[0.4em] text-accent flex items-center gap-3"><Activity className="w-5 h-5" /> Team Analytics</h3>
                                        <div className="text-[10px] font-bold text-text-disabled">Final Statistics</div>
                                    </div>
                                    <div className="space-y-8">
                                        {[
                                            { label: 'Total Corners', valA: statsA.corners, valB: statsB.corners },
                                            { label: 'Shots on Target', valA: statsA.shotsOnTarget, valB: statsB.shotsOnTarget },
                                            { label: 'Offsides', valA: statsA.offsides, valB: statsB.offsides },
                                            { label: 'Free Kicks', valA: statsA.freeKicks, valB: statsB.freeKicks },
                                            { label: 'Discipline (Yellow)', valA: statsA.yellowCards, valB: statsB.yellowCards },
                                            { label: 'Discipline (Red)', valA: statsA.redCards, valB: statsB.redCards }
                                        ].map((s, i) => (
                                            <div key={i} className="space-y-3">
                                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-text-disabled">
                                                    <span className="text-text-primary text-base italic">{s.valA}</span>
                                                    <span>{s.label}</span>
                                                    <span className="text-text-primary text-base italic">{s.valB}</span>
                                                </div>
                                                <div className="h-2.5 bg-background-secondary rounded-full overflow-hidden flex shadow-inner">
                                                    <motion.div initial={{ width: 0 }} animate={{ width: `${(s.valA / Math.max(1, s.valA + s.valB)) * 100}%` }} className="h-full bg-accent" />
                                                    <motion.div initial={{ width: 0 }} animate={{ width: `${(s.valB / Math.max(1, s.valA + s.valB)) * 100}%` }} className="h-full bg-text-primary/20" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-card border border-border rounded-[2.5rem] p-10 space-y-8 shadow-xl flex flex-col">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-black uppercase tracking-[0.4em] text-accent flex items-center gap-3"><History className="w-5 h-5" /> Detailed Event Log</h3>
                                        <div className="text-[10px] font-bold text-text-disabled">Full 90' Timeline</div>
                                    </div>
                                    <div className="space-y-4 flex-1 overflow-y-auto no-scrollbar max-h-[500px] pr-4">
                                        {(events || []).filter(ev => ev).map((ev, i) => (
                                            <div key={i} className="flex items-center gap-6 p-4 rounded-2xl border border-border/50 bg-background-secondary/30">
                                                <div className="text-lg font-black italic text-accent w-12">{ev.minute}'</div>
                                                <div className="flex-1">
                                                    <p className="text-[8px] font-black uppercase text-text-disabled tracking-widest">{ev.team === 'A' ? teamA : teamB}</p>
                                                    <p className="text-sm font-black uppercase text-text-primary">
                                                        {ev.playerName}
                                                        {ev.type === 'Substitution' && <span className="text-blue-500 mx-2">➔ {ev.playerNameIn}</span>}
                                                    </p>
                                                </div>
                                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-card border border-border">
                                                    {ev.type === 'Goal' && <Trophy className="w-5 h-5 text-accent" />}
                                                    {ev.type === 'YellowCard' && <div className="w-3 h-4 bg-yellow-400 rounded-sm" />}
                                                    {ev.type === 'RedCard' && <div className="w-3 h-4 bg-red-500 rounded-sm" />}
                                                    {ev.type === 'Substitution' && <ArrowRightLeft className="w-4 h-4 text-blue-500" />}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <button onClick={() => setView('history')} className="w-full py-8 bg-text-primary text-background rounded-[2rem] font-black uppercase tracking-[0.4em] text-sm shadow-2xl flex items-center justify-center gap-4 hover:scale-[1.01] active:translate-y-1 transition-all">
                                <History className="w-6 h-6" /> Return to Archives
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* PLAYER SELECTION MODAL */}
            <AnimatePresence>
                {selectedPlayer && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-6">
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                            className="bg-card border border-border w-full max-w-xl rounded-[3rem] p-12 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-2 bg-accent opacity-50" />

                            <h3 className="text-3xl font-black italic uppercase text-text-primary mb-8 flex items-center gap-4">
                                {selectedPlayer.type === 'Goal' && <Trophy className="w-8 h-8 text-accent" />}
                                {selectedPlayer.type === 'YellowCard' && <div className="w-5 h-7 bg-yellow-400 rounded-sm shadow-lg" />}
                                {selectedPlayer.type === 'RedCard' && <div className="w-5 h-7 bg-red-500 rounded-sm shadow-lg" />}
                                {selectedPlayer.type === 'Substitution' && <ArrowRightLeft className="w-8 h-8 text-blue-500" />}
                                {selectedPlayer.type === 'Substitution' ? (selectedPlayer.playerOut ? 'Select Incoming Player' : 'Select Outgoing Player') : 'Select Player'}
                            </h3>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto no-scrollbar pr-2 mb-10">
                                {selectedPlayer.type === 'Substitution' ? (
                                    selectedPlayer.playerOut ? (
                                        // Incoming Players (Subs)
                                        (selectedPlayer.team === 'A' ? currentMatch?.teamASubs : currentMatch?.teamBSubs)?.filter(p => p).map((p, i) => (
                                            <button key={i} onClick={() => addEvent('Substitution', selectedPlayer.team, selectedPlayer.playerOut!, p)}
                                                className="py-5 px-3 bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-white border border-blue-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                                                {p}
                                            </button>
                                        ))
                                    ) : (
                                        // Outgoing Players (Starters)
                                        (selectedPlayer.team === 'A' ? currentMatch?.teamAPlayers : currentMatch?.teamBPlayers)?.filter(p => p).map((p, i) => (
                                            <button key={i} onClick={() => setSelectedPlayer({ ...selectedPlayer, playerOut: p })}
                                                className="py-5 px-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                                                {p}
                                            </button>
                                        ))
                                    )
                                ) : (
                                    (selectedPlayer.team === 'A' ? currentMatch?.teamAPlayers : currentMatch?.teamBPlayers)?.filter(p => p).map((p, i) => (
                                        <button key={i} onClick={() => addEvent(selectedPlayer.type as any, selectedPlayer.team, p)}
                                            className="py-5 px-3 bg-background-secondary hover:bg-accent border border-border hover:border-accent text-text-primary hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
                                            {p}
                                        </button>
                                    ))
                                )}
                            </div>
                            <button onClick={() => setSelectedPlayer(null)} className="w-full py-4 text-text-disabled font-black uppercase text-[10px] tracking-[0.4em] hover:text-text-primary transition-colors">Cancel Operation</button>
                        </motion.div>
                    </motion.div>
                )}

                {showMatchInProgressModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xl p-6">
                        <motion.div initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 50 }}
                                    className="border border-border rounded-[2rem] w-full max-w-sm p-10 text-center bg-card shadow-2xl transition-all">
                           <div className="w-16 h-16 bg-accent/20 text-accent rounded-full flex items-center justify-center mx-auto mb-6"><Settings className="w-8 h-8" /></div>
                           <h3 className="text-2xl font-black mb-4 uppercase italic tracking-tighter text-text-primary">Match In Progress</h3>
                           <p className="text-sm opacity-70 mb-8 text-text-primary">An active session already has recorded scores/progress. Would you like to continue it with your settings or clear it?</p>
                           <div className="space-y-4">
                              <motion.button whileHover={{ scale: 1.02 }} onClick={() => startMatch('continue')} className="w-full py-4 bg-accent text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-md">Continue Session</motion.button>
                              <motion.button whileHover={{ scale: 1.02 }} onClick={() => startMatch('fresh')} className="w-full py-4 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-md">Reset & Start New</motion.button>
                              <button onClick={() => setShowMatchInProgressModal(false)} className="w-full py-2 font-black uppercase text-[10px] tracking-widest transition-colors text-text-disabled">Cancel</button>
                           </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showSeriesResult && seriesResultData && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 md:p-6">
                    <motion.div initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 50 }}
                                className="border rounded-[2.5rem] w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
                                style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
                       <div className="absolute top-0 right-0 w-48 h-48 blur-[100px] rounded-full opacity-10" style={{ backgroundColor: theme.colors.accent }} />

                       <div className="relative z-10 flex flex-col p-8 md:p-10 overflow-hidden">
                         <div className="overflow-y-auto no-scrollbar pr-1">
                           <div className="w-16 h-16 bg-accent/20 text-accent rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner rotate-12 flex-shrink-0">
                              <Trophy className="w-8 h-8" />
                           </div>

                           <h3 className="text-3xl md:text-4xl font-black mb-1 uppercase italic tracking-tighter text-center" style={{ color: theme.colors.textPrimary }}>
                              {seriesResultData.isFinal ? 'Series ' : 'Game '}<span style={{ color: theme.colors.accent }}>{seriesResultData.isFinal ? 'Won!' : 'Over!'}</span>
                           </h3>
                           <p className="text-[9px] font-black uppercase tracking-[0.5em] text-text-disabled mb-8 text-center">Official Classification</p>

                           <div className="bg-background-secondary/50 rounded-3xl p-6 mb-8 border border-border/50 backdrop-blur-md relative overflow-hidden">
                              <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent pointer-events-none" />
                              <p className="text-[9px] font-black uppercase text-accent tracking-[0.3em] mb-6 relative z-10 text-center">Series Standings</p>

                              <div className="flex items-center justify-between gap-2 relative z-10">
                                 <div className="flex-1 space-y-2 text-center">
                                    <p className="text-[9px] font-black uppercase text-text-disabled truncate px-1">{teamA}</p>
                                    <div className="text-5xl md:text-6xl font-black italic tracking-tighter text-text-primary drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                                       {seriesResultData.score.split('-')[0].trim()}
                                    </div>
                                    <div className="h-1 w-10 bg-accent rounded-full mx-auto" />
                                 </div>

                                 <div className="flex flex-col items-center">
                                    <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center bg-background shadow-sm">
                                       <span className="text-[10px] font-black italic opacity-20">VS</span>
                                    </div>
                                 </div>

                                 <div className="flex-1 space-y-2 text-center">
                                    <p className="text-[9px] font-black uppercase text-text-disabled truncate px-1">{teamB}</p>
                                    <div className="text-5xl md:text-6xl font-black italic tracking-tighter text-text-primary drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                                       {seriesResultData.score.split('-')[1].trim()}
                                    </div>
                                    <div className="h-1 w-10 bg-accent rounded-full mx-auto" />
                                 </div>
                              </div>
                           </div>

                           {currentMatch && currentMatch.gameHistory && currentMatch.gameHistory.length > 0 && (
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

            {showRating && <RatingModal matchId={currentMatch?.id || `FB-${Date.now()}`} locationId={initialLocation.id} user={user} onClose={() => setShowRating(false)} />}
        </div>
    );
};

export default FootballScorer;

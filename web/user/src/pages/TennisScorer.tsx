import React, { useState, useEffect } from 'react';
import { Location, User, SportType } from '../types';
import RatingModal from '../components/RatingModal';
import { storage } from '../services/storage';
import { supabase } from '../services/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, History, Play, CheckCircle2, Timer, XCircle, Plus, Swords, Settings, RotateCcw, Users, Target } from 'lucide-react';
import { handleError } from '../services/errorHandler';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeSelector } from '../components/ThemeSelector';
import { forceScrollTop } from '../utils/scroll';

const MATCHES_STORAGE_KEY = 'tennis_matches';

interface PlayerStats {
    aces: number;
    winners: number;
    unforcedErrors: number;
    doubleFaults: number;
    firstServesIn: number;
    firstServesTotal: number;
}

interface TennisMatch {
    id: string;
    locationId: string;
    challengeId?: string;
    playerA: string;
    playerB: string;
    pointsA: number;
    pointsB: number;
    isAdA: boolean;
    isAdB: boolean;
    gamesA: number;
    gamesB: number;
    setsA: number;
    setsB: number;
    status: 'Live' | 'Finished' | 'Not Started';
    createdAt: string;
    finishedAt?: string;
    startTime?: string;
    endTime?: string;
    sport: SportType.TENNIS;
    tossWinner?: string;
    tossDecision?: 'Serve' | 'Receive';
    setFormat: number;
    setHistory: { gamesA: number; gamesB: number }[];
    statsA: PlayerStats;
    statsB: PlayerStats;
    currentServer: 'A' | 'B';
}

interface TennisScorerProps {
    location: Location;
    user: User;
    onAlert?: (msg: string, type: 'success' | 'error' | 'info') => void;
    onBack?: () => void;
}

const TennisScorer: React.FC<TennisScorerProps> = ({ location: initialLocation, user, onAlert, onBack }) => {
    const { theme } = useTheme();
    const PAGE_ID = `tennis_scorer_${initialLocation.id}`;
    const savedState = storage.getPageState<any>(PAGE_ID) || {};

    const [matches, setMatches] = useState<TennisMatch[]>([]);
    const [currentMatch, setCurrentMatch] = useState<TennisMatch | null>(savedState.currentMatch || null);
    const [view, setView] = useState<'history' | 'setup' | 'live' | 'review'>(savedState.view || 'history');

    useEffect(() => {
        return forceScrollTop();
    }, [view]);

    const [playerA, setPlayerA] = useState(savedState.playerA || 'Player A');
    const [playerB, setPlayerB] = useState(savedState.playerB || 'Player B');
    const [pointsA, setPointsA] = useState(savedState.pointsA || 0);
    const [pointsB, setPointsB] = useState(savedState.pointsB || 0);
    const [isAdA, setIsAdA] = useState(savedState.isAdA || false);
    const [isAdB, setIsAdB] = useState(savedState.isAdB || false);
    const [gamesA, setGamesA] = useState(savedState.gamesA || 0);
    const [gamesB, setGamesB] = useState(savedState.gamesB || 0);
    const [setsA, setSetsA] = useState(savedState.setsA || 0);
    const [setsB, setSetsB] = useState(savedState.setsB || 0);

    // Toss System State
    const [tossWinner, setTossWinner] = useState<'A' | 'B' | null>(savedState.tossWinner || null);
    const [tossDecision, setTossDecision] = useState<'Serve' | 'Receive' | null>(savedState.tossDecision || null);
    const [coinAngle, setCoinAngle] = useState(0);
    const [coinSpinDuration, setCoinSpinDuration] = useState(2.6);
    const [isCoinSpinning, setIsCoinSpinning] = useState(false);
    const [tossResult, setTossResult] = useState<string | null>(null);
    const [spinKey, setSpinKey] = useState(0);

    // Advanced Setup
    const [namingMode, setNamingMode] = useState<'auto' | 'custom'>(savedState.namingMode || 'auto');
    const [setFormat, setSetFormat] = useState<3 | 5 | 7>(savedState.setFormat || 3);
    const [showStartMatchConfirm, setShowStartMatchConfirm] = useState(false);

    // Match Stats
    const initialStats: PlayerStats = { aces: 0, winners: 0, unforcedErrors: 0, doubleFaults: 0, firstServesIn: 0, firstServesTotal: 0 };
    const [statsA, setStatsA] = useState<PlayerStats>(savedState.statsA || initialStats);
    const [statsB, setStatsB] = useState<PlayerStats>(savedState.statsB || initialStats);
    const [setHistory, setSetHistory] = useState<{ gamesA: number; gamesB: number }[]>(savedState.setHistory || []);
    const [currentServer, setCurrentServer] = useState<'A' | 'B'>(savedState.currentServer || 'A');
    const [isSecondServe, setIsSecondServe] = useState(savedState.isSecondServe || false);

    const [showRating, setShowRating] = useState(false);
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [showSeriesResult, setShowSeriesResult] = useState(false);
    const [seriesResultData, setSeriesResultData] = useState<{ winner: string, score: string, isFinal: boolean } | null>(null);

    const syncMatchResult = async (match: TennisMatch) => {
        if (!match.id || match.status !== 'Finished') return;
        try {
            let winnerId = null;
            let loserId = null;

            const challengeId = match.challengeId || (match as any).challenge_id;
            if (!challengeId) return;

            const { data: challenge } = await supabase.from('challenges').select('id, challenger_id, accepted_by').eq('id', challengeId).maybeSingle();
            if (!challenge) return;

            if (match.setsA > match.setsB) {
                winnerId = challenge.challenger_id;
                loserId = challenge.accepted_by;
            } else if (match.setsB > match.setsA) {
                winnerId = challenge.accepted_by;
                loserId = challenge.challenger_id;
            }

            if (!winnerId || !loserId) {
                console.log('Match is a draw or missing participant IDs, skipping DB sync.');
                return;
            }

            const { error } = await supabase.from('match_results').insert({
                challenge_id: challenge.id,
                winner_id: winnerId,
                loser_id: loserId,
                score_summary: `${match.playerA} ${match.setsA} - ${match.setsB} ${match.playerB}`
            });
            if (error) throw error;
            onAlert?.('Match result synced!', 'success');
        } catch (e) {
            console.error("Sync failed:", e);
        }
    };

    useEffect(() => {
        storage.setPageState(PAGE_ID, {
            currentMatch, view, playerA, playerB, pointsA, pointsB, isAdA, isAdB, gamesA, gamesB, setsA, setsB,
            tossWinner, tossDecision, namingMode, setFormat, statsA, statsB, setHistory, currentServer, isSecondServe
        });
    }, [PAGE_ID, currentMatch, view, playerA, playerB, pointsA, pointsB, isAdA, isAdB, gamesA, gamesB, setsA, setsB,
        tossWinner, tossDecision, namingMode, setFormat, statsA, statsB, setHistory, currentServer, isSecondServe]);

    useEffect(() => {
        if (view === 'setup' && currentMatch) {
            setPlayerA(currentMatch.playerA);
            setPlayerB(currentMatch.playerB);
            if (currentMatch.setFormat) setSetFormat(currentMatch.setFormat as 3 | 5 | 7);
        }
    }, [view, currentMatch]);

    const [supabaseMatches, setSupabaseMatches] = useState<TennisMatch[]>([]);

    useEffect(() => {
        const fetchSupabaseMatches = async () => {
            try {
                const { data, error } = await supabase
                    .from('matches')
                    .select('*')
                    .eq('location_id', initialLocation.id)
                    .ilike('sport', '%Tennis%')
                    .in('status', ['live', 'not started', 'finished']);

                if (data) {
                    const mapped = data.map(m => {
                        const matchData = (m.match_data || {}) as any;
                        return {
                            ...matchData,
                            id: m.id,
                            challengeId: m.challenge_id,
                            locationId: m.location_id,
                            playerA: m.team_a_name || matchData?.playerA || 'Player A',
                            playerB: m.team_b_name || matchData?.playerB || 'Player B',
                            status: m.status === 'not started' ? 'Not Started' : m.status === 'finished' ? 'Finished' : 'Live',
                            createdAt: m.created_at,
                            startTime: m.start_time,
                            endTime: m.end_time,
                            sport: SportType.TENNIS,
                            statsA: matchData?.statsA || initialStats,
                            statsB: matchData?.statsB || initialStats,
                            setHistory: matchData?.setHistory || [],
                            pointsA: matchData?.pointsA || 0,
                            pointsB: matchData?.pointsB || 0,
                            gamesA: matchData?.gamesA || 0,
                            gamesB: matchData?.gamesB || 0,
                            setsA: matchData?.setsA || 0,
                            setsB: matchData?.setsB || 0,
                            isAdA: matchData?.isAdA || false,
                            isAdB: matchData?.isAdB || false,
                            currentServer: matchData?.currentServer || 'A'
                        } as TennisMatch;
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
            .channel(`tennis_matches_${initialLocation.id}`)
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
        let localMatches: TennisMatch[] = [];
        try {
            const saved = localStorage.getItem(MATCHES_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    localMatches = parsed.map(m => ({
                        ...m,
                        statsA: m.statsA || initialStats,
                        statsB: m.statsB || initialStats,
                        setHistory: m.setHistory || [],
                        pointsA: m.pointsA || 0,
                        pointsB: m.pointsB || 0,
                        gamesA: m.gamesA || 0,
                        gamesB: m.gamesB || 0,
                        setsA: m.setsA || 0,
                        setsB: m.setsB || 0,
                        isAdA: m.isAdA || false,
                        isAdB: m.isAdB || false,
                        currentServer: m.currentServer || 'A'
                    })).filter(m => m && m.locationId === initialLocation.id);
                }
            }
        } catch (e) {
            console.error(handleError(e));
        }
        const combined = [...supabaseMatches, ...localMatches];
        const unique = Array.from(new Map(combined.filter(m => m && m.id).map(m => [m.id, m])).values());
        setMatches(unique.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, [initialLocation.id, supabaseMatches]);

    const persistCurrentMatch = async (match: TennisMatch) => {
        try {
            setCurrentMatch(match);
            const saved = localStorage.getItem(MATCHES_STORAGE_KEY);
            const all: TennisMatch[] = saved ? JSON.parse(saved) : [];
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
                    score_a: `${match.setsA} (${match.gamesA})`,
                    score_b: `${match.setsB} (${match.gamesB})`,
                    status: match.status.toLowerCase(),
                    updated_at: new Date().toISOString()
                }).or(`id.eq.${match.id},challenge_id.eq.${match.id}`);
            }
        } catch (e) {
            console.error(handleError(e));
        }
    };

    const formatPoints = (p: number, isAd: boolean) => {
        if (isAd) return 'AD';
        if (p === 0) return '0';
        if (p === 1) return '15';
        if (p === 2) return '30';
        if (p === 3) return '40';
        return '40';
    };

    const resumeMatch = (m: TennisMatch) => {
        setCurrentMatch(m);
        setPlayerA(m.playerA || 'Player A'); setPlayerB(m.playerB || 'Player B');
        setPointsA(m.pointsA || 0); setPointsB(m.pointsB || 0);
        setIsAdA(m.isAdA || false); setIsAdB(m.isAdB || false);
        setGamesA(m.gamesA || 0); setGamesB(m.gamesB || 0);
        setSetsA(m.setsA || 0); setSetsB(m.setsB || 0);
        setStatsA(m.statsA || initialStats); setStatsB(m.statsB || initialStats);
        setSetHistory(m.setHistory || []);
        setCurrentServer(m.currentServer || 'A');
        setSetFormat((m.setFormat as 3 | 5) || 3);
        setView('live');
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
            setTossResult(winner === 'A' ? (playerA || 'Player A') : (playerB || 'Player B'));
            setTossWinner(winner);
            setIsCoinSpinning(false);
        }, durationMs);
    };

    const winSet = (p: 'A' | 'B', currentMatchObj: TennisMatch) => {
        let sA = currentMatchObj.setsA;
        let sB = currentMatchObj.setsB;
        const newHistory = [...setHistory, { gamesA: currentMatchObj.gamesA, gamesB: currentMatchObj.gamesB }];
        setSetHistory(newHistory);

        const targetSets = Math.floor(currentMatchObj.setFormat / 2) + 1;

        if (p === 'A') {
            sA += 1;
            setSetsA(sA);
            if (sA === targetSets) {
                const updated = { ...currentMatchObj, setsA: sA, status: 'Finished' as const, finishedAt: new Date().toISOString(), setHistory: newHistory };
                persistCurrentMatch(updated);
                storage.clearPageState(PAGE_ID);
                syncMatchResult(updated);
                setSeriesResultData({
                    winner: playerA,
                    score: `${sA} - ${sB}`,
                    isFinal: true
                });
                setShowSeriesResult(true);
                return;
            }
        } else {
            sB += 1;
            setSetsB(sB);
            if (sB === targetSets) {
                const updated = { ...currentMatchObj, setsB: sB, status: 'Finished' as const, finishedAt: new Date().toISOString(), setHistory: newHistory };
                persistCurrentMatch(updated);
                storage.clearPageState(PAGE_ID);
                syncMatchResult(updated);
                setSeriesResultData({
                    winner: playerB,
                    score: `${sA} - ${sB}`,
                    isFinal: true
                });
                setShowSeriesResult(true);
                return;
            }
        }
        persistCurrentMatch({ ...currentMatchObj, setsA: sA, setsB: sB, gamesA: 0, gamesB: 0, setHistory: newHistory });
        setGamesA(0); setGamesB(0);
        setSeriesResultData({
            winner: p === 'A' ? playerA : playerB,
            score: `${sA} - ${sB}`,
            isFinal: false
        });
        setShowSeriesResult(true);
    };

    const winGame = (p: 'A' | 'B', currentMatchObj: TennisMatch) => {
        let gA = currentMatchObj.gamesA;
        let gB = currentMatchObj.gamesB;
        setPointsA(0); setPointsB(0); setIsAdA(false); setIsAdB(false);
        setCurrentServer(currentServer === 'A' ? 'B' : 'A');
        setIsSecondServe(false);

        if (p === 'A') {
            gA += 1; setGamesA(gA);
            if (gA >= 6 && gA - gB >= 2) { winSet('A', { ...currentMatchObj, gamesA: gA, pointsA: 0, pointsB: 0, isAdA: false, isAdB: false }); return; }
        } else {
            gB += 1; setGamesB(gB);
            if (gB >= 6 && gB - gA >= 2) { winSet('B', { ...currentMatchObj, gamesB: gB, pointsA: 0, pointsB: 0, isAdA: false, isAdB: false }); return; }
        }
        persistCurrentMatch({ ...currentMatchObj, gamesA: gA, gamesB: gB, pointsA: 0, pointsB: 0, isAdA: false, isAdB: false, currentServer: currentServer === 'A' ? 'B' : 'A' });
    };

    const handlePoint = (player: 'A' | 'B', outcome?: 'Winner' | 'Unforced Error' | 'Ace') => {
        if (!currentMatch) return;

        // Update stats
        if (outcome) {
            const updateStats = (s: PlayerStats) => ({
                ...s,
                winners: outcome === 'Winner' ? s.winners + 1 : s.winners,
                unforcedErrors: outcome === 'Unforced Error' ? s.unforcedErrors + 1 : s.unforcedErrors,
                aces: outcome === 'Ace' ? s.aces + 1 : s.aces,
            });
            if (player === 'A') setStatsA(updateStats(statsA));
            else setStatsB(updateStats(statsB));

            if (outcome === 'Ace') {
                const sUpdate = (s: PlayerStats) => ({ ...s, firstServesIn: s.firstServesIn + 1, firstServesTotal: s.firstServesTotal + 1 });
                if (currentServer === 'A') setStatsA(sUpdate(statsA));
                else setStatsB(sUpdate(statsB));
            }
        }

        let nextMatch = { ...currentMatch, pointsA, pointsB, isAdA, isAdB, gamesA, gamesB, setsA, setsB, statsA, statsB, currentServer };
        if (player === 'A') {
            if (isAdB) { setIsAdB(false); nextMatch.isAdB = false; persistCurrentMatch(nextMatch); return; }
            if (pointsA === 3 && pointsB < 3) { winGame('A', nextMatch); return; }
            if (pointsA === 3 && pointsB === 3) { if (isAdA) { winGame('A', nextMatch); return; } setIsAdA(true); nextMatch.isAdA = true; persistCurrentMatch(nextMatch); return; }
            const nextP = pointsA + 1; setPointsA(nextP); nextMatch.pointsA = nextP;
        } else {
            if (isAdA) { setIsAdA(false); nextMatch.isAdA = false; persistCurrentMatch(nextMatch); return; }
            if (pointsB === 3 && pointsA < 3) { winGame('B', nextMatch); return; }
            if (pointsB === 3 && pointsA === 3) { if (isAdB) { winGame('B', nextMatch); return; } setIsAdB(true); nextMatch.isAdB = true; persistCurrentMatch(nextMatch); return; }
            const nextP = pointsB + 1; setPointsB(nextP); nextMatch.pointsB = nextP;
        }
        persistCurrentMatch(nextMatch);
    };

    const handleServe = (result: 'In' | 'Fault') => {
        const updateServeStats = (s: PlayerStats) => ({
            ...s,
            firstServesIn: !isSecondServe && result === 'In' ? s.firstServesIn + 1 : s.firstServesIn,
            firstServesTotal: !isSecondServe ? s.firstServesTotal + 1 : s.firstServesTotal,
            doubleFaults: isSecondServe && result === 'Fault' ? s.doubleFaults + 1 : s.doubleFaults
        });

        if (currentServer === 'A') setStatsA(updateServeStats(statsA));
        else setStatsB(updateServeStats(statsB));

        if (result === 'In') {
            setIsSecondServe(false);
        } else {
            if (isSecondServe) {
                // Double Fault - Point to opponent
                handlePoint(currentServer === 'A' ? 'B' : 'A');
                setIsSecondServe(false);
            } else {
                setIsSecondServe(true);
            }
        }
    };

    const [showMatchInProgressModal, setShowMatchInProgressModal] = useState(false);

    const handleStartScoringClick = () => {
        if (!playerA || !playerB) { onAlert?.("Enter both player names", 'error'); return; }
        if (!tossWinner || !tossDecision) { onAlert?.("Complete toss protocol", 'error'); return; }

        const hasProgress = currentMatch && 'pointsA' in currentMatch && (currentMatch.pointsA > 0 || currentMatch.pointsB > 0 || currentMatch.gamesA > 0 || currentMatch.gamesB > 0 || currentMatch.setsA > 0 || currentMatch.setsB > 0 || (currentMatch.setHistory || []).length > 0);
        if (hasProgress) {
            setShowMatchInProgressModal(true);
        } else {
            startMatch('fresh');
        }
    };

    const startMatch = (mode: 'fresh' | 'continue') => {
        if (!playerA || !playerB) { onAlert?.("Enter both player names", 'error'); return; }
        if (!tossWinner || !tossDecision) { onAlert?.("Complete toss protocol", 'error'); return; }

        const server = (tossWinner === 'A' && tossDecision === 'Serve') || (tossWinner === 'B' && tossDecision === 'Receive') ? 'A' : 'B';

        if (mode === 'continue' && currentMatch && 'pointsA' in currentMatch) {
            const updated = { ...currentMatch } as TennisMatch;
            updated.playerA = playerA;
            updated.playerB = playerB;
            updated.setFormat = setFormat;
            persistCurrentMatch(updated);
            resumeMatch(updated);
        } else {
            const matchId = (currentMatch && 'id' in currentMatch && currentMatch.id) ? currentMatch.id : `TN-${Date.now()}`;

            const newMatch: TennisMatch = {
                id: matchId,
                locationId: initialLocation.id,
                playerA, playerB,
                pointsA: 0, pointsB: 0,
                isAdA: false, isAdB: false,
                gamesA: 0, gamesB: 0,
                setsA: 0, setsB: 0,
                status: 'Live',
                createdAt: new Date().toISOString(),
                sport: SportType.TENNIS,
                tossWinner: tossWinner === 'A' ? playerA : playerB,
                tossDecision,
                setFormat,
                setHistory: [],
                statsA: initialStats,
                statsB: initialStats,
                currentServer: server
            };

            setStatsA(initialStats); setStatsB(initialStats); setSetHistory([]); setCurrentServer(server); setIsSecondServe(false);
            persistCurrentMatch(newMatch); setPointsA(0); setPointsB(0); setIsAdA(false); setIsAdB(false); setGamesA(0); setGamesB(0); setSetsA(0); setSetsB(0); setView('live');
        }
        setShowMatchInProgressModal(false);
    };

    return (
        <div className="flex flex-col flex-1 min-h-screen relative overflow-hidden transition-colors duration-300"
            style={{ backgroundColor: theme.colors.background }}>
            {/* Background Decor */}
            <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] pointer-events-none opacity-20" style={{ backgroundColor: theme.colors.accent }} />
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] pointer-events-none opacity-20" style={{ backgroundColor: theme.colors.success }} />

            <header className="backdrop-blur-3xl p-4 md:p-6 flex justify-between items-center border-b sticky top-0 z-50 transition-all shadow-theme-card"
                style={{ backgroundColor: `${theme.colors.card}80`, borderColor: theme.colors.border }}>
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg"
                        style={{ backgroundColor: theme.colors.accent, color: 'white' }}>
                        <img src="/logo.png" className="w-6 h-6 md:w-7 md:h-7 object-contain" alt="Boxitt" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-black italic tracking-tighter uppercase leading-none" style={{ color: theme.colors.textPrimary }}>Boxitt <span style={{ color: theme.colors.accent }}>Tennis</span></h1>
                        <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em] mt-1" style={{ color: theme.colors.textDisabled }}>Live Scoreboard</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 md:gap-4">
                    <ThemeSelector />
                    {view === 'live' && (
                        <button
                            onClick={() => setView('setup')}
                            className="px-5 py-2.5 md:px-6 md:py-3 rounded-lg md:rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all shadow-md border"
                            style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border, color: theme.colors.textPrimary }}
                        >
                            Edit
                        </button>
                    )}
                    {view === 'live' && (
                        <button onClick={() => setView('history')} className="w-10 h-10 md:w-12 md:h-12 bg-white/5 rounded-lg md:rounded-xl flex items-center justify-center hover:bg-white/10 transition-all border border-white/10"><History className="w-5 h-5 md:w-6 md:h-6" /></button>
                    )}
                    <button onClick={onBack} className="px-4 py-2 md:px-6 md:py-3 rounded-lg md:rounded-xl text-xs md:text-sm font-black uppercase tracking-widest hover:opacity-80 transition-all shadow-md" style={{ backgroundColor: theme.colors.textPrimary, color: theme.colors.background }}>Exit</button>
                </div>
            </header>

            <main className="flex-1 p-6 md:p-10 relative z-10 overflow-hidden max-w-5xl mx-auto w-full">
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
                                                  <span className="text-[10px] font-black uppercase tracking-widest opacity-40">TENNIS</span>
                                                  <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${m.status === 'Live' ? 'bg-accent text-white animate-pulse' : 'bg-text-disabled/10 text-text-disabled'}`}>
                                                      {m.status}
                                                  </span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 items-center gap-8 mb-10">
                                                <div className="text-center">
                                                    <p className="text-lg md:text-xl font-black uppercase italic mb-2 line-clamp-2 break-words">{m.playerA}</p>
                                                    <div className="flex flex-col items-center">
                                                      <p className="text-4xl md:text-5xl font-black italic text-accent">{m.setsA}</p>
                                                      <p className="text-[9px] font-black uppercase text-text-disabled tracking-widest mt-1">Sets</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-center">
                                                  <div className="w-12 h-12 rounded-full border-2 flex items-center justify-center shadow-theme-card bg-background-secondary border-border">
                                                     <span className="text-xs font-black italic opacity-40 text-accent">VS</span>
                                                  </div>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-lg md:text-xl font-black uppercase italic mb-2 line-clamp-2 break-words">{m.playerB}</p>
                                                    <div className="flex flex-col items-center">
                                                      <p className="text-4xl md:text-5xl font-black italic text-accent">{m.setsB}</p>
                                                      <p className="text-[9px] font-black uppercase text-text-disabled tracking-widest mt-1">Sets</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-4">
                                                {m.status?.toLowerCase() === 'live' && (
                                                    <button
                                                        onClick={() => {
                                                            setCurrentMatch(m);
                                                            setPlayerA(m.playerA);
                                                            setPlayerB(m.playerB);
                                                            setSetFormat(m.setFormat as 3 | 5);
                                                            setView('setup');
                                                        }}
                                                        className="w-14 h-14 rounded-xl bg-background-secondary border border-border flex items-center justify-center hover:border-accent transition-all shadow-sm"
                                                    >
                                                        <Settings className="w-6 h-6 text-text-secondary" />
                                                    </button>
                                                )}
                                                <button onClick={() => resumeMatch(m)} className="flex-1 py-4 bg-text-primary text-background rounded-xl font-black uppercase tracking-widest hover:bg-accent hover:text-white transition-all shadow-theme-elevated flex items-center justify-center gap-3 text-xs md:text-sm">
                                                    {m.status === 'Finished' ? <Trophy className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                                                    {m.status === 'Finished' ? 'Final Scorecard' : 'Resume Pro Session'}
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
                                <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter text-text-primary">Match <span className="text-accent">Protocol</span></h2>
                                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-text-disabled mt-1">Initialize Identification & Toss</p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="bg-card p-6 border border-border rounded-[2rem] shadow-xl space-y-6">
                                        <div className="flex p-1 bg-background-secondary rounded-xl">
                                            <button onClick={() => setNamingMode('auto')} className={`flex-1 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${namingMode === 'auto' ? 'bg-accent text-white shadow-lg' : 'text-text-disabled'}`}>Auto Names</button>
                                            <button onClick={() => setNamingMode('custom')} className={`flex-1 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${namingMode === 'custom' ? 'bg-accent text-white shadow-lg' : 'text-text-disabled'}`}>Custom Names</button>
                                        </div>

                                        {namingMode === 'custom' ? (
                                            <div className="space-y-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black uppercase tracking-widest ml-1 text-text-disabled">Contender Alpha</label>
                                                    <input value={playerA} onChange={e => setPlayerA(e.target.value)} placeholder="Player A Name"
                                                        className="w-full p-3 bg-background-secondary border-2 border-transparent focus:border-accent rounded-xl font-bold outline-none transition-all text-sm" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-black uppercase tracking-widest ml-1 text-text-disabled">Contender Beta</label>
                                                    <input value={playerB} onChange={e => setPlayerB(e.target.value)} placeholder="Player B Name"
                                                        className="w-full p-3 bg-background-secondary border-2 border-transparent focus:border-accent rounded-xl font-bold outline-none transition-all text-sm" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="py-6 text-center opacity-30">
                                                <Users className="w-10 h-10 mx-auto text-text-disabled" />
                                                <p className="text-[8px] font-black uppercase tracking-widest mt-2">Default Identifiers Active</p>
                                            </div>
                                        )}

                                        <div className="space-y-2 pt-4 border-t border-border/50">
                                            <label className="text-[9px] font-black uppercase tracking-widest ml-1 text-text-disabled">Series Format</label>
                                            <div className="flex gap-3">
                                                {[3, 5, 7].map(num => (
                                                    <button key={num} onClick={() => setSetFormat(num as any)} className={`flex-1 py-3 rounded-xl border-2 font-black uppercase text-[9px] tracking-widest transition-all ${setFormat === num ? 'border-accent bg-accent/5 text-accent' : 'border-border text-text-disabled'}`}>Best of {num}</button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="bg-card p-8 border border-border rounded-3xl shadow-2xl space-y-8 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 blur-[80px] rounded-full bg-accent/5 pointer-events-none" />

                                        <div className="flex justify-between items-center relative z-10">
                                            <label className="text-[10px] font-black uppercase tracking-[0.4em] text-text-disabled">Match Toss</label>
                                            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleToss}
                                                disabled={isCoinSpinning}
                                                className="px-5 py-2 bg-accent text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 transition-all disabled:opacity-50">
                                                <RotateCcw className={`w-3.5 h-3.5 ${isCoinSpinning ? 'animate-spin' : ''}`} /> {isCoinSpinning ? 'Flipping...' : 'Spin Coin'}
                                            </motion.button>
                                        </div>

                                        <div className="flex flex-col items-center justify-center py-4">
                                            <div className="relative" style={{ width: '100px', height: '100px', transformStyle: 'preserve-3d', perspective: '1000px' }}>
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
                                                    className="w-full h-full"
                                                    style={{ transformStyle: 'preserve-3d' }}>
                                                    {/* Front Face - Host */}
                                                    <div className="absolute inset-0 rounded-full flex flex-col items-center justify-center font-black shadow-2xl border-[6px]"
                                                         style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', background: 'linear-gradient(145deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)', borderColor: '#fcd34d', transform: 'rotateY(0deg) translateZ(1px)' }}>
                                                      <Trophy className="w-8 h-8 text-amber-900 opacity-80" strokeWidth={3} />
                                                    </div>
                                                    {/* Back Face - Visitor */}
                                                    <div className="absolute inset-0 rounded-full flex flex-col items-center justify-center font-black shadow-2xl border-[6px]"
                                                         style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', background: 'linear-gradient(145deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)', borderColor: '#60a5fa', transform: 'rotateY(180deg) translateZ(1px)' }}>
                                                      <Target className="w-8 h-8 text-blue-950 opacity-80" strokeWidth={3} />
                                                    </div>
                                                </motion.div>
                                            </div>

                                            <AnimatePresence mode="wait">
                                                {tossResult && tossResult !== 'flipping' && (
                                                    <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} className="mt-6 text-center">
                                                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-success mb-1">Toss Won By</p>
                                                        <h4 className="text-xl font-black uppercase text-text-primary italic">{tossResult}</h4>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        {tossWinner && (
                                            <div className="space-y-4 pt-4 border-t border-border/50">
                                                <label className="text-[9px] font-black uppercase tracking-widest ml-1 text-text-disabled">Winner Decision</label>
                                                <div className="flex gap-4">
                                                    <button onClick={() => setTossDecision('Serve')} className={`flex-1 py-4 rounded-2xl border-2 font-black uppercase text-[10px] tracking-widest transition-all ${tossDecision === 'Serve' ? 'border-accent bg-accent/5 text-accent' : 'border-border text-text-disabled'}`}>Serve First</button>
                                                    <button onClick={() => setTossDecision('Receive')} className={`flex-1 py-4 rounded-2xl border-2 font-black uppercase text-[10px] tracking-widest transition-all ${tossDecision === 'Receive' ? 'border-accent bg-accent/5 text-accent' : 'border-border text-text-disabled'}`}>Receive First</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-4 space-y-4">
                                        <button onClick={handleStartScoringClick}
                                            className="w-full py-5 bg-accent text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl hover:shadow-accent/20 transition-all flex items-center justify-center gap-3">
                                            <Play className="w-4 h-4 fill-current" /> Initialize Session
                                        </button>
                                        <button onClick={() => setView('history')} className="w-full py-2 font-black uppercase text-[10px] tracking-widest text-text-disabled hover:text-text-primary transition-colors">Abort Protocol</button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {view === 'live' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-20">
                            <div className="flex justify-end gap-3 mb-4">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setView('setup')}
                                    className="px-6 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
                                    style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.textPrimary }}
                                >
                                    Edit Players / Details
                                </motion.button>
                            </div>
                            {/* MONITOR: The Professional Scoreboard */}
                            <div className="bg-slate-950 rounded-[2rem] border-4 border-slate-900 shadow-2xl overflow-hidden relative">
                                <div className="absolute inset-0 bg-gradient-to-br from-slate-900/50 to-transparent pointer-events-none" />

                                {/* Header Strip */}
                                <div className="bg-slate-900 px-6 py-3 flex justify-between items-center border-b border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                        <span className="text-[9px] font-black uppercase tracking-[0.4em] text-white">Live Match Feed</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex gap-1.5">
                                            {setHistory.map((set, i) => (
                                                <div key={i} className="flex flex-col items-center px-2 py-0.5 bg-white/5 rounded border border-white/10">
                                                    <span className="text-[7px] font-black text-slate-500 uppercase">S{i + 1}</span>
                                                    <span className="text-[10px] font-black text-accent">{set.gamesA}-{set.gamesB}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="w-px h-6 bg-slate-800" />
                                        <div className="flex flex-col items-end">
                                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Sets</span>
                                            <span className="text-xs font-black text-white">{setsA} - {setsB}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 md:p-10 grid grid-cols-3 items-center relative z-10">
                                    <div className="text-center space-y-3">
                                        <div className="flex flex-col items-center">
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 line-clamp-2 break-words px-2 mb-1.5">{playerA}</p>
                                            {currentServer === 'A' && (
                                                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-accent/20 border border-accent/30 rounded-full">
                                                    <div className="w-1 h-1 rounded-full bg-accent animate-pulse" />
                                                    <span className="text-[7px] font-black uppercase text-accent">Server</span>
                                                </div>
                                            )}
                                        </div>
                                        <motion.div key={pointsA} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                                                    className="text-7xl md:text-8xl font-black italic tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                                            {formatPoints(pointsA, isAdA)}
                                        </motion.div>
                                        <div className="text-xl font-black text-accent/80 italic">{gamesA}</div>
                                    </div>

                                    <div className="flex flex-col items-center gap-4">
                                        <div className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 shadow-inner">
                                            <span className="text-[10px] font-black text-accent italic tracking-widest">VS</span>
                                        </div>
                                        <div className="h-20 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                                        <div className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg">
                                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">GAMES</span>
                                        </div>
                                    </div>

                                    <div className="text-center space-y-3">
                                        <div className="flex flex-col items-center">
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 line-clamp-2 break-words px-2 mb-1.5">{playerB}</p>
                                            {currentServer === 'B' && (
                                                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-accent/20 border border-accent/30 rounded-full">
                                                    <div className="w-1 h-1 rounded-full bg-accent animate-pulse" />
                                                    <span className="text-[7px] font-black uppercase text-accent">Server</span>
                                                </div>
                                            )}
                                        </div>
                                        <motion.div key={pointsB} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                                                    className="text-7xl md:text-8xl font-black italic tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                                            {formatPoints(pointsB, isAdB)}
                                        </motion.div>
                                        <div className="text-xl font-black text-accent/80 italic">{gamesB}</div>
                                    </div>
                                </div>
                            </div>

                            {/* TACTICAL INTERFACE */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                {/* Left Side: Point & Shot Controls */}
                                <div className="lg:col-span-8 space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Player A Controls */}
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center ml-1">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-text-disabled">{playerA}</p>
                                                {currentServer === 'A' && isSecondServe && <span className="text-[9px] font-black uppercase text-red-500 animate-pulse">2nd Serve</span>}
                                            </div>
                                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={() => handlePoint('A')}
                                                           className="w-full h-24 bg-accent text-white rounded-3xl shadow-xl flex flex-col items-center justify-center gap-2 group transition-all">
                                                <Plus className="w-6 h-6 group-hover:scale-125 transition-transform" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Normal Point</span>
                                            </motion.button>
                                            <div className="grid grid-cols-3 gap-2">
                                                <button onClick={() => handlePoint('A', 'Ace')} className="py-3 bg-card border border-border text-[9px] font-black uppercase rounded-xl hover:bg-accent hover:text-white transition-all">Ace</button>
                                                <button onClick={() => handlePoint('A', 'Winner')} className="py-3 bg-card border border-border text-[9px] font-black uppercase rounded-xl hover:bg-accent hover:text-white transition-all">Winner</button>
                                                <button onClick={() => handlePoint('A', 'Unforced Error')} className="py-3 bg-card border border-border text-[9px] font-black uppercase rounded-xl hover:bg-red-500 hover:text-white transition-all text-red-500">UE</button>
                                            </div>
                                        </div>

                                        {/* Player B Controls */}
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center ml-1">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-text-disabled">{playerB}</p>
                                                {currentServer === 'B' && isSecondServe && <span className="text-[9px] font-black uppercase text-red-500 animate-pulse">2nd Serve</span>}
                                            </div>
                                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={() => handlePoint('B')}
                                                           className="w-full h-24 bg-accent text-white rounded-3xl shadow-xl flex flex-col items-center justify-center gap-2 group transition-all">
                                                <Plus className="w-6 h-6 group-hover:scale-125 transition-transform" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Normal Point</span>
                                            </motion.button>
                                            <div className="grid grid-cols-3 gap-2">
                                                <button onClick={() => handlePoint('B', 'Ace')} className="py-3 bg-card border border-border text-[9px] font-black uppercase rounded-xl hover:bg-accent hover:text-white transition-all">Ace</button>
                                                <button onClick={() => handlePoint('B', 'Winner')} className="py-3 bg-card border border-border text-[9px] font-black uppercase rounded-xl hover:bg-accent hover:text-white transition-all">Winner</button>
                                                <button onClick={() => handlePoint('B', 'Unforced Error')} className="py-3 bg-card border border-border text-[9px] font-black uppercase rounded-xl hover:bg-red-500 hover:text-white transition-all text-red-500">UE</button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Serve Status Console */}
                                    <div className="bg-card p-6 border border-border rounded-[2rem] shadow-sm flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-accent/10 text-accent rounded-2xl">
                                                <Swords className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-text-disabled">Server Active</p>
                                                <p className="text-lg font-black italic uppercase text-accent">{currentServer === 'A' ? playerA : playerB}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <button onClick={() => handleServe('In')} className="px-8 py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:shadow-emerald-500/20 transition-all">1st In</button>
                                            <button onClick={() => handleServe('Fault')} className="px-8 py-4 bg-red-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:shadow-red-500/20 transition-all">Fault</button>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Commands & Snapshot Stats */}
                                <div className="lg:col-span-4 space-y-6">
                                    <div className="bg-card p-6 border border-border rounded-[2rem] shadow-sm space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-accent">
                                                <Settings className="w-4 h-4" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Command Center</span>
                                            </div>
                                            <button onClick={() => setShowStatsModal(true)} className="p-2 bg-background-secondary rounded-lg hover:bg-border transition-colors"><Trophy className="w-4 h-4" /></button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <button onClick={() => { setPointsA(0); setPointsB(0); setIsAdA(false); setIsAdB(false); }}
                                                    className="flex items-center justify-center gap-2 py-4 bg-background-secondary border border-border text-text-primary rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-border transition-colors">
                                                <RotateCcw className="w-3.5 h-3.5" /> Undo Point
                                            </button>
                                            <button onClick={() => setView('review')}
                                                    className="flex items-center justify-center gap-2 py-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">
                                                <XCircle className="w-3.5 h-3.5" /> End Match
                                            </button>
                                        </div>

                                        <div className="pt-4 border-t border-border/50 space-y-4">
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                                <span className="text-text-disabled">Aces</span>
                                                <span className="text-accent">{statsA.aces} - {statsB.aces}</span>
                                            </div>
                                            <div className="w-full bg-background-secondary h-1 rounded-full overflow-hidden flex">
                                                <div className="bg-accent h-full transition-all" style={{ width: `${(statsA.aces / (statsA.aces + statsB.aces || 1)) * 100}%` }} />
                                            </div>
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                                <span className="text-text-disabled">Winners</span>
                                                <span className="text-accent">{statsA.winners} - {statsB.winners}</span>
                                            </div>
                                            <div className="w-full bg-background-secondary h-1 rounded-full overflow-hidden flex">
                                                <div className="bg-accent h-full transition-all" style={{ width: `${(statsA.winners / (statsA.winners + statsB.winners || 1)) * 100}%` }} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-6 bg-accent text-white rounded-[2rem] shadow-xl relative overflow-hidden group">
                                        <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/10 rounded-full blur-2xl transition-transform group-hover:scale-150" />
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Set Advantage</p>
                                        <h4 className="text-2xl font-black italic uppercase leading-tight">
                                            {setsA > setsB ? `${playerA} leads` : setsB > setsA ? `${playerB} leads` : 'Match Level'}
                                        </h4>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                    {view === 'review' && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto py-10 space-y-8">
                            <div className="bg-card p-10 border border-border rounded-[3rem] shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 blur-[100px] rounded-full bg-accent/10" />
                                <div className="flex justify-between items-start mb-10">
                                    <div>
                                        <h2 className="text-4xl font-black italic uppercase tracking-tighter text-text-primary mb-2">Match <span className="text-accent">Summary</span></h2>
                                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-text-disabled mb-2">Final Performance Metrics</p>
                                        <div className="px-4 py-1.5 rounded-full bg-background-secondary border border-border text-[9px] font-black uppercase tracking-widest text-text-disabled inline-block">
                                            {currentMatch && currentMatch.createdAt && (() => {
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
                                    <div className="px-5 py-2 bg-accent text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Official Record</div>
                                </div>

                                <div className="grid grid-cols-3 items-center gap-4 md:gap-8 mb-12 relative z-10">
                                    <div className="flex-1 space-y-3 text-center">
                                        <p className="text-[10px] font-black uppercase text-text-disabled truncate">{playerA}</p>
                                        <div className="text-6xl md:text-7xl font-black italic tracking-tighter text-text-primary drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                                            {setsA}
                                        </div>
                                        <div className="h-1.5 w-12 bg-accent rounded-full mx-auto" />
                                        <p className="text-[8px] font-black text-text-disabled uppercase tracking-[0.2em]">Sets Won</p>
                                    </div>

                                    <div className="flex flex-col items-center">
                                        <div className="w-12 h-12 rounded-full border border-border flex items-center justify-center bg-background">
                                            <span className="text-xs font-black italic opacity-20">VS</span>
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-3 text-center">
                                        <p className="text-[10px] font-black uppercase text-text-disabled truncate">{playerB}</p>
                                        <div className="text-6xl md:text-7xl font-black italic tracking-tighter text-text-primary drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                                            {setsB}
                                        </div>
                                        <div className="h-1.5 w-12 bg-accent rounded-full mx-auto" />
                                        <p className="text-[8px] font-black text-text-disabled uppercase tracking-[0.2em]">Sets Won</p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="p-8 bg-background-secondary/50 rounded-[2.5rem] border border-border/50 backdrop-blur-sm">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-accent mb-8 text-center">Set Progression</h3>
                                        <div className="flex justify-center gap-4 overflow-x-auto no-scrollbar pb-2">
                                            {setHistory.map((set, i) => (
                                                <div key={i} className="flex-shrink-0 flex flex-col items-center p-5 bg-card rounded-[1.5rem] border border-border/40 shadow-xl min-w-[100px]">
                                                    <span className="text-[8px] font-black text-text-disabled uppercase mb-2">Set {i + 1}</span>
                                                    <span className="text-2xl font-black text-text-primary italic">{set.gamesA} - {set.gamesB}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-background-secondary p-8 rounded-[2rem] border border-border space-y-4">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-accent">{playerA} Stats</p>
                                            <div className="space-y-3">
                                                <StatRow label="Aces" value={statsA.aces} />
                                                <StatRow label="Winners" value={statsA.winners} />
                                                <StatRow label="U. Errors" value={statsA.unforcedErrors} />
                                                <StatRow label="D. Faults" value={statsA.doubleFaults} />
                                                <StatRow label="1st Srv In" value={`${Math.round((statsA.firstServesIn / (statsA.firstServesTotal || 1)) * 100)}%`} />
                                            </div>
                                        </div>
                                        <div className="bg-background-secondary p-8 rounded-[2rem] border border-border space-y-4">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-accent">{playerB} Stats</p>
                                            <div className="space-y-3">
                                                <StatRow label="Aces" value={statsB.aces} />
                                                <StatRow label="Winners" value={statsB.winners} />
                                                <StatRow label="U. Errors" value={statsB.unforcedErrors} />
                                                <StatRow label="D. Faults" value={statsB.doubleFaults} />
                                                <StatRow label="1st Srv In" value={`${Math.round((statsB.firstServesIn / (statsB.firstServesTotal || 1)) * 100)}%`} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-12 flex gap-4">
                                    <button onClick={() => setView('history')} className="flex-1 py-5 bg-text-primary text-background rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl hover:opacity-90 transition-all flex items-center justify-center gap-3">
                                        <History className="w-4 h-4" /> Match Archives
                                    </button>
                                    <button onClick={() => setShowRating(true)} className="flex-1 py-5 bg-accent text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl hover:opacity-90 transition-all flex items-center justify-center gap-3">
                                        <CheckCircle2 className="w-4 h-4" /> Rate Experience
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            <AnimatePresence>
                {showStatsModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xl p-6">
                        <motion.div initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 50 }}
                            className="bg-card border border-border rounded-[3rem] w-full max-w-2xl p-10 shadow-2xl overflow-hidden relative">
                            <div className="absolute top-0 right-0 w-64 h-64 blur-[100px] rounded-full bg-accent/5" />
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-2xl font-black uppercase italic tracking-tighter text-text-primary">Live Match <span className="text-accent">Stats</span></h3>
                                <button onClick={() => setShowStatsModal(false)} className="w-10 h-10 bg-background-secondary rounded-xl flex items-center justify-center hover:bg-border transition-colors"><Plus className="w-6 h-6 rotate-45" /></button>
                            </div>

                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-accent text-center">{playerA}</p>
                                    <div className="space-y-4">
                                        <StatProgress label="Aces" valA={statsA.aces} valB={statsB.aces} />
                                        <StatProgress label="Winners" valA={statsA.winners} valB={statsB.winners} />
                                        <StatProgress label="Errors" valA={statsA.unforcedErrors} valB={statsB.unforcedErrors} />
                                        <StatProgress label="D. Faults" valA={statsA.doubleFaults} valB={statsB.doubleFaults} />
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-accent text-center">{playerB}</p>
                                    <div className="space-y-4">
                                        <StatProgress label="Aces" valA={statsB.aces} valB={statsA.aces} inverse />
                                        <StatProgress label="Winners" valA={statsB.winners} valB={statsA.winners} inverse />
                                        <StatProgress label="Errors" valA={statsB.unforcedErrors} valB={statsA.unforcedErrors} inverse />
                                        <StatProgress label="D. Faults" valA={statsB.doubleFaults} valB={statsA.doubleFaults} inverse />
                                    </div>
                                </div>
                            </div>
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

                {showSeriesResult && seriesResultData && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 md:p-6">
                        <motion.div initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 50 }}
                                    className="border rounded-[2.5rem] w-full max-w-lg p-8 md:p-12 text-center shadow-2xl relative overflow-hidden"
                                    style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
                            <div className="absolute top-0 right-0 w-48 h-48 blur-[100px] rounded-full opacity-10" style={{ backgroundColor: theme.colors.accent }} />

                            <div className="relative z-10">
                                <div className="w-20 h-20 bg-accent/20 text-accent rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner rotate-12">
                                    <Trophy className="w-10 h-10" />
                                </div>

                                <h3 className="text-4xl md:text-5xl font-black mb-1 uppercase italic tracking-tighter" style={{ color: theme.colors.textPrimary }}>
                                    {seriesResultData.isFinal ? 'Match ' : 'Set '}<span style={{ color: theme.colors.accent }}>{seriesResultData.isFinal ? 'Won!' : 'Over!'}</span>
                                </h3>
                                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-text-disabled mb-10">Official Classification</p>

                                <div className="bg-background-secondary/50 rounded-[2rem] p-8 mb-8 border border-border/50 backdrop-blur-md relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent pointer-events-none" />
                                    <p className="text-[10px] font-black uppercase text-accent tracking-[0.3em] mb-8 relative z-10">Match Leaderboard</p>

                                    <div className="flex items-center justify-between gap-4 relative z-10">
                                        <div className="flex-1 space-y-3">
                                            <p className="text-[10px] font-black uppercase text-text-disabled truncate">{playerA}</p>
                                            <div className="text-6xl md:text-7xl font-black italic tracking-tighter text-text-primary drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                                                {seriesResultData.score.split('-')[0].trim()}
                                            </div>
                                            <div className="h-1.5 w-12 bg-accent rounded-full mx-auto" />
                                        </div>

                                        <div className="flex flex-col items-center">
                                            <div className="w-12 h-12 rounded-full border border-border flex items-center justify-center bg-background">
                                                <span className="text-xs font-black italic opacity-20">VS</span>
                                            </div>
                                        </div>

                                        <div className="flex-1 space-y-3">
                                            <p className="text-[10px] font-black uppercase text-text-disabled truncate">{playerB}</p>
                                            <div className="text-6xl md:text-7xl font-black italic tracking-tighter text-text-primary drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                                                {seriesResultData.score.split('-')[1].trim()}
                                            </div>
                                            <div className="h-1.5 w-12 bg-accent rounded-full mx-auto" />
                                        </div>
                                    </div>
                                </div>

                                {setHistory && setHistory.length > 0 && (
                                    <div className="mb-8">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="h-px flex-1 bg-border/50" />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-text-disabled">Set History</span>
                                            <div className="h-px flex-1 bg-border/50" />
                                        </div>
                                        <div className="flex gap-2 overflow-x-auto no-scrollbar justify-center">
                                            {setHistory.map((set, i) => (
                                                <div key={i} className="flex-shrink-0 px-4 py-2 bg-background-secondary rounded-xl border border-border/30 text-center">
                                                    <span className="text-[7px] font-black text-text-disabled uppercase block mb-0.5">Set {i+1}</span>
                                                    <span className="text-[11px] font-black text-text-primary italic tracking-tight">{set.gamesA} - {set.gamesB}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                                    onClick={() => {
                                                        setShowSeriesResult(false);
                                                        if (seriesResultData.isFinal) setView('review');
                                                    }}
                                                    className="w-full py-6 bg-text-primary text-background rounded-2xl font-black uppercase tracking-[0.3em] text-xs md:text-sm shadow-2xl transition-all">
                                        {seriesResultData.isFinal ? 'Analyze Final Summary' : 'Proceed to Next Set'}
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {showRating && <RatingModal matchId={currentMatch?.id || `TN-${Date.now()}`} locationId={initialLocation.id} user={user} onClose={() => setShowRating(false)} />}
        </div>
    );
};

const StatRow = ({ label, value }: { label: string, value: string | number }) => (
    <div className="flex justify-between items-center">
        <span className="text-[9px] font-black uppercase text-text-disabled tracking-widest">{label}</span>
        <span className="text-xs font-black text-text-primary">{value}</span>
    </div>
);

const StatProgress = ({ label, valA, valB, inverse = false }: { label: string, valA: number, valB: number, inverse?: boolean }) => {
    const total = valA + valB || 1;
    const pct = (valA / total) * 100;
    return (
        <div className="space-y-2">
            <div className="flex justify-between text-[8px] font-black uppercase text-text-disabled">
                <span>{label}</span>
                <span>{valA}</span>
            </div>
            <div className="w-full bg-background-secondary h-1.5 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className={`h-full ${inverse ? 'bg-blue-500' : 'bg-accent'}`} />
            </div>
        </div>
    );
};

export default TennisScorer;

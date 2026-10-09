import React, { useState, useEffect } from 'react';
import { Location, User, SportType } from '../types';
import RatingModal from '../components/RatingModal';
import { storage } from '../services/storage';
import { supabase } from '../services/supabase';
import LoadingButton from '../components/LoadingButton';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, History, Play, CheckCircle2, XCircle, Plus, Timer, Settings, RotateCcw, Target, Activity, Users, ChevronRight, AlertCircle } from 'lucide-react';
import { handleError } from '../services/errorHandler';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeSelector } from '../components/ThemeSelector';
import { forceScrollTop } from '../utils/scroll';

const MATCHES_STORAGE_KEY = 'badminton_matches';

interface PlayerStats {
    smashes: number;
    netWinners: number;
    driveWinners: number;
    serviceFaults: number;
}

interface PointRecord {
    winner: 'A' | 'B';
    type: 'Regular' | 'Smash' | 'Net' | 'Drive' | 'Fault';
    scoreAtPoint: string;
    server: 'A' | 'B';
    side: 'Right' | 'Left';
}

interface BadmintonMatch {
    id: string;
    locationId: string;
    challengeId?: string;
    playerA: string;
    playerB: string;
    scoreA: number;
    scoreB: number;
    gamesA: number;
    gamesB: number;
    gameScores: string[];
    status: 'Live' | 'Finished' | 'Not Started';
    createdAt: string;
    finishedAt?: string;
    startTime?: string;
    endTime?: string;
    sport: SportType.BADMINTON;
    tossWinner?: 'A' | 'B';
    tossChoice?: 'Serve' | 'Receive' | 'Side A' | 'Side B';
    bestOf?: 3 | 5 | 7;
    statsA: PlayerStats;
    statsB: PlayerStats;
    history: PointRecord[];
}

interface BadmintonScorerProps {
    location: Location;
    user: User;
    sport?: SportType;
    onAlert?: (msg: string, type: 'success' | 'error' | 'info') => void;
    onBack?: () => void;
}

const BadmintonScorer: React.FC<BadmintonScorerProps> = ({ location: initialLocation, user, sport = SportType.BADMINTON, onAlert, onBack }) => {
    const { theme } = useTheme();
    const PAGE_ID = `badminton_scorer_${initialLocation.id}`;
    const savedState = storage.getPageState<any>(PAGE_ID) || {};

    const [matches, setMatches] = useState<BadmintonMatch[]>([]);
    const [currentMatch, setCurrentMatch] = useState<BadmintonMatch | null>(savedState.currentMatch || null);
    const [view, setView] = useState<'history' | 'setup' | 'live' | 'review'>(savedState.view || 'history');

    useEffect(() => {
        return forceScrollTop();
    }, [view]);

    // Setup State
    const [playerA, setPlayerA] = useState(savedState.playerA || 'Player A');
    const [playerB, setPlayerB] = useState(savedState.playerB || 'Player B');
    const [namingMode, setNamingMode] = useState<'default' | 'custom'>(savedState.namingMode || 'default');
    const [tossWinner, setTossWinner] = useState<'A' | 'B' | null>(savedState.tossWinner || null);
    const [tossChoice, setTossChoice] = useState<'Serve' | 'Receive' | 'Side A' | 'Side B' | null>(savedState.tossChoice || null);

    // Toss Animation State
    const [isCoinSpinning, setIsCoinSpinning] = useState(false);
    const [coinAngle, setCoinAngle] = useState(0);
    const [coinSpinDuration, setCoinSpinDuration] = useState(2.6);
    const [spinKey, setSpinKey] = useState(0);
    const [tossResultText, setTossResultText] = useState<string | null>(null);

    // Live State
    const [scoreA, setScoreA] = useState(savedState.scoreA || 0);
    const [scoreB, setScoreB] = useState(savedState.scoreB || 0);
    const [gamesA, setGamesA] = useState(savedState.gamesA || 0);
    const [gamesB, setGamesB] = useState(savedState.gamesB || 0);
    const [statsA, setStatsA] = useState<PlayerStats>(savedState.statsA || { smashes: 0, netWinners: 0, driveWinners: 0, serviceFaults: 0 });
    const [statsB, setStatsB] = useState<PlayerStats>(savedState.statsB || { smashes: 0, netWinners: 0, driveWinners: 0, serviceFaults: 0 });
    const [history, setHistory] = useState<PointRecord[]>(savedState.history || []);
    const [currentServer, setCurrentServer] = useState<'A' | 'B'>(savedState.currentServer || 'A');

    const [gameScores, setGameScores] = useState<string[]>(savedState.gameScores || []);

    const [showRating, setShowRating] = useState(false);
    const [showSeriesResult, setShowSeriesResult] = useState(false);
    const [seriesResultData, setSeriesResultData] = useState<{ winner: string, score: string, isFinal: boolean } | null>(null);
    const [bestOf, setBestOf] = useState<3 | 5 | 7>(savedState.bestOf || 3);

    const syncMatchResult = async (match: BadmintonMatch) => {
        if (!match.id || match.status !== 'Finished') return;
        try {
            let winnerId = null;
            let loserId = null;

            const challengeId = match.challengeId || (match as any).challenge_id;
            if (!challengeId) return;

            const { data: challenge } = await supabase.from('challenges').select('id, challenger_id, accepted_by').eq('id', challengeId).maybeSingle();
            if (!challenge) return;

            if (match.gamesA > match.gamesB) {
                winnerId = challenge.challenger_id;
                loserId = challenge.accepted_by;
            } else if (match.gamesB > match.gamesA) {
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
                score_summary: `${match.playerA} ${match.gamesA} - ${match.gamesB} ${match.playerB}`
            });
            if (error) throw error;
            onAlert?.('Match result synced!', 'success');
        } catch (e) {
            console.error("Sync failed:", e);
        }
    };

    useEffect(() => {
        storage.setPageState(PAGE_ID, {
            currentMatch, view, playerA, playerB, namingMode, tossWinner, tossChoice,
            scoreA, scoreB, gamesA, gamesB, gameScores, statsA, statsB, history, currentServer, bestOf
        });
    }, [PAGE_ID, currentMatch, view, playerA, playerB, namingMode, tossWinner, tossChoice,
        scoreA, scoreB, gamesA, gamesB, gameScores, statsA, statsB, history, currentServer, bestOf]);

    const [supabaseMatches, setSupabaseMatches] = useState<BadmintonMatch[]>([]);

    useEffect(() => {
        const fetchSupabaseMatches = async () => {
            try {
                const { data, error } = await supabase
                    .from('matches')
                    .select('*')
                    .eq('location_id', initialLocation.id)
                    .ilike('sport', '%Badminton%')
                    .in('status', ['live', 'not started', 'finished']);

                if (data) {
                    const mapped = data.map(m => {
                        const matchData = (m.match_data || {}) as any;
                        const defaultStats = { smashes: 0, netWinners: 0, driveWinners: 0, serviceFaults: 0 };
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
                            sport: SportType.BADMINTON,
                            scoreA: matchData?.scoreA || Number(m.score_a) || 0,
                            scoreB: matchData?.scoreB || Number(m.score_b) || 0,
                            gamesA: matchData?.gamesA || 0,
                            gamesB: matchData?.gamesB || 0,
                            statsA: matchData?.statsA || defaultStats,
                            statsB: matchData?.statsB || defaultStats,
                            history: matchData?.history || [],
                            gameScores: matchData?.gameScores || []
                        } as BadmintonMatch;
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
            .channel(`badminton_matches_${initialLocation.id}`)
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
        let localMatches: BadmintonMatch[] = [];
        try {
            const saved = localStorage.getItem(MATCHES_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    localMatches = parsed.map(m => ({
                        ...m,
                        gameScores: m.gameScores || [],
                        statsA: m.statsA || { smashes: 0, netWinners: 0, driveWinners: 0, serviceFaults: 0 },
                        statsB: m.statsB || { smashes: 0, netWinners: 0, driveWinners: 0, serviceFaults: 0 },
                        history: m.history || []
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

    const persistCurrentMatch = async (match: BadmintonMatch) => {
        try {
            setCurrentMatch(match);
            const saved = localStorage.getItem(MATCHES_STORAGE_KEY);
            const all: BadmintonMatch[] = saved ? JSON.parse(saved) : [];
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
                    score_a: `${match.gamesA} (${match.scoreA})`,
                    score_b: `${match.gamesB} (${match.scoreB})`,
                    status: match.status.toLowerCase(),
                    updated_at: new Date().toISOString()
                }).or(`id.eq.${match.id},challenge_id.eq.${match.id}`);
            }
        } catch (e) {
            console.error(handleError(e));
        }
    };

    const handleToss = () => {
        if (isCoinSpinning) return;
        setTossResultText('flipping');
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
            setTossResultText(winner === 'A' ? (playerA || 'Player A') : (playerB || 'Player B'));
            setTossWinner(winner);
            setIsCoinSpinning(false);
        }, durationMs);
    };

    const getServiceSide = (score: number): 'Right' | 'Left' => {
        return score % 2 === 0 ? 'Right' : 'Left';
    };

    const handlePoint = (winner: 'A' | 'B', type: PointRecord['type'] = 'Regular') => {
        if (!currentMatch) return;

        const server = currentServer;
        const side = getServiceSide(server === 'A' ? scoreA : scoreB);
        const nextScoreA = winner === 'A' ? scoreA + 1 : scoreA;
        const nextScoreB = winner === 'B' ? scoreB + 1 : scoreB;

        const newPoint: PointRecord = {
            winner,
            type,
            scoreAtPoint: `${nextScoreA}-${nextScoreB}`,
            server,
            side
        };

        const updatedHistory = [...history, newPoint];
        setHistory(updatedHistory);

        let newStatsA = { ...statsA };
        let newStatsB = { ...statsB };

        if (winner === 'A') {
            setScoreA(nextScoreA);
            if (type === 'Smash') newStatsA.smashes++;
            else if (type === 'Net') newStatsA.netWinners++;
            else if (type === 'Drive') newStatsA.driveWinners++;
            else if (type === 'Fault') newStatsB.serviceFaults++;
            setStatsA(newStatsA);
            setStatsB(newStatsB);
            setCurrentServer('A');
        } else {
            setScoreB(nextScoreB);
            if (type === 'Smash') newStatsB.smashes++;
            else if (type === 'Net') newStatsB.netWinners++;
            else if (type === 'Drive') newStatsB.driveWinners++;
            else if (type === 'Fault') newStatsA.serviceFaults++;
            setStatsA(newStatsA);
            setStatsB(newStatsB);
            setCurrentServer('B');
        }

        const nextMatch: BadmintonMatch = {
            ...currentMatch,
            scoreA: nextScoreA,
            scoreB: nextScoreB,
            history: updatedHistory,
            statsA: newStatsA,
            statsB: newStatsB
        };

        checkWin(winner, nextScoreA, nextScoreB, nextMatch);
    };

    const checkWin = (winner: 'A' | 'B', sA: number, sB: number, match: BadmintonMatch) => {
        if (winner === 'A') {
            if (sA >= 21 && (sA >= 30 || sA - sB >= 2)) { winGame('A', match); return; }
        } else {
            if (sB >= 21 && (sB >= 30 || sB - sA >= 2)) { winGame('B', match); return; }
        }
        persistCurrentMatch(match);
    };

    const winGame = (p: 'A' | 'B', matchObj: BadmintonMatch) => {
        let gA = gamesA;
        let gB = gamesB;
        const finalScore = `${scoreA}-${scoreB}`;
        const updatedGameScores = [...gameScores, finalScore];
        setGameScores(updatedGameScores);
        matchObj.gameScores = updatedGameScores;

        setScoreA(0); setScoreB(0); matchObj.scoreA = 0; matchObj.scoreB = 0;

        const targetGames = bestOf === 3 ? 2 : (bestOf === 5 ? 3 : 4);

        if (p === 'A') {
            gA += 1; setGamesA(gA); matchObj.gamesA = gA;
            if (gA === targetGames) {
                finalizeMatch(matchObj);
                setSeriesResultData({ winner: playerA, score: `${gA} - ${gB}`, isFinal: true });
                setShowSeriesResult(true);
                return;
            }
        } else {
            gB += 1; setGamesB(gB); matchObj.gamesB = gB;
            if (gB === targetGames) {
                finalizeMatch(matchObj);
                setSeriesResultData({ winner: playerB, score: `${gA} - ${gB}`, isFinal: true });
                setShowSeriesResult(true);
                return;
            }
        }
        if (matchObj.status !== 'Finished') persistCurrentMatch(matchObj);
        setSeriesResultData({ winner: p === 'A' ? playerA : playerB, score: `${gA} - ${gB}`, isFinal: false });
        setShowSeriesResult(true);
    };

    const finalizeMatch = (matchObj: BadmintonMatch) => {
        matchObj.status = 'Finished';
        matchObj.finishedAt = new Date().toISOString();
        matchObj.statsA = statsA;
        matchObj.statsB = statsB;
        matchObj.history = history;
        persistCurrentMatch(matchObj);
        storage.clearPageState(PAGE_ID);
        syncMatchResult(matchObj);
        setTimeout(() => setView('review'), 1500);
    };

    const [showMatchInProgressModal, setShowMatchInProgressModal] = useState(false);

    useEffect(() => {
        if (view === 'setup' && currentMatch) {
            setPlayerA(currentMatch.playerA);
            setPlayerB(currentMatch.playerB);
            if (currentMatch.bestOf) setBestOf(currentMatch.bestOf as 3 | 5 | 7);
        }
    }, [view, currentMatch]);

    const handleStartScoringClick = () => {
        if (!playerA || !playerB) { onAlert?.("Enter both player names", 'error'); return; }
        if (!tossWinner || !tossChoice) { onAlert?.("Complete the Toss protocol", 'error'); return; }

        const hasProgress = currentMatch && 'scoreA' in currentMatch && (currentMatch.scoreA > 0 || currentMatch.scoreB > 0 || currentMatch.gamesA > 0 || currentMatch.gamesB > 0 || (currentMatch.gameScores || []).length > 0);
        if (hasProgress) {
            setShowMatchInProgressModal(true);
        } else {
            startMatch('fresh');
        }
    };

    const startMatch = (mode: 'fresh' | 'continue') => {
        if (!playerA || !playerB) { onAlert?.("Enter both player names", 'error'); return; }
        if (!tossWinner || !tossChoice) { onAlert?.("Complete the Toss protocol", 'error'); return; }

        if (mode === 'continue' && currentMatch && 'scoreA' in currentMatch) {
            const updated = { ...currentMatch } as BadmintonMatch;
            updated.playerA = playerA;
            updated.playerB = playerB;
            updated.bestOf = bestOf;
            persistCurrentMatch(updated);
            resumeMatch(updated);
        } else {
            const matchId = (currentMatch && 'id' in currentMatch && currentMatch.id) ? currentMatch.id : `BD-${Date.now()}`;

            const newMatch: BadmintonMatch = {
                id: matchId,
                locationId: initialLocation.id,
                playerA,
                playerB,
                scoreA: 0,
                scoreB: 0,
                gamesA: 0,
                gamesB: 0,
                gameScores: [],
                status: 'Live',
                createdAt: new Date().toISOString(),
                sport: SportType.BADMINTON,
                tossWinner,
                tossChoice,
                bestOf,
                statsA: { smashes: 0, netWinners: 0, driveWinners: 0, serviceFaults: 0 },
                statsB: { smashes: 0, netWinners: 0, driveWinners: 0, serviceFaults: 0 },
                history: []
            };

            setScoreA(0); setScoreB(0); setGamesA(0); setGamesB(0); setGameScores([]);
            setStatsA({ smashes: 0, netWinners: 0, driveWinners: 0, serviceFaults: 0 });
            setStatsB({ smashes: 0, netWinners: 0, driveWinners: 0, serviceFaults: 0 });
            setHistory([]);
            setCurrentServer(tossChoice === 'Serve' ? tossWinner : tossWinner === 'A' ? 'B' : 'A');

            persistCurrentMatch(newMatch);
            setView('live');
        }
        setShowMatchInProgressModal(false);
    };

    const resumeMatch = (m: BadmintonMatch) => {
        const defaultStats = { smashes: 0, netWinners: 0, driveWinners: 0, serviceFaults: 0 };
        setCurrentMatch(m);
        setPlayerA(m.playerA || 'Player A');
        setPlayerB(m.playerB || 'Player B');
        setScoreA(m.scoreA || 0);
        setScoreB(m.scoreB || 0);
        setGamesA(m.gamesA || 0);
        setGamesB(m.gamesB || 0);
        setGameScores(m.gameScores || []);
        setStatsA(m.statsA || defaultStats);
        setStatsB(m.statsB || defaultStats);
        setHistory(m.history || []);
        setView(m.status === 'Finished' ? 'review' : 'live');
    };

    const undoPoint = () => {
        if (history.length === 0 || !currentMatch) return;
        const last = history[history.length - 1];
        const newHistory = history.slice(0, -1);
        setHistory(newHistory);

        if (last.winner === 'A') {
            const nextScore = Math.max(0, scoreA - 1);
            setScoreA(nextScore);
            if (last.type !== 'Regular' && last.type !== 'Fault') {
                const key = last.type === 'Smash' ? 'smashes' : last.type === 'Net' ? 'netWinners' : 'driveWinners';
                setStatsA(prev => ({ ...prev, [key]: Math.max(0, prev[key] - 1) }));
            }
        } else {
            const nextScore = Math.max(0, scoreB - 1);
            setScoreB(nextScore);
             if (last.type !== 'Regular' && last.type !== 'Fault') {
                const key = last.type === 'Smash' ? 'smashes' : last.type === 'Net' ? 'netWinners' : 'driveWinners';
                setStatsB(prev => ({ ...prev, [key]: Math.max(0, prev[key] - 1) }));
            }
        }

        if (last.type === 'Fault') {
            if (last.winner === 'A') setStatsB(prev => ({ ...prev, serviceFaults: Math.max(0, prev.serviceFaults - 1) }));
            else setStatsA(prev => ({ ...prev, serviceFaults: Math.max(0, prev.serviceFaults - 1) }));
        }

        setCurrentServer(last.server);
        persistCurrentMatch({ ...currentMatch, scoreA: last.winner === 'A' ? scoreA - 1 : scoreA, scoreB: last.winner === 'B' ? scoreB - 1 : scoreB, history: newHistory });
    };

    return (
        <div className="flex flex-col flex-1 min-h-screen relative overflow-hidden transition-colors duration-300"
             style={{ backgroundColor: theme.colors.background }}>
            <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] pointer-events-none opacity-20" style={{ backgroundColor: theme.colors.accent }} />
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] pointer-events-none opacity-20" style={{ backgroundColor: theme.colors.success }} />

            <header className="backdrop-blur-3xl p-4 md:p-6 flex justify-between items-center border-b sticky top-0 z-50 transition-all"
                    style={{ backgroundColor: `${theme.colors.card}80`, borderColor: theme.colors.border }}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg"
                         style={{ backgroundColor: theme.colors.accent, color: 'white' }}>
                        <img src="/logo.png" className="w-6 h-6 md:w-7 md:h-7 object-contain" alt="Boxitt" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-black italic tracking-tighter uppercase leading-none" style={{ color: theme.colors.textPrimary }}>Boxitt <span style={{ color: theme.colors.accent }}>{sport === SportType.PICKLEBALL ? 'Pickleball' : 'Badminton'}</span></h1>
                        <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em] mt-1" style={{ color: theme.colors.textDisabled }}>Elite Scoreboard Pro</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 md:gap-4">
                    <ThemeSelector />
                    {view === 'live' && (
                        <button
                            onClick={() => setView('setup')}
                            className="px-5 py-2.5 md:px-6 md:py-3 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all shadow-md border"
                            style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border, color: theme.colors.textPrimary }}
                        >
                            Edit
                        </button>
                    )}
                    {(view === 'live' || view === 'review') && (
                        <button onClick={() => setView('history')} className="w-10 h-10 md:w-12 md:h-12 bg-white/5 rounded-xl md:rounded-2xl flex items-center justify-center hover:bg-white/10 transition-all border border-white/10">
                            <History className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                    )}
                    <button onClick={onBack} className="px-5 py-2.5 md:px-8 md:py-4 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest hover:opacity-80 transition-all shadow-md" style={{ backgroundColor: theme.colors.textPrimary, color: theme.colors.background }}>Exit</button>
                </div>
            </header>

            <main className="flex-1 p-6 md:p-10 relative z-10 overflow-hidden max-w-6xl mx-auto w-full">
                <AnimatePresence mode="wait">
                    {view === 'history' && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                            <div className="flex justify-between items-end">
                                <div className="space-y-1">
                                    <h2 className="text-xs font-black uppercase tracking-[0.4em] text-text-disabled">{initialLocation.name}</h2>
                                    <div className="flex items-center gap-3 px-4 py-2 rounded-full border bg-background-secondary border-border shadow-sm">
                                        <span className="text-amber-500 font-black text-sm md:text-base">★ {initialLocation.averageRating || '0.0'}</span>
                                        <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-text-disabled">{initialLocation.ratingCount || 0} reviews</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-accent mt-2">
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
                                            <div className="absolute top-0 right-0 w-24 h-24 blur-[50px] rounded-full opacity-5 group-hover:opacity-20 transition-opacity" style={{ backgroundColor: theme.colors.accent }} />
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
                                                  <span className="text-[10px] font-black uppercase tracking-widest opacity-40">BADMINTON</span>
                                                  <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${m.status === 'Live' ? 'bg-accent text-white animate-pulse' : 'bg-text-disabled/10 text-text-disabled'}`}>
                                                      {m.status}
                                                  </span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 items-center gap-8 mb-10">
                                                <div className="text-center">
                                                    <p className="text-lg md:text-xl font-black uppercase italic mb-2 line-clamp-2 break-words">{m.playerA}</p>
                                                    <div className="flex flex-col items-center">
                                                      <p className="text-4xl md:text-5xl font-black italic text-accent">{m.gamesA}</p>
                                                      <p className="text-[9px] font-black uppercase text-text-disabled tracking-widest mt-1">Games</p>
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
                                                      <p className="text-4xl md:text-5xl font-black italic text-accent">{m.gamesB}</p>
                                                      <p className="text-[9px] font-black uppercase text-text-disabled tracking-widest mt-1">Games</p>
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
                                                            setView('setup');
                                                        }}
                                                        className="w-14 h-14 rounded-xl bg-background-secondary border border-border flex items-center justify-center hover:border-accent transition-all shadow-sm"
                                                    >
                                                        <Settings className="w-6 h-6 text-text-secondary" />
                                                    </button>
                                                )}
                                                <button onClick={() => resumeMatch(m)} className="flex-1 py-4 bg-text-primary text-background rounded-xl font-black uppercase tracking-widest hover:bg-accent hover:text-white transition-all shadow-theme-elevated flex items-center justify-center gap-3 text-xs md:text-sm">
                                                    {m.status === 'Finished' ? <Trophy className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                                                    {m.status === 'Finished' ? 'View Review' : 'Resume Session'}
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}

                    {view === 'setup' && (
                        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="max-w-4xl mx-auto py-4 space-y-6">
                            <div className="text-center">
                                <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter text-text-primary">Match <span className="text-accent">Protocol</span></h2>
                                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-text-disabled mt-1">Initialize athletes and toss</p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="bg-card p-6 border border-border rounded-[2rem] shadow-xl space-y-6">
                                        <div className="flex p-1 rounded-2xl bg-background-secondary border border-border">
                                            <button onClick={() => setNamingMode('default')} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${namingMode === 'default' ? 'bg-text-primary text-background' : 'text-text-disabled'}`}>Auto Names</button>
                                            <button onClick={() => setNamingMode('custom')} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${namingMode === 'custom' ? 'bg-text-primary text-background' : 'text-text-disabled'}`}>Custom Names</button>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black uppercase tracking-widest ml-1 text-text-disabled">Athlete Alpha</label>
                                                <input value={playerA} onChange={e => setPlayerA(e.target.value)} disabled={namingMode === 'default'}
                                                    className="w-full p-3 bg-background-secondary border-2 border-transparent focus:border-accent rounded-xl font-bold outline-none transition-all text-sm disabled:opacity-50" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black uppercase tracking-widest ml-1 text-text-disabled">Athlete Beta</label>
                                                <input value={playerB} onChange={e => setPlayerB(e.target.value)} disabled={namingMode === 'default'}
                                                    className="w-full p-3 bg-background-secondary border-2 border-transparent focus:border-accent rounded-xl font-bold outline-none transition-all text-sm disabled:opacity-50" />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black uppercase tracking-widest ml-1 text-text-disabled">Match Format (Best of)</label>
                                                <div className="flex p-1 rounded-2xl bg-background-secondary border border-border">
                                                    {[3, 5, 7].map(num => (
                                                        <button key={num} onClick={() => setBestOf(num as any)} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${bestOf === num ? 'bg-accent text-white shadow-lg' : 'text-text-disabled'}`}>Best of {num}</button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <button onClick={handleStartScoringClick} disabled={!tossWinner || !tossChoice}
                                        className="w-full py-5 bg-accent text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl hover:shadow-accent/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale">
                                        <Play className="w-4 h-4 fill-current" /> Start Official Session
                                    </button>
                                    <button onClick={() => setView('history')} className="w-full py-2 font-black uppercase text-[10px] tracking-widest text-text-disabled hover:text-text-primary transition-colors">Abort</button>
                                </div>

                                <div className="bg-card p-8 border border-border rounded-3xl shadow-xl space-y-8 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 blur-[60px] rounded-full bg-accent/5 pointer-events-none" />

                                    <div className="flex justify-between items-center relative z-10">
                                        <label className="text-[10px] font-black uppercase tracking-[0.4em] text-text-disabled">Professional Toss</label>
                                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleToss} disabled={isCoinSpinning}
                                            className="px-4 py-2 bg-amber-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 transition-all disabled:opacity-50">
                                            <RotateCcw className={`w-3 h-3 ${isCoinSpinning ? 'animate-spin' : ''}`} /> {isCoinSpinning ? 'Flipping...' : 'Spin Coin'}
                                        </motion.button>
                                    </div>

                                    <div className="flex flex-col items-center justify-center py-4 relative z-10">
                                        <div className="relative" style={{ width: '100px', height: '100px', transformStyle: 'preserve-3d', perspective: '1000px' }}>
                                            <motion.div key={spinKey}
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
                                                className="relative w-full h-full" style={{ transformStyle: 'preserve-3d' }}>
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
                                            {tossWinner && !isCoinSpinning && (
                                                <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} className="mt-6 text-center">
                                                    <p className="text-[8px] font-black uppercase text-success tracking-widest mb-1">Toss Winner</p>
                                                    <h4 className="text-xl font-black italic uppercase text-text-primary">{tossWinner === 'A' ? playerA : playerB}</h4>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {tossWinner && (
                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 pt-4 border-t border-border/50">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-text-disabled text-center">Decision Step</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {[
                                                    { id: 'Serve', icon: <Play className="w-3 h-3" /> },
                                                    { id: 'Receive', icon: <Target className="w-3 h-3" /> },
                                                    { id: 'Side A', icon: <ChevronRight className="w-3 h-3 rotate-180" /> },
                                                    { id: 'Side B', icon: <ChevronRight className="w-3 h-3" /> }
                                                ].map(item => (
                                                    <button key={item.id} onClick={() => setTossChoice(item.id as any)}
                                                        className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${tossChoice === item.id ? 'bg-accent text-white border-accent shadow-lg' : 'bg-background-secondary text-text-disabled border-border hover:border-accent/50'}`}>
                                                        {item.icon} {item.id}
                                                    </button>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {view === 'live' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 pb-20 max-w-5xl mx-auto">
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
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Broadcast Scoreboard */}
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="bg-slate-950 rounded-[2.5rem] border-[6px] border-slate-900 shadow-2xl overflow-hidden relative">
                                        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/50 to-transparent pointer-events-none" />

                                        <div className="bg-slate-900/80 px-8 py-4 flex justify-between items-center border-b border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                                                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/70">Live Density Stream</span>
                                            </div>
                                            <div className="flex gap-6">
                                                <div className="text-right">
                                                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 block">Game History</span>
                                                    <div className="flex gap-2">
                                                        {gameScores.map((gs, i) => (
                                                            <span key={i} className="text-[10px] font-black text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20">G{i+1}: {gs}</span>
                                                        ))}
                                                        <span className="text-[10px] font-black text-white/50 bg-white/5 px-2 py-0.5 rounded border border-white/10">G{gameScores.length + 1}</span>
                                                    </div>
                                                </div>
                                                <div className="w-px h-8 bg-white/5" />
                                                <div className="text-right">
                                                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 block">Server</span>
                                                    <span className="text-sm font-black text-success italic">{currentServer === 'A' ? playerA.split(' ')[0] : playerB.split(' ')[0]}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-8 md:p-10 grid grid-cols-3 items-center relative z-10">
                                            <div className="text-center space-y-3">
                                                <div className="relative inline-block">
                                                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 truncate mb-1">{playerA}</p>
                                                    {currentServer === 'A' && (
                                                        <motion.div layoutId="service-indicator" className="absolute -left-6 top-1/2 -translate-y-1/2 text-success">
                                                            <Activity className="w-3.5 h-3.5" />
                                                        </motion.div>
                                                    )}
                                                </div>
                                                <motion.div key={scoreA} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                                                            className="text-7xl md:text-8xl font-black italic tracking-tighter text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                                                    {scoreA}
                                                </motion.div>
                                                <div className="flex justify-center gap-1.5">
                                                    {[...Array(gamesA)].map((_, i) => <div key={i} className="w-4 h-1.5 rounded-full bg-accent" />)}
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-center">
                                                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 backdrop-blur-md">
                                                    <span className="text-xs font-black text-accent italic">VS</span>
                                                </div>
                                                <div className="space-y-1 text-center">
                                                    <span className="text-[7px] font-black uppercase tracking-[0.3em] text-slate-500">Service</span>
                                                    <div className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 shadow-inner">
                                                        <span className="text-[10px] font-black text-white tracking-widest uppercase">
                                                            {getServiceSide(currentServer === 'A' ? scoreA : scoreB)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-center space-y-3">
                                                <div className="relative inline-block">
                                                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 truncate mb-1">{playerB}</p>
                                                    {currentServer === 'B' && (
                                                        <motion.div layoutId="service-indicator" className="absolute -right-6 top-1/2 -translate-y-1/2 text-success">
                                                            <Activity className="w-3.5 h-3.5" />
                                                        </motion.div>
                                                    )}
                                                </div>
                                                <motion.div key={scoreB} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                                                            className="text-7xl md:text-8xl font-black italic tracking-tighter text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                                                    {scoreB}
                                                </motion.div>
                                                <div className="flex justify-center gap-1.5">
                                                    {[...Array(gamesB)].map((_, i) => <div key={i} className="w-4 h-1.5 rounded-full bg-accent" />)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Console Controls */}
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-end px-2">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-text-disabled italic">{playerA} (Alpha)</p>
                                                <div className="flex flex-wrap gap-2">
                                                    <button onClick={() => handlePoint('A', 'Smash')} className="px-2 py-1 bg-accent/10 text-accent rounded-lg text-[8px] font-black uppercase border border-accent/20 hover:bg-accent hover:text-white transition-all">Smash</button>
                                                    <button onClick={() => handlePoint('A', 'Net')} className="px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-[8px] font-black uppercase border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all">Net</button>
                                                    <button onClick={() => handlePoint('A', 'Drive')} className="px-2 py-1 bg-blue-500/10 text-blue-500 rounded-lg text-[8px] font-black uppercase border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all">Drive</button>
                                                </div>
                                            </div>
                                            <motion.button whileTap={{ scale: 0.96 }} onClick={() => handlePoint('A')}
                                                className="w-full h-32 bg-accent text-white rounded-[2rem] shadow-xl flex flex-col items-center justify-center gap-2 group transition-all relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 blur-3xl -mr-8 -mt-8" />
                                                <Plus className="w-8 h-8 group-hover:scale-125 transition-transform" />
                                                <span className="text-xs font-black uppercase tracking-[0.2em]">Point Alpha</span>
                                            </motion.button>
                                            <button onClick={() => handlePoint('B', 'Fault')} className="w-full py-3 bg-red-500/5 border border-red-500/10 text-red-500/50 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Service Fault A</button>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex justify-between items-end px-2">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-text-disabled italic">{playerB} (Beta)</p>
                                                <div className="flex flex-wrap gap-2">
                                                    <button onClick={() => handlePoint('B', 'Smash')} className="px-2 py-1 bg-accent/10 text-accent rounded-lg text-[8px] font-black uppercase border border-accent/20 hover:bg-accent hover:text-white transition-all">Smash</button>
                                                    <button onClick={() => handlePoint('B', 'Net')} className="px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-[8px] font-black uppercase border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all">Net</button>
                                                    <button onClick={() => handlePoint('B', 'Drive')} className="px-2 py-1 bg-blue-500/10 text-blue-500 rounded-lg text-[8px] font-black uppercase border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all">Drive</button>
                                                </div>
                                            </div>
                                            <motion.button whileTap={{ scale: 0.96 }} onClick={() => handlePoint('B')}
                                                className="w-full h-32 bg-accent text-white rounded-[2rem] shadow-xl flex flex-col items-center justify-center gap-2 group transition-all relative overflow-hidden">
                                                <div className="absolute top-0 left-0 w-24 h-24 bg-white/10 blur-3xl -ml-8 -mt-8" />
                                                <Plus className="w-8 h-8 group-hover:scale-125 transition-transform" />
                                                <span className="text-xs font-black uppercase tracking-[0.2em]">Point Beta</span>
                                            </motion.button>
                                            <button onClick={() => handlePoint('A', 'Fault')} className="w-full py-3 bg-red-500/5 border border-red-500/10 text-red-500/50 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Service Fault B</button>
                                        </div>
                                    </div>
                                </div>

                                {/* Sidebar: Log & Stats */}
                                <div className="space-y-6">
                                    <div className="bg-card border border-border rounded-[2rem] shadow-sm overflow-hidden flex flex-col h-[400px]">
                                        <div className="p-5 border-b border-border bg-background-secondary flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <Activity className="w-4 h-4 text-accent" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Live Density Log</span>
                                            </div>
                                            <button onClick={undoPoint} className="p-2 hover:bg-white/5 rounded-lg text-text-disabled hover:text-accent transition-all">
                                                <RotateCcw className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                                            {history.length === 0 ? (
                                                <div className="h-full flex items-center justify-center opacity-20 flex-col gap-2">
                                                    <History className="w-8 h-8" />
                                                    <p className="text-[8px] font-black uppercase tracking-widest">No Events Tracked</p>
                                                </div>
                                            ) : (
                                                history.slice().reverse().map((point, i) => (
                                                    <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} key={i}
                                                        className="p-3 bg-background-secondary border border-border rounded-xl flex justify-between items-center">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${point.winner === 'A' ? 'bg-accent text-white' : 'bg-slate-700 text-white'}`}>
                                                                {point.winner}
                                                            </div>
                                                            <div>
                                                                <p className="text-[9px] font-black uppercase tracking-tight text-text-primary">Point {point.type}</p>
                                                                <p className="text-[8px] font-bold text-text-disabled uppercase">Server: {point.server} • {point.side}</p>
                                                            </div>
                                                        </div>
                                                        <span className="text-xs font-black italic text-accent">{point.scoreAtPoint}</span>
                                                    </motion.div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-card p-6 border border-border rounded-[2rem] shadow-sm space-y-4">
                                        <button onClick={() => finalizeMatch({ ...currentMatch!, scoreA, scoreB, gamesA, gamesB })}
                                                className="w-full py-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2">
                                            <XCircle className="w-4 h-4" /> Terminate Session
                                        </button>
                                        <div className="p-4 bg-accent/5 border border-accent/10 rounded-2xl flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Trophy className="w-5 h-5 text-accent" />
                                                <div>
                                                    <p className="text-[9px] font-black uppercase text-text-primary">Leader</p>
                                                    <p className="text-[10px] font-bold text-text-disabled">{scoreA > scoreB ? playerA : scoreB > scoreA ? playerB : 'Level'}</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-accent/30" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {view === 'review' && currentMatch && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-10 pb-32 max-w-5xl mx-auto">
                            <div className="p-10 bg-card border border-border rounded-[3rem] shadow-2xl relative overflow-hidden backdrop-blur-xl">
                                <div className="absolute top-0 right-0 w-64 h-64 blur-[100px] rounded-full bg-accent/10" />
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-3xl md:text-4xl font-black uppercase italic tracking-tighter text-text-primary mb-1">Match <span className="text-accent">Summary</span></h3>
                                        <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.3em] text-text-disabled">
                                            <Timer className="w-3.5 h-3.5" />
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
                                            {` • ${initialLocation.name}`}
                                        </div>
                                    </div>
                                    <div className="text-right space-y-1.5">
                                        <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg ${gamesA > gamesB ? 'bg-accent text-white' : 'bg-slate-800 text-white'}`}>
                                            Winner: {gamesA > gamesB ? playerA : playerB}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 items-center gap-4 md:gap-8 mb-12 relative z-10 pt-10">
                                    <div className="flex-1 space-y-3 text-center">
                                        <p className="text-[10px] font-black uppercase text-text-disabled truncate">{playerA}</p>
                                        <div className="text-6xl md:text-7xl font-black italic tracking-tighter text-text-primary drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                                            {gamesA}
                                        </div>
                                        <div className="h-1.5 w-12 bg-accent rounded-full mx-auto" />
                                        <p className="text-[8px] font-black text-text-disabled uppercase tracking-[0.2em]">Games Won</p>
                                    </div>

                                    <div className="flex flex-col items-center">
                                        <div className="w-12 h-12 rounded-full border border-border flex items-center justify-center bg-background shadow-xl">
                                            <span className="text-xs font-black italic opacity-20">VS</span>
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-3 text-center">
                                        <p className="text-[10px] font-black uppercase text-text-disabled truncate">{playerB}</p>
                                        <div className="text-6xl md:text-7xl font-black italic tracking-tighter text-text-primary drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                                            {gamesB}
                                        </div>
                                        <div className="h-1.5 w-12 bg-accent rounded-full mx-auto" />
                                        <p className="text-[8px] font-black text-text-disabled uppercase tracking-[0.2em]">Games Won</p>
                                    </div>
                                </div>

                                <div className="p-8 bg-background-secondary/50 rounded-[2.5rem] border border-border/50 backdrop-blur-sm mb-8">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-accent mb-8 text-center">Game Progression</h3>
                                    <div className="flex justify-center gap-4 overflow-x-auto no-scrollbar pb-2">
                                        {(currentMatch.gameScores || []).map((score, i) => (
                                            <div key={i} className="flex-shrink-0 flex flex-col items-center p-5 bg-card rounded-[1.5rem] border border-border/40 shadow-xl min-w-[100px]">
                                                <span className="text-[8px] font-black text-text-disabled uppercase mb-2">Game {i + 1}</span>
                                                <span className="text-2xl font-black text-text-primary italic tracking-tight">{score}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="bg-card p-8 border border-border rounded-[2.5rem] shadow-xl space-y-8">
                                    <h4 className="text-xl font-black italic uppercase tracking-widest flex items-center gap-3 text-text-primary">
                                        <Activity className="w-5 h-5 text-accent" /> Performance Matrix
                                    </h4>
                                    <div className="space-y-6">
                                        {[
                                            { label: 'Smashes', a: statsA.smashes, b: statsB.smashes },
                                            { label: 'Net Winners', a: statsA.netWinners, b: statsB.netWinners },
                                            { label: 'Drive Winners', a: statsA.driveWinners, b: statsB.driveWinners },
                                            { label: 'Service Faults', a: statsA.serviceFaults, b: statsB.serviceFaults },
                                        ].map((stat, i) => (
                                            <div key={i} className="space-y-2">
                                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-text-disabled">
                                                    <span>{stat.a}</span>
                                                    <span>{stat.label}</span>
                                                    <span>{stat.b}</span>
                                                </div>
                                                <div className="h-3 bg-background-secondary rounded-full overflow-hidden flex">
                                                    <div className="bg-accent h-full transition-all duration-1000" style={{ width: `${(stat.a / (stat.a + stat.b || 1)) * 100}%` }} />
                                                    <div className="bg-slate-700 h-full transition-all duration-1000" style={{ width: `${(stat.b / (stat.a + stat.b || 1)) * 100}%` }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-card p-8 border border-border rounded-[2.5rem] shadow-xl flex flex-col">
                                    <h4 className="text-xl font-black italic uppercase tracking-widest flex items-center gap-3 text-text-primary mb-8">
                                        <History className="w-5 h-5 text-accent" /> Match Timeline
                                    </h4>
                                    <div className="flex-1 overflow-y-auto pr-4 no-scrollbar space-y-4 max-h-[400px]">
                                        {history.map((point, i) => (
                                            <div key={i} className="flex items-center gap-4 group">
                                                <div className="w-10 text-[10px] font-black text-text-disabled italic">P{i+1}</div>
                                                <div className="flex-1 p-4 bg-background-secondary border border-border rounded-2xl group-hover:border-accent transition-all flex justify-between items-center">
                                                    <div>
                                                        <span className={`text-[10px] font-black uppercase ${point.winner === 'A' ? 'text-accent' : 'text-slate-500'}`}>
                                                            {point.winner === 'A' ? playerA : playerB} Won
                                                        </span>
                                                        <p className="text-[8px] font-bold uppercase text-text-disabled mt-0.5">{point.type} • {point.side} Side</p>
                                                    </div>
                                                    <span className="text-xs font-black italic">{point.scoreAtPoint}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setView('history')}
                                className="w-full py-6 bg-text-primary text-background rounded-3xl font-black uppercase tracking-[0.4em] text-sm shadow-2xl flex items-center justify-center gap-4">
                                <History className="w-6 h-6" /> Back to Session Archives
                            </motion.button>
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
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-6">
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
                                        {seriesResultData.isFinal ? 'Match ' : 'Game '}<span style={{ color: theme.colors.accent }}>{seriesResultData.isFinal ? 'Won!' : 'Over!'}</span>
                                    </h3>
                                    <p className="text-[9px] font-black uppercase tracking-[0.5em] text-text-disabled mb-8 text-center">Official Classification</p>

                                    <div className="bg-background-secondary/50 rounded-3xl p-6 mb-8 border border-border/50 backdrop-blur-md relative overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent pointer-events-none" />
                                        <p className="text-[9px] font-black uppercase text-accent tracking-[0.3em] mb-6 relative z-10 text-center">Match Standings</p>

                                        <div className="flex items-center justify-between gap-2 relative z-10">
                                            <div className="flex-1 space-y-2 text-center">
                                                <p className="text-[9px] font-black uppercase text-text-disabled truncate px-1">{playerA}</p>
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
                                                <p className="text-[9px] font-black uppercase text-text-disabled truncate px-1">{playerB}</p>
                                                <div className="text-5xl md:text-6xl font-black italic tracking-tighter text-text-primary drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                                                    {seriesResultData.score.split('-')[1].trim()}
                                                </div>
                                                <div className="h-1 w-10 bg-accent rounded-full mx-auto" />
                                            </div>
                                        </div>
                                    </div>

                                    {gameScores && gameScores.length > 0 && (
                                        <div className="mb-8">
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="h-px flex-1 bg-border/30" />
                                                <span className="text-[8px] font-black uppercase tracking-widest text-text-disabled opacity-60">Session Timeline</span>
                                                <div className="h-px flex-1 bg-border/30" />
                                            </div>
                                            <div className="flex gap-2 overflow-x-auto no-scrollbar justify-center px-2">
                                                {gameScores.map((gs, i) => (
                                                    <div key={i} className="flex-shrink-0 px-4 py-3 bg-background-secondary border border-border/40 rounded-2xl flex flex-col items-center min-w-[80px]">
                                                        <span className="text-[7px] font-black text-text-disabled uppercase block mb-1">Game {i+1}</span>
                                                        <span className="text-[10px] font-black text-text-primary italic tracking-tight">{gs}</span>
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
            </main>

            {showRating && <RatingModal matchId={currentMatch?.id || `BD-${Date.now()}`} locationId={initialLocation.id} user={user} onClose={() => setShowRating(false)} />}
        </div>
    );
};

export default BadmintonScorer;

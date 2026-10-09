import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Location, User, SportType } from '../types';
import RatingModal from '../components/RatingModal';
import { storage } from '../services/storage';
import { supabase } from '../services/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, History, Play, CheckCircle2, Timer, XCircle, RotateCcw, Plus, Settings, Users, Shield, Target, Zap, Share2, Hand, Info, Clock, ArrowUp, ChevronRight, Activity } from 'lucide-react';
import { handleError } from '../services/errorHandler';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeSelector } from '../components/ThemeSelector';
import { forceScrollTop } from '../utils/scroll';

const MATCHES_STORAGE_KEY = 'basketball_matches';

interface BasketballPlayer {
    name: string;
    fouls: number;
    points: number;
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
}

interface TeamStats {
    score: number;
    timeouts: number;
    fouls: number[]; // Fouls per quarter
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    shots: {
        onePt: number;
        twoPt: number;
        threePt: number;
    };
    players: BasketballPlayer[];
}

interface BasketballMatch {
    id: string;
    locationId: string;
    challengeId?: string;
    teamA: string;
    teamB: string;
    status: 'Live' | 'Finished' | 'Not Started';
    createdAt: string;
    finishedAt?: string;
    startTime?: string;
    endTime?: string;
    sport: SportType.BASKETBALL;
    quarter: number;
    tossWinner?: 'host' | 'visitor';
    optedTo?: 'Ball' | 'Defense';
    possession?: 'A' | 'B';
    teamAData: TeamStats;
    teamBData: TeamStats;
    namingMode: 'default' | 'custom';
    bestOf?: number;
    gamesWonA?: number;
    gamesWonB?: number;
    gameHistory?: any[];
}

interface BasketballScorerProps {
    location: Location;
    user: User;
    onAlert?: (msg: string, type: 'success' | 'error' | 'info') => void;
    onBack?: () => void;
}

const BasketballScorer: React.FC<BasketballScorerProps> = ({ location: initialLocation, user, onAlert, onBack }) => {
    const { theme } = useTheme();
    const PAGE_ID = `basketball_scorer_${initialLocation.id}`;
    const savedState = storage.getPageState<any>(PAGE_ID) || {};

    const [matches, setMatches] = useState<BasketballMatch[]>([]);
    const [currentMatch, setCurrentMatch] = useState<BasketballMatch | null>(savedState.currentMatch || null);
    const [view, setView] = useState<'history' | 'setup' | 'live' | 'review'>(savedState.view || 'history');

    useEffect(() => {
        return forceScrollTop();
    }, [view]);

    // Setup State
    const [hostTeam, setHostTeam] = useState(savedState.hostTeam || '');
    const [visitorTeam, setVisitorTeam] = useState(savedState.visitorTeam || '');
    const [teamSize, setTeamSize] = useState<number>(savedState.teamSize || 5);
    const [namingMode, setNamingMode] = useState<'default' | 'custom'>(savedState.namingMode || 'default');
    const [hostPlayerNames, setHostPlayerNames] = useState<string[]>(savedState.hostPlayerNames || []);
    const [visitorPlayerNames, setVisitorPlayerNames] = useState<string[]>(savedState.visitorPlayerNames || []);

    // Toss State
    const [isCoinSpinning, setIsCoinSpinning] = useState(false);
    const [coinAngle, setCoinAngle] = useState(0);
    const [coinSpinDuration, setCoinSpinDuration] = useState(2.6);
    const [spinKey, setSpinKey] = useState(0);
    const [tossResult, setTossResult] = useState<string | null>(null);
    const [tossWinner, setTossWinner] = useState<'host' | 'visitor' | null>(savedState.tossWinner || null);
    const [optedTo, setOptedTo] = useState<'Ball' | 'Defense'>(savedState.optedTo || 'Ball');
    const [bestOf, setBestOf] = useState<number>(savedState.bestOf || 1);
    const [showStartMatchConfirm, setShowStartMatchConfirm] = useState(false);

    // Live State
    const [shotClock, setShotClock] = useState(24);
    const [isShotClockRunning, setIsShotClockRunning] = useState(false);
    const [showRating, setShowRating] = useState(false);
    const [showScorecardModal, setShowScorecardModal] = useState<'A' | 'B' | null>(null);
    const shotClockRef = useRef<NodeJS.Timeout | null>(null);

    // Series State
    const [showSeriesResult, setShowSeriesResult] = useState(false);
    const [seriesResultData, setSeriesResultData] = useState<{ winner: string, score: string, isFinal: boolean } | null>(null);

    const syncMatchResult = async (match: BasketballMatch) => {
        if (!match.id || match.status !== 'Finished') return;
        try {
            let winnerId = null;
            let loserId = null;

            const challengeId = match.challengeId || (match as any).challenge_id;
            if (!challengeId) return;

            const { data: challenge } = await supabase.from('challenges').select('id, challenger_id, accepted_by').eq('id', challengeId).maybeSingle();
            if (!challenge) return;

            const scoreA = match.bestOf && match.bestOf > 1 ? (match.gamesWonA || 0) : match.teamAData.score;
            const scoreB = match.bestOf && match.bestOf > 1 ? (match.gamesWonB || 0) : match.teamBData.score;

            if (scoreA > scoreB) {
                winnerId = challenge.challenger_id;
                loserId = challenge.accepted_by;
            } else if (scoreB > scoreA) {
                winnerId = challenge.accepted_by;
                loserId = challenge.challenger_id;
            }

            if (!winnerId || !loserId) {
                console.log('Match is a draw or missing participant IDs, skipping DB sync.');
                return;
            }

            const summary = match.bestOf && match.bestOf > 1
                            ? `${match.teamA} ${match.gamesWonA} - ${match.gamesWonB} ${match.teamB} (Series)`
                            : `${match.teamA} ${match.teamAData.score} - ${match.teamBData.score} ${match.teamB}`;

            const { error } = await supabase.from('match_results').insert({
                challenge_id: challenge.id,
                winner_id: winnerId,
                loser_id: loserId,
                score_summary: summary
            });
            if (error) throw error;
            onAlert?.('Match result synced!', 'success');
        } catch (e) {
            console.error("Sync failed:", e);
        }
    };

    useEffect(() => {
        storage.setPageState(PAGE_ID, {
            currentMatch, view, hostTeam, visitorTeam, teamSize, namingMode, hostPlayerNames, visitorPlayerNames, tossWinner, optedTo, bestOf
        });
    }, [PAGE_ID, currentMatch, view, hostTeam, visitorTeam, teamSize, namingMode, hostPlayerNames, visitorPlayerNames, tossWinner, optedTo, bestOf]);

    useEffect(() => {
        if (view === 'setup' && currentMatch) {
            setHostTeam(currentMatch.teamA);
            setVisitorTeam(currentMatch.teamB);
            setTeamSize(currentMatch.teamAData.players.length);
            setHostPlayerNames(currentMatch.teamAData.players.map(p => p.name));
            setVisitorPlayerNames(currentMatch.teamBData.players.map(p => p.name));
            if (currentMatch.bestOf) setBestOf(currentMatch.bestOf);
        }
    }, [view, currentMatch]);

    const [supabaseMatches, setSupabaseMatches] = useState<BasketballMatch[]>([]);

    useEffect(() => {
        const fetchSupabaseMatches = async () => {
            try {
                const { data, error } = await supabase
                    .from('matches')
                    .select('*')
                    .eq('location_id', initialLocation.id)
                    .ilike('sport', '%Basketball%')
                    .in('status', ['live', 'not started', 'finished']);

                if (data) {
                    const mapped = data.map(m => {
                        const matchData = (m.match_data || {}) as any;
                        const defaultStats = (name: string) => ({
                            score: 0, timeouts: 4, fouls: [0, 0, 0, 0], rebounds: 0, assists: 0, steals: 0, blocks: 0,
                            shots: { onePt: 0, twoPt: 0, threePt: 0 }, players: []
                        });
                        return {
                            ...matchData,
                            id: m.id,
                            challengeId: m.challenge_id,
                            locationId: m.location_id,
                            teamA: m.team_a_name || matchData?.teamA || 'Team A',
                            teamB: m.team_b_name || matchData?.teamB || 'Team B',
                            status: m.status === 'not started' ? 'Not Started' : m.status === 'finished' ? 'Finished' : 'Live',
                            createdAt: m.created_at,
                            startTime: m.start_time,
                            endTime: m.end_time,
                            sport: SportType.BASKETBALL,
                            teamAData: matchData?.teamAData || { ...defaultStats(m.team_a_name || 'Team A'), score: Number(m.score_a) || 0 },
                            teamBData: matchData?.teamBData || { ...defaultStats(m.team_b_name || 'Team B'), score: Number(m.score_b) || 0 }
                        } as BasketballMatch;
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
            .channel(`basketball_matches_${initialLocation.id}`)
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
        let localMatches: BasketballMatch[] = [];
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    localMatches = parsed.map(m => ({
                        ...m,
                        teamAData: m.teamAData || { score: 0, timeouts: 4, fouls: [0,0,0,0], rebounds: 0, assists: 0, steals: 0, blocks: 0, shots: { onePt: 0, twoPt: 0, threePt: 0 }, players: [] },
                        teamBData: m.teamBData || { score: 0, timeouts: 4, fouls: [0,0,0,0], rebounds: 0, assists: 0, steals: 0, blocks: 0, shots: { onePt: 0, twoPt: 0, threePt: 0 }, players: [] }
                    })).filter(m => m && m.locationId === initialLocation.id);
                }
            } catch (e) {
                console.error("Failed to load basketball matches", e);
            }
        }
        const combined = [...supabaseMatches, ...localMatches];
        const unique = Array.from(new Map(combined.filter(m => m && m.id).map(m => [m.id, m])).values());
        setMatches(unique.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, [initialLocation.id, supabaseMatches]);

    // Shot Clock Logic
    useEffect(() => {
        if (isShotClockRunning && shotClock > 0) {
            shotClockRef.current = setInterval(() => {
                setShotClock(prev => {
                    if (prev <= 1) {
                        setIsShotClockRunning(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            if (shotClockRef.current) clearInterval(shotClockRef.current);
        }
        return () => { if (shotClockRef.current) clearInterval(shotClockRef.current); };
    }, [isShotClockRunning, shotClock]);

    const persistCurrentMatch = async (match: BasketballMatch) => {
        try {
            setCurrentMatch(match);
            const saved = localStorage.getItem(MATCHES_STORAGE_KEY);
            const all: BasketballMatch[] = saved ? JSON.parse(saved) : [];
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
                    score_a: match.teamAData.score.toString(),
                    score_b: match.teamBData.score.toString(),
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
            setTossResult(winner === 'host' ? hostTeam || 'Host' : visitorTeam || 'Visitor');
            setTossWinner(winner);
            setIsCoinSpinning(false);
        }, durationMs);
    };

    const initTeamData = (name: string, players: string[]): TeamStats => ({
        score: 0,
        timeouts: 4,
        fouls: [0, 0, 0, 0],
        rebounds: 0,
        assists: 0,
        steals: 0,
        blocks: 0,
        shots: { onePt: 0, twoPt: 0, threePt: 0 },
        players: players.map(p => ({ name: p, fouls: 0, points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 }))
    });

    const [showMatchInProgressModal, setShowMatchInProgressModal] = useState(false);

    const handleStartScoringClick = () => {
        if (!hostTeam || !visitorTeam) { onAlert?.("Enter team names", 'error'); return; }
        if (!tossWinner) { onAlert?.("Perform the toss first", 'error'); return; }

        const hasProgress = currentMatch && 'teamAData' in currentMatch && ((currentMatch.teamAData?.score || 0) > 0 || (currentMatch.teamBData?.score || 0) > 0 || (currentMatch.teamAData?.players || []).some(p => p.points > 0 || p.fouls > 0));
        if (hasProgress) {
            setShowMatchInProgressModal(true);
        } else {
            startMatch('fresh');
        }
    };

    const startMatch = (mode: 'fresh' | 'continue') => {
        if (!hostTeam || !visitorTeam) { onAlert?.("Enter team names", 'error'); return; }
        if (!tossWinner) { onAlert?.("Perform the toss first", 'error'); return; }

        const getPlayers = (size: number, custom: string[], prefix: string) =>
            namingMode === 'custom'
            ? Array.from({ length: size }, (_, i) => custom[i]?.trim() || `Player ${prefix}${i + 1}`)
            : Array.from({ length: size }, (_, i) => `Player ${prefix}${i + 1}`);

        const hostPlayers = getPlayers(teamSize, hostPlayerNames, 'A');
        const visitorPlayers = getPlayers(teamSize, visitorPlayerNames, 'B');

        if (mode === 'continue' && currentMatch && 'teamAData' in currentMatch) {
            const updated = { ...currentMatch } as BasketballMatch;
            updated.teamA = hostTeam;
            updated.teamB = visitorTeam;

            const existingAPlayers = updated.teamAData.players || [];
            updated.teamAData.players = hostPlayers.map((name, i) => {
                if (existingAPlayers[i]) return { ...existingAPlayers[i], name };
                return { name, fouls: 0, points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 };
            });

            const existingBPlayers = updated.teamBData.players || [];
            updated.teamBData.players = visitorPlayers.map((name, i) => {
                if (existingBPlayers[i]) return { ...existingBPlayers[i], name };
                return { name, fouls: 0, points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 };
            });

            persistCurrentMatch(updated);
            setView('live');
            setShotClock(24);
            setIsShotClockRunning(false);
        } else {
            const initialPossession = (tossWinner === 'host' && optedTo === 'Ball') || (tossWinner === 'visitor' && optedTo === 'Defense') ? 'A' : 'B';
            const matchId = (currentMatch && 'id' in currentMatch && currentMatch.id) ? currentMatch.id : `BB-${Date.now()}`;

            const newMatch: BasketballMatch = {
                id: matchId,
                locationId: initialLocation.id,
                teamA: hostTeam,
                teamB: visitorTeam,
                status: 'Live',
                createdAt: new Date().toISOString(),
                sport: SportType.BASKETBALL,
                quarter: 1,
                tossWinner,
                optedTo,
                possession: initialPossession,
                teamAData: initTeamData(hostTeam, hostPlayers),
                teamBData: initTeamData(visitorTeam, visitorPlayers),
                namingMode
            };
            persistCurrentMatch(newMatch);
            setView('live');
            setShotClock(24);
            setIsShotClockRunning(false);
        }
        setShowMatchInProgressModal(false);
    };

    const updateStats = (team: 'A' | 'B', update: (stats: TeamStats) => void) => {
        if (!currentMatch) return;
        const updated = JSON.parse(JSON.stringify(currentMatch)) as BasketballMatch;
        const stats = team === 'A' ? updated.teamAData : updated.teamBData;
        update(stats);
        persistCurrentMatch(updated);
    };

    const handleScore = (team: 'A' | 'B', pts: number, playerIdx?: number) => {
        updateStats(team, (stats) => {
            stats.score += pts;
            if (pts === 1) stats.shots.onePt++;
            else if (pts === 2) stats.shots.twoPt++;
            else if (pts === 3) stats.shots.threePt++;

            if (playerIdx !== undefined && stats.players[playerIdx]) {
                stats.players[playerIdx].points += pts;
            }
        });
        resetShotClock(24);
        // Automatically switch possession after score? Usually yes in basketball.
        if (currentMatch) {
            persistCurrentMatch({ ...currentMatch, possession: team === 'A' ? 'B' : 'A' });
        }
    };

    const handleStat = (team: 'A' | 'B', stat: keyof TeamStats | 'foul', playerIdx?: number) => {
        if (!currentMatch) return;
        updateStats(team, (stats) => {
            if (stat === 'foul') {
                stats.fouls[currentMatch.quarter - 1]++;
                if (playerIdx !== undefined && stats.players[playerIdx]) {
                    stats.players[playerIdx].fouls++;
                }
            } else if (stat === 'timeouts') {
                if (stats.timeouts > 0) stats.timeouts--;
            } else if (typeof (stats as any)[stat] === 'number') {
                (stats as any)[stat]++;
                if (playerIdx !== undefined && stats.players[playerIdx]) {
                    const p = stats.players[playerIdx];
                    if (stat === 'rebounds') p.rebounds++;
                    else if (stat === 'assists') p.assists++;
                    else if (stat === 'steals') p.steals++;
                    else if (stat === 'blocks') p.blocks++;
                }
            }
        });
    };

    const resetShotClock = (seconds: number) => {
        setShotClock(seconds);
        setIsShotClockRunning(true);
    };

    const handleFinish = () => {
        if (!currentMatch) return;

        const targetGames = bestOf === 1 ? 1 : Math.floor(bestOf / 2) + 1;
        let gA = currentMatch.gamesWonA || 0;
        let gB = currentMatch.gamesWonB || 0;
        const gHistory = [...(currentMatch.gameHistory || []), `${currentMatch.teamAData.score}-${currentMatch.teamBData.score}`];

        if (currentMatch.teamAData.score > currentMatch.teamBData.score) gA++;
        else if (currentMatch.teamBData.score > currentMatch.teamAData.score) gB++;

        if (gA === targetGames || gB === targetGames || bestOf === 1) {
            const updated: BasketballMatch = {
                ...currentMatch,
                status: 'Finished',
                finishedAt: new Date().toISOString(),
                gamesWonA: gA,
                gamesWonB: gB,
                gameHistory: gHistory
            };
            persistCurrentMatch(updated);
            storage.clearPageState(PAGE_ID);
            syncMatchResult(updated);
            setSeriesResultData({
                winner: gA > gB ? hostTeam : visitorTeam,
                score: `${gA} - ${gB}`,
                isFinal: true
            });
            setShowSeriesResult(true);
        } else {
            const updated: BasketballMatch = {
                ...currentMatch,
                quarter: 1,
                gamesWonA: gA,
                gamesWonB: gB,
                gameHistory: gHistory,
                teamAData: { ...currentMatch.teamAData, score: 0, fouls: [0, 0, 0, 0] },
                teamBData: { ...currentMatch.teamBData, score: 0, fouls: [0, 0, 0, 0] }
            };
            persistCurrentMatch(updated);
            setShotClock(24);
            setIsShotClockRunning(false);
            setSeriesResultData({
                winner: currentMatch.teamAData.score > currentMatch.teamBData.score ? hostTeam : visitorTeam,
                score: `${gA} - ${gB}`,
                isFinal: false
            });
            setShowSeriesResult(true);
        }
    };

    const resumeMatch = (match: BasketballMatch) => {
        const dummyTeamData = (name: string): TeamStats => ({
            score: 0, timeouts: 4, fouls: [0, 0, 0, 0], rebounds: 0, assists: 0, steals: 0, blocks: 0,
            shots: { onePt: 0, twoPt: 0, threePt: 0 }, players: []
        });

        const sanitized = {
            ...match,
            teamAData: match.teamAData || dummyTeamData(match.teamA),
            teamBData: match.teamBData || dummyTeamData(match.teamB)
        };

        setCurrentMatch(sanitized);
        setView(match.status === 'Finished' ? 'review' : 'live');
    };

    const togglePossession = () => {
        if (!currentMatch) return;
        persistCurrentMatch({ ...currentMatch, possession: currentMatch.possession === 'A' ? 'B' : 'A' });
    };

    const renderPlayerNamesSetup = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div className="space-y-3 p-4 bg-background-secondary/50 rounded-2xl border border-border/50">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-[#F97316] flex items-center gap-2"><Users className="w-4 h-4" /> {hostTeam || 'Team A'} Squad</h3>
                <div className="max-h-[300px] overflow-y-auto pr-2 no-scrollbar space-y-2">
                    {Array.from({ length: teamSize }).map((_, i) => (
                        <input key={`h-${i}`} value={hostPlayerNames[i] || ''} onChange={e => {
                            const newNames = [...hostPlayerNames];
                            newNames[i] = e.target.value;
                            setHostPlayerNames(newNames);
                        }} placeholder={`Player ${i + 1}`} className="w-full p-3 bg-background border border-border/50 rounded-xl font-bold outline-none focus:border-[#F97316] transition-all" />
                    ))}
                </div>
            </div>
            <div className="space-y-3 p-4 bg-background-secondary/50 rounded-2xl border border-border/50">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-success flex items-center gap-2"><Users className="w-4 h-4" /> {visitorTeam || 'Team B'} Squad</h3>
                <div className="max-h-[300px] overflow-y-auto pr-2 no-scrollbar space-y-2">
                    {Array.from({ length: teamSize }).map((_, i) => (
                        <input key={`v-${i}`} value={visitorPlayerNames[i] || ''} onChange={e => {
                            const newNames = [...visitorPlayerNames];
                            newNames[i] = e.target.value;
                            setVisitorPlayerNames(newNames);
                        }} placeholder={`Player ${i + 1}`} className="w-full p-3 bg-background border border-border/50 rounded-xl font-bold outline-none focus:border-success transition-all" />
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col flex-1 min-h-screen relative overflow-hidden transition-all duration-300"
            style={{ backgroundColor: theme.colors.background }}>
            <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] pointer-events-none opacity-20" style={{ backgroundColor: theme.colors.accent }} />
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] pointer-events-none opacity-20" style={{ backgroundColor: theme.colors.success }} />

            <header className="backdrop-blur-3xl p-4 md:p-6 flex justify-between items-center border-b sticky top-0 z-50 transition-all shadow-theme-card"
                style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shadow-theme-elevated"
                        style={{ backgroundColor: '#F97316', color: 'white' }}>
                        <img src="/logo.png" className="w-6 h-6 md:w-8 md:h-8 object-contain" alt="Boxitt" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-black italic tracking-tighter uppercase leading-none" style={{ color: theme.colors.textPrimary }}>Boxitt <span style={{ color: '#F97316' }}>Basketball</span></h1>
                        <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em] mt-1" style={{ color: theme.colors.textDisabled }}>Elite Scorer</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 md:gap-4">
                    <ThemeSelector />
                    {view === 'live' && (
                        <button
                            onClick={() => setView('setup')}
                            className="px-5 py-2.5 md:px-6 md:py-3 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all shadow-theme-elevated border"
                            style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border, color: theme.colors.textPrimary }}
                        >
                            Edit
                        </button>
                    )}
                    {(view === 'live' || view === 'review' || view === 'setup') && (
                        <button onClick={() => setView('history')} className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all border shadow-theme-card"
                            style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border, color: theme.colors.textPrimary }}>
                            <History className="w-5 h-5" />
                        </button>
                    )}
                    <button onClick={onBack} className="px-5 py-2.5 md:px-8 md:py-4 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all shadow-theme-elevated active:translate-y-1"
                        style={{ backgroundColor: theme.colors.textPrimary, color: theme.colors.background }}>Exit</button>
                </div>
            </header>

            <main className="flex-1 p-4 md:p-8 relative z-10 overflow-hidden max-w-7xl mx-auto w-full">
                <AnimatePresence mode="wait">
                    {view === 'history' && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                            <div className="flex justify-between items-center">
                                <div className="space-y-1">
                                    <h2 className="text-xs font-black uppercase tracking-[0.4em] text-text-disabled">{initialLocation.name}</h2>
                                    <div className="flex items-center gap-2 text-[#F97316]">
                                        <History className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Match Archives</span>
                                    </div>
                                </div>
                                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setView('setup')}
                                               className="bg-[#F97316] text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 transition-all">
                                    <Plus className="w-4 h-4" /> New Match
                                </motion.button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {matches.length === 0 ? (
                                    <div className="py-20 text-center bg-card/30 rounded-3xl border-2 border-dashed border-border/50 col-span-full">
                                        <p className="font-black uppercase text-[10px] tracking-[0.4em] text-text-disabled">No match records found</p>
                                    </div>
                                ) : (
                                    matches.map((m, idx) => (
                                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} key={m.id}
                                                    className="p-8 md:p-10 border border-border bg-card rounded-2xl shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
                                            <div className="absolute top-0 right-0 w-24 h-24 blur-[50px] rounded-full opacity-5 group-hover:opacity-20 transition-opacity" style={{ backgroundColor: '#F97316' }} />
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
                                                  <span className="text-[10px] font-black uppercase tracking-widest opacity-40">BASKETBALL</span>
                                                  <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${m.status === 'Live' ? 'bg-[#F97316] text-white animate-pulse' : 'bg-text-disabled/10 text-text-disabled'}`}>{m.status}</span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 items-center gap-8 mb-10">
                                                <div className="text-center">
                                                    <p className="text-lg md:text-xl font-black uppercase italic mb-2 line-clamp-2 break-words">{m.teamA}</p>
                                                    <p className="text-4xl md:text-5xl font-black italic text-text-primary">{m.teamAData.score}</p>
                                                </div>
                                                <div className="flex flex-col items-center">
                                                  <div className="w-12 h-12 rounded-full border-2 flex items-center justify-center shadow-theme-card bg-background-secondary border-border">
                                                     <span className="text-xs font-black italic opacity-40 text-accent">VS</span>
                                                  </div>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-lg md:text-xl font-black uppercase italic mb-2 line-clamp-2 break-words">{m.teamB}</p>
                                                    <p className="text-4xl md:text-5xl font-black italic text-text-primary">{m.teamBData.score}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-4">
                                                {m.status?.toLowerCase() === 'live' && (
                                                    <button
                                                        onClick={() => {
                                                            setCurrentMatch(m);
                                                            setHostTeam(m.teamA);
                                                            setVisitorTeam(m.teamB);
                                                            setHostPlayerNames(m.teamAData.players.map(p => p.name));
                                                            setVisitorPlayerNames(m.teamBData.players.map(p => p.name));
                                                            setView('setup');
                                                        }}
                                                        className="w-14 h-14 rounded-xl bg-background-secondary border border-border flex items-center justify-center hover:border-[#F97316] transition-all shadow-sm"
                                                    >
                                                        <Settings className="w-6 h-6 text-text-secondary" />
                                                    </button>
                                                )}
                                                <button onClick={() => resumeMatch(m)} className="flex-1 py-4 bg-text-primary text-background rounded-xl font-black uppercase tracking-widest hover:bg-[#F97316] hover:text-white transition-all shadow-theme-elevated flex items-center justify-center gap-3 text-xs md:text-sm tabular-nums">
                                                    {m.status === 'Finished' ? <Trophy className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                                    {m.status === 'Finished' ? 'View Performance' : 'Resume Live Court'}
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}

                    {view === 'setup' && (
                        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="pb-20 max-w-4xl mx-auto">
                            <div className="text-center mb-8">
                                <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter text-text-primary">Match <span className="text-[#F97316]">Initialization</span></h2>
                                <p className="text-[9px] font-black uppercase tracking-[0.4em] text-text-disabled mt-1">Configure teams and toss</p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                <div className="lg:col-span-7 space-y-4">
                                    <div className="bg-card p-6 border border-border rounded-[2rem] shadow-2xl space-y-6 relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-48 h-48 blur-[80px] rounded-full opacity-5 pointer-events-none" style={{ backgroundColor: '#F97316' }} />
                                        <div className="grid grid-cols-2 gap-4 relative z-10">
                                            <div className="space-y-1.5">
                                                <label className="text-[8px] font-black uppercase tracking-[0.4em] text-text-disabled ml-1">Team Alpha (Home)</label>
                                                <input value={hostTeam} onChange={e => setHostTeam(e.target.value)} placeholder="ENTER TEAM NAME" className="w-full p-3 bg-background-secondary border-2 border-transparent focus:border-[#F97316] rounded-xl font-black italic outline-none uppercase tracking-tighter shadow-inner text-sm" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[8px] font-black uppercase tracking-[0.4em] text-text-disabled ml-1">Team Beta (Away)</label>
                                                <input value={visitorTeam} onChange={e => setVisitorTeam(e.target.value)} placeholder="ENTER TEAM NAME" className="w-full p-3 bg-background-secondary border-2 border-transparent focus:border-[#F97316] rounded-xl font-black italic outline-none uppercase tracking-tighter shadow-inner text-sm" />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 relative z-10 pt-4 border-t border-border/30">
                                            <label className="text-[8px] font-black uppercase tracking-[0.4em] text-text-disabled ml-1">Squad Size (Max 12)</label>
                                            <div className="flex items-center gap-4 bg-background-secondary p-1.5 rounded-xl shadow-inner">
                                                <input type="number" min="1" max="12" value={teamSize} onChange={e => setTeamSize(parseInt(e.target.value) || 5)} className="flex-1 bg-transparent p-1.5 font-black text-xl outline-none text-center" />
                                                <div className="h-6 w-px bg-border" />
                                                <span className="pr-4 text-[9px] font-black text-text-disabled uppercase tracking-widest">Active Players</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex rounded-2xl bg-background-secondary p-1.5 border border-border shadow-sm">
                                            <button onClick={() => setNamingMode('default')} className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${namingMode === 'default' ? 'bg-[#F97316] text-white shadow-lg' : 'text-text-disabled'}`}>Auto Identifiers</button>
                                            <button onClick={() => setNamingMode('custom')} className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${namingMode === 'custom' ? 'bg-[#F97316] text-white shadow-lg' : 'text-text-disabled'}`}>Custom Roster</button>
                                        </div>
                                        {namingMode === 'custom' && renderPlayerNamesSetup()}
                                    </div>
                                </div>

                                <div className="lg:col-span-5 space-y-6">
                                    <div className="bg-card p-8 border border-border rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                                        <div className="absolute bottom-0 right-0 w-48 h-48 blur-[80px] rounded-full opacity-5" style={{ backgroundColor: theme.colors.success }} />
                                        <div className="flex justify-between items-center relative z-10">
                                            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-text-disabled">Match Toss</h3>
                                            <button onClick={handleToss} disabled={isCoinSpinning} className="px-6 py-2 bg-[#F97316] text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-theme-elevated disabled:opacity-50">
                                                <RotateCcw className={`w-3.5 h-3.5 ${isCoinSpinning ? 'animate-spin' : ''}`} /> {isCoinSpinning ? 'Spinning...' : 'Spin Coin'}
                                            </button>
                                        </div>

                                        <div className="flex flex-col items-center py-6 relative z-10">
                                            <div className="relative w-32 h-32" style={{ perspective: '1000px' }}>
                                                <motion.div
                                                    key={spinKey}
                                                    initial={{ rotateY: 0, y: 0, scale: 1 }}
                                                    animate={{
                                                        rotateY: coinAngle,
                                                        scale: isCoinSpinning ? [1, 1.1, 1] : 1,
                                                        y: isCoinSpinning ? [0, -50, 0] : 0,
                                                    }}
                                                    transition={isCoinSpinning ? {
                                                        rotateY: { duration: coinSpinDuration, ease: [0.22, 0.95, 0.36, 1] },
                                                        y: { duration: coinSpinDuration, times: [0, 0.45, 1], ease: "easeInOut" },
                                                        scale: { duration: coinSpinDuration, times: [0, 0.45, 1], ease: "easeInOut" }
                                                    } : {
                                                        rotateY: { type: "spring", damping: 16, stiffness: 130 },
                                                        scale: { duration: 0.25 },
                                                        y: { duration: 0.25 },
                                                    }}
                                                    className="w-full h-full relative"
                                                    style={{ transformStyle: 'preserve-3d' }}>
                                                    <div className="absolute inset-0 rounded-full border-8 border-amber-300 flex items-center justify-center bg-gradient-to-br from-amber-400 to-amber-600 shadow-2xl" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(0deg) translateZ(1px)' }}>
                                                        <Trophy className="w-12 h-12 text-amber-900 opacity-50" />
                                                    </div>
                                                    <div className="absolute inset-0 rounded-full border-8 border-slate-300 flex items-center justify-center bg-gradient-to-br from-slate-400 to-slate-600 shadow-2xl" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg) translateZ(1px)' }}>
                                                        <Activity className="w-12 h-12 text-slate-900 opacity-50" />
                                                    </div>
                                                </motion.div>
                                            </div>

                                            <AnimatePresence mode="wait">
                                                {tossResult && tossResult !== 'spinning' && (
                                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ y: -10, opacity: 0 }} className="mt-8 text-center">
                                                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-success mb-1">Toss Result</p>
                                                        <h4 className="text-xl font-black italic uppercase text-text-primary">{tossResult} Wins</h4>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        <div className="space-y-6 pt-6 border-t border-border/30 relative z-10">
                                            <div className="flex justify-between items-center px-1">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-text-disabled">Series Format</span>
                                                <div className="flex gap-2">
                                                    {[1, 3, 5, 7].map(num => (
                                                        <button key={num} onClick={() => setBestOf(num)}
                                                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black transition-all border ${bestOf === num ? 'bg-[#F97316] text-white border-[#F97316] shadow-sm' : 'border-border text-text-disabled hover:border-[#F97316]/30'}`}>
                                                            B of {num}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <button onClick={() => setTossWinner('host')} className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${tossWinner === 'host' ? 'bg-[#F97316] text-white border-[#F97316] shadow-lg' : 'border-border text-text-disabled hover:border-[#F97316]/30'}`}>{hostTeam || 'Team A'}</button>
                                                <button onClick={() => setTossWinner('visitor')} className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${tossWinner === 'visitor' ? 'bg-[#F97316] text-white border-[#F97316] shadow-lg' : 'border-border text-text-disabled hover:border-[#F97316]/30'}`}>{visitorTeam || 'Team B'}</button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <button onClick={() => setOptedTo('Ball')} className={`py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${optedTo === 'Ball' ? 'bg-success/10 border-success text-success shadow-inner' : 'border-border text-text-disabled hover:border-success/30'}`}>Choose Ball</button>
                                                <button onClick={() => setOptedTo('Defense')} className={`py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${optedTo === 'Defense' ? 'bg-success/10 border-success text-success shadow-inner' : 'border-border text-text-disabled hover:border-success/30'}`}>Choose Def.</button>
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={handleStartScoringClick} className="w-full py-6 bg-[#F97316] text-white rounded-[2.5rem] font-black uppercase tracking-[0.4em] shadow-2xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98]">
                                        <Play className="w-5 h-5 fill-current" /> Begin Match
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {view === 'live' && currentMatch && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 pb-32 max-w-6xl mx-auto">
                            <div className="flex justify-end gap-3 mb-4">
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
                            {/* PROFESSIONAL SCOREBOARD */}
                            <div className="bg-slate-950 rounded-[2.5rem] border-[4px] border-slate-900 shadow-2xl overflow-hidden relative">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(249,115,22,0.1),transparent)] pointer-events-none" />

                                <div className="bg-slate-900 px-6 py-3 flex justify-between items-center border-b border-slate-800 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800 shadow-inner">
                                            {[1, 2, 3, 4].map(q => (
                                                <button key={q} onClick={() => currentMatch && persistCurrentMatch({ ...currentMatch, quarter: q })}
                                                        className={`px-3 py-1 rounded-md text-[9px] font-black transition-all uppercase tracking-widest ${(currentMatch?.quarter || 0) === q ? 'bg-[#F97316] text-white shadow-lg' : 'text-slate-600 hover:text-slate-400'}`}>Q{q}</button>
                                            ))}
                                        </div>
                                        <div className="w-px h-6 bg-slate-800" />
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col items-center">
                                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-[0.2em] mb-0.5">Shot Clock</span>
                                                <div className="flex items-center gap-2">
                                                    <Timer className={`w-3 h-3 ${shotClock <= 5 ? 'text-red-500 animate-pulse' : 'text-[#F97316]'}`} />
                                                    <span className={`text-2xl font-mono font-black tabular-nums ${shotClock <= 5 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{shotClock.toString().padStart(2, '0')}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-500 mb-1">Quarter Progress</p>
                                        <div className="w-32 h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 shadow-inner">
                                            <motion.div initial={{ width: 0 }} animate={{ width: `${((currentMatch?.quarter || 0) / 4) * 100}%` }} className="h-full bg-gradient-to-r from-[#F97316] to-[#fb923c] shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
                                        </div>
                                    </div>
                                </div>

                                <div className="p-8 md:p-12 grid grid-cols-3 items-center relative z-10">
                                    <div className="text-center space-y-4">
                                        <div className="flex flex-col items-center gap-1">
                                            <p className="text-xs font-black uppercase tracking-[0.4em] text-slate-500 line-clamp-2 break-words px-2">{currentMatch?.teamA || 'Team A'}</p>
                                            {currentMatch?.possession === 'A' && <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }} className="px-2 py-0.5 bg-[#F97316] text-white text-[7px] font-black rounded-full shadow-[0_0_15px_rgba(249,115,22,0.6)]">POSSESSION</motion.div>}
                                        </div>
                                        <motion.div key={currentMatch?.teamAData?.score || 0} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-7xl md:text-8xl font-black italic text-white drop-shadow-[0_0_30px_rgba(249,115,22,0.3)] tabular-nums">{currentMatch?.teamAData?.score || 0}</motion.div>
                                    </div>

                                    <div className="flex flex-col items-center">
                                        <div className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md mb-6 shadow-xl"><span className="text-[8px] font-black text-[#F97316] italic tracking-[0.3em] uppercase">Live</span></div>
                                        <div className="h-12 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                                        <button onClick={togglePossession} className="mt-4 p-2 bg-slate-900 border border-slate-800 rounded-full text-slate-500 hover:text-[#F97316] transition-all"><RotateCcw className="w-4 h-4" /></button>
                                    </div>

                                    <div className="text-center space-y-4">
                                        <div className="flex flex-col items-center gap-1">
                                            <p className="text-sm font-black uppercase tracking-[0.4em] text-slate-500 line-clamp-2 break-words px-2">{currentMatch?.teamB || 'Team B'}</p>
                                            {currentMatch?.possession === 'B' && <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }} className="px-2 py-0.5 bg-success text-white text-[7px] font-black rounded-full shadow-[0_0_15px_rgba(16,185,129,0.6)]">POSSESSION</motion.div>}
                                        </div>
                                        <motion.div key={currentMatch?.teamBData?.score || 0} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-7xl md:text-8xl font-black italic text-white drop-shadow-[0_0_30px_rgba(249,115,22,0.3)] tabular-nums">{currentMatch?.teamBData?.score || 0}</motion.div>
                                    </div>
                                </div>

                                <div className="bg-slate-900/50 px-12 py-5 grid grid-cols-2 border-t border-slate-800 relative z-10 backdrop-blur-md">
                                    <div className="flex items-center gap-6">
                                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Team Fouls (Q{currentMatch?.quarter || 1})</span>
                                        <div className="flex gap-2">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <div key={i} className={`w-8 h-2.5 rounded-sm transition-all duration-500 ${i < (currentMatch?.teamAData?.fouls?.[currentMatch.quarter - 1] || 0) ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-slate-950 shadow-inner'}`} />
                                            ))}
                                            {(currentMatch?.teamAData?.fouls?.[currentMatch.quarter - 1] || 0) >= 5 && <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 0.8 }} className="text-[9px] font-black text-red-500 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 ml-3 tracking-widest">BONUS</motion.span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6 justify-end">
                                        <div className="flex gap-2">
                                            {(currentMatch?.teamBData?.fouls?.[(currentMatch?.quarter || 1) - 1] || 0) >= 5 && <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 0.8 }} className="text-[9px] font-black text-red-500 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 mr-3 tracking-widest">BONUS</motion.span>}
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <div key={i} className={`w-8 h-2.5 rounded-sm transition-all duration-500 ${i < (currentMatch?.teamBData?.fouls?.[(currentMatch?.quarter || 1) - 1] || 0) ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-slate-950 shadow-inner'}`} />
                                            ))}
                                        </div>
                                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">(Q{currentMatch?.quarter || 1}) Team Fouls</span>
                                    </div>
                                </div>
                            </div>

                            {/* TACTICAL CONSOLE */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="bg-card p-8 border border-border rounded-[2.5rem] shadow-sm relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-32 h-32 blur-[60px] rounded-full opacity-5 group-hover:opacity-10 transition-opacity" style={{ backgroundColor: '#F97316' }} />
                                        <div className="flex justify-between items-center mb-6 px-2 relative z-10">
                                            <div className="flex flex-col">
                                                <h3 className="text-sm font-black uppercase text-[#F97316] tracking-widest">{currentMatch?.teamA || 'Team A'}</h3>
                                                <p className="text-[9px] font-black text-text-disabled uppercase">Console</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleStat('A', 'timeouts')} className="px-4 py-2 bg-background-secondary border border-border rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-[#F97316]/50 transition-all active:scale-95 shadow-sm">Timeout</button>
                                                <button onClick={() => handleStat('A', 'foul')} className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all active:scale-95 shadow-sm">+ Foul</button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 mb-8 relative z-10">
                                            {[1, 2, 3].map(pts => (
                                                <motion.button key={pts} whileTap={{ scale: 0.95 }} onClick={() => handleScore('A', pts)} className="py-8 bg-[#F97316]/5 text-[#F97316] border-2 border-[#F97316]/20 rounded-3xl font-black text-3xl hover:bg-[#F97316] hover:text-white transition-all shadow-sm">+{pts}</motion.button>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-4 gap-3 relative z-10">
                                            <MetricControl label="REB" icon={<ArrowUp className="w-4 h-4" />} onClick={() => handleStat('A', 'rebounds')} />
                                            <MetricControl label="AST" icon={<Share2 className="w-4 h-4" />} onClick={() => handleStat('A', 'assists')} />
                                            <MetricControl label="STL" icon={<Zap className="w-4 h-4" />} onClick={() => handleStat('A', 'steals')} />
                                            <MetricControl label="BLK" icon={<Shield className="w-4 h-4" />} onClick={() => handleStat('A', 'blocks')} />
                                        </div>
                                    </div>

                                    {/* Player Tracking Team A */}
                                    <div className="bg-card p-6 border border-border rounded-[2.5rem] shadow-sm relative overflow-hidden">
                                        <div className="flex justify-between items-center mb-4 px-2">
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-text-disabled">Individual Stats</h4>
                                            <button onClick={() => setShowScorecardModal('A')} className="p-2 hover:bg-background-secondary rounded-lg transition-all text-[#F97316]"><ChevronRight className="w-4 h-4" /></button>
                                        </div>
                                        <div className="max-h-[350px] overflow-y-auto no-scrollbar">
                                            <table className="w-full text-left">
                                                <thead className="text-[9px] font-black uppercase text-text-disabled border-b border-border/50 sticky top-0 bg-card z-10">
                                                    <tr><th className="pb-3 px-2">Player</th><th className="pb-3 text-center">PTS</th><th className="pb-3 text-center">FLS</th><th className="pb-3 text-right pr-2">Actions</th></tr>
                                                </thead>
                                                <tbody className="divide-y divide-border/30">
                                                    {(currentMatch?.teamAData?.players || []).filter(p => p).map((p, i) => (
                                                        <tr key={i} className="group hover:bg-background-secondary/50 transition-all">
                                                            <td className="py-4 px-2 text-[11px] font-bold text-text-primary">{p.name}</td>
                                                            <td className="py-4 text-center font-black text-[#F97316] text-sm">{p.points}</td>
                                                            <td className={`py-4 text-center font-black text-sm ${p.fouls >= 5 ? 'text-red-500' : 'text-text-disabled'}`}>{p.fouls}</td>
                                                            <td className="py-4 text-right pr-2">
                                                                <div className="flex justify-end gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                                                    <button onClick={() => handleScore('A', 2, i)} className="p-2 hover:bg-[#F97316]/10 rounded-xl transition-all"><Target className="w-4 h-4 text-[#F97316]" /></button>
                                                                    <button onClick={() => handleStat('A', 'foul', i)} className="p-2 hover:bg-red-500/10 rounded-xl transition-all"><Hand className="w-4 h-4 text-red-500" /></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="bg-card p-8 border border-border rounded-[2.5rem] shadow-sm relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-32 h-32 blur-[60px] rounded-full opacity-5 group-hover:opacity-10 transition-opacity" style={{ backgroundColor: theme.colors.success }} />
                                        <div className="flex justify-between items-center mb-6 px-2 relative z-10">
                                            <div className="flex flex-col">
                                                <h3 className="text-sm font-black uppercase text-success tracking-widest">{currentMatch?.teamB || 'Team B'}</h3>
                                                <p className="text-[9px] font-black text-text-disabled uppercase">Console</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleStat('B', 'timeouts')} className="px-4 py-2 bg-background-secondary border border-border rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-success/50 transition-all active:scale-95 shadow-sm">Timeout</button>
                                                <button onClick={() => handleStat('B', 'foul')} className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all active:scale-95 shadow-sm">+ Foul</button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 mb-8 relative z-10">
                                            {[1, 2, 3].map(pts => (
                                                <motion.button key={pts} whileTap={{ scale: 0.95 }} onClick={() => handleScore('B', pts)} className="py-8 bg-success/5 text-success border-2 border-success/20 rounded-3xl font-black text-3xl hover:bg-success hover:text-white transition-all shadow-sm">+{pts}</motion.button>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-4 gap-3 relative z-10">
                                            <MetricControl label="REB" icon={<ArrowUp className="w-4 h-4" />} onClick={() => handleStat('B', 'rebounds')} accent="success" />
                                            <MetricControl label="AST" icon={<Share2 className="w-4 h-4" />} onClick={() => handleStat('B', 'assists')} accent="success" />
                                            <MetricControl label="STL" icon={<Zap className="w-4 h-4" />} onClick={() => handleStat('B', 'steals')} accent="success" />
                                            <MetricControl label="BLK" icon={<Shield className="w-4 h-4" />} onClick={() => handleStat('B', 'blocks')} accent="success" />
                                        </div>
                                    </div>

                                    {/* Player Tracking Team B */}
                                    <div className="bg-card p-6 border border-border rounded-[2.5rem] shadow-sm relative overflow-hidden">
                                        <div className="flex justify-between items-center mb-4 px-2">
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-text-disabled">Individual Stats</h4>
                                            <button onClick={() => setShowScorecardModal('B')} className="p-2 hover:bg-background-secondary rounded-lg transition-all text-success"><ChevronRight className="w-4 h-4" /></button>
                                        </div>
                                        <div className="max-h-[350px] overflow-y-auto no-scrollbar">
                                            <table className="w-full text-left">
                                                <thead className="text-[9px] font-black uppercase text-text-disabled border-b border-border/50 sticky top-0 bg-card z-10">
                                                    <tr><th className="pb-3 px-2">Player</th><th className="pb-3 text-center">PTS</th><th className="pb-3 text-center">FLS</th><th className="pb-3 text-right pr-2">Actions</th></tr>
                                                </thead>
                                                <tbody className="divide-y divide-border/30">
                                                    {(currentMatch?.teamBData?.players || []).filter(p => p).map((p, i) => (
                                                        <tr key={i} className="group hover:bg-background-secondary/50 transition-all">
                                                            <td className="py-4 px-2 text-[11px] font-bold text-text-primary">{p.name}</td>
                                                            <td className="py-4 text-center font-black text-success text-sm">{p.points}</td>
                                                            <td className={`py-4 text-center font-black text-sm ${p.fouls >= 5 ? 'text-red-500' : 'text-text-disabled'}`}>{p.fouls}</td>
                                                            <td className="py-4 text-right pr-2">
                                                                <div className="flex justify-end gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                                                    <button onClick={() => handleScore('B', 2, i)} className="p-2 hover:bg-success/10 rounded-xl transition-all"><Target className="w-4 h-4 text-success" /></button>
                                                                    <button onClick={() => handleStat('B', 'foul', i)} className="p-2 hover:bg-red-500/10 rounded-xl transition-all"><Hand className="w-4 h-4 text-red-500" /></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-center pt-12">
                                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleFinish} className="px-16 py-6 bg-red-600 text-white rounded-[2.5rem] font-black uppercase tracking-[0.4em] text-xs shadow-2xl flex items-center gap-4 transition-all hover:bg-red-500 active:translate-y-1"><XCircle className="w-6 h-6" /> Finalize Session</motion.button>
                            </div>
                        </motion.div>
                    )}

                    {view === 'review' && currentMatch && (
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 pb-32 max-w-6xl mx-auto">
                            <div className="bg-card p-10 border border-border rounded-[3rem] text-center relative overflow-hidden shadow-2xl">
                                <div className="absolute top-0 right-0 w-80 h-80 blur-[120px] rounded-full bg-success/5 pointer-events-none" />
                                <Trophy className="w-16 h-16 text-[#F97316] mx-auto mb-6 drop-shadow-[0_0_20px_rgba(249,115,22,0.4)]" />
                                <h2 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-text-primary mb-2">
                                    {bestOf > 1 ? (
                                        currentMatch.gamesWonA === currentMatch.gamesWonB ? "Series Draw" :
                                        currentMatch.gamesWonA! > currentMatch.gamesWonB! ? `${currentMatch.teamA} Series Win` : `${currentMatch.teamB} Series Win`
                                    ) : (
                                        currentMatch?.teamAData?.score === currentMatch?.teamBData?.score ? "Draw Match" : (currentMatch?.teamAData?.score || 0) > (currentMatch?.teamBData?.score || 0) ? `${currentMatch?.teamA || 'Team A'} Victory` : `${currentMatch?.teamB || 'Team B'} Victory`
                                    )}
                                </h2>
                                <p className="text-[9px] font-black uppercase tracking-[0.4em] text-text-disabled mb-8">Performance Summary Report</p>
                                <div className="flex justify-center items-center gap-12 relative z-10">
                                    <div className="flex-1 space-y-3">
                                        <p className="text-[10px] font-black uppercase text-text-disabled truncate">{hostTeam}</p>
                                        <div className="text-6xl md:text-7xl font-black italic tracking-tighter text-text-primary drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                                            {bestOf > 1 ? currentMatch.gamesWonA : (currentMatch?.teamAData?.score || 0)}
                                        </div>
                                        <div className="h-1.5 w-12 bg-[#F97316] rounded-full mx-auto" />
                                        {bestOf > 1 && <p className="text-[8px] font-black text-text-disabled uppercase tracking-[0.2em]">Games Won</p>}
                                    </div>

                                    <div className="flex flex-col items-center">
                                        <div className="w-12 h-12 rounded-full border border-border flex items-center justify-center bg-background">
                                            <span className="text-xs font-black italic opacity-20">VS</span>
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-3">
                                        <p className="text-[10px] font-black uppercase text-text-disabled truncate">{visitorTeam}</p>
                                        <div className="text-6xl md:text-7xl font-black italic tracking-tighter text-text-primary drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                                            {bestOf > 1 ? currentMatch.gamesWonB : (currentMatch?.teamBData?.score || 0)}
                                        </div>
                                        <div className="h-1.5 w-12 bg-[#F97316] rounded-full mx-auto" />
                                        {bestOf > 1 && <p className="text-[8px] font-black text-text-disabled uppercase tracking-[0.2em]">Games Won</p>}
                                    </div>
                                </div>

                                {bestOf > 1 && currentMatch.gameHistory && (
                                    <div className="mt-12 flex justify-center gap-3 overflow-x-auto no-scrollbar pb-2">
                                        {currentMatch.gameHistory.map((gh, i) => (
                                            <div key={i} className="flex-shrink-0 px-5 py-3 bg-background-secondary/50 border border-border/40 rounded-2xl flex flex-col items-center min-w-[100px] backdrop-blur-sm">
                                                <span className="text-[8px] font-black text-text-disabled uppercase tracking-tighter mb-1.5">Game {i+1}</span>
                                                <span className="text-[11px] font-black text-[#F97316] italic tracking-tighter uppercase">{gh}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="mt-8 flex justify-center">
                                    <div className="px-5 py-2 rounded-full bg-background-secondary border border-border text-[10px] font-black uppercase tracking-widest text-text-disabled">
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
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <StatsSummaryCard team={currentMatch?.teamA || 'Team A'} stats={currentMatch?.teamAData || {} as any} accent="#F97316" />
                                <StatsSummaryCard team={currentMatch?.teamB || 'Team B'} stats={currentMatch?.teamBData || {} as any} accent="#10B981" />
                            </div>

                            <div className="flex justify-center pt-12">
                                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setView('history')} className="px-16 py-6 bg-text-primary text-background rounded-[2.5rem] font-black uppercase tracking-[0.4em] text-xs shadow-2xl flex items-center gap-4 transition-all hover:bg-[#F97316] hover:text-white"><History className="w-6 h-6" /> Return to Archives</motion.button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* Scorecard Modals */}
            <AnimatePresence>
                {showScorecardModal && currentMatch && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xl p-6">
                        <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }}
                                    className="bg-card border border-border rounded-[3rem] w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
                            <div className="p-8 border-b border-border/50 flex justify-between items-center" style={{ backgroundColor: theme.colors.backgroundSecondary }}>
                                <div className="flex items-center gap-4">
                                    <div className="w-2 h-10 rounded-full" style={{ backgroundColor: showScorecardModal === 'A' ? '#F97316' : '#10B981' }} />
                                    <div>
                                        <h3 className="text-2xl font-black uppercase italic tracking-tighter" style={{ color: theme.colors.textPrimary }}>{showScorecardModal === 'A' ? currentMatch.teamA : currentMatch.teamB} Scorecard</h3>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-text-disabled">Full Session Metrics</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowScorecardModal(null)} className="p-3 hover:bg-red-500/10 hover:text-red-500 rounded-2xl transition-all"><XCircle className="w-8 h-8" /></button>
                            </div>
                             <div className="flex-1 overflow-y-auto no-scrollbar p-8">
                                <table className="w-full text-left">
                                    <thead className="text-[10px] font-black uppercase tracking-[0.2em] text-text-disabled border-b border-border/50 sticky top-0 bg-card z-10">
                                        <tr><th className="pb-4 px-2">Player Name</th><th className="pb-4 text-center">PTS</th><th className="pb-4 text-center">REB</th><th className="pb-4 text-center">AST</th><th className="pb-4 text-center">STL</th><th className="pb-4 text-center">BLK</th><th className="pb-4 text-center">FLS</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/30">
                                        {(showScorecardModal === 'A' ? currentMatch?.teamAData?.players : currentMatch?.teamBData?.players || []).filter(p => p).map((p, i) => (
                                            <tr key={i} className="hover:bg-background-secondary/30 transition-all">
                                                <td className="py-5 px-2 text-sm font-bold text-text-primary">{p.name}</td>
                                                <td className="py-5 text-center font-black text-lg" style={{ color: showScorecardModal === 'A' ? '#F97316' : '#10B981' }}>{p.points}</td>
                                                <td className="py-5 text-center font-black text-sm text-text-disabled">{p.rebounds}</td>
                                                <td className="py-5 text-center font-black text-sm text-text-disabled">{p.assists}</td>
                                                <td className="py-5 text-center font-black text-sm text-text-disabled">{p.steals}</td>
                                                <td className="py-5 text-center font-black text-sm text-text-disabled">{p.blocks}</td>
                                                <td className={`py-5 text-center font-black text-sm ${p.fouls >= 5 ? 'text-red-500 bg-red-500/5 rounded-lg' : 'text-text-disabled'}`}>{p.fouls}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
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
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-6">
                        <motion.div initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 50 }}
                                    className="border rounded-[2.5rem] w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
                                    style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
                            <div className="absolute top-0 right-0 w-48 h-48 blur-[100px] rounded-full opacity-10" style={{ backgroundColor: '#F97316' }} />

                            <div className="relative z-10 flex flex-col p-8 md:p-10 overflow-hidden">
                                <div className="overflow-y-auto no-scrollbar pr-1">
                                    <div className="w-16 h-16 bg-[#F97316]/20 text-[#F97316] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner rotate-12 flex-shrink-0">
                                        <Trophy className="w-8 h-8" />
                                    </div>

                                    <h3 className="text-3xl md:text-4xl font-black mb-1 uppercase italic tracking-tighter text-center" style={{ color: theme.colors.textPrimary }}>
                                        {seriesResultData.isFinal ? 'Series ' : 'Game '}<span style={{ color: '#F97316' }}>{seriesResultData.isFinal ? 'Won!' : 'Over!'}</span>
                                    </h3>
                                    <p className="text-[9px] font-black uppercase tracking-[0.5em] text-text-disabled mb-8 text-center">Official Classification</p>

                                    <div className="bg-background-secondary/50 rounded-3xl p-6 mb-8 border border-border/50 backdrop-blur-md relative overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-br from-[#F97316]/5 to-transparent pointer-events-none" />
                                        <p className="text-[9px] font-black uppercase text-[#F97316] tracking-[0.3em] mb-6 relative z-10 text-center">Series Standings</p>

                                        <div className="flex items-center justify-between gap-2 relative z-10">
                                            <div className="flex-1 space-y-2 text-center">
                                                <p className="text-[9px] font-black uppercase text-text-disabled truncate px-1">{hostTeam}</p>
                                                <div className="text-5xl md:text-6xl font-black italic tracking-tighter text-text-primary drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                                                    {seriesResultData.score.split('-')[0].trim()}
                                                </div>
                                                <div className="h-1 w-10 bg-[#F97316] rounded-full mx-auto" />
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
                                                <div className="h-1 w-10 bg-[#F97316] rounded-full mx-auto" />
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

            {showRating && <RatingModal matchId={currentMatch?.id || `BB-${Date.now()}`} locationId={initialLocation.id} user={user} onClose={() => setShowRating(false)} />}
        </div>
    );
};

const MetricControl = ({ label, icon, onClick, accent = 'warning' }: { label: string, icon: React.ReactNode, onClick: () => void, accent?: 'warning' | 'success' }) => (
    <button onClick={onClick} className={`py-4 bg-background-secondary border border-border rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-${accent === 'warning' ? '[#F97316]' : 'success'} transition-all active:scale-95 group shadow-sm`}>
        <div className={`p-2 rounded-xl bg-background border border-border group-hover:bg-${accent === 'warning' ? '[#F97316]/10' : 'success/10'} group-hover:border-${accent === 'warning' ? '[#F97316]/20' : 'success/20'} transition-all`}>
            {React.cloneElement(icon as React.ReactElement, { className: `w-4 h-4 text-slate-400 group-hover:text-${accent === 'warning' ? '[#F97316]' : 'success'}` } as any)}
        </div>
        <span className="text-[9px] font-black uppercase tracking-widest text-text-disabled group-hover:text-text-primary transition-colors">{label}</span>
    </button>
);

const StatsSummaryCard = ({ team, stats, accent }: { team: string, stats: TeamStats, accent: string }) => (
    <div className="bg-card p-10 border border-border rounded-[3.5rem] shadow-theme-card relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-32 h-32 blur-[60px] rounded-full opacity-5 pointer-events-none" style={{ backgroundColor: accent }} />
        <h3 className="text-2xl font-black uppercase italic mb-10 flex items-center gap-4" style={{ color: accent }}><div className="w-2.5 h-10 rounded-full shadow-lg" style={{ backgroundColor: accent }} /> {team} Metrics</h3>
        <div className="grid grid-cols-2 gap-6 mb-10">
            <MetricItem label="Total Rebounds" value={stats.rebounds} icon={<ArrowUp className="w-5 h-5" />} color={accent} />
            <MetricItem label="Assists" value={stats.assists} icon={<Share2 className="w-5 h-5" />} color={accent} />
            <MetricItem label="Steals" value={stats.steals} icon={<Zap className="w-5 h-5" />} color={accent} />
            <MetricItem label="Blocks" value={stats.blocks} icon={<Shield className="w-5 h-5" />} color={accent} />
        </div>
        <div className="space-y-6 pt-10 border-t border-border/50">
            <h4 className="text-[11px] font-black uppercase text-text-disabled tracking-[0.4em] px-2">Shot Distribution</h4>
            <div className="flex gap-4">
                <div className="flex-1 bg-background-secondary/50 p-6 rounded-[2rem] text-center border border-border/30 hover:border-border transition-all"><p className="text-[9px] font-black text-text-disabled uppercase tracking-widest mb-2">1PT (FT)</p><p className="text-3xl font-black italic text-text-primary tabular-nums">{stats.shots.onePt}</p></div>
                <div className="flex-1 bg-background-secondary/50 p-6 rounded-[2rem] text-center border border-border/30 hover:border-border transition-all"><p className="text-[9px] font-black text-text-disabled uppercase tracking-widest mb-2">2PT Shot</p><p className="text-3xl font-black italic text-text-primary tabular-nums">{stats.shots.twoPt}</p></div>
                <div className="flex-1 bg-background-secondary/50 p-6 rounded-[2rem] text-center border border-border/30 hover:border-border transition-all"><p className="text-[9px] font-black text-text-disabled uppercase tracking-widest mb-2">3PT Long</p><p className="text-3xl font-black italic text-text-primary tabular-nums">{stats.shots.threePt}</p></div>
            </div>
        </div>
        <div className="mt-12">
            <div className="flex justify-between items-center mb-6 px-2">
                <h4 className="text-[11px] font-black uppercase text-text-disabled tracking-[0.4em]">Elite Performers</h4>
                <div className="w-10 h-[1px] bg-border/50" />
            </div>
            <div className="space-y-3">
                {(stats?.players || []).filter(p => p).sort((a,b) => (b.points || 0) - (a.points || 0)).slice(0, 3).map((p, i) => (
                    <div key={i} className="flex justify-between items-center p-5 bg-background-secondary/50 rounded-2xl border border-border/30 hover:bg-background-secondary transition-all">
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-[10px] font-black text-text-disabled">{i+1}</div>
                            <span className="text-sm font-bold text-text-primary">{p.name}</span>
                        </div>
                        <div className="flex gap-6">
                            <div className="flex flex-col items-center"><span className="text-[8px] font-black text-text-disabled uppercase mb-0.5">PTS</span><span className="text-sm font-black italic" style={{ color: accent }}>{p.points}</span></div>
                            <div className="flex flex-col items-center"><span className="text-[8px] font-black text-text-disabled uppercase mb-0.5">FLS</span><span className="text-sm font-black italic text-text-disabled">{p.fouls}</span></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

const MetricItem = ({ label, value, icon, color }: { label: string, value: number, icon: React.ReactNode, color: string }) => (
    <div className="bg-background-secondary/50 p-6 rounded-[2rem] flex flex-col items-center justify-center gap-3 border border-border/30 hover:border-border transition-all group">
        <div className="p-3 rounded-2xl bg-background border border-border group-hover:shadow-lg transition-all" style={{ color: color }}>{icon}</div>
        <div className="text-center">
            <p className="text-[9px] font-black uppercase text-text-disabled tracking-widest mb-1">{label}</p>
            <p className="text-3xl font-black italic text-text-primary tabular-nums">{value}</p>
        </div>
    </div>
);

export default BasketballScorer;

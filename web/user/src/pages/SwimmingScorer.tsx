import React, { useState, useEffect, useRef } from 'react';
import LoadingButton from '../components/LoadingButton';
import { useTheme } from '../contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, ChevronLeft, Play, Pause, RotateCcw, UserPlus, Trash2, CheckCircle2, Timer, Settings, History, Target, Activity } from 'lucide-react';
import RatingModal from '../components/RatingModal';
import { storage } from '../services/storage';
import { supabase } from '../services/supabase';
import { forceScrollTop } from '../utils/scroll';

interface Swimmer {
  id: string;
  name: string;
  lane: number;
  laps: number;
  finished: boolean;
  finishTime?: number;
  isRunning: boolean;
  time: number;
  splits: { lap: number; time: number; splitDuration: number }[];
  rank?: number;
}

interface SwimmingScorerProps {
  location: any;
  user: any;
  onBack: () => void;
  onAlert?: (msg: string, type: 'success' | 'error' | 'info') => void;
  onConfirm?: (config: {
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
  }) => void;
}

const SwimmingScorer: React.FC<SwimmingScorerProps> = ({ location, user, onBack, onAlert, onConfirm }) => {
  const { theme } = useTheme();
  const PAGE_ID = `swimming_scorer_${location.id}`;
  const savedState = storage.getPageState<any>(PAGE_ID) || {};

  const [view, setView] = useState<'history' | 'setup' | 'live' | 'review'>(savedState.view || 'history');

  useEffect(() => {
    return forceScrollTop();
  }, [view]);
  const [eventName, setEventName] = useState(savedState.eventName || '');
  const [heatNumber, setHeatNumber] = useState(savedState.heatNumber || '1');
  const [raceDistance, setRaceDistance] = useState(savedState.raceDistance || '100m');
  const [lapsToFinish, setLapsToFinish] = useState(savedState.lapsToFinish || 4);
  const [squadSize, setSquadSize] = useState(savedState.squadSize || 4);
  const [namingMode, setNamingMode] = useState<'auto' | 'custom'>(savedState.namingMode || 'auto');
  const [challengeId, setChallengeId] = useState<string | null>(savedState.challengeId || null);

  const [swimmers, setSwimmers] = useState<Swimmer[]>(savedState.swimmers || []);
  const [isFinished, setIsFinished] = useState(savedState.isFinished || false);
  const [showRating, setShowRating] = useState(false);
  const [showMatchInProgressModal, setShowMatchInProgressModal] = useState(false);
  const [tossWinner, setTossWinner] = useState<'A' | 'B' | null>(savedState.tossWinner || null);
  const [optedTo, setOptedTo] = useState<string | null>(savedState.optedTo || null);
  const [showToss, setShowToss] = useState(false);
  const [isCoinSpinning, setIsCoinSpinning] = useState(false);
  const [coinAngle, setCoinAngle] = useState(0);
  const [coinSpinDuration, setCoinSpinDuration] = useState(2.6);
  const [spinKey, setSpinKey] = useState(0);
  const [tossResult, setTossResult] = useState<string | null>(null);

  const resetHeatFresh = () => {
    setSwimmers(prev => prev.map(s => ({
      ...s,
      time: 0,
      isRunning: false,
      finished: false,
      rank: 0,
      splits: [],
      finishTime: undefined
    })));
    setIsFinished(false);
    setView('live');
    setShowMatchInProgressModal(false);
  };

  const syncMatchResult = async (winners: Swimmer[]) => {
    // For swimming, maybe the winner is the one with rank 1
    const winner = winners.find(s => s.rank === 1);
    if (!winner) return;

    try {
      // Find challenge ID
      const targetChallengeId = challengeId;
      if (!targetChallengeId) return;

      const { data: challenge } = await supabase.from('challenges').select('*').eq('id', targetChallengeId).maybeSingle();
      if (!challenge) return;

      const winnerId = winner.id.includes('lane') ? null : winner.id;
      if (!winnerId) {
          console.log("No recognized winner user ID, skipping global result sync.");
          return;
      }

      await supabase.from('match_results').insert({
        challenge_id: targetChallengeId,
        winner_id: winnerId,
        score_summary: `Swimming: ${winner.name} won with time ${formatTime(winner.time)}`
      });
      onAlert?.('Match results synced!', 'success');
    } catch (e: any) {
      console.error(e);
      if (e.message?.includes('user_id')) {
          console.warn("Notification sync failed due to missing user ID. Swimmer likely not registered.");
      }
    }
  };

  const handleToss = () => {
    if (isCoinSpinning) return;
    setTossResult('flipping');
    setIsCoinSpinning(true);
    setSpinKey(prev => prev + 1);
    const randomArray = new Uint32Array(1);
    window.crypto.getRandomValues(randomArray);
    const isAWinner = randomArray[0] % 2 === 0;
    const winner = isAWinner ? 'A' : 'B';
    const extraRotations = 7 + Math.floor(Math.random() * 8);
    const landingFaceAngle = isAWinner ? 0 : 180;
    const durationMs = 2800 + Math.random() * 800;
    setCoinSpinDuration(durationMs / 1000);
    setCoinAngle(extraRotations * 360 + landingFaceAngle);
    setTimeout(() => {
      setTossWinner(winner);
      setTossResult(winner === 'A' ? (swimmers[0]?.name || 'Lane 1') : (swimmers[1]?.name || 'Lane 2'));
      setIsCoinSpinning(false);
    }, durationMs);
  };

  // Global Stopwatch states (Start All / Stop All)
  const [isGlobalRunning, setIsGlobalRunning] = useState(savedState.isGlobalRunning || false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (swimmers.length === 0 || swimmers.length !== squadSize) {
      const newSwimmers = Array.from({ length: squadSize }, (_, i) => ({
        id: `lane-${i + 1}`,
        name: namingMode === 'auto' ? `Athlete ${i + 1}` : (swimmers[i]?.name || ''),
        lane: i + 1,
        laps: 0,
        finished: false,
        isRunning: false,
        time: 0,
        splits: [],
        rank: i + 1
      }));
      setSwimmers(newSwimmers);
    }
  }, [squadSize, namingMode]);

  const [supabaseHeats, setSupabaseHeats] = useState<any[]>([]);

  useEffect(() => {
    const fetchSupabaseHeats = async () => {
      try {
        const { data, error } = await supabase
          .from('matches')
          .select('*')
          .eq('location_id', location.id)
          .ilike('sport', '%Swimming%')
          .in('status', ['live', 'not started', 'finished']);

        if (data) {
          const mapped = data.filter(m => m).map(m => {
            const matchData = (m.match_data || {}) as any;
            return {
              ...matchData,
              id: m.id,
              challengeId: m.challenge_id,
              status: m.status === 'not started' ? 'Not Started' : m.status === 'finished' ? 'Finished' : 'Live',
              createdAt: m.created_at,
              startTime: m.start_time,
              endTime: m.end_time,
              eventName: matchData?.eventName || m.team_a_name || 'Swimming Heat',
              heatNumber: matchData?.heatNumber || m.team_b_name || '1',
              swimmers: matchData?.swimmers || []
            };
          });
          setSupabaseHeats(mapped);
        }
      } catch (e) { console.error(e); }
    };
    fetchSupabaseHeats();

    const channel = supabase
      .channel(`swimming_heats_${location.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `location_id=eq.${location.id}`
        },
        () => {
          fetchSupabaseHeats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [location.id]);

  useEffect(() => {
    storage.setPageState(PAGE_ID, {
      view, eventName, heatNumber, raceDistance, lapsToFinish, squadSize, namingMode, swimmers, isFinished, isGlobalRunning, challengeId,
      tossWinner, optedTo
    });
  }, [PAGE_ID, view, eventName, heatNumber, raceDistance, lapsToFinish, squadSize, namingMode, swimmers, isFinished, isGlobalRunning, challengeId, tossWinner, optedTo]);

  useEffect(() => {
    if (swimmers.some(s => s.isRunning)) {
      timerRef.current = setInterval(() => {
        setSwimmers(prev => prev.map(s => s.isRunning ? { ...s, time: s.time + 10 } : s));
      }, 10);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [swimmers.some(s => s.isRunning)]);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = ms % 1000;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  const updateRankings = (currentSwimmers: Swimmer[]) => {
    const sorted = [...currentSwimmers].sort((a, b) => {
      if (a.finished && b.finished) return (a.finishTime || 0) - (b.finishTime || 0);
      if (a.finished) return -1;
      if (b.finished) return 1;
      if (a.laps !== b.laps) return b.laps - a.laps;
      return a.time - b.time;
    });

    return currentSwimmers.map(s => ({
      ...s,
      rank: sorted.findIndex(p => p.id === s.id) + 1
    }));
  };

  const handleLap = (idx: number) => {
    setSwimmers(prev => {
      const updated = prev.map((s, i) => {
        if (i === idx) {
          const newLaps = s.laps + 1;
          const newSplits = [...s.splits];

          // Split calculation every 2 laps
          if (newLaps % 2 === 0) {
            const lastSplitTime = newSplits.length > 0 ? newSplits[newSplits.length - 1].time : 0;
            newSplits.push({
              lap: newLaps,
              time: s.time,
              splitDuration: s.time - lastSplitTime
            });
          }

          // Auto-finish if laps reach lapsToFinish
          if (newLaps >= lapsToFinish) {
            return { ...s, laps: newLaps, splits: newSplits, finished: true, isRunning: false, finishTime: s.time };
          }
          return { ...s, laps: newLaps, splits: newSplits };
        }
        return s;
      });

      const withRankings = updateRankings(updated);
      if (withRankings.every(s => s.finished)) {
        setIsFinished(true);
        setIsGlobalRunning(false);
      }
      return withRankings;
    });
  };

  const handleFinish = (idx: number) => {
    setSwimmers(prev => {
      const updated = prev.map((s, i) => {
        if (i === idx) {
          const newSplits = [...s.splits];
          const lastSplitTime = newSplits.length > 0 ? newSplits[newSplits.length - 1].time : 0;
          // Add final split if not already added
          if (s.laps % 2 !== 0 || s.laps === 0) {
             newSplits.push({ lap: s.laps, time: s.time, splitDuration: s.time - lastSplitTime });
          }
          return { ...s, finished: true, isRunning: false, finishTime: s.time, splits: newSplits };
        }
        return s;
      });
      const withRankings = updateRankings(updated);
      if (withRankings.every(s => s.finished)) {
        setIsFinished(true);
        setIsGlobalRunning(false);
      }
      return withRankings;
    });
  };

  const toggleSwimmerTimer = (idx: number) => {
    setSwimmers(prev => prev.map((s, i) => i === idx ? { ...s, isRunning: !s.isRunning } : s));
  };

  const startAll = () => {
    // Play buzzer effect (simulated)
    if (onAlert) onAlert("BEEP! Race Started", 'success');
    setSwimmers(prev => prev.map(s => s.finished ? s : { ...s, isRunning: true }));
    setIsGlobalRunning(true);
    // Determine winners/participants for challenge syncing
    const participants = swimmers.map(s => s.name);
    // Storage sync to allow resume from main board
    storage.setPageState(`scorer_swimming_${location.id}`, {
      view: 'live',
      eventName,
      heatNumber,
      raceDistance,
      swimmers: swimmers.map(s => ({...s, isRunning: true})),
      isGlobalRunning: true
    });
  };

  const stopAll = () => {
    setSwimmers(prev => prev.map(s => ({ ...s, isRunning: false })));
    setIsGlobalRunning(false);
  };

  const resetAll = () => {
    const runReset = () => {
      const newSwimmers = Array.from({ length: squadSize }, (_, i) => ({
        id: `lane-${i + 1}`,
        name: namingMode === 'auto' ? `Athlete ${i + 1}` : (swimmers[i]?.name || ''),
        lane: i + 1,
        laps: 0,
        finished: false,
        isRunning: false,
        time: 0,
        splits: [],
        rank: i + 1
      }));
      setSwimmers(newSwimmers);
      setIsGlobalRunning(false);
      setIsFinished(false);
      storage.clearPageState(PAGE_ID);
    };

    if (onConfirm) {
      onConfirm({
        message: 'Reset all swimmers and timers?',
        confirmText: 'Reset',
        cancelText: 'Cancel',
        isDestructive: true,
        onConfirm: runReset,
      });
      return;
    }

    runReset();
  };

  const updateSwimmerName = (id: string, name: string) => {
    setSwimmers(swimmers.map(s => s.id === id ? { ...s, name } : s));
  };


  const renderHistory = () => (
    <div className="max-w-5xl mx-auto py-6 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12">
        <div className="text-center md:text-left">
          <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter text-text-primary">Heat <span className="text-accent">Archive</span></h2>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-text-disabled mt-2 italic">Professional Timing History</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setView('setup')}
          className="px-10 py-5 bg-success text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-theme-elevated flex items-center gap-3 transition-all hover:shadow-success/20"
        >
          <Target className="w-5 h-5" /> Initialize New Heat
        </motion.button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {supabaseHeats.length === 0 ? (
          <div className="col-span-full py-32 text-center bg-card/50 rounded-[3rem] border border-dashed border-border flex flex-col items-center justify-center space-y-4">
            <Activity className="w-16 h-16 opacity-10" />
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-text-disabled italic">No Active Heats Found in Area</p>
          </div>
        ) : (
          supabaseHeats.filter(h => h).map((heat, idx) => (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              key={heat.id}
              className="p-8 md:p-10 border border-border bg-card rounded-[2.5rem] shadow-theme-card relative overflow-hidden group hover:border-accent/30 transition-all"
            >
              <div className="absolute top-0 right-0 w-32 h-32 blur-[60px] rounded-full opacity-5 group-hover:opacity-20 transition-opacity bg-accent" />

              <div className="flex justify-between items-start mb-8 relative z-10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-success">Live Stream Active</span>
                  </div>
                  <h3 className="text-2xl font-black italic uppercase tracking-tighter text-text-primary group-hover:text-accent transition-colors">{heat.eventName}</h3>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black text-text-disabled uppercase tracking-widest">Heat ID</p>
                  <p className="text-xs font-black text-text-primary italic">#{heat.id.slice(0, 8)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-10 relative z-10">
                <div className="bg-background-secondary/50 p-4 rounded-2xl border border-border/50">
                  <p className="text-[8px] font-black uppercase tracking-widest text-text-disabled mb-1">Configuration</p>
                  <p className="text-sm font-black italic uppercase text-text-primary">Heat {heat.heatNumber} • {heat.raceDistance}</p>
                </div>
                <div className="bg-background-secondary/50 p-4 rounded-2xl border border-border/50">
                  <p className="text-[8px] font-black uppercase tracking-widest text-text-disabled mb-1">Started At</p>
                  <p className="text-sm font-black italic text-text-primary">
                    {heat.startTime ? (() => {
                        const d = new Date(heat.startTime);
                        let hours = d.getHours();
                        const minutes = String(d.getMinutes()).padStart(2, '0');
                        const ampm = hours >= 12 ? 'PM' : 'AM';
                        hours = hours % 12 || 12;
                        return `${hours}:${minutes} ${ampm}`;
                    })() : new Date(heat.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <div className="flex gap-4 relative z-10">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setEventName(heat.eventName);
                    setHeatNumber(heat.heatNumber);
                    setRaceDistance(heat.raceDistance || '100m');
                    setView('setup');
                  }}
                  className="w-14 h-14 rounded-2xl bg-background-secondary border border-border flex items-center justify-center text-text-secondary hover:text-accent hover:border-accent transition-all shadow-sm"
                >
                  <Settings className="w-6 h-6" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setEventName(heat.eventName);
                    setHeatNumber(heat.heatNumber);
                    setRaceDistance(heat.raceDistance || '100m');
                    setSwimmers(heat.swimmers || swimmers);
                    setChallengeId(heat.challengeId || null);
                    setView('live');
                  }}
                  className="flex-1 py-5 bg-text-primary text-background rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-theme-elevated flex items-center justify-center gap-3 transition-all hover:bg-accent hover:text-white"
                >
                  <Play className="w-4 h-4 fill-current" /> Resume Heat Scoring
                </motion.button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );

  const renderSetup = () => (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="max-w-5xl mx-auto py-6 space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex p-3 rounded-2xl bg-accent/10 text-accent mb-3 shadow-inner">
            <Timer className="w-8 h-8" />
        </div>
        <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter text-text-primary">Race <span className="text-accent">Setup</span></h2>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-text-disabled mt-1">Professional Timing Configuration</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
            <div className="bg-card p-6 border border-border rounded-[2rem] shadow-2xl space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 blur-[100px] rounded-full bg-accent/5 pointer-events-none" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-text-disabled ml-1">Event Name</label>
                  <input
                    type="text"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="e.g. 100m Butterfly"
                    className="w-full px-4 py-3 bg-background-secondary border-2 border-transparent focus:border-accent rounded-xl font-black italic text-base outline-none transition-all shadow-inner uppercase tracking-tight"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-text-disabled ml-1">Race Distance</label>
                  <input
                    type="text"
                    value={raceDistance}
                    onChange={(e) => setRaceDistance(e.target.value)}
                    placeholder="e.g. 100m"
                    className="w-full px-4 py-3 bg-background-secondary border-2 border-transparent focus:border-accent rounded-xl font-black italic text-base outline-none transition-all shadow-inner uppercase tracking-tight"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 relative z-10">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-disabled ml-1">Heat Number</label>
                  <input
                    type="text"
                    value={heatNumber}
                    onChange={(e) => setHeatNumber(e.target.value)}
                    placeholder="Heat 1"
                    className="w-full px-6 py-5 bg-background-secondary border-2 border-transparent focus:border-accent rounded-2xl font-black italic text-lg outline-none transition-all shadow-inner"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-disabled ml-1">Laps to Finish</label>
                  <div className="flex items-center bg-background-secondary rounded-2xl border-2 border-transparent focus-within:border-accent transition-all shadow-inner px-4">
                    <input
                      type="number"
                      value={lapsToFinish}
                      onChange={(e) => setLapsToFinish(Number(e.target.value))}
                      className="w-full py-5 bg-transparent font-black italic text-2xl outline-none text-center"
                    />
                    <span className="text-[10px] font-black text-text-disabled uppercase tracking-widest pr-2">Laps</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
                <div className="p-2 bg-background-secondary rounded-[2rem] flex border border-border shadow-inner">
                  <button
                    onClick={() => setNamingMode('auto')}
                    className={`flex-1 py-4 rounded-3xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${namingMode === 'auto' ? 'bg-accent text-white shadow-lg' : 'text-text-disabled hover:text-text-primary'}`}
                  >
                    Auto Names
                  </button>
                  <button
                    onClick={() => setNamingMode('custom')}
                    className={`flex-1 py-4 rounded-3xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${namingMode === 'custom' ? 'bg-accent text-white shadow-lg' : 'text-text-disabled hover:text-text-primary'}`}
                  >
                    Custom Athletes
                  </button>
                </div>

                {namingMode === 'custom' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card p-8 border border-border rounded-[2.5rem] shadow-xl space-y-6">
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-disabled flex items-center gap-2">
                        <UserPlus className="w-4 h-4" /> Athlete Lane Assignment
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                      {swimmers.filter(s => s).map((swimmer, idx) => (
                        <div key={swimmer.id} className="relative group">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-text-disabled group-focus-within:text-accent transition-colors">L{idx + 1}</span>
                            <input
                                type="text"
                                value={swimmer.name}
                                onChange={(e) => updateSwimmerName(swimmer.id, e.target.value)}
                                placeholder={`Athlete ${idx + 1}`}
                                className="w-full pl-10 pr-6 py-4 bg-background-secondary border-2 border-transparent focus:border-accent rounded-xl font-bold outline-none transition-all text-sm shadow-sm"
                            />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
            </div>
        </div>

        <div className="lg:col-span-5 space-y-8 lg:sticky lg:top-24">
            <div className="bg-card p-10 border border-border rounded-[2.5rem] shadow-2xl space-y-8 relative overflow-hidden">
                <div className="absolute bottom-0 left-0 w-64 h-64 blur-[100px] rounded-full bg-accent/5 pointer-events-none" />

                <div className="space-y-4 relative z-10">
                    <label className="text-[10px] font-black uppercase tracking-[0.4em] text-text-disabled ml-1">Squad Size (Active Lanes)</label>
                    <div className="grid grid-cols-4 gap-3">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(size => (
                            <button
                                key={size}
                                onClick={() => setSquadSize(size)}
                                className={`h-16 rounded-2xl flex flex-col items-center justify-center border-2 transition-all ${squadSize === size ? 'bg-accent border-accent text-white shadow-lg scale-105' : 'bg-background-secondary border-transparent text-text-disabled hover:border-accent/30'}`}
                            >
                                <span className="text-xl font-black italic">{size}</span>
                                <span className="text-[8px] font-bold uppercase tracking-widest opacity-60">Lanes</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-card p-6 border border-border rounded-3xl shadow-xl space-y-6 relative overflow-hidden">
                    <div className="flex justify-between items-center relative z-10">
                        <label className="text-[10px] font-black uppercase tracking-[0.4em] text-text-disabled">Match Toss</label>
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
                                <div className="absolute inset-0 rounded-full flex flex-col items-center justify-center font-black shadow-2xl border-[6px]"
                                     style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', background: 'linear-gradient(145deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)', borderColor: '#fcd34d', transform: 'rotateY(0deg) translateZ(1px)' }}>
                                  <Trophy className="w-8 h-8 text-amber-900 opacity-80" strokeWidth={3} />
                                </div>
                                <div className="absolute inset-0 rounded-full flex flex-col items-center justify-center font-black shadow-2xl border-[6px]"
                                     style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', background: 'linear-gradient(145deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)', borderColor: '#60a5fa', transform: 'rotateY(180deg) translateZ(1px)' }}>
                                  <Target className="w-8 h-8 text-blue-950 opacity-80" strokeWidth={3} />
                                </div>
                            </motion.div>
                        </div>
                        <AnimatePresence mode="wait">
                            {tossWinner && !isCoinSpinning && (
                                <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} className="mt-4 text-center">
                                    <p className="text-[8px] font-black uppercase text-success tracking-widest mb-1">Toss Winner</p>
                                    <h4 className="text-xl font-black italic uppercase text-text-primary">{tossWinner === 'A' ? (swimmers[0]?.name || 'Lane 1') : (swimmers[1]?.name || 'Lane 2')}</h4>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {tossWinner && (
                        <div className="space-y-4 pt-4 border-t border-border/50">
                            <p className="text-[9px] font-black uppercase tracking-widest text-text-disabled text-center">Decision Step</p>
                            <div className="grid grid-cols-2 gap-2">
                                {['Lane Choice', 'Start Side'].map(choice => (
                                    <button key={choice} onClick={() => setOptedTo(choice)}
                                        className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${optedTo === choice ? 'bg-accent text-white border-accent shadow-lg' : 'bg-background-secondary text-text-disabled border-border hover:border-accent/50'}`}>
                                        {choice}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="pt-6 border-t border-border relative z-10">
                    <button
                        onClick={() => {
                            if (!eventName) {
                                onAlert?.("Please enter event name", 'error');
                                return;
                            }
                            const hasProgress = swimmers.some(s => s.finished || s.time > 0 || (s.splits || []).length > 0);
                            if (hasProgress) {
                                setShowMatchInProgressModal(true);
                            } else {
                                setView('live');
                            }
                        }}
                        className="w-full py-6 bg-accent text-white rounded-[1.8rem] font-black uppercase tracking-[0.3em] text-sm shadow-xl hover:shadow-accent/30 transition-all flex items-center justify-center gap-4 active:translate-y-1"
                    >
                        <Play className="w-5 h-5 fill-current" /> Initialize Heat
                    </button>
                    <p className="text-center text-[9px] font-bold text-text-disabled uppercase tracking-[0.2em] mt-4 italic">Ready for Millisecond Precision Timing</p>
                </div>
            </div>
        </div>
      </div>
    </motion.div>
  );

  const renderLive = () => (
    <div className="space-y-8 pb-20">
      {/* MONITOR: The Professional Timing Board */}
      <div className="bg-slate-950 rounded-[3rem] border-4 border-slate-900 shadow-2xl overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.05),transparent)] pointer-events-none" />

        {/* Header Strip */}
        <div className="bg-slate-900/80 backdrop-blur-md px-10 py-6 flex justify-between items-center border-b border-slate-800 relative z-10">
            <div className="flex items-center gap-8">
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.8)]" />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white">Heat Stream</span>
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">Live Timing Active</span>
                  </div>
                </div>
                <div className="h-8 w-px bg-slate-800" />
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Competition</span>
                  <span className="text-sm font-black italic uppercase text-accent leading-tight">{eventName || 'N/A'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Details</span>
                  <span className="text-sm font-black italic uppercase text-white leading-tight">{raceDistance} • Heat {heatNumber}</span>
                </div>
            </div>
            <div className="flex gap-8 items-center">
                <div className="text-right flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Target</span>
                    <span className="text-sm font-black italic text-white leading-tight">{lapsToFinish} LAPS</span>
                </div>
                <button onClick={resetAll} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all group shadow-inner">
                    <RotateCcw className="w-4 h-4 text-slate-400 group-hover:text-accent" />
                </button>
            </div>
        </div>

        <div className="divide-y divide-slate-900">
            {[...swimmers].filter(s => s).sort((a,b) => (a.rank || 0) - (b.rank || 0)).map((swimmer, idx) => {
                const isTop3 = swimmer.rank && swimmer.rank <= 3;
                const rankColor = swimmer.rank === 1 ? 'bg-amber-400' : swimmer.rank === 2 ? 'bg-slate-300' : swimmer.rank === 3 ? 'bg-amber-700' : 'bg-slate-800';

                return (
                  <motion.div
                    layout
                    key={swimmer.id}
                    className={`p-4 md:px-8 md:py-6 flex items-center justify-between transition-all duration-700 relative overflow-hidden ${swimmer.finished ? 'bg-success/5' : swimmer.isRunning ? 'bg-accent/5' : ''}`}
                  >
                    {swimmer.isRunning && (
                       <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent animate-pulse shadow-[0_0_10px_rgba(56,189,248,0.5)]" />
                    )}

                    <div className="flex items-center gap-6 relative z-10">
                        <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center transition-all shadow-xl ${rankColor} text-slate-950`}>
                            <span className="text-[7px] font-black uppercase leading-none opacity-60">{swimmer.rank === 1 ? '1st' : swimmer.rank === 2 ? '2nd' : swimmer.rank === 3 ? '3rd' : 'Pos'}</span>
                            <span className="text-lg font-black italic leading-none">{swimmer.rank || idx + 1}</span>
                        </div>
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[8px] font-black text-accent uppercase tracking-widest">Lane {swimmer.lane}</span>
                              {swimmer.finished ? (
                                <CheckCircle2 className="w-2.5 h-2.5 text-success" />
                              ) : swimmer.isRunning ? (
                                <div className="flex gap-0.5">
                                    <div className="w-0.5 h-2.5 bg-accent animate-[bounce_1s_infinite]" />
                                    <div className="w-0.5 h-2.5 bg-accent animate-[bounce_1s_infinite_0.2s]" />
                                    <div className="w-0.5 h-2.5 bg-accent animate-[bounce_1s_infinite_0.4s]" />
                                </div>
                              ) : null}
                            </div>
                            <p className="text-xl font-black text-white italic uppercase tracking-tighter truncate max-w-[180px] drop-shadow-sm">{swimmer.name}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-12 relative z-10">
                        <div className="text-right space-y-0.5">
                            <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">Laps</p>
                            <div className="flex items-baseline gap-1 justify-end">
                              <p className={`text-2xl font-black italic leading-none ${swimmer.finished ? 'text-success' : 'text-white'}`}>{swimmer.laps}</p>
                              <span className="text-[10px] font-bold text-slate-600 uppercase">/ {lapsToFinish}</span>
                            </div>
                        </div>
                        <div className="text-right space-y-0.5 min-w-[180px]">
                            <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">Live Timing</p>
                            <p className={`text-4xl font-black italic leading-none tabular-nums tracking-tighter drop-shadow-lg ${swimmer.finished ? 'text-success' : 'text-accent'}`}>
                                {formatTime(swimmer.time)}
                            </p>
                        </div>
                    </div>
                  </motion.div>
                );
            })}
        </div>
      </div>

      {/* CONSOLE: Tactical Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={startAll} disabled={isFinished || isGlobalRunning}
                               className="py-6 bg-accent text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl flex items-center justify-center gap-4 disabled:opacity-50 transition-all border border-accent/20">
                    <Play className="w-5 h-5 fill-current" /> START ALL BUZZER
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={stopAll} disabled={!isGlobalRunning}
                               className="py-6 bg-red-500/10 border-2 border-red-500/20 text-red-500 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-lg flex items-center justify-center gap-4 transition-all hover:bg-red-500 hover:text-white disabled:opacity-30">
                    <Pause className="w-5 h-5 fill-current" /> SUSPEND ALL
                </motion.button>
            </div>

            <div className="bg-card p-8 border border-border rounded-[2.5rem] shadow-xl space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 blur-[80px] rounded-full bg-accent/5 pointer-events-none" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3 text-accent">
                    <History className="w-5 h-5" />
                    <span className="text-[11px] font-black uppercase tracking-[0.3em]">Precision Split Logs</span>
                </div>
                <span className="text-[9px] font-black uppercase text-text-disabled tracking-[0.3em] bg-background-secondary px-3 py-1 rounded-full border border-border">Interval: 2 Laps</span>
              </div>

              <div className="space-y-3 max-h-[320px] overflow-y-auto no-scrollbar pr-2 relative z-10">
                {swimmers.filter(s => s).flatMap(s => (s.splits || []).map(split => ({ ...split, athlete: s.name, lane: s.lane })))
                  .sort((a, b) => b.time - a.time)
                  .map((split, i) => (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} key={i} className="flex justify-between items-center p-4 bg-background-secondary rounded-2xl border border-border/50 shadow-sm group hover:border-accent/50 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center shadow-inner">
                            <span className="text-[7px] font-black text-slate-500 uppercase leading-none">LANE</span>
                            <span className="text-sm font-black text-accent">{split.lane}</span>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-xs font-black text-text-primary uppercase italic tracking-tight">{split.athlete}</span>
                            <span className="text-[8px] font-bold text-text-disabled uppercase tracking-widest block">Lap {split.lap} Split</span>
                        </div>
                      </div>
                      <div className="text-right space-y-0.5">
                        <span className="text-lg font-black text-white italic tabular-nums tracking-tighter block">{formatTime(split.time)}</span>
                        <span className="text-[9px] font-black text-accent uppercase tracking-widest block">+{formatTime(split.splitDuration)}</span>
                      </div>
                    </motion.div>
                  ))}
                {swimmers.every(s => s.splits.length === 0) && (
                  <div className="flex flex-col items-center justify-center py-16 space-y-4 opacity-30">
                      <History className="w-12 h-12" />
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] italic text-center">Awaiting Touch Pad Signals...</p>
                  </div>
                )}
              </div>
            </div>
        </div>

        <div className="lg:col-span-5 bg-card p-8 border border-border rounded-[2.5rem] shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-accent">
                  <Settings className="w-5 h-5" />
                  <span className="text-[11px] font-black uppercase tracking-[0.3em]">Touch Pad Triggers</span>
              </div>
              <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-success">Active</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 max-h-[600px] overflow-y-auto pr-2 no-scrollbar">
                {swimmers.filter(s => s).map((swimmer, idx) => (
                    <div key={swimmer.id} className={`flex items-center gap-4 p-5 rounded-[1.8rem] border transition-all duration-300 relative overflow-hidden ${swimmer.finished ? 'bg-success/5 border-success/30 opacity-60' : 'bg-background-secondary border-border hover:border-accent/50 shadow-sm'}`}>
                        {swimmer.isRunning && (
                            <div className="absolute inset-0 bg-accent/5 animate-pulse pointer-events-none" />
                        )}

                        <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center shrink-0 shadow-inner">
                            <span className="text-[7px] font-black text-slate-500 uppercase leading-none">LANE</span>
                            <span className="text-base font-black text-accent italic">{swimmer.lane}</span>
                        </div>

                        <div className="flex-1 min-w-0 relative z-10">
                            <p className="text-[10px] font-black truncate uppercase tracking-widest text-text-disabled mb-1 italic">{swimmer.name}</p>
                            <div className="flex items-baseline gap-2">
                              <span className={`text-2xl font-black italic ${swimmer.finished ? 'text-success' : 'text-text-primary'}`}>{swimmer.laps}</span>
                              <span className="text-[9px] font-black text-text-disabled uppercase tracking-widest">/ {lapsToFinish} Laps</span>
                            </div>
                        </div>

                        <div className="flex gap-2 relative z-10">
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleLap(idx)}
                                disabled={swimmer.finished || !swimmer.isRunning}
                                className="w-14 h-14 bg-accent/10 text-accent rounded-2xl flex items-center justify-center text-[10px] font-black uppercase hover:bg-accent hover:text-white transition-all disabled:opacity-20 border border-accent/20 shadow-sm"
                            >
                                LAP
                            </motion.button>
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleFinish(idx)}
                                disabled={swimmer.finished || !swimmer.isRunning}
                                className="w-14 h-14 bg-success text-white rounded-2xl flex items-center justify-center text-[10px] font-black uppercase shadow-lg shadow-success/20 hover:scale-105 transition-all disabled:opacity-20"
                            >
                                FIN
                            </motion.button>
                            <button
                                onClick={() => toggleSwimmerTimer(idx)}
                                disabled={swimmer.finished}
                                className={`w-14 h-14 flex items-center justify-center rounded-2xl transition-all shadow-sm ${swimmer.isRunning ? 'bg-red-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                            >
                                {swimmer.isRunning ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {isFinished && (
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="p-16 rounded-[4rem] text-center shadow-2xl border-4 transition-all max-w-3xl mx-auto overflow-hidden relative group backdrop-blur-3xl"
          style={{ backgroundColor: `${theme.colors.success}10`, borderColor: `${theme.colors.success}30` }}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.1),transparent)] pointer-events-none" />
          <div className="absolute top-0 right-0 w-80 h-80 blur-[150px] rounded-full bg-success/20 group-hover:scale-125 transition-transform duration-1000" />

          <div className="relative z-10">
              <div className="w-24 h-24 bg-success rounded-[2rem] flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-success/30 rotate-12">
                <Trophy className="w-12 h-12 text-white drop-shadow-lg" />
              </div>
              <h4 className="text-6xl font-black italic uppercase tracking-tighter mb-4" style={{ color: theme.colors.textPrimary }}>
                Heat <span className="text-success">Classified</span>
              </h4>
              <p className="text-[12px] font-black uppercase tracking-[0.6em] text-success/80 mb-12 italic">Official Finalized Timing Data</p>

              <div className="flex flex-col sm:flex-row gap-6 justify-center px-10">
                <button
                    onClick={() => setView('review')}
                    className="flex-1 px-12 py-6 bg-text-primary text-background rounded-[2rem] text-xs font-black uppercase tracking-[0.3em] hover:scale-105 transition-all shadow-2xl flex items-center justify-center gap-4"
                >
                  <CheckCircle2 className="w-5 h-5" /> View Heat Scorecard
                </button>
                <button
                    onClick={() => setView('setup')}
                    className="flex-1 px-12 py-6 bg-background-secondary border-2 border-border text-text-primary rounded-[2rem] text-xs font-black uppercase tracking-[0.3em] hover:scale-105 transition-all shadow-xl"
                >
                  Prepare Next Heat
                </button>
              </div>
          </div>
        </motion.div>
      )}
    </div>
  );

  const renderReview = () => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto space-y-8 pb-32">
      <div className="p-10 bg-card border border-border rounded-[3rem] shadow-2xl relative overflow-hidden backdrop-blur-3xl">
        <div className="absolute top-0 right-0 w-80 h-80 blur-[150px] rounded-full bg-accent/10 pointer-events-none" />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10">
          <div className="space-y-4">
            <div className="inline-flex px-4 py-1.5 bg-accent text-white rounded-full text-[8px] font-black uppercase tracking-[0.4em] shadow-lg shadow-accent/20">
              OFFICIAL CLASSIFICATION
            </div>
            <h2 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter leading-tight text-text-primary">
              {eventName || 'Swimming Heat'}
            </h2>
            <div className="text-[9px] font-black uppercase tracking-[0.4em] text-text-disabled mt-2">
                {(() => {
                    const m = (swimmers?.[0] as any) || {};
                    if ((swimmers as any).startTime) {
                        // This might be tricky if swimmers state doesn't have it.
                        // But I'll check if currentMatch has it (though Swimming doesn't use currentMatch for history usually)
                    }
                    return new Date().toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
                })()}
            </div>
            <div className="flex flex-wrap gap-4 items-center text-text-disabled text-[10px] font-black uppercase tracking-[0.2em] pt-2">
              <span className="flex items-center gap-2 bg-background-secondary px-3 py-1 rounded-xl border border-border"><Settings className="w-4 h-4 text-accent" /> HEAT {heatNumber}</span>
              <span className="flex items-center gap-2 bg-background-secondary px-3 py-1 rounded-xl border border-border"><Timer className="w-4 h-4 text-accent" /> {raceDistance}</span>
            </div>
          </div>
          <div className="text-right p-6 bg-success/10 border-2 border-success/20 rounded-[2rem] min-w-[240px] backdrop-blur-md">
            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-success mb-2 opacity-70">Heat Champion</p>
            <p className="text-3xl font-black italic uppercase text-text-primary tracking-tighter leading-none mb-1">
              {swimmers.find(s => s.rank === 1)?.name || 'N/A'}
            </p>
            <p className="text-xl font-black italic text-success tabular-nums tracking-tighter">
                {formatTime(swimmers.find(s => s.rank === 1)?.finishTime || 0)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-slate-950 rounded-[3.5rem] border-4 border-slate-900 shadow-2xl overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 to-transparent pointer-events-none" />
        <div className="bg-slate-900/80 backdrop-blur-md px-12 py-8 border-b border-slate-800 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
              <div className="w-2 h-8 bg-accent rounded-full" />
              <h3 className="text-lg font-black uppercase tracking-[0.4em] text-white italic">Final Heat Scorecard</h3>
          </div>
          <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em]">
            {(() => {
              const m = (swimmers?.[0] as any) || {}; // Check first swimmer for heat info if needed, but better to use a global heat object if available
              // In this file eventName, heatNumber etc are state.
              // We should show the scheduled time if we have it from the "heat" object in history.
              // But in review view, we might not have the "heat" object directly if we just finished.
              // Let's use currentMatch if available or just the formatted date.
              return new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
            })()}
          </span>
        </div>

        <div className="overflow-x-auto no-scrollbar relative z-10">
          <table className="w-full text-left">
            <thead className="bg-slate-900/40 text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 border-b border-slate-900">
              <tr>
                <th className="px-12 py-8">POS</th>
                <th className="px-12 py-8">ATHLETE / LANE</th>
                <th className="px-12 py-8">LAPS</th>
                <th className="px-12 py-8">OFFICIAL TIME</th>
                <th className="px-12 py-8 text-right">SPLIT LOGS (EVERY 2 LAPS)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {[...swimmers].filter(s => s).sort((a,b) => (a.rank || 0) - (b.rank || 0)).map((swimmer) => {
                const isGold = swimmer.rank === 1;
                const isSilver = swimmer.rank === 2;
                const isBronze = swimmer.rank === 3;

                return (
                  <tr key={swimmer.id} className="hover:bg-slate-900/60 transition-all group border-l-4 border-transparent hover:border-accent">
                    <td className="px-12 py-10">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black italic text-xl shadow-lg ${isGold ? 'bg-amber-400 text-slate-950 scale-110 shadow-amber-400/20' : isSilver ? 'bg-slate-300 text-slate-950 shadow-slate-300/20' : isBronze ? 'bg-amber-700 text-white shadow-amber-700/20' : 'bg-slate-900 border border-slate-800 text-slate-500'}`}>
                        {swimmer.rank}
                      </div>
                    </td>
                    <td className="px-12 py-10">
                      <div className="space-y-1.5">
                        <p className="text-2xl font-black text-white italic uppercase tracking-tighter group-hover:text-accent transition-colors drop-shadow-sm">{swimmer.name}</p>
                        <div className="inline-flex px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[9px] font-black uppercase text-slate-500 tracking-[0.2em]">LANE {swimmer.lane}</div>
                      </div>
                    </td>
                    <td className="px-12 py-10">
                      <span className="text-3xl font-black text-slate-400 italic tabular-nums">{swimmer.laps}</span>
                    </td>
                    <td className="px-12 py-10">
                      <span className={`text-4xl font-black tabular-nums tracking-tighter italic ${isGold ? 'text-accent drop-shadow-[0_0_10px_rgba(56,189,248,0.3)]' : 'text-white'}`}>
                        {formatTime(swimmer.finishTime || swimmer.time)}
                      </span>
                    </td>
                    <td className="px-12 py-10">
                      <div className="flex gap-3 justify-end flex-wrap max-w-[400px]">
                        {swimmer.splits.map((split, i) => (
                          <div key={i} className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-center min-w-[90px] shadow-inner group-hover:border-slate-700 transition-colors">
                            <span className="text-[8px] font-black text-slate-600 uppercase block mb-1">LAP {split.lap}</span>
                            <span className="text-xs font-black text-accent tabular-nums">{formatTime(split.time)}</span>
                          </div>
                        ))}
                        {swimmer.splits.length === 0 && <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest italic opacity-50">No Data Captured</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-6">
        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setView('setup')}
          className="flex-1 py-8 bg-accent text-white rounded-[2.5rem] font-black uppercase tracking-[0.4em] text-xs shadow-2xl hover:shadow-accent/40 transition-all flex items-center justify-center gap-5 border border-white/10"
        >
          <RotateCcw className="w-6 h-6" /> Prepare Next Session
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={onBack}
          className="flex-1 py-8 bg-card border-2 border-border text-text-primary rounded-[2.5rem] font-black uppercase tracking-[0.4em] text-xs shadow-xl hover:bg-background-secondary transition-all flex items-center justify-center gap-5"
        >
          <ChevronLeft className="w-6 h-6" /> Return to Arena
        </motion.button>
      </div>
    </motion.div>
  );

  return (
    <div className="flex flex-col flex-1 relative min-h-screen transition-all duration-300 pb-10"
         style={{ backgroundColor: theme.colors.background }}>
      <header className="backdrop-blur-3xl p-4 md:p-6 flex justify-between items-center border-b sticky top-0 z-30 transition-all shadow-theme-card"
              style={{ backgroundColor: theme.colors.accent, borderColor: theme.colors.border }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center shadow-theme-elevated"
               style={{ backgroundColor: theme.colors.card, color: theme.colors.accent }}>
            <img src="/logo.png" className="w-6 h-6 md:w-7 md:h-7 object-contain" alt="Boxitt" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter leading-none" style={{ color: theme.colors.card }}>
              Swim<span style={{ color: theme.colors.card }}>Scorer</span>
            </h1>
            <p className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] mt-1" style={{ color: theme.colors.card }}>Professional Timing</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {view === 'live' && (
            <button
              onClick={() => setView('setup')}
              className="px-5 py-2 md:px-6 md:py-3 rounded-lg md:rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all shadow-theme-elevated active:translate-y-1"
              style={{ backgroundColor: theme.colors.card, color: theme.colors.accent }}
            >
              Edit
            </button>
          )}
          <button
            onClick={() => {
              if (view === 'setup' || view === 'live' || view === 'review') setView('history');
              else onBack();
            }}
            className="px-5 py-2 md:px-6 md:py-3 rounded-lg md:rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all shadow-theme-elevated active:translate-y-1"
            style={{ backgroundColor: theme.colors.card, color: theme.colors.accent }}
          >
            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 inline-block mr-1" /> Back
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 md:p-10 space-y-8 max-w-6xl mx-auto w-full relative z-10">
        <AnimatePresence mode="wait">
          {view === 'history' && renderHistory()}
          {view === 'setup' && renderSetup()}
          {view === 'live' && renderLive()}
          {view === 'review' && renderReview()}
        </AnimatePresence>

        {showMatchInProgressModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xl p-6">
            <div className="border border-border rounded-[2rem] w-full max-w-sm p-10 text-center bg-card shadow-2xl transition-all">
               <div className="w-16 h-16 bg-accent/20 text-accent rounded-full flex items-center justify-center mx-auto mb-6"><Settings className="w-8 h-8" /></div>
               <h3 className="text-2xl font-black mb-4 uppercase italic tracking-tighter text-text-primary">Match In Progress</h3>
               <p className="text-sm opacity-70 mb-8 text-text-primary">An active session already has recorded scores/progress. Would you like to continue it with your settings or clear it?</p>
               <div className="space-y-4">
                  <button onClick={() => { setView('live'); setShowMatchInProgressModal(false); }} className="w-full py-4 bg-accent text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-md">Continue Session</button>
                  <button onClick={resetHeatFresh} className="w-full py-4 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-md">Reset & Start New</button>
                  <button onClick={() => setShowMatchInProgressModal(false)} className="w-full py-2 font-black uppercase text-[10px] tracking-widest transition-colors text-text-disabled">Cancel</button>
               </div>
            </div>
          </div>
        )}
        {showRating && <RatingModal matchId={location.id + '_swimming'} locationId={location.id} user={user} onClose={() => setShowRating(false)} />}
      </main>
    </div>
  );
};

export default SwimmingScorer;


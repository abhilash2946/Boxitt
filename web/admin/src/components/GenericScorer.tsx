import React, { useState } from 'react';
import { Booking, User } from '../types';
import RatingModal from './RatingModal';
import { useTheme } from '../contexts/ThemeContext';
import { motion } from 'framer-motion';
import { Trophy, ChevronLeft, CheckCircle2, History, XCircle } from 'lucide-react';

interface GenericScorerProps {
  booking: Booking;
  user: User;
  onBack: () => void;
  onAlert?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const GenericScorer: React.FC<GenericScorerProps> = ({ booking, user, onBack }) => {
  const { theme } = useTheme();
  const [teamAScore, setTeamAScore] = useState(0);
  const [teamBScore, setTeamBScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [showRating, setShowRating] = useState(false);

  const handleFinishMatch = () => {
    setIsFinished(true);
    setTimeout(() => setShowRating(true), 1500);
  };

  const getWinner = () => {
    if (teamAScore > teamBScore) return `${booking.name}'s Team`;
    if (teamBScore > teamAScore) return "Opponent's Team";
    return "It's a Tie!";
  }

  return (
    <div className="flex flex-col flex-1 relative min-h-screen transition-all duration-300"
         style={{ backgroundColor: theme.colors.background }}>
      <header className="backdrop-blur-3xl p-4 md:p-6 flex justify-between items-center border-b sticky top-0 z-30 transition-all shadow-theme-card"
              style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-theme-sm flex items-center justify-center shadow-theme-elevated"
               style={{ backgroundColor: theme.colors.accent, color: 'white' }}>
            <img src="/logo.png" className="w-6 h-6 md:w-7 md:h-7 object-contain" alt="Boxitt" />
          </div>
          <h1 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter leading-none" style={{ color: theme.colors.textPrimary }}>
            {booking.sport} <span style={{ color: theme.colors.accent }}>Scorer</span>
          </h1>
        </div>
        <button
          onClick={onBack}
          className="px-5 py-2.5 rounded-theme-sm text-xs font-black uppercase tracking-widest transition-all shadow-theme-elevated active:translate-y-1"
          style={{ backgroundColor: theme.colors.textPrimary, color: theme.colors.background }}
        >
          Back
        </button>
      </header>

      <main className="flex-1 p-6 md:p-10 relative z-10 overflow-hidden max-w-5xl mx-auto w-full">
        <div className="space-y-8 pb-20">
          {/* MONITOR: The Professional Scoreboard */}
          <div className="bg-slate-950 rounded-[2rem] border-4 border-slate-900 shadow-2xl overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900/50 to-transparent pointer-events-none" />

            {/* Header Strip */}
            <div className="bg-slate-900 px-6 py-3 flex justify-between items-center border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Live Broadcast Stream</span>
                </div>
            </div>

            <div className="p-10 md:p-14 grid grid-cols-3 items-center relative z-10">
                <div className="text-center space-y-4">
                    <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-slate-400 truncate px-2">{booking.name}'s Team</p>
                    <motion.div key={teamAScore} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                                className="text-7xl md:text-8xl font-black italic tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                        {teamAScore}
                    </motion.div>
                </div>

                <div className="flex flex-col items-center">
                    <div className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 mb-4">
                        <span className="text-[10px] font-black text-accent italic">VS</span>
                    </div>
                    <div className="h-20 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                </div>

                <div className="text-center space-y-4">
                    <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-slate-400 truncate px-2">Opponent Team</p>
                    <motion.div key={teamBScore} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                                className="text-7xl md:text-8xl font-black italic tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                        {teamBScore}
                    </motion.div>
                </div>
            </div>
          </div>

          {/* CONSOLE: Tactical Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {!isFinished ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3 text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-text-disabled">Home Control</p>
                        <div className="grid grid-cols-2 gap-2">
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={() => setTeamAScore(s => s + 1)}
                                           className="h-20 bg-accent text-white rounded-2xl shadow-lg flex items-center justify-center text-2xl font-black transition-all">+</motion.button>
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={() => setTeamAScore(s => Math.max(0, s - 1))}
                                           className="h-20 bg-card border border-border text-text-primary rounded-2xl shadow-lg flex items-center justify-center text-2xl font-black transition-all">-</motion.button>
                        </div>
                    </div>
                    <div className="space-y-3 text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-text-disabled">Away Control</p>
                        <div className="grid grid-cols-2 gap-2">
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={() => setTeamBScore(s => s + 1)}
                                           className="h-20 bg-accent text-white rounded-2xl shadow-lg flex items-center justify-center text-2xl font-black transition-all">+</motion.button>
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={() => setTeamBScore(s => Math.max(0, s - 1))}
                                           className="h-20 bg-card border border-border text-text-primary rounded-2xl shadow-lg flex items-center justify-center text-2xl font-black transition-all">-</motion.button>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <button onClick={handleFinishMatch}
                            className="w-full py-5 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl font-black uppercase tracking-[0.2em] hover:bg-red-500 hover:text-white transition-all shadow-lg flex items-center justify-center gap-2">
                        <XCircle className="w-5 h-5" /> End Match Session
                    </button>
                </div>
              </>
            ) : (
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="col-span-full text-center space-y-6">
                <div className="bg-success/5 border border-success/20 p-12 rounded-[3rem] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 blur-[100px] rounded-full bg-success/10" />
                    <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-6" />
                    <h4 className="text-4xl font-black italic uppercase tracking-tighter text-text-primary mb-2">
                        {teamAScore === teamBScore ? "Equal Ground" : `${getWinner().split("'")[0]} Victorious`}
                    </h4>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-success">Official Match Termination</p>
                </div>
                <motion.button whileHover={{ scale: 1.02 }} onClick={onBack}
                               className="w-full max-w-sm mx-auto py-5 bg-text-primary text-background rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-2xl flex items-center justify-center gap-3">
                    <History className="w-4 h-4" /> Return to Archives
                </motion.button>
              </motion.div>
            )}
          </div>
        </div>
      </main>

      {showRating && <RatingModal matchId={booking.id} locationId={booking.locationId} user={user} onClose={() => setShowRating(false)} />}
    </div>
  );
};

export default GenericScorer;

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Star, ShieldCheck, Award } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface UserProfileModalProps {
  userProfile: {
    id?: string;
    username?: string;
    display_name?: string;
    avatar_url?: string;
    location?: string;
    created_at?: string;
    player_score?: number;
    matches_played?: number;
    win_rate?: string;
    rating?: number;
  } | null;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ userProfile, onClose }) => {
  const { theme } = useTheme();

  if (!userProfile) return null;

  const displayName = userProfile.display_name || userProfile.username || 'USER';
  const handle = userProfile.username || userProfile.display_name?.toLowerCase().replace(/\s+/g, '_') || 'user';
  const locationText = userProfile.location || 'Chowder Guda';
  const joinedText = 'Member since Jan 2025';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-xl bg-background rounded-3xl border border-border shadow-2xl overflow-hidden text-text-primary"
        >
          {/* Top Banner */}
          <div className="relative bg-emerald-900 text-white p-6 flex flex-col md:flex-row items-center md:items-start gap-4">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/30 hover:bg-black/50 transition-all text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Avatar Circle */}
            <div className="w-20 h-20 font-black text-2xl rounded-full bg-emerald-800 border-2 border-emerald-400/40 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
              {userProfile.avatar_url ? (
                <img src={userProfile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span>{displayName.slice(0, 2).toUpperCase()}</span>
              )}
            </div>

            {/* User Title & Badges */}
            <div className="text-center md:text-left min-w-0">
              <h2 className="text-xl font-black italic uppercase tracking-wider">{displayName}</h2>
              <p className="text-xs font-bold text-emerald-200 mt-0.5">
                @{handle.replace('@', '')} • {locationText} • {joinedText}
              </p>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-3">
                <span className="px-3 py-1 rounded-full bg-emerald-500/30 border border-emerald-400/40 text-[9px] font-black uppercase tracking-widest text-emerald-200 flex items-center gap-1">
                  <Trophy className="w-3 h-3 text-emerald-300" /> TOP SCORER
                </span>
                <span className="px-3 py-1 rounded-full bg-emerald-500/30 border border-emerald-400/40 text-[9px] font-black uppercase tracking-widest text-emerald-200">
                  Cricket • Football
                </span>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-background-secondary border border-border text-center">
                <h3 className="text-2xl font-black text-accent">{userProfile.player_score || 815}</h3>
                <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mt-1">Player Score</p>
              </div>

              <div className="p-4 rounded-2xl bg-background-secondary border border-border text-center">
                <h3 className="text-2xl font-black">{userProfile.matches_played || 1}</h3>
                <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mt-1">Matches Played</p>
              </div>

              <div className="p-4 rounded-2xl bg-background-secondary border border-border text-center">
                <h3 className="text-2xl font-black text-emerald-400">{userProfile.win_rate || '68%'}</h3>
                <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mt-1">Win Rate</p>
              </div>

              <div className="p-4 rounded-2xl bg-background-secondary border border-border text-center">
                <h3 className="text-2xl font-black flex items-center justify-center gap-1">
                  {userProfile.rating || 4.8} <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                </h3>
                <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mt-1">Avg. Rating</p>
              </div>
            </div>

            {/* Skill Score Breakdown Card */}
            <div className="p-5 rounded-2xl bg-background-secondary border border-border space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-black italic uppercase text-xs tracking-wider">Player Score Breakdown</h4>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black uppercase">
                  Tier 5
                </span>
              </div>

              <div className="space-y-2 pt-2 border-t border-border/40 text-xs">
                <div className="flex justify-between font-bold">
                  <span className="opacity-60">Skill rating</span>
                  <span>320</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="opacity-60">Consistency</span>
                  <span className="text-emerald-400">+210</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="opacity-60">Fair play</span>
                  <span>180</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="opacity-60">Tournament</span>
                  <span>2</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default UserProfileModal;

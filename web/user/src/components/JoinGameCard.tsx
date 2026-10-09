import React from 'react';
import { Booking } from '../types';
import { motion } from 'framer-motion';
import { Users, Plus } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface JoinGameCardProps {
  booking: Booking;
  onJoin: (booking: Booking) => void;
  isHost?: boolean;
}

const JoinGameCard: React.FC<JoinGameCardProps> = ({ booking, onJoin, isHost }) => {
  const { theme } = useTheme();
  const isFull = booking.currentPlayers >= booking.maxPlayers;
  const canJoin = !isFull && !isHost;
  const remaining = booking.maxPlayers - booking.currentPlayers;
  const share = Math.ceil(booking.amount / (booking.currentPlayers + 1));

  return (
    <motion.div
      whileHover={canJoin ? { y: -5, scale: 1.02 } : {}}
      whileTap={canJoin ? { scale: 0.98 } : {}}
      onClick={() => canJoin && onJoin(booking)}
      className={`relative overflow-hidden p-5 md:p-5 border-2 transition-all duration-500 group h-full flex flex-col justify-between shadow-2xl`}
      style={{
          backgroundColor: theme.colors.card,
          borderColor: isFull || isHost ? 'transparent' : `${theme.colors.accent}20`,
          borderRadius: theme.radius.large,
          opacity: isFull ? 0.4 : isHost ? 0.8 : 1,
          filter: isFull ? 'grayscale(1)' : 'none',
          boxShadow: theme.elevation.card
      }}
    >
      {/* Glow Effect */}
      {canJoin && (
        <div className="absolute -top-10 -right-10 w-24 h-24 md:w-24 md:h-24 blur-2xl rounded-full opacity-20 group-hover:opacity-40 transition-all duration-500"
             style={{ backgroundColor: theme.colors.accent }} />
      )}

      <div className="space-y-4 md:space-y-4 relative z-10">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 md:mb-1.5">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: isHost ? theme.colors.textDisabled : theme.colors.accent }} />
              <h5 className="text-[9px] md:text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: isHost ? theme.colors.textDisabled : theme.colors.accentGlow }}>
                {isHost ? 'Your Match' : 'Open Match'}
              </h5>
            </div>
            <p className="text-sm md:text-sm font-black tracking-tighter leading-tight dynamic-text italic" style={{ color: theme.colors.textPrimary }}>{booking.slotTime}</p>
          </div>
          {canJoin && (
            <div className="p-2.5 md:p-2.5 rounded-xl flex items-center justify-center shadow-xl group-hover:rotate-12 transition-transform"
                 style={{ backgroundColor: theme.colors.accent, color: 'white' }}>
              <Plus className="w-4 h-4 md:w-4 md:h-4" />
            </div>
          )}
          {isHost && (
            <div className="px-3 py-1.5 md:px-3 md:py-1.5 rounded-xl border text-[8px] md:text-[8px] font-black uppercase tracking-widest"
                 style={{ borderColor: `${theme.colors.border}40`, color: theme.colors.textDisabled }}>
              Host
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 md:gap-3">
          <div className="w-8 h-8 md:w-8 md:h-8 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shrink-0 shadow-inner">
             <span className="text-[10px] md:text-[10px] font-black uppercase" style={{ color: theme.colors.accent }}>{booking.name[0]}</span>
          </div>
          <p className="text-[10px] md:text-[10px] font-black dynamic-text uppercase tracking-widest" style={{ color: theme.colors.textSecondary }}>{booking.name}</p>
        </div>
      </div>

      <div className="mt-6 pt-4 md:mt-6 md:pt-4 border-t relative z-10" style={{ borderColor: `${theme.colors.border}40` }}>
        <div className="flex justify-between items-end">
          <div className="space-y-1 md:space-y-1">
            <p className="text-[7px] md:text-[7px] font-black uppercase tracking-widest" style={{ color: theme.colors.textDisabled }}>Price per player</p>
            <div className="flex items-baseline gap-1 md:gap-1">
              <span className={`text-lg md:text-lg font-black italic tracking-tighter`} style={{ color: isFull ? theme.colors.textDisabled : theme.colors.textPrimary }}>₹{share}</span>
              <span className="text-[8px] md:text-[8px] font-black uppercase" style={{ color: theme.colors.textDisabled }}>/ player</span>
            </div>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 md:gap-1.5 md:px-3 md:py-1.5 rounded-xl border transition-all`}
                 style={{
                     backgroundColor: isFull ? 'transparent' : `${theme.colors.success}15`,
                     borderColor: isFull ? 'transparent' : `${theme.colors.success}30`,
                     color: isFull ? theme.colors.textDisabled : theme.colors.success
                 }}>
              <Users className="w-3 h-3 md:w-3 md:h-3" />
              <span className="text-[9px] md:text-[9px] font-black uppercase tracking-widest">
                {remaining} Spots Left
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default JoinGameCard;

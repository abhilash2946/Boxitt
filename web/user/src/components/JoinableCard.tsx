import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface JoinableCardProps {
  isJoinable: boolean;
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

const JoinableCard: React.FC<JoinableCardProps> = ({ isJoinable, onToggle, disabled, children }) => {
  const { theme } = useTheme();
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={() => !disabled && onToggle(!isJoinable)}
      className={`relative overflow-hidden p-6 border-2 transition-all duration-700 shadow-2xl cursor-pointer select-none`}
      style={{
          backgroundColor: isJoinable ? `${theme.colors.accent}15` : theme.colors.card,
          borderColor: isJoinable ? theme.colors.accent : theme.colors.border,
          borderRadius: theme.radius.large
      }}
    >
      <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full transition-all duration-700 opacity-10 pointer-events-none`}
           style={{ backgroundColor: isJoinable ? theme.colors.accent : 'transparent' }} />

      <div className="relative flex items-center justify-between gap-4 pointer-events-none">
        <div className={`flex items-center justify-center w-12 h-12 rounded-2xl shadow-2xl transition-all duration-700 shrink-0`}
             style={{ backgroundColor: isJoinable ? theme.colors.accent : 'rgba(255,255,255,0.05)', color: isJoinable ? 'white' : theme.colors.textDisabled }}>
          <Users className="w-6 h-6" />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-black uppercase tracking-[0.1em] italic transition-colors duration-700`}
              style={{ color: isJoinable ? theme.colors.textPrimary : theme.colors.textDisabled }}>
            FIND PLAYERS
          </h4>
          <p className={`text-[9px] font-black mt-1 uppercase tracking-widest transition-colors duration-700 opacity-60`}
             style={{ color: isJoinable ? theme.colors.accentGlow : theme.colors.textDisabled }}>
            {isJoinable ? 'Allow others to join' : 'Private session'}
          </p>
        </div>

        <div
          className={`relative w-14 h-7 rounded-full transition-all duration-500 flex items-center px-1 border-2 shrink-0`}
          style={{
              backgroundColor: isJoinable ? `${theme.colors.accent}40` : 'rgba(255,255,255,0.05)',
              borderColor: isJoinable ? theme.colors.accent : theme.colors.border
          }}
        >
          <motion.div
            animate={{ x: isJoinable ? 28 : 0 }}
            className={`w-5 h-5 rounded-full shadow-2xl transition-all duration-500 flex items-center justify-center`}
            style={{ backgroundColor: isJoinable ? 'white' : theme.colors.textDisabled }}
          >
            {isJoinable && <div className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: theme.colors.accent }} />}
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {isJoinable && children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="mt-4 pt-4 md:mt-4 md:pt-4 border-t transition-all cursor-default"
            style={{ borderColor: `${theme.colors.border}40` }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default JoinableCard;

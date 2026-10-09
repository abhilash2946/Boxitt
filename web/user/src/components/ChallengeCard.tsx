import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Search } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { usePermissions } from '../hooks/usePermissions';
import { storage } from '../services/storage';

interface ChallengeCardProps {
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

const ChallengeCard: React.FC<ChallengeCardProps> = ({ isEnabled, onToggle, disabled, children }) => {
  const { theme } = useTheme();
  const { checkAndPrompt, permissions } = usePermissions();

  // Auto-toggle if permission was just granted
  React.useEffect(() => {
    if (permissions.location === 'allow' && !isEnabled && !disabled) {
      // Only auto-enable if we were previously waiting or if it's the first time
      // To avoid annoying behavior, we could track intent, but for now simple sync is better
    }
  }, [permissions.location, isEnabled, onToggle, disabled]);

  const handleToggle = async (newState: boolean) => {
    if (disabled) return;
    onToggle(newState);
  };

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={() => !disabled && handleToggle(!isEnabled)}
      className={`relative overflow-hidden p-6 border-2 transition-all duration-700 shadow-2xl cursor-pointer select-none`}
      style={{
          backgroundColor: isEnabled ? `${theme.colors.accent}15` : theme.colors.card,
          borderColor: isEnabled ? theme.colors.accent : theme.colors.border,
          borderRadius: theme.radius.large
      }}
    >
      <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full transition-all duration-700 opacity-10 pointer-events-none`}
           style={{ backgroundColor: isEnabled ? theme.colors.accent : 'transparent' }} />

      <div className="relative flex items-center justify-between gap-4 pointer-events-none">
        <div className={`flex items-center justify-center w-12 h-12 rounded-2xl shadow-2xl transition-all duration-700 shrink-0`}
             style={{ backgroundColor: isEnabled ? theme.colors.accent : 'rgba(255,255,255,0.05)', color: isEnabled ? 'white' : theme.colors.textDisabled }}>
          <Swords className="w-6 h-6" />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-black uppercase tracking-[0.1em] italic transition-colors duration-700`}
              style={{ color: isEnabled ? theme.colors.textPrimary : theme.colors.textDisabled }}>
            CHALLENGE
          </h4>
          <p className={`text-[9px] font-black mt-1 uppercase tracking-widest transition-colors duration-700 opacity-60`}
             style={{ color: isEnabled ? theme.colors.accentGlow : theme.colors.textDisabled }}>
            {isEnabled ? 'Searching nearby • 5KM Radius' : 'Private mode • Hidden'}
          </p>
        </div>

        <div
          className={`relative w-14 h-7 rounded-full transition-all duration-500 flex items-center px-1 border-2 shrink-0`}
          style={{
              backgroundColor: isEnabled ? `${theme.colors.accent}40` : 'rgba(255,255,255,0.05)',
              borderColor: isEnabled ? theme.colors.accent : theme.colors.border
          }}
        >
          <motion.div
            animate={{ x: isEnabled ? 28 : 0 }}
            className={`w-5 h-5 rounded-full shadow-2xl transition-all duration-500 flex items-center justify-center`}
            style={{ backgroundColor: isEnabled ? 'white' : theme.colors.textDisabled }}
          >
            {isEnabled && <div className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: theme.colors.accent }} />}
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {isEnabled && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="mt-4 pt-4 border-t transition-all" style={{ borderColor: `${theme.colors.border}40` }}>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex -space-x-3">
                {[1, 2, 3].map((i) => (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                    key={i}
                    className="w-6 h-6 rounded-full border-2 bg-white flex items-center justify-center shadow-lg"
                    style={{ borderColor: theme.colors.card }}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.colors.accent }} />
                  </motion.div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Search className="w-3 h-3 animate-pulse" style={{ color: theme.colors.accent }} />
                <span className="text-[10px] font-black uppercase tracking-widest animate-pulse" style={{ color: theme.colors.accent }}>
                  Searching for players...
                </span>
              </div>
            </div>

            {children && (
              <div onClick={(e) => e.stopPropagation()} className="cursor-default">
                {children}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ChallengeCard;

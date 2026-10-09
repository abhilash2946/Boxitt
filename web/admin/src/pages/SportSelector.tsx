import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useBlocker } from 'react-router-dom';
import { SportType } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { handleError } from '../services/errorHandler';
import { useTheme } from '../contexts/ThemeContext';
import { User as UserIcon, LogOut } from 'lucide-react';

export const getSportSlug = (sport: SportType): string => {
  switch (sport) {
    case SportType.CRICKET: return 'cricket';
    case SportType.FOOTBALL: return 'football';
    case SportType.TENNIS: return 'tennis';
    case SportType.BASKETBALL: return 'basketball';
    case SportType.BADMINTON: return 'badminton';
    case SportType.PICKLEBALL: return 'pickleball';
    case SportType.SWIMMING: return 'swimming';
    case SportType.GAME_ZONE: return 'gamezone';
    default: return String(sport).toLowerCase().replace(/box\s*/i, '').trim();
  }
};

interface SportSelectorProps {
  onSelect?: (sport: SportType) => void;
  onLogout: () => void;
  onProfile?: () => void;
}

const SportSelector: React.FC<SportSelectorProps> = ({ onSelect, onLogout, onProfile }) => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const sports = Object.values(SportType);

  const [showLogoutToast, setShowLogoutToast] = useState(false);
  const lastBackPressRef = useRef<number>(0);
  const toastTimerRef = useRef<any>(null);

  const blocker = useBlocker(
    ({ historyAction }) => historyAction === 'POP'
  );

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        blocker.reset();
        onLogout();
      } else {
        lastBackPressRef.current = now;
        blocker.reset();
        setShowLogoutToast(true);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => {
          setShowLogoutToast(false);
        }, 2000);
      }
    }
  }, [blocker.state, onLogout]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const sportInfo: Record<SportType, { icon: string; color: string; shadow: string }> = {
    [SportType.CRICKET]: { icon: '🏏', color: 'from-emerald-400 to-emerald-600', shadow: 'shadow-emerald-500/40' },
    [SportType.FOOTBALL]: { icon: '⚽️', color: 'from-blue-400 to-blue-600', shadow: 'shadow-blue-500/40' },
    [SportType.TENNIS]: { icon: '🎾', color: 'from-lime-400 to-lime-600', shadow: 'shadow-lime-500/40' },
    [SportType.BASKETBALL]: { icon: '🏀', color: 'from-orange-400 to-orange-600', shadow: 'shadow-orange-500/40' },
    [SportType.BADMINTON]: { icon: '🏸', color: 'from-sky-400 to-sky-600', shadow: 'shadow-sky-500/40' },
    [SportType.PICKLEBALL]: { icon: '🏓', color: 'from-teal-400 to-teal-600', shadow: 'shadow-teal-500/40' },
    [SportType.SWIMMING]: { icon: '🏊‍♂️', color: 'from-cyan-400 to-cyan-600', shadow: 'shadow-cyan-500/40' },
    [SportType.GAME_ZONE]: { icon: '🎮', color: 'from-purple-500 to-indigo-600', shadow: 'shadow-purple-500/40' },
  };

  const handleSportSelect = (sport: SportType) => {
    try {
      if (onSelect) {
        onSelect(sport);
      }
      const slug = getSportSlug(sport);
      navigate(`/arenas/${slug}`);
    } catch (err) {
      const appError = handleError(err);
      console.error('Error selecting sport:', appError.message);
    }
  };

  const handleProfileClick = () => {
    if (onProfile) {
      onProfile();
    } else {
      navigate('/profile');
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-[var(--fluid-padding)] flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 bg-background"
         style={{ backgroundColor: theme.colors.background }}>
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] pointer-events-none opacity-20 md:block hidden"
           style={{ backgroundColor: theme.colors.accent }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] pointer-events-none opacity-20 md:block hidden"
           style={{ backgroundColor: theme.colors.success }} />

      <div className="absolute top-8 right-8 z-50 md:top-8 md:right-8 flex items-center gap-3">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleProfileClick}
          className="w-12 h-12 md:w-12 md:h-12 border rounded-2xl md:rounded-theme-md shadow-theme-card flex items-center justify-center bg-card"
          style={{ borderColor: theme.colors.border, color: theme.colors.textPrimary }}
          title="My Profile"
        >
          <UserIcon className="w-6 h-6 md:w-6 md:h-6" />
        </motion.button>
      </div>

      <div className="max-w-4xl mx-auto w-full text-center relative z-10 px-2 md:px-0">
        <motion.h1
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-4xl md:text-7xl font-black tracking-tighter mb-4 md:mb-[2vw] italic uppercase drop-shadow-2xl md:drop-shadow-none text-text-primary"
        >
          Select Your <span style={{ color: theme.colors.accent }}>Sport</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="font-bold uppercase text-[10px] md:text-xs tracking-[0.3em] mb-12 md:mb-16 text-text-disabled"
        >
          Choose a sport to find available arenas
        </motion.p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-8 perspective-1000">
          {sports.map((sport, index) => (
            <motion.button
              key={sport}
              initial={{ opacity: 0, y: 50, rotateX: 20 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              whileHover={{
                scale: 1.05,
                rotateY: 10,
                rotateX: -5,
                transition: { duration: 0.2 }
              }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleSportSelect(sport)}
              className="group relative aspect-[4/5] sm:aspect-square rounded-[2rem] md:rounded-theme-lg p-1 overflow-hidden transition-all duration-300 bg-card border border-border md:border-none shadow-theme-card md:shadow-none"
            >
              {/* Card Inner Content */}
              <div className={`w-full h-full rounded-[1.8rem] md:rounded-[2.3rem] bg-gradient-to-br ${sportInfo[sport].color} flex flex-col items-center justify-center relative overflow-hidden shadow-2xl`}>
                {/* Glossy Overlay */}
                <div className="absolute top-0 left-0 w-full h-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="text-6xl md:text-7xl mb-3 md:mb-[2vw] drop-shadow-2xl transform transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-2">
                  {sportInfo[sport].icon}
                </div>
                <span className="text-[3vw] md:text-lg font-black text-white tracking-tight uppercase px-4 text-center drop-shadow-lg">
                  {sport}
                </span>

                {/* Reflection Effect */}
                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/20 rounded-full blur-2xl group-hover:bg-white/40 transition-all duration-500" />
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {showLogoutToast && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full bg-black/85 backdrop-blur-md text-white border border-white/15 shadow-2xl flex items-center gap-3 text-xs font-black uppercase tracking-widest pointer-events-none"
          >
            <LogOut className="w-4 h-4 text-accent animate-pulse" />
            <span>Click again for logout</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SportSelector;

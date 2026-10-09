import React from 'react';
import NotificationBell from './NotificationBell';
import { useTheme } from '../contexts/ThemeContext';
import { motion } from 'framer-motion';
import { ChevronLeft, User as UserIcon, Shield } from 'lucide-react';

interface DashboardNavbarProps {
  user: {
    id?: string;
    [key: string]: any;
  };
  onProfileClick?: () => void;
  onBackClick?: () => void;
}

const DashboardNavbar: React.FC<DashboardNavbarProps> = ({ user, onProfileClick, onBackClick }) => {
  const { theme } = useTheme();

  return (
    <div className="fixed top-[4vw] right-[4vw] md:top-6 md:right-8 flex items-center gap-[3vw] md:gap-4 z-50">
      {onBackClick && (
        <button
          onClick={onBackClick}
          className="px-[4vw] py-[2vw] md:px-6 md:py-2 rounded-theme-md font-black text-[3vw] md:text-sm tracking-widest transition-all border shadow-theme-card active:translate-y-0.5"
          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.textPrimary }}
        >
          BACK
        </button>
      )}

      <NotificationBell userId={user?.id} />

      {onProfileClick && (
        <button
          onClick={onProfileClick}
          className="w-[var(--btn-height)] h-[var(--btn-height)] md:w-10 md:h-10 rounded-full border flex items-center justify-center transition-all shadow-theme-card active:scale-95"
          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
        >
          <UserIcon className="w-[var(--icon-size)] h-[var(--icon-size)] md:w-6 md:h-6" style={{ color: theme.colors.textDisabled }} />
        </button>
      )}
    </div>
  );
};

export default DashboardNavbar;

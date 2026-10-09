import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { motion } from 'framer-motion';
import { ChevronLeft, User as UserIcon, Shield, LayoutDashboard, Scan } from 'lucide-react';

interface DashboardNavbarProps {
  user: {
    id?: string;
    role?: string;
    role_status?: string;
    [key: string]: any;
  };
  onAdminClick?: () => void;
  onProfileClick?: () => void;
  onBackClick?: () => void;
}

const DashboardNavbar: React.FC<DashboardNavbarProps> = ({ user, onAdminClick, onProfileClick, onBackClick }) => {
  const { theme } = useTheme();
  const isApproved = user?.role_status === 'approved';
  const isAdmin = user?.role === 'admin' && isApproved;
  const isSuperAdmin = user?.role === 'superadmin' && isApproved;

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

      {isSuperAdmin && (
        <button
          onClick={() => window.location.href = '/approval-dashboard'}
          className="px-[4vw] py-[2vw] md:px-5 md:py-2.5 text-white rounded-theme-md font-bold text-[3vw] md:text-sm tracking-wide shadow-theme-elevated transition-all active:translate-y-0.5"
          style={{ backgroundColor: theme.colors.accent }}
        >
          Approvals
        </button>
      )}

      {isAdmin && (
        <button
          onClick={onAdminClick}
          className="px-[4vw] py-[2vw] md:px-6 md:py-2 rounded-theme-md font-black text-[3vw] md:text-sm tracking-widest transition-all border shadow-theme-card active:translate-y-0.5 flex items-center gap-2"
          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.textPrimary }}
        >
          <Shield className="w-4 h-4" />
          ADMIN
        </button>
      )}

      {onProfileClick && (
        <button
          onClick={onProfileClick}
          className="w-[var(--btn-height)] h-[var(--btn-height)] md:w-10 md:h-10 rounded-full border flex items-center justify-center transition-all shadow-theme-card active:scale-95 overflow-hidden"
          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
        >
          {user?.profileImage || user?.avatar_url ? (
            <img src={user.profileImage || user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <UserIcon className="w-[var(--icon-size)] h-[var(--icon-size)] md:w-6 md:h-6" style={{ color: theme.colors.textDisabled }} />
          )}
        </button>
      )}
    </div>
  );
};

export default DashboardNavbar;

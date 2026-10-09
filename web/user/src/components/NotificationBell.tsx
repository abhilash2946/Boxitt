import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useTheme } from '../contexts/ThemeContext';
import { Bell, BellOff, Clock, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePermissions } from '../contexts/PermissionsContext';
import { parseSportParam, SportType } from '../types';
import { storage } from '../services/storage';

interface NotificationBellProps {
  userId: string | undefined;
  selectedSport?: string | null;
  onSeeAll?: () => void;
  onNavigate?: (page: any) => void;
}

export const matchesSport = (notif: any, selectedSport?: string | null): boolean => {
  if (!selectedSport) return true;

  const targetParsed = parseSportParam(selectedSport);

  let dataObj: any = {};
  if (typeof notif.data === 'string') {
    try { dataObj = JSON.parse(notif.data); } catch (e) {}
  } else if (notif.data) {
    dataObj = notif.data;
  }

  const notifSport = dataObj.sport || dataObj.sport_type || notif.sport;
  if (notifSport) {
    return parseSportParam(String(notifSport)) === targetParsed;
  }

  const text = `${notif.title || ''} ${notif.message || ''} ${JSON.stringify(dataObj)}`.toLowerCase();

  const sportKeywords: Record<string, string[]> = {
    [SportType.CRICKET]: ['cricket', 'box cricket'],
    [SportType.FOOTBALL]: ['football', 'futsal', 'soccer', 'cr7'],
    [SportType.TENNIS]: ['tennis', 'ten'],
    [SportType.BASKETBALL]: ['basketball', 'basket', 'harsh'],
    [SportType.BADMINTON]: ['badminton'],
    [SportType.PICKLEBALL]: ['pickleball', 'pickle'],
    [SportType.SWIMMING]: ['swimming', 'swim'],
    [SportType.GAME_ZONE]: ['game zone', 'gamezone', 'station', 'playstation', 'xbox']
  };

  const targetKeywords = sportKeywords[targetParsed] || [String(selectedSport).toLowerCase()];
  const hasTargetKeyword = targetKeywords.some(kw => text.includes(kw));

  const otherKeywords = Object.entries(sportKeywords)
    .filter(([s]) => s !== targetParsed)
    .flatMap(([, kws]) => kws);
  const hasOtherKeyword = otherKeywords.some(kw => text.includes(kw));

  if (hasTargetKeyword) return true;
  if (hasOtherKeyword) return false;

  const isMatchmakingOrBooking = [
    'squad', 'match', 'challenge', 'joinable', 'arena', 'court', 'slot', 'booking'
  ].some(kw => text.includes(kw));

  if (isMatchmakingOrBooking) {
    return false;
  }

  return true;
};

const NotificationBell: React.FC<NotificationBellProps> = ({ userId, selectedSport, onSeeAll, onNavigate }) => {
  const { theme } = useTheme();
  const { checkAndPrompt, permissions } = usePermissions();
  const { notifications, markAllAsRead } = useNotifications(userId);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeSport = selectedSport || storage.get('selectedSport') || storage.getNavState()?.selectedSport || null;
  const filteredNotifications = notifications.filter(n => matchesSport(n, activeSport));
  const unreadCount = filteredNotifications.filter(n => !n.is_read).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (!isOpen) {
      // Trigger permission check on click (gesture-safe for mobile)
      if (permissions.notifications !== 'allow') {
        checkAndPrompt('notifications', false, false, true);
      }
    }
    setIsOpen(!isOpen);
  };

  const isMatchmakingRelated = (notif: any) => {
    const type = notif.data?.type;
    const title = notif.title?.toLowerCase() || '';
    return title.includes('challenge') ||
      title.includes('joinable') ||
      [
        'challenge', 'challenge_request', 'challenge_accepted', 'challenge_created',
        'joinable_match', 'joinable_created', 'match_join_request', 'match_join_request_sent',
        'challenge_request_sent', 'request_cancelled', 'request_cancelled_self'
      ].includes(type);
  };

  const handleNotifClick = (notif: any) => {
    if (isMatchmakingRelated(notif)) {
      if (onNavigate) {
        const sport = notif.data?.sport || activeSport;
        if (sport) {
          onNavigate(`challenges/${String(sport).toLowerCase()}`);
        } else {
          onNavigate('challenges');
        }
        setIsOpen(false);
      }
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button whileTap={{ scale: 0.9 }} onClick={handleToggle}
                     className="relative w-[var(--btn-height)] h-[var(--btn-height)] md:w-12 md:h-12 rounded-theme-md border transition-all flex items-center justify-center shadow-theme-card active:scale-95"
                     style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}>
        <Bell className="w-[var(--icon-size)] h-[var(--icon-size)] md:w-6 md:h-6" style={{ color: theme.colors.textDisabled }} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 block h-[4vw] w-[4vw] md:h-4 md:w-4 rounded-full border-2 text-[2.5vw] md:text-[10px] font-black text-white flex items-center justify-center shadow-theme-elevated"
                style={{ backgroundColor: theme.colors.error, borderColor: theme.colors.card }}>
            {unreadCount}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="fixed md:absolute top-[75px] md:top-full left-4 right-4 md:left-auto md:right-0 md:mt-4 md:w-80 border shadow-theme-modal overflow-hidden z-[1000] transition-all"
                      style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderRadius: theme.radius.large }}>
            <div className="p-4 md:p-6 border-b flex justify-between items-center" style={{ borderColor: theme.colors.border }}>
              <h3 className="text-sm font-black uppercase tracking-widest italic" style={{ color: theme.colors.textPrimary }}>Notifications</h3>
              <div className="flex items-center gap-3">
                {onSeeAll && <button onClick={() => { setIsOpen(false); onSeeAll(); }} className="text-[10px] font-black uppercase tracking-widest transition-colors shadow-sm" style={{ color: theme.colors.accent }}>See All</button>}
                <button onClick={() => { setIsOpen(false); onNavigate?.('notifications'); }} className="p-2 rounded-lg bg-background-secondary border border-border">
                   <ExternalLink className="w-3 h-3" style={{ color: theme.colors.textPrimary }} />
                </button>
              </div>
            </div>
            <div className="max-h-[420px] md:max-h-[480px] overflow-y-auto border-t" style={{ borderColor: theme.colors.border }}>
              {filteredNotifications.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-16 h-16 rounded-theme-md mx-auto mb-4 flex items-center justify-center shadow-inner" style={{ backgroundColor: theme.colors.backgroundSecondary }}>
                    <BellOff className="w-8 h-8 opacity-20" style={{ color: theme.colors.textDisabled }} />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: theme.colors.textDisabled }}>None</p>
                </div>
              ) : (
                <>
                  {filteredNotifications.map((notif) => (
                    <div key={notif.id} onClick={() => handleNotifClick(notif)} className="p-5 border-b hover:opacity-80 transition-all cursor-pointer group relative" style={{ borderColor: theme.colors.border, backgroundColor: 'transparent' }}>
                      <p className="text-xs font-black uppercase tracking-tighter mb-1" style={{ color: theme.colors.textPrimary }}>{notif.title}</p>
                      <p className="text-[11px] font-medium leading-relaxed mb-2" style={{ color: theme.colors.textSecondary }}>{notif.message}</p>
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2 opacity-40">
                           <Clock className="w-3 h-3" />
                           <p className="text-[9px] font-black uppercase tracking-widest">
                             {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                           </p>
                         </div>
                         {isMatchmakingRelated(notif) && (
                           <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                             {notif.title.toLowerCase().includes('joinable') || notif.data?.type?.includes('joinable') ? 'Joinable Match' : 'Open Challenge'}
                           </span>
                         )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;

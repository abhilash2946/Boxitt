import React, { useState, useEffect } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Trash2, ChevronLeft, BellOff, Clock, QrCode } from 'lucide-react';
import { handleError } from '../services/errorHandler';
import { useTheme } from '../contexts/ThemeContext';
import { usePermissions } from '../contexts/PermissionsContext';
import QRCodeModal from '../components/QRCodeModal';
import { bookingService } from '../services/bookingService';
import { supabase } from '../services/supabase';
import { matchesSport } from '../components/NotificationBell';
import { storage } from '../services/storage';

interface NotificationsPageProps {
  userId: string | undefined;
  selectedSport?: string | null;
  onBack: () => void;
  onAlert?: (message: string, type: 'success' | 'error' | 'info') => void;
  onConfirm?: (config: {
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
  }) => void;
  onNavigate?: (page: any) => void;
  onShowQR?: (booking: any, location: any) => void;
}

const NotificationsPage: React.FC<NotificationsPageProps> = ({ userId, selectedSport, onBack, onAlert, onConfirm, onNavigate, onShowQR }) => {
  const { theme } = useTheme();
  const { checkAndPrompt } = usePermissions();
  const { notifications, deleteNotification, clearAllNotifications, markAllAsRead, refresh } = useNotifications(userId);
  const [loadingQR, setLoadingQR] = useState(false);

  const activeSport = selectedSport || storage.get('selectedSport') || storage.getNavState()?.selectedSport || null;
  const filteredNotifications = notifications.filter(n => matchesSport(n, activeSport));

  useEffect(() => {
    checkAndPrompt('notifications', false, false, false);
    if (userId) {
      refresh();
      markAllAsRead();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleDelete = async (id: string) => {
    try {
      const res = await deleteNotification(id);
      if (res?.error) throw res.error;
      onAlert?.('Deleted', 'success');
    } catch (err) {
      onAlert?.(handleError(err).message, 'error');
    }
  };

  const handleClearAll = async () => {
    const runClear = async () => {
      try {
        const res = await clearAllNotifications();
        if (res?.error) throw res.error;
        onAlert?.('Cleared', 'success');
      } catch (err) {
        onAlert?.(handleError(err).message, 'error');
      }
    };

    if (onConfirm) {
      onConfirm({
        message: 'Clear all?',
        confirmText: 'Clear',
        cancelText: 'Cancel',
        isDestructive: true,
        onConfirm: () => {
          runClear();
        },
      });
      return;
    }

    runClear();
  };

  const handleViewTicket = async (notif: any) => {
    if (!onShowQR) return;
    setLoadingQR(true);
    try {
      const bookingId = notif.data?.booking_id || notif.data?.challenge_id;
      const type = notif.data?.booking_id ? 'match' : 'challenge';

      if (type === 'match') {
        const booking = await bookingService.getBookingById(bookingId);
        if (booking) {
          const { data: loc } = await supabase.from('locations').select('*').eq('id', booking.locationId).single();
          onShowQR(booking, loc);
        }
      } else {
        const challenge = await (bookingService as any).getChallengeById(bookingId);
        if (challenge) {
          const isHost = String(challenge.challenger_id) === String(userId);
          const isAcceptor = String(challenge.accepted_by) === String(userId);
          const holderName = isHost
            ? (challenge.challenger?.display_name || challenge.challenger?.username || 'Challenger Host')
            : (isAcceptor
                ? (challenge.acceptor?.display_name || challenge.acceptor?.username || 'Challengee Acceptor')
                : 'Player');
          const role = isHost ? 'CHALLENGER (HOST)' : (isAcceptor ? 'CHALLENGEE (ACCEPTOR)' : 'MATCH PARTICIPANT');
          const qrData = `challenge:${challenge.id}:${isHost ? 'host' : 'acceptor'}:${userId || 'guest'}`;

          const adaptedBooking = {
            id: challenge.id,
            status: challenge.status || 'booked',
            slotTime: challenge.slot_time,
            date: challenge.date,
            holderName,
            role,
            qrData,
            sport: challenge.sport
          };
          onShowQR(adaptedBooking, challenge.location);
        }
      }
    } catch (err) {
      onAlert?.(handleError(err).message, 'error');
    } finally {
      setLoadingQR(false);
    }
  };

  const handleNotifClick = (notif: any) => {
    const type = notif.data?.type;
    const isMatchmaking = [
      'challenge', 'challenge_request', 'challenge_accepted', 'challenge_created',
      'joinable_match', 'joinable_created', 'match_join_request', 'match_join_request_sent',
      'challenge_request_sent', 'request_cancelled', 'request_cancelled_self'
    ].includes(type);

    const isConfirmed = [
      'challenge_confirmed', 'match_join_confirmed',
      'challenge_confirmed_host', 'match_join_confirmed_host'
    ].includes(type);

    if (isMatchmaking) {
      if (onNavigate) {
        const sport = notif.data?.sport;
        if (sport) {
          onNavigate(`challenges/${sport.toLowerCase()}`);
        } else {
          onNavigate('challenges');
        }
      }
    } else if (isConfirmed) {
      handleViewTicket(notif);
    }
  };

  return (
    <div className="min-h-screen p-5 md:p-6 relative overflow-hidden transition-all duration-300 bg-background"
         style={{ backgroundColor: theme.colors.background }}>
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none opacity-20 md:block hidden" style={{ backgroundColor: theme.colors.accent }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none opacity-20 md:block hidden" style={{ backgroundColor: theme.colors.success }} />

      <div className="max-w-2xl mx-auto relative z-10">
        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center justify-between mb-8 md:mb-12 p-6 md:p-6 border border-border shadow-theme-card transition-all bg-card rounded-[2rem] md:rounded-theme-lg"
          style={{ borderColor: theme.colors.border }}
        >
          <div className="flex items-center gap-4">
            <motion.button
              whileTap={{ scale: 0.9 }} onClick={onBack}
              className="p-3.5 md:p-3 rounded-2xl md:rounded-theme-md border transition-all shadow-theme-card active:scale-90 bg-background-secondary"
              style={{ borderColor: theme.colors.border, color: theme.colors.textPrimary }}
            >
              <ChevronLeft className="w-6 h-6 md:w-5 md:h-5" />
            </motion.button>
            <div>
              <h1 className="text-2xl md:text-2xl font-black italic md:not-italic uppercase tracking-tighter text-text-primary">Notifications</h1>
              <p className="text-[10px] md:text-[8px] font-black uppercase tracking-[0.4em] mt-1 text-text-disabled">Activity</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {filteredNotifications.length > 0 && (
                <button onClick={handleClearAll} className="px-5 py-3 md:px-4 md:py-2 text-white rounded-xl md:rounded-theme-md text-[10px] md:text-[9px] font-black uppercase tracking-widest shadow-theme-elevated active:scale-95 bg-error">
                Clear All
                </button>
            )}
          </div>
        </motion.header>

        <div className="space-y-5 md:space-y-4 pb-32">
          <AnimatePresence mode="popLayout">
            {filteredNotifications.length === 0 ? (
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1 }} className="rounded-[3rem] p-20 md:p-16 text-center border border-border shadow-inner transition-all bg-background-secondary/30">
                <div className="w-24 h-24 md:w-20 md:h-20 rounded-3xl md:rounded-[1.5rem] flex items-center justify-center mx-auto mb-8 md:mb-6 shadow-theme-card border border-border bg-card">
                  <BellOff className="w-12 h-12 md:w-10 md:h-10 text-text-disabled opacity-40 md:opacity-100" />
                </div>
                <p className="text-sm md:text-sm font-black uppercase tracking-[0.3em] text-text-disabled opacity-60">No notifications yet</p>
              </motion.div>
            ) : (
              filteredNotifications.map((notif, idx) => (
                <motion.div
                  layout
                  key={notif.id}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 50, opacity: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => handleNotifClick(notif)}
                  className={`p-6 md:p-6 border border-border shadow-theme-card flex flex-col md:flex-row justify-between items-start group relative overflow-hidden transition-all bg-card rounded-[1.5rem] md:rounded-[1.25rem] ${notif.data?.type ? 'cursor-pointer' : ''}`}
                >
                  <div className="absolute top-0 left-0 w-1.5 md:w-1.5 h-full bg-accent" />
                  <div className="flex-1 pl-3 md:pl-4 w-full">
                    <div className="flex items-center justify-between mb-3 md:mb-2">
                      <div className="flex items-center gap-3 md:gap-2">
                        {!notif.is_read && <div className="w-2 h-2 md:w-1.5 md:h-1.5 rounded-full shrink-0 bg-accent shadow-accentGlow" />}
                        <h3 className="text-sm md:text-sm font-black uppercase tracking-[0.1em] md:tracking-wider flex items-center gap-3 md:gap-2 text-text-primary">
                          <Bell className="w-4 h-4 md:w-3.5 md:h-3.5 text-accent" />
                          {notif.title}
                        </h3>
                      </div>
                      {/* Delete button for mobile (visible by default) or desktop (hover) */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(notif.id); }}
                        className="p-2.5 md:p-2 -mr-2 rounded-xl md:rounded-lg text-text-disabled hover:text-error hover:bg-error/10 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 bg-background-secondary/50 md:bg-transparent"
                      >
                        <Trash2 className="w-5 h-5 md:w-4 md:h-4" />
                      </button>
                    </div>

                    <p className="text-xs md:text-xs font-black md:font-bold leading-relaxed mb-6 md:mb-4 text-text-secondary pr-2 italic md:not-italic">
                      {notif.message}
                    </p>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 md:gap-4 mt-2">
                      <div className="flex items-center gap-3 md:gap-2 text-text-disabled opacity-60">
                        <Clock className="w-3.5 h-3.5 md:w-3 md:h-3" />
                        <p className="text-[10px] md:text-[9px] font-black uppercase tracking-widest">
                          {new Date(notif.created_at).toLocaleDateString()} • {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      {['match_join_confirmed', 'challenge_confirmed', 'challenge_confirmed_host', 'match_join_confirmed_host'].includes(notif.data?.type) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleViewTicket(notif); }}
                          className="w-full md:w-auto flex items-center justify-center gap-3 md:gap-2 px-6 py-3.5 md:px-4 md:py-2 rounded-2xl md:rounded-xl bg-accent text-white text-[11px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-widest shadow-theme-elevated active:scale-95 transition-all"
                        >
                          <QrCode className="w-5 h-5 md:w-4 md:h-4" />
                          View Ticket
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {loadingQR && (
        <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;

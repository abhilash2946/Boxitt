import React, { useState, useEffect, useCallback, Suspense, lazy, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Calendar,
  History,
  Shield,
  Bell,
  User as UserIcon,
  ChevronLeft,
  Scan,
  CheckCircle2,
  XCircle,
  Swords,
  MessageSquare
} from 'lucide-react';
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
  Navigate,
  useRouteError
} from 'react-router-dom';
import AuthCallbackPage from './pages/AuthCallbackPage';
import { AuthProvider } from './contexts/AuthProvider';
import { RealtimeSyncProvider } from './providers/RealtimeSyncProvider';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { PermissionsProvider } from './contexts/PermissionsContext';
import { usePermissions } from './hooks/usePermissions';
import { storage } from './services/storage';
import { forceScrollTop } from './utils/scroll';
import { PLATFORM_URLS } from './constants';
import { User, Location, SportType, parseSportParam, getSportCapability } from './types';
import { getSportSlug } from './pages/SportSelector';
import { messagingService } from './services/messagingService';
import { getUserProfile } from './services/userService';
import { ensureUserProfile } from './services/authService';
import { locationService } from './services/locationService';
import { errorHandler } from './services/errorHandler';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { supabase } from './services/supabase';
import NotificationBell from './components/NotificationBell';
import PermissionPrompt from './components/PermissionPrompt';
import QRCodeModal from './components/QRCodeModal';

// Initialize storage cleanup for new sessions
storage.init();

// Lazy Load Pages
const BookingPage = lazy(() => import('./pages/BookingPage'));
const Scorer = lazy(() => import('./pages/Scorer'));
const ChatHub = lazy(() => import('./pages/ChatHub'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const LocationSelector = lazy(() => import('./pages/LocationSelector'));
const SportSelector = lazy(() => import('./pages/SportSelector'));
const ReviewPage = lazy(() => import('./pages/ReviewPage'));
const EditProfilePage = lazy(() => import('./pages/EditProfilePage'));
const ViewProfileScreen = lazy(() => import('./components/ViewProfileScreen'));
const ProfileDashboard = lazy(() => import('./components/ProfileDashboard'));
const CustomerCarePage = lazy(() => import('./pages/CustomerCarePage'));
const AboutAppPage = lazy(() => import('./pages/AboutAppPage'));
const TransactionsPage = lazy(() => import('./pages/TransactionsPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ChallengesPage = lazy(() => import('./pages/ChallengesPage'));
const ArenaDetailsPage = lazy(() => import('./pages/ArenaDetailsPage'));

const RootErrorBoundary = () => {
  const error = useRouteError();
  console.error('Root Error Boundary caught:', error);
  const [showDetails, setShowDetails] = useState(false);

  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : (error && typeof error === 'object' && 'statusText' in error && (error as any).statusText)
      ? (error as any).statusText
      : JSON.stringify(error) || 'Unknown error occurred';

  const isChunkError =
    errorMessage.includes('Failed to fetch dynamically imported module') ||
    errorMessage.includes('ChunkLoadError');

  const isNetworkError =
    !navigator.onLine ||
    errorMessage.toLowerCase().includes('network') ||
    errorMessage.toLowerCase().includes('fetch') ||
    errorMessage.toLowerCase().includes('unable to resolve host');

  const errorInfo = errorHandler.handle(errorMessage);

  const title = isChunkError
    ? 'NEW VERSION AVAILABLE'
    : isNetworkError
    ? 'NO INTERNET'
    : errorInfo.title || 'UNEXPECTED ERROR';

  const description = isChunkError
    ? "We've updated Boxitt with new features. Please refresh to continue."
    : isNetworkError
    ? 'Please check your internet connection and try again.'
    : errorInfo.userMessage || 'An unexpected error occurred while loading this page.';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md overflow-hidden">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-8 text-center shadow-2xl relative z-10 overflow-hidden">
        <div className="w-16 h-16 rounded-2xl bg-error text-white flex items-center justify-center mx-auto mb-6 shadow-lg">
          <XCircle className="w-10 h-10" />
        </div>
        <h3 className="text-xl font-black mb-3 uppercase italic tracking-tighter text-text-primary">
          {title}
        </h3>
        <p className="font-bold mb-4 leading-relaxed text-sm text-text-secondary">
          {description}
        </p>

        {!isChunkError && (
          <div className="mb-6">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-[10px] font-black uppercase tracking-widest text-text-disabled hover:text-text-primary transition-colors"
            >
              {showDetails ? 'Hide Technical Details' : 'View Technical Details'}
            </button>
            {showDetails && (
              <div className="mt-4 text-left p-4 bg-background-secondary rounded-xl border border-border overflow-hidden">
                <p className="text-[10px] font-mono italic break-all text-text-secondary">
                  {errorMessage}
                </p>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => window.location.reload()}
          className="w-full py-4 bg-accent text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-lg active:scale-95 transition-all"
        >
          {isChunkError ? 'REFRESH APP' : 'CONFIRM'}
        </button>
      </div>
    </div>
  );
};

const LoadingFallback = () => (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center">
    <img src="/logo.png" className="w-20 h-20 animate-pulse mb-4 object-contain" alt="Loading..." />
    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-text-secondary animate-pulse">Loading Boxitt...</p>
  </div>
);

interface GlobalAlertModalProps {
  alert: { message: string; type: 'success' | 'error' | 'info'; onClose?: () => void } | null;
  onClose: () => void;
  backdropColor: string;
  theme: any;
}

const GlobalAlertModal: React.FC<GlobalAlertModalProps> = ({ alert, onClose, backdropColor, theme }) => {
  const [showDetails, setShowDetails] = useState(false);

  if (!alert) return null;

  const errorInfo = alert.type === 'error' ? errorHandler.handle(alert.message) : null;
  const title = errorInfo?.title || (alert.type === 'error' ? 'Error' : alert.type === 'success' ? 'Success' : 'Notice');
  const message = errorInfo?.userMessage || alert.message;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 backdrop-blur-md"
        style={{ backgroundColor: backdropColor }}
      />
      <motion.div
        initial={{ scale: 0.9, rotateX: 20 }}
        animate={{ scale: 1, rotateX: 0 }}
        exit={{ scale: 0.9, rotateX: -20 }}
        className="border rounded-theme-lg w-full max-w-sm p-8 text-center transition-all duration-300 perspective-1000 relative z-10 overflow-hidden"
        style={{
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          boxShadow: theme.elevation.modal,
          backdropFilter: theme.name !== 'light' ? 'blur(10px)' : 'none'
        }}
      >
        <div className={`w-16 h-16 rounded-theme-md flex items-center justify-center mx-auto mb-6 shadow-theme-elevated ${alert.type === 'success' ? 'bg-success text-white' : alert.type === 'error' ? 'bg-error text-white' : 'bg-accent text-white'}`}>
          {alert.type === 'success' ? <CheckCircle2 className="w-10 h-10" /> : alert.type === 'error' ? <XCircle className="w-10 h-10" /> : <Bell className="w-10 h-10" />}
        </div>
        <h3 className="text-xl font-black mb-3 uppercase italic tracking-tighter" style={{ color: theme.colors.textPrimary }}>{title}</h3>
        <p className="font-bold mb-4 leading-relaxed text-sm" style={{ color: theme.colors.textSecondary }}>{message}</p>

        {alert.type === 'error' && (
          <div className="mb-6">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-[10px] font-black uppercase tracking-widest text-text-disabled hover:text-text-primary transition-colors"
            >
              {showDetails ? 'Hide Technical Details' : 'View Technical Details'}
            </button>
            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-4 text-left p-4 bg-background-secondary rounded-theme-sm border border-border overflow-hidden"
                >
                  <p className="text-[10px] font-mono italic break-all" style={{ color: theme.colors.textSecondary }}>
                    {alert.message}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          className="w-full py-4 bg-accent text-white rounded-theme-sm font-black uppercase tracking-widest shadow-theme-elevated"
        >
          Confirm
        </motion.button>
      </motion.div>
    </div>
  );
};

// Global App State Context for sharing alert, confirm, QR, etc. with child routes
interface AppContextType {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  selectedLocation: Location | null;
  setSelectedLocation: React.Dispatch<React.SetStateAction<Location | null>>;
  selectedSport: SportType | null;
  setSelectedSport: React.Dispatch<React.SetStateAction<SportType | null>>;
  triggerAlert: (message: string, type?: 'success' | 'error' | 'info', onClose?: () => void) => void;
  triggerConfirm: (config: {
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
  }) => void;
  setGlobalQRCode: (qr: { booking: any; location: any } | null) => void;
  handleLogout: () => Promise<void>;
  role: 'user' | 'admin' | 'superadmin';
  setRole: React.Dispatch<React.SetStateAction<'user' | 'admin' | 'superadmin'>>;
}

const AppSharedContext = React.createContext<AppContextType | null>(null);

export const useApp = () => {
  const context = React.useContext(AppSharedContext);
  if (!context) throw new Error('useApp must be used within AppSharedContext.Provider');
  return context;
};

// Route Component Wrappers for Deep Linking & Data Loading

const SportSelectorWrapper: React.FC = () => {
  const { handleLogout, setSelectedSport } = useApp();
  const navigate = useNavigate();
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SportSelector
        onSelect={setSelectedSport}
        onLogout={handleLogout}
        onProfile={() => navigate('/profile')}
      />
    </Suspense>
  );
};

const LocationSelectorWrapper: React.FC = () => {
  const { user, triggerAlert, triggerConfirm, handleLogout } = useApp();
  const navigate = useNavigate();
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LocationSelector
        user={user}
        onLogout={handleLogout}
        onProfile={() => navigate('/profile')}
        onSuperAdmin={() => navigate('/superadmin')}
        onAlert={triggerAlert}
        onConfirm={triggerConfirm}
        onNavigate={(dest) => navigate(typeof dest === 'string' && !dest.startsWith('/') ? '/' + dest : dest)}
      />
    </Suspense>
  );
};

const BookingPageWrapper: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, selectedLocation, setSelectedLocation, triggerAlert, setGlobalQRCode, selectedSport } = useApp();
  const [location, setLocation] = useState<Location | null>(selectedLocation);
  const [loading, setLoading] = useState(!selectedLocation || (id && selectedLocation?.id !== id));
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      if (selectedLocation && selectedLocation.id === id) {
        setLocation(selectedLocation);
        setLoading(false);
      } else {
        setLoading(true);
        locationService.getLocationById(id)
          .then((loc) => {
            if (loc) {
              setLocation(loc);
              setSelectedLocation(loc);
            }
          })
          .catch((err) => {
            console.error('Error fetching location for booking:', err);
            triggerAlert('Failed to load arena for booking', 'error');
          })
          .finally(() => setLoading(false));
      }
    } else if (selectedLocation) {
      setLocation(selectedLocation);
      setLoading(false);
    }
  }, [id, selectedLocation, setSelectedLocation, triggerAlert]);

  if (loading) return <LoadingFallback />;
  if (!location) {
    return <Navigate to="/" replace />;
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <BookingPage
        key={location.id}
        location={location}
        selectedSport={selectedSport}
        onBack={() => navigate(-1)}
        user={user}
        onAlert={triggerAlert}
        onShowQR={(b, loc) => setGlobalQRCode({ booking: b, location: loc })}
      />
    </Suspense>
  );
};

const ScorerWrapper: React.FC = () => {
  const { locationId } = useParams<{ locationId: string }>();
  const [searchParams] = useSearchParams();
  const sportParam = searchParams.get('sport');
  const { user, selectedLocation, setSelectedLocation, triggerAlert, triggerConfirm, selectedSport } = useApp();
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(!!locationId);
  const navigate = useNavigate();

  const activeSport = (sportParam ? parseSportParam(sportParam) : selectedSport) || SportType.CRICKET;

  useEffect(() => {
    if (locationId) {
      if (selectedLocation && selectedLocation.id === locationId) {
        setLocation(selectedLocation);
        setLoading(false);
      } else {
        setLoading(true);
        locationService.getLocationById(locationId)
          .then((loc) => {
            if (loc) {
              setLocation(loc);
            }
          })
          .catch((err) => {
            console.error('Error fetching location for scorer:', err);
          })
          .finally(() => setLoading(false));
      }
    } else {
      setLoading(false);
    }
  }, [locationId, selectedLocation]);

  if (loading) return <LoadingFallback />;

  const effectiveLocation: Location = (locationId && location) ? location : (
    selectedLocation && selectedLocation.supportedSports?.some(s => s === activeSport || parseSportParam(s) === parseSportParam(activeSport))
      ? selectedLocation
      : {
          id: `general_${activeSport.toLowerCase().replace(/[-_ ]/g, '_')}`,
          name: `${activeSport} Arena`,
          address: 'Main Arena',
          email: 'arena@boxitt.com',
          imageUrls: [],
          minAdvance: 0,
          supportedSports: [activeSport],
        } as Location
  );

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Scorer
        location={effectiveLocation}
        user={user!}
        initialSport={activeSport}
        onAlert={triggerAlert}
        onConfirm={triggerConfirm}
        onBack={() => navigate(-1)}
      />
    </Suspense>
  );
};

const TransactionsPageWrapper: React.FC = () => {
  const { user, triggerAlert, setGlobalQRCode } = useApp();
  return (
    <Suspense fallback={<LoadingFallback />}>
      <TransactionsPage
        user={user}
        onAlert={triggerAlert}
        onShowQR={(b, loc) => setGlobalQRCode({ booking: b, location: loc })}
      />
    </Suspense>
  );
};

const ViewProfileWrapper: React.FC = () => {
  const { user, handleLogout, triggerAlert } = useApp();
  const navigate = useNavigate();
  const mappedProfile = user ? {
    ...user,
    phone: user.phone_number || '',
    joinedDate: user.joined_date || '',
    location: user.location || '',
  } : {
    id: 'demo-user-id',
    email: 'rahul.kumar@boxitt.app',
    phone: '+91 98765 43210',
    username: 'Rahul Kumar',
    display_name: 'Rahul Kumar',
    location: 'Hyderabad, Telangana',
    joinedDate: '2025-01-15',
    role: 'user'
  };

  return (
    <Suspense fallback={<LoadingFallback />}>
      <ProfileDashboard
        profile={mappedProfile as any}
        onEdit={() => navigate('/edit-profile')}
        onLogout={handleLogout}
        onAlert={triggerAlert}
      />
    </Suspense>
  );
};

const CustomerCarePageWrapper: React.FC = () => {
  const { triggerAlert } = useApp();
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CustomerCarePage onAlert={triggerAlert} />
    </Suspense>
  );
};

const AboutAppPageWrapper: React.FC = () => {
  const { triggerAlert } = useApp();
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AboutAppPage onAlert={triggerAlert} />
    </Suspense>
  );
};

const EditProfilePageWrapper: React.FC = () => {
  const { user, setUser, setRole, triggerAlert } = useApp();
  const navigate = useNavigate();

  return (
    <Suspense fallback={<LoadingFallback />}>
      <EditProfilePage
        currentUser={user}
        onAlert={triggerAlert}
        onUpdateComplete={async () => {
          if (user?.id) {
            const { profile } = await getUserProfile(user.id);
            if (profile) {
              const mergedUser = {
                ...user,
                ...profile,
                profileImage: profile.avatar_url || profile.profileImage,
                avatar_url: profile.avatar_url || '',
                username: profile.username || '',
                phone_number: profile.phone_number || '',
                gender: profile.gender,
                address: profile.address,
                location: profile.location,
                joinedDate: profile.joined_date,
                role: profile.role,
              };
              storage.setUser(mergedUser);
              setUser(mergedUser);
              setRole((profile.role as any) || 'user');
            }
          }
          navigate('/');
        }}
      />
    </Suspense>
  );
};

const ChallengesPageWrapper: React.FC = () => {
  const { user, selectedLocation, setSelectedLocation, setSelectedSport, selectedSport: contextSport, triggerAlert, setGlobalQRCode } = useApp();
  const { sport: paramSport } = useParams<{ sport: string }>();
  const navigate = useNavigate();

  // If a sport is in the URL, use it (and update context).
  // Otherwise, use the context sport.
  const activeSport = paramSport ? parseSportParam(paramSport) : contextSport;

  useEffect(() => {
    if (paramSport && parseSportParam(paramSport) !== contextSport) {
        setSelectedSport(parseSportParam(paramSport));
    }
  }, [paramSport, contextSport, setSelectedSport]);

  return (
    <Suspense fallback={<LoadingFallback />}>
      <ChallengesPage
        user={user}
        selectedLocation={selectedLocation || undefined}
        selectedSport={activeSport || undefined}
        onBack={() => navigate(-1)}
        onOpenBooking={(loc, sport) => {
          const resolvedSport = sport || loc?.supportedSports?.[0];
          if (resolvedSport) setSelectedSport(resolvedSport);
          if (loc) {
            setSelectedLocation(loc);
            navigate(`/booking/${loc.id}`);
          } else {
            navigate('/');
          }
        }}
        onAlert={triggerAlert}
        onShowQR={(b, loc) => setGlobalQRCode({ booking: b, location: loc })}
      />
    </Suspense>
  );
};

const NotificationsPageWrapper: React.FC = () => {
  const { user, triggerAlert, triggerConfirm, setGlobalQRCode, selectedSport } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sportParam = searchParams.get('sport');
  const activeSport = sportParam ? parseSportParam(sportParam) : selectedSport;

  return (
    <Suspense fallback={<LoadingFallback />}>
      <NotificationsPage
        userId={user?.id}
        selectedSport={activeSport}
        onBack={() => navigate(-1)}
        onAlert={triggerAlert}
        onConfirm={triggerConfirm}
        onNavigate={(dest) => navigate(typeof dest === 'string' && !dest.startsWith('/') ? '/' + dest : dest)}
        onShowQR={(b, loc) => setGlobalQRCode({ booking: b, location: loc })}
      />
    </Suspense>
  );
};

const ChatHubPageWrapper: React.FC = () => {
  const { user } = useApp();
  const navigate = useNavigate();

  return (
    <Suspense fallback={<LoadingFallback />}>
      <ChatHub currentUser={user} onBack={() => navigate(-1)} />
    </Suspense>
  );
};

const ReviewPageWrapper: React.FC = () => {
  const { locationId } = useParams<{ locationId: string }>();
  const { triggerAlert } = useApp();
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ReviewPage locationId={locationId || undefined} onAlert={triggerAlert} />
    </Suspense>
  );
};

const ResetPasswordPageWrapper: React.FC = () => {
  const { triggerAlert } = useApp();
  const navigate = useNavigate();
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ResetPasswordPage
        onAlert={triggerAlert}
        onComplete={() => navigate('/')}
      />
    </Suspense>
  );
};

// Main App Layout Component
const AppLayout: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  const [profileSkipped, setProfileSkipped] = useState(false);
  const { showPrompt, setShowPrompt, handleChoice, checkAllPermissions } = usePermissions();

  const navState = storage.getNavState();
  const [user, setUser] = useState<User | null>(storage.getUser());
  const [selectedSport, setSelectedSport] = useState<SportType | null>(navState?.selectedSport || null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(navState?.selectedLocation || null);

  const [role, setRole] = useState<'user' | 'admin' | 'superadmin'>('user');
  const [profileCheckLoading, setProfileCheckLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);

  // Fetch & listen in real-time to unread chat badge
  useEffect(() => {
    if (!user?.id) return;

    const refreshUnreadCount = () => {
      messagingService.getRoomsForUser(user.id, true).then(rooms => {
        const count = rooms.reduce((acc, r) => acc + (r.unread_count || 0), 0);
        setUnreadChatCount(count);
      });
    };

    refreshUnreadCount();

    // Realtime channel for instant badge updates when added to a room or receiving a message
    const channelName = `global_badge_realtime_${user.id}`;
    const badgeChannel = supabase.channel(channelName);

    badgeChannel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_room_members', filter: `user_id=eq.${user.id}` },
        () => {
          refreshUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        () => {
          refreshUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(badgeChannel);
    };
  }, [user?.id, pathname]);

  // Sync nav state with storage
  useEffect(() => {
    storage.setNavState({
      currentPage: pathname,
      selectedSport,
      selectedLocation
    });
  }, [pathname, selectedSport, selectedLocation]);

  // QR & Alert Modals
  const [globalQRCode, setGlobalQRCode] = useState<{ booking: any; location: any } | null>(null);
  const privilegesChecked = useRef(false);

  const [globalAlert, setGlobalAlert] = useState<{ message: string; type: 'success' | 'error' | 'info'; onClose?: () => void } | null>(null);
  const [globalConfirm, setGlobalConfirm] = useState<{
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
  } | null>(null);

  const triggerAlert = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info', onClose?: () => void) => {
    setGlobalAlert({ message, type, onClose });
  }, []);

  const triggerConfirm = useCallback((config: {
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
  }) => {
    setGlobalConfirm(config);
  }, []);

  // Global Hardware Back Button Listener via Capacitor
  useEffect(() => {
    let removeListener: (() => void) | undefined;
    CapApp.addListener('backButton', () => {
      navigate(-1);
    }).then((listener) => {
      removeListener = () => listener.remove();
    });

    return () => {
      if (removeListener) removeListener();
    };
  }, [navigate]);

  // Cross-tab sync for auth
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'boxitt_auth') {
        const updatedUser = storage.getUser();
        if (updatedUser) {
          if (!user || updatedUser.id !== user.id) setUser(updatedUser);
        } else {
          setUser(null);
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [user]);

  // Force scroll to top on every route change, search param change, or location key change
  useEffect(() => {
    return forceScrollTop();
  }, [location.pathname, location.search, location.key]);

  const handleLoginSuccess = useCallback(async (authUser: any) => {
    if (!authUser) return;

    setUser((prev) => {
      if (prev && prev.id === authUser.id && prev.isLoggedIn && (prev.role || (prev as any).username)) {
        return prev;
      }

      const newUser: User = {
        id: authUser.id,
        email: authUser.email || '',
        isLoggedIn: true,
        joined_date: prev?.joined_date || '',
        location: prev?.location || '',
      };
      storage.setUser(newUser);
      return newUser;
    });

    ensureUserProfile(authUser).catch(console.error);

    setTimeout(() => checkAllPermissions(), 1500);
  }, [checkAllPermissions]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResettingPassword(true);
        navigate('/reset-password');
      } else if (session?.user) {
        if (!isResettingPassword) {
          await handleLoginSuccess(session.user);
        }
      } else if (event === 'SIGNED_OUT') {
        // Only run if user isn't already null to avoid double-processing
        if (user) {
          storage.logout();
          setUser(null);
          setSelectedLocation(null);
          setSelectedSport(null);
          setIsResettingPassword(false);
          setRole('user');
          privilegesChecked.current = false;
          navigate('/', { replace: true });
        }
      }
    });

    const checkHash = async () => {
      const hash = window.location.hash;
      if (hash && hash.includes('type=recovery')) {
        setIsResettingPassword(true);
        navigate('/reset-password');
      }
    };
    checkHash();

    const deepLinkListener = CapApp.addListener('appUrlOpen', async (data: any) => {
      const url = new URL(data.url);
      const hash = url.hash || url.search;
      if (hash && (hash.includes('access_token') || hash.includes('code'))) {
        const params = new URLSearchParams(hash.replace('#', '?').replace('?', '&'));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');
        if (accessToken && refreshToken) {
          const { data: sessionData, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (type === 'recovery' || error?.message?.includes('recovery')) {
            setIsResettingPassword(true);
            navigate('/reset-password');
          } else if (sessionData.user) {
            await handleLoginSuccess(sessionData.user);
          }
          if (Capacitor.isNativePlatform()) {
            await Browser.close();
          }
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      deepLinkListener.then((l: any) => l.remove());
    };
  }, [handleLoginSuccess, isResettingPassword, navigate]);

  useEffect(() => {
    const checkPrivileges = async () => {
      if (user?.isLoggedIn && user?.id && !isResettingPassword && !privilegesChecked.current) {
        if (pathname === '/reset-password' || pathname === '/edit-profile') return;

        setProfileCheckLoading(true);
        try {
          const { profile } = await getUserProfile(user.id);

          if (profile) {
            const mergedUser = {
              ...user,
              ...profile,
              profileImage: profile.avatar_url || user.profileImage,
              avatar_url: profile.avatar_url || '',
              username: profile.username || '',
              phone_number: profile.phone_number || '',
              role: profile.role,
              role_status: profile.role_status,
            };

            storage.setUser(mergedUser);
            setUser(mergedUser);
            setRole((profile.role as any) || 'user');

            privilegesChecked.current = true;

            const isProfileComplete = !!(
              profile.email &&
              (profile.username || profile.display_name) &&
              (profile.phone_number || profile.phone) &&
              (profile.dob || profile.date_of_birth) &&
              profile.gender &&
              profile.role &&
              profile.address
            );

            if (!isProfileComplete && !profileSkipped) {
              navigate('/edit-profile');
            }
          }
        } catch (e) {
          console.error('Privilege check error:', e);
        } finally {
          setProfileCheckLoading(false);
        }
      }
    };

    checkPrivileges();
  }, [user?.isLoggedIn, user?.id, isResettingPassword, profileSkipped, pathname, navigate]);

  const handleLogout = async () => {
    triggerConfirm({
      message: 'Are you sure you want to log out of your session?',
      onConfirm: async () => {
        // SECURITY FIX: Robust multi-layer logout
        // 1. Clear Supabase session
        await supabase.auth.signOut();

        // 2. Clear all local storage & session state
        storage.logout();

        // 3. Reset local state
        setUser(null);
        setSelectedLocation(null);
        setSelectedSport(null);
        setRole('user');
        privilegesChecked.current = false;

        // 4. Force a hard redirect to the home page to clear any remaining memory/cache
        window.location.href = '/';
      },
      isDestructive: true,
      confirmText: 'LOGOUT'
    });
  };

  const isApproved = user?.role_status === 'approved';
  const isAdmin = (user?.role === 'admin' || user?.role === 'superadmin') && isApproved;
  const isSuperAdmin = user?.role === 'superadmin' && isApproved;

  const isNavPage = (path: string) => {
    if (path.startsWith('/booking')) return true;
    return false;
  };

  const showNav = user?.isLoggedIn && isNavPage(pathname);

  const backdropColor = theme.name === 'light'
    ? 'rgba(15, 23, 42, 0.3)'
    : 'rgba(0, 0, 0, 0.7)';

  const appContextValue: AppContextType = useMemo(() => ({
    user,
    setUser,
    selectedLocation,
    setSelectedLocation,
    selectedSport,
    setSelectedSport,
    triggerAlert,
    triggerConfirm,
    setGlobalQRCode,
    handleLogout,
    role,
    setRole
  }), [
    user,
    selectedLocation,
    selectedSport,
    triggerAlert,
    triggerConfirm,
    role,
    setRole
  ]);

  if (!user?.isLoggedIn && pathname !== '/auth-callback' && pathname !== '/reset-password' && pathname !== '/password-reset') {
    return (
      <AppSharedContext.Provider value={appContextValue}>
        <LoginPage onAlert={triggerAlert} onLoginSuccess={(email) => console.log('Login success for', email)} />
      </AppSharedContext.Provider>
    );
  }

  if (profileCheckLoading) {
    return <LoadingFallback />;
  }

  const isBookingsTabActive = pathname === '/' || pathname.startsWith('/arenas') || pathname.startsWith('/arena') || pathname.startsWith('/booking');
  const isScoreTabActive = pathname.startsWith('/scorer');
  const isHistoryTabActive = pathname.startsWith('/history') || pathname.startsWith('/transactions');
  const isAdminTabActive = pathname.startsWith('/admin');

  return (
    <AppSharedContext.Provider value={appContextValue}>
      <div className="min-h-screen bg-background flex flex-col font-['Inter'] relative transition-all duration-300 overflow-x-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-success/10 rounded-full blur-[120px] pointer-events-none" />

        {showNav && (
          <nav
            className="bg-background-secondary/80 backdrop-blur-md border-b border-border sticky top-0 z-[60] shadow-theme-card"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
          >
            <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
              <div className="flex items-center space-x-2 sm:space-x-6">
                {pathname !== '/' && (
                  <button
                    onClick={() => navigate(-1)}
                    className="flex items-center space-x-2 px-2.5 py-2 bg-background-secondary hover:bg-card-elevated text-text-primary rounded-theme-sm transition-all border border-border shadow-theme-card active:translate-y-0.5 active:shadow-none"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Back</span>
                  </button>
                )}
                <div
                  className="flex items-center space-x-2 sm:space-x-3 cursor-pointer group"
                  onClick={() => navigate('/')}
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-accent rounded-theme-sm flex items-center justify-center overflow-hidden shadow-theme-elevated group-hover:rotate-12 transition-transform">
                    <img src="/logo.png" className="w-full h-full object-contain p-1" alt="Boxitt" />
                  </div>
                  <span className="font-black text-lg sm:text-xl text-text-primary tracking-tighter block leading-none italic uppercase">Boxitt</span>
                </div>
              </div>

              <div className="flex items-center space-x-2 sm:space-x-4">
                <div className="hidden md:flex items-center space-x-8 mr-2">
                  <button
                    onClick={() => navigate(selectedLocation ? `/booking/${selectedLocation.id}` : '/')}
                    className={`font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${isBookingsTabActive ? 'text-accent font-bold' : 'text-text-primary hover:text-accent'}`}
                  >
                    <Calendar className="w-4 h-4" />
                    Bookings
                  </button>
                  {(!selectedSport || getSportCapability(selectedSport).scorerAvailable) && (
                    <button
                      onClick={() => {
                        const sportSlug = selectedSport ? getSportSlug(selectedSport) : '';
                        const query = sportSlug ? `?sport=${sportSlug}` : '';
                        navigate(selectedLocation ? `/scorer/${selectedLocation.id}${query}` : `/scorer${query}`);
                      }}
                      className={`font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${isScoreTabActive ? 'text-accent font-bold' : 'text-text-primary hover:text-accent'}`}
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      Scoreboard
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 sm:gap-4">
                  {(!selectedSport || getSportCapability(selectedSport).supportsChallenge) && (
                    <button
                      onClick={() => {
                        const sport = selectedSport || storage.get('selectedSport');
                        const arenaName = pathname.startsWith('/booking') ? (selectedLocation?.name || '') : '';
                        const query = arenaName ? `?arena=${encodeURIComponent(arenaName)}` : '';
                        navigate(sport ? `/challenges/${sport.toLowerCase()}${query}` : `/challenges${query}`);
                      }}
                      className={`p-1.5 sm:p-2 rounded-full border transition-all flex items-center justify-center shadow-theme-card active:scale-95 ${pathname.startsWith('/challenges') ? 'border-accent' : 'border-border'}`}
                    >
                      <Swords className={`w-[5.5vw] h-[5.5vw] sm:w-6 sm:h-6 min-w-[18px] min-h-[18px] ${pathname.startsWith('/challenges') ? 'text-accent' : 'text-text-disabled'}`} />
                    </button>
                  )}
                  <NotificationBell
                    userId={user?.id}
                    selectedSport={selectedSport}
                    onNavigate={(dest) => navigate(typeof dest === 'string' && !dest.startsWith('/') ? '/' + dest : dest)}
                  />
                  <button
                    onClick={() => navigate('/profile')}
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border-2 transition-all ${pathname.startsWith('/profile') ? 'border-accent' : 'border-border'}`}
                  >
                    {user?.profileImage ? (
                      <img src={user.profileImage} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-background-secondary flex items-center justify-center text-text-secondary">
                        <UserIcon className="w-[4vw] h-[4vw] min-w-[14px] min-h-[14px] sm:w-4 sm:h-4" />
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </nav>
        )}

        <main
          className={`flex-1 relative ${showNav ? 'pt-2 pb-28 md:pb-6' : ''}`}
          style={showNav ? { paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' } : {}}
        >
          <div className="max-w-6xl mx-auto px-4">
            <Suspense fallback={<LoadingFallback />}>
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Outlet />
              </motion.div>
            </Suspense>
          </div>
        </main>

        {showNav && (
          <div
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-2"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 6px), 6px)' }}
          >
            <div className="bg-background-secondary/90 backdrop-blur-xl border border-border p-1.5 rounded-theme-lg flex justify-between items-center shadow-theme-floating mb-1.5">
              <button
                onClick={() => navigate(selectedLocation ? `/booking/${selectedLocation.id}` : '/')}
                className={`flex-1 flex flex-col items-center py-2 rounded-theme-md transition-all ${isBookingsTabActive ? 'bg-accent text-white shadow-theme-elevated scale-105' : 'text-text-primary font-bold hover:text-accent'}`}
              >
                <Calendar className="w-[5vw] h-[5vw] min-w-[18px] min-h-[18px] max-w-[24px] max-h-[24px]" />
                <span className="text-[2.5vw] xs:text-[10px] font-black uppercase tracking-tighter mt-1">Book</span>
              </button>
              {(!selectedSport || getSportCapability(selectedSport).scorerAvailable) && (
                <button
                  onClick={() => {
                    const sportSlug = selectedSport ? getSportSlug(selectedSport) : '';
                    const query = sportSlug ? `?sport=${sportSlug}` : '';
                    navigate(selectedLocation ? `/scorer/${selectedLocation.id}${query}` : `/scorer${query}`);
                  }}
                  className={`flex-1 flex flex-col items-center py-2 rounded-theme-md transition-all ${isScoreTabActive ? 'bg-accent text-white shadow-theme-elevated scale-105' : 'text-text-primary font-bold hover:text-accent'}`}
                >
                  <LayoutDashboard className="w-[5vw] h-[5vw] min-w-[18px] min-h-[18px] max-w-[24px] max-h-[24px]" />
                  <span className="text-[2.5vw] xs:text-[10px] font-black uppercase tracking-tighter mt-1">Score</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Floating Chat Button */}
        {user?.isLoggedIn && !pathname.startsWith('/chat') && (
          <button
            onClick={() => navigate('/chat')}
            className="fixed bottom-20 right-6 md:bottom-8 md:right-8 z-[100] w-14 h-14 rounded-full text-white flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer group"
            style={{ backgroundColor: theme.colors.accent, boxShadow: theme.elevation.floating }}
            title="Open Chat"
          >
            <MessageSquare className="w-6 h-6 text-white group-hover:rotate-12 transition-transform" />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-md animate-pulse">
                {unreadChatCount}
              </span>
            )}
          </button>
        )}

        {/* Global Modals */}
        <AnimatePresence>
          {globalQRCode && (
            <QRCodeModal
              booking={globalQRCode.booking}
              location={globalQRCode.location}
              onClose={() => setGlobalQRCode(null)}
              onAlert={triggerAlert}
            />
          )}

          {globalAlert && (
            <GlobalAlertModal
              alert={globalAlert}
              onClose={() => {
                globalAlert.onClose?.();
                setGlobalAlert(null);
              }}
              backdropColor={backdropColor}
              theme={theme}
            />
          )}

          {globalConfirm && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 overflow-hidden">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  globalConfirm.onCancel?.();
                  setGlobalConfirm(null);
                }}
                className="absolute inset-0 backdrop-blur-md"
                style={{ backgroundColor: backdropColor }}
              />
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="border rounded-theme-lg w-full max-w-sm p-8 text-center transition-all duration-300 relative z-10"
                style={{
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                  boxShadow: theme.elevation.modal,
                  backdropFilter: theme.name !== 'light' ? 'blur(10px)' : 'none'
                }}
              >
                <div className={`w-16 h-16 rounded-theme-md flex items-center justify-center mx-auto mb-6 shadow-theme-elevated ${globalConfirm.isDestructive ? 'bg-error/20 text-error' : 'bg-accent/20 text-accent'}`}>
                  <Shield className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-black mb-3 uppercase italic tracking-tighter" style={{ color: theme.colors.textPrimary }}>
                  {globalConfirm.isDestructive ? 'Are you sure?' : 'Please Confirm'}
                </h3>
                <p className="font-bold mb-8 leading-relaxed text-sm" style={{ color: theme.colors.textSecondary }}>
                  {globalConfirm.message}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      globalConfirm.onCancel?.();
                      setGlobalConfirm(null);
                    }}
                    className="flex-1 py-4 bg-background-secondary rounded-theme-sm font-black uppercase tracking-widest transition-all border border-border shadow-theme-card active:translate-y-0.5"
                    style={{ color: theme.colors.textSecondary }}
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      globalConfirm.onConfirm();
                      setGlobalConfirm(null);
                    }}
                    className={`flex-1 py-4 text-white rounded-theme-sm font-black uppercase tracking-widest shadow-theme-elevated ${globalConfirm.isDestructive ? 'bg-error' : 'bg-accent'}`}
                  >
                    {globalConfirm.confirmText || 'Proceed'}
                  </motion.button>
                </div>
              </motion.div>
            </div>
          )}

          {showPrompt && (
            <PermissionPrompt
              type={showPrompt.type}
              onChoice={(choice) => handleChoice(showPrompt.type, choice)}
              onClose={() => setShowPrompt(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </AppSharedContext.Provider>
  );
};

const ArenaDetailsPageWrapper: React.FC = () => (
  <Suspense fallback={<LoadingFallback />}>
    <ArenaDetailsPage />
  </Suspense>
);

// Router Configuration
const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: <RootErrorBoundary />,
    children: [
      { path: '/', element: <SportSelectorWrapper /> },
      { path: '/arenas/:sport', element: <LocationSelectorWrapper /> },
      { path: '/arena/:id', element: <ArenaDetailsPageWrapper /> },
      { path: '/booking/:id', element: <BookingPageWrapper /> },
      { path: '/booking', element: <BookingPageWrapper /> },
      { path: '/chat', element: <ChatHubPageWrapper /> },
      { path: '/history', element: <TransactionsPageWrapper /> },
      { path: '/transactions', element: <Navigate to="/history" replace /> },
      { path: '/profile', element: <ViewProfileWrapper /> },
      { path: '/my-profile', element: <Navigate to="/profile" replace /> },
      { path: '/edit-profile', element: <EditProfilePageWrapper /> },
      { path: '/challenges/:sport?', element: <ChallengesPageWrapper /> },
      { path: '/arenas/:sport/challenges', element: <ChallengesPageWrapper /> },
      { path: '/arenas/:sport/challenge', element: <ChallengesPageWrapper /> },
      { path: '/notifications', element: <NotificationsPageWrapper /> },
      { path: '/reviews/:locationId?', element: <ReviewPageWrapper /> },
      { path: '/review/:locationId?', element: <ReviewPageWrapper /> },
      { path: '/reset-password', element: <ResetPasswordPageWrapper /> },
      { path: '/password-reset', element: <Navigate to="/reset-password" replace /> },
      { path: '/scorer/:locationId?', element: <ScorerWrapper /> },
      { path: '/customer-care', element: <CustomerCarePageWrapper /> },
      { path: '/about-app', element: <AboutAppPageWrapper /> },
      { path: '/about', element: <Navigate to="/about-app" replace /> },
      { path: '/auth-callback', element: <AuthCallbackPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ]
  }
]);

const App: React.FC = () => (
  <ThemeProvider>
    <PermissionsProvider>
      <AuthProvider>
        <RealtimeSyncProvider>
          <RouterProvider router={router} />
        </RealtimeSyncProvider>
      </AuthProvider>
    </PermissionsProvider>
  </ThemeProvider>
);

export default App;

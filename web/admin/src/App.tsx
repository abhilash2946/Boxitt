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
  Grid
} from 'lucide-react';
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  useNavigate,
  useLocation,
  useParams,
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
import { User, Location, SportType, parseSportParam } from './types';
import { getUserProfile } from './services/userService';
import { ensureUserProfile, verifySuperPassword } from './services/authService';
import { locationService } from './services/locationService';
import { roleService } from './services/roleService';
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
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Scanner = lazy(() => import('./pages/Scanner'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ReviewPage = lazy(() => import('./pages/ReviewPage'));
const EditProfilePage = lazy(() => import('./pages/EditProfilePage'));
const ProfileDashboard = lazy(() => import('./components/ProfileDashboard'));
const CustomerCarePage = lazy(() => import('./pages/CustomerCarePage'));
const AboutAppPage = lazy(() => import('./pages/AboutAppPage'));
const SportSelector = lazy(() => import('./pages/SportSelector'));
const LocationSelector = lazy(() => import('./pages/LocationSelector'));
const TransactionsPage = lazy(() => import('./pages/TransactionsPage'));
const SuperAdminApprovalDashboard = lazy(() => import('./pages/SuperAdminApprovalDashboard'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const ArenaDetailsPage = lazy(() => import('./pages/ArenaDetailsPage'));
const AdminEditArenaPage = lazy(() => import('./pages/AdminEditArenaPage'));
const PendingApprovalPage = lazy(() => import('./pages/PendingApprovalPage'));
const AdminSecurityPrompt = lazy(() => import('./components/AdminSecurityPrompt'));

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
  isAdminAuth: boolean;
  setIsAdminAuth: React.Dispatch<React.SetStateAction<boolean>>;
  isSuperAuth?: boolean;
  setIsSuperAuth?: React.Dispatch<React.SetStateAction<boolean>>;
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
        onNavigate={(dest: string | any) => navigate(typeof dest === 'string' && !dest.startsWith('/') ? '/' + dest : dest)}
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
        onShowQR={(b: any, loc: any) => setGlobalQRCode({ booking: b, location: loc })}
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
        onShowQR={(b: any, loc: any) => setGlobalQRCode({ booking: b, location: loc })}
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
                role: 'admin',
              };
              storage.setUser(mergedUser);
              setUser(mergedUser);
              setRole('admin');
            }
          }
          navigate('/');
        }}
      />
    </Suspense>
  );
};

const ScannerWrapper: React.FC = () => {
  const { triggerAlert } = useApp();
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Scanner onAlert={triggerAlert} />
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

const AdminDashboardWrapper: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, selectedLocation, setSelectedLocation, triggerAlert, triggerConfirm, role } = useApp();
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const handleLocationChange = useCallback((newLoc: Location) => {
    setLocation(newLoc);
    setSelectedLocation(newLoc);
    if (newLoc?.id && newLoc.id !== id) {
      navigate(`/admin/${newLoc.id}`, { replace: true });
    }
  }, [id, navigate, setSelectedLocation]);

  useEffect(() => {
    const adminAuth = storage.getAdminAuth();
    // Explicit URL parameter 'id' has highest priority
    const targetId = id || adminAuth?.locationId || selectedLocation?.id;

    if (!targetId) {
      setLoading(false);
      return;
    }

    if (location && location.id === targetId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    locationService.getLocationById(targetId)
      .then((loc) => {
        if (!isMounted) return;
        if (loc) {
          setLocation(loc);
          setSelectedLocation(loc);
          if (!id) {
            navigate(`/admin/${loc.id}`, { replace: true });
          }
        }
      })
      .catch((err) => {
        console.error('Error fetching location for admin:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (role !== 'admin' && role !== 'superadmin' && user?.role !== 'admin' && user?.role !== 'superadmin') {
    return <Navigate to="/" replace />;
  }

  if (loading) return <LoadingFallback />;

  if (!location) {
    return <SportSelectorWrapper />;
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <AdminDashboard
        key={location.id}
        selectedLocation={location}
        onLocationChange={handleLocationChange}
        user={user}
        onAlert={triggerAlert}
        onConfirm={triggerConfirm}
      />
    </Suspense>
  );
};

const SuperAdminWrapper: React.FC = () => {
  const { user, role, isSuperAuth, setIsSuperAuth, triggerAlert } = useApp();
  const navigate = useNavigate();

  if (isSuperAuth || role === 'superadmin' || user?.role === 'superadmin') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <SuperAdminApprovalDashboard onBack={() => navigate(-1)} />
      </Suspense>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-20 p-10 bg-card rounded-[3rem] shadow-2xl border border-border text-center">
      <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-8 text-text-primary">Super Access</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const pass = (e.currentTarget.elements.namedItem('pass') as HTMLInputElement).value;
          const isValid = await verifySuperPassword(pass);
          if (isValid) setIsSuperAuth?.(true);
          else triggerAlert('Invalid Super Password', 'error');
        }}
        className="space-y-4"
      >
        <input
          name="pass"
          type="password"
          placeholder="Enter Super Password"
          className="w-full p-4 bg-background-secondary rounded-2xl font-bold outline-none border-2 border-transparent focus:border-accent text-center text-text-primary"
        />
        <button
          type="submit"
          className="w-full py-4 bg-accent text-white rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all"
        >
          Verify Access
        </button>
      </form>
    </div>
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

  const [role, setRole] = useState<'user' | 'admin' | 'superadmin'>('admin');
  const [profileCheckLoading, setProfileCheckLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isAdminAuth, setIsAdminAuth] = useState(!!storage.getAdminAuth());

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
        // Double check session before signing out to prevent false sign-outs after long inactivity
        supabase.auth.getSession().then(({ data }) => {
          if (!data.session && user) {
            storage.logout();
            setUser(null);
            setSelectedLocation(null);
            setSelectedSport(null);
            setIsResettingPassword(false);
            setRole('admin');
            setIsAdminAuth(false);
            privilegesChecked.current = false;
            navigate('/', { replace: true });
          }
        });
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
      if (user?.isLoggedIn && user?.id && !isResettingPassword && (!privilegesChecked.current || pathname === '/pending-approval' || user.role_status !== 'approved')) {
        if (pathname === '/reset-password' || pathname === '/edit-profile') return;

        // Only show full screen loading on initial privilege check
        if (!privilegesChecked.current) {
          setProfileCheckLoading(true);
        }
        try {
          await supabase.auth.getSession();
          await roleService.ensurePlatformRole(user.id);
          const { profile } = await getUserProfile(user.id);
          const platformRoleData = await roleService.getPlatformRole(user.id);

          if (profile) {
            const dbStatus = platformRoleData?.status || profile.role_status;
            const resolvedStatus = dbStatus || user.role_status || 'pending';
            const mergedUser = {
              ...user,
              ...profile,
              profileImage: profile.avatar_url || user.profileImage,
              avatar_url: profile.avatar_url || '',
              username: profile.username || '',
              phone_number: profile.phone_number || '',
              role: platformRoleData?.role || user.role || 'admin',
              role_status: resolvedStatus,
            };

            storage.setUser(mergedUser);
            setUser(mergedUser);
            setRole((platformRoleData?.role as any) || user.role || 'admin');

            privilegesChecked.current = true;

            const isProfileComplete = !!(
              profile.email &&
              (profile.username || profile.display_name) &&
              (profile.phone_number || profile.phone) &&
              (profile.dob || profile.date_of_birth) &&
              profile.gender &&
              profile.address
            );

            if (!isProfileComplete && !profileSkipped) {
              navigate('/edit-profile');
            } else if (resolvedStatus === 'pending') {
              if (pathname !== '/pending-approval') navigate('/pending-approval');
            } else if (resolvedStatus === 'approved' && pathname === '/pending-approval') {
              navigate('/');
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
        setRole('admin');
        setIsAdminAuth(false);
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
    if (path.startsWith('/scanner') || path.startsWith('/scan')) return true;
    if (path.startsWith('/admin') && !path.includes('/arena/')) return true;
    if (path === '/') return true;
    return false;
  };

  const showNav = user?.isLoggedIn && isAdminAuth && isNavPage(pathname);

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
    setRole,
    isAdminAuth,
    setIsAdminAuth
  }), [
    user,
    selectedLocation,
    selectedSport,
    triggerAlert,
    triggerConfirm,
    role,
    setRole,
    isAdminAuth
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
  const isScanTabActive = pathname.startsWith('/scanner') || pathname.startsWith('/scan');
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
            <div className="max-w-6xl mx-auto px-2 md:px-4 py-3 flex justify-between items-center">
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
                    onClick={() => navigate('/scanner')}
                    className={`font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${isScanTabActive ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}`}
                  >
                    <Scan className="w-4 h-4" />
                    Scanner
                  </button>
                  {(user?.role === 'admin' || user?.role === 'superadmin') && (
                    <button
                      onClick={() => navigate('/')}
                      className={`font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${pathname === '/' || pathname.startsWith('/admin') ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}`}
                    >
                      <Shield className="w-4 h-4" />
                      Admin
                    </button>
                  )}
                  {(user?.role === 'superadmin') && (
                    <button
                      onClick={() => window.location.href = PLATFORM_URLS.superadmin}
                      className="font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center gap-2 text-purple-500 hover:text-purple-400"
                    >
                      <Shield className="w-4 h-4" />
                      MASTER PANEL
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 sm:gap-4">
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
          <div className="max-w-6xl mx-auto px-2 md:px-4">
            <Suspense fallback={<LoadingFallback />}>
              <motion.div
                key={pathname + (isAdminAuth ? '-auth' : '-noauth')}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {user?.isLoggedIn && user?.role_status === 'approved' && !isAdminAuth && pathname !== '/edit-profile' && pathname !== '/reset-password' ? (
                   <AdminSecurityPrompt
                     email={user.email || ''}
                     onSuccess={async (locId) => {
                       if (locId) {
                         try {
                           const loc = await locationService.getLocationById(locId);
                           if (loc) {
                             setSelectedLocation(loc);
                             navigate(`/admin/${loc.id}`);
                           }
                         } catch (e) {
                           console.error('Error auto-loading arena:', e);
                         }
                       }
                       setIsAdminAuth(true);
                     }}
                     onLogout={handleLogout}
                     onAlert={triggerAlert}
                   />
                ) : (
                   <Outlet />
                )}
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
                onClick={() => navigate('/')}
                className={`flex-1 flex flex-col items-center py-2 rounded-theme-md transition-all ${pathname === '/' || pathname.startsWith('/admin') ? 'bg-accent text-white shadow-theme-elevated scale-105' : 'text-text-secondary'}`}
              >
                <LayoutDashboard className="w-[5vw] h-[5vw] min-w-[18px] min-h-[18px] max-w-[24px] max-h-[24px]" />
                <span className="text-[2.2vw] xs:text-[9px] font-black uppercase tracking-tighter mt-1">Admin</span>
              </button>
              <button
                onClick={() => navigate('/scanner')}
                className={`flex-1 flex flex-col items-center py-2 rounded-theme-md transition-all ${isScanTabActive ? 'bg-accent text-white shadow-theme-elevated scale-105' : 'text-text-secondary'}`}
              >
                <Scan className="w-[5vw] h-[5vw] min-w-[18px] min-h-[18px] max-w-[24px] max-h-[24px]" />
                <span className="text-[2.2vw] xs:text-[9px] font-black uppercase tracking-tighter mt-1">Scan</span>
              </button>
            </div>
          </div>
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

const AdminEditArenaPageWrapper: React.FC = () => (
  <Suspense fallback={<LoadingFallback />}>
    <AdminEditArenaPage />
  </Suspense>
);

// Router Configuration
const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: <RootErrorBoundary />,
    children: [
      { path: '/', element: <AdminDashboardWrapper /> },
      { path: '/admin/:id', element: <AdminDashboardWrapper /> },
      { path: '/admin', element: <AdminDashboardWrapper /> },
      { path: '/admin/arena/:id/edit', element: <AdminEditArenaPageWrapper /> },
      { path: '/profile', element: <ViewProfileWrapper /> },
      { path: '/edit-profile', element: <EditProfilePageWrapper /> },
      { path: '/customer-care', element: <CustomerCarePageWrapper /> },
      { path: '/about', element: <AboutAppPageWrapper /> },
      { path: '/scanner', element: <ScannerWrapper /> },
      { path: '/scan', element: <Navigate to="/scanner" replace /> },
      { path: '/reset-password', element: <ResetPasswordPageWrapper /> },
      { path: '/auth-callback', element: <AuthCallbackPage /> },
      { path: '/pending-approval', element: <PendingApprovalPage /> },
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

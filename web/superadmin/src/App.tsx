import React, { useState, useEffect, useCallback, Suspense, lazy, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Bell,
  User as UserIcon,
  ChevronLeft,
  CheckCircle2,
  XCircle
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
import { User, Location, SportType } from './types';
import { getUserProfile } from './services/userService';
import { ensureUserProfile, verifySuperPassword } from './services/authService';
import { roleService } from './services/roleService';
import { locationService } from './services/locationService';
import { errorHandler } from './services/errorHandler';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { supabase } from './services/supabase';
import NotificationBell from './components/NotificationBell';
import PermissionPrompt from './components/PermissionPrompt';

// Initialize storage cleanup for new sessions
storage.init();

// Lazy Load Pages
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard'));
const SuperAdminApprovalDashboard = lazy(() => import('./pages/SuperAdminApprovalDashboard'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const LocationSelector = lazy(() => import('./pages/LocationSelector'));
const SportSelector = lazy(() => import('./pages/SportSelector'));
const ReviewPage = lazy(() => import('./pages/ReviewPage'));
const EditProfilePage = lazy(() => import('./pages/EditProfilePage'));
const ProfileDashboard = lazy(() => import('./components/ProfileDashboard'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const ArenaDetailsPage = lazy(() => import('./pages/ArenaDetailsPage'));
const AdminEditArenaPage = lazy(() => import('./pages/AdminEditArenaPage'));
const PendingApprovalPage = lazy(() => import('./pages/PendingApprovalPage'));

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
    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-text-secondary animate-pulse">Loading Superadmin...</p>
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

// Global App State Context
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
  handleLogout: () => Promise<void>;
  role: 'user' | 'admin' | 'superadmin';
  setRole: React.Dispatch<React.SetStateAction<'user' | 'admin' | 'superadmin'>>;
  isSuperAuth: boolean;
  setIsSuperAuth: React.Dispatch<React.SetStateAction<boolean>>;
}

const AppSharedContext = React.createContext<AppContextType | null>(null);

export const useApp = () => {
  const context = React.useContext(AppSharedContext);
  if (!context) throw new Error('useApp must be used within AppSharedContext.Provider');
  return context;
};

// Route Component Wrappers

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

const ViewProfileWrapper: React.FC = () => {
  const { user, handleLogout, triggerAlert } = useApp();
  const navigate = useNavigate();
  const mappedProfile = user ? {
    ...user,
    phone: user.phone_number || '',
    joinedDate: user.joined_date || '',
    location: user.location || '',
  } : null;

  if (!mappedProfile) return <Navigate to="/" replace />;

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
                role: 'superadmin', // Force superadmin role
              };
              storage.setUser(mergedUser);
              setUser(mergedUser);
              setRole('superadmin');
            }
          }
          navigate('/');
        }}
      />
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

/**
 * Global Security Check Prompt
 * Shown immediately after login/approval before accessing any feature.
 */
const SuperAdminPasswordPrompt: React.FC = () => {
  const { setIsSuperAuth, triggerAlert } = useApp();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);

  return (
    <div className="max-w-md mx-auto mt-20 p-10 rounded-[3rem] shadow-2xl border text-center transition-all duration-500"
         style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
      <div className="w-20 h-20 bg-accent/10 rounded-theme-md flex items-center justify-center mx-auto mb-6">
        <Shield className="w-10 h-10 text-accent" />
      </div>
      <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-2 text-text-primary">Super Access</h2>
      <p className="text-text-secondary font-bold text-sm mb-8">Enter security password to continue</p>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          try {
            const pass = (e.currentTarget.elements.namedItem('pass') as HTMLInputElement).value;
            const isValid = await verifySuperPassword(pass);
            if (isValid) {
              storage.setSuperAuth(true);
              storage.setSuperAdminSession(true); // Enable admin features globally
              setIsSuperAuth(true);
            } else {
              triggerAlert('Invalid Super Password', 'error');
            }
          } finally {
            setLoading(false);
          }
        }}
        className="space-y-4"
      >
        <input
          name="pass"
          type="password"
          placeholder="ENTER SECURITY PASSWORD"
          autoFocus
          className="w-full p-5 rounded-2xl font-black uppercase tracking-widest outline-none border-2 border-transparent focus:border-accent text-center transition-all"
          style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary }}
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-5 bg-accent text-white rounded-2xl font-black uppercase tracking-widest shadow-theme-elevated active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Verify Access'}
        </button>
      </form>
    </div>
  );
};

const SuperAdminWrapper: React.FC<{ type: 'dashboard' | 'approval' }> = ({ type }) => {
  const { triggerAlert, triggerConfirm } = useApp();
  const navigate = useNavigate();

  return (
    <Suspense fallback={<LoadingFallback />}>
      {type === 'dashboard' ? (
        <SuperAdminDashboard onAlert={triggerAlert} onConfirm={triggerConfirm} />
      ) : (
        <SuperAdminApprovalDashboard onBack={() => navigate(-1)} />
      )}
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

  // Force scroll to top on every route change, search param change, or location key change
  useEffect(() => {
    return forceScrollTop();
  }, [location.pathname, location.search, location.key]);

  const { showPrompt, setShowPrompt, handleChoice, checkAllPermissions } = usePermissions();

  const navState = storage.getNavState();
  const [user, setUser] = useState<User | null>(storage.getUser());
  const [selectedSport, setSelectedSport] = useState<SportType | null>(navState?.selectedSport || null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(navState?.selectedLocation || null);

  const [role, setRole] = useState<'user' | 'admin' | 'superadmin'>('superadmin');
  const [profileCheckLoading, setProfileCheckLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isSuperAuth, setIsSuperAuth] = useState(storage.isSuperAuth());

  // Sync nav state with storage
  useEffect(() => {
    storage.setNavState({
      currentPage: pathname,
      selectedSport,
      selectedLocation
    });
  }, [pathname, selectedSport, selectedLocation]);

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

  // Global Hardware Back Button Listener
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

  const handleLoginSuccess = useCallback(async (authUser: any) => {
    if (!authUser) return;

    setUser((prev) => {
      const newUser: User = {
        id: authUser.id,
        email: authUser.email || '',
        isLoggedIn: true,
        role: 'superadmin',
        role_status: 'approved', // Bypass approval for superadmin app
        joined_date: prev?.joined_date || '',
        location: prev?.location || '',
      };
      storage.setUser(newUser);
      return newUser;
    });

    ensureUserProfile(authUser).catch(console.error);
    roleService.ensurePlatformRole(authUser.id).catch(console.error);
    setTimeout(() => checkAllPermissions(), 1500);
  }, [checkAllPermissions]);

  // Use a ref for the login handler to avoid infinite loops in auth subscriber
  const loginHandlerRef = useRef(handleLoginSuccess);
  useEffect(() => {
    loginHandlerRef.current = handleLoginSuccess;
  }, [handleLoginSuccess]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResettingPassword(true);
        navigate('/reset-password');
      } else if (session?.user) {
        if (!isResettingPassword) {
          await loginHandlerRef.current(session.user);
        }
      } else if (event === 'SIGNED_OUT') {
        supabase.auth.getSession().then(({ data }) => {
          if (!data.session && user) {
            storage.logout();
            setUser(null);
            setSelectedLocation(null);
            setSelectedSport(null);
            setIsResettingPassword(false);
            setRole('superadmin');
            setIsSuperAuth(false);
            navigate('/', { replace: true });
          }
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isResettingPassword, navigate]); // Removed handleLoginSuccess and user/pathname from deps to be safe


  useEffect(() => {
    const checkPrivileges = async () => {
      if (user?.isLoggedIn && user?.id && !isResettingPassword) {
        if (pathname === '/reset-password' || pathname === '/edit-profile') return;

        setProfileCheckLoading(true);
        try {
          await supabase.auth.getSession();
          const { profile } = await getUserProfile(user.id);
          const platformRoleData = await roleService.getPlatformRole(user.id);

          if (profile) {
            const dbStatus = platformRoleData?.status || profile.role_status;
            const resolvedStatus = dbStatus || user.role_status || 'pending';
            const isApproved = resolvedStatus === 'approved';

            // Sync user state with platform-specific role info
            const mergedUser = {
              ...user,
              ...profile,
              profileImage: profile.avatar_url || user.profileImage,
              avatar_url: profile.avatar_url || '',
              username: profile.username || '',
              phone_number: profile.phone_number || '',
              role: 'superadmin',
              role_status: resolvedStatus,
            };

            storage.setUser(mergedUser);
            setUser(mergedUser);

            const isProfileComplete = !!(
              profile.email &&
              (profile.username || profile.display_name) &&
              (profile.phone_number || profile.phone) &&
              (profile.dob || profile.date_of_birth) &&
              profile.gender &&
              profile.address
            );

            if (!isProfileComplete) {
              navigate('/edit-profile');
            } else if (!isApproved) {
              if (pathname !== '/pending-approval') navigate('/pending-approval');
            } else if (isApproved && pathname === '/pending-approval') {
              navigate('/');
            }
          }
        } catch (e) {
          console.error('Privilege check error:', e);
          // Fallback: assume approved for superadmin context if check fails to prevent lockout
          if (user?.isLoggedIn) {
             const fallbackUser = { ...user, role_status: 'approved' };
             storage.setUser(fallbackUser);
             setUser(fallbackUser);
          }
        } finally {
          setProfileCheckLoading(false);
        }
      }
    };

    checkPrivileges();
  }, [user?.isLoggedIn, user?.id, isResettingPassword, pathname, navigate]);

  const handleLogout = async () => {
    triggerConfirm({
      message: 'Are you sure you want to log out of Superadmin?',
      onConfirm: async () => {
        await supabase.auth.signOut();
        storage.logout();
        setUser(null);
        setSelectedLocation(null);
        setSelectedSport(null);
        setRole('superadmin');
        storage.setSuperAuth(false);
        storage.setSuperAdminSession(false);
        setIsSuperAuth(false);
        window.location.href = '/';
      },
      isDestructive: true,
      confirmText: 'LOGOUT'
    });
  };

  const appContextValue: AppContextType = useMemo(() => ({
    user,
    setUser,
    selectedLocation,
    setSelectedLocation,
    selectedSport,
    setSelectedSport,
    triggerAlert,
    triggerConfirm,
    handleLogout,
    role,
    setRole,
    isSuperAuth,
    setIsSuperAuth
  }), [
    user,
    selectedLocation,
    selectedSport,
    triggerAlert,
    triggerConfirm,
    role,
    setRole,
    isSuperAuth
  ]);

  if (!user?.isLoggedIn && pathname !== '/auth-callback' && pathname !== '/reset-password') {
    return (
      <AppSharedContext.Provider value={appContextValue}>
        <LoginPage onAlert={triggerAlert} onLoginSuccess={() => {}} />
      </AppSharedContext.Provider>
    );
  }

  if (profileCheckLoading) {
    return <LoadingFallback />;
  }

  const backdropColor = theme.name === 'light'
    ? 'rgba(15, 23, 42, 0.3)'
    : 'rgba(0, 0, 0, 0.7)';

  const isPublicRoute = pathname === '/auth-callback' || pathname === '/reset-password';
  const isSetupRoute = pathname === '/edit-profile' || pathname === '/pending-approval';
  const isUserApproved = user?.role_status === 'approved';
  const showSecurityCheck = user?.isLoggedIn && isUserApproved && !isSuperAuth && !isPublicRoute && !isSetupRoute;

  return (
    <AppSharedContext.Provider value={appContextValue}>
      <div className="min-h-screen bg-background flex flex-col font-['Inter'] relative transition-all duration-300 overflow-x-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-success/10 rounded-full blur-[120px] pointer-events-none" />

        <main className="flex-1 relative">
          <div className="max-w-6xl mx-auto px-4">
            <Suspense fallback={<LoadingFallback />}>
              <motion.div
                key={pathname + (showSecurityCheck ? '-lock' : '-unlock')}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {showSecurityCheck ? (
                  <SuperAdminPasswordPrompt />
                ) : (
                  <Outlet />
                )}
              </motion.div>
            </Suspense>
          </div>
        </main>

        {/* Global Modals */}
        <AnimatePresence>
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
      { path: '/', element: <SportSelectorWrapper /> },
      { path: '/arenas/:sport', element: <LocationSelectorWrapper /> },
      { path: '/arena/:id', element: <ArenaDetailsPageWrapper /> },
      { path: '/profile', element: <ViewProfileWrapper /> },
      { path: '/edit-profile', element: <EditProfilePageWrapper /> },
      { path: '/superadmin', element: <SuperAdminWrapper type="approval" /> },
      { path: '/super-dashboard', element: <SuperAdminWrapper type="dashboard" /> },
      { path: '/approval-dashboard', element: <SuperAdminWrapper type="approval" /> },
      { path: '/superadmin-approval', element: <SuperAdminWrapper type="approval" /> },
      { path: '/admin/arena/:id/edit', element: <AdminEditArenaPageWrapper /> },
      { path: '/reviews/:locationId?', element: <ReviewPageWrapper /> },
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

import React, { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { signIn, signUp, signInWithGoogle, resetPassword, resendVerificationEmail } from '@/services/authService';
import { roleService } from '@/services/roleService';
import { storage } from '@/services/storage';
import { motion, AnimatePresence } from 'framer-motion';
import { handleError } from '@/services/errorHandler';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemeSelector } from '@/components/ThemeSelector';
import LoadingButton from '@/components/LoadingButton';
import { Lock, Mail, ArrowRight } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess?: (email: string) => void;
  onAlert?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onAlert }) => {
  const { theme } = useTheme();
  const PAGE_ID = 'login_page';
  const savedState = storage.getPageState<any>(PAGE_ID) || {};

  const [email, setEmail] = useState(savedState.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'email' | 'google' | 'forgot'>('google');
  const [isSignUp, setIsSignUp] = useState(savedState.isSignUp !== undefined ? savedState.isSignUp : true);
  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(true);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const [isResendingVerification, setIsResendingVerification] = useState(false);

  useEffect(() => {
    storage.setPageState(PAGE_ID, { email, mode, isSignUp });
  }, [email, mode, isSignUp]);

  const triggerAlert = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (onAlert) onAlert(msg, type);
    else console.warn('Alert triggered without onAlert handler:', msg);
  };

  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
      setIsSupabaseConfigured(false);
      triggerAlert('Database is not configured correctly. Please check your .env file.', 'error');
    }

    // Check for errors passed in URL (e.g. from AuthCallbackPage)
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error') || params.get('error_description');
    if (errorParam) {
      triggerAlert(decodeURIComponent(errorParam), 'error');
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && onLoginSuccess) {
        onLoginSuccess(user.email || '');
      }
    };
    checkAuth();
  }, [onLoginSuccess, isSupabaseConfigured]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isSignUp && password !== confirmPassword) {
      triggerAlert('Passwords do not match', 'error');
      setLoading(false);
      return;
    }

    try {
      const { user, error: authError, requiresEmailVerification, isExistingUser } = isSignUp
        ? await signUp(email, password, 'superadmin')
        : await signIn(email, password);

      if (authError) {
        triggerAlert(authError, 'error');
      } else if (isSignUp && isExistingUser) {
        setPendingVerificationEmail('');
        setIsSignUp(false);
        setPassword('');
        setConfirmPassword('');
        triggerAlert('User already exists. Please sign in.', 'info');
      } else if (user) {
        storage.clearPageState(PAGE_ID);
        if (isSignUp) {
          if (requiresEmailVerification) {
            setPendingVerificationEmail(email.trim());
            triggerAlert('Verification email requested. Check Inbox, Spam, and Promotions. If it does not arrive, use Resend Verification.', 'success');
          } else {
            setPendingVerificationEmail('');
            triggerAlert('Account created successfully.', 'success');
            onLoginSuccess?.(email);
          }
        } else {
          const platformRoleData = await roleService.getPlatformRole(user.id);
          const status = platformRoleData?.status || 'pending';

          if (status === 'pending') {
            window.location.href = '/pending-approval';
            return;
          } else if (status === 'rejected') {
            triggerAlert('Your account request was rejected. Please contact support.', 'error');
            return;
          } else if (status === 'approved') {
            onLoginSuccess?.(email);
          } else {
            triggerAlert('Unknown account status. Please contact support.', 'error');
          }
        }
      }
    } catch (err) {
      const appError = handleError(err);
      triggerAlert(appError.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!pendingVerificationEmail) {
      triggerAlert('Enter your email and create an account first.', 'info');
      return;
    }

    setIsResendingVerification(true);
    try {
      const { success, error } = await resendVerificationEmail(pendingVerificationEmail);
      if (success) {
        triggerAlert('Verification email resent. Check Inbox, Spam, and Promotions folders.', 'success');
      } else {
        triggerAlert(error || 'Unable to resend verification email right now.', 'error');
      }
    } finally {
      setIsResendingVerification(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { success, error: resetError } = await resetPassword(email);
      if (success) triggerAlert('Password reset link sent!', 'success');
      else {
        const appError = handleError(resetError);
        triggerAlert(appError.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error: authError } = await signInWithGoogle();
      if (authError) {
        const appError = handleError(authError);
        triggerAlert(appError.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center px-[var(--fluid-padding)] transition-colors duration-300" style={{ backgroundColor: theme.colors.background }}>
        <div className="w-full backdrop-blur-xl border p-[10vw] text-center shadow-2xl transition-all"
             style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radius.large }}>
          <h1 className="text-[7vw] font-black tracking-tighter" style={{ color: theme.colors.textPrimary }}>Configuration Error</h1>
          <p style={{ color: theme.colors.textSecondary }} className="mt-[4vw] text-[3.5vw]">The app is not configured.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5 md:px-[var(--fluid-padding)] relative overflow-hidden transition-colors duration-300 md:px-6 bg-background"
         style={{ backgroundColor: theme.colors.background }}>
      {/* 3D Animated Background */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] animate-pulse opacity-20 md:block hidden"
           style={{ backgroundColor: theme.colors.accent }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] animate-pulse delay-700 opacity-20 md:block hidden"
           style={{ backgroundColor: theme.colors.success }} />

      <div className="absolute top-6 right-6 z-50 md:top-[var(--fluid-padding)] md:right-6">
        <div className="p-1 rounded-2xl md:rounded-full bg-card border border-border shadow-sm">
            <ThemeSelector />
        </div>
      </div>

      <div className="max-w-7xl w-full flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-24 relative z-10">

        {/* Branding Section for Laptop */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden lg:flex flex-col flex-1 text-left space-y-6"
        >
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center text-white shadow-2xl"
               style={{ background: `linear-gradient(to bottom right, ${theme.colors.buttonGradient[0]}, ${theme.colors.buttonGradient[1]})` }}>
             <Lock className="w-12 h-12" />
          </div>
          <h1 className="text-7xl font-black tracking-tighter italic uppercase leading-tight text-text-primary">
            Join the<br/><span className="text-accent">Arena</span>
          </h1>
          <p className="text-xl font-bold uppercase tracking-[0.3em] text-text-disabled">
             The New Era of Sports Booking
          </p>
          <div className="flex gap-4">
             <div className="px-4 py-2 rounded-full border border-border bg-card text-[10px] font-black uppercase tracking-widest text-text-secondary">Cricket</div>
             <div className="px-4 py-2 rounded-full border border-border bg-card text-[10px] font-black uppercase tracking-widest text-text-secondary">Football</div>
             <div className="px-4 py-2 rounded-full border border-border bg-card text-[10px] font-black uppercase tracking-widest text-text-secondary">Badminton</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30, rotateX: 10 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full max-w-md backdrop-blur-2xl border p-8 md:p-8 space-y-10 md:space-y-8 relative z-10 perspective-1000 transition-all bg-card rounded-[2.5rem] md:rounded-[var(--fluid-radius)]"
          style={{
              borderColor: theme.colors.border,
              boxShadow: theme.elevation.modal
          }}
        >
          <div className="text-center">
            <motion.div
              whileHover={{ rotateY: 180, scale: 1.1 }}
              transition={{ duration: 0.6 }}
              className="w-20 h-20 md:w-20 md:h-20 rounded-2xl md:rounded-2xl flex items-center justify-center text-white mx-auto mb-6 md:mb-6 shadow-2xl transform preserve-3d bg-accent"
              style={{
                  background: `linear-gradient(to bottom right, ${theme.colors.buttonGradient[0]}, ${theme.colors.buttonGradient[1]})`,
              }}
            >
              <Lock className="w-10 h-10 md:w-10 md:h-10" />
            </motion.div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic uppercase drop-shadow-lg text-text-primary">Boxitt</h1>
            <p className="font-black md:font-bold uppercase text-[10px] md:text-xs tracking-[0.4em] md:tracking-[0.3em] mt-3 md:mt-2 text-accent">
              {mode === 'forgot' ? 'Reset access' : (isSignUp ? 'New Era of Sports' : 'Welcome Back')}
            </p>
          </div>

          <div className="flex gap-2.5 md:gap-2 p-1.5 md:p-1.5 rounded-2xl md:rounded-2xl border transition-all bg-background-secondary/80 md:bg-background-secondary/80 border-border"
               style={{ borderColor: theme.colors.border }}>
            <button type="button" disabled={loading} onClick={() => setMode('email')}
                    className={`flex-1 py-3 md:py-2 rounded-xl md:rounded-xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all shadow-sm ${mode === 'email' ? 'bg-accent text-white italic' : 'text-text-secondary'}`}>Email</button>
            <button type="button" disabled={loading} onClick={() => setMode('google')}
                    className={`flex-1 py-3 md:py-2 rounded-xl md:rounded-xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all shadow-sm ${mode === 'google' ? 'bg-accent text-white italic' : 'text-text-secondary'}`}>Google</button>
          </div>

          <AnimatePresence mode="wait">
            {mode === 'email' && (
              <motion.form
                key="email-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleEmailAuth}
                className="space-y-6 md:space-y-5"
              >
                <div className="space-y-2 md:space-y-2">
                  <label className="text-[10px] md:text-[10px] font-black uppercase tracking-widest ml-1 text-text-disabled">Email Address</label>
                  <div className="relative">
                      <Mail className="absolute left-5 md:left-4 top-1/2 -translate-y-1/2 w-5 md:w-5 h-5 md:h-5 opacity-40 md:opacity-30 text-text-primary" />
                      <input
                        type="email"
                        placeholder="super@domain.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-14 md:pl-12 pr-5 md:pr-5 py-5 md:py-4 border-2 rounded-2xl md:rounded-2xl font-bold outline-none transition-all text-sm md:text-sm bg-background-secondary text-text-primary border-border focus:border-accent/30"
                        required
                        disabled={loading}
                      />
                  </div>
                </div>
                <div className="space-y-2 md:space-y-2">
                  <div className="flex justify-between items-center ml-1 md:ml-1">
                    <label className="text-[10px] md:text-[10px] font-black uppercase tracking-widest text-text-disabled">
                      {isSignUp ? 'Choose Password' : 'Password'}
                    </label>
                    {!isSignUp && (
                      <button type="button" disabled={loading} onClick={() => setMode('forgot')} className="text-[10px] md:text-[10px] font-black uppercase tracking-widest transition-colors hover:opacity-70 text-accent">
                        Forgot?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                      <Lock className="absolute left-5 md:left-4 top-1/2 -translate-y-1/2 w-5 md:w-5 h-5 md:h-5 opacity-40 md:opacity-30 text-text-primary" />
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-14 md:pl-12 pr-5 md:pr-5 py-5 md:py-4 border-2 rounded-2xl md:rounded-2xl font-bold outline-none transition-all text-sm md:text-sm bg-background-secondary text-text-primary border-border focus:border-accent/30"
                        required
                        disabled={loading}
                      />
                  </div>
                </div>

                {isSignUp && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="space-y-2 md:space-y-2 overflow-hidden"
                  >
                    <label className="text-[10px] md:text-[10px] font-black uppercase tracking-widest ml-1 text-text-disabled">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-5 md:left-4 top-1/2 -translate-y-1/2 w-5 md:w-5 h-5 md:h-5 opacity-40 md:opacity-30 text-text-primary" />
                      <input
                          type="password"
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full pl-14 md:pl-12 pr-5 md:pr-5 py-5 md:py-4 border-2 rounded-2xl md:rounded-2xl font-bold outline-none transition-all text-sm md:text-sm bg-background-secondary text-text-primary border-border focus:border-accent/30"
                          required
                          disabled={loading}
                      />
                    </div>
                  </motion.div>
                )}

                <LoadingButton
                loading={loading}
                onClick={handleEmailAuth}
                className="w-full py-5 md:py-4 text-white rounded-2xl md:rounded-2xl font-black uppercase tracking-widest shadow-xl mt-4 md:mt-4 text-sm md:text-sm bg-accent active:translate-y-1"
                style={{
                    background: `linear-gradient(to right, ${theme.colors.buttonGradient[0]}, ${theme.colors.buttonGradient[1]})`,
                }}
                loadingText={isSignUp ? 'Verifying...' : 'Authenticating...'}
              >
                {isSignUp ? 'Create Account' : 'Enter Arena'}
              </LoadingButton>

                <button type="button" onClick={() => { setIsSignUp(!isSignUp); setConfirmPassword(''); }}
                        className="w-full text-xs md:text-xs font-black uppercase tracking-widest transition-colors pt-2 md:pt-2 text-text-disabled">
                  {isSignUp ? 'Member already? Sign In' : "New to Boxitt? Join Now"}
                </button>

                {isSignUp && pendingVerificationEmail && (
                  <div className="pt-2 text-center space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-disabled">
                      No email yet?
                    </p>
                    <LoadingButton
                      type="button"
                      onClick={handleResendVerification}
                      loading={isResendingVerification}
                      className="w-full py-3.5 rounded-xl font-black uppercase tracking-widest text-[10px] border border-border/60 text-text-primary"
                      loadingText="Resending..."
                    >
                      Resend Verification
                    </LoadingButton>
                  </div>
                )}
              </motion.form>
            )}

            {mode === 'forgot' && (
              <motion.form
                key="forgot-form"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                onSubmit={handleForgotPassword}
                className="space-y-8"
              >
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1 block text-text-disabled">Email Address</label>
                  <input type="email" placeholder="super@domain.com" value={email} onChange={(e) => setEmail(e.target.value)}
                         className="w-full p-5 bg-background-secondary border-2 border-border rounded-2xl font-bold outline-none transition-all placeholder:text-slate-500 text-sm text-text-primary"
                         required disabled={loading} />
                </div>

                <LoadingButton
                loading={loading}
                onClick={handleForgotPassword}
                className="w-full py-5 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl text-sm bg-success"
                loadingText="Sending..."
              >
                Send Magic Link
              </LoadingButton>

                <button type="button" disabled={loading} onClick={() => setMode('email')} className="w-full text-xs font-black uppercase tracking-widest transition-colors text-text-disabled">
                  Return to Login
                </button>
              </motion.form>
            )}

            {mode === 'google' && (
              <motion.div
                key="google-mode"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8 md:space-y-6 py-4 md:py-4"
              >
                <LoadingButton
                  loading={loading}
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full py-5 md:py-4 rounded-2xl md:rounded-2xl font-black uppercase tracking-widest shadow-2xl border-2 text-sm md:text-sm transition-all bg-card text-text-primary border-border active:translate-y-1"
                  loadingText="Connecting..."
                  icon={
                    <svg className="w-6 h-6 md:w-6 md:h-6" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  }
                >
                  Google Login
                </LoadingButton>
                <p className="text-[11px] md:text-xs text-center font-black md:font-bold uppercase tracking-widest leading-relaxed opacity-40 md:opacity-100 text-text-disabled">
                  One-tap access to your sports identity
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { motion } from 'framer-motion';
import { ShieldCheck, Cpu, Globe } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { storage } from '../services/storage';

const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('Callback URL:', window.location.href);
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const errorMsg = urlParams.get('error_description') || urlParams.get('error');

        if (errorMsg) {
          console.error('Auth error from URL:', errorMsg);
          navigate(`/login?error=${encodeURIComponent(errorMsg)}`);
          return;
        }

        let session = null;

        if (code) {
          console.log('Found code, exchanging for session...');
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          session = data.session;
        } else {
          console.log('No code found, checking getSession...');
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          session = data.session;
        }

        console.log('Final session result:', session);

        if (!session) {
          console.error('No session found after exchange/check');
          // Wait a second and try one last time, sometimes there's a race condition
          const { data: retryData } = await supabase.auth.getSession();
          if (!retryData.session) {
            navigate('/login?error=Session+not+found');
            return;
          }
          session = retryData.session;
        }

        // 2. Initialize the session flag required by storage.ts
        sessionStorage.setItem('boxit_session_active', 'true');

        // 3. Update local storage so App.tsx recognizes the user
        const user = session.user;
        storage.setUser({
          id: user.id,
          email: user.email || '',
          isLoggedIn: true,
          joined_date: user.created_at,
          location: ''
        });

        // 4. Check if profile exists to determine initial route
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id, phone_number, location')
          .eq('id', user.id)
          .single();

        // 5. Set initial navigation state
        if (!profile || !profile.phone_number || !profile.location) {
          storage.setNavState({
            currentPage: 'edit-profile',
            selectedSport: null,
            selectedLocation: null
          });
        } else {
          storage.setNavState({
            currentPage: 'booking',
            selectedSport: null,
            selectedLocation: null
          });
        }

        // 6. Redirect to root using window.location.replace to hard-reset the session history
        window.location.replace('/');

      } catch (error: any) {
        console.error('Callback process error:', error);
        navigate(`/login?error=${encodeURIComponent(error?.message || 'Authentication process failed')}`);
      }
    };
    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden transition-colors duration-300"
         style={{ backgroundColor: theme.colors.background }}>
      <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] rounded-full blur-[120px] pointer-events-none opacity-20" style={{ backgroundColor: theme.colors.accent }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] pointer-events-none opacity-20" style={{ backgroundColor: theme.colors.success }} />

      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center relative z-10">
        <div className="relative mb-12">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                      className="w-32 h-32 border-4 border-white/5 rounded-full mx-auto shadow-2xl" style={{ borderTopColor: theme.colors.accent }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}>
              <ShieldCheck className="w-12 h-12" style={{ color: theme.colors.accent }} />
            </motion.div>
          </div>
        </div>

        <h1 className="text-3xl font-black italic uppercase tracking-tighter mb-4" style={{ color: theme.colors.textPrimary }}>
          Securing <span style={{ color: theme.colors.accent }}>Session</span>
        </h1>

        <div className="space-y-3">
          <div className="flex items-center justify-center gap-3">
            <Cpu className="w-4 h-4 animate-pulse" style={{ color: theme.colors.textDisabled }} />
            <p className="text-[10px] font-black uppercase tracking-[0.4em]" style={{ color: theme.colors.textDisabled }}>Setting up Account</p>
          </div>
        </div>

        <div className="mt-16 bg-white/5 backdrop-blur-xl border px-8 py-4 rounded-2xl transition-all" style={{ borderColor: `${theme.colors.border}20` }}>
          <p className="text-[9px] font-black uppercase tracking-widest flex items-center gap-2" style={{ color: theme.colors.textDisabled }}>
            <Globe className="w-3 h-3" /> Secure connection established
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthCallbackPage;

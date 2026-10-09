import React from 'react';
import LoadingButton from '../components/LoadingButton';
import { motion } from 'framer-motion';
import { ShieldAlert, Clock, ArrowLeft } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeSelector } from '../components/ThemeSelector';

const PendingApprovalPage: React.FC = () => {
  const { theme } = useTheme();
  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden transition-colors duration-300"
         style={{ backgroundColor: theme.colors.background }}>
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] rounded-full blur-[120px] pointer-events-none opacity-20" style={{ backgroundColor: theme.colors.accent }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[100px] pointer-events-none opacity-20" style={{ backgroundColor: theme.colors.success }} />

      <div className="absolute top-8 right-8 z-50">
        <ThemeSelector />
      </div>

      <motion.div
        initial={{ scale: 0.9, opacity: 0, rotateX: 20 }}
        animate={{ scale: 1, opacity: 1, rotateX: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-md backdrop-blur-3xl border p-12 text-center shadow-2xl relative z-10 perspective-1000 transition-all"
        style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radius.large }}
      >
        <div className="absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full opacity-5" style={{ backgroundColor: theme.colors.accent }} />

        <motion.div
          whileHover={{ rotateY: 180 }}
          className="w-24 h-24 rounded-[2rem] flex items-center justify-center text-white mx-auto mb-10 shadow-2xl transform rotate-3 transition-all"
          style={{ backgroundColor: theme.colors.accent }}
        >
          <ShieldAlert className="w-12 h-12" />
        </motion.div>

        <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-6 leading-tight" style={{ color: theme.colors.textPrimary }}>
          Account <span style={{ color: theme.colors.accent }}>Pending</span>
        </h1>

        <div className="space-y-6">
          <div className="p-8 rounded-[2.5rem] border shadow-inner transition-all"
               style={{ backgroundColor: `${theme.colors.backgroundSecondary}40`, borderColor: `${theme.colors.border}20` }}>
            <div className="flex items-center justify-center gap-3 mb-4">
              <Clock className="w-5 h-5 animate-pulse" style={{ color: theme.colors.accentGlow }} />
              <span className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: theme.colors.accentGlow }}>Verification in Progress</span>
            </div>
            <p className="font-bold leading-relaxed" style={{ color: theme.colors.textSecondary }}>
              Your account is currently being reviewed by our administrators.
              You will be granted access once your profile is verified.
            </p>
          </div>

          <p className="text-[9px] font-black uppercase tracking-[0.4em] leading-relaxed" style={{ color: theme.colors.textDisabled }}>
            You will receive a notification once your account is approved.
          </p>

          <LoadingButton
            onClick={() => window.location.href = '/login'}
            className="w-full py-5 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl"
            style={{ backgroundColor: theme.colors.accent }}
            icon={<ArrowLeft className="w-4 h-4" />}
            loadingText="Redirecting..."
          >
            Return to Login
          </LoadingButton>
        </div>
      </motion.div>
    </div>
  );
};

export default PendingApprovalPage;

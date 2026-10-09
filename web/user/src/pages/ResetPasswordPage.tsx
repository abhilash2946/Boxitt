import React, { useState } from 'react';
import { updatePassword } from '@/services/authService';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { handleError } from '@/services/errorHandler';
import { useTheme } from '@/contexts/ThemeContext';
import LoadingButton from '@/components/LoadingButton';

interface ResetPasswordPageProps {
  onComplete: () => void;
  onAlert?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ onComplete, onAlert }) => {
  const { theme } = useTheme();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const triggerAlert = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (onAlert) onAlert(msg, type);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { triggerAlert('Passwords do not match', 'error'); return; }
    if (password.length < 6) { triggerAlert('Password must be at least 6 characters', 'error'); return; }

    setLoading(true);
    try {
      const { success: isSuccess, error: updateError } = await updatePassword(password);
      if (isSuccess) {
        setSuccess(true);
        triggerAlert('Password Updated Successfully!', 'success');
        setTimeout(() => { onComplete(); }, 2000);
      } else triggerAlert(handleError(updateError).message, 'error');
    } catch (err) { triggerAlert(handleError(err).message, 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-[var(--fluid-padding)] relative overflow-hidden transition-colors duration-300"
      style={{ backgroundColor: theme.colors.background }}>
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] rounded-full blur-[120px] pointer-events-none opacity-20" style={{ backgroundColor: theme.colors.accent }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[100px] pointer-events-none opacity-20" style={{ backgroundColor: theme.colors.success }} />

      <AnimatePresence mode="wait">
        {success ? (
          <motion.div key="success" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="w-full backdrop-blur-3xl border p-[12vw] text-center space-y-[6vw] shadow-2xl transition-all"
            style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radius.large }}>
            <div className="w-[24vw] h-[24vw] rounded-[var(--fluid-radius)] flex items-center justify-center mx-auto mb-[var(--fluid-padding)] shadow-2xl transform rotate-12"
              style={{ backgroundColor: theme.colors.success, color: 'white' }}>
              <CheckCircle2 className="w-[var(--btn-height)] h-[var(--btn-height)]" />
            </div>
            <h2 className="text-[7.5vw] font-black italic uppercase tracking-tighter" style={{ color: theme.colors.textPrimary }}>Password Updated</h2>
            <p className="text-[2.5vw] font-black uppercase tracking-[0.3em] animate-pulse" style={{ color: theme.colors.textDisabled }}>Redirecting...</p>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="w-full backdrop-blur-3xl border p-[10vw] space-y-[10vw] shadow-2xl relative z-10 transition-all"
            style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radius.large }}>
            <div className="text-center">
              <motion.div whileHover={{ rotateY: 180 }} className="w-[20vw] h-[20vw] rounded-[4vw] flex items-center justify-center text-white mx-auto mb-[var(--fluid-padding)] shadow-2xl transform rotate-3"
                style={{ backgroundColor: theme.colors.accent }}>
                <Lock className="w-[10vw] h-[10vw]" />
              </motion.div>
              <h1 className="text-[9vw] font-black tracking-tighter italic uppercase leading-none drop-shadow-2xl" style={{ color: theme.colors.textPrimary }}>
                Reset <span style={{ color: theme.colors.accent }}>Password</span>
              </h1>
              <p className="text-[2.5vw] font-black uppercase tracking-[0.4em] mt-[4vw] px-[var(--fluid-padding)] py-[2vw] rounded-full border inline-block transition-all"
                style={{ color: theme.colors.textDisabled, backgroundColor: `${theme.colors.backgroundSecondary}40`, borderColor: `${theme.colors.border}40` }}>Reset your account password</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-[6vw]">
              <div className="space-y-[2vw]">
                <label className="text-[2.5vw] font-black uppercase tracking-widest ml-[1vw]" style={{ color: theme.colors.textDisabled }}>New Password</label>
                <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-[5vw] border-2 rounded-[4vw] font-bold outline-none transition-all shadow-inner text-[3.5vw]"
                  style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary, borderColor: theme.colors.border }}
                  required disabled={loading} />
              </div>
              <div className="space-y-[2vw]">
                <label className="text-[2.5vw] font-black uppercase tracking-widest ml-[1vw]" style={{ color: theme.colors.textDisabled }}>Confirm Password</label>
                <input type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-[5vw] border-2 rounded-[4vw] font-bold outline-none transition-all shadow-inner text-[3.5vw]"
                  style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary, borderColor: theme.colors.border }}
                  required disabled={loading} />
              </div>

              <LoadingButton
              loading={loading}
              onClick={handleSubmit}
              className="w-full py-[var(--fluid-padding)] text-white rounded-[var(--fluid-radius)] font-black uppercase tracking-[0.2em] text-[2.8vw] shadow-2xl mt-[4vw]"
              style={{ backgroundColor: theme.colors.accent }}
              icon={<ShieldCheck className="w-[5vw] h-[5vw]" />}
              loadingText="Updating..."
            >
              Update Password
            </LoadingButton>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ResetPasswordPage;

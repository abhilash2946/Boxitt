import React, { useState } from 'react';
import { Shield, User as UserIcon, Lock, Mail, ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';
import { verifyAdminCredentials } from '../services/authService';
import { storage } from '../services/storage';
import LoadingButton from './LoadingButton';

interface AdminSecurityPromptProps {
  email: string;
  onSuccess: (locationId?: string) => void;
  onLogout: () => void;
  onAlert: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const AdminSecurityPrompt: React.FC<AdminSecurityPromptProps> = ({ email, onSuccess, onLogout, onAlert }) => {
  const { theme } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      onAlert('Please enter both username and password.', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await verifyAdminCredentials(email, username, password);
      if (result.success) {
        storage.setAdminAuth({ role: 'admin', email, locationId: result.locationId });
        onSuccess(result.locationId);
      } else {
        onAlert('Invalid admin credentials. Please check your username and password.', 'error');
      }
    } catch (err) {
      onAlert('An error occurred during verification.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 md:mt-20 p-8 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] shadow-theme-modal border text-center transition-all duration-500 relative overflow-hidden"
         style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>

      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full opacity-5 pointer-events-none" style={{ backgroundColor: theme.colors.accent }} />
      <div className="absolute bottom-0 left-0 w-24 h-24 blur-3xl rounded-full opacity-5 pointer-events-none" style={{ backgroundColor: theme.colors.success }} />

      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onLogout}
        className="absolute top-8 left-8 p-3 rounded-2xl border shadow-theme-card transition-all"
        style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border, color: theme.colors.textPrimary }}
      >
        <ChevronLeft className="w-5 h-5" />
      </motion.button>

      <div className="w-20 h-20 bg-accent/10 rounded-theme-md flex items-center justify-center mx-auto mb-8 shadow-theme-elevated group hover:rotate-12 transition-transform duration-500">
        <Shield className="w-10 h-10 text-accent" />
      </div>

      <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-2" style={{ color: theme.colors.textPrimary }}>Admin <span style={{ color: theme.colors.accent }}>Login</span></h2>
      <div className="px-6 py-2 rounded-full border mb-10 inline-block" style={{ backgroundColor: `${theme.colors.accent}10`, borderColor: `${theme.colors.accent}30` }}>
        <span className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: theme.colors.accent }}>Security Verification</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 relative z-10 text-left">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest ml-1" style={{ color: theme.colors.textDisabled }}>Admin Email</label>
          <div className="relative group">
            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 opacity-30 transition-opacity group-focus-within:opacity-100" style={{ color: theme.colors.textPrimary }} />
            <input
              type="email"
              value={email}
              readOnly
              className="w-full pl-14 pr-6 py-4 rounded-2xl font-bold outline-none border-2 border-transparent transition-all shadow-inner bg-background-secondary opacity-60"
              style={{ color: theme.colors.textPrimary }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest ml-1" style={{ color: theme.colors.textDisabled }}>Username</label>
          <div className="relative group">
            <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 opacity-30 transition-opacity group-focus-within:opacity-100" style={{ color: theme.colors.textPrimary }} />
            <input
              type="text"
              placeholder="Enter Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              className="w-full pl-14 pr-6 py-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-accent transition-all shadow-inner"
              style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest ml-1" style={{ color: theme.colors.textDisabled }}>Password</label>
          <div className="relative group">
            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 opacity-30 transition-opacity group-focus-within:opacity-100" style={{ color: theme.colors.textPrimary }} />
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-14 pr-6 py-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-accent transition-all shadow-inner"
              style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary }}
            />
          </div>
        </div>

        <LoadingButton
          type="submit"
          loading={loading}
          className="w-full py-5 text-white rounded-2xl font-black uppercase tracking-widest shadow-theme-elevated active:scale-95 transition-all mt-4"
          style={{ background: `linear-gradient(to right, ${theme.colors.buttonGradient[0]}, ${theme.colors.buttonGradient[1]})` }}
          icon={<Lock className="w-5 h-5" />}
        >
          Login
        </LoadingButton>
      </form>

      <p className="mt-8 text-[9px] font-black uppercase tracking-[0.3em] leading-relaxed" style={{ color: theme.colors.textDisabled }}>
        Authorized Access Only. All activities are monitored.
      </p>
    </div>
  );
};

export default AdminSecurityPrompt;

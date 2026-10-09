import React, { useState } from 'react';
import { Lock, X, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { motion } from 'framer-motion';

interface ChangePasswordModalProps {
    onClose: () => void;
    onAlert?: (msg: string, type: 'success' | 'error') => void;
    userEmail: string;
}

export default function ChangePasswordModal({ onClose, onAlert, userEmail }: ChangePasswordModalProps) {
    const { theme } = useTheme();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentPassword || !newPassword || !confirmPassword) return;
        if (newPassword !== confirmPassword) { onAlert?.('No match', 'error'); return; }
        if (newPassword.length < 6) { onAlert?.('Min 6 chars', 'error'); return; }

        setIsSubmitting(true);
        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({ email: userEmail, password: currentPassword });
            if (signInError) { setIsSubmitting(false); onAlert?.('Wrong password', 'error'); return; }
            const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
            if (updateError) { setIsSubmitting(false); onAlert?.('Update failed', 'error'); return; }
            onAlert?.('Password Updated!', 'success'); onClose();
        } catch (err: any) { setIsSubmitting(false); }
    };

    const backdropBg = theme.name === 'light' ? 'rgba(15, 23, 42, 0.4)' : 'rgba(0, 0, 0, 0.8)';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 backdrop-blur-md transition-colors duration-300"
                style={{ backgroundColor: backdropBg }}
                onClick={onClose}
            />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
                        className="w-full max-w-sm overflow-hidden border shadow-theme-modal transition-all duration-300 relative z-10"
                        style={{
                            backgroundColor: theme.colors.card,
                            borderColor: theme.colors.border,
                            borderRadius: theme.radius.large,
                            backdropFilter: theme.name !== 'light' ? 'blur(10px)' : 'none'
                        }}>
                <div className="p-6 border-b flex justify-between items-center transition-all" style={{ borderColor: `${theme.colors.border}40`, backgroundColor: `${theme.colors.backgroundSecondary}20` }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
                             style={{ backgroundColor: `${theme.colors.accent}20`, color: theme.colors.accent }}>
                            <Lock className="w-5 h-5" />
                        </div>
                        <h3 className="font-black uppercase tracking-widest text-sm" style={{ color: theme.colors.textPrimary }}>Security</h3>
                    </div>
                    <button onClick={onClose} style={{ color: theme.colors.textDisabled }}><X className="w-5 h-5" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {[
                        { label: 'Current', val: currentPassword, set: setCurrentPassword, show: showCurrent, setShow: setShowCurrent },
                        { label: 'New', val: newPassword, set: setNewPassword, show: showNew, setShow: setShowNew },
                        { label: 'Confirm', val: confirmPassword, set: setConfirmPassword, show: showConfirm, setShow: setShowConfirm }
                    ].map((field, i) => (
                        <div key={i} className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest ml-1" style={{ color: theme.colors.textDisabled }}>{field.label} Password</label>
                            <div className="relative">
                                <input type={field.show ? 'text' : 'password'} value={field.val} onChange={e => field.set(e.target.value)}
                                       className="w-full border-2 border-transparent rounded-2xl p-4 font-bold outline-none transition-all shadow-inner"
                                       style={{
                                           backgroundColor: theme.colors.backgroundSecondary,
                                           color: theme.colors.textPrimary,
                                           borderColor: 'transparent'
                                       }} disabled={isSubmitting} />
                                <button type="button" onClick={() => field.setShow(!field.show)} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-100 transition-all" style={{ color: theme.colors.textPrimary }}>
                                    {field.show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    ))}

                    <div className="pt-4">
                        <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={isSubmitting}
                                       className="w-full text-white font-black py-4 rounded-[1.5rem] uppercase tracking-widest text-xs shadow-theme-elevated transition-all disabled:opacity-50"
                                       style={{ backgroundColor: theme.colors.accent }}>
                            {isSubmitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : 'Update Security'}
                        </motion.button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}

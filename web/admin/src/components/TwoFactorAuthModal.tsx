import React, { useState, useEffect } from 'react';
import { ShieldCheck, X, Copy, CheckCircle2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

interface TwoFactorAuthModalProps {
    onClose: () => void;
    onAlert?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function TwoFactorAuthModal({ onClose, onAlert }: TwoFactorAuthModalProps) {
    const { theme } = useTheme();
    const [step, setStep] = useState<'loading' | 'enroll' | 'verify' | 'success'>('loading');
    const [factorId, setFactorId] = useState('');
    const [qrCodeSvg, setQrCodeSvg] = useState('');
    const [secret, setSecret] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        async function checkStatus() {
            try {
                const { data, error: factorsError } = await supabase.auth.mfa.listFactors();
                if (factorsError) throw factorsError;
                const verifiedFactor = data?.all?.find((f: any) => f.factor_type === 'totp' && f.status === 'verified');
                if (verifiedFactor) {
                    onAlert?.('2FA already enabled.', 'success'); onClose(); return;
                }
                const unverifiedFactors = data?.all?.filter((f: any) => f.factor_type === 'totp' && f.status === 'unverified') || [];
                for (const factor of unverifiedFactors) { await supabase.auth.mfa.unenroll({ factorId: factor.id }); }
                const { data: enrollData, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
                if (error) throw error;
                setFactorId(enrollData.id); setQrCodeSvg(enrollData.totp.qr_code); setSecret(enrollData.totp.secret); setStep('enroll');
            } catch (err: any) { onAlert?.('Setup failed', 'error'); onClose(); }
        }
        checkStatus();
    }, []);

    const handleCopySecret = async () => {
        await navigator.clipboard.writeText(secret);
        setCopied(true); setTimeout(() => setCopied(false), 2000);
    };

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (verificationCode.length < 6) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: verificationCode });
            if (error) throw error;
            setStep('success'); onAlert?.('2FA Enabled!', 'success'); setTimeout(onClose, 2500);
        } catch (err: any) { onAlert?.('Wrong code', 'error'); } finally { setIsSubmitting(false); }
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
                             style={{ backgroundColor: step === 'success' ? theme.colors.success : `${theme.colors.accent}20`, color: step === 'success' ? 'white' : theme.colors.accent }}>
                            {step === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                        </div>
                        <h3 className="font-black uppercase tracking-widest text-sm" style={{ color: theme.colors.textPrimary }}>Two-Factor</h3>
                    </div>
                    <button onClick={onClose} style={{ color: theme.colors.textDisabled }}><X className="w-5 h-5" /></button>
                </div>

                <div className="p-8">
                    {step === 'loading' && (
                        <div className="flex flex-col items-center justify-center py-8">
                            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mb-4" style={{ borderTopColor: theme.colors.accent }} />
                            <p className="text-xs uppercase font-black tracking-widest" style={{ color: theme.colors.textDisabled }}>Initializing...</p>
                        </div>
                    )}

                    {step === 'enroll' && (
                        <div className="space-y-8">
                            <p className="text-sm font-bold text-center leading-relaxed" style={{ color: theme.colors.textSecondary }}>Scan QR code with your authenticator app</p>
                            <div className="bg-white p-4 rounded-3xl mx-auto w-48 h-48 flex items-center justify-center overflow-hidden shadow-inner border border-slate-100"
                                dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
                            />
                            <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-center" style={{ color: theme.colors.textDisabled }}>Manual Entry Key</p>
                                <div onClick={handleCopySecret} className="rounded-2xl p-4 flex justify-between items-center cursor-pointer border transition-all shadow-inner"
                                     style={{
                                         backgroundColor: theme.colors.backgroundSecondary,
                                         borderColor: `${theme.colors.border}40`
                                     }}>
                                    <code className="text-xs font-mono tracking-widest dynamic-text flex-1" style={{ color: theme.colors.textPrimary }}>{secret}</code>
                                    {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 opacity-30" style={{ color: theme.colors.textPrimary }} />}
                                </div>
                            </div>
                            <button onClick={() => setStep('verify')} className="w-full text-white font-black py-4 rounded-[1.5rem] uppercase tracking-widest text-xs shadow-theme-elevated transition-all active:scale-95" style={{ backgroundColor: theme.colors.accent }}>I have scanned it</button>
                        </div>
                    )}

                    {step === 'verify' && (
                        <form onSubmit={handleVerify} className="space-y-8">
                            <p className="text-sm font-bold text-center" style={{ color: theme.colors.textSecondary }}>Enter 6-digit verification code</p>
                            <input type="text" maxLength={6} autoFocus value={verificationCode} onChange={e => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                                   className="w-full border-2 border-transparent rounded-2xl p-5 text-center text-2xl tracking-[0.5em] font-black outline-none transition-all shadow-inner"
                                   style={{
                                       backgroundColor: theme.colors.backgroundSecondary,
                                       color: theme.colors.textPrimary
                                   }} placeholder="000000" />
                            <button type="submit" disabled={isSubmitting || verificationCode.length < 6}
                                    className="w-full text-white font-black py-4 rounded-[1.5rem] uppercase tracking-widest text-xs shadow-theme-elevated transition-all disabled:opacity-50 active:scale-95"
                                    style={{ backgroundColor: theme.colors.accent }}>
                                {isSubmitting ? 'Verifying...' : 'Complete Setup'}
                            </button>
                        </form>
                    )}

                    {step === 'success' && (
                        <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                            <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-xl" style={{ backgroundColor: theme.colors.success, color: 'white' }}>
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <p className="text-xl font-black italic uppercase tracking-tighter" style={{ color: theme.colors.textPrimary }}>Secure!</p>
                            <p className="text-sm" style={{ color: theme.colors.textDisabled }}>Two-Factor Auth is active.</p>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

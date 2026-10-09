import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, X, RotateCcw } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { usePermissions } from '../hooks/usePermissions';
import { motion } from 'framer-motion';

interface CameraCaptureModalProps {
    onCapture: (blob: Blob) => void;
    onClose: () => void;
}

export default function CameraCaptureModal({ onCapture, onClose }: CameraCaptureModalProps) {
    const { theme } = useTheme();
    const { checkAndPrompt, permissions } = usePermissions();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);

    const startCamera = useCallback(async () => {
        if (permissions.camera !== 'allow') {
            await checkAndPrompt('camera', true);
            return;
        }
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
            setStream(mediaStream);
            if (videoRef.current) videoRef.current.srcObject = mediaStream;
            setError(null);
        } catch (err: any) {
            if (err.name === 'NotAllowedError') {
                setError('Camera permission denied.');
            } else {
                setError('Failed to access camera.');
            }
        }
    }, [permissions.camera, checkAndPrompt]);

    useEffect(() => {
        startCamera();
        return () => { if (stream) stream.getTracks().forEach(track => track.stop()); };
    }, [startCamera]);

    const takePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            if (context) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
                context.translate(canvasRef.current.width, 0);
                context.scale(-1, 1);
                context.drawImage(videoRef.current, 0, 0);
                canvasRef.current.toBlob(b => { if (b) onCapture(b); }, 'image/jpeg', 0.8);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
                        className="relative w-full max-w-lg max-h-[90dvh] overflow-hidden border shadow-theme-modal transition-all duration-300 flex flex-col"
                        style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radius.large }}>
                <div className="p-4 sm:p-6 border-b flex justify-between items-center shrink-0" style={{ borderColor: theme.colors.border }}>
                    <div className="flex items-center gap-3">
                        <Camera className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: theme.colors.accent }} />
                        <h3 className="font-black uppercase tracking-widest text-xs sm:text-sm" style={{ color: theme.colors.textPrimary }}>Camera</h3>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl transition-all shadow-theme-card active:scale-95" style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textDisabled }}>
                        <X className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                </div>

                <div className="relative aspect-square bg-black overflow-hidden flex-1">
                    {error ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                            <p className="text-white text-sm mb-6">{error}</p>
                            <button onClick={() => window.location.reload()} className="px-6 py-3 bg-white/10 text-white rounded-xl font-bold flex items-center gap-2 border border-white/20 active:scale-95 transition-all"><RotateCcw className="w-4 h-4" /> Retry</button>
                        </div>
                    ) : (
                        <>
                            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
                            <canvas ref={canvasRef} className="hidden" />
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                <div className="w-48 h-48 sm:w-64 sm:h-64 border-2 border-white/30 rounded-full shadow-[0_0_0_999px_rgba(0,0,0,0.4)]" />
                            </div>
                        </>
                    )}
                </div>

                {!error && (
                    <div className="p-6 sm:p-8 flex flex-col items-center shrink-0" style={{ backgroundColor: theme.colors.backgroundSecondary }}>
                        <motion.button whileTap={{ scale: 0.9 }} onClick={takePhoto}
                                       className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full shadow-theme-elevated border-4 sm:border-8 flex items-center justify-center transition-all"
                                       style={{ borderColor: theme.colors.accent }}>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full" style={{ backgroundColor: theme.colors.accent }} />
                        </motion.button>
                    </div>
                )}
            </motion.div>
        </div>
    );
}

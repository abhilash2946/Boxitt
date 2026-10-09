import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { bookingService } from '../services/bookingService';
import { BookingStatus } from '../types';
import { storage } from '../services/storage';
import { motion } from 'framer-motion';
import { QrCode, Upload, Camera, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
import { handleError } from '../services/errorHandler';
import { useTheme } from '../contexts/ThemeContext';
import { usePermissions } from '../hooks/usePermissions';

interface ScannerProps {
  onAlert?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

interface ScannedMeta {
  id: string;
  type: 'challenge' | 'match' | 'generic';
  role: string;
  userId: string;
}

const Scanner: React.FC<ScannerProps> = ({ onAlert }) => {
  const { theme } = useTheme();
  const { checkAndPrompt, permissions } = usePermissions();
  const PAGE_ID = 'scanner';
  const savedState = storage.getPageState<any>(PAGE_ID) || {};

  const [bookingInfo, setBookingInfo] = useState<any>(savedState.bookingInfo || null);
  const [challengeInfo, setChallengeInfo] = useState<any>(savedState.challengeInfo || null);
  const [scannedMeta, setScannedMeta] = useState<ScannedMeta | null>(savedState.scannedMeta || null);
  const [hasJustConfirmed, setHasJustConfirmed] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("Align QR code");
  const [stream, setStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    storage.setPageState(PAGE_ID, { bookingInfo, challengeInfo, scannedMeta });
  }, [bookingInfo, challengeInfo, scannedMeta]);

  const triggerAlert = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (onAlert) onAlert(msg, type);
    else console.warn('Alert triggered without onAlert handler:', msg);
  };

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) document.body.removeChild(script);
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsScanning(false);
  }, [stream]);

  const parseQrData = (rawData: string): ScannedMeta => {
    if (!rawData) return { id: '', type: 'generic', role: 'player', userId: '' };
    if (rawData.startsWith('challenge:') || rawData.startsWith('match:')) {
      const parts = rawData.split(':');
      return {
        type: parts[0] as any,
        id: parts[1] || '',
        role: parts[2] || 'player',
        userId: parts[3] || ''
      };
    }
    let extractedId = rawData.trim();
    if (extractedId.includes('id=')) extractedId = extractedId.split('id=')[1].split('&')[0];
    else if (extractedId.includes('/')) extractedId = extractedId.split('/').pop() || '';
    return { id: extractedId, type: 'generic', role: 'player', userId: '' };
  };

  const handleScanSuccess = useCallback(async (rawData: string) => {
    stopCamera();
    setLoading(true);
    setBookingInfo(null);
    setChallengeInfo(null);
    setHasJustConfirmed(false);

    const meta = parseQrData(rawData);
    setScannedMeta(meta);

    if (!meta.id) {
      triggerAlert('Invalid QR Code format', 'error');
      setLoading(false);
      return;
    }

    try {
      if (meta.type === 'challenge') {
        const challenge = await (bookingService as any).getChallengeById(meta.id);
        if (challenge) setChallengeInfo(challenge);
        else triggerAlert(`Challenge not found: ${meta.id.slice(0, 10)}...`, 'error');
      } else {
        const booking = await bookingService.getBookingById(meta.id);
        if (booking) {
          await bookingService.checkAndApplyTimeout(booking);
          setBookingInfo(booking);
        } else {
          const challenge = await (bookingService as any).getChallengeById(meta.id);
          if (challenge) setChallengeInfo(challenge);
          else triggerAlert(`Invalid Ticket ID: ${meta.id.slice(0, 10)}...`, 'error');
        }
      }
    } catch (err) {
      const appError = handleError(err);
      triggerAlert(appError.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [stopCamera]);

  const startCamera = async () => {
    setBookingInfo(null);
    setChallengeInfo(null);
    setScannedMeta(null);
    setHasJustConfirmed(false);

    if (permissions.camera !== 'allow') {
      await checkAndPrompt('camera', true, false, true);
      return;
    }

    try {
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        throw new Error("SECURE_CONTEXT_REQUIRED");
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      setStream(mediaStream);
      setIsScanning(true);
      setStatusMessage("Align QR code");
      if (permissions.camera !== 'allow') {
        window.dispatchEvent(new CustomEvent('boxit_permissions_updated', { detail: { type: 'camera', choice: 'allow' } }));
      }
    } catch (err: any) {
      if (err.message === "SECURE_CONTEXT_REQUIRED") {
        triggerAlert("HTTPS Required", 'error');
      } else if (err.name === 'NotAllowedError') {
        checkAndPrompt('camera', true);
        triggerAlert("Camera permission denied. Please enable it in settings.", 'error');
      } else if (err.name === 'NotFoundError') {
        triggerAlert("No camera device found", 'error');
      } else {
        triggerAlert("Camera Access Denied", 'error');
      }
      setIsScanning(false);
    }
  };

  const tick = useCallback(() => {
    if (!videoRef.current || !isScanning) return;
    const video = videoRef.current;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const canvasElement = canvasRef.current;
      if (canvasElement) {
        const canvas = canvasElement.getContext('2d', { willReadFrequently: true });
        if (canvas) {
          canvasElement.height = video.videoHeight;
          canvasElement.width = video.videoWidth;
          canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
          const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
          // @ts-ignore
          if (window.jsQR) {
            // @ts-ignore
            const code = window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
            if (code) { handleScanSuccess(code.data); return; }
          }
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(tick);
  }, [isScanning, handleScanSuccess]);

  useEffect(() => {
    if (isScanning && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().then(() => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = requestAnimationFrame(tick);
      });
    }
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [isScanning, stream, tick]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvasElement = document.createElement('canvas');
        const context = canvasElement.getContext('2d');
        if (!context) return;
        canvasElement.width = img.width; canvasElement.height = img.height;
        context.drawImage(img, 0, 0);
        const imageData = context.getImageData(0, 0, canvasElement.width, canvasElement.height);
        // @ts-ignore
        if (window.jsQR) {
          // @ts-ignore
          const code = window.jsQR(imageData.data, imageData.width, imageData.height);
          if (code) handleScanSuccess(code.data);
          else triggerAlert("No QR code found", 'error');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleCheckIn = async () => {
    if (!scannedMeta?.id) return;
    setLoading(true);
    try {
      const role = scannedMeta.role || 'player';

      const rpcRes = await supabase.rpc('check_in_participant', {
        p_item_id: scannedMeta.id,
        p_role: role,
        p_user_id: scannedMeta.userId || null
      });

      if (rpcRes.error) {
        console.warn("RPC check_in_participant error, using fallback:", rpcRes.error.message);
        if (challengeInfo) {
          const isHostRole = role === 'host' || role === 'challenger';
          const updateObj = isHostRole ? { challenger_checked_in: true } : { acceptor_checked_in: true };
          await supabase.from('challenges').update(updateObj).eq('id', challengeInfo.id);
          setChallengeInfo({ ...challengeInfo, ...updateObj });
        } else if (bookingInfo) {
          await bookingService.updateBooking(bookingInfo.id, { checkedIn: true, status: BookingStatus.CONFIRMED });
          setBookingInfo({ ...bookingInfo, checkedIn: true, status: BookingStatus.CONFIRMED });
        }
      } else {
        const data = rpcRes.data;
        if (challengeInfo) {
          setChallengeInfo({
            ...challengeInfo,
            challenger_checked_in: data?.challenger_checked_in ?? challengeInfo.challenger_checked_in,
            acceptor_checked_in: data?.acceptor_checked_in ?? challengeInfo.acceptor_checked_in
          });
        }
      }

      setHasJustConfirmed(true);
      storage.clearPageState(PAGE_ID);
      const name = rpcRes.data?.player_name || participantName || 'Player';
      triggerAlert(`Entry Approved for ${name}!`, 'success');
    } catch (err) {
      triggerAlert(handleError(err).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { return () => { if (stream) stream.getTracks().forEach(t => t.stop()); }; }, [stream]);

  // Determine individual participant check-in status
  const isHostRole = scannedMeta?.role === 'host' || scannedMeta?.role === 'challenger';
  const isAcceptorRole = scannedMeta?.role === 'acceptor' || scannedMeta?.role === 'challengee';

  const isAlreadyCheckedIn = challengeInfo
    ? (isHostRole ? Boolean(challengeInfo.challenger_checked_in) : (isAcceptorRole ? Boolean(challengeInfo.acceptor_checked_in) : Boolean(challengeInfo.status === 'confirmed')))
    : (bookingInfo ? Boolean(bookingInfo.checkedIn || bookingInfo.host_checked_in || bookingInfo.status === BookingStatus.CONFIRMED) : false);

  const participantName = challengeInfo
    ? (isHostRole
        ? (challengeInfo.challenger?.display_name || challengeInfo.challenger?.username || 'Challenger Host')
        : (challengeInfo.acceptor?.display_name || challengeInfo.acceptor?.username || 'Challengee Acceptor'))
    : (bookingInfo ? (bookingInfo.name || 'Player') : 'Participant');

  const participantRoleBadge = isHostRole
    ? 'CHALLENGER (HOST)'
    : (isAcceptorRole ? 'CHALLENGEE (ACCEPTOR)' : (scannedMeta?.role?.toUpperCase() || 'PLAYER'));

  const isValidForCheckIn = (challengeInfo || bookingInfo) && !isAlreadyCheckedIn && !hasJustConfirmed;
  const showSuccessUI = hasJustConfirmed;

  return (
    <div className="max-w-md mx-auto p-5 md:p-4 min-h-screen flex flex-col justify-center relative overflow-hidden transition-all duration-300 bg-background"
         style={{ backgroundColor: theme.colors.background }}>
      <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] rounded-full blur-[120px] pointer-events-none opacity-20 md:block hidden" style={{ backgroundColor: theme.colors.accent }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] rounded-full blur-[120px] pointer-events-none opacity-20 md:block hidden" style={{ backgroundColor: theme.colors.success }} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="backdrop-blur-2xl rounded-[2.5rem] md:rounded-[3.5rem] overflow-hidden border relative z-10 transition-all duration-300 bg-card"
        style={{ borderColor: theme.colors.border, boxShadow: theme.elevation.modal }}
      >
        {/* Header */}
        <div className="p-8 md:p-8 text-center relative border-b border-border/40 md:border-b" style={{ borderColor: `${theme.colors.border}40` }}>
          <div className="absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full opacity-10 pointer-events-none md:hidden bg-accent" />
          <h1 className="text-3xl md:text-3xl font-black italic md:not-italic uppercase tracking-tighter text-text-primary">
            Individual <span style={{ color: theme.colors.accent }}>Scanner</span>
          </h1>
          <div className="flex items-center gap-2 mt-3 bg-white/5 md:bg-white/5 px-4 py-1.5 rounded-full border border-white/5 mx-auto w-fit shadow-sm md:shadow-none">
            <Zap className="w-3.5 h-3.5 text-accent" />
            <p className="text-[10px] md:text-[10px] font-black uppercase tracking-[0.4em] text-text-disabled">Participant Check-In</p>
          </div>
        </div>

        <div className="p-8 md:p-8">
          {loading ? (
            <div className="flex flex-col items-center py-24 md:py-20 animate-in fade-in duration-500">
              <div className="w-20 h-20 border-4 border-t-transparent rounded-full animate-spin border-accent" />
              <p className="text-[10px] font-black mt-10 uppercase tracking-[0.4em] animate-pulse text-accent">Checking In...</p>
            </div>
          ) : !isScanning && !bookingInfo && !challengeInfo ? (
            <div className="flex flex-col items-center">
              <motion.div whileHover={{ scale: 1.02 }} onClick={startCamera}
                          className="w-full aspect-square bg-background-secondary/30 md:bg-white/5 border rounded-[3rem] flex flex-col items-center justify-center mb-8 relative group cursor-pointer overflow-hidden shadow-inner border-border">
                <div className="w-24 h-24 rounded-[2rem] shadow-2xl flex items-center justify-center mb-6 transform group-hover:rotate-6 transition-all bg-accent text-white group-active:scale-90">
                  <QrCode className="w-12 h-12" />
                </div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-text-disabled opacity-40">Ready to Scan</p>
              </motion.div>

              <div className="w-full space-y-4 md:space-y-3">
                <motion.button whileTap={{ scale: 0.98 }} onClick={startCamera}
                               className="w-full py-6 text-white rounded-3xl md:rounded-3xl font-black uppercase tracking-[0.2em] text-xs md:text-[11px] shadow-xl flex items-center justify-center gap-3 transition-all bg-accent active:translate-y-1">
                  <Camera className="w-5 h-5 md:w-4 md:h-4" /> Start Scanner
                </motion.button>
                <motion.button whileTap={{ scale: 0.98 }} onClick={() => fileInputRef.current?.click()}
                               className="w-full py-5 bg-background-secondary/50 md:bg-white/5 border text-text-disabled rounded-3xl md:rounded-3xl font-black uppercase tracking-[0.2em] text-[10px] transition-all flex items-center justify-center gap-3 active:scale-95 border-border">
                  <Upload className="w-4 h-4" /> Upload Ticket QR
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                </motion.button>
              </div>
            </div>
          ) : isScanning ? (
            <div className="flex flex-col items-center">
              <div className="w-full aspect-square bg-black rounded-[3rem] mb-8 overflow-hidden relative border shadow-2xl border-border">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-12 left-12 w-12 h-12 border-t-4 border-l-4 rounded-tl-2xl border-accent" />
                  <div className="absolute top-12 right-12 w-12 h-12 border-t-4 border-r-4 rounded-tr-2xl border-accent" />
                  <div className="absolute bottom-12 left-12 w-12 h-12 border-b-4 border-l-4 rounded-bl-2xl border-accent" />
                  <div className="absolute bottom-12 right-12 w-12 h-12 border-b-4 border-r-4 rounded-br-2xl border-accent" />
                  <motion.div animate={{ top: ['25%', '75%', '25%'] }} transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                              className="absolute left-12 right-12 h-[2px] z-20 bg-accent shadow-[0_0_15px_rgba(249,115,22,0.8)]" />
                </div>
                <div className="absolute bottom-10 left-0 right-0 flex justify-center px-6">
                  <div className="px-6 py-3 rounded-xl border border-white/20 shadow-2xl flex items-center gap-3 bg-accent">
                    <span className="text-[10px] font-black text-white uppercase tracking-[0.3em] italic">{statusMessage}</span>
                  </div>
                </div>
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={stopCamera}
                             className="px-8 py-4 bg-error/10 border border-error/20 text-error rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-90">
                Cancel Scan
              </motion.button>
            </div>
          ) : (
            <div className="space-y-8 md:space-y-6 text-center animate-in zoom-in-95 duration-500">
              <div className={`p-10 md:p-10 rounded-[2.5rem] md:rounded-[2.5rem] border transition-all duration-500 shadow-inner`}
                   style={{
                     backgroundColor: `${showSuccessUI || isValidForCheckIn ? theme.colors.success : theme.colors.error}10`,
                     borderColor: `${showSuccessUI || isValidForCheckIn ? theme.colors.success : theme.colors.error}30`
                   }}>
                <motion.div initial={{ scale: 0.5, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} className={`w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center shadow-2xl text-white`}
                            style={{ backgroundColor: (showSuccessUI || isValidForCheckIn) ? theme.colors.success : '#f59e0b' }}>
                  {(showSuccessUI || isValidForCheckIn) ? <CheckCircle2 className="w-10 h-10" /> : <AlertCircle className="w-10 h-10" />}
                </motion.div>
                <h3 className={`text-3xl md:text-3xl font-black italic md:not-italic uppercase tracking-tighter text-text-primary`}>
                  {showSuccessUI ? 'ENTRY APPROVED' : (isAlreadyCheckedIn ? 'ALREADY SCANNED' : 'READY FOR ENTRY')}
                </h3>
                {isAlreadyCheckedIn && !showSuccessUI && (
                   <p className="mt-4 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-warning bg-warning/10 py-3 rounded-xl border border-warning/20 mx-2">
                     NOTICE: This player has already checked in.
                   </p>
                )}
              </div>

              <div className="p-8 md:p-8 space-y-5 border border-border shadow-inner transition-all bg-background-secondary/40 rounded-[2rem]"
                   style={{ borderColor: `${theme.colors.border}20` }}>
                <div className="flex flex-col gap-1 border-b pb-4 border-border/20">
                  <span className="text-[9px] font-black uppercase tracking-widest text-text-disabled opacity-60">Ticket Holder</span>
                  <span className="font-black italic text-xl text-text-primary">{participantName}</span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-accent mt-1">{participantRoleBadge}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-text-disabled opacity-60">Slot Time</span>
                  <span className="font-black italic text-lg text-text-primary">{bookingInfo ? bookingInfo.slotTime : challengeInfo?.slot_time}</span>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                {isValidForCheckIn ? (
                  <motion.button whileTap={{ scale: 0.98 }} onClick={handleCheckIn}
                                 className="w-full py-6 text-white rounded-3xl font-black uppercase tracking-[0.2em] text-xs shadow-xl transition-all bg-success active:translate-y-1">
                    Approve Player Entry
                  </motion.button>
                ) : (
                  <motion.button whileTap={{ scale: 0.98 }} onClick={() => { setBookingInfo(null); setChallengeInfo(null); setScannedMeta(null); storage.clearPageState(PAGE_ID); }}
                                 className="w-full py-6 rounded-3xl font-black uppercase tracking-[0.2em] text-xs shadow-2xl text-white transition-all bg-accent active:translate-y-1">
                    Scan Next Ticket
                  </motion.button>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Scanner;

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Booking, Location } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { Download, X, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface QRCodeModalProps {
  booking: Booking | null;
  location: Location;
  onClose: () => void;
  onAlert?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ booking, location, onClose, onAlert }) => {
  const { theme } = useTheme();
  const ticketRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const triggerAlert = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (onAlert) onAlert(msg, type);
  };

  useEffect(() => {
    if (!(window as any).html2canvas) {
      const scriptHtml2 = document.createElement('script');
      scriptHtml2.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      scriptHtml2.async = true;
      document.body.appendChild(scriptHtml2);
    }
  }, []);

  const tickets = useMemo(() => {
    if (!booking) return [];
    if (Array.isArray((booking as any).tickets) && (booking as any).tickets.length > 0) {
      return (booking as any).tickets;
    }
    return [{
      id: booking.id,
      qrNo: 'QR #1',
      ticketNumber: 1,
      groupSize: (booking as any).groupSize || '1 Ticket',
      slotTime: booking.slotTime || (booking as any).slot_time || 'N/A',
      date: booking.date,
      holderName: (booking as any).holderName || booking.name || 'Player',
      role: (booking as any).role,
      qrData: (booking as any).qrData || booking.id,
      participantCheckedIn: Boolean((booking as any).participantCheckedIn || booking.checkedIn || (booking as any).checked_in),
      status: booking.status || 'booked'
    }];
  }, [booking]);

  useEffect(() => {
    const initIdx = (booking as any)?.initialIndex;
    if (typeof initIdx === 'number' && initIdx >= 0 && initIdx < tickets.length) {
      setCurrentIndex(initIdx);
    } else {
      setCurrentIndex(0);
    }
  }, [booking, tickets]);

  if (!booking || tickets.length === 0) return null;

  const activeTicket = tickets[currentIndex] || tickets[0];

  const shareFile = async (blob: Blob, fileName: string) => {
    try {
      const file = new File([blob], fileName, { type: blob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Booking Ticket', text: 'Boxitt Ticket' });
        return true;
      }
    } catch (err) {}
    return false;
  };

  const downloadJPG = async () => {
    if (!ticketRef.current) return;
    const html2canvas = (window as any).html2canvas;
    if (!html2canvas) return triggerAlert("Engine loading...", 'info');
    try {
      const canvas = await html2canvas(ticketRef.current, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
      const fileName = `Boxitt-Ticket-${activeTicket.qrNo || 'QR'}-${activeTicket.id || booking.id}.jpg`;
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      triggerAlert("Ticket downloaded as JPG!", 'success');
    } catch (err) {
      triggerAlert("Failed to save image", 'error');
    }
  };

  const shareJPG = async () => {
    if (!ticketRef.current) return;
    const html2canvas = (window as any).html2canvas;
    if (!html2canvas) return triggerAlert("Engine loading...", 'info');
    try {
      const canvas = await html2canvas(ticketRef.current, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
      const fileName = `Boxitt-Ticket-${activeTicket.qrNo || 'QR'}-${activeTicket.id || booking.id}.jpg`;
      canvas.toBlob(async (blob: Blob | null) => {
        if (!blob) {
          triggerAlert("Failed to generate ticket image", 'error');
          return;
        }
        const shared = await shareFile(blob, fileName);
        if (!shared) {
          const link = document.createElement('a');
          link.href = canvas.toDataURL('image/jpeg', 0.95);
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          triggerAlert("Sharing not supported, ticket downloaded as JPG instead", 'info');
        }
      }, 'image/jpeg', 0.95);
    } catch (err) {
      triggerAlert("Failed to share image", 'error');
    }
  };

  const backdropBg = theme.name === 'light' ? 'rgba(15, 23, 42, 0.4)' : 'rgba(0, 0, 0, 0.8)';

  const rawStatus = String(activeTicket.status || booking.status || '').toLowerCase();
  const isParticipantCheckedIn = Boolean(activeTicket.participantCheckedIn);
  const isConfirmed = rawStatus === 'confirmed' || isParticipantCheckedIn;

  const statusDisplay = isConfirmed ? 'CONFIRMED' : (rawStatus === 'timed_out' ? 'TIMED OUT' : 'BOOKED');
  const statusColor = isConfirmed ? theme.colors.success : (rawStatus === 'timed_out' ? theme.colors.warning : theme.colors.accent);

  const qrData = activeTicket.qrData || booking.id;
  const holderName = activeTicket.holderName || booking.name || 'Player';
  const role = activeTicket.role || (booking as any).role;
  const qrNoLabel = activeTicket.qrNo || `QR #${currentIndex + 1}`;
  const groupSizeLabel = activeTicket.groupSize ? ` • ${activeTicket.groupSize}` : '';

  const handleNext = () => {
    if (currentIndex < tickets.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-y-auto no-scrollbar">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 backdrop-blur-md transition-colors duration-300"
        style={{ backgroundColor: backdropBg }}
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="w-full max-w-[340px] relative z-10 my-auto flex flex-col items-center"
      >
        {/* Slider Controls Bar if multiple tickets */}
        {tickets.length > 1 && (
          <div className="w-full flex items-center justify-between mb-3 px-3 py-2 rounded-2xl bg-card border border-border shadow-lg"
               style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className={`p-2 rounded-xl transition-all ${currentIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-accent/20 active:scale-95 cursor-pointer'}`}
              style={{ color: theme.colors.accent }}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="text-center">
              <span className="text-xs font-black uppercase tracking-wider block" style={{ color: theme.colors.textPrimary }}>
                {qrNoLabel} <span style={{ color: theme.colors.accent }}>({currentIndex + 1}/{tickets.length})</span>
              </span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-text-disabled">
                {activeTicket.groupSize || '1 Player'}
              </span>
            </div>

            <button
              onClick={handleNext}
              disabled={currentIndex === tickets.length - 1}
              className={`p-2 rounded-xl transition-all ${currentIndex === tickets.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-accent/20 active:scale-95 cursor-pointer'}`}
              style={{ color: theme.colors.accent }}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            <div
              ref={ticketRef}
              className="w-full relative shadow-2xl overflow-hidden"
              style={{
                backgroundColor: theme.colors.card,
                borderRadius: '2rem',
                clipPath: 'polygon(0% 0%, 100% 0%, 100% 68%, 95% 70%, 100% 72%, 100% 100%, 0% 100%, 0% 72%, 5% 70%, 0% 68%)'
              }}
            >
              {/* Top side cutouts simulation */}
              <div className="absolute top-[70%] left-[-16px] w-8 h-8 rounded-full z-20" style={{ backgroundColor: backdropBg }} />
              <div className="absolute top-[70%] right-[-16px] w-8 h-8 rounded-full z-20" style={{ backgroundColor: backdropBg }} />

              <div className="p-5 sm:p-6 flex flex-col items-center">
                {/* Header */}
                <div className="w-full flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[9px] font-black uppercase tracking-[0.3em]" style={{ color: theme.colors.accent }}>
                        Arena Ticket
                      </p>
                      {tickets.length > 1 && (
                        <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-accent text-white uppercase tracking-wider">
                          {qrNoLabel}
                        </span>
                      )}
                    </div>
                    <h3 className="font-black uppercase italic tracking-tighter text-xl leading-none mt-1" style={{ color: theme.colors.textPrimary }}>
                      {location.name}
                    </h3>
                  </div>
                  <button onClick={onClose} className="p-1.5 rounded-xl border cursor-pointer" style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border, color: theme.colors.textDisabled }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* QR Code */}
                <div className="mb-3 p-4 bg-white rounded-[2rem] border border-blue-50 shadow-inner flex justify-center">
                  <img crossOrigin="anonymous" src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrData)}`} alt="QR" className="w-32 h-32 sm:w-36 sm:h-32" />
                </div>

                {/* Time & Date */}
                <div className="text-center mb-2">
                  <h4 className="text-xl sm:text-2xl font-black italic tracking-tighter uppercase leading-none mb-1" style={{ color: theme.colors.textPrimary }}>
                    {activeTicket.slotTime || booking.slotTime || (booking as any).slot_time || 'N/A'}
                  </h4>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: theme.colors.accent }}>
                    {activeTicket.date || booking.date}
                  </p>
                </div>

                {/* Holder & Role */}
                <div className="w-full flex justify-between items-center my-1 px-1">
                  <div className="text-left">
                    <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: theme.colors.textDisabled }}>Ticket Holder</p>
                    <p className="font-black text-xs uppercase" style={{ color: theme.colors.textPrimary }}>
                      {holderName} {groupSizeLabel}
                    </p>
                  </div>
                  {role && (
                    <div className="text-right">
                      <span className="text-[7px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                        {role}
                      </span>
                    </div>
                  )}
                </div>

                {/* Perforation Line */}
                <div className="w-full border-t border-dashed my-3 opacity-30" style={{ borderColor: theme.colors.textDisabled }} />

                {/* Status & ID */}
                <div className="w-full flex justify-between items-end mt-1 mb-2">
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest mb-1" style={{ color: theme.colors.textDisabled }}>Status</p>
                    <p className="font-black text-xs uppercase" style={{ color: statusColor }}>
                      {statusDisplay}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black uppercase tracking-widest mb-1" style={{ color: theme.colors.textDisabled }}>Ticket / Booking ID</p>
                    <p className="font-mono font-bold text-[9px]" style={{ color: theme.colors.textPrimary }}>
                      {String(activeTicket.id || booking.id).substring(0, 12)}...
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Carousel Dot Indicators */}
        {tickets.length > 1 && (
          <div className="flex items-center gap-1.5 my-3">
            {tickets.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${idx === currentIndex ? 'w-6 bg-accent' : 'w-2 bg-text-disabled/40'}`}
              />
            ))}
          </div>
        )}

        {/* Footer Actions */}
        <div className="w-full mt-4 grid grid-cols-2 gap-3">
          <button onClick={downloadJPG} className="py-4 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 shadow-xl hover:scale-105 transition-transform border-2 cursor-pointer"
                  style={{ backgroundColor: theme.colors.card, color: theme.colors.accent, borderColor: theme.colors.border }}>
            <Download className="w-4 h-4" /> Download
          </button>
          <button onClick={shareJPG} className="py-4 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 shadow-xl hover:scale-105 transition-transform border-2 cursor-pointer"
                  style={{ backgroundColor: theme.colors.card, color: theme.colors.accent, borderColor: theme.colors.border }}>
            <Share2 className="w-4 h-4" /> Share Ticket
          </button>
        </div>

        <button onClick={onClose} className="mt-5 font-black uppercase text-[11px] tracking-widest opacity-60 hover:opacity-100 transition-opacity cursor-pointer" style={{ color: theme.colors.textPrimary }}>
          Dismiss
        </button>
      </motion.div>
    </div>
  );
};

export default QRCodeModal;

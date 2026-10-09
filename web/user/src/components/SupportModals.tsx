import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Send, 
  Copy, 
  Check, 
  Share2, 
  Star, 
  Sparkles, 
  ShieldCheck, 
  FileText, 
  Bot, 
  User, 
  Gift
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ModalBaseProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── LIVE CHAT MODAL ────────────────────────────────────────────────────────
export const LiveChatModal: React.FC<ModalBaseProps & { onAlert?: (msg: string, type: 'success' | 'error' | 'info') => void }> = ({ isOpen, onClose }) => {
  const { theme } = useTheme();
  const [messages, setMessages] = useState<Array<{ id: string; text: string; sender: 'user' | 'agent'; time: string }>>([
    {
      id: '1',
      text: 'Hello! 👋 Welcome to Boxitt Support. How can we assist you with your booking, turf, or profile today?',
      sender: 'agent',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;

    const userMsg = {
      id: Date.now().toString(),
      text: input.trim(),
      sender: 'user' as const,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: "Thanks for reaching out! Our support executive has received your message and will respond shortly. For urgent inquiries, you can also reach us via Call Support.",
          sender: 'agent',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-lg rounded-theme-lg border overflow-hidden flex flex-col h-[560px] shadow-2xl"
          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
        >
          {/* Header */}
          <div className="p-4 border-b flex items-center justify-between" style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${theme.colors.accent}20`, color: theme.colors.accent }}>
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight" style={{ color: theme.colors.textPrimary }}>Boxitt Support Chat</h3>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold" style={{ color: theme.colors.textSecondary }}>Online • Typically replies in 2m</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:opacity-80 transition-opacity"
              style={{ color: theme.colors.textSecondary }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3" style={{ backgroundColor: theme.colors.background }}>
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.sender === 'agent' && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ backgroundColor: theme.colors.accent, color: '#fff' }}>
                    B
                  </div>
                )}
                <div
                  className={`max-w-[75%] p-3 rounded-2xl text-xs font-medium ${
                    m.sender === 'user' ? 'rounded-br-none text-white' : 'rounded-bl-none shadow-sm'
                  }`}
                  style={
                    m.sender === 'user'
                      ? { backgroundColor: theme.colors.accent }
                      : { backgroundColor: theme.colors.card, color: theme.colors.textPrimary, border: `1px solid ${theme.colors.border}` }
                  }
                >
                  <p className="leading-relaxed">{m.text}</p>
                  <span className="text-[9px] block mt-1 opacity-70 text-right">{m.time}</span>
                </div>
                {m.sender === 'user' && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary }}>
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="flex items-center gap-2 text-xs font-bold" style={{ color: theme.colors.textSecondary }}>
                <span className="animate-bounce">●</span>
                <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>●</span>
                <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>●</span>
                <span className="text-[10px] uppercase ml-1">Support typing...</span>
              </div>
            )}
          </div>

          {/* Input Box */}
          <form onSubmit={handleSend} className="p-3 border-t flex items-center gap-2" style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2.5 text-xs font-medium rounded-xl outline-none border focus:border-accent"
              style={{
                backgroundColor: theme.colors.backgroundSecondary,
                borderColor: theme.colors.border,
                color: theme.colors.textPrimary
              }}
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="p-2.5 rounded-xl text-white disabled:opacity-40 transition-all active:scale-95"
              style={{ backgroundColor: theme.colors.accent }}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// ─── INVITE FRIENDS MODAL ───────────────────────────────────────────────────
export const InviteFriendsModal: React.FC<ModalBaseProps & { onAlert?: (msg: string, type: 'success' | 'error' | 'info') => void }> = ({ isOpen, onClose, onAlert }) => {
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);
  const referralCode = 'BOXITT-WIN50';
  const referralLink = `${window.location.origin}/login?ref=${referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    onAlert?.('Referral link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on Boxitt!',
          text: `Use my code ${referralCode} to get ₹100 wallet credits on your first turf booking!`,
          url: referralLink
        });
      } catch {}
    } else {
      handleCopy();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-md rounded-theme-lg border p-6 text-center shadow-2xl relative"
          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:opacity-80"
            style={{ color: theme.colors.textSecondary }}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg" style={{ backgroundColor: `${theme.colors.accent}20`, color: theme.colors.accent }}>
            <Gift className="w-8 h-8" />
          </div>

          <h3 className="text-xl font-black uppercase italic tracking-tight mb-2" style={{ color: theme.colors.textPrimary }}>Invite Friends & Earn</h3>
          <p className="text-xs font-bold leading-relaxed mb-6" style={{ color: theme.colors.textSecondary }}>
            Share your link with sports buddies. When they make their first turf booking, you both get <span className="text-emerald-500 font-extrabold">₹100 wallet credits</span>!
          </p>

          <div className="p-3.5 rounded-2xl border flex items-center justify-between mb-4" style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}>
            <div className="text-left">
              <span className="text-[9px] font-black uppercase tracking-wider block opacity-60" style={{ color: theme.colors.textSecondary }}>Your Referral Code</span>
              <span className="text-sm font-black tracking-widest" style={{ color: theme.colors.accent }}>{referralCode}</span>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={{ backgroundColor: theme.colors.card, color: theme.colors.textPrimary, border: `1px solid ${theme.colors.border}` }}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleShare}
              className="flex-1 py-3.5 rounded-xl text-white font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
              style={{ backgroundColor: theme.colors.accent }}
            >
              <Share2 className="w-4 h-4" />
              Share Link
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// ─── RATE APP MODAL ─────────────────────────────────────────────────────────
export const RateAppModal: React.FC<ModalBaseProps & { onAlert?: (msg: string, type: 'success' | 'error' | 'info') => void }> = ({ isOpen, onClose, onAlert }) => {
  const { theme } = useTheme();
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    setSubmitted(true);
    onAlert?.('Thank you for rating Boxitt!', 'success');
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-sm rounded-theme-lg border p-6 text-center shadow-2xl relative"
          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:opacity-80"
            style={{ color: theme.colors.textSecondary }}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center shadow-lg bg-amber-500/20 text-amber-500">
            <Sparkles className="w-7 h-7" />
          </div>

          <h3 className="text-lg font-black uppercase italic tracking-tight mb-1" style={{ color: theme.colors.textPrimary }}>Rate Boxitt App</h3>
          <p className="text-xs font-bold mb-4" style={{ color: theme.colors.textSecondary }}>Your feedback helps us deliver the best turf & scoring experience!</p>

          <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="p-1 hover:scale-125 transition-transform"
              >
                <Star
                  className={`w-8 h-8 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-400'}`}
                />
              </button>
            ))}
          </div>

          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Tell us what you love or how we can improve..."
            rows={3}
            className="w-full p-3 rounded-xl text-xs font-medium border mb-4 outline-none resize-none"
            style={{
              backgroundColor: theme.colors.backgroundSecondary,
              borderColor: theme.colors.border,
              color: theme.colors.textPrimary
            }}
          />

          <button
            onClick={handleSubmit}
            disabled={submitted}
            className="w-full py-3 rounded-xl text-white font-black uppercase text-xs tracking-wider shadow-lg transition-transform active:scale-95"
            style={{ backgroundColor: theme.colors.accent }}
          >
            {submitted ? 'Submitted! Thank you' : 'Submit Review'}
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// ─── TERMS OF SERVICE MODAL ─────────────────────────────────────────────────
export const TermsModal: React.FC<ModalBaseProps> = ({ isOpen, onClose }) => {
  const { theme } = useTheme();
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-2xl rounded-theme-lg border overflow-hidden flex flex-col max-h-[80vh] shadow-2xl"
          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
        >
          <div className="p-5 border-b flex items-center justify-between" style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}>
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5" style={{ color: theme.colors.accent }} />
              <h3 className="text-base font-black uppercase italic tracking-tight" style={{ color: theme.colors.textPrimary }}>Terms of Service</h3>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:opacity-80" style={{ color: theme.colors.textSecondary }}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 p-6 overflow-y-auto space-y-4 text-xs leading-relaxed font-medium" style={{ color: theme.colors.textSecondary, backgroundColor: theme.colors.background }}>
            <h4 className="font-black text-sm uppercase tracking-wide" style={{ color: theme.colors.textPrimary }}>1. Acceptance of Terms</h4>
            <p>By downloading, accessing, or using Boxitt, you agree to be bound by these Terms of Service. If you do not agree, please do not use the service.</p>

            <h4 className="font-black text-sm uppercase tracking-wide" style={{ color: theme.colors.textPrimary }}>2. Turf Bookings & Cancellations</h4>
            <p>All slot reservations are subject to arena availability. Cancellations and refund policies vary per arena partner as indicated on the booking confirmation receipt.</p>

            <h4 className="font-black text-sm uppercase tracking-wide" style={{ color: theme.colors.textPrimary }}>3. Fair Play & Community Guidelines</h4>
            <p>Boxitt fosters an inclusive and respectful sports community. Any misconduct, abuse, or violation of arena safety rules may result in account suspension.</p>

            <h4 className="font-black text-sm uppercase tracking-wide" style={{ color: theme.colors.textPrimary }}>4. Scoring & Tournament Integrity</h4>
            <p>Live scores, leaderboards, and tournament statistics are recorded for competitive fairness. Tampering with scorekeeper records will invalidate player stats.</p>
          </div>

          <div className="p-4 border-t flex justify-end" style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-white font-black uppercase text-xs tracking-wider"
              style={{ backgroundColor: theme.colors.accent }}
            >
              I Understand
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// ─── PRIVACY POLICY MODAL ───────────────────────────────────────────────────
export const PrivacyPolicyModal: React.FC<ModalBaseProps> = ({ isOpen, onClose }) => {
  const { theme } = useTheme();
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-2xl rounded-theme-lg border overflow-hidden flex flex-col max-h-[80vh] shadow-2xl"
          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
        >
          <div className="p-5 border-b flex items-center justify-between" style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}>
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <h3 className="text-base font-black uppercase italic tracking-tight" style={{ color: theme.colors.textPrimary }}>Privacy Policy</h3>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:opacity-80" style={{ color: theme.colors.textSecondary }}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 p-6 overflow-y-auto space-y-4 text-xs leading-relaxed font-medium" style={{ color: theme.colors.textSecondary, backgroundColor: theme.colors.background }}>
            <h4 className="font-black text-sm uppercase tracking-wide" style={{ color: theme.colors.textPrimary }}>1. Information We Collect</h4>
            <p>We collect information such as your name, phone number, email address, profile picture, location, and match booking activity to deliver seamless turf bookings and scoring.</p>

            <h4 className="font-black text-sm uppercase tracking-wide" style={{ color: theme.colors.textPrimary }}>2. How We Protect Your Data</h4>
            <p>Your data is encrypted both in transit and at rest with row-level security. We never sell your personal information or contact details to third parties.</p>

            <h4 className="font-black text-sm uppercase tracking-wide" style={{ color: theme.colors.textPrimary }}>3. Location Data Usage</h4>
            <p>We use your current coordinates only when permitted to locate nearby sports arenas and provide accurate route directions.</p>
          </div>

          <div className="p-4 border-t flex justify-end" style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-white font-black uppercase text-xs tracking-wider"
              style={{ backgroundColor: theme.colors.accent }}
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

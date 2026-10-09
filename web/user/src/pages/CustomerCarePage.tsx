import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ChevronLeft, 
  Phone, 
  MessageSquare, 
  Mail, 
  Clock, 
  HelpCircle, 
  Send, 
  CheckCircle2, 
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { LiveChatModal } from '../components/SupportModals';

interface CustomerCarePageProps {
  onAlert?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function CustomerCarePage({ onAlert }: CustomerCarePageProps) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [showLiveChat, setShowLiveChat] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Form State
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketSubmitted, setTicketSubmitted] = useState(false);

  const faqs = [
    {
      q: 'How do I cancel or reschedule a turf booking?',
      a: 'Go to your Bookings History tab. If the match has not started and is within the arena\'s cancellation window, click "Cancel Booking" or contact support directly.'
    },
    {
      q: 'When do I receive my refund for cancelled bookings?',
      a: 'Online payments are processed back to the original source or Boxitt wallet within 24 to 48 business hours.'
    },
    {
      q: 'How does the Player Score and Level system work?',
      a: 'Your score increases through matches played, fair play feedback, tournament victories, and consistency bonuses.'
    },
    {
      q: 'Can I host private tournaments or corporate leagues?',
      a: 'Yes! Reach out to us via Email at support@boxitt.app or Call Support, and our team will coordinate custom multi-turf scheduling.'
    }
  ];

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      onAlert?.('Please fill out both subject and message.', 'error');
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setTicketSubmitted(true);
      setSubject('');
      setMessage('');
      onAlert?.('Support ticket submitted successfully!', 'success');
      setTimeout(() => setTicketSubmitted(false), 3000);
    }, 1000);
  };

  return (
    <div className="min-h-screen py-6 px-4 md:px-8 max-w-4xl mx-auto space-y-8 transition-colors duration-300">
      {/* Top Bar */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2.5 rounded-full border shadow-sm transition-all hover:scale-105 active:scale-95"
          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.textPrimary }}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight" style={{ color: theme.colors.textPrimary }}>
            Customer Care
          </h1>
          <p className="text-xs font-semibold" style={{ color: theme.colors.textSecondary }}>
            We're here 24/7 to support your games, turfs, and bookings
          </p>
        </div>
      </div>

      {/* Support Channels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Call Support */}
        <a
          href="tel:+919876543210"
          className="rounded-3xl p-6 border shadow-sm flex flex-col items-center text-center group transition-all hover:-translate-y-1"
          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform">
            <Phone className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-black uppercase tracking-wide mb-1" style={{ color: theme.colors.textPrimary }}>
            Call Support
          </h3>
          <p className="text-xs font-semibold mb-2" style={{ color: theme.colors.textSecondary }}>
            Mon-Sun, 8am - 10pm
          </p>
          <span className="text-xs font-black text-emerald-500 tracking-wider">+91 98765 43210</span>
        </a>

        {/* Live Chat */}
        <button
          type="button"
          onClick={() => setShowLiveChat(true)}
          className="rounded-3xl p-6 border shadow-sm flex flex-col items-center text-center group transition-all hover:-translate-y-1"
          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-black uppercase tracking-wide mb-1" style={{ color: theme.colors.textPrimary }}>
            Live Chat
          </h3>
          <p className="text-xs font-semibold mb-2" style={{ color: theme.colors.textSecondary }}>
            Avg. reply time ~ 2 mins
          </p>
          <span className="text-xs font-black text-blue-500 tracking-wider">Start Conversation</span>
        </button>

        {/* Email Support */}
        <a
          href="mailto:support@boxitt.app"
          className="rounded-3xl p-6 border shadow-sm flex flex-col items-center text-center group transition-all hover:-translate-y-1"
          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-purple-500/10 text-purple-500 group-hover:scale-110 transition-transform">
            <Mail className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-black uppercase tracking-wide mb-1" style={{ color: theme.colors.textPrimary }}>
            Email Us
          </h3>
          <p className="text-xs font-semibold mb-2" style={{ color: theme.colors.textSecondary }}>
            24h turnaround time
          </p>
          <span className="text-xs font-black text-purple-500 tracking-wider">support@boxitt.app</span>
        </a>
      </div>

      {/* Ticket Submission Form */}
      <div
        className="rounded-3xl p-6 md:p-8 border shadow-sm space-y-6"
        style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
      >
        <div>
          <h2 className="text-lg font-black uppercase tracking-tight" style={{ color: theme.colors.textPrimary }}>
            Submit a Support Ticket
          </h2>
          <p className="text-xs font-medium mt-1" style={{ color: theme.colors.textSecondary }}>
            Have a specific issue with a booking or scorekeeper? Describe it below and our team will investigate.
          </p>
        </div>

        <form onSubmit={handleSubmitTicket} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-wider block" style={{ color: theme.colors.textSecondary }}>
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Issue with Turf Booking #BK-902"
              className="w-full px-4 py-3 rounded-2xl text-xs font-semibold outline-none border focus:border-accent"
              style={{
                backgroundColor: theme.colors.backgroundSecondary,
                borderColor: theme.colors.border,
                color: theme.colors.textPrimary
              }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-wider block" style={{ color: theme.colors.textSecondary }}>
              Message Details
            </label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Provide as much detail as possible..."
              className="w-full p-4 rounded-2xl text-xs font-semibold outline-none border focus:border-accent resize-none"
              style={{
                backgroundColor: theme.colors.backgroundSecondary,
                borderColor: theme.colors.border,
                color: theme.colors.textPrimary
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-3.5 rounded-2xl text-white font-black uppercase text-xs tracking-wider shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
            style={{ backgroundColor: theme.colors.accent }}
          >
            {isSubmitting ? (
              <span>Submitting...</span>
            ) : ticketSubmitted ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Ticket Sent!
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit Ticket
              </>
            )}
          </button>
        </form>
      </div>

      {/* FAQs Section */}
      <div
        className="rounded-3xl p-6 md:p-8 border shadow-sm space-y-4"
        style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
      >
        <div className="flex items-center gap-2.5">
          <HelpCircle className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-black uppercase tracking-tight" style={{ color: theme.colors.textPrimary }}>
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-2 pt-2">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-2xl border overflow-hidden"
              style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}
            >
              <button
                type="button"
                onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                className="w-full p-4 flex items-center justify-between text-left text-xs font-black"
                style={{ color: theme.colors.textPrimary }}
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${activeFaq === idx ? 'rotate-180 text-accent' : 'opacity-60'}`}
                />
              </button>
              {activeFaq === idx && (
                <div className="px-4 pb-4 text-xs font-medium leading-relaxed" style={{ color: theme.colors.textSecondary }}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <LiveChatModal
        isOpen={showLiveChat}
        onClose={() => setShowLiveChat(false)}
        onAlert={onAlert}
      />
    </div>
  );
}

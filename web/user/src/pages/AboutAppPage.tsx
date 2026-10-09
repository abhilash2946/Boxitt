import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  Info,
  ShieldCheck,
  FileText,
  Star,
  CheckCircle2,
  ExternalLink,
  Code,
  Heart,
  Sparkles,
  Smartphone
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { 
  TermsModal, 
  PrivacyPolicyModal, 
  RateAppModal 
} from '../components/SupportModals';

interface AboutAppPageProps {
  onAlert?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function AboutAppPage({ onAlert }: AboutAppPageProps) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showRate, setShowRate] = useState(false);

  const releaseNotes = [
    {
      version: 'v2.4.1 (Current)',
      date: 'August 2026',
      changes: [
        'Brand new unified profile dashboard & real-time stats overview',
        'Direct live chat customer care and support ticket system',
        'Enhanced dynamic theme customization across Boxitt Green, Dark & Light',
        'Multi-sport live scoring integration (Box Cricket, Football, Badminton, Swimming, Tennis, Basketball)'
      ]
    },
    {
      version: 'v2.3.0',
      date: 'July 2026',
      changes: [
        'Instant QR check-in scanner for arena managers',
        'Advanced booking conflict validation & refund automation',
        'Geo-location nearby turf discovery with interactive maps'
      ]
    }
  ];

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
            About Boxitt
          </h1>
          <p className="text-xs font-semibold" style={{ color: theme.colors.textSecondary }}>
            App information, legal terms, and release history
          </p>
        </div>
      </div>

      {/* App Hero / Brand Card */}
      <div
        className="rounded-3xl p-8 border shadow-sm flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left"
        style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
      >
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center p-3 shadow-lg bg-emerald-500/15 border border-emerald-500/30">
          <img src="/logo.png" alt="Boxitt Logo" className="w-full h-full object-contain" onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }} />
          <Smartphone className="w-10 h-10 text-emerald-500" />
        </div>
        <div className="space-y-1.5 flex-1">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
            <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: theme.colors.textPrimary }}>
              Boxitt Sports Platform
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-600 border border-emerald-500/30">
              v2.4.1
            </span>
          </div>
          <p className="text-xs font-semibold leading-relaxed" style={{ color: theme.colors.textSecondary }}>
            Boxitt is the premier turf reservation, live multi-sport scoring, and player community platform. Connect with sports enthusiasts and play your best games.
          </p>
        </div>
      </div>

      {/* Quick Action Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Terms */}
        <button
          onClick={() => setShowTerms(true)}
          className="p-5 rounded-3xl border shadow-sm flex items-center gap-4 text-left transition-all hover:-translate-y-1"
          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-blue-500/10 text-blue-500 flex-shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wide" style={{ color: theme.colors.textPrimary }}>
              Terms of Service
            </h3>
            <span className="text-[11px] font-medium" style={{ color: theme.colors.textSecondary }}>
              User agreement & rules
            </span>
          </div>
        </button>

        {/* Privacy */}
        <button
          onClick={() => setShowPrivacy(true)}
          className="p-5 rounded-3xl border shadow-sm flex items-center gap-4 text-left transition-all hover:-translate-y-1"
          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-emerald-500/10 text-emerald-500 flex-shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wide" style={{ color: theme.colors.textPrimary }}>
              Privacy Policy
            </h3>
            <span className="text-[11px] font-medium" style={{ color: theme.colors.textSecondary }}>
              Data security & rights
            </span>
          </div>
        </button>

        {/* Rate Boxitt */}
        <button
          onClick={() => setShowRate(true)}
          className="p-5 rounded-3xl border shadow-sm flex items-center gap-4 text-left transition-all hover:-translate-y-1"
          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-amber-500/10 text-amber-500 flex-shrink-0">
            <Star className="w-5 h-5 fill-amber-500" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wide" style={{ color: theme.colors.textPrimary }}>
              Rate Boxitt
            </h3>
            <span className="text-[11px] font-medium" style={{ color: theme.colors.textSecondary }}>
              Share your review
            </span>
          </div>
        </button>
      </div>

      {/* Release Notes */}
      <div
        className="rounded-3xl p-6 md:p-8 border shadow-sm space-y-6"
        style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-black uppercase tracking-tight" style={{ color: theme.colors.textPrimary }}>
            What's New in Boxitt
          </h2>
        </div>

        <div className="space-y-6">
          {releaseNotes.map((note, idx) => (
            <div key={idx} className="space-y-3 pb-4 border-b last:border-0" style={{ borderColor: theme.colors.border }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-black" style={{ color: theme.colors.textPrimary }}>{note.version}</span>
                <span className="text-xs font-bold" style={{ color: theme.colors.textSecondary }}>{note.date}</span>
              </div>
              <ul className="space-y-2">
                {note.changes.map((change, cIdx) => (
                  <li key={cIdx} className="flex items-start gap-2.5 text-xs font-medium" style={{ color: theme.colors.textSecondary }}>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Footer / Copyright */}
      <div className="text-center space-y-2 pt-4 pb-8">
        <p className="text-xs font-black uppercase tracking-widest" style={{ color: theme.colors.textSecondary }}>
          Boxitt Technologies © {new Date().getFullYear()} • Crafted with passion for sports
        </p>
      </div>

      <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
      <PrivacyPolicyModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
      <RateAppModal isOpen={showRate} onClose={() => setShowRate(false)} onAlert={onAlert} />
    </div>
  );
}

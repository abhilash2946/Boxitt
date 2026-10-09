import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Bell, FileUp, ShieldCheck, MapPin, Loader2, CheckCircle2, ChevronRight, Settings, Info } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useTheme } from '../contexts/ThemeContext';
import { PermissionType } from '../contexts/PermissionsContext';
import { PermissionChoice } from '../services/storage';

interface PermissionPromptProps {
  type: PermissionType;
  onChoice: (choice: PermissionChoice) => Promise<boolean>;
  onClose: () => void;
}

type PromptState = 'initial' | 'requesting' | 'success' | 'blocked' | 'instructions';

const PermissionPrompt: React.FC<PermissionPromptProps> = ({ type, onChoice, onClose }) => {
  // On Web browsers, file permissions are not required for downloads.
  // Bypass showing the files prompt on Web while keeping Android native support intact.
  if (type === 'files' && !Capacitor.isNativePlatform()) {
    return null;
  }

  const { theme } = useTheme();
  const [state, setState] = useState<PromptState>('initial');

  // Reset state whenever the type changes to handle the onboarding sequence correctly
  React.useEffect(() => {
    setState('initial');
  }, [type]);

  const config = {
    camera: { name: 'camera', title: 'Camera', icon: Camera },
    notifications: { name: 'notifications', title: 'Notifications', icon: Bell },
    files: { name: 'files', title: 'Files', icon: FileUp },
    location: { name: 'location', title: 'Location', icon: MapPin }
  }[type];

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);
  const hostname = window.location.hostname || 'boxitt.vercel.app';

  const handleAction = async (choice: PermissionChoice) => {
    if (choice === 'allow' || choice === 'later') {
      if (choice === 'allow') setState('requesting');

      // CRITICAL: We must call onChoice IMMEDIATELY without any await/setTimeout
      // before it to preserve the "User Gesture" context for the browser.
      const success = await onChoice(choice);

      if (!success && choice === 'allow') {
        setState('instructions');
      }
    } else {
      onChoice(choice);
    }
  };

  const renderInstructions = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-amber-400">
        <Info className="w-6 h-6" />
        <h3 className="text-lg font-bold">Action Required</h3>
      </div>
      <div className="space-y-2">
        <p className="text-sm text-white/70 leading-relaxed">
          {type === 'notifications'
            ? "Browsers often block notification prompts if they were dismissed before. You'll need to enable them manually."
            : `The browser has blocked the ${type} request. Please follow the steps below:`}
        </p>
      </div>

      <div className="space-y-4 pt-2">
        {isAndroid && (
          <div className="bg-white/5 p-4 rounded-2xl space-y-3 border border-white/10">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#0b57d0]">
              <Settings className="w-3 h-3" /> Android Settings
            </div>
            <p className="text-xs text-white leading-relaxed">
              If the prompt above didn't work, you can enable it directly in App Settings.
            </p>
            <button
              onClick={() => {
                // Capacitor helper to open app settings
                (window as any).Capacitor?.Plugins?.NativeSettings?.open({ option: 'app' });
              }}
              className="w-full py-2 bg-[#0b57d0]/20 hover:bg-[#0b57d0]/30 text-[#0b57d0] rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all"
            >
              Open App Settings
            </button>
            <div className="pt-2">
              <p className="text-[9px] text-white/40 uppercase font-black mb-2">Manual Steps:</p>
              <ol className="text-xs text-white/70 space-y-2 list-decimal list-inside">
                <li>Tap the <span className="font-bold underline text-white">Lock icon</span> in the URL bar.</li>
                <li>Select <span className="font-bold underline text-white">Permissions</span>.</li>
                <li>Toggle <span className="font-bold underline text-white">{config.title}</span> to ON.</li>
              </ol>
            </div>
          </div>
        )}

        {isIOS && (
          <div className="bg-white/5 p-4 rounded-2xl space-y-3 border border-white/10">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#0b57d0]">
              <Settings className="w-3 h-3" /> iOS Safari
            </div>
            <p className="text-xs text-white leading-relaxed">
              To get notifications on iPhone, you must first <span className="font-bold underline">Add to Home Screen</span> (Tap Share icon → Add to Home Screen).
            </p>
          </div>
        )}

        {!isAndroid && !isIOS && (
          <div className="bg-white/5 p-4 rounded-2xl space-y-3 border border-white/10">
            <ol className="text-xs text-white space-y-2 list-decimal list-inside">
              <li>Click the icon next to the URL in the address bar.</li>
              <li>Find <span className="font-bold underline">{config.title}</span> and set to "Allow".</li>
              <li>Refresh the page.</li>
            </ol>
          </div>
        )}
      </div>

      <button
        onClick={onClose}
        className="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-[1.2rem] font-bold text-[14px] transition-colors"
      >
        Got it, I'll check settings
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={state === 'initial' || state === 'instructions' ? onClose : undefined}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
      />

      <motion.div
        initial={{ scale: 0.9, y: 40, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 40, opacity: 0 }}
        className="w-full max-w-[340px] p-8 text-left relative z-10 transition-all duration-300"
        style={{
          backgroundColor: '#1a1a1a',
          borderRadius: '2.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          border: '1px solid rgba(255,255,255,0.05)'
        }}
      >
        <AnimatePresence mode="wait">
          {state === 'initial' && (
            <motion.div key="initial" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#0b57d0]/20 flex-shrink-0 flex items-center justify-center text-[#0b57d0]">
                  <config.icon className="w-6 h-6" />
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="text-[17px] font-bold text-white leading-tight">
                    Allow <span className="text-[#0b57d0]">{config.title}</span>?
                  </h3>
                  <p className="text-[11px] text-white/50 mt-1 uppercase tracking-widest font-black">Request from {hostname}</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={() => handleAction('allow')}
                  className="w-full group py-4 bg-[#0b57d0] hover:bg-blue-600 active:scale-95 text-white rounded-[1.2rem] font-bold text-[14px] transition-all flex items-center justify-center gap-2"
                >
                  Allow while visiting
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
                </button>
                <button
                  onClick={() => handleAction('later')}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 active:scale-95 text-white rounded-[1.2rem] font-bold text-[14px] transition-all"
                >
                  Allow this time
                </button>
                <button
                  onClick={() => handleAction('never')}
                  className="w-full py-2 hover:text-white/80 text-white/40 font-bold text-[11px] uppercase tracking-widest transition-all"
                >
                  Never allow
                </button>
              </div>
            </motion.div>
          )}

          {state === 'requesting' && (
            <motion.div key="requesting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-12 flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative">
                <Loader2 className="w-16 h-16 text-[#0b57d0] animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-[#0b57d0]/10" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Opening Browser Dialog</h3>
                <p className="text-sm text-white/50 mt-2 leading-relaxed">Please select "Allow" when the system prompt appears.</p>
              </div>
              <button
                onClick={() => setState('instructions')}
                className="text-[10px] font-black uppercase tracking-widest text-[#0b57d0] hover:underline pt-4"
              >
                Prompt not appearing?
              </button>
            </motion.div>
          )}

          {state === 'instructions' && (
            <motion.div key="instructions" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {renderInstructions()}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-center gap-2 opacity-20">
          <ShieldCheck className="w-3 h-3 text-white" />
          <span className="text-[8px] font-black uppercase tracking-widest text-white">Privacy Protected • 256-bit Secure</span>
        </div>
      </motion.div>
    </div>
  );
};

export default PermissionPrompt;

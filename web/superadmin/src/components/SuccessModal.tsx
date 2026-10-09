import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface SuccessModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  title?: string;
  message?: string;
}

const SuccessModal: React.FC<SuccessModalProps> = ({
  isOpen,
  onConfirm,
  title = "SUCCESS",
  message = "Join request sent to host!"
}) => {
  const { theme } = useTheme();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-sm rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl relative z-10 p-6 sm:p-8 text-center my-auto max-h-[90dvh] flex flex-col"
            style={{ backgroundColor: theme.colors.card }}
          >
            <div className="overflow-hidden custom-scrollbar pr-1">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>

              <h3 className="text-xl sm:text-2xl font-black mb-2 italic tracking-tighter" style={{ color: theme.colors.textPrimary }}>
                {title}
              </h3>
              <p className="text-xs sm:text-sm font-medium opacity-70 mb-6 sm:mb-8" style={{ color: theme.colors.textPrimary }}>
                {message}
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onConfirm}
              className="w-full py-3.5 sm:py-4 rounded-2xl font-black uppercase tracking-widest text-white shadow-xl transition-all shrink-0"
              style={{
                background: `linear-gradient(to right, ${theme.colors.buttonGradient[0]}, ${theme.colors.buttonGradient[1]})`
              }}
            >
              Confirm
            </motion.button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SuccessModal;

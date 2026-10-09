import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ModalProps {
  children: React.ReactNode;
  onClose: () => void;
}

const Modal: React.FC<ModalProps> = ({ children, onClose }) => {
  const { theme } = useTheme();

  // Decide backdrop color based on theme
  const backdropColor = theme.name === 'light'
    ? 'rgba(15, 23, 42, 0.3)' // Lighter for light mode
    : 'rgba(0, 0, 0, 0.7)';    // Darker for dark/boxitt modes

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 overflow-hidden no-scrollbar">
      {/* Dynamic theme-aware backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 backdrop-blur-md"
        style={{ backgroundColor: backdropColor }}
      />

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-lg border transition-all duration-300 z-10 my-auto flex flex-col max-h-[90dvh]"
        style={{
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.large,
            boxShadow: theme.elevation.modal,
            backdropFilter: theme.name !== 'light' ? 'blur(10px)' : 'none'
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 sm:top-6 right-4 sm:right-6 p-1.5 sm:p-2 rounded-full transition-all z-20 border hover:opacity-80 shadow-sm"
          style={{
            backgroundColor: theme.colors.backgroundSecondary,
            borderColor: theme.colors.border,
            color: theme.colors.textPrimary
          }}
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        <div className="p-6 sm:p-8 overflow-hidden custom-scrollbar" style={{ color: theme.colors.textPrimary }}>
          {children}
        </div>
      </motion.div>
    </div>
  );
};

export default Modal;

import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';

interface LoadingButtonProps extends HTMLMotionProps<"button"> {
  loading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
}

const LoadingButton: React.FC<LoadingButtonProps> = ({
  loading,
  loadingText,
  icon,
  children,
  className = "",
  disabled,
  style,
  ...props
}) => {
  const { theme } = useTheme();

  return (
    <motion.button
      whileHover={!loading && !disabled ? { scale: 1.02 } : {}}
      whileTap={!loading && !disabled ? { scale: 0.98 } : {}}
      disabled={loading || disabled}
      className={`relative flex items-center justify-center gap-3 transition-all active:translate-y-1 disabled:opacity-70 disabled:cursor-not-allowed ${className}`}
      style={style}
      {...props}
    >
      {loading ? (
        <>
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span>{loadingText || 'Processing...'}</span>
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </motion.button>
  );
};

export default LoadingButton;

import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
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
    <button
      disabled={loading || disabled}
      className={`relative flex items-center justify-center gap-3 transition-all active:translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed ${className}`}
      style={style}
      {...props}
    >
      {loading ? (
        <>
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span className="animate-pulse">{loadingText || 'Processing...'}</span>
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
};

export default LoadingButton;

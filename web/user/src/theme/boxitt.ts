import { AppTheme } from './types';

export const boxTheme: AppTheme = {
  name: "boxitt",
  colors: {
    background: "#E7F7E7", // Lush Mint - Refreshing & Vital
    backgroundSecondary: "#D8EFD8",

    card: "#FFFFFF",
    cardElevated: "#C7E8C7", // The "Amount Payable" green from design
    border: "#BDDBBD",

    textPrimary: "#0A2A0A", // Deep Forest - Stability & Trust
    textSecondary: "#2D4F2D",
    textDisabled: "#8EB08E",

    accent: "#006305", // Active Sport Green - Energy & Action
    accentGlow: "#22C55E",

    success: "#22C55E",
    warning: "#D97706",
    error: "#DC2626",

    buttonGradient: ["#004D04", "#006305"],
  },

  elevation: {
    card: "0 8px 0px #002D04, 0 12px 24px rgba(0,0,0,0.06)",
    elevated: "0 10px 0px #002D04, 0 15px 30px rgba(0,0,0,0.08)",
    floating: "0 15px 0px #002D04, 0 20px 40px rgba(0,0,0,0.1)",
    modal: "0 20px 0px #000000, 0 30px 60px rgba(0,0,0,0.15)",
  },

  radius: {
    small: "12px",
    medium: "16px",
    large: "28px",
  },
};

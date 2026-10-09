import { AppTheme } from './types';

export const lightTheme: AppTheme = {
  name: "light",
  colors: {
    background: "#FDFDFF", // Pure & Clean - Clarity & Efficiency
    backgroundSecondary: "#F1F5F9",

    card: "#FFFFFF",
    cardElevated: "#F8FAFC",
    border: "#E2E8F0",

    textPrimary: "#0F172A", // Slate 900 - Professional & Grounded
    textSecondary: "#475569",
    textDisabled: "#94A3B8",

    accent: "#2563EB", // Royal Blue - Trust, Reliability & Logic
    accentGlow: "#60A5FA",

    success: "#059669",
    warning: "#F59E0B",
    error: "#E11D48",

    buttonGradient: ["#2563EB", "#1D4ED8"],
  },

  elevation: {
    // Subtle, clean shadows for a lightweight professional feel
    card: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    elevated: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    floating: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
    modal: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
  },

  radius: {
    small: "12px",
    medium: "16px",
    large: "24px",
  },
};

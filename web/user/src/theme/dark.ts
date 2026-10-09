import { AppTheme } from './types';

export const darkTheme: AppTheme = {
  name: "dark",
  colors: {
    background: "#080C14", // Deep Abyss - Focus & Sophistication
    backgroundSecondary: "#101624",

    card: "#121A2B", // Subtle contrast
    cardElevated: "#1C263D",
    border: "#202B45",

    textPrimary: "#F8FAFC", // Pure White - Clarity
    textSecondary: "#94A3B8", // Soft Slate - Low eye strain
    textDisabled: "#475569",

    accent: "#6366F1", // Electric Indigo - Modern & High-Tech
    accentGlow: "#818CF8",

    success: "#10B981",
    warning: "#FBBF24",
    error: "#F43F5E",

    buttonGradient: ["#4F46E5", "#6366F1"],
  },

  elevation: {
    // Deep shadows for immersive dark experience
    card: "0 4px 20px rgba(0,0,0,0.5)",
    elevated: "0 8px 32px rgba(0,0,0,0.6)",
    floating: "0 12px 48px rgba(0,0,0,0.7)",
    modal: "0 20px 64px rgba(0,0,0,0.8)",
  },

  radius: {
    small: "12px",
    medium: "16px",
    large: "24px",
  },
};

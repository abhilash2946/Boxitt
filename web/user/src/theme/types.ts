export interface AppTheme {
  name: "dark" | "boxitt" | "light";
  colors: {
    background: string;
    backgroundSecondary: string;
    card: string;
    cardElevated: string;
    border: string;

    textPrimary: string;
    textSecondary: string;
    textDisabled: string;

    accent: string;
    accentGlow: string;

    success: string;
    warning: string;
    error: string;

    buttonGradient: string[];
  };

  elevation: {
    card: string;
    elevated: string;
    floating: string;
    modal: string;
  };

  radius: {
    small: string;
    medium: string;
    large: string;
  };
}

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AppTheme, themes } from '../theme';

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (themeName: AppTheme['name']) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [themeName, setThemeName] = useState<AppTheme['name']>(() => {
    const savedTheme = localStorage.getItem('app-theme') as AppTheme['name'];
    return (savedTheme && themes[savedTheme]) ? savedTheme : 'light';
  });

  const theme = themes[themeName];

  useEffect(() => {
    localStorage.setItem('app-theme', themeName);

    const root = document.documentElement;

    // Set colors
    Object.entries(theme.colors).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((v, i) => {
          root.style.setProperty(`--color-${key}-${i}`, v);
        });
        root.style.setProperty(`--color-${key}`, value[0]); // Default to first
      } else {
        const cssKey = key.replace(/[A-Z]/g, m => "-" + m.toLowerCase());
        root.style.setProperty(`--color-${cssKey}`, value);
      }
    });

    // Set elevations
    Object.entries(theme.elevation).forEach(([key, value]) => {
      root.style.setProperty(`--elevation-${key}`, value);
    });

    // Set radius
    Object.entries(theme.radius).forEach(([key, value]) => {
      root.style.setProperty(`--radius-${key}`, value);
    });

    document.body.classList.add('theme-transition');
    root.setAttribute('data-theme', themeName);
  }, [themeName, theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeName }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

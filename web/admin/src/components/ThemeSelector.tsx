import React, { useState, useRef, useEffect } from 'react';
import { Palette, Moon, Sun, Box, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';
import { AppTheme } from '../theme';

export const ThemeSelector: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const themeOptions: { id: AppTheme['name']; label: string; icon: any; color: string }[] = [
    { id: 'dark', label: 'Dark Mode', icon: Moon, color: '#3B82F6' },
    { id: 'boxitt', label: 'Boxitt Mode', icon: Box, color: '#10B981' },
    { id: 'light', label: 'Light Mode', icon: Sun, color: '#2563EB' },
  ];

  return (
    <div className="relative" ref={containerRef}>
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 rounded-theme-md border transition-all shadow-theme-card active:translate-y-0.5"
        style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.textPrimary }}
      >
        <Palette className="w-6 h-6" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10, x: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10, x: -20 }}
            className="absolute right-0 mt-4 w-56 border rounded-[2rem] shadow-theme-modal overflow-hidden z-[100]"
            style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border }}
          >
            <div className="p-3 space-y-1">
              {themeOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => {
                    setTheme(option.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all shadow-theme-card active:scale-95`}
                  style={{
                    backgroundColor: theme.name === option.id ? theme.colors.backgroundSecondary : 'transparent',
                    color: theme.name === option.id ? theme.colors.textPrimary : theme.colors.textDisabled
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm" style={{ backgroundColor: `${option.color}20`, color: option.color }}>
                      <option.icon className="w-5 h-5" />
                    </div>
                    <span className="font-black text-[11px] uppercase tracking-widest">{option.label}</span>
                  </div>
                  {theme.name === option.id && <Check className="w-4 h-4" style={{ color: theme.colors.success }} />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

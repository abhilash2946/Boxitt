import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface PickerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const BasePicker: React.FC<PickerProps> = ({ isOpen, onClose, title, children }) => {
  const { theme } = useTheme();
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 overflow-hidden">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="w-full max-w-sm overflow-hidden border shadow-theme-modal flex flex-col max-h-[85dvh]"
            style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radius.large }}
          >
            <div className="p-4 sm:p-6 flex justify-between items-center border-b shrink-0" style={{ borderColor: theme.colors.border }}>
              <h3 className="font-black text-lg italic uppercase tracking-tighter" style={{ color: theme.colors.textPrimary }}>{title}</h3>
              <button onClick={onClose} className="p-2 rounded-xl transition-all shadow-theme-card active:translate-y-0.5 border"
                      style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border, color: theme.colors.textDisabled }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export const DurationPickerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  options: { value: string; label: string }[];
  selectedValue: string;
  onSelect: (val: string) => void;
}> = ({ isOpen, onClose, options, selectedValue, onSelect }) => {
  const { theme } = useTheme();
  return (
    <BasePicker isOpen={isOpen} onClose={onClose} title="Select Duration">
      <div className="grid grid-cols-1 gap-2 sm:gap-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { onSelect(opt.value); onClose(); }}
            className="w-full p-4 sm:p-5 rounded-2xl border-2 font-black transition-all flex items-center justify-between group shadow-theme-card active:translate-y-1"
            style={{
                backgroundColor: selectedValue === opt.value ? `${theme.colors.accent}15` : theme.colors.backgroundSecondary,
                borderColor: selectedValue === opt.value ? theme.colors.accent : theme.colors.border,
                color: selectedValue === opt.value ? theme.colors.accent : theme.colors.textPrimary
            }}
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 opacity-30" />
              <span className="text-xs sm:text-sm uppercase tracking-widest">{opt.label}</span>
            </div>
            {selectedValue === opt.value && <div className="w-2 h-2 rounded-full shadow-lg" style={{ backgroundColor: theme.colors.accent }} />}
          </button>
        ))}
      </div>
    </BasePicker>
  );
};

export const DatePickerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  onSelect: (date: string) => void;
  minDate?: string;
  maxDate?: string;
  locationId?: string;
}> = ({ isOpen, onClose, selectedDate, onSelect, minDate, maxDate, locationId }) => {
  const { theme } = useTheme();
  const [viewMode, setViewMode] = useState<'days' | 'months' | 'years'>('days');
  const yearsRef = useRef<HTMLDivElement>(null);

  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate) {
      const [y, m, d] = selectedDate.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  });

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handleMonthChange = (offset: number) => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
  };

  const handleYearSelect = (year: number) => {
    setViewDate(new Date(year, viewDate.getMonth(), 1));
    setViewMode('days');
  };

  const handleMonthSelect = (month: number) => {
    setViewDate(new Date(viewDate.getFullYear(), month, 1));
    setViewMode('days');
  };

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const currentYear = new Date().getFullYear();
  // Show years from current year backwards
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

  const days = [];
  const totalDays = daysInMonth(viewDate.getFullYear(), viewDate.getMonth());
  const startOffset = firstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth());

  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let i = 1; i <= totalDays; i++) days.push(i);

  const formatDateString = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const isDateSelected = (day: number) => {
    return formatDateString(viewDate.getFullYear(), viewDate.getMonth(), day) === selectedDate;
  };

  const isDateDisabled = (day: number) => {
    const dStr = formatDateString(viewDate.getFullYear(), viewDate.getMonth(), day);
    if (minDate && dStr < minDate) return true;
    if (maxDate && dStr > maxDate) return true;
    return false;
  };

  // Auto-scroll to selected year when year view opens
  useEffect(() => {
    if (viewMode === 'years' && yearsRef.current) {
      const selectedBtn = yearsRef.current.querySelector('.selected-year') as HTMLElement;
      if (selectedBtn) {
        yearsRef.current.scrollTo({
          top: selectedBtn.offsetTop - yearsRef.current.clientHeight / 2 + selectedBtn.clientHeight / 2,
          behavior: 'auto'
        });
      }
    }
  }, [viewMode]);

  return (
    <BasePicker isOpen={isOpen} onClose={onClose} title="Select Date">
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => handleMonthChange(-1)}
            disabled={viewMode !== 'days'}
            className={`p-2 rounded-xl transition-all shadow-theme-card active:translate-y-0.5 border ${viewMode !== 'days' ? 'opacity-0 pointer-events-none' : ''}`}
            style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border, color: theme.colors.textPrimary }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 flex-1 justify-center">
            <button
              onClick={() => setViewMode(viewMode === 'months' ? 'days' : 'months')}
              className="flex items-center gap-1 bg-white/5 rounded-xl border border-white/10 px-2 sm:px-3 py-1.5 hover:bg-white/10 transition-all outline-none"
            >
              <span className="font-black uppercase text-[10px] sm:text-[11px] tracking-wider" style={{ color: theme.colors.textPrimary }}>{months[viewDate.getMonth()]}</span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${viewMode === 'months' ? 'rotate-180' : ''}`} style={{ color: theme.colors.textPrimary }} />
            </button>

            <button
              onClick={() => setViewMode(viewMode === 'years' ? 'days' : 'years')}
              className="flex items-center gap-1 bg-white/5 rounded-xl border border-white/10 px-2 sm:px-3 py-1.5 hover:bg-white/10 transition-all outline-none"
            >
              <span className="font-black text-[10px] sm:text-[11px] tracking-wider" style={{ color: theme.colors.textPrimary }}>{viewDate.getFullYear()}</span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${viewMode === 'years' ? 'rotate-180' : ''}`} style={{ color: theme.colors.textPrimary }} />
            </button>
          </div>

          <button
            onClick={() => handleMonthChange(1)}
            disabled={viewMode !== 'days'}
            className={`p-2 rounded-xl transition-all shadow-theme-card active:translate-y-0.5 border ${viewMode !== 'days' ? 'opacity-0 pointer-events-none' : ''}`}
            style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border, color: theme.colors.textPrimary }}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="min-h-[220px] sm:min-h-[260px] relative">
          <AnimatePresence mode="wait">
            {viewMode === 'days' && (
              <motion.div
                key="days"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="grid grid-cols-7 gap-1 sm:gap-2"
              >
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <div key={i} className="text-center text-[10px] font-black py-1 sm:py-2" style={{ color: theme.colors.accent }}>{d}</div>
                ))}
                {days.map((day, i) => {
                  if (day === null) return <div key={i} />;
                  const disabled = isDateDisabled(day);
                  const selected = isDateSelected(day);
                  return (
                    <button
                      key={i}
                      disabled={disabled}
                      onClick={() => {
                        const dStr = formatDateString(viewDate.getFullYear(), viewDate.getMonth(), day);
                        onSelect(dStr);
                        onClose();
                      }}
                      className={`aspect-square flex items-center justify-center rounded-xl text-[10px] sm:text-xs font-black transition-all shadow-sm ${selected ? 'shadow-theme-elevated active:translate-y-1' : ''}`}
                      style={{
                          backgroundColor: selected ? theme.colors.accent : disabled ? 'transparent' : theme.colors.backgroundSecondary,
                          color: selected ? 'white' : disabled ? `${theme.colors.textDisabled}40` : theme.colors.textPrimary,
                          opacity: disabled ? 0.3 : 1,
                          borderColor: selected ? theme.colors.accent : theme.colors.border,
                          borderWidth: '1px'
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </motion.div>
            )}

            {viewMode === 'months' && (
              <motion.div
                key="months"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-3 gap-2 sm:gap-3"
              >
                {months.map((m, i) => (
                  <button
                    key={m}
                    onClick={() => handleMonthSelect(i)}
                    className="p-3 sm:p-4 rounded-2xl border font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all hover:bg-white/5 active:scale-95"
                    style={{
                      backgroundColor: viewDate.getMonth() === i ? `${theme.colors.accent}20` : 'transparent',
                      borderColor: viewDate.getMonth() === i ? theme.colors.accent : `${theme.colors.border}40`,
                      color: viewDate.getMonth() === i ? theme.colors.accent : theme.colors.textPrimary
                    }}
                  >
                    {m.substring(0, 3)}
                  </button>
                ))}
              </motion.div>
            )}

            {viewMode === 'years' && (
              <motion.div
                key="years"
                ref={yearsRef}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-4 gap-1.5 sm:gap-2 max-h-[220px] sm:max-h-[260px] overflow-y-auto pr-2 custom-scrollbar scroll-smooth"
              >
                {years.map(y => (
                  <button
                    key={y}
                    onClick={() => handleYearSelect(y)}
                    className={`p-2.5 sm:p-3 rounded-xl border font-black text-[10px] sm:text-[11px] transition-all hover:bg-white/5 active:scale-95 ${viewDate.getFullYear() === y ? 'selected-year' : ''}`}
                    style={{
                      backgroundColor: viewDate.getFullYear() === y ? `${theme.colors.accent}20` : 'transparent',
                      borderColor: viewDate.getFullYear() === y ? theme.colors.accent : `${theme.colors.border}40`,
                      color: viewDate.getFullYear() === y ? theme.colors.accent : theme.colors.textPrimary
                    }}
                  >
                    {y}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </BasePicker>
  );
};

import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { Star, CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface RatingModalProps {
  matchId: string;
  locationId: string;
  user: User;
  onClose: () => void;
}

const RatingModal: React.FC<RatingModalProps> = ({ matchId, locationId, user, onClose }) => {
  const { theme } = useTheme();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [hasRated, setHasRated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkIfRated = async () => {
      try {
        const { count } = await supabase.from('ratings').select('*', { count: 'exact', head: true }).eq('match_id', matchId).eq('user_id', user.email);
        if ((count || 0) > 0) setHasRated(true);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    checkIfRated();
  }, [matchId, user.email]);

  const handleSubmit = async () => {
    if (rating === 0) return setError('Select a rating');
    setIsSubmitting(true);
    try {
      await supabase.from('ratings').insert({ location_id: locationId, match_id: matchId, user_id: user.email, rating, created_at: new Date().toISOString() });
      onClose();
    } catch (err) { setError('Failed to submit'); setIsSubmitting(false); }
  };

  const backdropBg = theme.name === 'light' ? 'rgba(15, 23, 42, 0.4)' : 'rgba(0, 0, 0, 0.8)';

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 backdrop-blur-md transition-colors duration-300"
        style={{ backgroundColor: backdropBg }}
      />
      <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
                  className="w-full max-w-sm p-10 text-center relative z-10 border transition-all duration-300 shadow-theme-modal"
                  style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radius.large }}>
        
        {loading ? (
          <div className="py-10">
            <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-6" style={{ borderTopColor: theme.colors.accent }} />
            <h3 className="text-xl font-black uppercase italic" style={{ color: theme.colors.textPrimary }}>Loading...</h3>
          </div>
        ) : hasRated ? (
          <div>
            <div className="w-16 h-16 rounded-theme-md flex items-center justify-center mx-auto mb-6 shadow-theme-elevated" style={{ backgroundColor: theme.colors.success, color: 'white' }}>
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black mb-2 uppercase italic" style={{ color: theme.colors.textPrimary }}>Thank You!</h3>
            <p className="text-sm mb-8" style={{ color: theme.colors.textDisabled }}>Rating already recorded.</p>
            <button
              onClick={onClose}
              className="w-full py-4 rounded-theme-md font-black uppercase tracking-widest shadow-theme-elevated active:translate-y-1 transition-all"
              style={{ backgroundColor: theme.colors.textPrimary, color: theme.colors.background }}
            >
              Close
            </button>
          </div>
        ) : (
          <div>
            <div className="w-16 h-16 rounded-theme-md flex items-center justify-center mx-auto mb-6 shadow-theme-elevated" style={{ backgroundColor: '#F59E0B', color: 'white' }}>
              <Star className="w-8 h-8 fill-current" />
            </div>
            <h3 className="text-2xl font-black mb-2 uppercase italic" style={{ color: theme.colors.textPrimary }}>Rate Match</h3>
            <p className="text-sm mb-8" style={{ color: theme.colors.textDisabled }}>How was your experience?</p>

            <div className="flex justify-center items-center gap-2 mb-8">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className={`w-10 h-10 cursor-pointer transition-all duration-200 ${(hoverRating || rating) >= star ? 'fill-current scale-110' : 'opacity-20'}`}
                  style={{ color: (hoverRating || rating) >= star ? '#F59E0B' : theme.colors.textDisabled }}
                />
              ))}
            </div>

            {error && <p className="text-error text-xs font-bold mb-4">{error}</p>}

            <div className="space-y-3">
              <button onClick={handleSubmit} disabled={isSubmitting || rating === 0}
                      className="w-full py-4 text-white rounded-theme-md font-black uppercase tracking-widest shadow-theme-elevated transition-all active:translate-y-1 disabled:opacity-50"
                      style={{ backgroundColor: theme.colors.accent }}>
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
              <button onClick={onClose} className="w-full py-2 font-bold uppercase text-[10px] tracking-widest transition-colors" style={{ color: theme.colors.textDisabled }}>Skip</button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default RatingModal;

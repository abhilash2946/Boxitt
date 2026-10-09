import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { locationService } from '../services/locationService';
import { storage } from '../services/storage';
import LoadingButton from '../components/LoadingButton';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, MessageSquare, Send, CheckCircle2, User as UserIcon, Calendar, ChevronLeft, X } from 'lucide-react';
import { handleError } from '../services/errorHandler';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';

interface ReviewPageProps {
    locationId?: string;
    onAlert?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const ReviewPage: React.FC<ReviewPageProps> = ({ locationId: propLocationId, onAlert }) => {
    const { theme } = useTheme();
    const navigate = useNavigate();
    const { locationId: paramLocationId } = useParams<{ locationId: string }>();
    const locationId = propLocationId || paramLocationId;

    const PAGE_ID = `review_${locationId}`;
    const savedState = storage.getPageState<any>(PAGE_ID) || {};

    const [reviews, setReviews] = useState<any[]>([]);
    const [userReview, setUserReview] = useState<any | null>(null);
    const [rating, setRating] = useState(savedState.rating || 0);
    const [comment, setComment] = useState(savedState.comment || '');
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [arenaName, setArenaName] = useState<string>('');

    useEffect(() => {
        if (locationId) {
            storage.setPageState(PAGE_ID, { rating, comment });
        }
    }, [PAGE_ID, locationId, rating, comment]);

    const triggerAlert = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
        if (onAlert) onAlert(msg, type);
    };

    const fetchArenaDetails = useCallback(async () => {
        if (!locationId) return;
        try {
            const location = await locationService.getLocationById(locationId);
            if (location) setArenaName(location.name);
        } catch (err) {
            console.error(err);
        }
    }, [locationId]);

    const fetchReviews = useCallback(async (isInitial: boolean = false) => {
        if (!locationId) return;
        try {
            const { data: reviewsData, error: reviewsError } = await supabase.from('reviews').select('*').eq('location_id', locationId).order('created_at', { ascending: false });

            if (reviewsError) throw reviewsError;

            if (reviewsData) {
                const userIds = Array.from(new Set(reviewsData.map(r => r.user_id)));
                if (userIds.length > 0) {
                    const { data: profilesData } = await supabase.from('user_profiles').select('id, display_name, username').in('id', userIds);
                    const profileMap = (profilesData || []).reduce((acc: any, profile: any) => { acc[profile.id] = profile; return acc; }, {});

                    const reviewsWithNames = reviewsData.map((review) => {
                        const profile = profileMap[review.user_id];
                        return { ...review, name: profile?.username || profile?.display_name || 'Anonymous' };
                    });

                    const { data: authUser } = await supabase.auth.getUser();
                    let currentUserId: string | null = null;
                    if (authUser?.user) {
                        currentUserId = authUser.user.id;
                        const existingReview = reviewsData.find(r => r.user_id === currentUserId);
                        if (existingReview) {
                            setUserReview(existingReview);
                            // Only set initial values from DB if we don't have draft state
                            if (isInitial) {
                                const currentSaved = storage.getPageState<any>(PAGE_ID) || {};
                                if (!currentSaved.rating) setRating(existingReview.rating);
                                if (!currentSaved.comment) setComment(existingReview.comment);
                            }
                        } else setUserReview(null);
                    }

                    // Sort: current user first, then by date
                    const sortedReviews = currentUserId
                        ? [...reviewsWithNames].sort((a, b) => {
                            const aIsUser = a.user_id === currentUserId;
                            const bIsUser = b.user_id === currentUserId;
                            if (aIsUser && !bIsUser) return -1;
                            if (!aIsUser && bIsUser) return 1;
                            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                        })
                        : reviewsWithNames;

                    setReviews(sortedReviews);
                } else {
                    setReviews([]);
                }
            }
        } catch (err) {
            const appError = handleError(err);
            console.error('Error fetching reviews:', appError);
        } finally { setLoading(false); }
    }, [locationId, PAGE_ID]);

    useEffect(() => {
        setLoading(true);
        fetchArenaDetails();
        fetchReviews(true); // Initial fetch
    }, [fetchArenaDetails, fetchReviews]);

    const handleSubmitReview = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting || !locationId) return;
        const { data: authUser } = await supabase.auth.getUser();
        if (!authUser?.user) { triggerAlert('Please login first.', 'error'); return; }
        if (rating === 0) return triggerAlert('Please select a rating.', 'error');
        setIsSubmitting(true);
        const userId = authUser.user.id;
        try {
            let existingReviewId = userReview?.id;
            if (!existingReviewId) {
                const { data: existing } = await supabase.from('reviews').select('id').eq('location_id', locationId).eq('user_id', userId).maybeSingle();
                if (existing) existingReviewId = existing.id;
            }
            const { error } = existingReviewId
                ? await supabase.from('reviews').update({ rating, comment }).eq('id', existingReviewId)
                : await supabase.from('reviews').insert([{ location_id: locationId, user_id: userId, rating, comment }]);

            if (error) throw error;

            setShowSuccess(true);
            storage.clearPageState(PAGE_ID);
            await fetchReviews();
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (err) {
            const appError = handleError(err);
            triggerAlert(appError.message, 'error');
        } finally { setIsSubmitting(false); }
    };

    if (loading) return (
        <div className="min-h-screen flex flex-col items-center justify-center transition-all duration-300" style={{ backgroundColor: theme.colors.background }}>
            <div className="w-16 h-16 border-8 border-border rounded-full animate-spin mb-6" style={{ borderTopColor: theme.colors.accent }} />
            <p className="text-sm font-black uppercase tracking-[0.4em]" style={{ color: theme.colors.textDisabled }}>Loading Reviews...</p>
        </div>
    );

    const handleClose = () => {
        // Find the sport from saved state or fallback to home
        const navState = storage.getNavState();
        if (navState?.selectedSport) {
            navigate(`/arenas/${navState.selectedSport}`);
        } else {
            navigate('/');
        }
    };

    return (
        <div className="min-h-screen p-4 md:p-8 relative overflow-hidden transition-all duration-300" style={{ backgroundColor: theme.colors.background }}>
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none opacity-20" style={{ backgroundColor: theme.colors.accent }} />

            <AnimatePresence>
                {showSuccess && (
                    <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 20, opacity: 1 }} exit={{ y: -50, opacity: 0 }} className="fixed top-0 left-1/2 -translate-x-1/2 z-[100]">
                        <div className="text-white px-8 py-4 rounded-full font-black uppercase tracking-widest shadow-theme-elevated flex items-center gap-3 border border-white/20 text-xs"
                            style={{ backgroundColor: theme.colors.success }}>
                            <CheckCircle2 className="w-[var(--icon-size)] h-[var(--icon-size)]" /> Review Posted!
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="max-w-7xl mx-auto space-y-12 relative z-10">
                <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex justify-between items-start">
                    <div>
                        <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter leading-none drop-shadow-2xl" style={{ color: theme.colors.textPrimary }}>
                            {arenaName ? <>{arenaName} <span style={{ color: theme.colors.accent }}>Reviews</span></> : 'Arena Reviews'}
                        </h1>
                        <div className="flex items-center gap-3 mt-4">
                            <MessageSquare className="w-4 h-4" style={{ color: theme.colors.textDisabled }} />
                            <p className="text-[10px] font-black uppercase tracking-[0.4em]" style={{ color: theme.colors.textDisabled }}>User Feedback</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="px-6 py-3 bg-card rounded-2xl border border-border shadow-theme-card hover:bg-card-elevated transition-all flex items-center gap-2 group active:scale-95"
                    >
                        <ChevronLeft className="w-5 h-5 text-text-disabled group-hover:text-accent transition-colors" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-text-disabled group-hover:text-text-primary">Back to Arena</span>
                    </button>
                </motion.header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left Column: Write/Edit Review */}
                    <div className="lg:col-span-5 lg:sticky lg:top-8">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="backdrop-blur-3xl p-8 md:p-10 border shadow-theme-modal relative overflow-hidden transition-all duration-300"
                            style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: '2rem' }}
                        >
                            <h2 className="text-xl md:text-2xl font-black italic uppercase mb-8 flex items-center gap-3 relative z-10" style={{ color: theme.colors.textPrimary }}>
                                <Star className="text-yellow-500 w-6 h-6" /> {userReview ? 'Edit Your Review' : 'Write a Review'}
                            </h2>
                            <form onSubmit={handleSubmitReview} className="space-y-8 relative z-10">
                                <div className="flex gap-4 justify-center md:justify-start">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <motion.button
                                            key={star}
                                            type="button"
                                            disabled={isSubmitting}
                                            whileHover={{ scale: 1.2, rotate: 10 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => setRating(star)}
                                            className={`text-5xl md:text-6xl transition-all ${star <= rating ? 'text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.4)]' : 'opacity-20 hover:opacity-100'}`}
                                            style={{ color: star <= rating ? undefined : theme.colors.textDisabled }}
                                        >
                                            ★
                                        </motion.button>
                                    ))}
                                </div>
                                <textarea
                                    value={comment}
                                    onChange={e => setComment(e.target.value)}
                                    placeholder="Tell us about your experience..."
                                    className="w-full p-6 rounded-2xl font-bold outline-none disabled:opacity-50 min-h-[150px] shadow-inner border-2 border-transparent text-sm md:text-base"
                                    style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary }}
                                    disabled={isSubmitting}
                                />
                                <LoadingButton
                                    loading={isSubmitting}
                                    disabled={rating === 0}
                                    onClick={handleSubmitReview}
                                    className="w-full py-5 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-sm shadow-theme-elevated"
                                    style={{
                                        background: `linear-gradient(to right, ${theme.colors.buttonGradient[0]}, ${theme.colors.buttonGradient[1]})`,
                                    }}
                                    icon={<Send className="w-5 h-5" />}
                                    loadingText="Posting..."
                                >
                                    {userReview ? 'Update Review' : 'Submit Review'}
                                </LoadingButton>
                            </form>
                            <div className="absolute top-0 right-0 w-[32vw] h-[32vw] blur-[10vw] rounded-full opacity-10 pointer-events-none" style={{ backgroundColor: theme.colors.accent }} />
                        </motion.div>
                    </div>

                    {/* Right Column: Recent Reviews */}
                    <div className="lg:col-span-7 space-y-8 pb-32">
                        <h2 className="text-xl md:text-2xl font-black italic uppercase pl-4 tracking-[0.3em]" style={{ color: theme.colors.textDisabled }}>Recent Reviews</h2>
                        <div className="grid gap-6">
                            {reviews.length > 0 ? reviews.map((review, idx) => (
                                <motion.div
                                    initial={{ x: -20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: 0.3 + (idx * 0.1) }}
                                    key={review.id}
                                    className="backdrop-blur-2xl p-8 border shadow-theme-card hover:shadow-theme-elevated transition-all group relative overflow-hidden"
                                    style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: '2rem' }}
                                >
                                    <div className="absolute top-0 right-0 w-32 h-32 blur-[60px] rounded-full opacity-5 pointer-events-none" style={{ backgroundColor: theme.colors.accent }} />
                                    <div className="flex justify-between items-start mb-6 relative z-10">
                                        <div className="flex gap-1.5 p-2 rounded-xl border shadow-inner" style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}>
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <Star key={star} className={`w-4 h-4 ${star <= review.rating ? 'text-yellow-500 fill-yellow-500' : 'opacity-10'}`} style={{ color: star <= review.rating ? undefined : theme.colors.textDisabled }} />
                                            ))}
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center gap-2 justify-end mb-1">
                                                <UserIcon className="w-3.5 h-3.5" style={{ color: theme.colors.accent }} />
                                                <span className="text-xs font-black uppercase tracking-widest italic" style={{ color: theme.colors.textPrimary }}>{review.name}</span>
                                            </div>
                                            {userReview && review.id === userReview.id && <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shadow-sm" style={{ backgroundColor: `${theme.colors.accent}20`, color: theme.colors.accent }}>Your Review</span>}
                                        </div>
                                    </div>
                                    <p className="font-bold leading-relaxed text-sm md:text-lg italic relative z-10" style={{ color: theme.colors.textSecondary }}>{review.comment}</p>
                                    <div className="mt-8 pt-6 border-t flex items-center gap-2 relative z-10" style={{ borderColor: theme.colors.border }}>
                                        <Calendar className="w-4 h-4" style={{ color: theme.colors.textDisabled }} />
                                        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: theme.colors.textDisabled }}>{new Date(review.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                    </div>
                                </motion.div>
                            )) : (
                                <motion.div
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    className="text-center py-20 rounded-[var(--fluid-radius)] border-2 border-dashed shadow-inner"
                                    style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}
                                >
                                    <p className="font-black uppercase text-xs tracking-[0.4em]" style={{ color: theme.colors.textDisabled }}>No reviews yet</p>
                                </motion.div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReviewPage;

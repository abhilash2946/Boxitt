import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { locationService } from '../services/locationService';
import { getPricingForLocation, Pricing } from '../services/pricingService';
import { getLocationAverageRating, getLocationRatingCount } from '../services/ratingService';
import { storage } from '../services/storage';
import { Location, Court } from '../types';
import { ChevronLeft, Star, Clock, MapPin, Phone, IndianRupee, Info, Calendar, ExternalLink, BadgeCheck, Users, CheckCircle2, XCircle, ChevronRight, X, LayoutGrid, Edit3 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useApp } from '../App';
import { motion, AnimatePresence } from 'framer-motion';
import ImageViewer from '../components/ImageViewer';
import { forceScrollTop } from '../utils/scroll';

const ArenaDetailsPage: React.FC = () => {
  const { id } = useParams();

  useEffect(() => {
    return forceScrollTop();
  }, [id]);
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user } = useApp();
  const [arena, setArena] = useState<Location | null>(null);
  const [pricing, setPricing] = useState<Pricing[]>([]);
  const [calculatedRating, setCalculatedRating] = useState<number>(0);
  const [ratingCount, setRatingCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [viewerConfig, setViewerConfig] = useState<{ isOpen: boolean; images: string[]; index: number }>({
      isOpen: false,
      images: [],
      index: 0
  });
  const [selectedCourtIdx, setSelectedCourtIdx] = useState(0);

  useEffect(() => {
    if (id) {
      Promise.all([
        locationService.getLocationById(id),
        getPricingForLocation(id),
        getLocationAverageRating(id),
        getLocationRatingCount(id)
      ]).then(([locationData, pricingData, avgRating, count]) => {
        setArena(locationData);
        setPricing(pricingData);
        setCalculatedRating(avgRating);
        setRatingCount(count);
        setLoading(false);
      }).catch((err) => {
        console.error("Error fetching arena details:", err);
        setLoading(false);
      });
    }
  }, [id]);


  const handleBookNow = () => {
    if (!arena) return;

    // Set navigation state for location & sport
    const currentState = storage.getNavState() || {
      currentPage: 'booking',
      selectedSport: null,
      selectedLocation: null
    };

    storage.setNavState({
      ...currentState,
      currentPage: 'booking',
      selectedLocation: arena,
      selectedSport: currentState.selectedSport || (arena.supportedSports && arena.supportedSports.length > 0 ? arena.supportedSports[0] : null)
    });

    // Navigate to the booking page for this arena
    navigate(`/booking/${arena.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-[var(--btn-height)] h-[var(--btn-height)] md:w-16 md:h-16 border-[1vw] md:border-8 border-border border-t-accent rounded-full animate-spin mb-[4vw] md:mb-6"></div>
        <p className="text-[2.5vw] md:text-sm font-black uppercase tracking-[0.3em] text-text-secondary animate-pulse">Loading Arena Details...</p>
      </div>
    );
  }

  if (!arena) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-[var(--fluid-padding)] md:p-12 text-center">
        <h2 className="text-[var(--font-title)] md:text-3xl font-black uppercase italic mb-[4vw] md:mb-6">Arena Not Found</h2>
        <button
          onClick={() => navigate(-1)}
          className="px-[var(--fluid-padding)] md:px-8 py-[3vw] md:py-3 bg-accent text-white rounded-[3vw] md:rounded-xl font-black uppercase tracking-widest shadow-lg text-[2.8vw] md:text-sm"
        >
          Go Back
        </button>
      </div>
    );
  }

  // Calculate Base Price (lowest hourly rate from pricing rules)
  const basePrice = pricing.length > 0
    ? Math.min(...pricing.map(p => p.price / (p.durationHours || p.duration_hours || 1)))
    : 0;

  const mapQuery = arena.latitude && arena.longitude
    ? `${arena.latitude},${arena.longitude}`
    : encodeURIComponent(arena.address);

  const googleMapsUrl = arena.latitude && arena.longitude
    ? `https://www.google.com/maps?q=${arena.latitude},${arena.longitude}`
    : `https://www.google.com/maps?q=${encodeURIComponent(arena.address)}`;

  // Use calculated rating if available, otherwise fallback to admin-set rating
  const displayRating = calculatedRating > 0 ? calculatedRating : (arena.rating || 0);

  return (
    <div className="min-h-screen bg-background pb-[20vw] md:pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border p-[4vw] md:p-4">
        <div className="max-w-[95vw] md:max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="p-[2vw] md:p-2 bg-card rounded-[3vw] md:rounded-xl border border-border shadow-sm hover:bg-card-elevated transition-all"
          >
            <ChevronLeft className="w-[var(--icon-size)] md:w-6 h-[var(--icon-size)] md:h-6 text-text-primary" />
          </button>
          <h1 className="text-[5vw] md:text-2xl font-black uppercase italic tracking-tighter text-text-primary dynamic-text px-[4vw] md:px-6">
            {arena.name}
          </h1>
          <div className="flex items-center gap-2">
            {(user?.role === 'superadmin' || user?.role === 'admin') && (
              <button
                onClick={() => navigate(`/admin/arena/${arena.id}/edit`)}
                className="p-[2vw] md:p-2 bg-accent rounded-[3vw] md:rounded-xl text-white shadow-theme-elevated hover:opacity-90 transition-all"
                title="Edit Arena"
              >
                <Edit3 className="w-[var(--icon-size)] md:w-6 h-[var(--icon-size)] md:h-6" />
              </button>
            )}
            <div className="w-[2vw] md:w-2" />
          </div>
        </div>
      </div>

      <div className="max-w-[95vw] md:max-w-7xl mx-auto p-[5vw] md:p-8 space-y-[var(--fluid-padding)] md:space-y-12">
        {/* Gallery Section */}
        <div className="space-y-8">
            {/* Arena Global Gallery */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-xs font-black uppercase tracking-widest text-text-disabled">Arena Global Gallery</h2>
                    <span className="text-[10px] font-bold text-text-disabled">{arena.imageUrls.length} Photos</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {arena.imageUrls.map((img, idx) => (
                        <motion.div
                            key={`global-${idx}`}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.05 * idx }}
                            onClick={() => setViewerConfig({ isOpen: true, images: arena.imageUrls, index: idx })}
                            className="aspect-square rounded-2xl md:rounded-3xl overflow-hidden shadow-theme-card border border-border cursor-pointer group hover:scale-[1.02] transition-all"
                        >
                            <img src={img} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        </motion.div>
                    ))}
                    {arena.imageUrls.length === 0 && (
                        <div className="col-span-full py-8 bg-card rounded-3xl border-2 border-dashed border-border flex items-center justify-center text-text-disabled font-black uppercase text-[10px] tracking-widest">
                            No Global Images
                        </div>
                    )}
                </div>
            </div>

            {/* Court Specific Gallery */}
            {arena.courts && arena.courts.length > 0 && (
                <div className="space-y-6 p-4 rounded-[2.5rem] bg-background-secondary/30 border border-border/50">
                    {/* Court Selector */}
                    <div className="space-y-3 px-2">
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-text-disabled">Select Court</h2>
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {arena.courts.map((court, idx) => (
                                <button
                                    key={court.id || idx}
                                    onClick={() => setSelectedCourtIdx(idx)}
                                    className={`px-4 py-2 rounded-xl font-black text-[2.5vw] md:text-[10px] uppercase tracking-widest transition-all border shrink-0 ${selectedCourtIdx === idx ? 'bg-accent text-white border-accent' : 'bg-card text-text-secondary border-border'}`}
                                >
                                    {court.name || `Court ${court.courtNumber}`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {arena.courts[selectedCourtIdx] && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <h2 className="text-xs font-black uppercase tracking-widest text-text-disabled">
                                    {arena.courts[selectedCourtIdx].name || `Court ${arena.courts[selectedCourtIdx].courtNumber}`} Gallery
                                </h2>
                                <span className="text-[10px] font-bold text-text-disabled">{arena.courts[selectedCourtIdx].imageUrls.length} Photos</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                {arena.courts[selectedCourtIdx].imageUrls.map((img, idx) => (
                                    <motion.div
                                        key={`court-${idx}`}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.05 * idx }}
                                        onClick={() => setViewerConfig({ isOpen: true, images: arena.courts![selectedCourtIdx].imageUrls, index: idx })}
                                        className="aspect-square rounded-2xl md:rounded-3xl overflow-hidden shadow-theme-card border border-border cursor-pointer group hover:scale-[1.02] transition-all"
                                    >
                                        <img src={img} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                    </motion.div>
                                ))}
                                {arena.courts[selectedCourtIdx].imageUrls.length === 0 && (
                                    <div className="col-span-full py-8 bg-card rounded-3xl border-2 border-dashed border-border flex items-center justify-center text-text-disabled font-black uppercase text-[10px] tracking-widest">
                                        No Images for this Court
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[var(--fluid-padding)] md:gap-8">
          <div className="md:col-span-2 space-y-[6vw] md:space-y-12">
            {/* Description */}
            {(arena.description || arena.courts?.some(c => c.description)) && (
              <section className="p-[var(--fluid-padding)] md:p-8 bg-card rounded-[var(--fluid-radius)] md:rounded-[2.5rem] border border-border shadow-theme-card">
                <h2 className="text-[3vw] md:text-sm font-black uppercase tracking-widest text-accent mb-[4vw] md:mb-6 flex items-center gap-[2vw] md:gap-3">
                  <Info className="w-[4vw] md:w-5 h-[4vw] md:h-5" /> About Arena
                </h2>
                <div className="space-y-8">
                  {arena.description && (
                    <p className="text-text-secondary leading-relaxed font-medium text-[3.5vw] md:text-base">
                      {arena.description}
                    </p>
                  )}

                  {arena.courts && arena.courts.length > 1 && (
                    <div className="space-y-4 pt-4 border-t border-border/50">
                      <h3 className="text-xs font-black uppercase tracking-widest text-text-primary">Our Courts</h3>
                      <div className="grid grid-cols-1 gap-4">
                        {arena.courts.map(court => (
                          <div key={court.id} className="p-4 rounded-2xl bg-background-secondary border border-border/50">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-black text-sm text-text-primary uppercase tracking-tight">{court.name || `Court ${court.courtNumber}`}</span>
                              {court.imageUrls.length > 0 && (
                                <div className="flex -space-x-2">
                                  {court.imageUrls.slice(0, 3).map((url, i) => (
                                    <div key={i} className="w-6 h-6 rounded-full border border-card overflow-hidden">
                                      <img src={url} className="w-full h-full object-cover" />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            {court.description && <p className="text-xs text-text-secondary leading-relaxed">{court.description}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            <section className="p-[var(--fluid-padding)] md:p-8 bg-card rounded-[var(--fluid-radius)] md:rounded-[2.5rem] border border-border shadow-theme-card">
              <div className="flex justify-between items-center mb-[4vw] md:mb-6">
                <h2 className="text-[3vw] md:text-sm font-black uppercase tracking-widest text-accent flex items-center gap-[2vw] md:gap-3">
                  <MapPin className="w-[4vw] md:w-5 h-[4vw] md:h-5" /> Location
                </h2>
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-[3vw] md:px-4 py-[1.5vw] md:py-2 bg-background-secondary rounded-[3vw] md:rounded-xl text-[2.5vw] md:text-xs font-black uppercase tracking-widest border border-border flex items-center gap-[2vw] md:gap-2 hover:bg-card-elevated transition-all"
                >
                  Open in Maps <ExternalLink className="w-[3vw] md:w-4 h-[3vw] md:h-4" />
                </a>
              </div>
              <div className="space-y-[4vw] md:space-y-6">
                <p className="text-text-primary font-bold text-[3.5vw] md:text-base">{arena.address}</p>
                <div className="rounded-[4vw] md:rounded-[2rem] overflow-hidden border border-border aspect-video relative">
                  <iframe
                    title="Google Maps"
                    src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                  ></iframe>
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-[6vw] md:space-y-8">
            <div className="p-[var(--fluid-padding)] md:p-8 bg-card rounded-[var(--fluid-radius)] md:rounded-[2.5rem] border border-border shadow-theme-card space-y-[4vw] md:space-y-6">
               <div className="flex justify-between items-center">
                  <span className="text-[2.5vw] md:text-xs font-black uppercase tracking-widest text-text-disabled">Status</span>
                  <div className={`flex items-center gap-[1vw] md:gap-1 px-[3vw] md:px-3 py-[1vw] md:py-1 rounded-full ${arena.is_open ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                    {arena.is_open ? <CheckCircle2 className="w-[3vw] md:w-4 h-[3vw] md:h-4" /> : <XCircle className="w-[3vw] md:w-4 h-[3vw] md:h-4" />}
                    <span className="text-[2.8vw] md:text-sm font-black uppercase tracking-widest">{arena.is_open ? 'Open' : 'Closed'}</span>
                  </div>
               </div>

               <div className="flex justify-between items-center">
                  <span className="text-[2.5vw] md:text-xs font-black uppercase tracking-widest text-text-disabled">Rating</span>
                  <div className="flex flex-col items-end gap-[1vw] md:gap-1">
                    <div className="flex items-center gap-[1vw] md:gap-1 bg-success/10 px-[3vw] md:px-3 py-[1vw] md:py-1 rounded-full">
                      <Star className="w-[3vw] md:w-4 h-[3vw] md:h-4 text-success fill-success" />
                      <span className="text-[3.5vw] md:text-lg font-black text-success">{displayRating}</span>
                    </div>
                    {ratingCount > 0 && (
                      <span className="text-[2vw] md:text-[10px] font-black uppercase tracking-widest text-text-disabled flex items-center gap-[1vw] md:gap-1">
                        <Users className="w-[2vw] md:w-3 h-[2vw] md:h-3" /> {ratingCount} reviews
                      </span>
                    )}
                  </div>
               </div>

               <div className="flex justify-between items-center">
                  <span className="text-[2.5vw] md:text-xs font-black uppercase tracking-widest text-text-disabled">No. of Courts</span>
                  <div className="flex items-center gap-[1vw] md:gap-1 bg-accent/10 px-[3vw] md:px-3 py-[1vw] md:py-1 rounded-full text-accent">
                    <LayoutGrid className="w-[3vw] md:w-4 h-[3vw] md:h-4" />
                    <span className="text-[3.5vw] md:text-lg font-black">{arena.numberOfCourts || arena.courts?.length || 1}</span>
                  </div>
               </div>

               <div className="flex justify-between items-center">
                  <span className="text-[2.5vw] md:text-xs font-black uppercase tracking-widest text-text-disabled">Base Price</span>
                  <div className="flex items-center gap-[1vw] md:gap-1">
                    <IndianRupee className="w-[3vw] md:w-4 h-[3vw] md:h-4 text-text-primary" />
                    <span className="text-[4.5vw] md:text-xl font-black text-text-primary">{arena.defaultPrice || basePrice || 0} <span className="text-[2.5vw] md:text-xs opacity-50">/hr</span></span>
                  </div>
               </div>

               <div className="flex justify-between items-center">
                  <span className="text-[2.5vw] md:text-xs font-black uppercase tracking-widest text-text-disabled">Advance</span>
                  <div className="flex items-center gap-[1vw] md:gap-1">
                    {arena.defaultAdvance && arena.defaultAdvance > 0 ? (
                      <>
                        <IndianRupee className="w-[3vw] md:w-4 h-[3vw] md:h-4 text-accent" />
                        <span className="text-[4.5vw] md:text-xl font-black text-accent">{arena.defaultAdvance}</span>
                      </>
                    ) : (
                      <span className="text-[2.5vw] md:text-sm font-bold text-text-disabled">No prices yet</span>
                    )}
                  </div>
               </div>

               <hr className="border-border" />
               <div className="space-y-[3vw] md:space-y-4">
                  <div className="flex items-center gap-[3vw] md:gap-3 text-text-secondary">
                    <Clock className="w-[4vw] md:w-5 h-[4vw] md:h-5 text-accent" />
                    <span className="text-[2.5vw] md:text-xs font-black uppercase tracking-widest">{arena.open_hour}:00 - {arena.close_hour}:00</span>
                  </div>
                  {arena.contact && (
                    <div className="flex items-center gap-[3vw] md:gap-3 text-text-secondary">
                      <Phone className="w-[4vw] md:w-5 h-[4vw] md:h-5 text-accent" />
                      <span className="text-[2.5vw] md:text-xs font-black uppercase tracking-widest">{arena.contact}</span>
                    </div>
                  )}
               </div>
            </div>


          </div>
        </div>
      </div>

      <ImageViewer
          images={viewerConfig.images}
          initialIndex={viewerConfig.index}
          isOpen={viewerConfig.isOpen}
          onClose={() => setViewerConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default ArenaDetailsPage;

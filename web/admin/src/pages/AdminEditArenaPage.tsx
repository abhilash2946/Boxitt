import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { locationService } from '../services/locationService';
import { Location } from '../types';
import LoadingButton from '../components/LoadingButton';
import { ChevronLeft, Save, Info, MapPin, Clock, Phone, Star, ShieldCheck, XCircle, Search } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { AnimatePresence, motion } from 'framer-motion';

import { geocodingService } from '../services/geocodingService';

const AdminEditArenaPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Location>>({});
  const [customAlert, setCustomAlert] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Auto-geocode address changes
  useEffect(() => {
    if (!form.address) return;

    const timer = setTimeout(async () => {
      // Only geocode if coordinates are missing or if we want to force refresh on address change
      // For now, let's auto-fill if they are empty
      if (form.latitude === undefined || form.latitude === null || form.latitude === 0) {
        try {
          const coords = await geocodingService.getCoordinates(form.address!, '');
          if (coords) {
            setForm(prev => ({ ...prev, latitude: coords.latitude, longitude: coords.longitude }));
          }
        } catch (e) {
          console.warn("Auto-geocoding failed:", e);
        }
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [form.address]);

  useEffect(() => {
    if (id) {
      locationService.getLocationById(id)
        .then((data) => {
          if (data) {
            setForm(data);
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching arena:", err);
          setLoading(false);
        });
    }
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let finalValue: any = value;

    if (type === 'checkbox') {
      finalValue = (e.target as HTMLInputElement).checked;
    } else if (type === 'number') {
      finalValue = value === '' ? '' : Number(value);
    }

    setForm((prev) => ({
      ...prev,
      [name]: finalValue,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setSaving(true);
    try {
      const finalForm = { ...form };

      // Auto-geocode if coordinates are missing but address exists
      if (finalForm.address && (finalForm.latitude === undefined || finalForm.latitude === null)) {
        try {
          const coords = await geocodingService.getCoordinates(finalForm.address, '');
          if (coords) {
            finalForm.latitude = coords.latitude;
            finalForm.longitude = coords.longitude;
          }
        } catch (e) {
          console.warn("Manual geocoding fallback failed:", e);
        }
      }

      await locationService.updateLocation(id, finalForm);
      navigate(`/arena/${id}`);
    } catch (err) {
      console.error("Error updating arena:", err);
      setCustomAlert({ message: 'Failed to save changes', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-[var(--btn-height)] h-[var(--btn-height)] border-[1vw] border-border border-t-accent rounded-full animate-spin mb-[4vw]"></div>
        <p className="text-[2.5vw] font-black uppercase tracking-[0.3em] text-text-secondary animate-pulse">Loading Editor...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-[20vw] md:pb-20">
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border p-[4vw] md:p-4">
        <div className="max-w-[90vw] md:max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="p-[2vw] md:p-2 bg-card rounded-[3vw] md:rounded-xl border border-border shadow-sm hover:bg-card-elevated transition-all"
          >
            <ChevronLeft className="w-[var(--icon-size)] h-[var(--icon-size)] md:w-6 md:h-6 text-text-primary" />
          </button>
          <h1 className="text-[5vw] md:text-xl font-black uppercase italic tracking-tighter text-text-primary">
            Edit Arena Details
          </h1>
          <div className="w-[10vw] md:w-10" />
        </div>
      </div>

      <div className="max-w-[90vw] md:max-w-2xl mx-auto p-[4vw] md:p-6">
        <form onSubmit={handleSubmit} className="space-y-[var(--fluid-padding)] md:space-y-8">
          {/* General Information */}
          <section className="space-y-[4vw] md:space-y-4">
            <h2 className="text-[3vw] md:text-xs font-black uppercase tracking-[0.3em] text-text-disabled flex items-center gap-[2vw] md:gap-2">
              <Info className="w-[3vw] h-[3vw] md:w-3 md:h-3" /> Basic Info
            </h2>
            <div className="bg-card p-[var(--fluid-padding)] md:p-6 rounded-[var(--fluid-radius)] md:rounded-[2rem] border border-border shadow-theme-card space-y-[4vw] md:space-y-4">
              <div className="space-y-[2vw] md:space-y-2">
                <label className="text-[2.5vw] md:text-[10px] font-black uppercase tracking-widest ml-[1vw] md:ml-1 text-text-disabled">Arena Name</label>
                <input
                  className="w-full p-[4vw] md:p-4 bg-background-secondary border-[0.5vw] md:border-2 border-transparent focus:border-accent rounded-[4vw] md:rounded-2xl font-bold outline-none transition-all text-[3.8vw] md:text-base"
                  name="name"
                  value={form.name || ''}
                  onChange={handleChange}
                  placeholder="e.g. Lords Cricket Box"
                  required
                />
              </div>
              <div className="space-y-[2vw] md:space-y-2">
                <label className="text-[2.5vw] md:text-[10px] font-black uppercase tracking-widest ml-[1vw] md:ml-1 text-text-disabled">Description</label>
                <textarea
                  className="w-full p-[4vw] md:p-4 bg-background-secondary border-[0.5vw] md:border-2 border-transparent focus:border-accent rounded-[4vw] md:rounded-2xl font-bold outline-none transition-all min-h-[30vw] md:min-h-[120px] text-[3.8vw] md:text-base"
                  name="description"
                  value={form.description || ''}
                  onChange={handleChange}
                  placeholder="Tell players about your arena..."
                />
              </div>
            </div>
          </section>

          {/* Location & Contact */}
          <section className="space-y-[4vw] md:space-y-4">
            <h2 className="text-[3vw] md:text-xs font-black uppercase tracking-[0.3em] text-text-disabled flex items-center gap-[2vw] md:gap-2">
              <MapPin className="w-[3vw] h-[3vw] md:w-3 md:h-3" /> Location & Contact
            </h2>
            <div className="bg-card p-[var(--fluid-padding)] md:p-6 rounded-[var(--fluid-radius)] md:rounded-[2rem] border border-border shadow-theme-card space-y-[4vw] md:space-y-4">
              <div className="space-y-[2vw] md:space-y-2">
                <label className="text-[2.5vw] md:text-[10px] font-black uppercase tracking-widest ml-[1vw] md:ml-1 text-text-disabled">Address</label>
                <div className="relative">
                  <input
                    className="w-full p-[4vw] md:p-4 pr-12 bg-background-secondary border-[0.5vw] md:border-2 border-transparent focus:border-accent rounded-[4vw] md:rounded-2xl font-bold outline-none transition-all text-[3.8vw] md:text-base"
                    name="address"
                    value={form.address || ''}
                    onChange={handleChange}
                    placeholder="Full physical address"
                    required
                  />
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      if (!form.address || isVerifying) return;
                      setIsVerifying(true);
                      try {
                        const result = await geocodingService.searchAddress(form.address);
                        if (result) {
                          setForm(prev => ({
                            ...prev,
                            address: result.displayName,
                            latitude: result.latitude,
                            longitude: result.longitude
                          }));
                        } else {
                          setCustomAlert({ message: 'No matching location found', type: 'error' });
                        }
                      } catch (err) {
                        setCustomAlert({ message: 'Search failed', type: 'error' });
                      } finally {
                        setIsVerifying(false);
                      }
                    }}
                    disabled={isVerifying || saving}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl hover:bg-accent/10 text-accent transition-all active:scale-90 disabled:opacity-50"
                  >
                    {isVerifying ? <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /> : <Search className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-[4vw] md:gap-4">
                <div className="space-y-[2vw] md:space-y-2">
                  <label className="text-[2.5vw] md:text-[10px] font-black uppercase tracking-widest ml-[1vw] md:ml-1 text-text-disabled">Contact Number</label>
                  <input
                    className="w-full p-[4vw] md:p-4 bg-background-secondary border-[0.5vw] md:border-2 border-transparent focus:border-accent rounded-[4vw] md:rounded-2xl font-bold outline-none transition-all text-[3.8vw] md:text-base"
                    name="contact"
                    value={form.contact || ''}
                    onChange={handleChange}
                    placeholder="Mobile number"
                  />
                </div>
                <div className="space-y-[2vw] md:space-y-2">
                  <label className="text-[2.5vw] md:text-[10px] font-black uppercase tracking-widest ml-[1vw] md:ml-1 text-text-disabled">Email Address</label>
                  <input
                    className="w-full p-[4vw] md:p-4 bg-background-secondary border-[0.5vw] md:border-2 border-transparent focus:border-accent rounded-[4vw] md:rounded-2xl font-bold outline-none transition-all text-[3.8vw] md:text-base"
                    name="email"
                    type="email"
                    value={form.email || ''}
                    onChange={handleChange}
                    placeholder="Support email"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Operation Details */}
          <section className="space-y-[4vw] md:space-y-4">
            <h2 className="text-[3vw] md:text-xs font-black uppercase tracking-[0.3em] text-text-disabled flex items-center gap-[2vw] md:gap-2">
              <Clock className="w-[3vw] h-[3vw] md:w-3 md:h-3" /> Operation & Pricing
            </h2>
            <div className="bg-card p-[var(--fluid-padding)] md:p-6 rounded-[var(--fluid-radius)] md:rounded-[2rem] border border-border shadow-theme-card space-y-[6vw] md:space-y-6">
              <div className="grid grid-cols-2 gap-[4vw] md:gap-4">
                <div className="space-y-[2vw] md:space-y-2">
                  <label className="text-[2.5vw] md:text-[10px] font-black uppercase tracking-widest ml-[1vw] md:ml-1 text-text-disabled">Display Rating (0-5)</label>
                  <div className="relative">
                    <Star className="absolute left-[4vw] md:left-4 top-1/2 -translate-y-1/2 w-[4vw] h-[4vw] md:w-4 md:h-4 text-accent" />
                    <input
                      className="w-full pl-[12vw] md:pl-12 pr-[4vw] md:pr-4 py-[4vw] md:py-4 bg-background-secondary border-[0.5vw] md:border-2 border-transparent focus:border-accent rounded-[4vw] md:rounded-2xl font-bold outline-none transition-all text-[3.8vw] md:text-base"
                      name="rating"
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={form.rating || ''}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="space-y-[2vw] md:space-y-2">
                  <label className="text-[2.5vw] md:text-[10px] font-black uppercase tracking-widest ml-[1vw] md:ml-1 text-text-disabled">Base Price (₹)</label>
                  <input
                    className="w-full p-[4vw] md:p-4 bg-background-secondary border-[0.5vw] md:border-2 border-transparent focus:border-accent rounded-[4vw] md:rounded-2xl font-bold outline-none transition-all text-[3.8vw] md:text-base"
                    name="minAdvance"
                    type="number"
                    value={form.minAdvance || ''}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-[2vw] md:space-y-2">
                  <label className="text-[2.5vw] md:text-[10px] font-black uppercase tracking-widest ml-[1vw] md:ml-1 text-text-disabled">Number of Courts</label>
                  <input
                    className="w-full p-[4vw] md:p-4 bg-background-secondary border-[0.5vw] md:border-2 border-transparent focus:border-accent rounded-[4vw] md:rounded-2xl font-bold outline-none transition-all text-[3.8vw] md:text-base"
                    name="numberOfCourts"
                    type="number"
                    min="1"
                    max="10"
                    value={form.numberOfCourts || 1}
                    onChange={handleChange}
                  />
                </div>
                {(form.name?.toLowerCase().includes('swimming') || (form as any).sport?.toLowerCase().includes('swimming')) && (
                  <div className="space-y-[2vw] md:space-y-2">
                    <label className="text-[2.5vw] md:text-[10px] font-black uppercase tracking-widest ml-[1vw] md:ml-1 text-text-disabled">Max Slot Capacity / Pool Limit</label>
                    <input
                      className="w-full p-[4vw] md:p-4 bg-background-secondary border-[0.5vw] md:border-2 border-transparent focus:border-accent rounded-[4vw] md:rounded-2xl font-bold outline-none transition-all text-[3.8vw] md:text-base"
                      name="maxCapacity"
                      type="number"
                      min="1"
                      max="500"
                      value={form.maxCapacity ?? form.max_capacity ?? ''}
                      onChange={handleChange}
                    />
                  </div>
                )}
              </div>

              <div className="p-[4vw] md:p-4 bg-background-secondary rounded-[4vw] md:rounded-2xl border border-border space-y-[4vw] md:space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-[3vw] md:gap-3">
                    <ShieldCheck className="w-[5vw] h-[5vw] md:w-5 md:h-5 text-accent" />
                    <span className="text-[2.5vw] md:text-[10px] font-black uppercase tracking-widest text-text-primary">Advance Booking Required</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="advanceBookingRequired"
                      checked={!!form.advanceBookingRequired}
                      onChange={handleChange}
                      className="sr-only peer"
                    />
                    <div className="w-[11vw] h-[var(--icon-size)] md:w-11 md:h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[0.5vw] md:after:top-[2px] after:left-[0.5vw] md:after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-[5vw] md:after:h-5 after:w-[5vw] md:after:w-5 after:transition-all peer-checked:bg-accent"></div>
                  </label>
                </div>
                <p className="text-[2.2vw] md:text-[9px] font-bold text-text-disabled uppercase">When enabled, users must pay the advance amount to confirm their booking online.</p>
              </div>
            </div>
          </section>

          <LoadingButton
            type="submit"
            loading={saving}
            disabled={isVerifying}
            className="w-full py-[5vw] md:py-5 text-white rounded-[4vw] md:rounded-2xl font-black uppercase tracking-[0.2em] shadow-theme-elevated text-[3.8vw] md:text-sm disabled:opacity-50"
            style={{ backgroundColor: theme.colors.accent }}
            icon={<Save className="w-[5vw] h-[5vw] md:w-5 md:h-5" />}
            loadingText="Saving..."
          >
            Save Changes
          </LoadingButton>
        </form>
      </div>

      <AnimatePresence>
        {customAlert && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-[var(--fluid-padding)] overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCustomAlert(null)}
              className="absolute inset-0 backdrop-blur-md"
              style={{ backgroundColor: theme.name === 'light' ? 'rgba(15, 23, 42, 0.3)' : 'rgba(0, 0, 0, 0.7)' }}
            />
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="border rounded-[var(--fluid-radius)] w-full max-w-[85vw] p-[var(--fluid-padding)] text-center transition-all duration-300 relative z-10"
              style={{
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                boxShadow: theme.elevation.modal,
                backdropFilter: theme.name !== 'light' ? 'blur(10px)' : 'none'
              }}
            >
              <div className="w-[16vw] h-[16vw] rounded-[4vw] flex items-center justify-center mx-auto mb-[6vw] shadow-theme-elevated bg-error text-white">
                <XCircle className="w-[10vw] h-[10vw]" />
              </div>
              <h3 className="text-[5vw] font-black mb-[3vw] uppercase italic tracking-tighter" style={{ color: theme.colors.textPrimary }}>Error</h3>
              <p className="font-bold mb-[var(--fluid-padding)] leading-relaxed text-[3.5vw]" style={{ color: theme.colors.textSecondary }}>{customAlert.message}</p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCustomAlert(null)}
                className="w-full py-[4vw] bg-accent text-white rounded-[3vw] font-black uppercase tracking-widest shadow-theme-elevated text-[2.8vw]"
              >
                Confirm
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminEditArenaPage;

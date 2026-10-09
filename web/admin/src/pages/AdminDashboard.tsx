import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { storage } from '../services/storage';
import { Booking, BookingStatus, Location, User, Court } from '../types';
import BookingPage from './BookingPage';
import { getPricingForLocation, upsertPricing, deletePricing, Pricing } from '../services/pricingService';
import { bookingService } from '../services/bookingService';
import { locationService } from '../services/locationService';
import { scheduleService, DaySchedule } from '../services/scheduleService';
import { supabase } from '../services/supabase';
import { supabaseStorage } from '../services/supabaseStorage';
import LoadingButton from '../components/LoadingButton';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, User as UserIcon, Lock, ShieldCheck, Trash2, Plus, CheckCircle2, XCircle, Save, Check, LayoutDashboard, Database, BarChart3, ShieldAlert, BadgeIndianRupee, ChevronRight, Settings, Clock, Navigation, LocateFixed, Edit, Info, Star, Phone, Calendar, Eye, Image as ImageIcon, Search, ChevronLeft, ChevronDown, ChevronUp, Loader2, IndianRupee, Gamepad2, Monitor, Sparkles, MessageSquare } from 'lucide-react';
import { gameZoneService } from '../services/gameZoneService';
import { handleError } from '../services/errorHandler';
import { useTheme } from '../contexts/ThemeContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';
import { DatePickerModal } from '../components/CustomPickers';
import ImageViewer from '../components/ImageViewer';

import { geocodingService } from '../services/geocodingService';
import { getLocalISODate } from '../constants';
import { forceScrollTop } from '../utils/scroll';

interface AdminDashboardProps {
  selectedLocation: Location;
  onLocationChange?: (loc: Location) => void;
  user: User | null;
  onAlert?: (msg: string, type: 'success' | 'error' | 'info') => void;
  onConfirm?: (config: {
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
  }) => void;
}

const LocationCard: React.FC<{
  loc: Location;
  role: 'admin' | 'superadmin' | null;
  selectedLocation: Location;
  onUpdate: (locId: string, updates: Partial<Location>) => Promise<void>;
  onDelete: (id: string) => void;
  isProcessing?: boolean;
  triggerAlert: (msg: string, type?: 'success' | 'error' | 'info') => void;
  dbVersion: number;
}> = ({ loc, role, selectedLocation, onUpdate, onDelete, isProcessing, triggerAlert, dbVersion }) => {
  const { theme } = useTheme();
  const { checkAndPrompt, permissions } = usePermissions();

  // LOCAL DRAFT STATE: Handle all changes locally first to eliminate lag
  const [draft, setDraft] = useState<Location>(() => {
      const d = { ...loc };
      // Ensure Court 1 placeholder if missing
      if (!d.courts || d.courts.length === 0) {
          d.courts = [{
              id: `temp-${loc.id}-1`,
              locationId: loc.id,
              courtNumber: 1,
              imageUrls: [],
              description: ''
          }];
      }
      return d;
  });
  const [persistedLoc, setPersistedLoc] = useState<Location>(loc);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCourtIdx, setSelectedCourtIdx] = useState(0);

  const isSwimmingArena = useMemo(() => {
    if (!draft) return false;
    const name = (draft.name || '').toLowerCase();
    const sport = ((draft as any).sport || '').toLowerCase();
    const supported = Array.isArray(draft.supportedSports) ? draft.supportedSports.map(s => String(s).toLowerCase()) : [];
    return name.includes('swimming') || sport.includes('swimming') || supported.some(s => s.includes('swimming'));
  }, [draft]);

  // Gallery view and delete mode states
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [viewerConfig, setViewerConfig] = useState<{ isOpen: boolean; images: string[]; index: number }>({
      isOpen: false,
      images: [],
      index: 0
  });

  // NEW: Track files to upload (binaries) and previews
  const [pendingGlobalFiles, setPendingGlobalFiles] = useState<File[]>([]);
  const [pendingCourtFiles, setPendingCourtFiles] = useState<{ [courtIdx: number]: File[] }>({});
  const [pendingDeletions, setPendingDeletions] = useState<string[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{ type: 'global' | 'court', courtIdx?: number } | null>(null);

  const [maxCapInput, setMaxCapInput] = useState<string>(String(loc.maxCapacity ?? loc.max_capacity ?? 50));
  const [showDeleteCourtModal, setShowDeleteCourtModal] = useState(false);
  const [courtToDeleteIdx, setCourtToDeleteIdx] = useState<number | null>(null);

  useEffect(() => {
    setMaxCapInput(String(draft.maxCapacity ?? draft.max_capacity ?? 50));
  }, [draft.maxCapacity, draft.max_capacity, loc.id]);

  const handleExecuteDeleteCourt = (targetIdx: number) => {
    setDraft(prev => {
      const currentCourts = prev.courts || [];
      const courtToRemove = currentCourts[targetIdx] || currentCourts.find(c => c.courtNumber === targetIdx + 1);

      const remainingCourts = currentCourts
        .filter((_, i) => i !== targetIdx)
        .map((c, i) => ({
          ...c,
          courtNumber: i + 1,
          name: c.name?.startsWith('Court ') ? `Court ${i + 1}` : c.name
        }));

      const newCount = Math.max(1, (prev.numberOfCourts || 1) - 1);

      if (selectedCourtIdx >= newCount) {
        setSelectedCourtIdx(Math.max(0, newCount - 1));
      }

      if (courtToRemove && courtToRemove.id && !courtToRemove.id.startsWith('temp-')) {
        setPendingDeletions(prevDeletions => [...prevDeletions, `court:${courtToRemove.id}`]);
      }

      return {
        ...prev,
        numberOfCourts: newCount,
        courts: remainingCourts
      };
    });

    setShowDeleteCourtModal(false);
    setCourtToDeleteIdx(null);
  };

  // Auto-geocode address changes
  useEffect(() => {
    if (!draft.address || draft.address === loc.address && draft.latitude && draft.longitude) return;

    const timer = setTimeout(async () => {
      try {
        const coords = await geocodingService.getCoordinates(draft.address, '');
        if (coords) {
          setDraft(prev => ({ ...prev, latitude: coords.latitude, longitude: coords.longitude }));
        }
      } catch (e) {
        console.warn("Auto-geocoding failed:", e);
      }
    }, 1500); // 1.5s debounce

    return () => clearTimeout(timer);
  }, [draft.address]);

  // Sync baseline ONLY on real database changes (controlled by dbVersion from parent)
  useEffect(() => {
    setPersistedLoc(loc);

    // When DB refreshes, reset transient state
    setDraft(loc);
    setPendingGlobalFiles([]);
    setPendingCourtFiles({});
    setPendingDeletions([]);
  }, [loc.id, dbVersion]);

  const hasChanges = useMemo(() => {
    // Compare against the REAL database state (persistedLoc)
    const d = JSON.stringify({ ...draft, courts: draft.courts?.map(c => ({ ...c, id: '' })) });
    const p = JSON.stringify({ ...persistedLoc, courts: persistedLoc.courts?.map(c => ({ ...c, id: '' })) });

    const hasFiles = pendingGlobalFiles.length > 0 || Object.values(pendingCourtFiles).some(files => files.length > 0);
    const missingCourts = (persistedLoc.courts?.length || 0) < (draft.numberOfCourts || 1);

    return d !== p || hasFiles || missingCourts;
  }, [draft, persistedLoc, pendingGlobalFiles, pendingCourtFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !uploadTarget) return;

    const newFiles = Array.from(files).filter(f => f.size <= 2 * 1024 * 1024);
    if (uploadTarget.type === 'global') {
        setPendingGlobalFiles(prev => [...prev, ...newFiles]);
    } else if (uploadTarget.courtIdx !== undefined) {
        setPendingCourtFiles(prev => ({
            ...prev,
            [uploadTarget.courtIdx!]: [...(prev[uploadTarget.courtIdx!] || []), ...newFiles]
        }));
    }
    setUploadTarget(null);
  };

  const handleSave = async () => {
    if (isSaving) return;

    if (!hasChanges) {
        triggerAlert("The database is up to date!", 'info');
        return;
    }

    setIsSaving(true);
    try {
      // 1. Upload pending binaries to Supabase Storage
      const arenaFolder = `${draft.name.replace(/[^a-z0-9]/gi, '_')}_${draft.id.substring(0, 8)}`;

      // Upload Global Files
      const newGlobalUrls = [];
      for (const file of pendingGlobalFiles) {
          const fileName = `${arenaFolder}/Arena_Global/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '_')}`;
          const url = await supabaseStorage.uploadFile('arenas', fileName, file);
          newGlobalUrls.push(url);
      }

      // 2. Prepare Final Data Structure
      const finalImageUrls = [...draft.imageUrls, ...newGlobalUrls];
      const courtUpdates = [];

      if (draft.courts) {
          for (let i = 0; i < draft.courts.length; i++) {
              const court = draft.courts[i];
              const newCourtUrls = [];
              const courtFiles = pendingCourtFiles[i] || [];

              if (courtFiles.length > 0) {
                  const courtFolder = court.name?.replace(/[^a-z0-9]/gi, '_') || `Court_${court.courtNumber}`;
                  for (const file of courtFiles) {
                      const fileName = `${arenaFolder}/${courtFolder}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '_')}`;
                      const url = await supabaseStorage.uploadFile('courts', fileName, file);
                      newCourtUrls.push(url);
                  }
              }

              courtUpdates.push({
                  id: court.id,
                  courtNumber: court.courtNumber,
                  imageUrls: [...court.imageUrls, ...newCourtUrls],
                  description: court.description,
                  maxCapacity: court.maxCapacity ?? court.max_capacity
              });
          }
      }

      // 3. Perform atomic update via parent
      await (onUpdate as any)(loc.id, {
        name: draft.name,
        address: draft.address,
        email: draft.email,
        latitude: draft.latitude,
        longitude: draft.longitude,
        numberOfCourts: draft.numberOfCourts,
        maxCapacity: draft.maxCapacity ?? draft.max_capacity ?? 50,
        max_capacity: draft.maxCapacity ?? draft.max_capacity ?? 50,
        is_open: draft.is_open,
        imageUrls: finalImageUrls
      }, courtUpdates);

      // 4. Cleanup deleted images from Supabase Storage and deleted courts
      for (const item of pendingDeletions) {
          try {
              if (item.startsWith('court:')) {
                const courtId = item.split('court:')[1];
                await locationService.deleteCourt(courtId);
              } else {
                const bucket = item.includes('/courts/') ? 'courts' : 'arenas';
                const path = item.split(`/${bucket}/`)[1];
                if (path) await supabaseStorage.deleteFile(bucket, path);
              }
          } catch (e) { console.error("Storage/court cleanup failed:", e); }
      }

      triggerAlert("All changes saved and uploaded successfully!", 'success');
    } catch (err) {
      console.error("Save error:", err);
      triggerAlert("Failed to save changes. Please try again.", 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveImagePreview = (idx: number, type: 'existing' | 'pending', courtIdx?: number) => {
    if (type === 'existing') {
        let removedUrl = '';
        if (courtIdx !== undefined) {
            setDraft(prev => {
                const court = prev.courts?.[courtIdx];
                removedUrl = court?.imageUrls[idx] || '';
                return {
                    ...prev,
                    courts: prev.courts?.map((c, i) => i === courtIdx ? { ...c, imageUrls: c.imageUrls.filter((_, j) => j !== idx) } : c)
                };
            });
        } else {
            setDraft(prev => {
                removedUrl = prev.imageUrls[idx];
                return { ...prev, imageUrls: prev.imageUrls.filter((_, i) => i !== idx) };
            });
        }
        if (removedUrl) setPendingDeletions(prev => [...prev, removedUrl]);
    } else {
        // Pending
        if (courtIdx !== undefined) {
            setPendingCourtFiles(prev => ({
                ...prev,
                [courtIdx]: prev[courtIdx].filter((_, i) => i !== idx)
            }));
        } else {
            setPendingGlobalFiles(prev => prev.filter((_, i) => i !== idx));
        }
    }
  };

  const handleGetCurrentLocation = async () => {
    if (permissions.location !== 'allow') {
      await checkAndPrompt('location', true, false, true);
      return;
    }

    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setDraft(prev => ({ ...prev, latitude, longitude }));
          setIsLocating(false);
          triggerAlert("Current location fetched successfully!", "success");
        },
        (error) => {
          console.error("Error getting current location:", error);
          setIsLocating(false);
          triggerAlert("Unable to retrieve location. Please ensure GPS is enabled.", "error");
        }
      );
    } else {
      triggerAlert("Geolocation is not supported by your browser.", "error");
    }
  };

  const currentCourt = draft.courts?.find(c => c.courtNumber === selectedCourtIdx + 1);
  const isGameZoneLocation = useMemo(() => {
    if (!draft) return false;
    const name = (draft.name || '').toLowerCase();
    const sport = ((draft as any).sport || '').toLowerCase();
    const supported = Array.isArray(draft.supportedSports) ? draft.supportedSports.map(s => String(s).toLowerCase()) : [];
    return name.includes('game zone') || name.includes('gamezone') || name.includes('gaming') || sport.includes('game') || sport.includes('zone') || supported.some(s => s.includes('game') || s.includes('zone'));
  }, [draft]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-[var(--fluid-padding)] md:p-6 border space-y-[var(--fluid-padding)] md:space-y-6 relative overflow-hidden group transition-all duration-300`}
      style={{
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.large,
          boxShadow: theme.elevation.card
      }}
    >
      <div className="absolute top-0 right-0 w-[32vw] h-[32vw] md:w-32 md:h-32 blur-3xl rounded-full opacity-10 pointer-events-none" style={{ backgroundColor: theme.colors.accent }} />

      <div className="space-y-[4vw] md:space-y-4">
        {isGameZoneLocation && (
          <div className="p-4 bg-background-secondary rounded-2xl border border-border text-center">
            <p className="text-xs font-black uppercase tracking-widest text-text-secondary">Game Zone uses Platforms instead of Courts. Manage platforms in the Game Zone tab.</p>
          </div>
        )}
        {!isGameZoneLocation && (
          <>
            <div className="flex justify-between items-center">
              <label className="text-[2.5vw] md:text-[10px] font-black uppercase tracking-widest block ml-[1vw] md:ml-1" style={{ color: theme.colors.textDisabled }}>Court Management</label>
              <div className="flex items-center gap-3 bg-background-secondary p-1 rounded-xl border border-border">
                <button onClick={() => {
                  if ((draft.numberOfCourts || 1) > 1) {
                    setCourtToDeleteIdx(selectedCourtIdx);
                    setShowDeleteCourtModal(true);
                  }
                }}
                        className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center font-black text-lg text-text-primary">-</button>
                <span className="font-black text-sm px-2 text-text-primary">{draft.numberOfCourts || 1} Courts</span>
                <button onClick={() => setDraft(prev => {
                    const newCount = Math.min(10, (prev.numberOfCourts || 1) + 1);
                    // Ensure placeholder court exists in draft for UI interaction
                    let newCourts = [...(prev.courts || [])];

                    // Also ensure Court 1 is present if list is empty
                    if (newCourts.length === 0 && newCount > 0) {
                         newCourts.push({
                            id: `temp-${loc.id}-1`,
                            locationId: loc.id,
                            courtNumber: 1,
                            name: 'Court 1',
                            imageUrls: [],
                            description: '',
                            maxCapacity: prev.maxCapacity || 50
                        });
                    }

                    if (!newCourts.find(c => c.courtNumber === newCount)) {
                        newCourts.push({
                            id: `temp-${loc.id}-${newCount}`,
                            locationId: loc.id,
                            courtNumber: newCount,
                            name: `Court ${newCount}`,
                            imageUrls: [],
                            description: '',
                            maxCapacity: prev.maxCapacity || 50
                        });
                    }
                    return { ...prev, numberOfCourts: newCount, courts: newCourts };
                })}
                        className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center font-black text-lg text-text-primary">+</button>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {Array.from({ length: draft.numberOfCourts || 1 }).map((_, idx) => {
                const court = draft.courts?.find(c => c.courtNumber === idx + 1) || draft.courts?.[idx];
                const isSelected = selectedCourtIdx === idx;
                return (
                  <div key={idx} className="flex items-center shrink-0">
                    <button
                      onClick={() => setSelectedCourtIdx(idx)}
                      className={`px-4 py-2 rounded-xl font-black text-[2.5vw] md:text-[10px] uppercase tracking-widest transition-all border ${isSelected ? 'bg-accent text-white border-accent' : 'bg-background-secondary text-text-secondary border-border'}`}
                    >
                      {court?.name || `Court ${idx + 1}`}
                    </button>
                    {(draft.numberOfCourts || 1) > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCourtToDeleteIdx(idx);
                          setShowDeleteCourtModal(true);
                        }}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors ml-1"
                        title={`Delete ${court?.name || `Court ${idx + 1}`}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* GALLERY UI FIX: Separate Global Arena Gallery from Specific Court Gallery */}
        <div className="space-y-6 pt-2">
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <label className="text-[2.5vw] md:text-[10px] font-black uppercase tracking-widest block ml-[1vw] md:ml-1" style={{ color: theme.colors.textDisabled }}>Arena Global Gallery</label>
                    <button
                        onClick={() => setIsDeleteMode(!isDeleteMode)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-[2.8vw] md:text-[9px] font-black uppercase tracking-widest ${isDeleteMode ? 'bg-error text-white border-error shadow-lg scale-105' : 'bg-background-secondary text-text-secondary border-border'}`}
                    >
                        {isDeleteMode ? <Trash2 className="w-3 h-3" /> : <Settings className="w-3 h-3" />}
                        {isDeleteMode ? 'Delete Mode ON' : 'View Mode'}
                    </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-[3vw] md:gap-3">
                    {/* Existing Images */}
                    {(draft.imageUrls || []).map((url, idx) => (
                        <div key={`arena-ex-${idx}`} className="aspect-square rounded-[4vw] md:rounded-2xl overflow-hidden group shadow-2xl relative border cursor-pointer"
                             onClick={() => {
                                 if (isDeleteMode) handleRemoveImagePreview(idx, 'existing');
                                 else setViewerConfig({ isOpen: true, images: draft.imageUrls || [], index: idx });
                             }}
                             style={{ borderColor: theme.colors.border }}>
                            <img src={url} className="w-full h-full object-cover" />
                            <div className={`absolute inset-0 bg-red-600/80 items-center justify-center text-white transition-all flex ${isDeleteMode ? 'opacity-100' : 'opacity-0 group-hover:bg-black/20 group-hover:opacity-100'}`}>
                                {isDeleteMode ? <Trash2 className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
                            </div>
                        </div>
                    ))}
                    {/* Pending Images */}
                    {pendingGlobalFiles.map((file, idx) => (
                        <div key={`arena-pending-${idx}`} className="aspect-square rounded-[4vw] md:rounded-2xl overflow-hidden group shadow-2xl relative border border-accent animate-pulse" style={{ borderColor: theme.colors.accent }}>
                            <img src={URL.createObjectURL(file)} className="w-full h-full object-cover opacity-50" />
                            <div className="absolute inset-0 flex items-center justify-center bg-accent/20">
                                <Save className="w-6 h-6 text-white" />
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); handleRemoveImagePreview(idx, 'pending'); }}
                                    className="absolute top-1 right-1 bg-red-600 rounded-full p-1 text-white z-10">
                                <XCircle className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    <button onClick={() => { setUploadTarget({ type: 'global' }); fileInputRef.current?.click(); }}
                            className="aspect-square rounded-[4vw] md:rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-[2vw] md:gap-2 transition-all shadow-inner"
                            style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border, color: theme.colors.textDisabled }}>
                        <Plus className="w-6 h-6" />
                        <span className="text-[2.2vw] md:text-[10px] font-black uppercase tracking-widest text-center px-1">Add to Arena</span>
                    </button>
                </div>
            </div>

            {!isGameZoneLocation && currentCourt && (
                <div className="space-y-3 p-4 rounded-3xl border border-dashed border-border/60 bg-background-secondary/20">
                    <label className="text-[2.5vw] md:text-[10px] font-black uppercase tracking-widest block ml-[1vw] md:ml-1" style={{ color: theme.colors.textDisabled }}>
                        {currentCourt.name || `Court ${selectedCourtIdx + 1}`} Gallery
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-[3vw] md:gap-3">
                        {/* Existing Images */}
                        {(currentCourt.imageUrls || []).map((url, idx) => (
                            <div key={`court-ex-${idx}`} className="aspect-square rounded-[4vw] md:rounded-2xl overflow-hidden group shadow-2xl relative border cursor-pointer"
                                 onClick={() => {
                                     if (isDeleteMode) handleRemoveImagePreview(idx, 'existing', selectedCourtIdx);
                                     else setViewerConfig({ isOpen: true, images: currentCourt.imageUrls || [], index: idx });
                                 }}
                                 style={{ borderColor: theme.colors.border }}>
                                <img src={url} className="w-full h-full object-cover" />
                                <div className={`absolute inset-0 bg-red-600/80 items-center justify-center text-white transition-all flex ${isDeleteMode ? 'opacity-100' : 'opacity-0 group-hover:bg-black/20 group-hover:opacity-100'}`}>
                                    {isDeleteMode ? <Trash2 className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
                                </div>
                            </div>
                        ))}
                        {/* Pending Images */}
                        {(pendingCourtFiles[selectedCourtIdx] || []).map((file, idx) => (
                            <div key={`court-pending-${idx}`} className="aspect-square rounded-[4vw] md:rounded-2xl overflow-hidden group shadow-2xl relative border border-accent animate-pulse" style={{ borderColor: theme.colors.accent }}>
                                <img src={URL.createObjectURL(file)} className="w-full h-full object-cover opacity-50" />
                                <div className="absolute inset-0 flex items-center justify-center bg-accent/20">
                                    <Save className="w-6 h-6 text-white" />
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); handleRemoveImagePreview(idx, 'pending', selectedCourtIdx); }}
                                        className="absolute top-1 right-1 bg-red-600 rounded-full p-1 text-white z-10">
                                    <XCircle className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        <button onClick={() => { setUploadTarget({ type: 'court', courtIdx: selectedCourtIdx }); fileInputRef.current?.click(); }}
                                className="aspect-square rounded-[4vw] md:rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-[2vw] md:gap-2 transition-all shadow-inner"
                                style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border, color: theme.colors.textDisabled }}>
                            <Plus className="w-6 h-6" />
                            <span className="text-[2.2vw] md:text-[10px] font-black uppercase tracking-widest text-center px-1">Add to Court</span>
                        </button>
                    </div>

                    {isSwimmingArena && (
                      <div className="pt-3 border-t border-border/40 space-y-1">
                          <label className="text-[2.5vw] md:text-[10px] font-black uppercase tracking-widest block text-text-disabled">
                            {currentCourt.name || `Court ${selectedCourtIdx + 1}`} Max Slot Capacity
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="500"
                            value={currentCourt.maxCapacity ?? currentCourt.max_capacity ?? ''}
                            onChange={e => {
                              const val = e.target.value;
                              const num = val === '' ? undefined : parseInt(val, 10);
                              setDraft(prev => ({
                                ...prev,
                                courts: prev.courts?.map((c, i) => i === selectedCourtIdx ? { ...c, maxCapacity: num, max_capacity: num } : c)
                              }));
                            }}
                            className="w-full p-3 rounded-2xl font-black border-2 border-transparent outline-none text-sm shadow-inner"
                            style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary }}
                            placeholder="e.g. 50"
                          />
                      </div>
                    )}
                </div>
            )}
        </div>

        <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple accept="image/*" className="hidden" />

        <ImageViewer
            images={viewerConfig.images}
            initialIndex={viewerConfig.index}
            isOpen={viewerConfig.isOpen}
            onClose={() => setViewerConfig(prev => ({ ...prev, isOpen: false }))}
        />

        <div className="flex gap-[2vw] md:gap-2">
          {role === 'superadmin' && (
            <button onClick={() => onDelete(loc.id)} className="mt-[4vw] md:mt-4 px-[var(--fluid-padding)] md:px-6 py-[2vw] md:py-2 rounded-[3vw] md:rounded-xl text-[2.5vw] md:text-xs font-black uppercase tracking-widest transition-all shadow-theme-card active:translate-y-0.5"
                    style={{ backgroundColor: `${theme.colors.error}15`, color: theme.colors.error }}>Remove Arena</button>
          )}
          {draft.latitude && draft.longitude && (
            <button onClick={() => window.open(`https://www.google.com/maps?q=${draft.latitude},${draft.longitude}`, "_blank")} className="mt-[4vw] md:mt-4 px-[var(--fluid-padding)] md:px-6 py-[2vw] md:py-2 rounded-[3vw] md:rounded-xl text-[2.5vw] md:text-xs font-black uppercase tracking-widest transition-all shadow-theme-card active:translate-y-0.5 flex items-center gap-[2vw] md:gap-2"
                    style={{ backgroundColor: '#1a73e8', color: 'white' }}>
              <Navigation className="w-[3.5vw] h-[3.5vw] md:w-4 md:h-4" /> Directions
            </button>
          )}
        </div>
      </div>

      <div className="space-y-[6vw] md:space-y-6">
        <div className="space-y-[2vw] md:space-y-2">
          <label className="text-[2.5vw] md:text-[10px] font-black uppercase tracking-widest ml-[1vw] md:ml-1" style={{ color: theme.colors.textDisabled }}>Arena Name</label>
          <input
            type="text"
            value={draft.name}
            onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
            className="w-full p-[4vw] md:p-4 rounded-[4vw] md:rounded-2xl font-black text-[4.5vw] md:text-lg border-2 border-transparent outline-none transition-all shadow-inner"
            style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary }}
          />
        </div>
        <div className="space-y-[2vw] md:space-y-2">
          <label className="text-[2.5vw] md:text-[10px] font-black uppercase tracking-widest ml-[1vw] md:ml-1" style={{ color: theme.colors.textDisabled }}>Email</label>
          <input
            type="email"
            value={draft.email}
            onChange={e => setDraft(prev => ({ ...prev, email: e.target.value }))}
            className="w-full p-[4vw] md:p-4 rounded-[4vw] md:rounded-2xl font-black text-[4.5vw] md:text-lg border-2 border-transparent outline-none transition-all shadow-inner"
            style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary }}
          />
        </div>
        <div className="space-y-[2vw] md:space-y-2">
          <label className="text-[2.5vw] md:text-[10px] font-black uppercase tracking-widest ml-[1vw] md:ml-1" style={{ color: theme.colors.textDisabled }}>Full Address</label>
          <div className="relative group/address">
            <input
              type="text"
              value={draft.address}
              onChange={e => setDraft(prev => ({ ...prev, address: e.target.value }))}
              className="w-full p-[4vw] md:p-4 pr-[12vw] md:pr-12 rounded-[4vw] md:rounded-2xl font-black text-[3.5vw] md:text-sm border-2 border-transparent outline-none transition-all shadow-inner"
              style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary }}
              placeholder="Arena Physical Address"
            />
            <button
              disabled={isVerifying || isLocating}
              onClick={async (e) => {
                e.preventDefault();
                if (!draft.address || isVerifying) return;
                setIsVerifying(true);
                try {
                  const result = await geocodingService.searchAddress(draft.address);
                  if (result) {
                    setDraft(prev => ({
                      ...prev,
                      address: result.displayName,
                      latitude: result.latitude,
                      longitude: result.longitude
                    }));
                    triggerAlert("Location verified and updated!", 'success');
                  } else {
                    triggerAlert("No matching location found.", 'error');
                  }
                } catch (err) {
                  triggerAlert("Search failed. Please try again.", 'error');
                } finally {
                  setIsVerifying(false);
                }
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl hover:bg-accent/10 text-accent transition-all active:scale-90 disabled:opacity-50"
              title="Verify Location"
            >
              {isVerifying ? <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /> : <Search className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <label className="text-[2.5vw] md:text-[10px] font-black uppercase tracking-widest ml-[1vw] md:ml-1" style={{ color: theme.colors.textDisabled }}>Fetch GPS Coordinates</label>
          <button
            disabled={isLocating || isVerifying}
            onClick={handleGetCurrentLocation}
            className="px-[4vw] md:px-4 py-[2vw] md:py-2 rounded-[3vw] md:rounded-xl text-[2.5vw] md:text-[10px] font-black uppercase tracking-widest transition-all shadow-theme-card active:translate-y-0.5 flex items-center justify-center gap-[2vw] md:gap-2 disabled:opacity-50"
            style={{ backgroundColor: '#1a73e8', color: 'white' }}
          >
            {isLocating ? <div className="w-[3.5vw] h-[3.5vw] md:w-4 md:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <LocateFixed className="w-[3.5vw] h-[3.5vw] md:w-4 md:h-4" />}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-[4vw] md:gap-4">
          <div className="space-y-[2vw] md:space-y-2">
            <label className="text-[2.5vw] md:text-[10px] font-black uppercase tracking-widest ml-[1vw] md:ml-1" style={{ color: theme.colors.textDisabled }}>Latitude</label>
            <input
              type="number"
              value={draft.latitude || ''}
              onChange={e => setDraft(prev => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
              className="w-full p-[4vw] md:p-4 rounded-[4vw] md:rounded-2xl font-black border-2 border-transparent outline-none transition-all shadow-inner text-[3.5vw] md:text-sm"
              style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary }}
            />
          </div>
          <div className="space-y-[2vw] md:space-y-2">
            <label className="text-[2.5vw] md:text-[10px] font-black uppercase tracking-widest ml-[1vw] md:ml-1" style={{ color: theme.colors.textDisabled }}>Longitude</label>
            <input
              type="number"
              value={draft.longitude || ''}
              onChange={e => setDraft(prev => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
              className="w-full p-[4vw] md:p-4 rounded-[4vw] md:rounded-2xl font-black border-2 border-transparent outline-none transition-all shadow-inner text-[3.5vw] md:text-sm"
              style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary }}
            />
          </div>
        </div>

        {isSwimmingArena && (
          <div className="space-y-[2vw] md:space-y-2">
            <label className="text-[2.5vw] md:text-[10px] font-black uppercase tracking-widest ml-[1vw] md:ml-1" style={{ color: theme.colors.textDisabled }}>Max Slot Capacity / Pool Limit</label>
            <input
              type="number"
              min="1"
              max="500"
              value={maxCapInput}
              onChange={e => {
                const val = e.target.value;
                setMaxCapInput(val);
                if (val !== '') {
                  const num = parseInt(val, 10);
                  if (!isNaN(num) && num > 0) {
                    setDraft(prev => ({
                      ...prev,
                      maxCapacity: num,
                      max_capacity: num
                    }));
                  }
                }
              }}
              onBlur={() => {
                if (maxCapInput === '' || isNaN(parseInt(maxCapInput, 10))) {
                  setMaxCapInput(String(draft.maxCapacity ?? draft.max_capacity ?? 50));
                }
              }}
              className="w-full p-[4vw] md:p-4 rounded-[4vw] md:rounded-2xl font-black border-2 border-transparent outline-none transition-all shadow-inner text-[3.5vw] md:text-sm"
              style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary }}
            />
          </div>
        )}

        {showDeleteCourtModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-card border border-border p-6 md:p-8 rounded-3xl max-w-sm w-full space-y-5 shadow-2xl text-center relative z-10 animate-in fade-in zoom-in-95" style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase italic text-text-primary" style={{ color: theme.colors.textPrimary }}>Remove Court</h3>
                <p className="text-xs font-medium mt-1" style={{ color: theme.colors.textSecondary }}>Which court would you like to remove?</p>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                {Array.from({ length: draft.numberOfCourts || 1 }).map((_, idx) => {
                  const c = draft.courts?.find(item => item.courtNumber === idx + 1) || draft.courts?.[idx];
                  const name = c?.name || `Court ${idx + 1}`;
                  const isSelectedTarget = courtToDeleteIdx === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleExecuteDeleteCourt(idx)}
                      className={`w-full py-3 px-4 rounded-xl font-black text-xs uppercase flex items-center justify-between border transition-all ${
                        isSelectedTarget ? 'bg-red-500 text-white border-red-500 shadow-md' : 'bg-background-secondary text-text-primary border-border hover:border-red-500/50'
                      }`}
                    >
                      <span>Remove {name}</span>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => { setShowDeleteCourtModal(false); setCourtToDeleteIdx(null); }}
                className="w-full py-3 rounded-xl font-black text-xs uppercase bg-background-secondary border border-border text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <AnimatePresence>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <LoadingButton
                    loading={isSaving}
                    disabled={isVerifying || isLocating}
                    onClick={handleSave}
                    className="w-full py-4 rounded-2xl font-black uppercase tracking-widest shadow-theme-elevated text-sm mt-4 disabled:opacity-50"
                    style={{ backgroundColor: theme.colors.accent, color: 'white' }}
                    icon={!hasChanges ? <Database className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                >
                    {hasChanges ? 'Save Arena Changes' : 'Database is Up to Date'}
                </LoadingButton>
            </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ selectedLocation, onLocationChange, user, onAlert, onConfirm }) => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { handleLogout, isAdminAuth } = useApp();

  const role = (user?.role as 'admin' | 'superadmin') || 'admin';

  // Use a local state for the dashboard's arena to prevent global context leakage
  const [dashboardLocation, setDashboardLocation] = useState<Location>(selectedLocation);

  useEffect(() => {
    setDashboardLocation(selectedLocation);
  }, [selectedLocation.id]);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pricing, setPricing] = useState<Pricing[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [userProfilesMap, setUserProfilesMap] = useState<Map<string, any>>(new Map());
  const [expandedBookingIds, setExpandedBookingIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'bookings' | 'locations' | 'reports' | 'security' | 'pricing' | 'timing' | 'about' | 'schedule' | 'gamezone'>('bookings');

  useEffect(() => {
    return forceScrollTop();
  }, [activeTab]);
  const [gameZonePlatforms, setGameZonePlatforms] = useState<any[]>([]);
  const [gameZoneResources, setGameZoneResources] = useState<any[]>([]);
  const [gameZoneGames, setGameZoneGames] = useState<any[]>([]);
  const [gzLoading, setGzLoading] = useState<boolean>(false);

  const [showAddPlatformModal, setShowAddPlatformModal] = useState(false);
  const [showAddResourceModal, setShowAddResourceModal] = useState(false);
  const [showAddGameModal, setShowAddGameModal] = useState(false);

  const [selectedStationIds, setSelectedStationIds] = useState<string[]>([]);
  const [isStationDropdownOpen, setIsStationDropdownOpen] = useState(false);
  const [newPlatformForm, setNewPlatformForm] = useState({ name: '', description: '', icon: '🎮' });
  const [newResourceForm, setNewResourceForm] = useState({
    name: '',
    platform_type: 'PlayStation',
    max_players: 4,
    status: 'ACTIVE' as const
  });
  const [newGameForm, setNewGameForm] = useState({ title: '', platform_type: 'PlayStation', description: '' });

  const getStationPrice = useCallback((stationId: string) => {
    const stationRules = pricing.filter(p => (p.courtId === stationId || p.court_id === stationId));
    const oneHourRule = stationRules.find(p => Math.abs((p.durationHours || p.duration_hours || 1) - 1) < 0.001);
    if (oneHourRule) return oneHourRule.price;
    if (stationRules.length > 0) {
      const first = stationRules[0];
      const dur = first.durationHours || first.duration_hours || 1;
      return Math.round(first.price / dur);
    }
    return 250;
  }, [pricing]);

  const hasPricingRules = useCallback((stationId: string) => {
    return pricing.some(p => (p.courtId === stationId || p.court_id === stationId));
  }, [pricing]);

  const loadGameZoneAdminData = useCallback(async () => {
    if (!dashboardLocation?.id) return;
    setGzLoading(true);
    try {
      const [plats, res, gms, pricingData] = await Promise.all([
        gameZoneService.getPlatforms(dashboardLocation.id),
        gameZoneService.getResources(dashboardLocation.id),
        gameZoneService.getGames(dashboardLocation.id),
        getPricingForLocation(dashboardLocation.id)
      ]);
      setGameZonePlatforms(plats);
      setGameZoneResources(res);
      setGameZoneGames(gms);
      setPricing(pricingData);
    } catch (err) {
      console.error('Error loading Game Zone admin data:', err);
    } finally {
      setGzLoading(false);
    }
  }, [dashboardLocation?.id]);

  useEffect(() => {
    if (dashboardLocation?.id) {
      loadGameZoneAdminData();
    }
  }, [dashboardLocation?.id, loadGameZoneAdminData]);

  useEffect(() => {
    if (dashboardLocation?.id && (activeTab === 'gamezone' || activeTab === 'pricing' || activeTab === 'timing' || activeTab === 'reports')) {
      loadGameZoneAdminData();
    }
  }, [activeTab, dashboardLocation?.id, loadGameZoneAdminData]);

  const isGameZoneArena = useMemo(() => {
    if (!dashboardLocation) return false;
    const name = (dashboardLocation.name || '').toLowerCase();
    const desc = (dashboardLocation.description || '').toLowerCase();
    const supported = Array.isArray(dashboardLocation.supportedSports)
      ? dashboardLocation.supportedSports.map(s => String(s).toLowerCase())
      : [];
    return (
      name.includes('game zone') ||
      name.includes('gamezone') ||
      name.includes('gaming') ||
      desc.includes('game zone') ||
      desc.includes('gamezone') ||
      supported.some(s => s.includes('game') || s.includes('zone'))
    );
  }, [dashboardLocation]);

  const adminNavTabs = useMemo(() => {
    const list = [
      { id: 'bookings', label: 'Booking', icon: LayoutDashboard },
      { id: 'reports', label: 'Reports', icon: BarChart3 },
      { id: 'schedule', label: 'Schedule', icon: Calendar },
      { id: 'timing', label: 'Timing', icon: Clock },
      { id: 'pricing', label: 'Pricing', icon: BadgeIndianRupee },
    ];
    if (isGameZoneArena) {
      list.push({ id: 'gamezone', label: 'Game Zone', icon: Gamepad2 });
    }
    list.push(
      { id: 'locations', label: 'Location', icon: Database },
      { id: 'about', label: 'About', icon: Info },
      { id: 'security', label: 'Security', icon: ShieldAlert }
    );
    return list;
  }, [isGameZoneArena]);

  useEffect(() => {
    if (activeTab === 'gamezone' && !isGameZoneArena) {
      setActiveTab('bookings');
    }
  }, [activeTab, isGameZoneArena]);
  const [isNavDropdownOpen, setIsNavDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
  const [dbVersion, setDbVersion] = useState(0);

  const [schedules, setSchedules] = useState<DaySchedule[]>([]);
  const [scheduleViewDate, setScheduleViewDate] = useState<Date>(new Date());
  const [selectedClosedDate, setSelectedClosedDate] = useState<string | null>(null);
  const [closedOption, setClosedOption] = useState<'one_time' | 'weekly' | 'monthly' | 'yearly'>('one_time');
  const [closureType, setClosureType] = useState<'full' | 'partial'>('full');
  const [closedStartTime, setClosedStartTime] = useState('00:00');
  const [closedEndTime, setClosedEndTime] = useState('23:59');
  const [closedNote, setClosedNote] = useState('');
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [selectedClosedRange, setSelectedClosedRange] = useState<string[]>([]);

  const fetchSchedules = useCallback(async () => {
    if (!dashboardLocation?.id) return;
    const data = await scheduleService.getSchedules(dashboardLocation.id);
    setSchedules(data);
  }, [dashboardLocation?.id]);

  useEffect(() => {
    if (activeTab === 'schedule') {
      fetchSchedules();
    }
  }, [activeTab, fetchSchedules]);

  // Link Supabase User to Arena if they used legacy login previously or if superadmin assigns them
  useEffect(() => {
    let isMounted = true;
    const linkUserToArena = async () => {
      if (user?.id && role === 'admin') {
        const userEmail = (user.email || '').trim();

        // 1. Fetch ALL admin accounts linked to this user's user_id or email
        const { data: matches } = await supabase
          .from('admin_accounts')
          .select('id, location_id, user_id, email')
          .or(`user_id.eq.${user.id},email.ilike.${userEmail}`);

        if (!matches || matches.length === 0 || !isMounted) return;

        // Auto-link any matching unlinked admin_accounts to this user.id
        for (const match of matches) {
          if (!match.user_id) {
            await supabase.from('admin_accounts').update({ user_id: user.id }).eq('id', match.id);
            console.log(`[AdminDashboard] Successfully linked user ${user.id} to location ${match.location_id}`);
          }
        }

        const validLocationIds = matches.map(m => m.location_id).filter(Boolean);
        const currentLocId = dashboardLocation?.id || selectedLocation?.id;

        // If the location currently being viewed in the URL is ONE of the user's valid arenas, STAY ON IT!
        if (currentLocId && validLocationIds.includes(currentLocId)) {
          return;
        }

        // If current location is not owned by user, switch to their first valid arena
        const firstValidLocId = validLocationIds[0];
        if (firstValidLocId && firstValidLocId !== currentLocId) {
          const loc = await locationService.getLocationById(firstValidLocId);
          if (loc && isMounted) {
            setDashboardLocation(loc);
            onLocationChange?.(loc);
          }
        }
      }
    };

    linkUserToArena();
    return () => { isMounted = false; };
  }, [user?.id, role, dashboardLocation?.id]);

  useEffect(() => {
    if (isGameZoneArena && gameZonePlatforms.length > 0) {
      const current = gameZonePlatforms.find(p => p.id === selectedCourtId);
      if (!current) {
        setSelectedCourtId(gameZonePlatforms[0].id);
      }
    } else if (!isGameZoneArena && dashboardLocation?.courts?.length) {
      const current = dashboardLocation.courts.find(c => c.id === selectedCourtId);
      if (!current) setSelectedCourtId(dashboardLocation.courts[0].id);
    }
  }, [dashboardLocation, gameZonePlatforms, isGameZoneArena, selectedCourtId]);

  // Force scroll to top when switching tabs
  useEffect(() => {
    const resetScroll = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTo(0, 0);
      document.body.scrollTo(0, 0);
    };
    resetScroll();
    const rafId = requestAnimationFrame(resetScroll);
    setCopyDropdownOpen(false);
    return () => cancelAnimationFrame(rafId);
  }, [activeTab]);

  const [currentPwdForUpdate, setCurrentPwdForUpdate] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [timeFilter, setTimeFilter] = useState<'day' | 'month' | 'year'>('day');
  const [filterDate, setFilterDate] = useState(() => getLocalISODate());

  const [showManualBooking, setShowManualBooking] = useState(false);
  const [manualTargetLocation, setManualTargetLocation] = useState<Location | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentEditingLocId, setCurrentEditingLocId] = useState<string | null>(null);

  const [newDuration, setNewDuration] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newAdvancePrice, setNewAdvancePrice] = useState('');
  const [newCategory, setNewCategory] = useState<'morning' | 'night'>('morning');
  const [newRuleType, setNewRuleType] = useState<'default' | 'day' | 'date'>('default');
  const [newDayOfWeek, setNewDayOfWeek] = useState<number>(0);
  const [newSpecificDate, setNewSpecificDate] = useState(() => getLocalISODate());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const currentCourtSettings = useMemo(() => {
    return dashboardLocation?.courts?.find(c => c.id === selectedCourtId) || null;
  }, [dashboardLocation, selectedCourtId]);

  const currentPlatformSettings = useMemo(() => {
    if (!isGameZoneArena) return null;
    return gameZonePlatforms.find(p => p.id === selectedCourtId) || null;
  }, [isGameZoneArena, gameZonePlatforms, selectedCourtId]);

  const sourceSettings = isGameZoneArena ? currentPlatformSettings : currentCourtSettings;

  const [openHour, setOpenHour] = useState(String(dashboardLocation?.open_hour ?? 6));
  const [closeHour, setCloseHour] = useState(String(dashboardLocation?.close_hour ?? 23));
  const [morningStart, setMorningStart] = useState(String(dashboardLocation?.morning_start ?? 6));
  const [morningEnd, setMorningEnd] = useState(String(dashboardLocation?.morning_end ?? 18));
  const [nightStart, setNightStart] = useState(String(dashboardLocation?.night_start ?? 18));
  const [nightEnd, setNightEnd] = useState(String(dashboardLocation?.night_end ?? 24));

  const [copyDropdownOpen, setCopyDropdownOpen] = useState(false);

  // About tab form state
  const [aboutForm, setAboutForm] = useState<Partial<Location | Court>>({});

  useEffect(() => {
    if (dashboardLocation) {
      const source = sourceSettings || dashboardLocation;
      setOpenHour(String(source.open_hour ?? dashboardLocation.open_hour ?? 6));
      setCloseHour(String(source.close_hour ?? dashboardLocation.close_hour ?? 23));
      setMorningStart(String(source.morning_start ?? dashboardLocation.morning_start ?? 6));
      setMorningEnd(String(source.morning_end ?? dashboardLocation.morning_end ?? 18));
      setNightStart(String(source.night_start ?? dashboardLocation.night_start ?? 18));
      setNightEnd(String(source.night_end ?? dashboardLocation.night_end ?? 24));

      setAboutForm({
        description: (!isGameZoneArena && selectedCourtId ? currentCourtSettings?.description : dashboardLocation.description) || '',
        rating: dashboardLocation.rating,
        contact: dashboardLocation.contact,
        advanceBookingRequired: dashboardLocation.advanceBookingRequired
      });
    }
  }, [dashboardLocation, sourceSettings, selectedCourtId, isGameZoneArena, currentCourtSettings]);

  // Sync overall hours with session boundaries
  useEffect(() => {
    setOpenHour(morningStart);
  }, [morningStart]);

  useEffect(() => {
    setCloseHour(nightEnd);
  }, [nightEnd]);

  const triggerAlert = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (onAlert) onAlert(msg, type);
  };

  const normalizeDateOnly = (value?: string) => {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const refreshPricing = useCallback(async () => {
    if (dashboardLocation) {
      try {
        const pricingData = await getPricingForLocation(dashboardLocation.id);
        setPricing(pricingData);
      } catch (err) {
        const appError = handleError(err);
        triggerAlert(appError.message, 'error');
      }
    }
  }, [dashboardLocation?.id]);

  useEffect(() => { if (activeTab === 'pricing') refreshPricing(); }, [activeTab, refreshPricing]);

  const refreshData = useCallback(async () => {
    if (!dashboardLocation) return;
    setLoading(true);
    try {
      const [allBookings, allLocations] = await Promise.all([
        bookingService.getBookings(dashboardLocation.id),
        locationService.getLocations()
      ]);

      const bookingIds = (allBookings || []).map(b => b.id);

      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .in('booking_id', bookingIds);

      const filteredLocations = role === 'admin' ? allLocations.filter(l => l.id === dashboardLocation.id) : allLocations;
      setBookings([...allBookings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setLocations([...filteredLocations]);
      setPayments(paymentsData || []);

      const userIds = [...new Set((allBookings || []).map(b => b.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('user_profiles')
          .select('id, email, phone_number, display_name, username')
          .in('id', userIds);
        if (profilesData) {
          const pMap = new Map<string, any>();
          profilesData.forEach(p => pMap.set(String(p.id), p));
          setUserProfilesMap(pMap);
        }
      }

      const updatedCurrent = allLocations.find(l => l.id === dashboardLocation.id);
      if (updatedCurrent) {
        setDashboardLocation(updatedCurrent);
        if (onLocationChange) {
          onLocationChange(updatedCurrent);
        }
      }

      setDbVersion(v => v + 1);
      if (activeTab === 'pricing') await refreshPricing();
    } catch (err) {
      const appError = handleError(err);
      triggerAlert(appError.message, 'error');
    } finally { setLoading(false); }
  }, [dashboardLocation?.id, role, activeTab, refreshPricing]);

  useEffect(() => { if (isAdminAuth) refreshData(); }, [isAdminAuth, activeTab, role, refreshData]);

  useEffect(() => { if (user) refreshData(); }, [user, activeTab, role, refreshData]);

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const bDate = b.date;
      if (timeFilter === 'day') return bDate === filterDate;
      if (timeFilter === 'month') return bDate.startsWith(filterDate.slice(0, 7));
      if (timeFilter === 'year') return bDate.startsWith(filterDate.slice(0, 4));
      return true;
    });
  }, [bookings, timeFilter, filterDate]);

  const handleAddOrUpdatePrice = async () => {
    if (isActionLoading) return;
    if (!newDuration || !newPrice || !newAdvancePrice) return triggerAlert('Please fill all fields.', 'error');
    if (isGameZoneArena && selectedStationIds.length === 0) return triggerAlert('Please select at least one station.', 'error');
    if (!isGameZoneArena && !selectedCourtId) return triggerAlert('Please select a court.', 'error');

    setIsActionLoading(true);
    try {
      const targetIds = isGameZoneArena ? selectedStationIds : [selectedCourtId];
      for (const id of targetIds) {
        if (!id) continue;
        await upsertPricing({
          locationId: dashboardLocation.id,
          courtId: id,
          durationHours: parseFloat(newDuration),
          price: parseFloat(newPrice),
          advancePrice: parseFloat(newAdvancePrice),
          category: newCategory,
          ruleType: newRuleType,
          dayOfWeek: newRuleType === 'day' ? newDayOfWeek : undefined,
          specificDate: newRuleType === 'date' ? newSpecificDate : undefined
        });
      }
      setNewDuration(''); setNewPrice(''); setNewAdvancePrice(''); await refreshPricing();
      triggerAlert('Pricing rule saved successfully!', 'success');
    } catch (err) {
      const appError = handleError(err);
      triggerAlert(appError.message, 'error');
    } finally { setIsActionLoading(false); }
  };

  const handleDeletePrice = async (priceId: string) => {
    const performDelete = async () => {
      setIsActionLoading(true);
      try {
        await deletePricing(priceId);
        await refreshPricing();
      } catch (err) {
        const appError = handleError(err);
        triggerAlert(appError.message, 'error');
      } finally { setIsActionLoading(false); }
    };
    onConfirm ? onConfirm({ message: "Delete this pricing rule?", onConfirm: performDelete, isDestructive: true }) : performDelete();
  };

  const handleUpdateTiming = async () => {
    if (!dashboardLocation || !selectedCourtId || isActionLoading) return;

    const parsedOpenHour = Number(openHour);
    const parsedCloseHour = Number(closeHour);
    const parsedMorningStart = Number(morningStart);
    const parsedMorningEnd = Number(morningEnd);
    const parsedNightStart = Number(nightStart);
    const parsedNightEnd = Number(nightEnd);

    setIsActionLoading(true);
    try {
      if (isGameZoneArena) {
        await gameZoneService.updatePlatform(selectedCourtId, {
          open_hour: parsedOpenHour,
          close_hour: parsedCloseHour,
          morning_start: parsedMorningStart,
          morning_end: parsedMorningEnd,
          night_start: parsedNightStart,
          night_end: parsedNightEnd
        });
        triggerAlert("Operational hours updated for platform!", 'success');
      } else {
        await locationService.updateCourt(selectedCourtId, {
          open_hour: parsedOpenHour,
          close_hour: parsedCloseHour,
          morning_start: parsedMorningStart,
          morning_end: parsedMorningEnd,
          night_start: parsedNightStart,
          night_end: parsedNightEnd
        });
        triggerAlert("Operational hours updated for court!", 'success');
      }

      await loadGameZoneAdminData();
      await refreshData();
    } catch (err) {
      const appError = handleError(err);
      triggerAlert(appError.message, 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUpdateAbout = async () => {
    if (!dashboardLocation || isActionLoading) return;
    setIsActionLoading(true);
    try {
      const { rating, description, ...restAboutForm } = aboutForm as any;
      await locationService.updateLocation(dashboardLocation.id, restAboutForm);

      if (!isGameZoneArena && selectedCourtId && description !== undefined) {
        await locationService.updateCourt(selectedCourtId, { description });
      } else if (description !== undefined) {
        await locationService.updateLocation(dashboardLocation.id, { description });
      }

      await loadGameZoneAdminData();
      await refreshData();
      triggerAlert("Arena details updated successfully!", 'success');
    } catch (err) {
      const appError = handleError(err);
      triggerAlert(appError.message, 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const copyFromCourt = async (tab: 'pricing' | 'timing', sourceCourtId: string) => {
    if (!dashboardLocation || !selectedCourtId) return;
    const sourceCourt = dashboardLocation.courts?.find(c => c.id === sourceCourtId);
    if (!sourceCourt || sourceCourt.id === selectedCourtId) return;

    setIsActionLoading(true);
    try {
      if (tab === 'pricing') {
        const { deletePricingByCourt } = await import('../services/pricingService');
        await deletePricingByCourt(selectedCourtId);

        const sourcePricing = pricing.filter(p => p.courtId === sourceCourt.id);
        if (sourcePricing.length > 0) {
          const bulkData = sourcePricing.map(p => ({
            location_id: p.locationId,
            court_id: selectedCourtId,
            duration_hours: p.durationHours,
            price: p.price,
            advance_price: p.advancePrice,
            category: p.category,
            rule_type: p.ruleType,
            day_of_week: p.dayOfWeek,
            specific_date: p.specificDate
          }));

          const { error: insertError } = await supabase
            .from('box_pricing')
            .insert(bulkData);

          if (insertError) throw insertError;
        }
        await refreshPricing();
      } else if (tab === 'timing') {
        await locationService.updateCourt(selectedCourtId, {
          open_hour: sourceCourt.open_hour,
          close_hour: sourceCourt.close_hour,
          morning_start: sourceCourt.morning_start,
          morning_end: sourceCourt.morning_end,
          night_start: sourceCourt.night_start,
          night_end: sourceCourt.night_end
        });
        await refreshData();
      }
      triggerAlert(`Settings copied from ${sourceCourt.name || `Court ${sourceCourt.courtNumber}`}!`, 'success');
    } catch (err) {
      const appError = handleError(err);
      triggerAlert(appError.message, 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const renderCopyDropdown = (tab: 'pricing' | 'timing') => {
    if (!selectedCourtId || !dashboardLocation?.courts || dashboardLocation.courts.length <= 1) return null;
    const otherCourts = dashboardLocation.courts.filter(c => c.id !== selectedCourtId);
    if (otherCourts.length === 0) return null;

    return (
      <div className="relative">
        <button
          onClick={() => setCopyDropdownOpen(!copyDropdownOpen)}
          className="flex items-center gap-2 px-6 py-3 bg-background-secondary text-accent rounded-2xl font-black text-xs uppercase tracking-widest border border-accent/20 hover:bg-accent/10 transition-all shadow-theme-card relative z-[61]"
        >
          <Plus className={`w-4 h-4 transition-transform duration-300 ${copyDropdownOpen ? 'rotate-45' : ''}`} /> Copy Settings
        </button>

        <AnimatePresence>
          {copyDropdownOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setCopyDropdownOpen(false)}
                className="fixed inset-0 z-[60]"
              />
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full right-0 mt-2 w-56 bg-card border border-border rounded-2xl shadow-theme-modal z-[61] overflow-hidden backdrop-blur-3xl"
              >
                <div className="p-3 border-b border-border/50 bg-background-secondary/30">
                  <p className="text-[9px] font-black uppercase tracking-widest text-text-disabled">Select Source Court</p>
                </div>
                {otherCourts.map(source => (
                  <button
                    key={source.id}
                    onClick={() => {
                      copyFromCourt(tab, source.id);
                      setCopyDropdownOpen(false);
                    }}
                    className="w-full px-5 py-4 text-left text-[10px] font-black uppercase tracking-widest hover:bg-accent/10 hover:text-accent transition-colors border-b last:border-0 border-border/30 flex items-center justify-between"
                    style={{ color: theme.colors.textPrimary }}
                  >
                    <span>{source.name || `Court ${source.courtNumber}`}</span>
                    <ChevronRight className="w-3 h-3 opacity-30" />
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: admins } = await supabase.from('admin_accounts').select('*').ilike('username', role === 'superadmin' ? 'superadmin' : (user?.display_name || '')).eq('password', currentPwdForUpdate);
      if (!admins?.length) { triggerAlert("Incorrect password.", 'error'); return; }
      if (newPassword && newPassword !== confirmNewPassword) { triggerAlert("Passwords do not match.", 'error'); return; }
      const updatedUsername = newUsername.trim() || admins[0].username;
      await supabase.from('admin_accounts').update({ username: updatedUsername, password: newPassword || admins[0].password }).eq('id', admins[0].id);
      triggerAlert("Settings Updated!", 'success');
      setCurrentPwdForUpdate(''); setNewUsername(''); setNewPassword(''); setConfirmNewPassword('');
    } catch (err) {
      const appError = handleError(err);
      triggerAlert(appError.message, 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (activeTab === 'security' && isAdminAuth) setNewUsername(''); }, [activeTab, isAdminAuth]);

  const updateStatus = async (id: string, status: BookingStatus) => {
    setIsActionLoading(true);
    try {
      if (await bookingService.updateBooking(id, { status })) await refreshData();
    } catch (err) {
      const appError = handleError(err);
      triggerAlert(appError.message, 'error');
    } finally { setIsActionLoading(false); }
  };

  const handleSettlePayment = async (b: Booking) => {
    setIsActionLoading(true);
    try {
      const collectedFromLedger = payments
        .filter(p => p.booking_id === b.id)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const currentCollected = Math.max(collectedFromLedger, Number(b.advancePaid || b.advance_paid || b.advance_price || 0));
      const remaining = Math.max(0, b.amount - currentCollected);

      if (remaining > 0) {
        await bookingService.recordPayment({
          booking_id: b.id,
          user_id: b.user_id || '00000000-0000-0000-0000-000000000000',
          amount: remaining,
          payment_type: 'settlement',
          payment_method: 'cash'
        });
      }

      await bookingService.updateBooking(b.id, {
        status: BookingStatus.CONFIRMED,
        advancePaid: b.amount
      });

      await refreshData();
    } catch (err) {
      const appError = handleError(err);
      triggerAlert(appError.message, 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUpdateArena = async (locId: string, updates: Partial<Location>, courtUpdates?: any[]) => {
    try {
      await locationService.updateLocation(locId, updates);

      // If there are court updates, wait for all of them before refreshing
      if (courtUpdates && courtUpdates.length > 0) {
          // REFRESH FIX: Fetch fresh state to resolve temp IDs if any
          const freshLoc = await locationService.getLocationById(locId);

          for (const cu of courtUpdates) {
              let targetId = cu.id;
              if (targetId.startsWith('temp-')) {
                  const real = freshLoc?.courts?.find(rc => rc.courtNumber === cu.courtNumber);
                  if (real) targetId = real.id;
                  else continue;
              }
              await locationService.updateCourt(targetId, {
                  imageUrls: cu.imageUrls,
                  description: cu.description,
                  maxCapacity: cu.maxCapacity
              });
          }
      }

      // REFRESH FIX: Fetch the full updated location data from the server
      const updatedLoc = await locationService.getLocationById(locId);
      if (updatedLoc) {
          setLocations(prev => prev.map(l => l.id === locId ? updatedLoc : l));
          setDbVersion(v => v + 1);
          if (dashboardLocation?.id === locId) {
              setDashboardLocation(updatedLoc);
              onLocationChange?.(updatedLoc);
          }
      }
    } catch (err) {
      const appError = handleError(err);
      triggerAlert(appError.message, 'error');
    }
  };

  const handleDeleteArena = async (id: string) => {
    if (role !== 'superadmin') return;
    const performDelete = async () => {
      setIsActionLoading(true);
      try {
        await locationService.deleteLocation(id);
        await refreshData();
      } catch (err) {
        const appError = handleError(err);
        triggerAlert(appError.message, 'error');
      } finally { setIsActionLoading(false); }
    };
    onConfirm ? onConfirm({ message: "Delete this Arena?", onConfirm: performDelete, isDestructive: true }) : performDelete();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && currentEditingLocId) {
      setIsActionLoading(true);
      try {
        const location = locations.find(l => l.id === currentEditingLocId);
        if (!location) return;

        // Extract courtId and name from internal state
        const targetCourtId = (window as any)._targetCourtId;
        const court = location.courts?.find(c => c.id === targetCourtId);

        // Structured path: ArenaName_ShortID/CourtName/filename
        const arenaFolder = `${location.name.replace(/[^a-z0-9]/gi, '_')}_${location.id.substring(0, 8)}`;

        let courtNum = 1;
        if (court) courtNum = court.courtNumber;
        else if (targetCourtId?.startsWith('temp-')) courtNum = parseInt(targetCourtId.split('-').pop() || '1');

        const courtFolder = targetCourtId ? (court?.name?.replace(/[^a-z0-9]/gi, '_') || `Court_${courtNum}`) : 'Arena_Global';

        const bucket = targetCourtId ? 'courts' : 'arenas';

        const newImages: string[] = [];
        for (const file of Array.from(files)) {
          if (file.size > 2 * 1024 * 1024) continue;
          const fileName = `${arenaFolder}/${courtFolder}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '_')}`;
          const url = await supabaseStorage.uploadFile(bucket, fileName, file);
          newImages.push(url);
        }

        if (newImages.length) {
            setLocations(prev => prev.map(l => {
                if (l.id !== currentEditingLocId) return l;

                // Handle global images
                if (!targetCourtId) {
                    return { ...l, imageUrls: [...(l.imageUrls || []), ...newImages] };
                }

                // Handle court images
                let updatedCourts = l.courts ? [...l.courts] : [];
                const courtIdx = updatedCourts.findIndex(c => c.id === targetCourtId);

                if (courtIdx > -1) {
                    updatedCourts[courtIdx] = {
                        ...updatedCourts[courtIdx],
                        imageUrls: [...(updatedCourts[courtIdx].imageUrls || []), ...newImages]
                    };
                } else {
                    // It's a new court (possibly with a temp ID) that hasn't been saved yet
                    updatedCourts.push({
                        id: targetCourtId,
                        locationId: l.id,
                        courtNumber: courtNum,
                        imageUrls: newImages,
                        description: ''
                    });
                }

                return { ...l, courts: updatedCourts };
            }));

            triggerAlert("Photos uploaded! Click 'Save Arena Changes' to persist.", 'info');
        }
      } catch (err) {
        const appError = handleError(err);
        triggerAlert(appError.message, 'error');
      } finally { setIsActionLoading(false); setCurrentEditingLocId(null); (window as any)._targetCourtId = null; if (fileInputRef.current) fileInputRef.current.value = ''; }
    }
  };

  const removeImage = async (locId: string, imgIdx: number, courtId?: string) => {
    const loc = locations.find(l => l.id === locId);
    if (!loc) return;
    setIsActionLoading(true);
    try {
      let imageUrl = '';
      let currentUrls: string[] = [];

      if (courtId) {
        const court = loc.courts?.find(c => c.id === courtId);
        if (court) {
          imageUrl = court.imageUrls[imgIdx];
          currentUrls = court.imageUrls;
        }
      } else {
        imageUrl = loc.imageUrls[imgIdx];
        currentUrls = loc.imageUrls;
      }

      if (imageUrl.includes('.supabase.co/storage/v1/object/public/arenas/')) {
        const path = imageUrl.split('/arenas/')[1];
        try {
          await supabaseStorage.deleteFile('arenas', path);
        } catch (e) {
          console.error("Failed to delete file from storage:", e);
        }
      }

      const newUrls = currentUrls.filter((_, i) => i !== imgIdx);
      if (courtId) {
        await locationService.updateCourt(courtId, { imageUrls: newUrls });
      } else {
        await handleUpdateArena(locId, { imageUrls: newUrls });
      }
      await refreshData();
    } catch (err) {
      const appError = handleError(err);
      triggerAlert(appError.message, 'error');
    } finally { setIsActionLoading(false); }
  };

  const triggerImageUpload = (id: string, courtId?: string) => {
    setCurrentEditingLocId(id);
    (window as any)._targetCourtId = courtId;
    fileInputRef.current?.click();
  };

  const handleOpenManualBooking = () => {
    setManualTargetLocation(role === 'admin' ? dashboardLocation : (locations[0] || dashboardLocation));
    setShowManualBooking(true);
  };

  const handleManualComplete = async () => {
    setShowManualBooking(false);
    await refreshData();
  };

  const reportStats = useMemo(() => {
    const valid = filteredBookings.filter(b => [BookingStatus.BOOKED, BookingStatus.APPROVED, BookingStatus.CONFIRMED, BookingStatus.COMPLETED].includes(b.status));
    const validBookingIds = new Set(valid.map(b => b.id));

    // 1. Gross Revenue (Total match prices)
    const totalRevenue = valid.reduce((sum, b) => sum + b.amount, 0);

    // 2. Net Collected (All payments from ledger)
    const validPayments = payments.filter(p => validBookingIds.has(p.booking_id));
    const moneyCollected = validPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    // 3. Breakdown by type
    const advances = validPayments.filter(p => p.payment_type === 'advance').reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const fullPayments = validPayments.filter(p => p.payment_type === 'full').reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const settlements = validPayments.filter(p => p.payment_type === 'settlement').reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const totalBookingCount = filteredBookings.length;

    // 4. Booking Status Breakdown
    const collectedMap = new Map<string, number>();
    validPayments.forEach(p => {
      collectedMap.set(p.booking_id, (collectedMap.get(p.booking_id) || 0) + Number(p.amount || 0));
    });

    const fullyPaidCount = valid.filter(b => (collectedMap.get(b.id) || 0) >= b.amount).length;
    const pendingCount = valid.filter(b => (collectedMap.get(b.id) || 0) < b.amount).length;

    // Per court stats
    const courtBreakdown = (dashboardLocation?.courts || []).map(court => {
      const courtBookings = filteredBookings.filter(b => b.courtId === court.id);
      const courtValid = courtBookings.filter(b => [BookingStatus.BOOKED, BookingStatus.APPROVED, BookingStatus.CONFIRMED, BookingStatus.COMPLETED].includes(b.status));
      const courtValidIds = new Set(courtValid.map(b => b.id));

      const revenue = courtValid.reduce((sum, b) => sum + b.amount, 0);
      const courtPayments = payments.filter(p => courtValidIds.has(p.booking_id));
      const collected = courtPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

      const cAdvances = courtPayments.filter(p => p.payment_type === 'advance').reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const cFull = courtPayments.filter(p => p.payment_type === 'full').reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const cSettlements = courtPayments.filter(p => p.payment_type === 'settlement').reduce((sum, p) => sum + Number(p.amount || 0), 0);

      return {
        name: court.name || `Court ${court.courtNumber}`,
        revenue,
        advance: collected,
        advances: cAdvances,
        full: cFull,
        settlements: cSettlements,
        count: courtBookings.length
      };
    });

    const platformBreakdown = gameZonePlatforms.map(platform => {
      const platformResources = gameZoneResources.filter(r => r.platform_id === platform.id || (r.platform_type && r.platform_type.toLowerCase() === platform.name.toLowerCase()));
      const platformResourceIds = new Set(platformResources.map(r => r.id));
      const platformBookings = filteredBookings.filter(b => b.resourceId && platformResourceIds.has(b.resourceId));
      const platformValid = platformBookings.filter(b => [BookingStatus.BOOKED, BookingStatus.APPROVED, BookingStatus.CONFIRMED, BookingStatus.COMPLETED].includes(b.status));
      const platformValidIds = new Set(platformValid.map(b => b.id));

      const revenue = platformValid.reduce((sum, b) => sum + b.amount, 0);
      const platformPayments = payments.filter(p => platformValidIds.has(p.booking_id));
      const collected = platformPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

      const cAdvances = platformPayments.filter(p => p.payment_type === 'advance').reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const cFull = platformPayments.filter(p => p.payment_type === 'full').reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const cSettlements = platformPayments.filter(p => p.payment_type === 'settlement').reduce((sum, p) => sum + Number(p.amount || 0), 0);

      return {
        name: platform.name,
        revenue,
        advance: collected,
        advances: cAdvances,
        full: cFull,
        settlements: cSettlements,
        count: platformBookings.length
      };
    });

    return { totalRevenue, moneyCollected, advances, fullPayments, settlements, fullyPaidCount, pendingCount, bookingCount: totalBookingCount, courtBreakdown, platformBreakdown };
  }, [filteredBookings, dashboardLocation, payments, gameZonePlatforms, gameZoneResources]);

  const activePricingRules = useMemo(() => {
    if (pricing.length === 0) return [];

    // Use current settings as context
    const rulesByCat: Record<string, Pricing[]> = { morning: [], night: [] };

    ['morning', 'night'].forEach(cat => {
      let courtRules = pricing.filter(p => {
        const ruleCourtId = p.courtId || p.court_id;
        const matchesCourt = isGameZoneArena
          ? selectedStationIds.includes(ruleCourtId)
          : (ruleCourtId === selectedCourtId);
        return matchesCourt && (p.category === cat);
      });

      rulesByCat[cat] = courtRules;
    });

    return [...rulesByCat.morning, ...rulesByCat.night];
  }, [pricing, selectedCourtId, selectedStationIds, isGameZoneArena]);

  const renderPricing = () => (
    <div className="space-y-6 md:space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-500">
      {/* Court / Station Selector and Copy Tool */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 md:gap-4 bg-card md:bg-card p-6 md:p-4 rounded-[2rem] md:rounded-3xl border border-border shadow-theme-card">
        <div className="flex gap-2.5 md:gap-2 overflow-x-auto pb-2 md:pb-1 no-scrollbar w-full md:w-auto px-1 md:px-0">
          {isGameZoneArena ? (
            gameZonePlatforms.map((platform) => (
              <button
                key={platform.id}
                onClick={() => {
                  setSelectedCourtId(platform.id);
                  const pStations = gameZoneResources.filter(r => r.platform_id === platform.id || (r.platform_type && r.platform_type.toLowerCase() === platform.name.toLowerCase()));
                  setSelectedStationIds(pStations.map(s => s.id));
                }}
                className={`px-7 py-3.5 md:px-6 md:py-3 rounded-2xl md:rounded-2xl font-black text-xs md:text-sm uppercase tracking-widest transition-all border shrink-0 ${
                  selectedCourtId === platform.id
                    ? 'bg-accent text-white border-accent shadow-theme-elevated scale-105'
                    : 'bg-background-secondary text-text-secondary border-border'
                }`}
              >
                {platform.name}
              </button>
            ))
          ) : (
            dashboardLocation?.courts?.map((court) => (
              <button
                key={court.id}
                onClick={() => setSelectedCourtId(court.id)}
                className={`px-7 py-3.5 md:px-6 md:py-3 rounded-2xl md:rounded-2xl font-black text-xs md:text-sm uppercase tracking-widest transition-all border shrink-0 shadow-sm md:shadow-none ${selectedCourtId === court.id ? 'bg-accent text-white border-accent shadow-theme-elevated md:shadow-none scale-105 md:scale-100' : 'bg-background-secondary text-text-secondary border-border'}`}
              >
                {court.name || `Court ${court.courtNumber}`}
              </button>
            ))
          )}
        </div>
        {!isGameZoneArena && renderCopyDropdown('pricing')}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-8">
        <div className="lg:col-span-7 space-y-8 md:space-y-6">
          <div className="p-6 md:p-8 shadow-theme-card md:shadow-theme-card transition-all bg-card md:bg-card border border-border rounded-[2.5rem] md:rounded-[var(--fluid-radius)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full opacity-5 pointer-events-none bg-accent md:hidden" />
            <h2 className="text-xl md:text-xl font-black italic mb-8 md:mb-6 uppercase flex items-center justify-between text-text-primary px-1 md:px-0">
              <div className="flex items-center gap-4 md:gap-3">
                <BadgeIndianRupee className="w-6 h-6 md:w-5 md:h-5 text-accent" /> Pricing Rules
              </div>
              <span className="text-[10px] md:text-[10px] font-black tracking-widest opacity-50 md:opacity-60 px-4 py-1.5 md:px-3 md:py-1 rounded-xl md:rounded-lg border border-border bg-background-secondary md:bg-transparent">
                Showing: {newCategory.toUpperCase()}
              </span>
            </h2>
            {pricing.filter(p => {
              const ruleCourtId = p.courtId || p.court_id;
              const matchesCourt = isGameZoneArena
                ? selectedStationIds.includes(ruleCourtId)
                : (ruleCourtId === selectedCourtId);
              const matchesCat = (p.category || 'morning') === newCategory;
              const type = (p.ruleType || p.rule_type || 'default').toLowerCase();
              const matchesType = type === newRuleType.toLowerCase();

              if (!matchesCourt || !matchesCat || !matchesType) return false;

              if (newRuleType === 'day') {
                const day = p.dayOfWeek !== undefined ? p.dayOfWeek : p.day_of_week;
                return String(day) === String(newDayOfWeek);
              }
              if (newRuleType === 'date') {
                return normalizeDateOnly(p.specificDate || p.specific_date) === normalizeDateOnly(newSpecificDate);
              }
              return true;
            }).length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:gap-3">
                {pricing
                  .filter(p => {
                    const ruleCourtId = p.courtId || p.court_id;
                    const matchesCourt = isGameZoneArena
                      ? selectedStationIds.includes(ruleCourtId)
                      : (ruleCourtId === selectedCourtId);
                    const matchesCat = (p.category || 'morning') === newCategory;
                    const type = (p.ruleType || p.rule_type || 'default').toLowerCase();
                    const matchesType = type === newRuleType.toLowerCase();

                    if (!matchesCourt || !matchesCat || !matchesType) return false;

                    if (newRuleType === 'day') {
                      const day = p.dayOfWeek !== undefined ? p.dayOfWeek : p.day_of_week;
                      return String(day) === String(newDayOfWeek);
                    }
                    if (newRuleType === 'date') {
                      return normalizeDateOnly(p.specificDate || p.specific_date) === normalizeDateOnly(newSpecificDate);
                    }
                    return true;
                  })
                  .sort((a, b) => (a.durationHours || a.duration_hours || 0) - (b.durationHours || b.duration_hours || 0))
                  .map((p) => (
                  <motion.div whileHover={{ scale: 1.02 }} key={p.id}
                              className="flex justify-between items-center p-5 md:p-5 rounded-2xl md:rounded-2xl border border-border transition-all group shadow-sm md:shadow-inner bg-background-secondary md:bg-background-secondary"
                              style={{ borderColor: theme.colors.border }}>
                    <div className="flex items-center gap-4 md:gap-4">
                      <div className="w-12 h-12 md:w-9 md:h-9 rounded-xl md:rounded-xl flex items-center justify-center font-black text-sm md:text-sm shadow-inner md:shadow-theme-card bg-accent/10 md:bg-accent/15 text-accent border border-accent/20 md:border-none">
                        {(p.durationHours || p.duration_hours || 0).toString()}h
                      </div>
                      <div>
                        <div className="flex items-center gap-2 md:gap-0">
                          <span className="text-lg md:text-lg font-black tracking-tight text-text-primary italic md:not-italic">₹{p.price}</span>
                          <span className="text-xs md:text-[11px] font-black md:font-bold text-accent opacity-80 md:ml-2 italic md:not-italic"> (Adv: ₹{p.advancePrice || p.advance_price || 0})</span>
                        </div>
                        <div className="flex gap-2 items-center mt-2 md:mt-1">
                          <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest px-2.5 py-1 md:px-2 md:py-0.5 rounded bg-white/5 md:bg-white/10 text-text-disabled border border-white/5 md:border-none" style={{ backgroundColor: `${theme.colors.accent}10` }}>{p.category}</p>
                          <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest px-2.5 py-1 md:px-2 md:py-0.5 rounded bg-white/5 md:bg-white/10 text-text-disabled border border-white/5 md:border-none" style={{ backgroundColor: `${theme.colors.accent}10` }}>
                            {p.ruleType === 'default' || p.rule_type === 'default' ? 'Daily' : (p.ruleType === 'day' || p.rule_type === 'day') ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][p.dayOfWeek ?? p.day_of_week ?? 0] : (p.specificDate || p.specific_date)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => p.id && handleDeletePrice(p.id)}
                            className="w-11 h-11 md:w-9 md:h-9 rounded-xl md:rounded-xl flex items-center justify-center transition-all shadow-theme-card active:scale-90 md:active:translate-y-0.5 bg-error/5 md:bg-error/15 text-error border border-error/10 md:border-none">
                      <Trash2 className="w-4 h-4 md:w-4 md:h-4" />
                    </button>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 md:py-20 gap-6 md:gap-4 opacity-30 md:opacity-100">
                <Database className="w-16 h-16 md:hidden" />
                <div className="text-center font-black uppercase tracking-[0.4em] text-xs md:text-xs" style={{ color: theme.colors.textDisabled }}>No Pricing Rules for this court</div>
              </div>
            )}
          </div>
        </div>
        <div className="lg:col-span-5 p-8 md:p-6 shadow-theme-modal md:shadow-theme-modal h-fit sticky top-10 md:top-6 border transition-all bg-card md:bg-card rounded-[2.5rem] md:rounded-theme-lg"
             style={{ borderColor: theme.colors.border }}>
          <h2 className="text-xl md:text-lg font-black italic md:not-italic mb-8 md:mb-4 uppercase text-text-primary px-1 md:px-0">Add Rule</h2>
          <div className="space-y-6 md:space-y-4">
            <div className="grid grid-cols-1 gap-6 md:gap-4">
              <div className="space-y-2 md:space-y-1">
                <label className="text-[10px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-widest ml-1 text-text-disabled">Duration (Hours)</label>
                <input type="number" placeholder="e.g. 1.5" value={newDuration} onChange={(e) => setNewDuration(e.target.value)}
                       className="w-full p-5 md:p-4 rounded-2xl md:rounded-2xl font-black border-2 border-transparent outline-none transition-all shadow-inner text-sm md:text-sm bg-background-secondary md:bg-background-secondary text-text-primary" />
              </div>
              <div className="grid grid-cols-2 gap-5 md:gap-4">
                <div className="space-y-2 md:space-y-1">
                  <label className="text-[10px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-widest ml-1 text-text-disabled">Total Price (₹)</label>
                  <input type="number" placeholder="1200" value={newPrice} onChange={(e) => setNewPrice(e.target.value)}
                         className="w-full p-5 md:p-4 rounded-2xl md:rounded-2xl font-black border-2 border-transparent outline-none transition-all shadow-inner text-sm md:text-sm bg-background-secondary md:bg-background-secondary text-text-primary" />
                </div>
                <div className="space-y-2 md:space-y-1">
                  <label className="text-[10px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-widest ml-1 text-text-disabled">Advance (₹)</label>
                  <input type="number" placeholder="500" value={newAdvancePrice} onChange={(e) => setNewAdvancePrice(e.target.value)}
                         className="w-full p-5 md:p-4 rounded-2xl md:rounded-2xl font-black border-2 border-transparent outline-none transition-all shadow-inner text-sm md:text-sm bg-background-secondary md:bg-background-secondary text-text-primary" />
                </div>
              </div>
            </div>

            {isGameZoneArena && (
              <div className="space-y-2 relative">
                <label className="text-[10px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-widest ml-1 text-text-disabled">
                  Select Stations ({gameZonePlatforms.find(p => p.id === selectedCourtId)?.name || ''})
                </label>
                <div
                  onClick={() => setIsStationDropdownOpen(!isStationDropdownOpen)}
                  className="w-full p-5 md:p-4 rounded-2xl md:rounded-2xl font-black border-2 border-transparent outline-none transition-all shadow-inner text-sm md:text-sm bg-background-secondary md:bg-background-secondary text-text-primary flex items-center justify-between cursor-pointer uppercase"
                >
                  <span>
                    {selectedStationIds.length === 0
                      ? 'Select Stations...'
                      : `${selectedStationIds.length} Station(s) Selected`}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isStationDropdownOpen ? 'rotate-180' : ''}`} />
                </div>

                {isStationDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-card border border-border rounded-2xl shadow-theme-modal z-50 space-y-2 max-h-48 overflow-y-auto">
                    {gameZoneResources
                      .filter(res => {
                        const selPlatform = gameZonePlatforms.find(p => p.id === selectedCourtId);
                        if (!selPlatform) return true;
                        return res.platform_id === selPlatform.id || (res.platform_type && res.platform_type.toLowerCase() === selPlatform.name.toLowerCase());
                      })
                      .map((res) => {
                        const isChecked = selectedStationIds.includes(res.id);
                        return (
                          <div
                            key={res.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStationIds(prev =>
                                isChecked ? prev.filter(id => id !== res.id) : [...prev, res.id]
                              );
                            }}
                            className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                              isChecked ? 'bg-accent/10 border-accent text-text-primary' : 'bg-background-secondary border-border text-text-secondary'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                                isChecked ? 'bg-accent border-accent text-white' : 'border-border bg-card'
                              }`}>
                                {isChecked && <Check className="w-3.5 h-3.5" />}
                              </div>
                              <span className="font-black text-xs uppercase">{res.name}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3 md:space-y-1">
              <label className="text-[10px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-widest ml-1 text-text-disabled">Session</label>
              <div className="flex gap-2 p-1.5 md:p-1 rounded-2xl md:rounded-xl bg-background-secondary md:bg-background-secondary shadow-inner border border-border md:border-none">
                {(['morning', 'night'] as const).map(cat => (
                  <button key={cat} onClick={() => setNewCategory(cat)}
                          className={`flex-1 py-3 md:py-2 rounded-xl md:rounded-lg text-[10px] md:text-[10px] font-black uppercase tracking-widest transition-all ${newCategory === cat ? 'bg-accent text-white shadow-theme-elevated md:shadow-md italic md:not-italic' : 'text-text-disabled'}`}
                          style={{ backgroundColor: newCategory === cat ? theme.colors.accent : 'transparent' }}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 md:space-y-1">
              <label className="text-[10px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-widest ml-1 text-text-disabled">Rule Type</label>
              <select value={newRuleType} onChange={(e) => setNewRuleType(e.target.value as any)}
                      className="w-full p-5 md:p-4 rounded-2xl md:rounded-2xl font-black border-2 border-transparent outline-none transition-all shadow-inner text-sm md:text-sm bg-background-secondary md:bg-background-secondary text-text-primary appearance-none md:appearance-auto cursor-pointer">
                <option value="default">Default (All Days)</option>
                <option value="day">Specific Day</option>
                <option value="date">Specific Date</option>
              </select>
            </div>

            {newRuleType === 'day' && (
              <div className="space-y-[1vw] md:space-y-1">
                <label className="text-[2.5vw] md:text-[10px] font-black uppercase tracking-widest ml-[1vw] md:ml-1" style={{ color: theme.colors.textDisabled }}>Select Day</label>
                <select value={newDayOfWeek} onChange={(e) => setNewDayOfWeek(parseInt(e.target.value))}
                        className="w-full p-[4vw] md:p-4 rounded-[4vw] md:rounded-2xl font-black border-2 border-transparent outline-none transition-all shadow-inner text-[3.5vw] md:text-sm"
                        style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary }}>
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, i) => (
                    <option key={i} value={i}>{day}</option>
                  ))}
                </select>
              </div>
            )}

            {newRuleType === 'date' && (
              <div className="space-y-[1vw] md:space-y-1">
                <label className="text-[2.5vw] md:text-[10px] font-black uppercase tracking-widest ml-[1vw] md:ml-1" style={{ color: theme.colors.textDisabled }}>Select Date</label>
                <button
                  onClick={() => setShowDatePicker(true)}
                  className="w-full p-[4vw] md:p-4 rounded-[4vw] md:rounded-2xl font-black border-2 border-transparent outline-none transition-all shadow-inner flex items-center justify-between text-left text-[3.5vw] md:text-sm"
                  style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary }}
                >
                  <span>{newSpecificDate.split('-').reverse().join('/')}</span>
                  <Calendar className="w-[4vw] h-[4vw] md:w-4 md:h-4 opacity-40" />
                </button>
                <DatePickerModal
                  isOpen={showDatePicker}
                  onClose={() => setShowDatePicker(false)}
                  selectedDate={newSpecificDate}
                  onSelect={(date) => setNewSpecificDate(date)}
                />
              </div>
            )}

            <LoadingButton
              loading={isActionLoading}
              onClick={handleAddOrUpdatePrice}
              className="w-full py-[4vw] md:py-4 text-white rounded-[4vw] md:rounded-2xl font-black uppercase tracking-widest shadow-theme-elevated text-[2.8vw] md:text-sm"
              style={{ backgroundColor: theme.colors.accent }}
              icon={<Plus className="w-[4vw] h-[4vw] md:w-4 md:h-4" />}
              loadingText="Saving..."
            >
              Save Rule
            </LoadingButton>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTiming = () => (
    <div className="space-y-6 md:space-y-6 animate-in fade-in zoom-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 md:gap-4 bg-card md:bg-card p-6 md:p-4 rounded-[2.5rem] md:rounded-3xl border border-border shadow-theme-card">
        <div className="flex gap-2.5 md:gap-2 overflow-x-auto pb-2 md:pb-1 no-scrollbar w-full md:w-auto px-1 md:px-0">
          {isGameZoneArena ? (
            gameZonePlatforms.map((platform) => (
              <button
                key={platform.id}
                onClick={() => setSelectedCourtId(platform.id)}
                className={`px-7 py-3.5 md:px-6 md:py-3 rounded-2xl md:rounded-2xl font-black text-xs md:text-sm uppercase tracking-widest transition-all border shrink-0 ${
                  selectedCourtId === platform.id
                    ? 'bg-accent text-white border-accent shadow-theme-elevated scale-105'
                    : 'bg-background-secondary text-text-secondary border-border'
                }`}
              >
                {platform.name}
              </button>
            ))
          ) : (
            dashboardLocation?.courts?.map((court) => (
              <button
                key={court.id}
                onClick={() => setSelectedCourtId(court.id)}
                className={`px-7 py-3.5 md:px-6 md:py-3 rounded-2xl md:rounded-2xl font-black text-xs md:text-sm uppercase tracking-widest transition-all border shrink-0 shadow-sm md:shadow-none ${selectedCourtId === court.id ? 'bg-accent text-white border-accent shadow-theme-elevated md:shadow-none scale-105 md:scale-100' : 'bg-background-secondary text-text-secondary border-border'}`}
              >
                {court.name || `Court ${court.courtNumber}`}
              </button>
            ))
          )}
        </div>
        {!isGameZoneArena && renderCopyDropdown('timing')}
      </div>

      <div className="w-full max-w-2xl mx-auto py-8 md:py-12 md:max-w-2xl">
        <div className="p-8 md:p-12 border shadow-theme-modal md:shadow-theme-modal relative overflow-hidden transition-all bg-card md:bg-card rounded-[3rem] md:rounded-theme-lg"
             style={{ borderColor: theme.colors.border }}>
          <div className="absolute -bottom-20 -left-20 w-40 h-40 blur-3xl rounded-full opacity-5 pointer-events-none bg-accent md:bg-accent" />
          <div className="text-center mb-10 md:mb-12">
            <div className={`w-16 h-16 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 md:mb-4 shadow-theme-elevated transform md:rotate-3 rotate-3 text-white transition-all`}
                 style={{ backgroundColor: theme.colors.accent }}>
              <Clock className="w-8 h-8 md:w-8 md:h-8" />
            </div>
            <h2 className="text-2xl md:text-3xl font-black italic md:not-italic uppercase tracking-tighter md:tracking-tight text-text-primary">{isGameZoneArena ? 'Platform Timing' : 'Court Timing'}</h2>
            <p className="text-[10px] md:text-[10px] font-black uppercase tracking-[0.3em] mt-3 md:mt-2 text-text-disabled">
              {isGameZoneArena
                ? (gameZonePlatforms.find(p => p.id === selectedCourtId)?.name || 'Platform Schedule')
                : (dashboardLocation?.courts?.find(c => c.id === selectedCourtId)?.name || 'Operational Schedule')}
            </p>
          </div>
          <div className="space-y-8 md:space-y-6 relative z-10">
            <div className="grid grid-cols-2 gap-6 md:gap-4">
              <div className="space-y-2 md:space-y-2">
                <label className="text-[10px] md:text-[10px] font-black uppercase tracking-widest ml-1 text-text-disabled opacity-60 md:opacity-100">Morning Start</label>
                <input type="number" min="0" max="23" value={morningStart} onChange={e => setMorningStart(e.target.value)} className="w-full p-5 md:p-4 border-2 border-transparent rounded-2xl md:rounded-2xl font-black md:font-black outline-none shadow-inner text-sm md:text-sm bg-background-secondary md:bg-background-secondary text-text-primary" />
              </div>
              <div className="space-y-2 md:space-y-2">
                <label className="text-[10px] md:text-[10px] font-black uppercase tracking-widest ml-1 text-text-disabled opacity-60 md:opacity-100">Morning End</label>
                <input type="number" min="0" max="23" value={morningEnd} onChange={e => setMorningEnd(e.target.value)} className="w-full p-5 md:p-4 border-2 border-transparent rounded-2xl md:rounded-2xl font-black md:font-black outline-none shadow-inner text-sm md:text-sm bg-background-secondary md:bg-background-secondary text-text-primary" />
              </div>
              <div className="space-y-2 md:space-y-2">
                <label className="text-[10px] md:text-[10px] font-black uppercase tracking-widest ml-1 text-text-disabled opacity-60 md:opacity-100">Night Start</label>
                <input type="number" min="0" max="23" value={nightStart} onChange={e => setNightStart(e.target.value)} className="w-full p-5 md:p-4 border-2 border-transparent rounded-2xl md:rounded-2xl font-black md:font-black outline-none shadow-inner text-sm md:text-sm bg-background-secondary md:bg-background-secondary text-text-primary" />
              </div>
              <div className="space-y-2 md:space-y-2">
                <label className="text-[10px] md:text-[10px] font-black uppercase tracking-widest ml-1 text-text-disabled opacity-60 md:opacity-100">Night End</label>
                <input type="number" min="0" max="24" value={nightEnd} onChange={e => setNightEnd(e.target.value)} className="w-full p-5 md:p-4 border-2 border-transparent rounded-2xl md:rounded-2xl font-black md:font-black outline-none shadow-inner text-sm md:text-sm bg-background-secondary md:bg-background-secondary text-text-primary" />
              </div>
            </div>
            <div className="space-y-2 md:space-y-2">
              <label className="text-[10px] md:text-[10px] font-black uppercase tracking-widest ml-1 text-text-disabled opacity-60 md:opacity-100">Overall Opening Hour</label>
              <input type="number" min="0" max="23" value={openHour} onChange={e => setOpenHour(e.target.value)} className="w-full p-5 md:p-4 border-2 border-transparent rounded-2xl md:rounded-2xl font-black md:font-black outline-none shadow-inner text-sm md:text-sm bg-background-secondary md:bg-background-secondary text-text-primary" />
            </div>
            <div className="space-y-2 md:space-y-2">
              <label className="text-[10px] md:text-[10px] font-black uppercase tracking-widest ml-1 text-text-disabled opacity-60 md:opacity-100">
                Overall Closing Hour
              </label>
              <input type="number" min="0" max="24" value={closeHour} onChange={e => setCloseHour(e.target.value)} className="w-full p-5 md:p-4 border-2 border-transparent rounded-2xl md:rounded-2xl font-black md:font-black outline-none shadow-inner text-sm md:text-sm bg-background-secondary md:bg-background-secondary text-text-primary" />
            </div>
            <LoadingButton
            loading={isActionLoading}
            onClick={handleUpdateTiming}
            className="w-full py-5 md:py-4 rounded-2xl md:rounded-2xl font-black uppercase tracking-widest shadow-theme-elevated md:shadow-theme-elevated text-[11px] md:text-sm mt-4 md:mt-0 active:translate-y-1 md:active:translate-y-0.5"
            style={{ backgroundColor: theme.colors.textPrimary, color: theme.colors.background }}
            loadingText="Saving..."
            icon={<CheckCircle2 className="w-6 h-6 md:w-5 md:h-5" />}
          >
            Save Timing
          </LoadingButton>
          </div>
        </div>
      </div>
    </div>
  );



  const handleCreatePlatform = async () => {
    if (!newPlatformForm.name || !dashboardLocation?.id) return;
    const res = await gameZoneService.createPlatform({
      location_id: dashboardLocation.id,
      name: newPlatformForm.name,
      description: newPlatformForm.description,
      icon: newPlatformForm.icon
    });
    if (res) {
      triggerAlert('Gaming Platform added successfully', 'success');
      setShowAddPlatformModal(false);
      setNewPlatformForm({ name: '', description: '', icon: '🎮' });
      loadGameZoneAdminData();
    }
  };

  const handleCreateResource = async () => {
    if (!newResourceForm.name || !dashboardLocation?.id) return;
    const res = await gameZoneService.createResource({
      location_id: dashboardLocation.id,
      name: newResourceForm.name,
      platform_type: newResourceForm.platform_type,
      price: newResourceForm.price,
      max_players: newResourceForm.max_players,
      status: newResourceForm.status,
      pricing_unit: 'per hour'
    });
    if (res) {
      triggerAlert('Gaming Station added successfully', 'success');
      setShowAddResourceModal(false);
      setNewResourceForm({ name: '', platform_type: 'PlayStation', price: 250, max_players: 4, status: 'ACTIVE' });
      loadGameZoneAdminData();
    }
  };

  const handleToggleResourceStatus = async (resourceId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'MAINTENANCE' : currentStatus === 'MAINTENANCE' ? 'INACTIVE' : 'ACTIVE';
    const ok = await gameZoneService.updateResourceStatus(resourceId, nextStatus as any);
    if (ok) {
      triggerAlert(`Station status updated to ${nextStatus}`, 'info');
      loadGameZoneAdminData();
    }
  };

  const handleCreateGame = async () => {
    if (!newGameForm.title || !dashboardLocation?.id) return;
    const res = await gameZoneService.createGame({
      location_id: dashboardLocation.id,
      title: newGameForm.title,
      platform_type: newGameForm.platform_type,
      description: newGameForm.description
    });
    if (res) {
      triggerAlert('Game added to catalog', 'success');
      setShowAddGameModal(false);
      setNewGameForm({ title: '', platform_type: 'PlayStation', description: '' });
      loadGameZoneAdminData();
    }
  };

  const [gzSubTab, setGzSubTab] = useState<'STATIONS' | 'PLATFORMS' | 'GAMES'>('STATIONS');
  const [gzSearch, setGzSearch] = useState('');
  const [gzPlatformFilter, setGzPlatformFilter] = useState('ALL');
  const [selectedStationDetail, setSelectedStationDetail] = useState<GameZoneResource | null>(null);

  const getPlatformIcon = (platformName: string, iconStr?: string) => {
    const name = (platformName || '').toLowerCase();
    if (iconStr && iconStr.startsWith('http')) {
      return <img src={iconStr} alt={platformName} className="w-8 h-8 object-contain rounded-lg shrink-0" />;
    }
    if (name.includes('playstation') || name.includes('ps')) {
      return (
        <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-black shrink-0">
          <Gamepad2 className="w-4 h-4" />
        </div>
      );
    }
    if (name.includes('pc') || name.includes('computer')) {
      return (
        <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-black shrink-0">
          <Monitor className="w-4 h-4" />
        </div>
      );
    }
    if (name.includes('xbox')) {
      return (
        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-black shrink-0">
          <Gamepad2 className="w-4 h-4" />
        </div>
      );
    }
    if (name.includes('vr') || name.includes('oculus')) {
      return (
        <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-black shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/20 text-accent flex items-center justify-center font-black shrink-0">
        <Gamepad2 className="w-4 h-4" />
      </div>
    );
  };

  const handleDeleteResource = async (resourceId: string) => {
    const ok = await gameZoneService.deleteResource(resourceId);
    if (ok) {
      triggerAlert('Gaming Station removed', 'info');
      loadGameZoneAdminData();
    }
  };

  const handleDeletePlatform = async (platformId: string) => {
    const ok = await gameZoneService.deletePlatform(platformId);
    if (ok) {
      triggerAlert('Platform removed', 'info');
      loadGameZoneAdminData();
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    const ok = await gameZoneService.deleteGame(gameId);
    if (ok) {
      triggerAlert('Game removed from catalog', 'info');
      loadGameZoneAdminData();
    }
  };

  const filteredResources = useMemo(() => {
    return gameZoneResources.filter(r => {
      const matchSearch = r.name.toLowerCase().includes(gzSearch.toLowerCase()) ||
                          r.platform_type.toLowerCase().includes(gzSearch.toLowerCase());
      const matchPlatform = gzPlatformFilter === 'ALL' ||
                            r.platform_type.toLowerCase() === gzPlatformFilter.toLowerCase();
      return matchSearch && matchPlatform;
    });
  }, [gameZoneResources, gzSearch, gzPlatformFilter]);

  const renderGameZone = () => {
    const activeStationsCount = gameZoneResources.filter(r => r.status === 'ACTIVE').length;
    const maintenanceStationsCount = gameZoneResources.filter(r => r.status === 'MAINTENANCE').length;

    return (
      <div className="space-y-8 animate-in fade-in zoom-in duration-500">
        {/* Top Header */}
        <div className="w-full flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 p-8 bg-card rounded-[2.5rem] border border-border shadow-sm relative overflow-hidden">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-accent">
                RESOURCE-BASED VENUE
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tight text-text-primary">
              Game Zone <span style={{ color: theme.colors.accent }}>Management</span>
            </h2>
            <p className="text-xs font-bold uppercase tracking-widest text-text-disabled mt-1.5">
              Configure gaming stations, platforms, and game catalog for {dashboardLocation?.name}
            </p>
          </div>

          {/* Vertically stacked action buttons pushed to the far right end */}
          <div className="flex flex-col items-stretch sm:items-end gap-2.5 shrink-0 ml-auto w-full sm:w-auto">
            <button
              onClick={() => setShowAddPlatformModal(true)}
              className="w-full sm:w-48 px-5 py-2.5 rounded-xl bg-background-secondary border border-border text-xs font-black uppercase tracking-wider hover:border-accent transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4 text-accent" />
              <span>Add Platform</span>
            </button>
            <button
              onClick={() => setShowAddResourceModal(true)}
              className="w-full sm:w-48 px-5 py-2.5 rounded-xl bg-accent text-white text-xs font-black uppercase tracking-wider shadow-lg flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Station</span>
            </button>
            <button
              onClick={() => setShowAddGameModal(true)}
              className="w-full sm:w-48 px-5 py-2.5 rounded-xl bg-background-secondary border border-border text-xs font-black uppercase tracking-wider hover:border-accent transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Add Game</span>
            </button>
          </div>
        </div>

        {/* Overview Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-2xl bg-card border border-border shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-text-disabled mb-1">
              Gaming Stations
            </p>
            <p className="text-2xl font-black text-text-primary">
              {gameZoneResources.length}
            </p>
            <p className="text-[10px] font-bold text-emerald-400 uppercase mt-1">
              ● {activeStationsCount} Active {maintenanceStationsCount > 0 ? `• ${maintenanceStationsCount} Maint.` : ''}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-text-disabled mb-1">
              Platforms
            </p>
            <p className="text-2xl font-black text-text-primary">
              {gameZonePlatforms.length}
            </p>
            <p className="text-[10px] font-bold text-accent uppercase mt-1">
              Configured Types
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-text-disabled mb-1">
              Games Catalog
            </p>
            <p className="text-2xl font-black text-text-primary">
              {gameZoneGames.length}
            </p>
            <p className="text-[10px] font-bold text-blue-400 uppercase mt-1">
              Available Titles
            </p>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex gap-2">
            {[
              { id: 'STATIONS', label: `Stations (${gameZoneResources.length})`, icon: Gamepad2 },
              { id: 'PLATFORMS', label: `Platforms (${gameZonePlatforms.length})`, icon: Monitor },
              { id: 'GAMES', label: `Games (${gameZoneGames.length})`, icon: Sparkles }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setGzSubTab(tab.id as any)}
                className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 border ${
                  gzSubTab === tab.id
                    ? 'bg-accent text-white border-accent shadow-md'
                    : 'bg-card border-border text-text-secondary hover:border-accent/50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* SUB-TAB 1: STATIONS */}
        {gzSubTab === 'STATIONS' && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-disabled" />
                <input
                  type="text"
                  placeholder="Search stations..."
                  value={gzSearch}
                  onChange={e => setGzSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-xs font-bold outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={gzPlatformFilter}
                  onChange={e => setGzPlatformFilter(e.target.value)}
                  className="p-2.5 rounded-xl bg-card border border-border text-xs font-bold outline-none"
                >
                  <option value="ALL">All Platforms</option>
                  {gameZonePlatforms.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>

                <button
                  onClick={() => {
                    if (gameZonePlatforms.length > 0) {
                      setNewResourceForm(prev => ({ ...prev, platform_type: gameZonePlatforms[0].name }));
                    }
                    setShowAddResourceModal(true);
                  }}
                  className="px-4 py-2.5 bg-accent text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shrink-0 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Station</span>
                </button>
              </div>
            </div>

            {gzLoading ? (
              <div className="p-12 text-center text-text-disabled">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-accent" />
                <p className="text-xs font-bold uppercase tracking-widest">Loading Stations...</p>
              </div>
            ) : filteredResources.length === 0 ? (
              <div className="p-12 text-center bg-card border border-border rounded-3xl space-y-4">
                <Gamepad2 className="w-12 h-12 text-text-disabled mx-auto opacity-40" />
                <h4 className="text-lg font-black uppercase italic text-text-primary">
                  No Gaming Stations Configured Yet
                </h4>
                <p className="text-xs text-text-secondary max-w-md mx-auto font-medium">
                  Add stations like PS5-01 or PC-01 so players can select and book individual gaming resources.
                </p>
                <div className="flex justify-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      if (gameZonePlatforms.length === 0) {
                        setShowAddPlatformModal(true);
                      } else {
                        setShowAddResourceModal(true);
                      }
                    }}
                    className="px-6 py-3 bg-accent text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg"
                  >
                    {gameZonePlatforms.length === 0 ? '+ Create Platform First' : '+ Create First Station'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredResources.map((res) => {
                  const stationGamesCount = gameZoneGames.filter(g =>
                    !g.platform_type || g.platform_type.toLowerCase() === res.platform_type.toLowerCase()
                  ).length;

                  return (
                    <motion.div
                      key={res.id}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => setSelectedStationDetail(res)}
                      className="p-5 rounded-3xl bg-card border border-border hover:border-accent transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm relative group cursor-pointer"
                    >
                      {/* Left Side: Icon, Station Name & Platform Badge */}
                      <div className="flex items-center gap-4 min-w-0">
                        {getPlatformIcon(res.platform_type)}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2.5 mb-1">
                            <h4 className="font-black text-xl uppercase italic text-text-primary tracking-tight">
                              {res.name}
                            </h4>
                            <span className="px-3 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-[10px] font-black uppercase tracking-widest shrink-0">
                              {res.platform_type}
                            </span>
                          </div>
                          <p className="text-xs text-text-secondary font-medium truncate">
                            {res.description || 'Click row to inspect station specs & available games'}
                          </p>
                        </div>
                      </div>

                      {/* Right Side: Specs, Rate, Status Pill & Actions */}
                      <div className="flex items-center gap-6 shrink-0 justify-between md:justify-end pt-3 md:pt-0 border-t md:border-t-0 border-border/50">
                        <div className="text-left md:text-right">
                          {hasPricingRules(res.id) ? (
                            <p className="text-emerald-400 font-black text-base">₹{getStationPrice(res.id)} / hr</p>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveTab('pricing');
                                const plat = gameZonePlatforms.find(p => p.name.toLowerCase() === res.platform_type.toLowerCase());
                                if (plat) setSelectedCourtId(plat.id);
                                setSelectedStationIds([res.id]);
                              }}
                              className="px-3 py-1 rounded-xl bg-accent/20 text-accent text-xs font-black uppercase tracking-widest hover:bg-accent/30 transition-all shadow-sm"
                            >
                              Add Price +
                            </button>
                          )}
                          <p className="text-text-disabled text-[10px] font-bold uppercase tracking-wider mt-1">
                            Up to {res.max_players} Gamers • {stationGamesCount} Games
                          </p>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleResourceStatus(res.id, res.status);
                          }}
                          title="Click to cycle status"
                          className={`px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                            res.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                              : res.status === 'MAINTENANCE'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                              : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                          }`}
                        >
                          ● {res.status}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteResource(res.id);
                          }}
                          className="p-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                          title="Delete Station"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SUB-TAB 2: PLATFORMS */}
        {gzSubTab === 'PLATFORMS' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-widest text-text-secondary">
                Gaming Platforms ({gameZonePlatforms.length})
              </h3>
              <button
                onClick={() => setShowAddPlatformModal(true)}
                className="px-4 py-2 bg-accent text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>New Platform</span>
              </button>
            </div>

            {gameZonePlatforms.length === 0 ? (
              <div className="p-12 text-center bg-card border border-border rounded-3xl space-y-4">
                <Monitor className="w-12 h-12 text-text-disabled mx-auto opacity-40" />
                <h4 className="text-lg font-black uppercase italic text-text-primary">
                  No Platforms Configured
                </h4>
                <p className="text-xs text-text-secondary max-w-md mx-auto font-medium">
                  Create platforms like PlayStation, Gaming PC, Xbox, or VR to categorize your gaming stations.
                </p>
                <div className="flex justify-center gap-3 pt-2">
                  <button
                    onClick={() => setShowAddPlatformModal(true)}
                    className="px-6 py-3 bg-accent text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg"
                  >
                    + Add Platform
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {gameZonePlatforms.map((p) => {
                  const linkedCount = gameZoneResources.filter(r =>
                    r.platform_type.toLowerCase() === p.name.toLowerCase() ||
                    r.platform_id === p.id
                  ).length;

                  return (
                    <div
                      key={p.id}
                      className="p-5 rounded-3xl bg-card border border-border hover:border-accent/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        {getPlatformIcon(p.name, p.icon)}
                        <div>
                          <h4 className="font-black text-xl uppercase italic text-text-primary mb-0.5">
                            {p.name}
                          </h4>
                          <p className="text-xs text-text-secondary font-medium">
                            {p.description || 'Gaming platform category'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end pt-3 md:pt-0 border-t md:border-t-0 border-border/50">
                        <span className="px-3.5 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-black uppercase tracking-widest">
                          {linkedCount} Stations
                        </span>

                        <button
                          onClick={() => {
                            setNewResourceForm(prev => ({ ...prev, platform_type: p.name }));
                            setShowAddResourceModal(true);
                          }}
                          className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-black uppercase tracking-wider hover:shadow-md transition-all flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Station
                        </button>

                        <button
                          onClick={() => handleDeletePlatform(p.id)}
                          className="p-2.5 rounded-xl text-text-disabled hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SUB-TAB 3: GAMES */}
        {gzSubTab === 'GAMES' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-widest text-text-secondary">
                Games Catalog ({gameZoneGames.length})
              </h3>
              <button
                onClick={() => setShowAddGameModal(true)}
                className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>New Game</span>
              </button>
            </div>

            {gameZoneGames.length === 0 ? (
              <div className="p-12 text-center bg-card border border-border rounded-3xl space-y-4">
                <Sparkles className="w-12 h-12 text-text-disabled mx-auto opacity-40" />
                <h4 className="text-lg font-black uppercase italic text-text-primary">
                  Games Catalog Empty
                </h4>
                <p className="text-xs text-text-secondary max-w-md mx-auto font-medium">
                  Add available game titles like EA FC 24 or Tekken 8 so gamers can optionally pick what they want to play.
                </p>
                <button
                  onClick={() => setShowAddGameModal(true)}
                  className="px-6 py-3 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg"
                >
                  + Add First Game
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {gameZoneGames.map((g) => (
                  <div
                    key={g.id}
                    className="p-4 rounded-2xl bg-card border border-border hover:border-accent/50 transition-all flex items-center justify-between gap-4 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🕹</span>
                      <div>
                        <h4 className="font-black text-base uppercase italic text-text-primary">
                          {g.title}
                        </h4>
                        <p className="text-[10px] text-text-disabled font-bold uppercase">
                          {g.description || 'Catalog Game Title'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 rounded-full bg-accent/10 text-accent text-[10px] font-black uppercase tracking-wider">
                        {g.platform_type || 'All Platforms'}
                      </span>

                      <button
                        onClick={() => handleDeleteGame(g.id)}
                        className="p-2 rounded-lg text-text-disabled hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MODAL 1: ADD PLATFORM */}
        <AnimatePresence>
          {showAddPlatformModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="p-6 rounded-3xl bg-card border border-border w-full max-w-md space-y-4 shadow-2xl">
                <h3 className="text-xl font-black uppercase italic text-text-primary">Add Platform</h3>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-text-disabled">Platform Name</label>
                  <input type="text" placeholder="e.g., PlayStation or Gaming PC" value={newPlatformForm.name} onChange={e => setNewPlatformForm({ ...newPlatformForm, name: e.target.value })} className="w-full p-3.5 rounded-xl bg-background border border-border text-xs font-bold outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-text-disabled">Description</label>
                  <input type="text" placeholder="e.g., PS5 4K Gaming Setup" value={newPlatformForm.description} onChange={e => setNewPlatformForm({ ...newPlatformForm, description: e.target.value })} className="w-full p-3.5 rounded-xl bg-background border border-border text-xs font-bold outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-text-disabled">Icon Emoji</label>
                  <input type="text" placeholder="🎮 or 🖥 or 🥽" value={newPlatformForm.icon} onChange={e => setNewPlatformForm({ ...newPlatformForm, icon: e.target.value })} className="w-full p-3.5 rounded-xl bg-background border border-border text-xs font-bold outline-none focus:border-accent" />
                </div>
                <div className="flex gap-2 justify-end pt-3 border-t border-border">
                  <button onClick={() => setShowAddPlatformModal(false)} className="px-4 py-2.5 rounded-xl text-xs font-bold text-text-secondary hover:bg-background-secondary">Cancel</button>
                  <button onClick={handleCreatePlatform} className="px-6 py-2.5 bg-accent text-white rounded-xl text-xs font-black uppercase shadow-lg">Save Platform</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL 2: ADD RESOURCE (STATION) */}
        <AnimatePresence>
          {showAddResourceModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="p-6 rounded-3xl bg-card border border-border w-full max-w-md space-y-4 shadow-2xl">
                <h3 className="text-xl font-black uppercase italic text-text-primary">Add Gaming Station</h3>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-text-disabled">Station Name</label>
                  <input type="text" placeholder="e.g., PS5-01 or PC-01" value={newResourceForm.name} onChange={e => setNewResourceForm({ ...newResourceForm, name: e.target.value })} className="w-full p-3.5 rounded-xl bg-background border border-border text-xs font-bold outline-none focus:border-accent" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-text-disabled">Platform</label>
                    <select value={newResourceForm.platform_type} onChange={e => setNewResourceForm({ ...newResourceForm, platform_type: e.target.value })} className="w-full p-3.5 rounded-xl bg-background border border-border text-xs font-bold outline-none">
                      {gameZonePlatforms.length === 0 ? (
                        <option value="">No Platforms Created Yet</option>
                      ) : (
                        gameZonePlatforms.map(p => (
                          <option key={p.id} value={p.name}>{p.name}</option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-text-disabled">Max Players</label>
                    <input type="number" min="1" max="10" value={newResourceForm.max_players} onChange={e => setNewResourceForm({ ...newResourceForm, max_players: Number(e.target.value) })} className="w-full p-3.5 rounded-xl bg-background border border-border text-xs font-bold outline-none" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-3 border-t border-border">
                  <button onClick={() => setShowAddResourceModal(false)} className="px-4 py-2.5 rounded-xl text-xs font-bold text-text-secondary hover:bg-background-secondary">Cancel</button>
                  <button onClick={handleCreateResource} className="px-6 py-2.5 bg-accent text-white rounded-xl text-xs font-black uppercase shadow-lg">Save Station</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL 3: ADD GAME */}
        <AnimatePresence>
          {showAddGameModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="p-6 rounded-3xl bg-card border border-border w-full max-w-md space-y-4 shadow-2xl">
                <h3 className="text-xl font-black uppercase italic text-text-primary">Add Game to Catalog</h3>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-text-disabled">Game Title</label>
                  <input type="text" placeholder="e.g., EA FC 24 or Tekken 8" value={newGameForm.title} onChange={e => setNewGameForm({ ...newGameForm, title: e.target.value })} className="w-full p-3.5 rounded-xl bg-background border border-border text-xs font-bold outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-text-disabled">Platform Category</label>
                  <select value={newGameForm.platform_type} onChange={e => setNewGameForm({ ...newGameForm, platform_type: e.target.value })} className="w-full p-3.5 rounded-xl bg-background border border-border text-xs font-bold outline-none">
                    <option value="All Platforms">All Platforms</option>
                    {gameZonePlatforms.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 justify-end pt-3 border-t border-border">
                  <button onClick={() => setShowAddGameModal(false)} className="px-4 py-2.5 rounded-xl text-xs font-bold text-text-secondary hover:bg-background-secondary">Cancel</button>
                  <button onClick={handleCreateGame} className="px-6 py-2.5 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase shadow-lg">Save Game</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL 4: INTERACTIVE STATION DETAIL CARD */}
        <AnimatePresence>
          {selectedStationDetail && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="p-8 rounded-[2.5rem] bg-card border border-border w-full max-w-lg space-y-6 shadow-2xl relative overflow-hidden"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getPlatformIcon(selectedStationDetail.platform_type)}
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">
                        {selectedStationDetail.platform_type} PLATFORM
                      </span>
                      <h3 className="text-2xl font-black italic uppercase text-text-primary">
                        {selectedStationDetail.name}
                      </h3>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleResourceStatus(selectedStationDetail.id, selectedStationDetail.status)}
                    className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border transition-all ${
                      selectedStationDetail.status === 'ACTIVE'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                        : selectedStationDetail.status === 'MAINTENANCE'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                    }`}
                  >
                    ● {selectedStationDetail.status}
                  </button>
                </div>

                {/* Specs Cards Grid */}
                <div className="grid grid-cols-2 gap-4 p-5 rounded-2xl bg-background border border-border">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-text-disabled mb-1">
                      Hourly Rate
                    </p>
                    {hasPricingRules(selectedStationDetail.id) ? (
                      <p className="text-xl font-black text-emerald-400">
                        ₹{getStationPrice(selectedStationDetail.id)} / hr
                      </p>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedStationDetail(null);
                          setActiveTab('pricing');
                          const plat = gameZonePlatforms.find(p => p.name.toLowerCase() === selectedStationDetail.platform_type.toLowerCase());
                          if (plat) setSelectedCourtId(plat.id);
                          setSelectedStationIds([selectedStationDetail.id]);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-accent/20 text-accent text-xs font-black uppercase tracking-widest hover:bg-accent/35 transition-all mt-1 shadow-sm"
                      >
                        Add Price +
                      </button>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-text-disabled mb-1">
                      Gamers Capacity
                    </p>
                    <p className="text-xl font-black text-text-primary">
                      Up to {selectedStationDetail.max_players} Players
                    </p>
                  </div>
                </div>

                {/* Available Games at this Station */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-text-secondary flex items-center justify-between">
                    <span>Available Games ({gameZoneGames.filter(g => !g.platform_type || g.platform_type.toLowerCase() === selectedStationDetail.platform_type.toLowerCase()).length})</span>
                    <span className="text-[10px] text-accent font-bold">{selectedStationDetail.platform_type} Catalog</span>
                  </h4>

                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {gameZoneGames.filter(g => !g.platform_type || g.platform_type.toLowerCase() === selectedStationDetail.platform_type.toLowerCase()).length === 0 ? (
                      <div className="col-span-2 text-center py-6 p-4 rounded-xl bg-background border border-border">
                        <p className="text-xs font-bold text-text-disabled uppercase">
                          No games added to {selectedStationDetail.platform_type} catalog yet
                        </p>
                        <button
                          onClick={() => {
                            setNewGameForm(prev => ({ ...prev, platform_type: selectedStationDetail.platform_type }));
                            setSelectedStationDetail(null);
                            setShowAddGameModal(true);
                          }}
                          className="mt-2 text-xs font-black uppercase tracking-wider text-accent hover:underline"
                        >
                          + Add Game for {selectedStationDetail.platform_type}
                        </button>
                      </div>
                    ) : (
                      gameZoneGames
                        .filter(g => !g.platform_type || g.platform_type.toLowerCase() === selectedStationDetail.platform_type.toLowerCase())
                        .map(g => (
                          <div key={g.id} className="p-3 rounded-xl bg-background border border-border flex items-center gap-2">
                            <span className="text-lg">🕹</span>
                            <div>
                              <p className="font-black text-xs uppercase text-text-primary">{g.title}</p>
                              <p className="text-[9px] text-text-disabled font-bold">{g.platform_type || 'All'}</p>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <button
                    onClick={() => {
                      handleDeleteResource(selectedStationDetail.id);
                      setSelectedStationDetail(null);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-red-500/10 text-red-400 font-bold text-xs uppercase tracking-wider hover:bg-red-500/20"
                  >
                    Delete Station
                  </button>

                  <button
                    onClick={() => setSelectedStationDetail(null)}
                    className="px-6 py-2.5 rounded-xl bg-accent text-white font-black text-xs uppercase tracking-wider shadow-lg"
                  >
                    Close Details
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderAbout = () => (
    <div className="space-y-6 md:space-y-6 animate-in fade-in zoom-in duration-500">
      {!isGameZoneArena && dashboardLocation?.courts && dashboardLocation.courts.length > 1 && (
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 md:gap-4 bg-card md:bg-card p-6 md:p-4 rounded-[2.5rem] md:rounded-3xl border border-border shadow-theme-card max-w-2xl mx-auto">
          <div className="flex gap-2.5 md:gap-2 overflow-x-auto pb-2 md:pb-1 no-scrollbar w-full md:w-auto px-1 md:px-0">
            {dashboardLocation.courts.map((court) => (
              <button
                key={court.id}
                onClick={() => setSelectedCourtId(court.id)}
                className={`px-7 py-3.5 md:px-6 md:py-3 rounded-2xl md:rounded-2xl font-black text-xs md:text-sm uppercase tracking-widest transition-all border shrink-0 shadow-sm md:shadow-none ${selectedCourtId === court.id ? 'bg-accent text-white border-accent shadow-theme-elevated md:shadow-none scale-105 md:scale-100' : 'bg-background-secondary text-text-secondary border-border'}`}
              >
                {court.name || `Court ${court.courtNumber}`}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="w-full max-w-2xl mx-auto py-8 md:py-12 md:max-w-2xl">
        <div className="p-8 md:p-12 border shadow-theme-modal md:shadow-theme-modal relative overflow-hidden transition-all bg-card md:bg-card rounded-[3rem] md:rounded-theme-lg"
             style={{ borderColor: theme.colors.border }}>
          <div className="absolute -bottom-20 -left-20 w-40 h-40 blur-3xl rounded-full opacity-5 pointer-events-none bg-accent md:bg-accent" />
          <div className="text-center mb-10 md:mb-12">
            <div className={`w-16 h-16 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 md:mb-4 shadow-theme-elevated transform md:rotate-3 rotate-3 text-white transition-all bg-accent`}
                 style={{ backgroundColor: theme.colors.accent }}>
              <Info className="w-8 h-8 md:w-8 md:h-8" />
            </div>
            <h2 className="text-2xl md:text-3xl font-black italic md:not-italic uppercase tracking-tighter md:tracking-tight text-text-primary">
              {!isGameZoneArena && selectedCourtId && dashboardLocation?.courts?.find(c => c.id === selectedCourtId)
                ? (dashboardLocation.courts.find(c => c.id === selectedCourtId)?.name || 'Court Details')
                : 'Arena Details'}
            </h2>
            <p className="text-[10px] md:text-[10px] font-black uppercase tracking-[0.3em] mt-3 md:mt-2 text-text-disabled">
              {!isGameZoneArena && selectedCourtId && dashboardLocation?.courts?.find(c => c.id === selectedCourtId)
                ? `Description for ${dashboardLocation.courts.find(c => c.id === selectedCourtId)?.name || 'Court'}`
                : 'About Section Content'}
            </p>
          </div>
          <div className="space-y-8 md:space-y-6 relative z-10">
            <div className="space-y-3 md:space-y-2">
              <label className="text-[10px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-widest ml-1 text-text-disabled opacity-60 md:opacity-100">
                {!isGameZoneArena && selectedCourtId ? 'Court Description' : 'Arena Description'}
              </label>
              <textarea
                value={aboutForm.description || ''}
                onChange={e => setAboutForm({ ...aboutForm, description: e.target.value })}
                className="w-full p-6 md:p-4 border-2 border-transparent rounded-[1.5rem] md:rounded-2xl font-bold md:font-bold outline-none shadow-inner min-h-[160px] md:min-h-[120px] text-sm md:text-sm bg-background-secondary md:bg-background-secondary text-text-primary resize-none md:resize-y"
                placeholder={!isGameZoneArena && selectedCourtId ? "Tell players about this court..." : "Tell players about your arena..."}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-4">
              <div className="space-y-3 md:space-y-2">
                <label className="text-[10px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-widest ml-1 text-text-disabled opacity-60 md:opacity-100">Contact Info (Global)</label>
                <div className="relative">
                  <Phone className="absolute left-5 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-accent md:text-text-disabled opacity-60 md:opacity-40" />
                  <input
                    type="text"
                    maxLength={10}
                    value={(aboutForm as Location).contact || ''}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setAboutForm({ ...aboutForm, contact: val });
                    }}
                    className="w-full pl-14 md:pl-12 pr-6 md:pr-4 py-5 md:py-4 border-2 border-transparent rounded-[1.5rem] md:rounded-2xl font-black md:font-bold outline-none shadow-inner text-sm md:text-sm bg-background-secondary md:bg-background-secondary text-text-primary"
                    placeholder="Phone number"
                  />
                </div>
              </div>
              <div className="space-y-3 md:space-y-2">
                <label className="text-[10px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-widest ml-1 text-text-disabled opacity-60 md:opacity-100">Current Rating (Automated)</label>
                <div className="relative">
                  <Star className="absolute left-5 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400 md:text-accent" />
                  <div
                    className="w-full pl-14 md:pl-12 pr-6 md:pr-4 py-5 md:py-4 rounded-[1.5rem] md:rounded-2xl font-black md:font-black shadow-inner border-2 border-transparent flex items-center text-sm md:text-sm bg-background-secondary md:bg-background-secondary text-text-primary"
                  >
                    {(aboutForm as Location).rating || '0'}
                  </div>
                </div>
                <p className="text-[9px] md:text-[9px] font-black uppercase tracking-widest mt-1 text-text-disabled opacity-40 md:opacity-100 ml-1 italic md:not-italic">Calculated from user reviews</p>
              </div>
            </div>
            <div className="p-6 md:p-4 rounded-[1.5rem] md:rounded-2xl border border-border flex items-center justify-between bg-background-secondary/40 md:bg-background-secondary shadow-sm md:shadow-none" style={{ borderColor: theme.colors.border }}>
              <div className="flex items-center gap-4 md:gap-3">
                <div className="p-2.5 md:p-0 rounded-xl md:rounded-none bg-accent/10 md:bg-transparent">
                    <ShieldCheck className="w-5 h-5 text-accent" />
                </div>
                <span className="text-[11px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-widest text-text-primary">Advance Booking Required</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!(aboutForm as Location).advanceBookingRequired}
                  onChange={e => setAboutForm({ ...aboutForm, advanceBookingRequired: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-12 h-7 md:w-11 md:h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] md:after:top-[2px] after:left-[4px] md:after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 md:after:h-5 after:w-5 md:after:w-5 after:transition-all peer-checked:bg-accent shadow-inner md:shadow-none"></div>
              </label>
            </div>
            <button onClick={handleUpdateAbout} disabled={isActionLoading} className="w-full py-5 md:py-5 rounded-2xl md:rounded-2xl font-black uppercase tracking-widest shadow-theme-elevated md:shadow-theme-elevated transition-all disabled:opacity-50 flex items-center justify-center gap-4 md:gap-3 bg-text-primary md:bg-text-primary text-background md:text-background mt-6 md:mt-0 active:translate-y-1 md:active:translate-y-1 text-sm md:text-sm"
                    style={{ backgroundColor: theme.colors.textPrimary, color: theme.colors.background }}>
              {isActionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-6 h-6 md:w-6 md:h-6" />} Save Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSecurity = () => (
    <div className="w-full max-w-[90vw] md:max-w-2xl mx-auto py-[8vw] md:py-12 animate-in fade-in zoom-in duration-500">
      <div className="p-[var(--fluid-padding)] md:p-12 border shadow-theme-modal relative overflow-hidden transition-all"
           style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radius.large }}>
        <div className="absolute -bottom-[20vw] md:-bottom-20 -left-[20vw] md:-left-20 w-[40vw] md:w-40 h-[40vw] md:h-40 blur-3xl rounded-full opacity-10" style={{ backgroundColor: theme.colors.accent }} />
        <div className="text-center mb-[var(--fluid-padding)] md:mb-12">
          <div className={`w-[16vw] h-[16vw] md:w-16 md:h-16 rounded-[4vw] md:rounded-2xl flex items-center justify-center mx-auto mb-[4vw] md:mb-4 shadow-theme-elevated transform rotate-3 text-white transition-all`}
               style={{ backgroundColor: theme.colors.accent }}>
            <Lock className="w-[8vw] h-[8vw] md:w-8 md:h-8" />
          </div>
          <h2 className="text-[7vw] md:text-3xl font-black italic uppercase tracking-tighter" style={{ color: theme.colors.textPrimary }}>Login Settings</h2>
          <p className="text-[2.5vw] md:text-[10px] font-black uppercase tracking-[0.3em] mt-[2vw] md:mt-2" style={{ color: theme.colors.textDisabled }}>Update Access Credentials</p>
        </div>
        <form onSubmit={handleUpdateCredentials} className="space-y-[4vw] md:space-y-4 relative z-10">
          <input type="password" value={currentPwdForUpdate} onChange={e => setCurrentPwdForUpdate(e.target.value)} className="w-full p-[4vw] md:p-4 border-2 border-transparent rounded-[4vw] md:rounded-2xl font-black outline-none shadow-inner text-[3.5vw] md:text-base" style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary }} required placeholder="Current Password" />
          <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} className="w-full p-[4vw] md:p-4 border-2 border-transparent rounded-[4vw] md:rounded-2xl font-black outline-none shadow-inner text-[3.5vw] md:text-base" style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary }} placeholder="New Username" />
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full p-[4vw] md:p-4 border-2 border-transparent rounded-[4vw] md:rounded-2xl font-black outline-none shadow-inner text-[3.5vw] md:text-base" style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary }} placeholder="New Password" />
          <input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} className="w-full p-[4vw] md:p-4 border-2 border-transparent rounded-[4vw] md:rounded-2xl font-black outline-none shadow-inner text-[3.5vw] md:text-base" style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary }} placeholder="Confirm New Password" />
          <button type="submit" disabled={loading} className="w-full py-[5vw] md:py-5 rounded-[4vw] md:rounded-2xl font-black uppercase tracking-widest shadow-theme-elevated transition-all disabled:opacity-50 flex items-center justify-center gap-[3vw] md:gap-3 active:translate-y-1 text-[2.8vw] md:text-sm"
                  style={{ backgroundColor: theme.colors.textPrimary, color: theme.colors.background }}>
            {loading ? <div className="w-[5vw] h-[5vw] md:w-5 md:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <ShieldCheck className="w-[var(--icon-size)] h-[var(--icon-size)] md:w-6 md:h-6" />} Save Settings
          </button>
        </form>
      </div>
    </div>
  );

  const renderBookings = () => (
    <div className="space-y-6 md:space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="p-6 md:p-6 border shadow-theme-card md:shadow-theme-card flex flex-col md:flex-row items-center justify-between gap-6 md:gap-6 relative overflow-hidden transition-all bg-card md:bg-card rounded-[2rem] md:rounded-theme-lg"
           style={{ borderColor: theme.colors.border }}>
        <div className="absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full opacity-5 pointer-events-none bg-accent md:hidden" />
        <div className="flex p-1.5 rounded-2xl md:rounded-2xl w-full md:w-auto border shadow-inner bg-background-secondary md:bg-background-secondary" style={{ borderColor: theme.colors.border }}>
          {(['day', 'month', 'year'] as const).map(p => (
            <button key={p} onClick={() => setTimeFilter(p)} className={`flex-1 px-8 py-2.5 md:px-8 md:py-2 rounded-xl md:rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${timeFilter === p ? 'bg-accent text-white shadow-theme-elevated md:shadow-theme-elevated scale-105 md:scale-105 italic md:not-italic' : 'text-text-secondary hover:text-text-primary'}`}>
              {p}
            </button>
          ))}
        </div>
        <div className="relative group w-full md:w-auto">
          <input type={timeFilter === 'day' ? 'date' : timeFilter === 'month' ? 'month' : 'number'} value={timeFilter === 'year' ? filterDate.slice(0, 4) : filterDate.slice(0, timeFilter === 'day' ? 10 : 7)} onChange={(e) => { let val = e.target.value; setFilterDate(timeFilter === 'year' ? `${val}-01-01` : (val.length === 7 ? `${val}-01` : val)); }} className="w-full md:w-[250px] p-4 md:p-3 border-2 border-transparent rounded-2xl md:rounded-xl font-black outline-none transition-all shadow-inner text-sm md:text-sm bg-background-secondary md:bg-background-secondary" style={{ color: theme.colors.textPrimary }} />
        </div>
      </div>

      <div className="space-y-4 md:space-y-6">
        {loading ? (
          <div className="flex flex-col items-center py-24 md:py-20 animate-pulse gap-5 md:gap-4">
            <Loader2 className="w-12 h-12 border-4 border-border rounded-full animate-spin" style={{ borderTopColor: theme.colors.accent }} />
            <p className="text-xs md:text-xs font-black uppercase tracking-[0.4em] opacity-40 md:opacity-100">Synchronizing Ledger...</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="text-center py-24 md:py-20 rounded-[2.5rem] md:rounded-[2rem] border-2 border-dashed shadow-inner bg-background-secondary/30 md:bg-background-secondary" style={{ borderColor: theme.colors.border }}>
            <p className="font-black uppercase text-sm md:text-sm tracking-widest opacity-40 md:opacity-100" style={{ color: theme.colors.textDisabled }}>No Recent Activity Found</p>
          </div>
        ) : (
          filteredBookings.map((b, idx) => {
            const isExpanded = expandedBookingIds.has(b.id);
            const court = dashboardLocation?.courts?.find(c => c.id === b.courtId || c.id === b.court_id);
            const resource = gameZoneResources?.find(r => r.id === b.resourceId || r.id === b.resource_id);
            const courtName = court
              ? (court.name || `Court ${court.courtNumber}`)
              : resource
              ? resource.name
              : (b.sport === 'Game Zone' || b.resource_id || b.resourceId ? 'Gaming Station' : 'Unknown Court');

            const collectedFromLedger = payments
              .filter(p => p.booking_id === b.id)
              .reduce((sum, p) => sum + Number(p.amount || 0), 0);
            const collected = Math.max(collectedFromLedger, Number(b.advancePaid || b.advance_paid || b.advance_price || 0));
            const isFullyPaid = collected >= b.amount;
            const isManual = b.bookedBy === 'Admin' || b.booked_by === 'admin' || b.bookedBy === 'admin';

            const statusBadgeText = isManual
              ? (isFullyPaid ? 'MANUAL PAID FULL' : 'MANUAL BOOKED')
              : (b.status === BookingStatus.BOOKED ? 'Booked' : b.status.replace('_', ' '));

            const userProfile = b.user_id ? userProfilesMap.get(String(b.user_id)) : null;
            const userPhone = b.phone || userProfile?.phone_number || '';
            const userEmail = userProfile?.email || '';

            const toggleExpand = () => {
              setExpandedBookingIds(prev => {
                const next = new Set(prev);
                if (next.has(b.id)) next.delete(b.id);
                else next.add(b.id);
                return next;
              });
            };

            return (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                key={b.id}
                className="rounded-[1.5rem] md:rounded-2xl border transition-all group shadow-sm hover:shadow-md bg-card overflow-hidden"
                style={{ borderColor: theme.colors.border }}
              >
                {/* Line 1: Main Row (Slot Timing & Quick Info) - Always Visible */}
                <div
                  onClick={toggleExpand}
                  className="p-4 md:p-5 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-background-secondary/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-inner text-xl bg-background-secondary border border-border shrink-0">
                      {b.sport?.includes('Football') ? '⚽' : b.sport?.includes('Badminton') ? '🏸' : b.sport?.includes('Pickleball') ? '🏓' : b.sport?.includes('Game Zone') ? '🎮' : '🏏'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base md:text-lg font-black italic tracking-tight text-text-primary">
                          {b.slotTime}
                        </h3>
                        <span className="text-xs font-black text-text-primary/80 truncate">
                          · {b.name || 'Anonymous'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase text-text-disabled mt-0.5">
                        <Calendar className="w-3 h-3 text-accent shrink-0" />
                        <span>{new Date(b.date).toLocaleDateString('en-GB')}</span>
                        <span className="opacity-40">|</span>
                        <span className="opacity-70">{new Date(b.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="px-3 py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-wider text-white shadow-sm italic"
                      style={{
                        backgroundColor: isFullyPaid || b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.APPROVED ? theme.colors.success :
                                       b.status === BookingStatus.BOOKED ? theme.colors.accent :
                                       b.status === BookingStatus.TIMED_OUT ? theme.colors.warning : theme.colors.error
                      }}
                    >
                      {statusBadgeText}
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-background-secondary border border-border text-[9px] md:text-[10px] font-black uppercase tracking-wider text-text-primary hidden sm:inline-block">
                      {courtName}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand();
                      }}
                      className="p-1.5 rounded-xl bg-background-secondary border border-border text-text-secondary hover:text-text-primary transition-all ml-1 flex items-center gap-1 text-[10px] font-black uppercase"
                      title={isExpanded ? 'Hide Details' : 'More Details'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-accent" /> : <ChevronDown className="w-4 h-4 text-accent" />}
                    </button>
                  </div>
                </div>

                {/* Dropdown Expanded Area: Lines 2 & 3 */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden border-t border-border/60 bg-background-secondary/20"
                    >
                      <div className="p-4 md:p-5 flex flex-col gap-4">
                        {/* Line 2: User Contact Details (Phone, Email, Call & WhatsApp Buttons) */}
                        <div className="bg-background-secondary/60 p-3.5 md:p-4 rounded-2xl border border-border flex flex-wrap md:flex-nowrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-[200px]">
                            <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center font-black shrink-0">
                              <UserIcon className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-text-primary">{b.name || 'Anonymous User'}</span>
                                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-card border border-border text-text-disabled">
                                  ID: {b.id.slice(0, 8).toUpperCase()}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-text-secondary font-medium">
                                {userPhone ? (
                                  <a
                                    href={`tel:${userPhone}`}
                                    className="flex items-center gap-1.5 font-bold text-accent hover:underline"
                                    title="Click to call user"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Phone className="w-3.5 h-3.5" />
                                    <span>{userPhone}</span>
                                  </a>
                                ) : (
                                  <span className="flex items-center gap-1.5 opacity-50 text-text-disabled">
                                    <Phone className="w-3.5 h-3.5" /> No Phone
                                  </span>
                                )}

                                {userEmail ? (
                                  <a
                                    href={`mailto:${userEmail}`}
                                    className="flex items-center gap-1.5 font-bold text-text-secondary hover:text-accent hover:underline"
                                    title="Click to email user"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Mail className="w-3.5 h-3.5" />
                                    <span>{userEmail}</span>
                                  </a>
                                ) : (
                                  <span className="flex items-center gap-1.5 opacity-50 text-text-disabled">
                                    <Mail className="w-3.5 h-3.5" /> No Email
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Quick Action Contact Buttons */}
                          {userPhone && (
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <a
                                href={`tel:${userPhone}`}
                                className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 hover:bg-emerald-500 hover:text-white transition-all"
                                title="Call User"
                              >
                                <Phone className="w-3 h-3" />
                                <span>Call</span>
                              </a>
                              <a
                                href={`https://wa.me/${userPhone.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 hover:bg-green-500 hover:text-white transition-all"
                                title="Chat on WhatsApp"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>WhatsApp</span>
                              </a>
                            </div>
                          )}
                        </div>

                        {/* Line 3: Finances Summary Box & Settlement/Confirm Action */}
                        <div className="bg-background-secondary/40 border border-border p-3.5 md:p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="grid grid-cols-3 gap-3 w-full sm:w-auto flex-1 text-xs">
                            <div className="space-y-0.5">
                              <p className="text-[9px] uppercase font-black tracking-wider text-text-disabled">PAID IN TX</p>
                              <p className="text-base font-black text-accent">₹{collected.toLocaleString()}</p>
                              <p className="text-[8px] font-black uppercase tracking-wider text-emerald-500">
                                {isFullyPaid ? 'FULLY PAID' : 'PARTIAL / ADVANCE'}
                              </p>
                            </div>
                            <div className="space-y-0.5 border-l border-border/60 pl-3">
                              <p className="text-[9px] uppercase font-black tracking-wider text-text-disabled">MATCH TOTAL</p>
                              <p className="text-base font-black text-text-primary">₹{b.amount.toLocaleString()}</p>
                            </div>
                            <div className="space-y-0.5 border-l border-border/60 pl-3">
                              <p className="text-[9px] uppercase font-black tracking-wider text-text-disabled">PENDING</p>
                              <p className={`text-base font-black ${isFullyPaid ? 'text-emerald-500' : 'text-rose-500'}`}>
                                ₹{Math.max(0, b.amount - collected).toLocaleString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 w-full sm:w-auto justify-end" onClick={(e) => e.stopPropagation()}>
                            {!isFullyPaid ? (
                              <button
                                disabled={isActionLoading}
                                onClick={() => handleSettlePayment(b)}
                                title="Collect Full Amount & Confirm"
                                className="px-5 py-2.5 bg-accent text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-theme-elevated active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                              >
                                {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                <span>Collect & Confirm</span>
                              </button>
                            ) : (
                              <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-black uppercase tracking-wider flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                <span>Fully Paid</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );

  const renderSchedule = () => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const year = scheduleViewDate.getFullYear();
    const month = scheduleViewDate.getMonth();

    const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const firstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

    const totalDays = daysInMonth(year, month);
    const startOffset = firstDayOfMonth(year, month);

    const daysList = [];
    for (let i = 0; i < startOffset; i++) daysList.push(null);
    for (let i = 1; i <= totalDays; i++) daysList.push(i);

    const handleMonthChange = (offset: number) => {
      setScheduleViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    };

    const formatDateString = (y: number, m: number, d: number) => {
      return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    };

    const getDatesInRange = (d1Str: string, d2Str: string): string[] => {
      const dates: string[] = [];
      const start = d1Str < d2Str ? d1Str : d2Str;
      const end = d1Str < d2Str ? d2Str : d1Str;

      const current = new Date(start + 'T00:00:00');
      const last = new Date(end + 'T00:00:00');

      while (current <= last) {
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${d}`);
        current.setDate(current.getDate() + 1);
      }
      return dates;
    };

    const handleDateClick = async (day: number) => {
      const dStr = formatDateString(year, month, day);

      if (rangeStart && rangeStart !== dStr) {
        // Window Range Selection: select all dates from rangeStart to dStr as a window
        const rangeDates = getDatesInRange(rangeStart, dStr);
        const todayObj = new Date();
        const todayStrLocal = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
        const validRangeDates = rangeDates.filter(d => d >= todayStrLocal);

        const startSched = schedules.find(s => s.date === rangeStart);
        const targetStatus = startSched?.status || 'green';

        let newSchedules = [...schedules];

        const mapOldOption = (opt?: string): any => {
          if (!opt) return 'one_time';
          if (opt === 'full_day' || opt === 'specific_time') return 'one_time';
          if (opt === 'every_week') return 'weekly';
          if (opt === 'every_month') return 'monthly';
          if (opt === 'every_year') return 'yearly';
          return opt;
        };

        validRangeDates.forEach(rDate => {
          if (targetStatus === 'green') {
            const current = newSchedules.find(s => s.date === rDate);
            if (current) {
              newSchedules = newSchedules.map(s => s.date === rDate ? { ...s, status: 'green' } : s);
            } else {
              newSchedules.push({ location_id: dashboardLocation.id, date: rDate, status: 'green' });
            }
          } else if (targetStatus === 'red') {
            const payload: DaySchedule = {
              location_id: dashboardLocation.id,
              date: rDate,
              status: 'red' as const,
              closed_option: mapOldOption(startSched?.closed_option || 'one_time'),
              closure_type: startSched?.closure_type || 'full',
              start_time: startSched?.start_time || '00:00',
              end_time: startSched?.end_time || '23:59',
              note: startSched?.note || ''
            };
            const idx = newSchedules.findIndex(s => s.date === rDate);
            if (idx >= 0) newSchedules[idx] = payload;
            else newSchedules.push(payload);
          } else {
            newSchedules = newSchedules.filter(s => s.date !== rDate);
          }
        });

        setSchedules(newSchedules);
        if (targetStatus === 'red') {
          setSelectedClosedRange(validRangeDates);
          setSelectedClosedDate(validRangeDates[0] || dStr);
          setClosedOption(mapOldOption(startSched?.closed_option || 'one_time'));
          setClosureType(startSched?.closure_type || 'full');
          setClosedStartTime(startSched?.start_time || '00:00');
          setClosedEndTime(startSched?.end_time || '23:59');
          setClosedNote(startSched?.note || '');
        } else {
          setSelectedClosedDate(null);
          setSelectedClosedRange([]);
        }
        setRangeStart(null);
        return;
      }

      const existing = schedules.find(s => s.date === dStr);
      let nextStatus: 'green' | 'red' | 'normal' = 'green';

      if (existing) {
        if (existing.status === 'green') nextStatus = 'red';
        else if (existing.status === 'red') nextStatus = 'normal';
      }

      let newSchedules = [...schedules];
      if (nextStatus === 'normal') {
        newSchedules = newSchedules.filter(s => s.date !== dStr);
        setSelectedClosedDate(null);
        setSelectedClosedRange([]);
        setRangeStart(null);
      } else if (nextStatus === 'green') {
        const current = schedules.find(s => s.date === dStr);
        if (current) {
          newSchedules = newSchedules.map(s => s.date === dStr ? { ...s, status: 'green' } : s);
        } else {
          newSchedules.push({ location_id: dashboardLocation.id, date: dStr, status: 'green' });
        }
        setSelectedClosedDate(null);
        setSelectedClosedRange([]);
        setRangeStart(dStr);
      } else {
        const mapOldOption = (opt?: string): any => {
          if (!opt) return 'one_time';
          if (opt === 'full_day' || opt === 'specific_time') return 'one_time';
          if (opt === 'every_week') return 'weekly';
          if (opt === 'every_month') return 'monthly';
          if (opt === 'every_year') return 'yearly';
          return opt;
        };

        const existingInState = schedules.find(s => s.date === dStr);

        const payload: DaySchedule = {
          location_id: dashboardLocation.id,
          date: dStr,
          status: 'red' as const,
          closed_option: mapOldOption(existingInState?.closed_option || 'one_time'),
          closure_type: existingInState?.closure_type || 'full',
          start_time: existingInState?.start_time || '00:00',
          end_time: existingInState?.end_time || '23:59',
          note: existingInState?.note || ''
        };

        const idx = newSchedules.findIndex(s => s.date === dStr);
        if (idx >= 0) newSchedules[idx] = payload;
        else newSchedules.push(payload);

        setSelectedClosedDate(dStr);
        setSelectedClosedRange([dStr]);
        setClosedOption(payload.closed_option as any);
        setClosureType(payload.closure_type as any);
        setClosedStartTime(payload.start_time || '00:00');
        setClosedEndTime(payload.end_time || '23:59');
        setClosedNote(payload.note || '');
        setRangeStart(dStr);
      }
      setSchedules(newSchedules);
    };

    const handleSaveClosedOptions = () => {
      if (!selectedClosedDate) return;
      const targets = selectedClosedRange.length > 0 ? selectedClosedRange : [selectedClosedDate];

      let newSchedules = [...schedules];

      targets.forEach(targetDate => {
        const payload: DaySchedule = {
          location_id: dashboardLocation.id,
          date: targetDate,
          status: 'red',
          closed_option: closedOption,
          closure_type: closureType,
          start_time: closureType === 'partial' ? closedStartTime : undefined,
          end_time: closureType === 'partial' ? closedEndTime : undefined,
          note: closedNote
        };

        const idx = newSchedules.findIndex(s => s.date === targetDate);
        if (idx >= 0) newSchedules[idx] = payload;
        else newSchedules.push(payload);
      });

      setSchedules(newSchedules);
      setSelectedClosedDate(null);
      setSelectedClosedRange([]);
      setClosedNote('');
    };

    const handleUpdateSchedule = async () => {
        if (!schedules || schedules.length === 0) {
            const confirmed = await new Promise(resolve => {
                if (onConfirm) {
                    onConfirm({
                        message: "Your schedule is currently empty. Saving will remove all open/closed rules. Continue?",
                        onConfirm: () => resolve(true),
                        onCancel: () => resolve(false)
                    });
                } else resolve(true);
            });
            if (!confirmed) return;
        }

        setIsActionLoading(true);
        try {
            // Filter out internal 'normal' status items before sending to database
            // We only want to persist 'green' and 'red' rules
            const persistableSchedules = schedules.filter(s => s.status === 'green' || s.status === 'red');
            await scheduleService.saveSchedulesBatch(dashboardLocation.id, persistableSchedules);
            if (onAlert) onAlert('Schedule synchronized to cloud successfully!', 'success');
            await fetchSchedules(); // Refresh to ensure we have the persisted data
        } catch (err: any) {
            console.error('Manual sync failed:', err);
            if (onAlert) onAlert(`Sync Failed: ${err.message || 'Check your database connection'}`, 'error');
        } finally {
            setIsActionLoading(false);
        }
    };

    const activeGreenDates = (() => {
      if (!schedules || schedules.length === 0) return [];

      const totalGreenConfigured = schedules.filter(s =>
        s.status === 'green' || (s.status === 'red' && s.closure_type === 'partial')
      ).length;

      if (totalGreenConfigured === 0) return [];

      const getClosureForDate = (dStr: string) => {
        const d = new Date(dStr);
        const dayOfWeek = d.getDay();
        const month = d.getMonth();
        const day = d.getDate();

        const direct = schedules.find(s => s.status === 'red' && s.date === dStr);
        if (direct) return direct;

        const weekly = schedules.find(s => s.status === 'red' && s.closed_option === 'weekly' && new Date(s.date).getDay() === dayOfWeek);
        if (weekly) return weekly;

        const monthly = schedules.find(s => s.status === 'red' && s.closed_option === 'monthly' && new Date(s.date).getDate() === day);
        if (monthly) return monthly;

        const yearly = schedules.find(s => s.status === 'red' && s.closed_option === 'yearly' && new Date(s.date).getMonth() === month && new Date(s.date).getDate() === day);
        if (yearly) return yearly;

        return null;
      };

      const dates: string[] = [];
      let searchDate = new Date();
      let iterations = 0;

      while (dates.length < totalGreenConfigured && iterations < 60) {
        const cStr = `${searchDate.getFullYear()}-${String(searchDate.getMonth() + 1).padStart(2, '0')}-${String(searchDate.getDate()).padStart(2, '0')}`;
        const closure = getClosureForDate(cStr);

        if (!closure || closure.closure_type !== 'full') {
          dates.push(cStr);
        }
        searchDate.setDate(searchDate.getDate() + 1);
        iterations++;
      }
      return dates;
    })();

    const getEffectiveSchedule = (dStr: string) => {
        // 1. Direct match (explicit rule for this exact date)
        const direct = schedules.find(s => s.date === dStr);
        if (direct) return { ...direct, isOriginal: true };

        // 2. Check for recurring rules from other dates
        const dateObj = new Date(dStr);
        const dayOfWeek = dateObj.getDay();
        const dayOfMonth = dateObj.getDate();
        const month = dateObj.getMonth();

        // Find rules that recur on this day
        // Priority: Yearly > Monthly > Weekly
        const yearly = schedules.find(s => s.status === 'red' && s.closed_option === 'yearly' && new Date(s.date).getMonth() === month && new Date(s.date).getDate() === dayOfMonth);
        if (yearly) return { ...yearly, isOriginal: false, originalDate: yearly.date };

        const monthly = schedules.find(s => s.status === 'red' && s.closed_option === 'monthly' && new Date(s.date).getDate() === dayOfMonth);
        if (monthly) return { ...monthly, isOriginal: false, originalDate: monthly.date };

        const weekly = schedules.find(s => s.status === 'red' && s.closed_option === 'weekly' && new Date(s.date).getDay() === dayOfWeek);
        if (weekly) return { ...weekly, isOriginal: false, originalDate: weekly.date };

        // 3. Active rolling green window match for today and future dates (Preview for Admin)
        const todayObj = new Date();
        const todayStrLocal = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
        if (dStr >= todayStrLocal && activeGreenDates.includes(dStr)) {
          return { location_id: dashboardLocation?.id, date: dStr, status: 'green' as const, isOriginal: false, isRolling: true };
        }

        return null;
    };

    const scheduleStartDate = (() => {
      const dates: string[] = [];
      if (schedules && schedules.length > 0) {
        schedules.forEach(s => {
          if ((s.status === 'green' || s.status === 'red') && s.date) {
            dates.push(s.date);
          }
        });
      }
      if ((dashboardLocation as any)?.created_at) {
        const locDate = new Date((dashboardLocation as any).created_at);
        if (!isNaN(locDate.getTime())) {
          const y = locDate.getFullYear();
          const m = String(locDate.getMonth() + 1).padStart(2, '0');
          const d = String(locDate.getDate()).padStart(2, '0');
          dates.push(`${y}-${m}-${d}`);
        }
      }
      if (dates.length === 0) return null;
      return dates.reduce((earliest, current) => (current < earliest ? current : earliest), dates[0]);
    })();

    return (
      <div className="space-y-6 md:space-y-6 max-w-4xl mx-auto p-5 md:p-6 bg-card md:bg-white rounded-[2rem] md:rounded-3xl border border-border md:border-border shadow-theme-card md:shadow-theme-card">
        <div className="flex items-center justify-between border-b border-border/30 md:border-b pb-5 md:pb-4">
          <div>
            <h2 className="text-xl md:text-xl font-black italic md:not-italic uppercase tracking-tighter md:tracking-tighter text-text-primary md:text-slate-900">Manage Box Schedule</h2>
            <p className="text-[10px] md:text-xs text-text-disabled uppercase font-black tracking-widest mt-1">Configure opening & closure rules</p>
          </div>
          <div className="flex items-center gap-2.5 md:gap-2">
            <button onClick={() => handleMonthChange(-1)} className="p-2.5 md:p-2 rounded-xl md:rounded-xl border border-border hover:bg-background-secondary transition-all active:scale-90 bg-background-secondary/50 md:bg-transparent">
              <ChevronLeft className="w-5 h-5 text-text-primary md:text-slate-700" />
            </button>
            <span className="font-black text-xs md:text-sm uppercase tracking-widest md:tracking-wider px-3 text-text-primary md:text-slate-800 italic md:not-italic">{months[month]} {year}</span>
            <button onClick={() => handleMonthChange(1)} className="p-2.5 md:p-2 rounded-xl md:rounded-xl border border-border hover:bg-background-secondary transition-all active:scale-90 bg-background-secondary/50 md:bg-transparent">
              <ChevronRight className="w-5 h-5 text-text-primary md:text-slate-700" />
            </button>
          </div>
        </div>

        {rangeStart && (() => {
          const startSched = schedules.find(s => s.date === rangeStart);
          const isRedStart = startSched?.status === 'red';
          return (
            <div className={`flex items-center justify-between p-3.5 border rounded-2xl text-xs font-bold ${
              isRedStart
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400'
            }`}>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isRedStart ? 'bg-rose-400' : 'bg-blue-400'
                  }`}></span>
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    isRedStart ? 'bg-rose-500' : 'bg-blue-500'
                  }`}></span>
                </span>
                <span>
                  Window selection active ({isRedStart ? 'Closure' : 'Opening'}): Start date <strong>{rangeStart.split('-').reverse().join('/')}</strong> selected. Click another date to select all dates in between as a window.
                </span>
              </div>
              <button
                onClick={() => setRangeStart(null)}
                className={`text-[10px] uppercase font-black px-2.5 py-1 text-white rounded-xl transition-all shadow-sm ${
                  isRedStart ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                Cancel Range
              </button>
            </div>
          );
        })()}

        <div className="grid grid-cols-7 gap-2 text-center border-b border-border/30 md:border-b pb-3 md:pb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
            <div key={i} className="text-[9px] md:text-xs font-black text-accent md:text-blue-600 uppercase tracking-[0.2em] md:tracking-wider">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2.5 sm:gap-4">
          {daysList.map((day, i) => {
            if (day === null) return <div key={i} />;
            const dStr = formatDateString(year, month, day);
            const sched = getEffectiveSchedule(dStr);
            const dateObj = new Date(year, month, day);
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
            const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();

            const todayObj = new Date();
            const todayStrLocal = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
            const isPast = dStr < todayStrLocal;

            const isRed = sched?.status === 'red';

            // Active current window open days (today & future open dates) -> DARK GREEN
            const isCurrentWindowGreen = !isPast && (sched?.status === 'green' || activeGreenDates.includes(dStr)) && !isRed;

            // Completed past open days (only from when schedule/arena started up to today) -> PALE GREEN
            const isCompletedPastGreen = isPast && !!scheduleStartDate && dStr >= scheduleStartDate && !isRed;

            const isRollingGreen = isCurrentWindowGreen && sched?.status !== 'green';

            const startSched = rangeStart ? schedules.find(s => s.date === rangeStart) : null;
            const rangeTargetStatus = startSched ? startSched.status : 'green';

            const isRangeStartTile = rangeStart === dStr;
            const isHoveredRangeTile = !!(rangeStart && hoveredDate && rangeStart !== hoveredDate && getDatesInRange(rangeStart, hoveredDate).includes(dStr));

            const bgStyle = isRangeStartTile
              ? (isRed ? '#f43f5e' : '#10b981')
              : isHoveredRangeTile
              ? (rangeTargetStatus === 'red' ? '#f43f5e40' : '#10b98140')
              : isCurrentWindowGreen
              ? '#10b981'
              : isCompletedPastGreen
              ? '#10b98125'
              : isRed
              ? '#f43f5e'
              : '#f8fafc';

            const subTextCls = isCurrentWindowGreen || isRed || isRangeStartTile
              ? 'text-white/80'
              : isCompletedPastGreen
              ? 'text-emerald-700 font-bold'
              : 'text-slate-500 font-black';

            const numberTextCls = isCurrentWindowGreen || isRed || isRangeStartTile
              ? 'text-white'
              : isCompletedPastGreen
              ? 'text-emerald-800 font-black'
              : 'text-slate-900 font-black';

            return (
              <div key={i} className="relative" onMouseEnter={() => setHoveredDate(dStr)} onMouseLeave={() => setHoveredDate(null)}>
                <button
                    disabled={isPast}
                    onClick={() => handleDateClick(day)}
                    className={`w-full aspect-[4/5] flex flex-col items-center justify-center rounded-[1.25rem] md:rounded-[1.5rem] border-2 transition-all shadow-sm p-1.5 md:p-2 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isRangeStartTile
                          ? (rangeTargetStatus === 'red' ? 'ring-4 ring-rose-500 ring-offset-2 z-10 scale-[1.04] border-rose-500' : 'ring-4 ring-blue-500 ring-offset-2 z-10 scale-[1.04] border-blue-500')
                          : isHoveredRangeTile
                          ? (rangeTargetStatus === 'red' ? 'ring-2 ring-rose-400 border-rose-400' : 'ring-2 ring-emerald-400 border-emerald-400')
                          : isCompletedPastGreen
                          ? 'border-dashed border-emerald-300 bg-emerald-50/50'
                          : isCurrentWindowGreen
                          ? 'border-emerald-500'
                          : isRed
                          ? 'border-rose-500'
                          : 'border-slate-200/80'
                    }`}
                    style={{
                      backgroundColor: bgStyle,
                      borderColor: isRangeStartTile
                        ? (rangeTargetStatus === 'red' ? '#f43f5e' : '#3b82f6')
                        : isHoveredRangeTile
                        ? (rangeTargetStatus === 'red' ? '#f43f5e' : '#10b981')
                        : isCurrentWindowGreen
                        ? '#10b981'
                        : isCompletedPastGreen
                        ? '#10b98150'
                        : isRed
                        ? '#f43f5e'
                        : '#e2e8f0'
                    }}
                >
                    {isRangeStartTile && (
                      <span className={`absolute -top-1.5 -right-1.5 text-white text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full shadow-md z-20 animate-bounce ${
                        rangeTargetStatus === 'red' ? 'bg-rose-600' : 'bg-blue-600'
                      }`}>
                        START
                      </span>
                    )}

                    <span className={`text-[7px] md:text-[8px] font-black uppercase tracking-widest mb-1 ${subTextCls}`}>{dayName}</span>
                    <span className={`text-sm sm:text-2xl font-black italic leading-none ${numberTextCls}`}>{day}</span>
                    <span className={`text-[7px] md:text-[8px] font-black mt-1 ${subTextCls}`}>{monthName}</span>

                    {isRed && (
                      <span className="text-[6px] md:text-[7px] opacity-90 block mt-1 font-black uppercase truncate max-w-full text-white bg-black/10 px-1 rounded-sm">
                        {sched.closed_option?.split('_')[0]}
                      </span>
                    )}

                    {isRollingGreen && (
                      <span className="text-[6px] md:text-[7px] font-black uppercase block mt-1 text-white bg-black/20 px-1 rounded-sm">
                        AUTO
                      </span>
                    )}

                    {sched && !(sched as any).isOriginal && (
                        <div className="absolute top-1 right-1">
                            <Clock className="w-2.5 h-2.5 text-white/70" />
                        </div>
                    )}
                </button>

                <AnimatePresence>
                  {hoveredDate === dStr && sched?.status === 'red' && (
                      <motion.div
                          initial={{ opacity: 0, scale: 0.5, y: 20, x: (i % 7 < 2) ? '0%' : (i % 7 > 4) ? '-100%' : '-50%' }}
                          animate={{ opacity: 1, scale: 1, y: 0, x: (i % 7 < 2) ? '0%' : (i % 7 > 4) ? '-100%' : '-50%' }}
                          exit={{ opacity: 0, scale: 0.5, y: 20, x: (i % 7 < 2) ? '0%' : (i % 7 > 4) ? '-100%' : '-50%' }}
                          className={`absolute bottom-[115%] z-[100] w-56 md:w-52 p-5 md:p-4 bg-slate-900 text-white rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] pointer-events-none border border-white/10 ${
                              (i % 7 < 2) ? 'left-0' : (i % 7 > 4) ? 'left-full' : 'left-1/2'
                          }`}
                      >
                          <div className={`absolute -bottom-1.5 w-4 h-4 bg-slate-900 rotate-45 border-r border-b border-white/10 ${
                              (i % 7 < 2) ? 'left-6' : (i % 7 > 4) ? 'right-6 -translate-x-full' : 'left-1/2 -translate-x-1/2'
                          }`} />
                          <div className="relative z-10">
                              <div className="flex justify-between items-start mb-3 md:mb-2 border-b border-white/5 pb-2 md:pb-1">
                                  <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Closure Details</p>
                                  {!(sched as any).isOriginal && (
                                      <p className="text-[7px] font-black uppercase bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">Inherited</p>
                                  )}
                              </div>
                              <p className="text-xs md:text-xs font-black italic tracking-tight uppercase">{sched.closed_option?.replace('_', ' ')}</p>
                              {!(sched as any).isOriginal && (
                                  <p className="text-[8px] text-slate-500 mt-1 md:mt-0.5 font-bold uppercase tracking-wider italic">Source: {(sched as any).originalDate?.split('-').reverse().join('/')}</p>
                              )}
                              {sched.closure_type === 'partial' && (
                                  <div className="flex items-center gap-1.5 mt-2 md:mt-1.5 opacity-80">
                                      <Clock className="w-3.5 h-3.5 md:w-3 md:h-3 text-blue-400" />
                                      <p className="text-[11px] font-bold">{sched.start_time} - {sched.end_time}</p>
                                  </div>
                              )}
                              {sched.note && (
                                  <div className="mt-4 md:mt-3 p-3 md:p-2 rounded-xl bg-white/5 border border-white/5 shadow-inner">
                                      <p className="text-[8px] uppercase font-black text-slate-500 mb-1">Admin Note</p>
                                      <p className="text-[10px] md:text-[11px] font-medium leading-relaxed text-slate-300 italic">"{sched.note}"</p>
                                  </div>
                              )}
                          </div>
                      </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {selectedClosedDate && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-5 md:p-5 border border-border/50 md:border-border rounded-2xl md:rounded-2xl bg-background-secondary/50 md:bg-slate-50 space-y-6 md:space-y-4 mt-8 md:mt-6 shadow-inner">
            <h3 className="text-sm md:text-sm font-black uppercase italic md:not-italic tracking-wider text-text-primary md:text-slate-800">
              {selectedClosedRange.length > 1
                ? `Closure Details for Window (${selectedClosedRange[0].split('-').reverse().join('/')} to ${selectedClosedRange[selectedClosedRange.length - 1].split('-').reverse().join('/')}) [${selectedClosedRange.length} Dates]`
                : `Closure Details for ${selectedClosedDate.split('-').reverse().join('/')}`
              }
            </h3>

            <div className="space-y-6 md:space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-3">
                {(() => {
                    const d = new Date(selectedClosedDate);
                    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
                    const dateNum = d.getDate();
                    const monthName = d.toLocaleDateString('en-US', { month: 'long' });

                    const getOrdinal = (n: number) => {
                        const s = ["th", "st", "nd", "rd"];
                        const v = n % 100;
                        return n + (s[(v - 20) % 10] || s[v] || s[0]);
                    };

                    return [
                        { id: 'one_time', label: 'One-time' },
                        { id: 'weekly', label: `Every ${dayName}` },
                        { id: 'monthly', label: `Every ${getOrdinal(dateNum)}` },
                        { id: 'yearly', label: `Every ${dateNum} ${monthName}` }
                    ].map(opt => (
                        <label key={opt.id} className="flex items-center gap-2.5 p-3 sm:gap-3 sm:p-3 bg-card md:bg-white rounded-xl md:rounded-xl border border-border md:border cursor-pointer hover:bg-slate-50 transition-all shadow-sm active:scale-95">
                        <input
                            type="radio"
                            name="closed_option"
                            checked={closedOption === opt.id}
                            onChange={() => setClosedOption(opt.id as any)}
                            className="text-accent md:text-blue-600 focus:ring-accent"
                        />
                        <span className="text-[10px] font-black uppercase md:normal-case text-text-primary md:text-slate-700 leading-tight">{opt.label}</span>
                        </label>
                    ));
                })()}
                </div>

                <div className="p-5 md:p-4 bg-card md:bg-white rounded-2xl md:rounded-2xl border border-border md:border-blue-100 space-y-6 md:space-y-4 shadow-sm md:shadow-none">
                    <label className="text-[10px] font-black uppercase tracking-widest text-accent md:text-blue-600">Closure Type</label>
                    <div className="grid grid-cols-2 gap-4 md:gap-3">
                        {[
                            { id: 'full', label: 'Full Day' },
                            { id: 'partial', label: 'Specific Time' }
                        ].map(type => (
                            <label key={type.id} className={`flex items-center gap-3 p-3 sm:gap-3 sm:p-3 rounded-xl border-2 cursor-pointer transition-all active:scale-95 ${closureType === type.id ? 'border-accent md:border-blue-600 bg-accent/10 md:bg-blue-50' : 'border-border md:border-slate-100 bg-background-secondary/30 md:bg-slate-50 opacity-60'}`}>
                                <input
                                    type="radio"
                                    name="closure_type"
                                    checked={closureType === type.id}
                                    onChange={() => setClosureType(type.id as any)}
                                    className="text-accent md:text-blue-600 focus:ring-accent"
                                />
                                <span className="text-xs font-black uppercase md:normal-case text-text-primary md:text-slate-700">{type.label}</span>
                            </label>
                        ))}
                    </div>

                    {closureType === 'partial' && (
                        <div className="grid grid-cols-2 gap-6 md:gap-4 animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-1.5 md:space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] md:tracking-wider text-text-disabled md:text-slate-500 block">Start Time</label>
                                <input type="time" value={closedStartTime} onChange={e => setClosedStartTime(e.target.value)} className="w-full p-3.5 md:p-2 border border-border md:border rounded-xl md:rounded-lg font-black md:font-bold outline-none bg-background-secondary md:bg-white text-text-primary md:text-slate-800" />
                            </div>
                            <div className="space-y-1.5 md:space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] md:tracking-wider text-text-disabled md:text-slate-500 block">End Time</label>
                                <input type="time" value={closedEndTime} onChange={e => setClosedEndTime(e.target.value)} className="w-full p-3.5 md:p-2 border border-border md:border rounded-xl md:rounded-lg font-black md:font-bold outline-none bg-background-secondary md:bg-white text-text-primary md:text-slate-800" />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-card md:bg-white p-5 md:p-4 rounded-2xl md:rounded-xl border border-border shadow-sm">
                <label className="text-[10px] font-black uppercase tracking-widest text-text-disabled md:text-slate-500 block mb-2 md:mb-1">Closure Note / Reason</label>
                <textarea
                    value={closedNote}
                    onChange={e => setClosedNote(e.target.value)}
                    placeholder="e.g. Renovation, Private Event..."
                    className="w-full p-4 md:p-3 border border-border md:border rounded-xl md:rounded-lg font-bold md:font-bold outline-none bg-background-secondary md:bg-white text-text-primary md:text-slate-800 text-xs min-h-[100px] md:min-h-[80px] resize-none"
                />
            </div>

            <div className="flex gap-4 md:gap-2 justify-end pt-2">
              <button onClick={() => { setSelectedClosedDate(null); setSelectedClosedRange([]); }} className="flex-1 md:flex-none px-6 py-4 md:px-4 md:py-2 border border-border md:border rounded-xl md:rounded-xl font-black md:font-black text-[10px] md:text-xs uppercase tracking-widest md:tracking-wider text-text-disabled md:text-slate-500 hover:bg-background-secondary md:hover:bg-slate-100 transition-all active:scale-95">Cancel</button>
              <button onClick={handleSaveClosedOptions} className="flex-1 md:flex-none px-6 py-4 md:px-5 md:py-2 bg-accent md:bg-blue-600 text-white rounded-xl md:rounded-xl font-black md:font-black text-[10px] md:text-xs uppercase tracking-widest md:tracking-wider shadow-theme-elevated md:shadow-md active:scale-95 transition-all">Apply to Local</button>
            </div>
          </motion.div>
        )}

        <div className="pt-8 md:pt-6 border-t border-border/30 md:border-t mt-6 md:mt-4">
            <LoadingButton
                loading={isActionLoading}
                onClick={handleUpdateSchedule}
                className="w-full py-5 md:py-4 text-white rounded-[1.5rem] md:rounded-2xl font-black uppercase tracking-widest shadow-theme-elevated text-sm flex items-center justify-center gap-3 active:translate-y-1"
                style={{ backgroundColor: window.innerWidth < 768 ? theme.colors.accent : '#1e293b' }}
                icon={<Save className="w-5 h-5" />}
                loadingText="Syncing..."
            >
                Save Schedule
            </LoadingButton>
            <p className="text-[9px] md:text-[9px] text-center mt-3 md:mt-2 font-black uppercase tracking-[0.2em] md:tracking-widest opacity-40 md:opacity-100 text-text-disabled">Cloud storage syncs only after clicking save</p>
        </div>
      </div>
    );
  };

  const renderLocations = () => (
    <div className="grid grid-cols-1 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
      {locations.map(loc => (
        <LocationCard key={loc.id} loc={loc} role={role} selectedLocation={selectedLocation} onUpdate={handleUpdateArena} onDelete={handleDeleteArena} isProcessing={isActionLoading} triggerAlert={triggerAlert} dbVersion={dbVersion} />
      ))}
    </div>
  );

  const renderReports = () => (
    <div className="space-y-6 md:space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
      {/* Filter Section */}
      <div className="flex flex-col md:flex-row items-center gap-6 md:gap-4 p-6 md:p-6 rounded-[2rem] md:rounded-[2rem] border border-border md:border shadow-theme-card md:shadow-theme-card relative overflow-hidden group transition-all bg-card md:bg-card" style={{ borderColor: theme.colors.border }}>
        <div className="absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full opacity-5 pointer-events-none bg-accent md:bg-accent" />
        <div className="p-1.5 rounded-2xl md:rounded-xl flex gap-1.5 md:gap-1 w-full md:w-auto shadow-inner bg-background-secondary md:bg-background-secondary border border-border md:border-none">
          {(['all', 'day', 'month', 'year'] as TimeFilter[]).map(f => (
            <button key={f} onClick={() => setTimeFilter(f)} className={`flex-1 md:flex-none px-6 md:px-5 py-2.5 md:py-2 rounded-xl md:rounded-lg text-[10px] md:text-[10px] font-black uppercase tracking-widest transition-all ${timeFilter === f ? 'bg-accent text-white shadow-theme-elevated md:shadow-theme-elevated scale-105 md:scale-105 italic md:not-italic' : 'text-text-disabled hover:text-text-primary'}`}>{f}</button>
          ))}
        </div>
        <div className="relative group w-full md:w-auto">
          <input type={timeFilter === 'day' ? 'date' : timeFilter === 'month' ? 'month' : 'number'} value={timeFilter === 'year' ? filterDate.slice(0, 4) : filterDate.slice(0, timeFilter === 'day' ? 10 : 7)} onChange={(e) => { let val = e.target.value; setFilterDate(timeFilter === 'year' ? `${val}-01-01` : (val.length === 7 ? `${val}-01` : val)); }} className="w-full md:w-[250px] p-4 md:p-3 border-2 border-transparent rounded-2xl md:rounded-xl font-black outline-none transition-all shadow-inner text-sm md:text-sm bg-background-secondary md:bg-background-secondary" style={{ color: theme.colors.textPrimary }} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-4">
        {[
          { label: 'Gross Revenue', val: reportStats.totalRevenue, color: theme.colors.success, icon: BarChart3 },
          { label: 'Net Collected', val: reportStats.moneyCollected, color: theme.colors.accent, icon: IndianRupee },
          { label: 'Total Bookings', val: reportStats.bookingCount, color: '#A855F7', icon: Database },
        ].map((stat, i) => (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.1 }} key={i}
                      className="p-8 md:p-6 rounded-[2rem] md:rounded-3xl border border-border md:border shadow-theme-card md:shadow-theme-card relative overflow-hidden group transition-all bg-card md:bg-card"
                      style={{ borderColor: theme.colors.border }}>
             <stat.icon className={`absolute -right-4 md:-right-4 -bottom-4 md:-bottom-4 w-20 h-20 md:w-16 md:h-16 opacity-5 md:opacity-5 group-hover:scale-110 transition-transform duration-500`} style={{ color: stat.color }} />
             <span className="text-[10px] md:text-[10px] font-black uppercase tracking-[0.3em] block mb-3 md:mb-2" style={{ color: theme.colors.textDisabled }}>{stat.label}</span>
             <span className={`text-3xl md:text-2xl font-black tracking-tighter italic md:not-italic`} style={{ color: stat.color }}>{typeof stat.val === 'number' && stat.label !== 'Total Bookings' ? '₹' : ''}{stat.val.toLocaleString()}</span>

             {stat.label === 'Net Collected' && (
                <div className="mt-6 md:mt-4 pt-6 md:pt-4 border-t border-dashed md:border-t flex flex-wrap gap-x-6 md:gap-x-4 gap-y-2 md:gap-y-1" style={{ borderColor: `${theme.colors.border}40` }}>
                  <p className="text-[9px] md:text-[8px] font-black uppercase tracking-widest text-text-disabled">Advances: <span className="text-text-primary">₹{reportStats.advances}</span></p>
                  <p className="text-[9px] md:text-[8px] font-black uppercase tracking-widest text-text-disabled">Full: <span className="text-text-primary">₹{reportStats.fullPayments}</span></p>
                  <p className="text-[9px] md:text-[8px] font-black uppercase tracking-widest text-text-disabled">Settled: <span className="text-text-primary">₹{reportStats.settlements}</span></p>
                </div>
             )}

             {stat.label === 'Total Bookings' && (
                <div className="mt-6 md:mt-4 pt-6 md:pt-4 border-t border-dashed md:border-t flex flex-wrap gap-x-6 md:gap-x-4 gap-y-2 md:gap-y-1" style={{ borderColor: `${theme.colors.border}40` }}>
                  <p className="text-[9px] md:text-[8px] font-black uppercase tracking-widest text-text-disabled">Fully Paid: <span className="text-text-primary">{reportStats.fullyPaidCount}</span></p>
                  <p className="text-[9px] md:text-[8px] font-black uppercase tracking-widest text-text-disabled">Pending: <span className="text-text-primary">{reportStats.pendingCount}</span></p>
                </div>
             )}
          </motion.div>
        ))}
      </div>

      <div className="space-y-6 md:space-y-6">
        <h2 className="text-2xl md:text-xl font-black italic md:not-italic uppercase tracking-tighter text-text-primary px-2">{isGameZoneArena ? 'Platform Breakdown' : 'Court Breakdown'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-6">
          {(isGameZoneArena ? reportStats.platformBreakdown : reportStats.courtBreakdown).map((item, i) => (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + (i * 0.05) }} key={i}
                        className="p-8 md:p-6 rounded-[2rem] md:rounded-3xl border border-border md:border bg-card md:bg-card shadow-theme-card md:shadow-theme-card relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-24 h-24 blur-3xl rounded-full opacity-5 bg-accent md:hidden" />
               <h3 className="text-base md:text-sm font-black uppercase italic md:not-italic tracking-tighter md:tracking-widest text-text-primary mb-6 md:mb-4 border-b border-border md:border-border pb-3 md:pb-2">{item.name}</h3>
               <div className="space-y-4 md:space-y-3">
                 <div className="flex justify-between items-center">
                   <span className="text-[10px] md:text-[10px] font-black uppercase tracking-widest text-text-disabled">Revenue</span>
                   <span className="font-black text-success text-sm md:text-base">₹{item.revenue}</span>
                 </div>
                 <div className="flex justify-between items-center">
                   <span className="text-[10px] md:text-[10px] font-black uppercase tracking-widest text-text-disabled">Collected</span>
                   <span className="font-black text-accent text-sm md:text-base">₹{item.advance}</span>
                 </div>
                 <div className="mt-4 md:mt-2 pt-4 md:pt-2 border-t border-border/40 md:border-t flex justify-between gap-4 md:gap-2">
                    <div className="text-center">
                      <p className="text-[8px] md:text-[7px] font-black uppercase text-text-disabled mb-1 md:mb-0">Adv</p>
                      <p className="text-[11px] md:text-[9px] font-black text-text-primary">₹{item.advances}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] md:text-[7px] font-black uppercase text-text-disabled mb-1 md:mb-0">Full</p>
                      <p className="text-[11px] md:text-[9px] font-black text-text-primary">₹{item.full}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] md:text-[7px] font-black uppercase text-text-disabled mb-1 md:mb-0">Settl</p>
                      <p className="text-[11px] md:text-[9px] font-black text-text-primary">₹{item.settlements}</p>
                    </div>
                 </div>
                 <div className="flex justify-between items-center pt-2 md:pt-0">
                   <span className="text-[10px] md:text-[10px] font-black uppercase tracking-widest text-text-disabled">Bookings</span>
                   <span className="font-black text-purple-500 text-sm md:text-base">{item.count}</span>
                 </div>
               </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 md:p-[var(--fluid-padding)] relative overflow-hidden transition-all duration-300" style={{ backgroundColor: theme.colors.background }}>
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full blur-[120px] pointer-events-none opacity-20" style={{ backgroundColor: theme.colors.accent }} />
        <div className="text-center">
            <h1 className="text-3xl md:text-2xl font-black uppercase italic md:not-italic" style={{ color: theme.colors.textPrimary }}>Login Required</h1>
            <p className="mt-4" style={{ color: theme.colors.textSecondary }}>Please log in to access the admin dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-5 md:p-8 relative overflow-hidden transition-all duration-300" style={{ backgroundColor: theme.colors.background }}>
      <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid.svg')] opacity-5 pointer-events-none md:block hidden" />
      <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" multiple accept="image/*" />

      <div className="max-w-7xl mx-auto space-y-8 md:space-y-[var(--fluid-padding)] relative z-10">
        <motion.header initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                       className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 md:gap-4 p-6 md:p-4 border shadow-theme-modal md:shadow-none transition-all bg-card md:bg-white rounded-[2.5rem] md:rounded-theme-lg"
                       style={{ borderColor: theme.colors.border }}>
          <div>
            <h1 className="text-3xl md:text-2xl font-black italic md:not-italic tracking-tighter md:tracking-normal uppercase leading-none text-text-primary md:text-slate-900">Admin <span className="text-accent md:text-blue-600">Dashboard</span></h1>
            <div className="flex items-center gap-3 md:gap-2 mt-3 md:mt-2">
              <span className={`w-3 h-3 md:w-2.5 md:h-2.5 rounded-full animate-pulse bg-accent md:bg-blue-600 shadow-[0_0_10px_rgba(249,115,22,0.5)] md:shadow-none`} />
              <span className={`text-[10px] md:text-[10px] font-black uppercase tracking-[0.4em] md:tracking-[0.3em] text-accent md:text-blue-600`}>
                {role === 'superadmin' ? 'Super Admin' : `Arena: ${dashboardLocation?.name || 'SYNC ERR'}`}
              </span>
            </div>
          </div>
          <div className="flex gap-4 w-full md:w-auto mt-2 md:mt-0">
            <button onClick={handleOpenManualBooking} className="flex-1 md:flex-none px-8 py-4 md:px-6 md:py-4 text-white rounded-2xl md:rounded-xl text-xs md:text-xs font-black uppercase tracking-widest shadow-theme-elevated md:shadow-xl transition-all active:scale-95 bg-accent md:bg-blue-600">Manual Entry</button>
          </div>
        </motion.header>

        <div className="flex flex-col lg:flex-row lg:gap-10 md:lg:gap-8 items-start">
          {/* Desktop Sidebar Navigation */}
          <nav className="hidden lg:flex flex-col gap-3 md:gap-2 w-72 md:w-64 shrink-0 sticky top-10 md:top-8 p-6 md:p-4 rounded-[2.5rem] md:rounded-[2rem] border shadow-theme-card md:shadow-theme-card bg-card md:bg-card"
               style={{ borderColor: theme.colors.border }}>
            {adminNavTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-4 md:gap-3 px-7 py-5 md:px-6 md:py-4 rounded-2xl md:rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-accent text-white shadow-theme-elevated scale-[1.02] italic md:not-italic md:scale-[1.02]' : 'text-text-secondary hover:bg-background-secondary hover:text-text-primary'}`}
                style={activeTab === tab.id ? { backgroundColor: theme.colors.accent } : {}}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex-1 w-full shadow-theme-card border overflow-hidden transition-all bg-card rounded-[2.5rem] md:rounded-theme-lg"
               style={{ borderColor: theme.colors.border }}>

            {/* Mobile Dropdown Navigation */}
            <div className="lg:hidden border-b p-4 md:p-3 bg-background-secondary/30 md:bg-white relative z-[150]" style={{ borderColor: theme.colors.border }}>
              {(() => {
                const tabs = adminNavTabs;
                const activeTabObj = tabs.find(t => t.id === activeTab) || tabs[0];
                return (
                  <div className="relative">
                    <button
                      onClick={() => {
                        setIsNavDropdownOpen(!isNavDropdownOpen);
                        if (!isNavDropdownOpen) setCopyDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-6 py-4 md:px-4 md:py-3 bg-card md:bg-slate-50 border border-border md:border-slate-200 rounded-2xl md:rounded-xl font-black text-[11px] md:text-xs uppercase tracking-widest text-text-primary md:text-slate-800 shadow-theme-card md:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-3 md:gap-2">
                        <activeTabObj.icon className="w-4 h-4 text-accent md:text-blue-600" />
                        <span>Section: {activeTabObj.label}</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-text-disabled md:text-slate-500 transition-transform duration-300 ${isNavDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {isNavDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute left-0 right-0 mt-3 md:mt-2 bg-card md:bg-white border border-border md:border-slate-200 rounded-[2rem] md:rounded-xl shadow-theme-modal md:shadow-xl overflow-hidden z-[160] backdrop-blur-3xl"
                        >
                          <div className="grid grid-cols-1 divide-y divide-border/30 md:divide-slate-100 max-h-[60vh] overflow-y-auto custom-scrollbar md:max-h-none md:overflow-visible md:grid-cols-1 md:divide-y">
                            {tabs.map(tab => (
                              <button
                                key={tab.id}
                                onClick={() => {
                                  setActiveTab(tab.id as any);
                                  setIsNavDropdownOpen(false);
                                }}
                                className={`flex items-center gap-4 px-7 py-5 md:px-4 md:py-3.5 text-left font-black text-xs uppercase tracking-widest md:tracking-wider transition-all ${activeTab === tab.id ? 'bg-accent/10 text-accent italic md:bg-blue-50 md:text-blue-600 md:not-italic' : 'text-text-secondary hover:bg-background-secondary md:text-slate-600 md:hover:bg-slate-50'}`}
                              >
                                <tab.icon className={`w-5 h-5 md:w-4 md:h-4 ${activeTab === tab.id ? 'text-accent md:text-blue-600' : 'text-text-disabled md:text-slate-400 opacity-40 md:opacity-100'}`} />
                                {tab.label}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })()}
            </div>

            <div className="p-6 md:p-8 md:p-[var(--fluid-padding)]">
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  {activeTab === 'bookings' && renderBookings()}
                  {activeTab === 'locations' && renderLocations()}
                  {activeTab === 'reports' && renderReports()}
                  {activeTab === 'schedule' && renderSchedule()}
                  {activeTab === 'security' && renderSecurity()}
                  {activeTab === 'timing' && renderTiming()}
                  {activeTab === 'pricing' && renderPricing()}
                  {activeTab === 'gamezone' && renderGameZone()}
                  {activeTab === 'about' && renderAbout()}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showManualBooking && manualTargetLocation && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 md:bg-black/60 backdrop-blur-xl md:backdrop-blur-2xl p-0 sm:p-10 md:p-[var(--fluid-padding)]">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                        className="border rounded-t-[2.5rem] sm:rounded-[3rem] md:rounded-t-[var(--fluid-radius)] md:sm:rounded-[2.5rem] w-full max-w-7xl md:max-w-[100vw] md:sm:max-w-6xl shadow-theme-modal relative sm:my-auto overflow-hidden transition-all h-[94vh] sm:h-[90vh] md:h-[92vh] bg-card"
                        style={{ borderColor: theme.colors.border }}>
              <div className="p-6 sm:p-10 md:p-4 md:sm:p-8 border-b flex justify-between items-center transition-all sticky top-0 z-20 bg-background-secondary/90 md:bg-background-secondary backdrop-blur-md md:backdrop-blur-none" style={{ borderColor: theme.colors.border }}>
                <h2 className="text-2xl sm:text-4xl md:text-[5vw] md:sm:text-3xl font-black italic uppercase tracking-tighter text-text-primary">Operational <span className="text-accent">Protocol</span></h2>
                <button onClick={() => setShowManualBooking(false)} className="w-12 h-12 sm:w-16 sm:h-16 md:w-10 md:h-10 md:sm:w-12 md:sm:h-12 rounded-2xl md:rounded-xl flex items-center justify-center transition-all shadow-theme-card active:scale-90 md:active:translate-y-0.5 border bg-card md:bg-white border-border hover:bg-error/10 text-error">
                  <XCircle className="w-8 h-8 sm:w-10 sm:h-10 md:w-6 md:h-6 md:sm:w-7 md:sm:h-7" />
                </button>
              </div>
              <div className="h-full overflow-y-auto p-4 sm:p-10 pb-32 md:p-2 md:sm:p-4 md:pb-20 no-scrollbar">
                <BookingPage location={manualTargetLocation} isAdminManual={true} onComplete={handleManualComplete} user={user} onAlert={onAlert} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboard;

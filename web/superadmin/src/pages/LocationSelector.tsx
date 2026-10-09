import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { locationService } from '../services/locationService';
import { storage } from '../services/storage';
import { geocodingService } from '../services/geocodingService';
import { Location, User, SportType, parseSportParam } from '../types';
import { verifySuperPassword, updateSuperAdminPassword } from '../services/authService';
import { supabaseStorage } from '../services/supabaseStorage';
import { ChevronLeft, Plus, Shield, User as UserIcon, LogOut, Search, Star, Trash2, Key, Settings, MapPin, Mail, X, Navigation, LocateFixed, MoreVertical, Swords, Heart } from 'lucide-react';
import LoadingButton from '../components/LoadingButton';
import { motion, AnimatePresence } from 'framer-motion';
import { handleError } from '../services/errorHandler';
import { useTheme } from '../contexts/ThemeContext';
import { usePermissions } from '../hooks/usePermissions';
import NotificationBell from '../components/NotificationBell';
import { calculateDistance, formatDistance } from '../services/distanceUtils';
import { userService } from '../services/userService';
import { useApp } from '../App';
import { forceScrollTop } from '../utils/scroll';

interface LocationSelectorProps {
  onSelect?: (loc: Location) => void;
  user: User | null;
  sport?: SportType;
  onBack?: () => void;
  onLogout?: () => void;
  onProfile?: () => void;
  onSuperAdmin?: () => void;
  onAlert?: (msg: string, type: 'success' | 'error' | 'info') => void;
  onNavigate?: (page: any) => void;
  onConfirm?: (config: {
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
  }) => void;
}

const ImageSlideshow: React.FC<{ imageUrls: string[] }> = ({ imageUrls }) => {
  const [index, setIndex] = useState(0);
  const { theme } = useTheme();

  const next = (e?: React.MouseEvent | React.TouchEvent) => {
    e?.stopPropagation();
    setIndex((prev) => (prev + 1) % imageUrls.length);
  };

  const prev = (e?: React.MouseEvent | React.TouchEvent) => {
    e?.stopPropagation();
    setIndex((prev) => (prev - 1 + imageUrls.length) % imageUrls.length);
  };

  if (!imageUrls || imageUrls.length === 0) {
    return <div className="w-full h-full bg-background-secondary animate-pulse" />;
  }

  return (
    <div className="relative w-full h-full group/slideshow overflow-hidden">
      <AnimatePresence initial={false} mode="wait">
        <motion.img
          key={index}
          src={imageUrls[index]}
          alt="Location"
          loading="lazy"
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.7}
          onDragEnd={(_, info) => {
            const swipeThreshold = 50;
            if (info.offset.x < -swipeThreshold) {
              next();
            } else if (info.offset.x > swipeThreshold) {
              prev();
            }
          }}
          className="w-full h-full object-cover cursor-grab active:cursor-grabbing"
        />
      </AnimatePresence>
      {imageUrls.length > 1 && (
        <>
          <div className="absolute inset-0 flex items-center justify-between px-4 opacity-0 group-hover/slideshow:opacity-100 transition-opacity z-20 pointer-events-none">
            <button
              onClick={prev}
              className="p-2 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-md transition-all pointer-events-auto"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              className="p-2 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-md transition-all rotate-180 pointer-events-auto"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
            {imageUrls.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex(i);
                }}
                className={`carousel-dot h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-6' : 'w-2 bg-white/40 hover:bg-white/60'}`}
                style={{ backgroundColor: i === index ? theme.colors.accent : undefined }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const LocationSelector: React.FC<LocationSelectorProps> = ({
  onSelect,
  user,
  sport: propSport,
  onBack,
  onLogout,
  onProfile,
  onSuperAdmin,
  onAlert,
  onConfirm,
  onNavigate
}) => {
  const { setIsSuperAuth } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { sport: sportParam } = useParams<{ sport: string }>();

  const activeSport = useMemo(() => {
    if (sportParam) return parseSportParam(sportParam);
    return propSport || SportType.CRICKET;
  }, [sportParam, propSport]);

  const { theme } = useTheme();
  const { checkAndPrompt, permissions } = usePermissions();

  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    let timeoutId: any;
    const fetchProfile = () => {
      userService.getCurrentUserProfile().then(res => {
        if (res.profile) {
          setUserProfile(res.profile);
          if (res.profile.latitude === null || res.profile.latitude === undefined) {
            timeoutId = setTimeout(fetchProfile, 3000);
          }
        }
      });
    };
    fetchProfile();
    return () => clearTimeout(timeoutId);
  }, []);

  const [dropdownOpenId, setDropdownOpenId] = useState<string | null>(null);

  useEffect(() => {
    return forceScrollTop();
  }, []);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [isAdminMode, setIsAdminMode] = useState(storage.isSuperAdminSession());
  const [showAddModal, setShowAddModal] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [locating, setLocating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const [showManualReset, setShowManualReset] = useState(false);
  const [resetLocId, setResetLocId] = useState<string | null>(null);
  const [manualUsername, setManualUsername] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const [password, setPassword] = useState('');

  const [favorites, setFavorites] = useState<string[]>(() => storage.getFavorites());

  const [showSuperResetModal, setShowSuperResetModal] = useState(false);
  const [currentSuperPassword, setCurrentSuperPassword] = useState('');
  const [newSuperPassword, setNewSuperPassword] = useState('');
  const [confirmSuperPassword, setConfirmSuperPassword] = useState('');
  const [isUpdatingSuper, setIsUpdatingSuper] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newLoc, setNewLoc] = useState({
    name: '',
    address: '',
    email: '',
    imageUrls: [] as string[],
    minAdvance: 0,
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined
  });

  // Auto-geocode new arena address
  useEffect(() => {
    if (!newLoc.address) return;

    const timer = setTimeout(async () => {
      if (newLoc.latitude === undefined || newLoc.latitude === null) {
        try {
          const coords = await geocodingService.getCoordinates(newLoc.address, '');
          if (coords) {
            setNewLoc(prev => ({ ...prev, latitude: coords.latitude, longitude: coords.longitude }));
          }
        } catch (e) {
          console.warn("Auto-geocoding failed:", e);
        }
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [newLoc.address]);

  const triggerAlert = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (onAlert) onAlert(msg, type);
  };

  const handleSelectLocation = (loc: Location) => {
    if (onSelect) onSelect(loc);
    if (user) {
      storage.setUser({ ...user, selectedLocationId: loc.id });
    }
    navigate(`/arena/${loc.id}`);
  };

  const handleBackClick = () => {
    if (onBack) onBack();
    else navigate('/');
  };

  const handleProfileClick = () => {
    if (onProfile) onProfile();
    else navigate('/profile');
  };

  const handleSuperAdminClick = () => {
    if (onSuperAdmin) onSuperAdmin();
    else navigate('/superadmin');
  };

  const handleReviewClick = (boxId: string) => {
    navigate(`/reviews/${boxId}`);
  };

  const handleToggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = storage.toggleFavorite(id);
    setFavorites(updated);
  };

  useEffect(() => {
    setIsLoading(true);
    locationService.getLocations()
      .then(setLocations)
      .catch((err) => {
        const appError = handleError(err);
        triggerAlert(appError.message, 'error');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const sortedAndFilteredLocations = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const filtered = locations.filter(loc => loc.supportedSports?.includes(activeSport));

    if (!query) {
      return [...filtered].sort((a, b) => {
        const distA = calculateDistance(userProfile?.latitude, userProfile?.longitude, a.latitude, a.longitude);
        const distB = calculateDistance(userProfile?.latitude, userProfile?.longitude, b.latitude, b.longitude);

        if (distA !== distB) {
          if (distA === Infinity) return 1;
          if (distB === Infinity) return -1;
          return distA - distB;
        }

        if (user?.location) {
          const userLocLower = user.location.toLowerCase().trim();
          const aIsUserLoc = a.address.toLowerCase().trim() === userLocLower;
          const bIsUserLoc = b.address.toLowerCase().trim() === userLocLower;
          if (aIsUserLoc && !bIsUserLoc) return -1;
          if (!aIsUserLoc && bIsUserLoc) return 1;
        }
        const addressCompare = a.address.localeCompare(b.address);
        if (addressCompare !== 0) return addressCompare;
        return a.name.localeCompare(b.name);
      });
    }

    const getScore = (text: string, q: string) => {
      const t = text.toLowerCase();
      if (t === q) return 10;
      if (t.startsWith(q)) return 8;
      const words = t.split(/[\s,]+/);
      if (words.some(word => word.startsWith(q))) {
        if (words.some(word => word === q)) return 6;
        return 4;
      }
      if (t.includes(q)) return 2;
      return 0;
    };

    return filtered
      .map(loc => {
        const nameScore = getScore(loc.name, query);
        const addressScore = getScore(loc.address, query);
        return { loc, score: Math.max(nameScore, addressScore) };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (user?.location) {
          const userLocLower = user.location.toLowerCase().trim();
          const aIsUserLoc = a.loc.address.toLowerCase().trim() === userLocLower;
          const bIsUserLoc = b.loc.address.toLowerCase().trim() === userLocLower;
          if (aIsUserLoc && !bIsUserLoc) return -1;
          if (!aIsUserLoc && bIsUserLoc) return 1;
        }
        const addressCompare = a.loc.address.localeCompare(b.loc.address);
        if (addressCompare !== 0) return addressCompare;
        return a.loc.name.localeCompare(b.loc.name);
      })
      .map(item => item.loc);
  }, [locations, searchQuery, activeSport, user?.location]);

  const favoriteArenas = useMemo(() => {
    return sortedAndFilteredLocations.filter(loc => favorites.includes(loc.id));
  }, [sortedAndFilteredLocations, favorites]);

  const otherArenas = useMemo(() => {
    return sortedAndFilteredLocations.filter(loc => !favorites.includes(loc.id));
  }, [sortedAndFilteredLocations, favorites]);

  const groupedOtherLocations = useMemo(() => {
    return otherArenas.reduce((acc, loc) => {
      const key = loc.address;
      if (!acc[key]) acc[key] = [];
      acc[key].push(loc);
      return acc;
    }, {} as Record<string, Location[]>);
  }, [otherArenas]);

  const handleAdminVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    try {
      const isValid = await verifySuperPassword(password);
      if (isValid) {
        storage.setSuperAdminSession(true);
        setIsAdminMode(true);
        setPassword('');
      } else {
        triggerAlert("Invalid Super Admin Password", 'error');
      }
    } catch (err) {
      const appError = handleError(err);
      triggerAlert(appError.message, 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSuperReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSuperPassword || !newSuperPassword || !confirmSuperPassword) return;
    if (newSuperPassword !== confirmSuperPassword) {
      triggerAlert("New passwords do not match", 'error');
      return;
    }
    setIsUpdatingSuper(true);
    try {
      const isValid = await verifySuperPassword(currentSuperPassword);
      if (!isValid) {
        triggerAlert("Incorrect current password", 'error');
        return;
      }
      const { success, error } = await updateSuperAdminPassword(newSuperPassword);
      if (success) {
        triggerAlert("Password updated successfully!", 'success');
        setShowSuperResetModal(false);
        setCurrentSuperPassword('');
        setNewSuperPassword('');
        setConfirmSuperPassword('');
      } else {
        const appError = handleError(error);
        triggerAlert(appError.message, 'error');
      }
    } catch (err) {
      const appError = handleError(err);
      triggerAlert(appError.message, 'error');
    } finally {
      setIsUpdatingSuper(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        if (file.size > 2 * 1024 * 1024) {
          triggerAlert(`Image ${file.name} too large (Max 2MB).`, 'error');
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          setNewLoc(prev => ({ ...prev, imageUrls: [...prev.imageUrls, reader.result as string] }));
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleAddLocation = async () => {
    if (isAdding) return;
    if (!newLoc.name || !newLoc.address || !newLoc.email || newLoc.imageUrls.length === 0) return triggerAlert("Please fill all fields", 'error');
    setIsAdding(true);
    try {
      // 1. Upload images to Supabase Storage first
      const uploadedUrls = [];
      const newId = crypto.randomUUID();
      const arenaFolder = `${newLoc.name.replace(/[^a-z0-9]/gi, '_')}_${newId.substring(0, 8)}`;

      for (const base64 of newLoc.imageUrls) {
        const res = await fetch(base64);
        const blob = await res.blob();
        const fileName = `${arenaFolder}/Arena_Global/${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const url = await supabaseStorage.uploadFile('arenas', fileName, blob);
        uploadedUrls.push(url);
      }

      // 2. Add location with uploaded URLs
      const loc = await locationService.addLocation({
        ...newLoc,
        imageUrls: uploadedUrls,
        supportedSports: [activeSport]
      });

      setLocations(prev => [...prev, loc]);
      setShowAddModal(false);
      setNewLoc({ name: '', address: '', email: '', imageUrls: [], minAdvance: 0, latitude: undefined, longitude: undefined });
      triggerAlert("Arena added successfully!", 'success');
    } catch (err) {
      const appError = handleError(err);
      triggerAlert(appError.message, 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteLocation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const locToDelete = locations.find(l => l.id === id);
    const performDelete = async () => {
      try {
        // Delete images from storage first
        if (locToDelete && locToDelete.imageUrls) {
          for (const url of locToDelete.imageUrls) {
            if (url.includes('/arenas/')) {
              const path = url.split('/arenas/')[1];
              await supabaseStorage.deleteFile('arenas', path).catch(console.error);
            }
          }
        }
        await locationService.deleteLocation(id);
        setLocations(prev => prev.filter(l => l.id !== id));
      } catch (err) {
        const appError = handleError(err);
        triggerAlert(appError.message, 'error');
      }
    };
    if (onConfirm) {
      onConfirm({
        message: "Are you sure you want to delete this arena?",
        onConfirm: performDelete,
        isDestructive: true,
        confirmText: "Delete"
      });
    } else {
      performDelete();
    }
  };

  const openManualReset = (loc: Location, e: React.MouseEvent) => {
    e.stopPropagation();
    setResetLocId(loc.id);
    setManualUsername('');
    setManualPassword('');
    setShowManualReset(true);
  };

  const handleManualResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetLocId) return;
    setIsResetting(true);
    try {
      const { error } = await locationService.resetAdminCredentials(resetLocId, manualUsername, manualPassword);
      if (error) throw error;
      triggerAlert("Credentials updated successfully!", 'success');
      setShowManualReset(false);
    } catch (err) {
      const appError = handleError(err);
      triggerAlert(appError.message, 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const getCurrentLocation = async () => {
    const isAllowed = (permissions as { location?: 'allow' | 'later' | 'never' }).location === 'allow';

    if (!isAllowed) {
      const granted = await checkAndPrompt('location', true, false, true);
      if (!granted) return;
    }

    if (!navigator.geolocation) {
      triggerAlert("Geolocation is not supported", 'error');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setNewLoc(prev => ({ ...prev, latitude, longitude }));
        try {
          const result = await geocodingService.reverseGeocode(latitude, longitude);
          if (result && result.address) {
            setNewLoc(prev => ({ ...prev, address: result.address }));
            triggerAlert("Current location fetched and verified!", "success");
          }
        } catch (err) {
          const appError = handleError(err);
          triggerAlert(appError.message, 'error');
        } finally {
          setLocating(false);
        }
      },
      () => {
        triggerAlert("Unable to retrieve location", 'error');
        setLocating(false);
      }
    );
  };

  const openMaps = (e: React.MouseEvent, loc: Location) => {
    e.stopPropagation();
    if (loc.latitude && loc.longitude) {
      window.open(
        `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`,
        "_blank"
      );
    } else {
      triggerAlert("No coordinates set for this arena", 'info');
    }
  };

  const closeModal = () => {
    setShowManualReset(false);
    setShowSuperResetModal(false);
    setShowAddModal(false);
  };

  function renderArenaCard(loc: Location, idx: number) {
    const isFav = favorites.includes(loc.id);
    const distance = calculateDistance(userProfile?.latitude, userProfile?.longitude, loc.latitude, loc.longitude);

    return (
      <motion.div
        key={loc.id}
        initial={{ opacity: 0, y: 50, rotateX: 10 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ delay: idx * 0.1 }}
        whileHover={{ y: -10, transition: { duration: 0.3 } }}
        onClick={() => handleSelectLocation(loc)}
        className={`group rounded-theme-lg border flex flex-col relative cursor-pointer transition-all duration-300 ${isAdminMode ? 'ring-2' : ''}`}
        style={{
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            boxShadow: theme.elevation.card
        }}
      >
        <div className="relative m-5 rounded-theme-md aspect-[16/10] shadow-2xl">
          <div className="absolute inset-0 rounded-theme-md overflow-hidden">
            <ImageSlideshow imageUrls={loc.imageUrls} />
          </div>

          {/* Status Badge */}
          <div className="absolute top-5 left-5 z-30 px-3 py-1.5 rounded-theme-sm border shadow-xl backdrop-blur-md"
               style={{
                 backgroundColor: loc.is_open ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)',
                 borderColor: 'rgba(255, 255, 255, 0.2)'
               }}>
            <span className="text-white font-black text-[10px] uppercase tracking-widest">
              {loc.is_open ? 'Open' : 'Closed'}
            </span>
          </div>

          {/* Menu Buttons */}
          <div className="absolute top-5 right-5 z-40 flex items-center gap-3">
            {isAdminMode && (
              <>
                <button
                  onClick={(e) => handleToggleFavorite(e, loc.id)}
                  className="w-12 h-12 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-theme-sm flex items-center justify-center text-white transition-all shadow-xl"
                >
                  <Heart className={`w-5 h-5 ${isFav ? 'fill-red-500 text-red-500' : 'text-white'}`} />
                </button>
                <button
                  onClick={(e) => handleDeleteLocation(loc.id, e)}
                  className="w-12 h-12 bg-red-500 text-white rounded-theme-sm flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </>
            )}

            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDropdownOpenId(prev => prev === loc.id ? null : loc.id);
                }}
                className="w-12 h-12 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-theme-sm flex items-center justify-center text-white transition-all shadow-xl"
              >
                 <MoreVertical className="w-5 h-5" />
              </button>

              <AnimatePresence>
                {dropdownOpenId === loc.id && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDropdownOpenId(null);
                        navigate(`/arena/${loc.id}`);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-sm font-bold text-gray-800 transition-colors"
                    >
                      More details
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
          <div className="absolute bottom-8 left-8 right-8 pointer-events-none">
            <div className="flex items-center flex-wrap gap-4 mb-2">
              <h2 className="text-2xl md:text-4xl font-black text-white tracking-tighter italic uppercase leading-tight drop-shadow-2xl max-w-full break-words">
                {loc.name}
              </h2>

              {distance !== Infinity && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-accent text-white px-3 py-1.5 rounded-xl border border-white/20 shadow-theme-elevated flex items-center gap-2 backdrop-blur-md pointer-events-auto shrink-0"
                >
                  <Navigation className="w-3 h-3" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{formatDistance(distance)}</span>
                </motion.div>
              )}
            </div>
            <div className="flex items-center gap-2 text-white/80">
               <MapPin className="w-3.5 h-3.5" />
                <p className="text-[10px] font-black uppercase tracking-widest dynamic-text">
                  {loc.address.split(',').slice(0, 3).join(',')}
                </p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-8 pt-2 flex gap-4 items-end md:px-10 md:pb-10">
          <div className="flex-1 flex flex-col gap-4">
            <div className="h-14 flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: theme.colors.textDisabled }}>Full Price:</span>
                <span className={loc.defaultPrice && loc.defaultPrice > 0 ? "text-xl md:text-2xl font-black tracking-tighter leading-none" : "text-xs md:text-sm font-bold opacity-60 leading-none"} style={{ color: theme.colors.textPrimary }}>
                  {loc.defaultPrice && loc.defaultPrice > 0 ? `₹${loc.defaultPrice}` : 'No prices yet'}
                </span>
              </div>
              <div className="w-[1px] h-6 bg-black/10" />
              <div className="flex flex-col">
                <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: theme.colors.textDisabled }}>Advance:</span>
                <span className={loc.defaultAdvance && loc.defaultAdvance > 0 ? "text-xl md:text-2xl font-black tracking-tighter leading-none" : "text-xs md:text-sm font-bold opacity-60 leading-none"} style={{ color: theme.colors.textPrimary }}>
                  {loc.defaultAdvance && loc.defaultAdvance > 0 ? `₹${loc.defaultAdvance}` : 'No prices yet'}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleSelectLocation(loc)}
                className={`flex-1 h-14 text-white rounded-theme-md text-[11px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] shadow-theme-elevated flex items-center justify-center gap-2 transition-all active:translate-y-0.5 active:shadow-none hover:opacity-90 ${!loc.is_open ? 'opacity-80' : ''}`}
                style={{
                    background: loc.is_open
                      ? `linear-gradient(to right, ${theme.colors.buttonGradient[0]}, ${theme.colors.buttonGradient[1]})`
                      : `linear-gradient(to right, #94a3b8, #64748b)`, // Slate/Gray for closed
                }}
              >
                {loc.is_open ? 'Enter Arena' : 'Arena Closed'}
              </button>
              {/* Show directions if either coords or address exists */}
              {( (loc.latitude && loc.longitude) || loc.address ) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const query = (loc.latitude && loc.longitude)
                      ? `${loc.latitude},${loc.longitude}`
                      : encodeURIComponent(loc.address);
                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}`, "_blank");
                  }}
                  className="w-14 h-14 text-white rounded-theme-md shadow-theme-elevated flex items-center justify-center transition-all active:translate-y-0.5 active:shadow-none hover:opacity-90"
                  style={{ backgroundColor: '#1a73e8' }}
                  title="Directions"
                >
                  <Navigation className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            {!isAdminMode && (
              <button
                onClick={(e) => handleToggleFavorite(e, loc.id)}
                className="w-14 h-14 rounded-theme-md flex items-center justify-center hover:opacity-80 transition-all active:scale-95 border border-border shadow-theme-card"
                style={{
                  backgroundColor: isFav ? `${theme.colors.error}15` : theme.colors.backgroundSecondary,
                  color: isFav ? theme.colors.error : theme.colors.textDisabled
                }}
              >
                <Heart className={`w-5 h-5 ${isFav ? 'fill-current' : ''}`} />
              </button>
            )}
            {isAdminMode && (
              <button
                onClick={(e) => openManualReset(loc, e)}
                className="w-14 h-14 rounded-theme-md flex items-center justify-center hover:opacity-80 transition-all active:scale-95 border border-border shadow-theme-card"
                style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.accent }}
              >
                <Key className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); handleReviewClick(loc.id); }}
              className="w-14 h-14 rounded-theme-md flex items-center justify-center hover:opacity-80 transition-all active:scale-95 border border-border shadow-theme-card"
              style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textDisabled }}
            >
              <Star className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen p-5 md:p-8 flex flex-col relative overflow-hidden transition-all duration-300"
         style={{ backgroundColor: theme.colors.background }}>
      {/* 3D Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none opacity-10 md:hidden"
           style={{ backgroundColor: theme.colors.accent }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none opacity-10 md:hidden"
           style={{ backgroundColor: theme.colors.success }} />
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none opacity-20 md:block hidden"
           style={{ backgroundColor: theme.colors.accent }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none opacity-20 md:block hidden"
           style={{ backgroundColor: theme.colors.success }} />

      <div className="max-w-4xl mx-auto w-full relative z-10 space-y-8 md:space-y-0">
        <motion.header
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 md:gap-6 relative z-[100]"
        >
          <div className="text-left">
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter italic md:not-italic uppercase drop-shadow-2xl md:drop-shadow-none"
                style={{ color: theme.colors.textPrimary }}>
              Select <span style={{ color: theme.colors.accent }}>Arena</span>
            </h1>
            <div className="flex items-center gap-3 md:gap-2 mt-3 md:mt-2">
              <span className="h-3 w-3 md:h-2 md:w-2 rounded-full animate-pulse bg-accent shadow-[0_0_10px_rgba(249,115,22,0.5)] md:shadow-none" />
              <p className="font-black uppercase text-[10px] tracking-[0.4em] md:tracking-[0.3em] opacity-60 md:opacity-100" style={{ color: theme.colors.accent }}>
                {activeSport} MODE
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-3.5 flex-shrink-0 ml-auto bg-card md:bg-transparent p-2 md:p-0 rounded-[1.5rem] md:rounded-none border border-border md:border-0 shadow-theme-card md:shadow-none backdrop-blur-md md:backdrop-blur-none">
              <button
                onClick={handleBackClick}
                className="flex-shrink-0 w-12 h-12 rounded-xl md:rounded-theme-md border transition-all flex items-center justify-center shadow-sm md:shadow-theme-card active:scale-90 md:active:scale-95 bg-background-secondary"
                style={{ borderColor: theme.colors.border }}
                title="Back"
              >
                <ChevronLeft className="w-6 h-6" style={{ color: theme.colors.textDisabled }} />
              </button>

              <button
                onClick={handleProfileClick}
                className="flex-shrink-0 w-12 h-12 border rounded-xl md:rounded-theme-md flex items-center justify-center overflow-hidden shadow-inner md:shadow-theme-card bg-background-secondary"
                style={{ borderColor: theme.colors.border }}
              >
                {user?.profileImage ? <img src={user.profileImage} className="w-full h-full object-cover" alt="Profile" /> : <UserIcon className="w-5 h-5" style={{ color: theme.colors.textDisabled }} />}
              </button>

              {user?.role === 'superadmin' && user?.role_status === 'approved' && (
                <div className="relative">
                  <button
                    onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
                    className="w-12 h-12 rounded-xl md:rounded-theme-md flex items-center justify-center transition-all shadow-sm md:shadow-theme-card border border-border active:scale-90 md:active:translate-y-0.5 bg-background-secondary"
                    style={{ color: theme.colors.textPrimary }}
                  >
                    <MoreVertical className="w-6 h-6" />
                  </button>

                  <AnimatePresence>
                    {headerMenuOpen && (
                      <>
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="fixed inset-0 z-[100]"
                          onClick={() => setHeaderMenuOpen(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -20 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -20 }}
                          className="absolute right-0 mt-3 w-64 z-[101] overflow-hidden rounded-[2rem] md:rounded-2xl shadow-theme-modal md:shadow-2xl border backdrop-blur-3xl"
                          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
                        >
                          {user?.role === 'superadmin' && user?.role_status === 'approved' && (
                            <button
                              onClick={() => { handleSuperAdminClick(); setHeaderMenuOpen(false); }}
                              className="w-full px-7 py-5 md:px-5 md:py-4 text-left flex items-center gap-4 md:gap-3 transition-colors border-b"
                              style={{ color: theme.colors.success, borderColor: `${theme.colors.border}40` }}
                            >
                              <Shield className="w-5 h-5 md:w-4 md:h-4" />
                              <span className="text-xs font-black uppercase tracking-widest italic md:not-italic">Admin approval</span>
                            </button>
                          )}

                          {((user?.role as string) === 'admin' || user?.role === 'superadmin') && user?.role_status === 'approved' && (
                            isAdminMode ? (
                              <>
                                <button
                                  onClick={() => { setShowSuperResetModal(true); setHeaderMenuOpen(false); }}
                                  className="w-full px-7 py-5 md:px-5 md:py-4 text-left flex items-center gap-4 md:gap-3 transition-colors border-b"
                                  style={{ color: theme.colors.textPrimary, borderColor: `${theme.colors.border}40` }}
                                >
                                  <Settings className="w-5 h-5 md:w-4 md:h-4" />
                                  <span className="text-xs font-black uppercase tracking-widest italic md:not-italic">Credentials</span>
                                </button>
                                <button
                                  onClick={() => { setShowAddModal(true); setHeaderMenuOpen(false); }}
                                  className="w-full px-7 py-5 md:px-5 md:py-4 text-left flex items-center gap-4 md:gap-3 transition-colors border-b"
                                  style={{ color: theme.colors.accent, borderColor: `${theme.colors.border}40` }}
                                >
                                  <Plus className="w-5 h-5 md:w-4 md:h-4" />
                                  <span className="text-xs font-black uppercase tracking-widest italic md:not-italic">Add Arena</span>
                                </button>
                                <button
                                  onClick={() => {
                                    storage.setSuperAdminSession(false);
                                    storage.setSuperAuth(false);
                                    setIsAdminMode(false);
                                    setIsSuperAuth(false);
                                    setHeaderMenuOpen(false);
                                  }}
                                  className="w-full px-7 py-5 md:px-5 md:py-4 text-left flex items-center gap-4 md:gap-3 transition-colors"
                                  style={{ color: theme.colors.error }}
                                >
                                  <LogOut className="w-5 h-5 md:w-4 md:h-4" />
                                  <span className="text-xs font-black uppercase tracking-widest italic md:not-italic">Exit Admin</span>
                                </button>
                              </>
                            ) : (
                               <button
                                  onClick={() => {
                                    storage.setSuperAuth(false);
                                    setIsSuperAuth(false);
                                    setHeaderMenuOpen(false);
                                  }}
                                  className="w-full px-7 py-5 md:px-5 md:py-4 text-left flex items-center gap-4 md:gap-3 transition-colors"
                                  style={{ color: theme.colors.textSecondary }}
                                >
                                  <Key className="w-5 h-5 md:w-4 md:h-4" />
                                  <span className="text-xs font-black uppercase tracking-widest italic md:not-italic">Super Admin</span>
                                </button>
                            )
                          )}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </motion.header>

        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-4 relative group"
        >
          <div className="absolute inset-y-0 left-6 md:left-6 flex items-center pointer-events-none">
            <Search className="w-6 h-6 md:w-5 md:h-5 text-accent md:text-text-disabled opacity-40 md:opacity-100 group-focus-within:opacity-100 transition-opacity" />
          </div>
          <input
            type="text"
            placeholder="Search arenas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-16 pr-8 py-5 md:py-4 md:pl-20 rounded-[1.5rem] md:rounded-theme-lg font-black md:font-bold uppercase outline-none focus:ring-4 ring-accent/10 md:ring-transparent transition-all text-sm md:text-base border border-border md:border-transparent shadow-theme-modal md:shadow-none bg-card"
            style={{
                color: theme.colors.textPrimary,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.card,
            }}
          />
        </motion.div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-14 h-14 border-4 border-border rounded-full animate-spin mb-6" style={{ borderTopColor: theme.colors.accent }} />
            <p className="font-black uppercase text-[10px] tracking-[0.4em]" style={{ color: theme.colors.textDisabled }}>Loading Arenas...</p>
          </div>
        ) : (
          <div className="space-y-12 pb-20">
            {favoriteArenas.length === 0 && Object.keys(groupedOtherLocations).length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center py-20 rounded-theme-lg border-2 border-dashed"
                style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}
              >
                <p className="font-black uppercase text-xs tracking-widest" style={{ color: theme.colors.textDisabled }}>No arenas found in this area</p>
              </motion.div>
            ) : (
              <>
                {favoriteArenas.length > 0 && (
                  <div className="space-y-6">
                    <motion.div
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      className="flex items-center gap-3 pl-2"
                    >
                      <Heart className="w-4 h-4" style={{ color: theme.colors.error }} fill={theme.colors.error} />
                      <h2 className="text-[11px] font-black uppercase tracking-[0.4em]" style={{ color: theme.colors.textDisabled }}>Favorite Arenas</h2>
                    </motion.div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 perspective-1000">
                      {favoriteArenas.map((loc, idx) => renderArenaCard(loc, idx))}
                    </div>
                    {Object.keys(groupedOtherLocations).length > 0 && (
                      <div className="py-8">
                        <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent opacity-50" />
                      </div>
                    )}
                  </div>
                )}

                {(Object.entries(groupedOtherLocations) as [string, Location[]][]).map(([address, arenas], groupIndex) => (
                  <div key={address} className="space-y-6">
                    <motion.div
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: groupIndex * 0.1 }}
                      className="flex items-center gap-3 pl-2"
                    >
                      <MapPin className="w-4 h-4" style={{ color: theme.colors.accent }} />
                      <h2 className="text-[11px] font-black uppercase tracking-[0.4em]" style={{ color: theme.colors.textDisabled }}>{address}</h2>
                    </motion.div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 perspective-1000">
                      {arenas.map((loc, idx) => renderArenaCard(loc, idx))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {(showManualReset || showSuperResetModal || showAddModal) && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" />

            {showManualReset && (
              <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                          className="border rounded-theme-lg w-full max-w-[360px] p-12 text-center shadow-theme-modal relative z-10 backdrop-blur-md"
                          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
                <button onClick={closeModal} className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/5 transition-colors" style={{ color: theme.colors.textDisabled }}><X className="w-5 h-5" /></button>
                <div className="w-16 h-16 rounded-theme-md flex items-center justify-center mx-auto mb-8 shadow-theme-elevated"
                     style={{ backgroundColor: `${theme.colors.accent}15`, color: theme.colors.accent, border: `1px solid ${theme.colors.accent}30` }}>
                   <Key className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black mb-8 uppercase tracking-tighter italic" style={{ color: theme.colors.textPrimary }}>Update Login</h3>
                <form onSubmit={handleManualResetSubmit} className="space-y-5">
                  <input type="text" value={manualUsername} onChange={e => setManualUsername(e.target.value)} className="w-full p-5 rounded-theme-md font-bold outline-none border-2 transition-all"
                         style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.textPrimary }} placeholder="New Username" required />
                  <input type="text" value={manualPassword} onChange={e => setManualPassword(e.target.value)} className="w-full p-5 rounded-theme-md font-bold outline-none border-2 transition-all"
                         style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.textPrimary }} placeholder="New Password" required />
                  <button type="submit" disabled={isResetting} className="w-full py-5 rounded-theme-md font-black uppercase tracking-widest shadow-theme-elevated disabled:opacity-50 transition-all active:translate-y-0.5 active:shadow-none"
                          style={{ backgroundColor: theme.colors.accent, color: 'white' }}>{isResetting ? 'Saving...' : 'Save Changes'}</button>
                  <button type="button" onClick={() => setShowManualReset(false)} className="w-full py-2 font-bold uppercase text-[10px] tracking-widest" style={{ color: theme.colors.textDisabled }}>Cancel</button>
                </form>
              </motion.div>
            )}

            {showSuperResetModal && (
              <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                          className="border rounded-theme-lg w-full max-w-[360px] p-12 text-center shadow-theme-modal relative z-10 backdrop-blur-md"
                          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
                <button onClick={closeModal} className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/5 transition-colors" style={{ color: theme.colors.textDisabled }}><X className="w-5 h-5" /></button>
                <div className="w-16 h-16 rounded-theme-md flex items-center justify-center mx-auto mb-8 shadow-theme-elevated"
                     style={{ backgroundColor: `${theme.colors.accent}15`, color: theme.colors.accent, border: `1px solid ${theme.colors.accent}30` }}>
                   <Shield className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black mb-8 uppercase tracking-tighter italic" style={{ color: theme.colors.textPrimary }}>Change Password</h3>
                <form onSubmit={handleSuperReset} className="space-y-4">
                  <input autoFocus type="password" value={currentSuperPassword} onChange={e => setCurrentSuperPassword(e.target.value)} className="w-full p-5 rounded-theme-md font-bold outline-none border-2 text-center transition-all"
                         style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.textPrimary }} placeholder="Current Password" required />
                  <input type="password" value={newSuperPassword} onChange={e => setNewSuperPassword(e.target.value)} className="w-full p-5 rounded-theme-md font-bold outline-none border-2 text-center transition-all"
                         style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.textPrimary }} placeholder="New Password" required />
                  <input type="password" value={confirmSuperPassword} onChange={e => setConfirmSuperPassword(e.target.value)} className="w-full p-5 rounded-theme-md font-bold outline-none border-2 text-center transition-all"
                         style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.textPrimary }} placeholder="Confirm Password" required />
                  <button type="submit" disabled={isUpdatingSuper} className="w-full py-5 text-white rounded-theme-md font-black uppercase tracking-widest shadow-theme-elevated disabled:opacity-50 mt-4 transition-all active:translate-y-0.5 active:shadow-none"
                          style={{ backgroundColor: theme.colors.accent }}>
                    {isUpdatingSuper ? 'Updating...' : 'Update Password'}
                  </button>
                  <button type="button" onClick={() => setShowSuperResetModal(false)} className="w-full py-2 font-bold uppercase text-[10px] tracking-widest" style={{ color: theme.colors.textDisabled }}>Cancel</button>
                </form>
              </motion.div>
            )}



            {showAddModal && (
              <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
                          className="border rounded-theme-lg w-full max-w-md p-10 shadow-theme-modal max-h-[90vh] overflow-y-auto relative z-10 backdrop-blur-md transition-all"
                          style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
                <button onClick={closeModal} className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/5 transition-colors" style={{ color: theme.colors.textDisabled }}><X className="w-5 h-5" /></button>
                <h2 className="text-4xl font-black italic text-center mb-12 uppercase tracking-tighter" style={{ color: theme.colors.textPrimary }}>Add <span style={{ color: theme.colors.accent }}>Arena</span></h2>
                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1" style={{ color: theme.colors.textDisabled }}>Arena Images</label>
                    <div onClick={() => !isAdding && fileInputRef.current?.click()} className="w-full min-h-32 border-4 border-dashed rounded-theme-lg p-6 flex flex-wrap gap-4 items-center justify-center cursor-pointer transition-all" style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border }}>
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple accept="image/*" disabled={isAdding} />
                      {newLoc.imageUrls.length > 0 ? (
                        newLoc.imageUrls.map((url, idx) => (
                          <div key={idx} className="w-20 h-20 rounded-theme-sm overflow-hidden relative group shadow-2xl ring-2 ring-white/10">
                            <img src={url} className="w-full h-full object-cover" />
                            <button onClick={(e) => { e.stopPropagation(); if (!isAdding) setNewLoc(prev => ({ ...prev, imageUrls: prev.imageUrls.filter((_, i) => i !== idx) })); }} className="absolute inset-0 bg-red-600/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"><Trash2 className="w-6 h-6" /></button>
                          </div>
                        ))
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Plus className="w-6 h-6" style={{ color: theme.colors.accent }} />
                          <span className="text-[10px] font-black uppercase tracking-[0.4em]" style={{ color: theme.colors.textDisabled }}>Upload Photos</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1" style={{ color: theme.colors.textDisabled }}>Arena Name</label>
                    <input placeholder="Facilty Name" value={newLoc.name} onChange={e => setNewLoc({ ...newLoc, name: e.target.value })} className="w-full p-5 rounded-theme-md font-bold outline-none border-2 transition-all"
                           style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.textPrimary }} />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1" style={{ color: theme.colors.textDisabled }}>Admin Email</label>
                    <div className="relative group/input">
                      <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                        <Mail className="w-4 h-4" style={{ color: theme.colors.textDisabled }} />
                      </div>
                      <input type="email" placeholder="admin@example.com" value={newLoc.email} onChange={e => setNewLoc({ ...newLoc, email: e.target.value })} className="w-full pl-12 pr-5 py-5 rounded-theme-md font-bold outline-none border-2 transition-all"
                             style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.textPrimary }} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase tracking-widest ml-1" style={{ color: theme.colors.textDisabled }}>Location Name</label>
                      <button
                        onClick={getCurrentLocation}
                        disabled={locating || isVerifying || isAdding}
                        className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        style={{ color: theme.colors.accent }}
                      >
                        {locating ? <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: theme.colors.accent }}></div> : <MapPin className="w-3 h-3" />}
                        {locating ? 'Locating...' : 'Get Current Location'}
                      </button>
                    </div>
                    <div className="relative group/address">
                      <input
                        placeholder="City / Area"
                        value={newLoc.address}
                        onChange={e => setNewLoc({ ...newLoc, address: e.target.value })}
                        className="w-full p-5 pr-12 rounded-theme-md font-bold outline-none border-2 transition-all"
                        style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.textPrimary }}
                      />
                      <button
                        onClick={async (e) => {
                          e.preventDefault();
                          if (!newLoc.address || isVerifying) return;
                          setIsVerifying(true);
                          try {
                            const result = await geocodingService.searchAddress(newLoc.address);
                            if (result) {
                              setNewLoc(prev => ({
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
                        disabled={isVerifying || locating || isAdding}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl hover:bg-accent/10 text-accent transition-all active:scale-90 disabled:opacity-50"
                        title="Verify Location"
                      >
                        {isVerifying ? <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <LoadingButton
                    loading={isAdding}
                    disabled={isVerifying || locating}
                    onClick={handleAddLocation}
                    className="w-full py-6 text-white rounded-theme-md font-black uppercase tracking-widest shadow-theme-elevated mt-6 disabled:opacity-50"
                    style={{ backgroundColor: theme.colors.accent }}
                    loadingText="Adding..."
                  >
                    Save Arena
                  </LoadingButton>
                  <button onClick={() => setShowAddModal(false)} disabled={isAdding} className="w-full py-2 font-bold uppercase text-[10px] tracking-widest text-center" style={{ color: theme.colors.textDisabled }}>Cancel</button>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LocationSelector;

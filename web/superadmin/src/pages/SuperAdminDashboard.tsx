import React, { useState, useEffect } from 'react';
import LoadingButton from '../components/LoadingButton';
import { locationService, LocationWithAdmin } from '../services/locationService';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Database, RefreshCcw, Trash2, Key, MapPin, Search, LayoutDashboard, Globe, Lock, Navigation } from 'lucide-react';
import { handleError } from '../services/errorHandler';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeSelector } from '../components/ThemeSelector';
import { forceScrollTop } from '../utils/scroll';

interface SuperAdminDashboardProps {
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

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onAlert, onConfirm }) => {
  const { theme } = useTheme();
  const [locations, setLocations] = useState<LocationWithAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingLocId, setProcessingLocId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const triggerAlert = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (onAlert) onAlert(msg, type);
  };

  useEffect(() => { loadLocations(); }, []);
  useEffect(() => { return forceScrollTop(); }, []);

  const loadLocations = async () => {
    try {
      setLoading(true);
      const data = await locationService.getLocationsWithAdmins();
      setLocations(data);
    } catch (err) {
      triggerAlert(handleError(err).message, 'error');
    } finally { setLoading(false); }
  };

  const handleResetPassword = async (locId: string) => {
    if (processingLocId) return;
    const performReset = async () => {
      setProcessingLocId(locId);
      try {
        const result = await locationService.resetAdminPassword(locId);
        triggerAlert(`ID: ${result.username} | Key: ${result.password}`, 'success');
        await loadLocations();
      } catch (err) { triggerAlert(handleError(err).message, 'error'); }
      finally { setProcessingLocId(null); }
    };
    if (onConfirm) onConfirm({ message: "Reset login?", onConfirm: performReset, confirmText: "Reset" });
  };

  const handleDelete = async (id: string) => {
    if (processingLocId) return;
    const performDelete = async () => {
      setProcessingLocId(id);
      try {
        await locationService.deleteLocation(id);
        await loadLocations();
        triggerAlert("Removed", 'success');
      } catch (err) { triggerAlert(handleError(err).message, 'error'); }
      finally { setProcessingLocId(null); }
    };
    if (onConfirm) onConfirm({ message: "Permanently delete?", onConfirm: performDelete, isDestructive: true, confirmText: "Delete" });
  };

  const openMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
  };

  const filteredLocations = locations.filter(l =>
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen p-5 md:p-10 relative overflow-hidden transition-all duration-300"
         style={{ backgroundColor: theme.colors.background }}>
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none opacity-10" style={{ backgroundColor: theme.colors.accent }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none opacity-10" style={{ backgroundColor: theme.colors.success }} />

      <div className="max-w-6xl mx-auto space-y-10 md:space-y-12 relative z-10">
        <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                    className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-left">
            <h1 className="text-4xl md:text-7xl font-black italic uppercase tracking-tighter drop-shadow-2xl" style={{ color: theme.colors.textPrimary }}>
              Super <span style={{ color: theme.colors.accent }}>Admin</span>
            </h1>
            <div className="flex items-center gap-3 md:gap-4 mt-4 md:mt-6 justify-center md:justify-start">
              <ShieldCheck className="w-6 h-6 md:w-8 md:h-8 animate-pulse text-accent" />
              <p className="text-[10px] font-black uppercase tracking-[0.4em] bg-background-secondary/50 md:bg-white/5 px-5 py-2 md:px-6 md:py-3 rounded-full border border-border/50 md:border transition-all"
                style={{ color: theme.colors.textDisabled }}>Dashboard Access</p>
            </div>
          </div>

          <div className="flex backdrop-blur-3xl p-5 md:p-4 rounded-[2rem] md:rounded-3xl border shadow-theme-card md:shadow-2xl items-center gap-6 md:gap-8 transition-all bg-card/80 md:bg-card"
            style={{ borderColor: theme.colors.border }}>
            <div className="flex items-center gap-4 px-6 border-r border-border/30 md:border-border/20">
              <Database className="w-7 h-7 md:w-6 md:h-6 text-accent" />
              <div className="flex flex-col">
                  <span className="text-2xl md:text-3xl font-black italic tracking-tighter leading-none" style={{ color: theme.colors.textPrimary }}>
                    {locations.length}
                  </span>
                  <span className="text-[8px] md:text-xs uppercase font-black md:font-bold tracking-widest mt-1 md:mt-0 opacity-50 md:opacity-100" style={{ color: theme.colors.textDisabled }}>Arenas</span>
              </div>
            </div>
            <ThemeSelector />
            <motion.button whileHover={{ rotate: 180 }} onClick={loadLocations} className="w-12 h-12 text-white rounded-2xl flex items-center justify-center shadow-theme-elevated md:shadow-lg transition-all bg-accent active:scale-90">
              <RefreshCcw className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
            </motion.button>
          </div>
        </motion.div>

        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="backdrop-blur-3xl rounded-[2.5rem] md:rounded-3xl border shadow-theme-modal md:shadow-2xl overflow-hidden transition-all duration-300 bg-card"
          style={{ borderColor: theme.colors.border }}>
          <div className="p-8 md:p-8 border-b border-border/30 md:border-border/20 flex flex-col md:flex-row gap-6 md:gap-8 justify-between items-center transition-all bg-background-secondary/20 md:bg-transparent" style={{ borderColor: `${theme.colors.border}20` }}>
            <div className="flex items-center gap-4">
              <LayoutDashboard className="w-6 h-6 text-accent" />
              <h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-text-primary">Arenas</h2>
            </div>
            <div className="relative group w-full md:w-[400px]">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40 text-text-primary" />
              <input type="text" placeholder="Search arenas..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-14 pr-6 py-4 md:py-4 border border-border md:border rounded-2xl font-black md:font-bold outline-none transition-all text-sm bg-background-secondary md:bg-background-secondary shadow-inner md:shadow-none"
                style={{ color: theme.colors.textPrimary }} />
            </div>
          </div>

          <div className="p-4 md:p-6">
            {loading && locations.length === 0 ? (
              <div className="py-40 text-center space-y-6 md:space-y-0">
                <div className="w-12 h-12 border-4 border-white/10 rounded-full animate-spin mx-auto mb-6 shadow-2xl" style={{ borderTopColor: theme.colors.accent }} />
                <p className="text-[10px] font-black uppercase tracking-[0.5em] animate-pulse opacity-40 md:opacity-100" style={{ color: theme.colors.textDisabled }}>Loading...</p>
              </div>
            ) : filteredLocations.length === 0 ? (
              <div className="py-40 text-center">
                <p className="font-black uppercase text-xs tracking-[0.4em] opacity-30 md:opacity-100" style={{ color: theme.colors.textDisabled }}>No arenas found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:gap-6">
                <AnimatePresence>
                  {filteredLocations.map((loc, idx) => (
                    <motion.div key={loc.id} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ delay: idx * 0.05 }} whileHover={{ x: 10, backgroundColor: 'rgba(255,255,255,0.05)' }}
                      className="p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 md:gap-8 rounded-[2rem] md:rounded-3xl border border-border/30 md:border-transparent transition-all group bg-background-secondary/30 md:bg-transparent">
                      <div className="flex-1 space-y-6 md:space-y-6">
                        <div className="flex items-center gap-6 md:gap-6">
                          <div className="w-16 h-16 rounded-[1.25rem] md:rounded-2xl flex items-center justify-center border shadow-inner md:shadow-2xl bg-card md:bg-background-secondary border-border/50 md:border group-hover:rotate-6 transition-all duration-500">
                            <Globe className="w-8 h-8 text-accent opacity-80 md:opacity-100" />
                          </div>
                          <div>
                            <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter leading-tight text-text-primary">{loc.name}</h3>
                            <div className="flex items-center gap-2 mt-2 opacity-60 md:opacity-100">
                              <MapPin className="w-4 h-4 text-text-disabled" />
                              <p className="text-[10px] font-black uppercase tracking-widest md:tracking-[0.2em] text-text-disabled truncate max-w-[200px] md:max-w-md">{loc.address}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-xl border border-border/50 md:border bg-card md:bg-background-secondary shadow-inner transition-all">
                            <Lock className="w-3.5 h-3.5 text-text-disabled" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-text-disabled">Admin ID:</span>
                            <span className="text-xs font-black tracking-tight text-accent italic md:not-italic">{loc.adminUsername || 'NOT SET'}</span>
                          </div>
                          {loc.latitude && loc.longitude && (
                            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-xl border border-border/50 md:border bg-card md:bg-background-secondary shadow-inner transition-all">
                               <Navigation className="w-3.5 h-3.5 text-text-disabled" />
                               <span className="text-[9px] font-black uppercase tracking-widest text-text-disabled">Coords:</span>
                               <span className="text-xs font-black tracking-tight text-text-primary opacity-80 md:opacity-100 italic md:not-italic">{loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex w-full md:w-auto gap-3 md:gap-4">
                        {loc.latitude && loc.longitude && (
                          <motion.button whileTap={{ scale: 0.98 }} onClick={() => openMaps(loc.latitude!, loc.longitude!)}
                            className="flex-1 md:flex-none px-6 py-4 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-theme-elevated md:shadow-xl bg-[#1a73e8]">
                            <Navigation className="w-4 h-4" /> Map
                          </motion.button>
                        )}
                        <LoadingButton
                          loading={processingLocId === loc.id}
                          disabled={!!processingLocId && processingLocId !== loc.id}
                          onClick={() => handleResetPassword(loc.id)}
                          className="flex-1 md:flex-none px-6 py-4 border border-border md:border rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-theme-card md:shadow-xl bg-card md:bg-background-secondary text-text-primary"
                          icon={<Key className="w-4 h-4" />}
                          loadingText="Resetting..."
                        >
                          Reset
                        </LoadingButton>
                        <LoadingButton
                          loading={processingLocId === loc.id}
                          disabled={!!processingLocId && processingLocId !== loc.id}
                          onClick={() => handleDelete(loc.id)}
                          className="px-6 py-4 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-theme-elevated md:shadow-xl bg-error active:translate-y-1"
                          loadingText="Deleting..."
                        >
                          Delete
                        </LoadingButton>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}
          className="text-center p-12 md:p-16 rounded-[3rem] md:rounded-[40px] text-white shadow-2xl relative overflow-hidden group perspective-1000 transition-all duration-500"
          style={{ background: `linear-gradient(to bottom right, ${theme.colors.buttonGradient[0]}, ${theme.colors.buttonGradient[1]})` }}>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
          <div className="absolute top-[-20%] right-[-20%] w-96 h-96 bg-white/10 rounded-full blur-[100px] group-hover:bg-white/20 transition-all duration-1000" />
          <h3 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter relative z-10 flex items-center justify-center gap-5">
            <Database className="w-10 h-10 md:w-12 md:h-12 text-white/50" /> Boxitt Stats
          </h3>
          <div className="mt-12 flex flex-col sm:flex-row justify-center items-center gap-10 md:gap-16 relative z-10">
            <div className="text-center">
              <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-3">Total Arenas</p>
              <p className="text-3xl md:text-4xl font-black italic tracking-tighter leading-none">{locations.length}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-3">Active Users</p>
              <p className="text-3xl md:text-4xl font-black italic tracking-tighter leading-none">12.5k</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;

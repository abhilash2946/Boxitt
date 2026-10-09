import React, { useState } from 'react';
import LoadingButton from '../components/LoadingButton';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, CheckCircle2, XCircle, Clock, ChevronLeft, Search, User as UserIcon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { usePendingApprovals, useApprovalAction } from '../hooks/useApprovals';

const SuperAdminApprovalDashboard: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { theme } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: requests = [], isLoading: loading } = usePendingApprovals();
  const approvalAction = useApprovalAction();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleAction = (id: string, status: 'approved' | 'rejected', role?: string) => {
    approvalAction.mutate(
      { id, status, role },
      {
        onSuccess: () => {
          setFeedback({ type: 'success', message: `User ${status === 'approved' ? 'approved' : 'rejected'} successfully.` });
        },
        onError: (error: any) => {
          setFeedback({ type: 'error', message: error?.message || 'An error occurred. Please try again.' });
        },
      }
    );
  };

  const filteredRequests = requests.filter(r =>
    r.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen p-6 md:p-10 relative overflow-hidden transition-all duration-300" style={{ backgroundColor: theme.colors.background }}>
      {feedback && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-theme-lg shadow-theme-elevated font-bold text-center transition-all ${feedback.type === 'success' ? 'bg-success text-white' : 'bg-error text-white'}`}
             onClick={() => setFeedback(null)}
             style={{ minWidth: 220, cursor: 'pointer' }}>
          {feedback.message}
        </div>
      )}
      <div className="max-w-5xl mx-auto space-y-8 relative z-10">
        <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-3 rounded-theme-md border transition-all shadow-theme-card active:translate-y-0.5"
              style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.textPrimary }}>
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-3xl font-black italic uppercase tracking-tighter" style={{ color: theme.colors.textPrimary }}>Admin <span style={{ color: theme.colors.accent }}>Approvals</span></h1>
              <p className="text-[10px] font-black uppercase tracking-[0.4em]" style={{ color: theme.colors.textDisabled }}>Review new admin requests</p>
            </div>
          </div>
          <div className="w-12 h-12 rounded-theme-md flex items-center justify-center shadow-theme-elevated" style={{ backgroundColor: theme.colors.accent, color: 'white' }}>
            <Shield className="w-6 h-6" />
          </div>
        </motion.header>

        <div className="relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: theme.colors.textDisabled }} />
          <input
            type="text"
            placeholder="Search pending requests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-5 rounded-theme-lg font-bold outline-none border-2 border-transparent transition-all shadow-inner"
            style={{ backgroundColor: theme.colors.card, color: theme.colors.textPrimary }}
          />
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="py-20 text-center animate-pulse">
              <div className="w-12 h-12 border-4 border-border border-t-accent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: theme.colors.textDisabled }}>Loading requests...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="py-24 text-center rounded-theme-lg border-2 border-dashed shadow-inner" style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}>
              <p className="font-black uppercase text-xs tracking-widest" style={{ color: theme.colors.textDisabled }}>{searchTerm ? 'No matches found' : 'No pending approvals'}</p>
            </div>
          ) : (
            <AnimatePresence>
              {filteredRequests.map((req, idx) => (
                <motion.div
                  key={req.id}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 20, opacity: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="p-4 sm:p-6 rounded-2xl sm:rounded-theme-lg border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6 shadow-theme-card hover:shadow-theme-elevated transition-all relative overflow-hidden"
                  style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
                >
                  <div className="flex items-center gap-4 sm:gap-5 w-full">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-theme-md flex items-center justify-center shadow-inner shrink-0" style={{ backgroundColor: theme.colors.backgroundSecondary }}>
                      <UserIcon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: theme.colors.accent }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm sm:text-lg font-black italic uppercase tracking-tight text-slate-800 truncate leading-none mb-1">{req.username || 'Anonymous'}</h3>
                      <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-blue-600 truncate mb-2">{req.email}</p>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[7px] sm:text-[8px] font-black uppercase tracking-widest border border-accent/20 bg-accent/5 text-accent shadow-sm">{req.role}</span>
                        <div className="flex items-center gap-1 text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-slate-400">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{new Date(req.created_at).toLocaleDateString()} • {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Row - Full width on mobile */}
                  <div className="flex items-center gap-2 w-full md:w-auto pt-3 border-t md:border-t-0 border-slate-100 mt-1 md:mt-0">
                    <LoadingButton
                      loading={approvalAction.isPending && approvalAction.variables?.status === 'approved' && approvalAction.variables?.id === req.id}
                      onClick={() => handleAction(req.id, 'approved', req.role)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest text-white shadow-md active:scale-95 transition-all"
                      style={{ backgroundColor: theme.colors.success }}
                      loadingText="..."
                      icon={<CheckCircle2 className="w-3 h-3" />}
                    >
                      Approve
                    </LoadingButton>
                    <LoadingButton
                      loading={approvalAction.isPending && approvalAction.variables?.status === 'rejected' && approvalAction.variables?.id === req.id}
                      onClick={() => handleAction(req.id, 'rejected', req.role)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest text-white shadow-md active:scale-95 transition-all"
                      style={{ backgroundColor: theme.colors.error }}
                      loadingText="..."
                      icon={<XCircle className="w-3 h-3" />}
                    >
                      Reject
                    </LoadingButton>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminApprovalDashboard;

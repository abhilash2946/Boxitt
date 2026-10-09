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
    <div className="min-h-screen p-5 md:p-10 relative overflow-hidden transition-all duration-300" style={{ backgroundColor: theme.colors.background }}>
      {feedback && (
        <div className={`fixed top-8 md:top-6 left-1/2 -translate-x-1/2 z-[100] md:z-50 px-8 py-5 md:px-6 md:py-4 rounded-2xl md:rounded-theme-lg shadow-theme-modal md:shadow-theme-elevated font-black md:font-bold uppercase md:normal-case text-xs md:text-base tracking-widest md:tracking-normal text-center transition-all ${feedback.type === 'success' ? 'bg-success text-white' : 'bg-error text-white'}`}
             onClick={() => setFeedback(null)}
             style={{ minWidth: 280, cursor: 'pointer' }}>
          {feedback.message}
        </div>
      )}
      <div className="max-w-5xl mx-auto space-y-10 md:space-y-8 relative z-10">
        <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex justify-between items-center bg-card md:bg-transparent p-6 md:p-0 rounded-[2rem] md:rounded-none border border-border md:border-0 shadow-theme-card md:shadow-none">
          <div className="flex items-center gap-5 md:gap-4">
            <button onClick={onBack} className="p-3.5 md:p-3 rounded-2xl md:rounded-theme-md border transition-all shadow-theme-card active:scale-90 md:active:translate-y-0.5 bg-background-secondary md:bg-transparent"
              style={{ borderColor: theme.colors.border, color: theme.colors.textPrimary }}>
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter" style={{ color: theme.colors.textPrimary }}>Admin <span style={{ color: theme.colors.accent }}>Approvals</span></h1>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-50 md:opacity-100" style={{ color: theme.colors.textDisabled }}>Review new admin requests</p>
            </div>
          </div>
          <div className="w-14 h-14 md:w-12 md:h-12 rounded-2xl md:rounded-theme-md flex items-center justify-center shadow-theme-elevated bg-accent text-white transform md:rotate-0 rotate-3 transition-transform">
            <Shield className="w-7 h-7 md:w-6 md:h-6" />
          </div>
        </motion.header>

        <div className="relative group">
          <Search className="absolute left-6 md:left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-accent md:text-text-disabled opacity-40 md:opacity-100 transition-opacity" />
          <input
            type="text"
            placeholder="Search pending requests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-16 md:pl-14 pr-8 md:pr-6 py-5 rounded-[1.5rem] md:rounded-theme-lg font-black md:font-bold outline-none border border-border md:border-transparent transition-all shadow-inner bg-card text-text-primary focus:border-accent md:focus:border-transparent"
          />
        </div>

        <div className="space-y-6 md:space-y-4">
          {loading ? (
            <div className="py-20 text-center animate-pulse flex flex-col items-center gap-6 md:gap-4">
              <div className="w-12 h-12 border-4 border-border border-t-accent rounded-full animate-spin mx-auto" />
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40 md:opacity-100" style={{ color: theme.colors.textDisabled }}>Loading requests...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="py-24 md:py-24 text-center rounded-[2.5rem] md:rounded-theme-lg border-2 border-dashed shadow-inner bg-background-secondary md:bg-background-secondary/30" style={{ borderColor: theme.colors.border }}>
              <p className="font-black uppercase text-sm md:text-xs tracking-widest opacity-30 md:opacity-100" style={{ color: theme.colors.textDisabled }}>{searchTerm ? 'No matches found' : 'No pending approvals'}</p>
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
                  className="p-6 md:p-6 rounded-[2rem] md:rounded-theme-lg border flex flex-col md:flex-row justify-between items-start md:items-center gap-8 md:gap-6 shadow-theme-card hover:shadow-theme-elevated transition-all bg-card"
                  style={{ borderColor: theme.colors.border }}
                >
                  <div className="flex items-center gap-6 md:gap-5">
                    <div className="w-16 h-16 md:w-14 md:h-14 rounded-[1.25rem] md:rounded-theme-md flex items-center justify-center shadow-inner bg-background-secondary border border-border md:border-0 transition-transform duration-500">
                      <UserIcon className="w-8 h-8 md:w-6 md:h-6 text-accent opacity-60 md:opacity-100" />
                    </div>
                    <div>
                      <h3 className="text-xl md:text-lg font-black italic uppercase tracking-tighter md:tracking-tight text-text-primary leading-tight">{req.username || 'Anonymous'}</h3>
                      <p className="text-[11px] md:text-[10px] font-black md:font-bold uppercase md:normal-case tracking-widest md:tracking-normal opacity-40 md:opacity-60 mb-3 md:mb-2" style={{ color: theme.colors.textDisabled }}>{req.email}</p>
                      <div className="flex items-center gap-4 md:gap-3">
                        <span className="px-4 py-1.5 md:px-3 md:py-1 rounded-xl md:rounded-full text-[9px] md:text-[8px] font-black uppercase tracking-[0.2em] md:tracking-widest border shadow-sm italic md:not-italic"
                          style={{ backgroundColor: `${theme.colors.accent}15`, borderColor: `${theme.colors.accent}30`, color: theme.colors.accent }}>{req.role}</span>
                        <span className="flex items-center gap-2 md:gap-1.5 text-[9px] md:text-[8px] font-black uppercase tracking-widest opacity-50 md:opacity-100" style={{ color: theme.colors.textDisabled }}>
                          <Clock className="w-3.5 h-3.5 md:w-3 md:h-3 text-accent md:text-text-disabled" /> {new Date(req.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 md:gap-3 w-full md:w-auto">
                    <LoadingButton
                      loading={approvalAction.isPending && approvalAction.variables?.status === 'approved' && approvalAction.variables?.id === req.id}
                      onClick={() => handleAction(req.id, 'approved', req.role)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-3 md:gap-2 px-8 py-4 md:px-6 md:py-3 rounded-2xl md:rounded-theme-md text-[10px] font-black uppercase tracking-widest text-white shadow-theme-elevated active:translate-y-1 md:active:translate-y-0.5"
                      style={{ backgroundColor: theme.colors.success }}
                      loadingText="APPROVING..."
                      icon={<CheckCircle2 className="w-4 h-4" />}
                    >
                      Approve
                    </LoadingButton>
                    <LoadingButton
                      loading={approvalAction.isPending && approvalAction.variables?.status === 'rejected' && approvalAction.variables?.id === req.id}
                      onClick={() => handleAction(req.id, 'rejected', req.role)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-3 md:gap-2 px-8 py-4 md:px-6 md:py-3 rounded-2xl md:rounded-theme-md text-[10px] font-black uppercase tracking-widest text-white shadow-theme-elevated active:translate-y-1 md:active:translate-y-0.5"
                      style={{ backgroundColor: theme.colors.error }}
                      loadingText="REJECTING..."
                      icon={<XCircle className="w-4 h-4" />}
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

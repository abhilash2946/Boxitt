import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Wallet, Smartphone, Banknote, QrCode, CreditCard, Landmark, ShieldCheck, ArrowRight } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { forceScrollTop } from '../utils/scroll';

interface PaymentPageProps {
  amount: number;
  bookingId: string;
  locationName: string;
  courtName?: string;
  date?: string;
  slotTime?: string;
  totalFee?: number;
  onBack: () => void;
  onPay: () => void;
  isLoading?: boolean;
}

const PaymentPage: React.FC<PaymentPageProps> = ({
  amount,
  bookingId,
  locationName,
  courtName,
  date,
  slotTime,
  totalFee,
  onBack,
  onPay,
  isLoading
}) => {
  useEffect(() => {
    return forceScrollTop();
  }, []);
  const { theme } = useTheme();

  const paymentOptions = [
    { id: 'phonepe', name: 'PhonePe', icon: <Wallet className="w-5 h-5" /> },
    { id: 'gpay', name: 'Google Pay', icon: <Smartphone className="w-5 h-5" /> },
    { id: 'paytm', name: 'Paytm', icon: <Banknote className="w-5 h-5" /> },
  ];

  const otherOptions = [
    { id: 'upi', name: 'Pay by any UPI App', desc: 'GPay, PhonePe, WhatsApp & more', icon: <QrCode className="w-5 h-5" /> },
    { id: 'card', name: 'Debit / Credit Card', desc: 'Visa, Mastercard, RuPay & more', icon: <CreditCard className="w-5 h-5" /> },
    { id: 'netbanking', name: 'Net Banking', desc: 'All Indian Banks', icon: <Landmark className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center bg-background" style={{ backgroundColor: theme.colors.background }}>
      <div className="w-full max-w-md flex flex-col relative bg-transparent">
        {/* Header */}
        <header className="px-6 py-4 flex items-center gap-4 border-b bg-inherit shrink-0 z-20" style={{ borderColor: `${theme.colors.border}40` }}>
          <button onClick={onBack} className="p-2 hover:bg-black/5 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6" style={{ color: theme.colors.textPrimary }} />
          </button>
          <h1 className="text-xl font-bold" style={{ color: theme.colors.textPrimary }}>Payment</h1>
        </header>

        {/* Content */}
        <main className="flex-1 px-6 py-6">
          {/* Amount Card */}
          <div
            className="rounded-[2.5rem] p-8 mb-8 relative overflow-hidden shadow-sm"
            style={{ backgroundColor: theme.colors.cardElevated || '#DCEDC8' }}
          >
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1" style={{ color: theme.colors.textPrimary }}>Amount Payable</p>
              <h2 className="text-4xl font-black mb-4" style={{ color: theme.colors.textPrimary }}>₹{(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h2>
              <div className="space-y-1">
                <p className="text-[11px] font-bold opacity-80" style={{ color: theme.colors.textPrimary }}>Booking ID: #{bookingId}</p>
                <p className="text-[11px] font-bold opacity-80" style={{ color: theme.colors.textPrimary }}>{locationName}{courtName ? `, ${courtName}` : ''}</p>
              </div>

              <div className="mt-6 pt-6 border-t border-black/5 grid grid-cols-2 gap-4">
                {date && (
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-50" style={{ color: theme.colors.textPrimary }}>Date</p>
                    <p className="text-xs font-black" style={{ color: theme.colors.textPrimary }}>{new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  </div>
                )}
                {slotTime && (
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-50" style={{ color: theme.colors.textPrimary }}>Time Slot</p>
                    <p className="text-xs font-black" style={{ color: theme.colors.textPrimary }}>{slotTime}</p>
                  </div>
                )}
                {totalFee !== undefined && (
                  <div className="col-span-2">
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-50" style={{ color: theme.colors.textPrimary }}>Total Arena Fee</p>
                    <p className="text-xs font-black" style={{ color: theme.colors.textPrimary }}>₹{totalFee.toLocaleString('en-IN')}</p>
                  </div>
                )}
              </div>
            </div>
            {/* Decorative background elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-black/5 rounded-full -mr-16 -mt-16" />
            <div className="absolute bottom-0 right-8 w-12 h-24 bg-black/5 rounded-full rotate-45 transform translate-y-8" />
          </div>

          {/* Preferred Payments */}
          <section className="mb-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 opacity-60" style={{ color: theme.colors.textPrimary }}>Preferred Payments</h3>
            <div className="bg-white rounded-[2rem] border overflow-hidden shadow-sm" style={{ borderColor: theme.colors.border }}>
              {paymentOptions.map((opt, i) => (
                <button
                  key={opt.id}
                  className={`w-full flex items-center justify-between p-5 hover:bg-black/5 transition-colors ${i !== paymentOptions.length - 1 ? 'border-b' : ''}`}
                  style={{ borderColor: theme.colors.border }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.accent }}>
                      {opt.icon}
                    </div>
                    <span className="font-bold text-sm" style={{ color: theme.colors.textPrimary }}>{opt.name}</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 rotate-180 opacity-40" style={{ color: theme.colors.textPrimary }} />
                </button>
              ))}
            </div>
          </section>

          {/* Other Payment Options */}
          <section className="mb-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 opacity-60" style={{ color: theme.colors.textPrimary }}>Other Payment Options</h3>
            <div className="space-y-3">
              {otherOptions.map((opt) => (
                <button
                  key={opt.id}
                  className="w-full flex items-center gap-4 p-5 bg-white rounded-3xl border hover:bg-black/5 transition-colors text-left shadow-sm"
                  style={{ borderColor: theme.colors.border }}
                >
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.accent }}>
                    {opt.icon}
                  </div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: theme.colors.textPrimary }}>{opt.name}</p>
                    <p className="text-[10px] opacity-60 font-medium" style={{ color: theme.colors.textPrimary }}>{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Footer content moved inside scrollable area */}
          <div className="mt-12 mb-32 p-6 bg-white border rounded-[2.5rem] shadow-theme-card" style={{ borderColor: theme.colors.border }}>
            <div className="flex items-center justify-center gap-2 mb-4 opacity-60">
              <ShieldCheck className="w-4 h-4" style={{ color: theme.colors.textPrimary }} />
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: theme.colors.textPrimary }}>100% Secure Payments</span>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onPay}
              disabled={isLoading}
              className="w-full py-5 rounded-[1.5rem] font-black text-lg flex items-center justify-center gap-3 shadow-xl transition-all"
              style={{
                background: `linear-gradient(to right, ${theme.colors.buttonGradient[0]}, ${theme.colors.buttonGradient[1]})`,
                color: 'white'
              }}
            >
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Pay Now ₹{(amount || 0).toLocaleString('en-IN')}</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </motion.button>
          </div>
        </main>
      </div>
    </div>

  );
};

export default PaymentPage;

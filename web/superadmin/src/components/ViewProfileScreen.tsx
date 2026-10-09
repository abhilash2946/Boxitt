import { useState } from 'react';
import {
	ChevronLeft,
	User,
	Mail,
	Phone,
	Calendar,
	Home,
	MapPin,
	Lock,
	LogOut,
	ShieldCheck,
	ChevronRight,
	Share2,
	Edit3
} from 'lucide-react';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import ChangePasswordModal from './ChangePasswordModal';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeSelector } from './ThemeSelector';

interface ViewProfileScreenProps {
	profile: UserProfile;
	onEdit: () => void;
	onLogout?: () => void;
	onBack?: () => void;
	onAlert?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const ProfileItem = ({ icon: Icon, label, value, onClick }: any) => {
	const { theme } = useTheme();
	return (
		<motion.button
			whileHover={{ x: 10, backgroundColor: `${theme.colors.accent}08` }}
			onClick={onClick}
			className="w-full flex items-center justify-between p-[4vw] md:p-4 rounded-theme-md border transition-all group shadow-theme-card"
			style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.card }}
		>
			<div className="flex items-center gap-[4vw] md:gap-4">
				<div className="w-[var(--btn-height)] h-[var(--btn-height)] md:w-12 md:h-12 rounded-theme-sm flex items-center justify-center shadow-theme-elevated border transition-transform group-hover:rotate-12"
					style={{
						backgroundColor: `${theme.colors.accent}15`,
						color: theme.colors.accent,
						borderColor: `${theme.colors.accent}20`
					}}>
					<Icon className="w-[var(--icon-size)] h-[var(--icon-size)] md:w-6 md:h-6" />
				</div>
				<div className="text-left min-w-0 flex-1">
					<p className="text-[2.2vw] md:text-xs font-black uppercase tracking-[0.3em] mb-[1vw] md:mb-1 dynamic-text" style={{ color: theme.colors.textDisabled }}>{label}</p>
					<p className="text-[3.8vw] md:text-base font-black italic tracking-tight dynamic-text" style={{ color: theme.colors.textPrimary }}>{value || '---'}</p>
				</div>
			</div>
			<ChevronRight className="w-[4vw] h-[4vw] md:w-5 md:h-5 transition-colors" style={{ color: theme.colors.textDisabled }} />
		</motion.button>
	);
};

export default function ViewProfileScreen({ profile, onEdit, onLogout, onBack, onAlert }: ViewProfileScreenProps) {
	const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
	const { theme } = useTheme();

	const handleShare = async () => {
		const shareData = {
			title: 'Boxitt Profile',
			text: `Check out my profile on Boxitt!`,
			url: window.location.href,
		};
		try {
			if (navigator.share) await navigator.share(shareData);
			else {
				await navigator.clipboard.writeText(window.location.href);
				onAlert?.('Profile link copied!', 'success');
			}
		} catch (err) { }
	};

	const displayPhone = profile.phone_number || profile.phone || '---';
	const displayUsername = profile.display_name || profile.username || profile.email?.split('@')[0] || '---';
	const displayJoinedDate = profile.joined_date || profile.joinedDate || (profile as any).created_at || '---';

	return (
		<div className="min-h-screen pb-[20vw] md:pb-20 relative overflow-x-hidden transition-colors duration-300"
			style={{ backgroundColor: theme.colors.background }}>
			{/* Background Decorative Elements */}
			<div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none opacity-20"
				style={{ backgroundColor: theme.colors.accent }} />
			<div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none opacity-20"
				style={{ backgroundColor: theme.colors.success }} />

			<motion.div
				initial={{ y: -20, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				className="px-[var(--fluid-padding)] py-[var(--fluid-padding)] md:px-8 md:py-8 flex items-center justify-between relative z-50 max-w-4xl mx-auto"
			>
				<button
					onClick={onBack}
					className="p-[3vw] md:p-3 rounded-theme-md border transition-all shadow-theme-card active:translate-y-0.5"
					style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.textPrimary }}
				>
					<ChevronLeft className="w-[var(--icon-size)] h-[var(--icon-size)] md:w-6 md:h-6" />
				</button>

				<div className="flex items-center gap-[3vw] md:gap-4">
					<ThemeSelector />
					<button
						onClick={handleShare}
						className="p-[3vw] md:p-3 rounded-theme-md border transition-all shadow-theme-card active:translate-y-0.5"
						style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.textPrimary }}
					>
						<Share2 className="w-[var(--icon-size)] h-[var(--icon-size)] md:w-6 md:h-6" />
					</button>
				</div>
			</motion.div>

			<div className="max-w-xl mx-auto px-[var(--fluid-padding)] md:px-0 relative z-10 space-y-[var(--fluid-padding)] md:space-y-12">
				<div className="text-center">
					<h1 className="text-[var(--font-title)] md:text-3xl font-black italic uppercase tracking-tighter" style={{ color: theme.colors.textPrimary }}>My Profile</h1>
				</div>

				{/* Profile Card */}
				<motion.div
					initial={{ scale: 0.9, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					whileHover={{ y: -4 }}
					className="backdrop-blur-3xl border p-[var(--fluid-padding)] md:p-10 flex flex-col items-center relative group transition-all duration-300"
					style={{
						backgroundColor: theme.colors.card,
						borderColor: theme.colors.border,
						borderRadius: theme.radius.large,
						boxShadow: theme.elevation.card
					}}
				>
					<div className="absolute top-0 right-0 w-[30vw] h-[30vw] blur-3xl rounded-full opacity-10" style={{ backgroundColor: theme.colors.accent }} />

					<div className="relative mb-[6vw] md:mb-8">
						<div className="w-[32vw] h-[32vw] md:w-40 md:h-40 rounded-theme-lg border-4 p-[1.5vw] md:p-2 shadow-2xl rotate-3 transition-transform group-hover:rotate-0"
							style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.backgroundSecondary }}>
							{profile.profileImage || profile.avatar_url ? (
								<img
									src={profile.profileImage || profile.avatar_url}
									alt="Profile"
									className="w-full h-full object-cover rounded-theme-md"
									referrerPolicy="no-referrer"
								/>
							) : (
								<div className="w-full h-full flex items-center justify-center" style={{ color: theme.colors.textDisabled }}>
									<User className="w-[var(--btn-height)] h-[var(--btn-height)] md:w-16 md:h-16" />
								</div>
							)}
						</div>
						<div className="absolute -bottom-[1vw] -right-[1vw] w-[var(--icon-size)] h-[var(--icon-size)] md:w-8 md:h-8 rounded-full border-4 shadow-lg"
							style={{ backgroundColor: theme.colors.success, borderColor: theme.colors.card }} />
					</div>

					<div className="text-center space-y-[2vw] md:space-y-2 w-full px-4">
						<h2 className="text-[var(--font-title)] md:text-4xl font-black italic uppercase tracking-tighter leading-tight dynamic-text" style={{ color: theme.colors.textPrimary }}>{displayUsername}</h2>
						<div className="flex items-center justify-center gap-[2vw] md:gap-2">
							<ShieldCheck className="w-[4vw] h-[4vw] md:w-5 md:h-5" style={{ color: theme.colors.accent }} />
							<span className="text-[2.5vw] md:text-xs font-black uppercase tracking-[0.2em] px-[4vw] py-[1.5vw] md:px-4 md:py-1.5 rounded-full border shadow-sm"
								style={{
									color: theme.colors.accent,
									backgroundColor: `${theme.colors.accent}15`,
									borderColor: `${theme.colors.accent}30`
								}}>
								{profile.role || 'User'}
							</span>
						</div>
					</div>
				</motion.div>

				{/* Action Buttons */}
				<div className="grid grid-cols-2 gap-[4vw] md:gap-6">
					<motion.button
						whileHover={{ scale: 1.05 }}
						whileTap={{ scale: 0.95 }}
						onClick={onEdit}
						className="text-white font-black uppercase tracking-[0.1em] text-[2.8vw] md:text-sm py-[4vw] md:py-4 rounded-theme-md flex items-center justify-center gap-[3vw] md:gap-3 shadow-theme-elevated"
						style={{
							background: `linear-gradient(to right, ${theme.colors.buttonGradient[0]}, ${theme.colors.buttonGradient[1]})`,
						}}
					>
						<Edit3 className="w-[4vw] h-[4vw] md:w-5 md:h-5" />
						Edit Profile
					</motion.button>
					<motion.button
						whileHover={{ scale: 1.05 }}
						whileTap={{ scale: 0.95 }}
						onClick={onLogout}
						className="font-black uppercase tracking-[0.1em] text-[2.8vw] md:text-sm py-[4vw] md:py-4 rounded-theme-md border flex items-center justify-center gap-[3vw] md:gap-3 transition-all shadow-theme-card active:translate-y-0.5"
						style={{ color: theme.colors.error, borderColor: `${theme.colors.error}40`, backgroundColor: theme.colors.card }}
					>
						<LogOut className="w-[4vw] h-[4vw] md:w-5 md:h-5" />
						Logout
					</motion.button>
				</div>

				{/* Info Sections */}
				<div className="space-y-[var(--fluid-padding)] md:space-y-12">
					<section className="space-y-[4vw] md:space-y-4">
						<div className="flex items-center gap-[4vw] px-[4vw] md:px-0">
							<h3 className="text-[2.8vw] md:text-xs font-black uppercase tracking-[0.3em]" style={{ color: theme.colors.textDisabled }}>Personal Information</h3>
							<div className="h-px flex-1" style={{ backgroundColor: theme.colors.border }} />
						</div>
						<div className="grid gap-[3vw] md:gap-4">
							<ProfileItem icon={User} label="Username" value={displayUsername} />
							<ProfileItem icon={Calendar} label="Date of Birth" value={profile.dob} />
							<ProfileItem icon={Home} label="Full Address" value={profile.address} />
							<ProfileItem icon={MapPin} label="City / Region" value={profile.location} />
						</div>
					</section>

					<section className="space-y-[4vw] md:space-y-4">
						<div className="flex items-center gap-[4vw] px-[4vw] md:px-0">
							<h3 className="text-[2.8vw] md:text-xs font-black uppercase tracking-[0.3em]" style={{ color: theme.colors.textDisabled }}>Contact Details</h3>
							<div className="h-px flex-1" style={{ backgroundColor: theme.colors.border }} />
						</div>
						<div className="grid gap-[3vw] md:gap-4">
							<ProfileItem icon={Mail} label="Email Address" value={profile.email} />
							<ProfileItem icon={Phone} label="Phone Number" value={displayPhone} />
							<ShieldCheck className="w-[4vw] h-[4vw] hidden" /> {/* Hidden but kept for spacing ref */}
							<ProfileItem icon={ShieldCheck} label="Member Since" value={displayJoinedDate} />
						</div>
					</section>

					<section className="space-y-[4vw] md:space-y-4 pb-[10vw] md:pb-20">
						<div className="flex items-center gap-[4vw] px-[4vw] md:px-0">
							<h3 className="text-[2.8vw] md:text-xs font-black uppercase tracking-[0.3em]" style={{ color: theme.colors.textDisabled }}>Account Security</h3>
							<div className="h-px flex-1" style={{ backgroundColor: theme.colors.border }} />
						</div>
						<div className="grid gap-[3vw] md:gap-4">
							<ProfileItem icon={Lock} label="Password" value="Update Password" onClick={() => setIsPasswordModalOpen(true)} />
						</div>
					</section>
				</div>
			</div>

			<AnimatePresence>
				{isPasswordModalOpen && (
					<ChangePasswordModal
						userEmail={profile.email}
						onClose={() => setIsPasswordModalOpen(false)}
						onAlert={onAlert}
					/>
				)}
			</AnimatePresence>
		</div>
	);
}

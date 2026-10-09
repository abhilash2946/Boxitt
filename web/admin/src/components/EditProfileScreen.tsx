import { ChevronLeft, Camera, User, Mail, Phone, Calendar, Home, Image as ImageIcon, MapPin, Shield, CheckCircle2, Trash2, Search } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { UserProfile } from '../types';
import CameraCaptureModal from './CameraCaptureModal';
import { DatePickerModal } from './CustomPickers';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';
import { usePermissions } from '../hooks/usePermissions';
import { supabaseStorage } from '../services/supabaseStorage';
import LoadingButton from './LoadingButton';
import { getLocalISODate } from '../constants';
import { geocodingService } from '../services/geocodingService';

interface EditProfileScreenProps {
	profile: UserProfile;
	onBack: () => void;
	onSave: (profile: UserProfile) => void;
	onSkip?: () => void;
	onChange?: (profile: UserProfile) => void;
	onAlert?: (message: string, type: 'success' | 'error' | 'info') => void;
	isSaving?: boolean;
}

export default function EditProfileScreen({ profile, onBack, onSave, onSkip, onChange, onAlert, isSaving }: EditProfileScreenProps) {
	const { theme } = useTheme();
	const { checkAndPrompt, permissions } = usePermissions();
	const getTodayDateString = () => {
		return getLocalISODate();
	};

	const mapProfileToForm = (incoming: UserProfile): UserProfile => {
		const safeValue = (v1: any, v2: any) => {
			const val = v1 || v2 || '';
			return (val === 'null' || val === 'undefined') ? '' : val;
		};

		return {
			...incoming,
			joinedDate: safeValue(incoming.joinedDate, incoming.joined_date) || getTodayDateString(),
			profileImage: safeValue(incoming.profileImage, incoming.avatar_url),
			dob: safeValue((incoming as any).dob, (incoming as any).date_of_birth),
			phone: safeValue(incoming.phone, incoming.phone_number),
			username: safeValue(incoming.username, (incoming as any).display_name),
			address: incoming.address || '',
			location: incoming.location || '',
			gender: incoming.gender || '',
		};
	};

	const [form, setForm] = useState<UserProfile>(mapProfileToForm(profile));
	const prevProfileRef = useRef<UserProfile>(profile);

	// Sync form with profile prop when it changes (e.g. after Supabase fetch)
	useEffect(() => {
		// Only sync if the profile object itself has actually changed
		if (JSON.stringify(profile) !== JSON.stringify(prevProfileRef.current)) {
			setForm(prev => {
				const incoming = mapProfileToForm(profile);

				// Helper to count non-empty fields
				const countFilled = (p: any) => {
					return ['username', 'phone', 'address', 'location', 'dob', 'gender', 'profileImage']
						.filter(f => p[f] && String(p[f]).trim() !== '').length;
				};

				// If the incoming profile has more data than current form, merge it
				// This handles the transition from "bare bones" auth user to "full" Supabase profile
				if (countFilled(incoming) > countFilled(prev)) {
					return { ...prev, ...incoming };
				}

				// If IDs are different (e.g. switched user), reset completely
				if (prev.id !== profile.id) {
					return incoming;
				}

				return prev;
			});
			prevProfileRef.current = profile;
		}
	}, [profile]);

	const handleFieldChange = (field: keyof UserProfile, value: string) => {
		let newValue = value;
		if (field === 'phone') {
			newValue = value.replace(/\D/g, '').slice(0, 10);
		}

		const updatedForm = { ...form, [field]: newValue };
		setForm(updatedForm);
		if (onChange) onChange(updatedForm);
	};

	const isFormComplete = [
		form.email,
		form.username,
		form.phone,
		form.dob,
		form.gender,
		form.address,
	].every((value) => String(value || '').trim() !== '') && String(form.phone || '').trim().length === 10;

	const handleSaveClick = () => {
		if (!isFormComplete) {
			onAlert?.('Fill all the fields', 'error');
			return;
		}
		onSave(form);
	};

	const [uploading, setUploading] = useState(false);
	const [showOptions, setShowOptions] = useState(false);
	const [showCamera, setShowCamera] = useState(false);
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [locating, setLocating] = useState(false);
	const [isVerifying, setIsVerifying] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (file.size > 2 * 1024 * 1024) {
			onAlert?.(`Image ${file.name} too large (Max 2MB).`, 'error');
			return;
		}
		setUploading(true);
		const reader = new FileReader();
		reader.onloadend = () => {
			const imgData = reader.result as string;
			const updated = { ...form, profileImage: imgData };
			setForm(updated);
			if (onChange) onChange(updated);
			setUploading(false);
			setShowOptions(false);
		};
		reader.readAsDataURL(file);
	};

	const handleCapture = async (blob: Blob) => {
		setUploading(true);
		const reader = new FileReader();
		reader.onloadend = () => {
			const imgData = reader.result as string;
			const updated = { ...form, profileImage: imgData };
			setForm(updated);
			if (onChange) onChange(updated);
			setUploading(false);
			setShowCamera(false);
		};
		reader.readAsDataURL(blob);
	};

	const getCurrentAddress = async () => {
		if (permissions.location !== 'allow') {
			await checkAndPrompt('location', true);
			return;
		}
		if (!navigator.geolocation) return;
		setLocating(true);
		navigator.geolocation.getCurrentPosition(
			async (position) => {
				const { latitude, longitude } = position.coords;
				try {
					const res = await geocodingService.reverseGeocode(latitude, longitude);
					if (res) {
						const addr = res.rawAddress;
						const newLocation = addr.locality || addr.village || addr.suburb || addr.neighbourhood || addr.city || '';
						const updated = { ...form, address: res.fullAddress || res.address, location: newLocation || form.location };
						setForm(updated);
						if (onChange) onChange(updated);
					}
				} catch (error) { console.error(error); } finally { setLocating(false); }
			},
			() => { setLocating(false); }
		);
	};

	return (
		<div className="min-h-screen py-[var(--fluid-padding)] px-[var(--fluid-padding)] relative overflow-x-hidden transition-all duration-300"
			style={{ backgroundColor: theme.colors.background }}>
			{/* Background Decor */}
			<div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none opacity-20" style={{ backgroundColor: theme.colors.accent }} />
			<div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none opacity-20" style={{ backgroundColor: theme.colors.success }} />

			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				className="w-full max-w-2xl mx-auto backdrop-blur-3xl p-[var(--fluid-padding)] md:p-10 border relative z-10 transition-all duration-300"
				style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radius.large, boxShadow: theme.elevation.modal }}
			>
				<div className="flex items-center justify-between w-full mb-[var(--fluid-padding)] md:mb-10">
					<motion.button
						whileTap={{ scale: 0.9 }} onClick={onBack}
						className="p-[3vw] md:p-3 rounded-theme-md border shadow-theme-card"
						style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border, color: theme.colors.textPrimary }}
					>
						<ChevronLeft className="w-[var(--icon-size)] h-[var(--icon-size)] md:w-6 md:h-6" />
					</motion.button>
					<h1 className="text-[var(--font-title)] md:text-3xl font-black italic uppercase tracking-tighter" style={{ color: theme.colors.textPrimary }}>Edit <span style={{ color: theme.colors.accent }}>Profile</span></h1>
					<div className="w-[var(--btn-height)] md:w-12" />
				</div>

				<div className="flex flex-col items-center mb-[var(--fluid-padding)] md:mb-10">
					<div className="relative group">
						<div className="w-[32vw] h-[32vw] md:w-40 md:h-40 rounded-[var(--fluid-radius)] md:rounded-2xl border-4 shadow-theme-card flex items-center justify-center rotate-3 transition-all group-hover:rotate-0"
							style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.backgroundSecondary }}>
							{uploading ? (
                                <div className="w-[8vw] h-[8vw] md:w-10 md:h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: theme.colors.accent }} />
                            ) : (form.profileImage) ? (
                                <img src={form.profileImage} alt="P" className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-[16vw] h-[16vw] md:w-20 md:h-20" style={{ color: theme.colors.textDisabled }} />
                            )}
						</div>
						<motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setShowOptions(true)}
							className="absolute -bottom-[1vw] -right-[1vw] p-[3vw] md:p-3 rounded-[3vw] md:rounded-xl border-2 shadow-theme-elevated text-white z-20 transition-all active:translate-y-1"
							style={{ backgroundColor: theme.colors.accent, borderColor: theme.colors.card }}>
							<Camera className="w-[5vw] h-[5vw] md:w-5 md:h-5" />
						</motion.button>
						{form.profileImage && (
							<motion.button
								whileHover={{ scale: 1.1 }}
								whileTap={{ scale: 0.9 }}
								onClick={() => {
									const updated = { ...form, profileImage: '' };
									setForm(updated);
									if (onChange) onChange(updated);
								}}
								className="absolute -bottom-[1vw] -left-[1vw] p-[3vw] md:p-3 rounded-[3vw] md:rounded-xl border-2 shadow-theme-elevated text-white z-20 transition-all active:translate-y-1"
								style={{ backgroundColor: theme.colors.error, borderColor: theme.colors.card }}
							>
								<Trash2 className="w-[5vw] h-[5vw] md:w-5 md:h-5" />
							</motion.button>
						)}
					</div>
					<button onClick={() => setShowOptions(true)} className="mt-[4vw] md:mt-4 text-[2.5vw] md:text-xs font-black uppercase tracking-[0.3em] transition-colors" style={{ color: theme.colors.accent }}>Update Profile Picture</button>
				</div>

				<input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />

				<div className="space-y-[6vw] md:space-y-6 w-full">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--fluid-padding)] md:gap-6">
						<div className="space-y-[2vw] md:space-y-2">
							<label className="text-[2.2vw] md:text-xs font-black uppercase tracking-widest ml-1" style={{ color: theme.colors.textDisabled }}>Email Address</label>
							<div className="relative group">
								<Mail className="absolute left-[4vw] md:left-5 top-1/2 -translate-y-1/2 w-[4vw] h-[4vw] md:w-5 md:h-5 opacity-30" style={{ color: theme.colors.textPrimary }} />
								<input type="email" className="w-full border-2 border-transparent rounded-[4vw] md:rounded-2xl pl-[12vw] md:pl-14 pr-[4vw] py-[4vw] md:py-3 font-bold text-[3.8vw] md:text-base outline-none transition-all shadow-inner" style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary }} value={form.email || ''} onChange={e => handleFieldChange('email', e.target.value)} />
							</div>
						</div>
						<div className="space-y-[2vw] md:space-y-2">
							<label className="text-[2.2vw] md:text-xs font-black uppercase tracking-widest ml-1" style={{ color: theme.colors.textDisabled }}>Username</label>
							<div className="relative group">
								<User className="absolute left-[4vw] md:left-5 top-1/2 -translate-y-1/2 w-[4vw] h-[4vw] md:w-5 md:h-5 opacity-30" style={{ color: theme.colors.textPrimary }} />
								<input type="text" className="w-full border-2 border-transparent rounded-[4vw] md:rounded-2xl pl-[12vw] md:pl-14 pr-[4vw] py-[4vw] md:py-3 font-bold text-[3.8vw] md:text-base outline-none transition-all shadow-inner" style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary }} value={form.username || ''} onChange={e => handleFieldChange('username', e.target.value)} />
							</div>
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--fluid-padding)] md:gap-6">
						<div className="space-y-[2vw] md:space-y-2">
							<label className="text-[2.2vw] md:text-xs font-black uppercase tracking-widest ml-1" style={{ color: theme.colors.textDisabled }}>Phone Number</label>
							<div className="relative group">
								<Phone className="absolute left-[4vw] md:left-5 top-1/2 -translate-y-1/2 w-[4vw] h-[4vw] md:w-5 md:h-5 opacity-30" style={{ color: theme.colors.textPrimary }} />
								<input type="tel" maxLength={10} className="w-full border-2 border-transparent rounded-[4vw] md:rounded-2xl pl-[12vw] md:pl-14 pr-[4vw] py-[4vw] md:py-3 font-bold text-[3.8vw] md:text-base outline-none transition-all shadow-inner" style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary }} value={form.phone || ''} onChange={e => handleFieldChange('phone', e.target.value)} />
							</div>
						</div>
						<div className="space-y-[2vw] md:space-y-2">
							<label className="text-[2.2vw] md:text-xs font-black uppercase tracking-widest ml-1" style={{ color: theme.colors.textDisabled }}>Date of Birth</label>
							<div className="relative">
								<button onClick={() => setShowDatePicker(true)} className="w-full border-2 border-transparent rounded-[4vw] md:rounded-2xl pl-[12vw] md:pl-14 pr-[4vw] py-[4vw] md:py-3 font-black text-left text-[3.8vw] md:text-base outline-none transition-all shadow-inner relative" style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary }}>
									<Calendar className="absolute left-[4vw] md:left-5 top-1/2 -translate-y-1/2 w-[4vw] h-[4vw] md:w-5 md:h-5 opacity-30" />
									{form.dob || 'Select Date'}
								</button>
							</div>
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--fluid-padding)] md:gap-6">
						<div className="space-y-[2vw] md:space-y-2">
							<label className="text-[2.2vw] md:text-xs font-black uppercase tracking-widest ml-1" style={{ color: theme.colors.textDisabled }}>Gender</label>
							<select className="w-full border-2 border-transparent rounded-[4vw] md:rounded-2xl px-[4vw] md:px-4 py-[4vw] md:py-3 font-bold text-[3.8vw] md:text-base outline-none transition-all shadow-inner appearance-none" style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary }} value={form.gender || ''} onChange={e => handleFieldChange('gender', e.target.value)}>
								<option value="" style={{ backgroundColor: theme.colors.backgroundSecondary }}>Select</option>
								<option value="Male" style={{ backgroundColor: theme.colors.backgroundSecondary }}>Male</option>
								<option value="Female" style={{ backgroundColor: theme.colors.backgroundSecondary }}>Female</option>
								<option value="Other" style={{ backgroundColor: theme.colors.backgroundSecondary }}>Other</option>
							</select>
						</div>
						<div className="space-y-[2vw] md:space-y-2">
							<label className="text-[2.2vw] md:text-xs font-black uppercase tracking-widest ml-1" style={{ color: theme.colors.textDisabled }}>Account Role</label>
							<div className="relative group">
								<Shield className="absolute left-[4vw] md:left-5 top-1/2 -translate-y-1/2 w-[4vw] h-[4vw] md:w-5 md:h-5 opacity-30" />
								<div className="w-full border-2 border-transparent rounded-[4vw] md:rounded-2xl pl-[12vw] md:pl-14 pr-[4vw] py-[4vw] md:py-3 font-black text-[3.8vw] md:text-base outline-none transition-all shadow-inner bg-background-secondary text-text-primary uppercase italic tracking-tighter">
									Admin
								</div>
							</div>
						</div>
					</div>

					<div className="space-y-[4vw] md:space-y-4">
						<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-[2vw] md:gap-2">
							<label className="text-[2.2vw] md:text-xs font-black uppercase tracking-widest ml-1" style={{ color: theme.colors.textDisabled }}>Current Address</label>
							<button onClick={getCurrentAddress} disabled={locating} className="flex items-center gap-[2vw] text-[2.2vw] md:text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50" style={{ color: theme.colors.accent }}>
								{locating ? <div className="w-[3vw] h-[3vw] md:w-4 md:h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: theme.colors.accent }} /> : <MapPin className="w-[3vw] h-[3vw] md:w-4 md:h-4" />}
								{locating ? 'GPS...' : 'Use Current Location'}
							</button>
						</div>
						<div className="relative group">
							<textarea
								className="w-full border-2 border-transparent rounded-[var(--fluid-radius)] md:rounded-2xl p-[4vw] md:p-4 pr-[12vw] md:pr-12 font-bold text-[3.8vw] md:text-base outline-none transition-all min-h-[25vw] md:min-h-[100px] resize-none shadow-inner"
								style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary }}
								placeholder="Address..."
								value={form.address || ''}
								onChange={e => handleFieldChange('address', e.target.value)}
							/>
							<button
								onClick={async (e) => {
									e.preventDefault();
									if (!form.address || isVerifying) return;
									setIsVerifying(true);
									try {
										const result = await geocodingService.searchAddress(form.address);
										if (result) {
											const addr = result.addressDetails;
											const newLocation = addr.locality || addr.village || addr.suburb || addr.neighbourhood || addr.city || '';
											const updated = {
												...form,
												address: result.displayName,
												location: newLocation || form.location,
												latitude: result.latitude,
												longitude: result.longitude
											};
											setForm(updated);
											if (onChange) onChange(updated);
											onAlert?.('Location verified and updated!', 'success');
										} else {
											onAlert?.('No matching location found.', 'error');
										}
									} catch (err) {
										onAlert?.('Search failed. Please try again.', 'error');
									} finally {
										setIsVerifying(false);
									}
								}}
								disabled={isVerifying || locating || isSaving}
								className="absolute right-2 top-4 p-2 rounded-xl hover:bg-accent/10 text-accent transition-all active:scale-90 disabled:opacity-50"
								title="Verify Location"
							>
								{isVerifying ? <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /> : <Search className="w-5 h-5" />}
							</button>
						</div>
					</div>
				</div>

				<LoadingButton
					loading={isSaving}
					onClick={handleSaveClick}
					className="w-full mt-[var(--fluid-padding)] md:mt-10 py-[4vw] md:py-4 text-white rounded-[var(--fluid-radius)] md:rounded-2xl font-black uppercase tracking-[0.2em] text-[2.8vw] md:text-sm shadow-theme-elevated"
					style={{ background: `linear-gradient(to right, ${theme.colors.buttonGradient[0]}, ${theme.colors.buttonGradient[1]})` }}
					icon={<CheckCircle2 className="w-[4vw] h-[4vw] md:w-5 md:h-5" />}
				>
					Save Changes
				</LoadingButton>

				{onSkip && <button onClick={onSkip} className="w-full mt-[4vw] md:mt-4 text-[2.2vw] md:text-xs font-black uppercase tracking-widest transition-colors" style={{ color: theme.colors.textDisabled }}>Skip</button>}
			</motion.div>

			<DatePickerModal isOpen={showDatePicker} onClose={() => setShowDatePicker(false)} selectedDate={form.dob || ''} onSelect={(date) => handleFieldChange('dob', date)} maxDate={getTodayDateString()} />

			<AnimatePresence>
				{showOptions && (
					<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-6">
						<motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="border rounded-[2rem] md:rounded-[3rem] w-full max-w-sm p-8 md:p-12 text-center shadow-theme-modal transition-all"
							style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
							<h3 className="text-2xl md:text-3xl font-black uppercase italic mb-8 md:mb-10" style={{ color: theme.colors.textPrimary }}>Select Source</h3>
							<div className="grid grid-cols-2 gap-4 md:gap-6">
								<button onClick={() => { setShowOptions(false); setShowCamera(true); }} className="flex flex-col items-center gap-3 p-6 md:p-8 rounded-2xl md:rounded-3xl border transition-all shadow-theme-card active:translate-y-1 hover:bg-black/5" style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}>
									<Camera className="w-8 h-8 md:w-10 md:h-10" style={{ color: theme.colors.accent }} />
									<span className="text-[10px] md:text-xs font-black uppercase tracking-widest" style={{ color: theme.colors.textDisabled }}>Camera</span>
								</button>
								<button onClick={() => { setShowOptions(false); fileInputRef.current?.click(); }} className="flex flex-col items-center gap-3 p-6 md:p-8 rounded-2xl md:rounded-3xl border transition-all shadow-theme-card active:translate-y-1 hover:bg-black/5" style={{ backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border }}>
									<ImageIcon className="w-8 h-8 md:w-10 md:h-10" style={{ color: theme.colors.success }} />
									<span className="text-[10px] md:text-xs font-black uppercase tracking-widest" style={{ color: theme.colors.textDisabled }}>Gallery</span>
								</button>
							</div>
							<button onClick={() => setShowOptions(false)} className="mt-8 md:mt-10 text-[10px] md:text-xs font-black uppercase tracking-[0.2em]" style={{ color: theme.colors.textDisabled }}>Cancel</button>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

			{showCamera && <CameraCaptureModal onCapture={handleCapture} onClose={() => setShowCamera(false)} />}
		</div>
	);
}

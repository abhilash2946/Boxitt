import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export function InputGroup({ label, icon, placeholder, defaultValue }: { label: string, icon: React.ReactNode, placeholder: string, defaultValue?: string }) {
    const { theme } = useTheme();
	return (
		<div className="space-y-2">
			<label className="text-[10px] font-black uppercase tracking-widest ml-1" style={{ color: theme.colors.textDisabled }}>{label}</label>
			<div className="relative group">
				<input 
					type="text" 
					className="w-full border-2 border-transparent rounded-2xl px-5 py-4 text-sm font-bold outline-none transition-all shadow-inner"
                    style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.textPrimary }}
					placeholder={placeholder}
					defaultValue={defaultValue}
				/>
				<div className="absolute right-5 top-1/2 -translate-y-1/2 opacity-30" style={{ color: theme.colors.textPrimary }}>
					{icon}
				</div>
			</div>
		</div>
	);
}

export function ProfileSection({ title, children }: { title: string, children: React.ReactNode }) {
    const { theme } = useTheme();
	return (
		<div className="space-y-4">
			<h3 className="text-[11px] font-black uppercase tracking-[0.4em] ml-2" style={{ color: theme.colors.textDisabled }}>{title}</h3>
			<div className="rounded-theme-lg border overflow-hidden shadow-theme-card"
                 style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
				{children}
			</div>
		</div>
	);
}

export function ProfileItem({ icon, label, value, hasArrow, valueColor, onClick }: { icon: React.ReactNode, label?: string, value: string, hasArrow?: boolean, valueColor?: string, onClick?: () => void }) {
    const { theme } = useTheme();
	return (
		<div
			className="flex items-center gap-4 p-6 border-b last:border-0 hover:opacity-80 transition-all cursor-pointer group"
            style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
			onClick={onClick}
		>
			<div className="w-12 h-12 rounded-theme-sm flex items-center justify-center transition-all group-hover:rotate-12 group-hover:scale-110 shadow-theme-card border border-border"
                 style={{ backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.accent }}>
				{icon}
			</div>
			<div className="flex-1 min-w-0">
				{label && <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: theme.colors.textDisabled }}>{label}</p>}
				<p className={`text-sm font-black italic tracking-tight dynamic-text`} style={{ color: valueColor || theme.colors.textPrimary }}>{value}</p>
			</div>
			{hasArrow && <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" style={{ color: theme.colors.textDisabled }} />}
		</div>
	);
}

export function NavItem({ icon, label, active }: { icon: React.ReactNode, label: string, active?: boolean }) {
    const { theme } = useTheme();
	return (
		<button className={`flex flex-col items-center gap-1 transition-all ${active ? 'scale-110' : 'opacity-50 hover:opacity-100'}`}
                style={{ color: active ? theme.colors.accent : theme.colors.textDisabled }}>
			{icon}
			<span className="text-[8px] font-black uppercase tracking-tighter">{label}</span>
		</button>
	);
}

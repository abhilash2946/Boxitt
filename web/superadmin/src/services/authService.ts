import { supabase } from './supabase';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

function normalizeAuthError(error: any, fallbackMessage: string): string {
	const status = error?.status || error?.statusCode || error?.code;
	const directMessage =
		typeof error?.message === 'string' && error.message.trim().length > 0
			? error.message.trim()
			: (error as any)?.error_description && typeof (error as any).error_description === 'string'
				? (error as any).error_description.trim()
				: null;

	const serialized = !directMessage && error && typeof error === 'object'
		? (() => {
			try {
				return JSON.stringify(error);
			} catch {
				return null;
			}
		})()
		: null;

	const textForChecks = `${directMessage || ''} ${serialized || ''} ${error?.code || ''}`.toLowerCase();

	if (
		status === 504 ||
		textForChecks.includes('gateway timeout') ||
		textForChecks.includes('timed out') ||
		textForChecks.includes('timeout')
	) {
		return 'Email signup is temporarily unavailable due to a server timeout. Please try again in a minute or continue with Google sign-in.';
	}

	if (directMessage) return directMessage;
	if (serialized && serialized !== '{}' && serialized !== 'null') return serialized;
	return fallbackMessage;
}

export async function ensureUserProfile(user: any) {
	if (!user || !user.id) return null;
	try {
		const payload: any = {
			id: user.id,
			email: user.email || null,
			display_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
		};
		const { data, error } = await supabase.from('user_profiles').upsert(payload).select().single();
		if (error) throw error;
		return data;
	} catch (e) {
		console.warn('ensureUserProfile error (ignored):', e);
		return null;
	}
}

export async function verifySuperPassword(password: string): Promise<boolean> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 8000); // Shorter 8s timeout

	try {
		console.log('Querying admin_accounts for username superadmin...');

		// Priority 1: Check username 'superadmin'
		const { data: admin, error } = await supabase
			.from('admin_accounts')
			.select('*')
			.eq('username', 'superadmin')
			.maybeSingle();

		if (admin && password === admin.password) {
			clearTimeout(timeoutId);
			return true;
		}

		// Priority 2: Check currently logged in user's email as username if is_superadmin = true
		const { data: { user: currentUser } } = await supabase.auth.getUser();
		if (currentUser?.email) {
			const { data: personalAdmin } = await supabase
				.from('admin_accounts')
				.select('*')
				.eq('username', currentUser.email)
				.eq('is_superadmin', true)
				.maybeSingle();

			if (personalAdmin && password === personalAdmin.password) {
				clearTimeout(timeoutId);
				return true;
			}
		}

		clearTimeout(timeoutId);
		if (error) console.error('Supabase error in verifySuperPassword:', error);
		return false;
	} catch (e: any) {
		clearTimeout(timeoutId);
		console.error('verifySuperPassword error:', e.name === 'AbortError' ? 'Timed out' : e);
		return false;
	}
}

export async function changeSuperAdminPassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
	try {
		const { data, error } = await supabase.rpc('change_super_admin_password', {
			p_current_password: currentPassword,
			p_new_password: newPassword
		});

		if (error) throw error;

		if (data && data.success) {
			return { success: true };
		} else {
			return { success: false, error: data?.message || 'Failed to update password' };
		}
	} catch (e: any) {
		return { success: false, error: e?.message || String(e) };
	}
}

export async function updateSuperAdminPassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
	// Deprecated: Use changeSuperAdminPassword instead
	return { success: false, error: 'Deprecated. Use changeSuperAdminPassword instead.' };
}

export async function logOut() {
	try {
		await supabase.auth.signOut();
	} catch (e) {
		console.warn('logout error:', e);
	}
}

export async function signUp(email: string, password: string, selectedRole: string = 'user'): Promise<{ user: any; error: string | null; requiresEmailVerification: boolean; isExistingUser: boolean }> {
	try {
		const emailRedirectTo = Capacitor.isNativePlatform()
			? 'com.boxitt.app://auth-callback'
			: window.location.origin + '/auth-callback';

		const { data, error } = await supabase.auth.signUp({
			email,
			password,
			options: {
				emailRedirectTo,
			},
		});
		if (error) {
			const isExistingUserError = /user already registered|already exists|already been registered/i.test(
				`${error?.message || ''} ${(error as any)?.error_description || ''}`
			);
			return {
				user: null,
				error: normalizeAuthError(error, 'Unable to create account right now. Please try again shortly.'),
				requiresEmailVerification: false,
				isExistingUser: isExistingUserError,
			};
		}

		const user = data?.user || null;
		const session = data?.session || null;
		const isExistingUser = Boolean(user && Array.isArray(user.identities) && user.identities.length === 0);
		const requiresEmailVerification = Boolean(user && !session && !user.email_confirmed_at);
		if (user && !isExistingUser) {
			let role_status = selectedRole === 'user' ? 'approved' : 'pending';
			let requested_role = selectedRole === 'user' ? null : selectedRole;

			await supabase.from('user_profiles').upsert({
				id: user.id,
				email: user.email || null,
				role: selectedRole,
				role_status,
				requested_role
			});
		}
		return { user, error: null, requiresEmailVerification, isExistingUser };
	} catch (e: any) {
		return {
			user: null,
			error: normalizeAuthError(e, 'Unable to create account right now. Please try again shortly.'),
			requiresEmailVerification: false,
			isExistingUser: false,
		};
	}
}

export async function resendVerificationEmail(email: string) {
	try {
		const emailRedirectTo = Capacitor.isNativePlatform()
			? 'com.boxitt.app://auth-callback'
			: window.location.origin + '/auth-callback';

		const { error } = await supabase.auth.resend({
			type: 'signup',
			email,
			options: {
				emailRedirectTo,
			},
		});

		if (error) {
			return {
				success: false,
				error: normalizeAuthError(error, 'Unable to resend verification email right now. Please try again shortly.'),
			};
		}

		return { success: true, error: null };
	} catch (e: any) {
		return {
			success: false,
			error: normalizeAuthError(e, 'Unable to resend verification email right now. Please try again shortly.'),
		};
	}
}

export async function signIn(email: string, password: string): Promise<{ user: any; error: string | null; requiresEmailVerification?: boolean; isExistingUser?: boolean }> {
	try {
		const { data, error } = await supabase.auth.signInWithPassword({ email, password });
		return { user: data?.user || null, error: error?.message || null };
	} catch (e: any) {
		return { user: null, error: e?.message || String(e) };
	}
}

export async function signInWithGoogle() {
	try {
		const isNative = Capacitor.isNativePlatform();
		const redirectTo = isNative
			? 'com.boxitt.app://auth-callback'
			: window.location.origin + '/auth-callback';

		const { data, error } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo,
				skipBrowserRedirect: true,
				queryParams: {
					access_type: 'offline',
					prompt: 'consent',
				}
			}
		});

		if (error) throw error;

		if (data?.url) {
			if (isNative) {
				await Browser.open({ url: data.url });
			} else {
				window.location.replace(data.url);
			}
		}

		return { error: null };
	} catch (e: any) {
		return { error: e?.message || String(e) };
	}
}

export async function resetPassword(email: string) {
	try {
		const { error } = await supabase.auth.resetPasswordForEmail(email, {
			redirectTo: window.location.origin
		});
		return { success: !error, error: error?.message || null };
	} catch (e: any) {
		return { success: false, error: e?.message || String(e) };
	}
}

export async function createUserProfile(
	displayName: string,
	avatarUrl?: string | null,
	phone?: string | null,
	dob?: string | null,
	gender?: string | null,
	address?: string | null,
	location?: string | null,
	joinedDate?: string | null,
	selectedRole: string = 'user'
) {
	try {
		const { data: userData } = await supabase.auth.getUser();
		const userId = userData?.user?.id;
		if (!userId) return { profile: null, error: 'User not authenticated' };

		let role_status = selectedRole === 'user' ? 'approved' : 'pending';
		let requested_role = selectedRole === 'user' ? null : selectedRole;

		const payload = {
			id: userId,
			email: userData?.user?.email || null,
			display_name: displayName,
			avatar_url: avatarUrl || null,
			phone_number: phone || null,
			dob: dob || null,
			gender: gender || null,
			address: address || null,
			location: location || null,
			joined_date: joinedDate || null,
			role: selectedRole,
			role_status,
			requested_role,
		};

		const { data, error } = await supabase.from('user_profiles').upsert(payload).select().single();
		return { profile: data || null, error: error?.message || null };
	} catch (e: any) {
		return { profile: null, error: e?.message || String(e) };
	}
}

export async function updatePassword(newPassword: string) {
	try {
		const { error } = await supabase.auth.updateUser({ password: newPassword });
		return { success: !error, error: error?.message || null };
	} catch (e: any) {
		return { success: false, error: e?.message || String(e) };
	}
}

import { supabase } from './supabase';
import { handleError } from './errorHandler';
import { geocodingService } from './geocodingService';

const SUPABASE_CONFIGURED = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

export type UserRole = 'user' | 'admin' | 'superadmin';

export interface UserProfile {
  id: string;
  email: string | null;
  phone_number: string | null;
  displayName: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  role?: UserRole;
  latitude?: number;
  longitude?: number;
}

export interface Contact {
  id: string;
  user_id: string;
  contact_id: string;
  nickname: string | null;
  is_blocked: boolean;
  created_at: string;
  contact_profile?: UserProfile;
}

// Search users by displayName, email, or phone
export const searchUsers = async (
  query: string,
  searchType: 'displayName' | 'email' | 'phone' | 'all' = 'all'
) => {
  try {
    if (!query || query.trim().length < 2) {
      throw new Error('Search query must be at least 2 characters');
    }

    const searchQuery = query.toLowerCase().trim();
    let queryBuilder = supabase
      .from('user_profiles')
      .select('*')
      .limit(20);

    switch (searchType) {
      case 'displayName':
        queryBuilder = queryBuilder.ilike('display_name', `%${searchQuery}%`);
        break;
      case 'email':
        queryBuilder = queryBuilder.ilike('email', `%${searchQuery}%`);
        break;
      case 'phone':
        queryBuilder = queryBuilder.ilike('phone_number', `%${searchQuery}%`);
        break;
      case 'all':
        queryBuilder = queryBuilder.or(
          `display_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone_number.ilike.%${searchQuery}%`
        );
        break;
    }

    const { data, error } = await queryBuilder;
    if (error) throw error;

    return { users: data || [], error: null };
  } catch (error: any) {
    const appError = handleError(error);
    return { users: [], error: appError.message };
  }
};

// Get user profile by ID
export const getUserProfile = async (userId: string) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

  try {
    if (!userId) throw new Error('User ID is required');

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    clearTimeout(timeoutId);
    if (error) throw error;

    return { profile: data, error: null };
  } catch (error: any) {
    clearTimeout(timeoutId);
    const appError = handleError(error);
    return { profile: null, error: appError.message };
  }
};

// Get current user's profile
export const getCurrentUserProfile = async () => {
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return { profile: null, error: null };

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (error) throw error;

    return { profile: data, error: null };
  } catch (error: any) {
    const appError = handleError(error);
    return { profile: null, error: appError.message };
  }
};

export const getCurrentUserRole = async (): Promise<{ role: UserRole; error: string | null }> => {
  try {
    if (!SUPABASE_CONFIGURED) {
      return { role: 'user', error: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY' };
    }
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return { role: 'user', error: null };

    const { data, error } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single();

    if (error) throw error;
    return { role: (data?.role as UserRole) || 'user', error: null };
  } catch (error: any) {
    const appError = handleError(error);
    return { role: 'user', error: appError.message };
  }
};

export const listUserProfiles = async () => {
  try {
    if (!SUPABASE_CONFIGURED) {
      throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
    }
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, email, phone_number, display_name, role, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { users: data || [], error: null };
  } catch (error: any) {
    const appError = handleError(error);
    return { users: [], error: appError.message };
  }
};

export const updateUserRole = async (userId: string, role: UserRole) => {
  try {
    if (!userId) throw new Error('User ID is required');

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error('User not authenticated');

    // Determine role_status and requested_role
    let role_status: string;
    let requested_role: string | null;
    if (role === 'user') {
      role_status = 'approved';
      requested_role = null;
    } else if (role === 'admin' || role === 'superadmin') {
      role_status = 'pending';
      requested_role = role; // Set requested_role to ensure sync works
    } else {
      role_status = 'approved';
      requested_role = null;
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .update({ role, role_status, requested_role })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    return { profile: data, error: null };
  } catch (error: any) {
    const appError = handleError(error);
    return { profile: null, error: appError.message };
  }
};

// Add user to contacts
export const addContact = async (
  contactId: string,
  nickname?: string
) => {
  try {
    if (!contactId) throw new Error('Contact ID is required');

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error('User not authenticated');
    if (authData.user.id === contactId) {
      throw new Error('Cannot add yourself as a contact');
    }

    // Check if contact already exists
    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', authData.user.id)
      .eq('contact_id', contactId)
      .single();

    if (existing) {
      throw new Error('Contact already added');
    }

    const { data, error } = await supabase
      .from('contacts')
      .insert({
        user_id: authData.user.id,
        contact_id: contactId,
        nickname: nickname || null,
        is_blocked: false,
      })
      .select()
      .single();

    if (error) throw error;
    return { contact: data, error: null };
  } catch (error: any) {
    const appError = handleError(error);
    return { contact: null, error: appError.message };
  }
};

// Get user's contacts
export const getContacts = async (includeBlocked = false) => {
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error('User not authenticated');

    let queryBuilder = supabase
      .from('contacts')
      .select(
        `
        id,
        user_id,
        contact_id,
        nickname,
        is_blocked,
        created_at,
        contact_profile:user_profiles!contact_id(*)
      `
      )
      .eq('user_id', authData.user.id);

    if (!includeBlocked) {
      queryBuilder = queryBuilder.eq('is_blocked', false);
    }

    const { data, error } = await queryBuilder;
    if (error) throw error;

    return { contacts: data || [], error: null };
  } catch (error: any) {
    const appError = handleError(error);
    return { contacts: [], error: appError.message };
  }
};

// Block/unblock contact
export const blockContact = async (contactId: string, block: boolean) => {
  try {
    if (!contactId) throw new Error('Contact ID is required');

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('contacts')
      .update({ is_blocked: block })
      .eq('user_id', authData.user.id)
      .eq('contact_id', contactId)
      .select()
      .single();

    if (error) throw error;
    return { contact: data, error: null };
  } catch (error: any) {
    const appError = handleError(error);
    return { contact: null, error: appError.message };
  }
};

// Remove contact
export const removeContact = async (contactId: string) => {
  try {
    if (!contactId) throw new Error('Contact ID is required');

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('user_id', authData.user.id)
      .eq('contact_id', contactId);

    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    const appError = handleError(error);
    return { error: appError.message };
  }
};

// Delete user profile by userId
export const deleteUserProfile = async (userId: string) => {
  try {
    if (!userId) throw new Error('User ID is required');
    const { error } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', userId);
    if (error) throw error;
    return { success: true, error: null };
  } catch (error: any) {
    const appError = handleError(error);
    return { success: false, error: appError.message };
  }
};

// Check if user is blocked
export const isUserBlocked = async (userId: string) => {
  try {
    if (!userId) throw new Error('User ID is required');

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error('User not authenticated');

    // Check if userId has blocked current user or current user has blocked userId
    const { data: blocked1 } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', userId)
      .eq('contact_id', authData.user.id)
      .eq('is_blocked', true)
      .single();

    const { data: blocked2 } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', authData.user.id)
      .eq('contact_id', userId)
      .eq('is_blocked', true)
      .single();

    return { isBlocked: !!(blocked1 || blocked2), error: null };
  } catch (error: any) {
    const appError = handleError(error);
    return { isBlocked: false, error: appError.message };
  }
};

// Update contact nickname
export const updateContactNickname = async (
  contactId: string,
  nickname: string
) => {
  try {
    if (!contactId) throw new Error('Contact ID is required');

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('contacts')
      .update({ nickname: nickname || null })
      .eq('user_id', authData.user.id)
      .eq('contact_id', contactId)
      .select()
      .single();

    if (error) throw error;
    return { contact: data, error: null };
  } catch (error: any) {
    const appError = handleError(error);
    return { contact: null, error: appError.message };
  }
};

// Update user's location (latitude/longitude)
export const updateUserLocation = async (latitude: number, longitude: number) => {
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('user_profiles')
      .update({
        latitude,
        longitude,
        location_updated_at: new Date().toISOString()
      })
      .eq('id', authData.user.id);

    if (error) throw error;
    return { success: true, error: null };
  } catch (error: any) {
    const appError = handleError(error);
    return { success: false, error: appError.message };
  }
};

export const userService = {
  searchUsers,
  getUserProfile,
  getCurrentUserProfile,
  getCurrentUserRole,
  listUserProfiles,
  updateUserRole,
  addContact,
  getContacts,
  blockContact,
  removeContact,
  deleteUserProfile,
  isUserBlocked,
  updateContactNickname,
  updateUserLocation
};

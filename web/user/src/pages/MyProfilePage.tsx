import React, { useEffect, useState } from 'react';
import ProfileDashboard from '../components/ProfileDashboard';
import { UserProfile } from '../types';
import { supabase } from '../services/supabase';
import { handleError } from '../services/errorHandler';
import { getUserProfile } from '../services/userService';
import { storage } from '../services/storage';

export default function MyProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (authUser) {
          // 1. Get the profile from user_profiles table
          const { profile, error } = await getUserProfile(authUser.id);

          if (error) {
            console.warn('Profile fetch error:', error);
          }

          // 2. Normalized mapping with priority to DB phone_number & full details
          const normalizedProfile: UserProfile = {
            ...profile, // Include all fields from DB
            id: authUser.id,
            email: authUser.email || profile?.email || '',
            phone: profile?.phone_number || profile?.phone || authUser.phone || '',
            joinedDate: profile?.created_at || profile?.joined_date || profile?.joinedDate || '',
            profileImage: profile?.avatar_url || profile?.profileImage || '',
            username: profile?.display_name || profile?.username || authUser.user_metadata?.username || 'Rahul Kumar',
            role: profile?.role || 'user',
            location: profile?.location || profile?.address || 'Hyderabad, Telangana'
          };

          setUser(normalizedProfile);
        } else {
          // Fallback demo state if viewing without auth session
          setUser({
            id: 'demo-user-id',
            email: 'rahul.kumar@boxitt.app',
            phone: '+91 98765 43210',
            username: 'Rahul Kumar',
            display_name: 'Rahul Kumar',
            location: 'Hyderabad, Telangana',
            joinedDate: '2025-01-15',
            role: 'user'
          });
        }
      } catch (err) {
        const appError = handleError(err);
        console.error('Error in MyProfilePage:', appError.message);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const handleEdit = () => {
    window.location.href = '/edit-profile';
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      storage.logout();
    } catch (err) {
      const appError = handleError(err);
      console.error('Logout error:', appError.message);
    } finally {
      window.location.href = '/login';
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
    </div>
  );

  if (!user) return null;

  return (
    <ProfileDashboard
      profile={user}
      onEdit={handleEdit}
      onLogout={handleLogout}
    />
  );
}

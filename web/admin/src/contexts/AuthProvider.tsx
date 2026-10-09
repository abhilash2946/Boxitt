import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { User } from '@supabase/supabase-js';
import { updateUserLocation } from '../services/userService';
import { storage } from '../services/storage';

import { roleService } from '../services/roleService';

const AuthContext = createContext<User | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // Function to update user's location
  const updateLocation = async (userId?: string) => {
    // Check if user has explicitly allowed location permission in the app
    const perms = storage.getPermissions();
    if (perms.location !== 'allow') {
      return;
    }

    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 10000,
            enableHighAccuracy: false,
            maximumAge: 300000 // Cache for 5 minutes
          });
        });

        await updateUserLocation(position.coords.latitude, position.coords.longitude);
        console.log('User location updated successfully');
      } catch (error) {
        console.warn('Failed to get/update user location:', error);
      }
    }
  };

  useEffect(() => {
    let ignore = false;
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!ignore) {
        setUser(user);
        // Update location when user is authenticated
        if (user) {
          updateLocation(user.id);
        }
      }
    }
    fetchUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      // Update location on auth state change (login)
      if (session?.user) {
        updateLocation(session.user.id);
      }
    });
    return () => {
      ignore = true;
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, []);

  // Periodically update location (every 5 minutes)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      updateLocation();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [user]);

  // Listen for storage changes to trigger location update when permission is granted
  useEffect(() => {
    const handlePermissionUpdate = (e: any) => {
      if (e.detail?.type === 'location' && e.detail?.choice === 'allow') {
        updateLocation();
      }
    };
    window.addEventListener('boxitt_permissions_updated', handlePermissionUpdate as any);

    return () => {
      window.removeEventListener('boxitt_permissions_updated', handlePermissionUpdate as any);
    };
  }, [user]);

  return (
    <AuthContext.Provider value={user}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import EditProfileScreen from '../components/EditProfileScreen';
import { UserProfile, User } from '../types';
import { useAuth } from '../contexts/AuthProvider';
import { supabase } from '../services/supabase';
import { supabaseStorage } from '../services/supabaseStorage';
import { getUserProfile, updateUserRole } from '../services/userService';
import { roleService } from '../services/roleService';
import { storage } from '../services/storage';
import { geocodingService } from '../services/geocodingService';
import { handleError } from '../services/errorHandler';
import { Search } from 'lucide-react';

interface EditProfilePageProps {
  currentUser: User | null;
  onAlert?: (message: string, type: 'success' | 'error' | 'info', onClose?: () => void) => void;
  onUpdateComplete?: (isNewProfile: boolean) => void;
}

export default function EditProfilePage({ currentUser, onAlert, onUpdateComplete }: EditProfilePageProps) {
  const authUser = useAuth();
  const navigate = useNavigate();
  const PAGE_ID = 'edit_profile';

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const databaseProfileRef = useRef<UserProfile | null>(null);

  useEffect(() => {
    const userId = currentUser?.id || authUser?.id;
    if (!userId) {
      setLoading(false);
      return;
    }

    const loadProfile = async () => {
      try {
        setLoading(true);
        const { profile: dbProfile } = await getUserProfile(userId);

        // Map database fields to internal form fields
        const fetchedProfile: UserProfile = {
          id: userId,
          email: dbProfile?.email || dbProfile?.email_address || currentUser?.email || authUser?.email || '',
          phone: dbProfile?.phone_number || dbProfile?.phone || currentUser?.phone_number || '',
          username: dbProfile?.display_name || dbProfile?.username || currentUser?.display_name || '',
          profileImage: dbProfile?.avatar_url || dbProfile?.profileImage || currentUser?.avatar_url || currentUser?.profileImage || '',
          dob: dbProfile?.dob || dbProfile?.date_of_birth || '',
          gender: dbProfile?.gender || '',
          address: dbProfile?.address || currentUser?.address || '',
          location: dbProfile?.location || currentUser?.location || '',
          role: 'admin',
          joinedDate: dbProfile?.joined_date || dbProfile?.joinedDate || currentUser?.joined_date || '',
        };

        databaseProfileRef.current = { ...fetchedProfile };

        const savedState = storage.getPageState<UserProfile>(PAGE_ID);
        if (savedState && savedState.id === userId) {
          const merged = { ...fetchedProfile };
          (Object.keys(savedState) as (keyof UserProfile)[]).forEach((key) => {
            if (savedState[key] && !fetchedProfile[key]) {
              (merged as any)[key] = savedState[key];
            }
          });
          setProfile(merged);
        } else {
          setProfile(fetchedProfile);
        }
      } catch (err) {
        console.error("Error loading profile:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [currentUser?.id, authUser?.id]);

  const handleBack = () => {
    const isProfileComplete = !!(
      profile?.email &&
      profile?.username &&
      (profile?.phone || profile?.phone_number) &&
      (profile?.dob || (profile as any)?.date_of_birth) &&
      profile?.gender &&
      profile?.role &&
      profile?.address
    );

    if (onUpdateComplete) {
      // isNewProfile is true if profile is NOT complete
      onUpdateComplete(!isProfileComplete);
    } else {
      // Redirect to booking (SelectSport) if complete, otherwise dashboard
      navigate(isProfileComplete ? '/booking' : '/dashboard');
    }
  };

  const handleSave = async (updatedProfile: UserProfile) => {
    const userId = currentUser?.id || authUser?.id;
    if (!userId) return;

    try {
      setIsSaving(true);
      const phone = (updatedProfile.phone || '').replace(/\D/g, '');
      if (phone && phone.length !== 10) {
        onAlert?.('Phone number must be exactly 10 digits.', 'error');
        return;
      }

      const updates: any = {};
      const old = (databaseProfileRef.current || {}) as Partial<UserProfile>;
      const hasChanged = (n: any, o: any) => String(n || '').trim() !== String(o || '').trim();

      // Map back to database columns
      if (hasChanged(updatedProfile.username, old.username)) {
          updates.display_name = updatedProfile.username;
          updates.username = updatedProfile.username;
      }
      if (hasChanged(updatedProfile.phone, old.phone)) updates.phone_number = updatedProfile.phone;
      if (hasChanged(updatedProfile.dob, old.dob)) updates.dob = updatedProfile.dob;
      if (hasChanged(updatedProfile.gender, old.gender)) updates.gender = updatedProfile.gender;
      if (hasChanged(updatedProfile.address, old.address)) updates.address = updatedProfile.address;
      if (hasChanged(updatedProfile.location, old.location)) updates.location = updatedProfile.location;
      if (hasChanged(updatedProfile.email, old.email)) updates.email = updatedProfile.email;

      // Auto-geocode address if coordinates are missing or if address changed
      if (updatedProfile.address && (hasChanged(updatedProfile.address, old.address) || (old.latitude === undefined && old.longitude === undefined))) {
        try {
          const coords = await geocodingService.getCoordinates(updatedProfile.address, updatedProfile.location || '');
          if (coords) {
            updates.latitude = coords.latitude;
            updates.longitude = coords.longitude;
          }
        } catch (e) {
          console.warn("Auto-geocoding failed:", e);
        }
      }

      // Handle Profile Image Upload to Supabase Storage
      if (updatedProfile.profileImage && (updatedProfile.profileImage.startsWith('data:') || updatedProfile.profileImage.startsWith('blob:'))) {
        try {
          // Convert data URI or blob URL to Blob if necessary
          let fileToUpload: Blob;
          if (updatedProfile.profileImage.startsWith('data:')) {
            const res = await fetch(updatedProfile.profileImage);
            fileToUpload = await res.blob();
          } else {
            const res = await fetch(updatedProfile.profileImage);
            fileToUpload = await res.blob();
          }

          const fileName = `${userId}/avatar-${Date.now()}`;
          const publicUrl = await supabaseStorage.uploadFile('profiles', fileName, fileToUpload);

          // Delete old avatar if it exists in storage
          if (old.profileImage && old.profileImage.includes('/profiles/')) {
            const oldPath = old.profileImage.split('/profiles/')[1];
            try {
              await supabaseStorage.deleteFile('profiles', oldPath);
            } catch (e) {
              console.warn("Failed to delete old avatar:", e);
            }
          }

          updates.avatar_url = publicUrl;
        } catch (uploadErr) {
          console.error("Avatar upload failed:", uploadErr);
          throw new Error("Failed to upload profile picture.");
        }
      } else if (updatedProfile.profileImage === '') {
          // If image was removed
          updates.avatar_url = null;
          const oldImage = old.profileImage || old.avatar_url;
          if (oldImage && oldImage.includes('/profiles/')) {
              const oldPath = oldImage.split('/profiles/')[1];
              await supabaseStorage.deleteFile('profiles', oldPath).catch(console.error);
          }
      } else {
          // Existing remote URL
          if (hasChanged(updatedProfile.profileImage, old.profileImage)) updates.avatar_url = updatedProfile.profileImage;
      }

      let roleChanged = false;
      // Force admin role for this platform
      if (updatedProfile.role !== 'admin') {
        updatedProfile.role = 'admin';
      }

      if (updatedProfile.role !== old.role) {
        await updateUserRole(userId, 'admin');
        roleChanged = true;
      }

      // Use upsert to ensure the record exists
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from('user_profiles').upsert({ id: userId, ...updates });
        if (error) throw error;
      }

      // Explicitly ensure the platform role is created/checked
      await roleService.ensurePlatformRole(userId);

      storage.clearPageState(PAGE_ID);
      const isComplete = !!(updatedProfile.phone && updatedProfile.location && updatedProfile.address);

      onAlert?.(
        (Object.keys(updates).length > 0 || roleChanged) ? 'Profile updated successfully!' : 'No changes detected.',
        'success',
        () => {
          if (onUpdateComplete) {
            onUpdateComplete(false);
          } else {
            navigate('/my-profile');
          }
        }
      );
    } catch (err) {
      onAlert?.('Save failed: ' + handleError(err).message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading && !profile) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Syncing Profile...</p>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <EditProfileScreen
      profile={profile}
      onBack={handleBack}
      onSave={handleSave}
      onAlert={onAlert}
      isSaving={isSaving}
      onChange={(updated) => {
        setProfile(updated);
        storage.setPageState(PAGE_ID, updated);
      }}
    />
  );
}

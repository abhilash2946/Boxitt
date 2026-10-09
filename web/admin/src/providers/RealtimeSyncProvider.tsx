import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { storage } from '../services/storage';
import { locationService } from '../services/locationService';
import { getPricingForLocation } from '../services/pricingService';

interface RealtimeSyncContextType {
  lastSync: number;
  isSyncing: boolean;
  refreshAll: () => Promise<void>;
}

const RealtimeSyncContext = createContext<RealtimeSyncContextType | null>(null);

export const useRealtimeSync = () => {
  const context = useContext(RealtimeSyncContext);
  if (!context) throw new Error('useRealtimeSync must be used within RealtimeSyncProvider');
  return context;
};

export const RealtimeSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lastSync, setLastSync] = useState(Date.now());
  const [isSyncing, setIsSyncing] = useState(false);

  // 1. Hybrid Pull: Refresh critical data on startup
  const refreshAll = async () => {
    setIsSyncing(true);
    try {
      console.log('RealtimeSync: Triggering background revalidation and cache purge...');

      // Tell Service Worker to purge cache
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'PURGE_CACHE' });
      }

      // We don't need to await everything here if we just want to bump the version
      // but doing it sequentially ensures the cache is hot.
      await locationService.getLocations();

      storage.bumpDataVersion();
      setLastSync(Date.now());
    } catch (e) {
      console.error('RealtimeSync: Background refresh failed', e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  // 2. Hybrid Push: Listen for changes from Supabase
  useEffect(() => {
    console.log('RealtimeSync: Initializing project-wide subscriptions...');

    const tablesToSync = [
      'bookings',
      'payments',
      'challenges',
      'matches',
      'match_results',
      'join_requests',
      'courts',
      'locations',
      'box_pricing',
      'box_schedules',
      'notifications',
      'user_profiles',
      'user_roles',
      'admin_accounts',
      'closures',
      'box_closures',
      'ratings',
      'reviews',
      'friendships',
      'chat_rooms',
      'chat_room_members',
      'chat_messages',
      'game_zones',
      'game_zone_platforms',
      'game_zone_resources',
      'game_zone_games',
      'game_zone_resource_games',
      'game_zone_blockouts'
    ];

    let channel = supabase.channel('project-changes');

    tablesToSync.forEach(table => {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          console.log(`RealtimeSync: Realtime change detected on ${table}`, payload);
          storage.bumpDataVersion();
          setLastSync(Date.now());
        }
      );
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <RealtimeSyncContext.Provider value={{ lastSync, isSyncing, refreshAll }}>
      {children}
    </RealtimeSyncContext.Provider>
  );
};

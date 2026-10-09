import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { storage, LocalNotification, MAX_LOCAL_NOTIFICATIONS } from '../services/storage';

export interface Notification extends LocalNotification {
  user_id: string;
}

export const useNotifications = (userId: string | undefined) => {
  const [notifications, setNotifications] = useState<Notification[]>(storage.getNotifications() as Notification[]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'prompt' | 'granted' | 'denied' | 'prompt-with-rationale'>('prompt');

  const syncWithLocal = useCallback(() => {
    const local = storage.getNotifications() as Notification[];
    setNotifications(local);
    setUnreadCount(local.filter(n => !n.is_read).length);
  }, []);

  const checkPermissions = useCallback(async () => {
    try {
      if (Capacitor.getPlatform() === 'web') {
        if ('Notification' in window) {
          setPermissionStatus(Notification.permission);
        }
      } else {
        const status = await LocalNotifications.checkPermissions();
        setPermissionStatus(status.display);
      }
    } catch (e) {
      console.error('Check permission failed', e);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      if (Capacitor.getPlatform() === 'web') {
        if ('Notification' in window) {
          const permission = await Notification.requestPermission();
          setPermissionStatus(permission);
          return permission === 'granted';
        }
      } else {
        const status = await LocalNotifications.requestPermissions();
        setPermissionStatus(status.display);
        return status.display === 'granted';
      }
    } catch (e) {
      console.error('Permission request failed', e);
    }
    return false;
  }, []);

  const showOSNotification = useCallback(async (notif: Notification) => {
    try {
      if (!Capacitor.isNativePlatform()) {
        if ('Notification' in window && Notification.permission === 'granted') {
          // Use Service Worker if available for better background support
          if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            registration.showNotification(notif.title, {
              body: notif.message,
              icon: '/logo.png',
              badge: '/logo.png',
              tag: notif.id,
              data: notif
            });
          } else {
            new window.Notification(notif.title, {
              body: notif.message,
              icon: '/logo.png',
              tag: notif.id
            });
          }
        }
      } else {
        // Ensure channel exists on Android (matches Manifest if possible, but importance is key)
        if (Capacitor.getPlatform() === 'android') {
          await LocalNotifications.createChannel({
            id: 'default_channel_id', // Matches Manifest
            name: 'Default',
            description: 'Default notification channel',
            importance: 5, // High importance for popups
            visibility: 1,
            sound: 'default'
          });
        }

        await LocalNotifications.schedule({
          notifications: [{
            title: notif.title,
            body: notif.message,
            id: Math.floor(Math.random() * 1000000),
            schedule: { at: new Date(Date.now() + 100) },
            sound: 'default',
            channelId: 'default_channel_id'
          }]
        });
      }
    } catch (err) {
      console.error("OS Notification error:", err);
    }
  }, []);

  const fetchAndSync = useCallback(async () => {
    if (!userId) return;

    const nowIso = new Date().toISOString();

    await supabase
      .from('notifications')
      .delete()
      .eq('user_id', String(userId).trim())
      .lte('auto_delete_at', nowIso);

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', String(userId).trim())
      .or(`auto_delete_at.is.null,auto_delete_at.gt.${nowIso}`)
      .order('created_at', { ascending: false })
      .limit(MAX_LOCAL_NOTIFICATIONS);

    if (error) {
      console.warn("Fetch failed:", error.message);
      return;
    }

    if (data && data.length > 0) {
      const localNotifs = storage.getNotifications() as Notification[];
      const existingIds = new Set(localNotifs.map(n => n.id));
      const newToPush: Notification[] = [];

      data.forEach(n => {
        if (!existingIds.has(n.id)) {
          newToPush.push(n as Notification);
          // If this notification is very recent (last 35s), show a popup even if fetched via poll
          const age = Date.now() - new Date(n.created_at).getTime();
          if (age < 35000) showOSNotification(n as Notification);
        }
      });

      if (newToPush.length > 0) {
        const updated = [...newToPush, ...localNotifs].slice(0, MAX_LOCAL_NOTIFICATIONS);
        storage.saveNotifications(updated);
        syncWithLocal();
      }
    }
  }, [userId, syncWithLocal, showOSNotification]);

  useEffect(() => {
    syncWithLocal();
    fetchAndSync();
    checkPermissions();

    // Fallback polling in case Realtime fails (Supabase quota/network)
    const pollInterval = setInterval(fetchAndSync, 30000);

    window.addEventListener('boxitt_notifications_updated', syncWithLocal);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('boxitt_notifications_updated', syncWithLocal);
    };
  }, [userId, fetchAndSync, syncWithLocal, checkPermissions]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications'
        },
        async (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;

          if (eventType === 'INSERT') {
            const newNotif = newRecord as Notification;
            if (String(newNotif.user_id).trim() !== String(userId).trim()) return;

            // Update local storage
            storage.addLocalNotification(newNotif);

            // CRITICAL: Update state immediately for real-time UI updates
            setNotifications(prev => {
              const exists = prev.some(n => n.id === newNotif.id);
              if (exists) return prev;
              const updated = [newNotif, ...prev].slice(0, MAX_LOCAL_NOTIFICATIONS);
              setUnreadCount(updated.filter(n => !n.is_read).length);
              return updated;
            });

            // Trigger OS Notification
            showOSNotification(newNotif);
          } else if (eventType === 'UPDATE') {
            const updatedNotif = newRecord as Notification;
            if (String(updatedNotif.user_id).trim() !== String(userId).trim()) return;

            const local = storage.getNotifications() as Notification[];
            const idx = local.findIndex(n => n.id === updatedNotif.id);
            if (idx !== -1) {
              local[idx] = updatedNotif;
              storage.saveNotifications(local);
              setNotifications(local);
              setUnreadCount(local.filter(n => !n.is_read).length);
            }
          } else if (eventType === 'DELETE') {
            const deletedId = oldRecord?.id;
            if (deletedId) {
              const local = storage.getNotifications().filter(n => n.id !== deletedId) as Notification[];
              storage.saveNotifications(local);
              setNotifications(local);
              setUnreadCount(local.filter(n => !n.is_read).length);
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, showOSNotification]);

  const markAllAsRead = useCallback(async () => {
    const current = storage.getNotifications() as Notification[];
    const hasUnread = current.some(n => !n.is_read);
    if (!hasUnread) return;

    const updated = current.map(n => ({ ...n, is_read: true }));
    storage.saveNotifications(updated);
    syncWithLocal();

    if (userId) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', String(userId).trim())
        .eq('is_read', false);
    }
  }, [userId, syncWithLocal]);

  const deleteNotification = useCallback(async (id: string) => {
    const current = storage.getNotifications() as Notification[];
    const updated = current.filter(n => n.id !== id);
    storage.saveNotifications(updated);
    syncWithLocal();

    // Also try to delete from DB if it's still there
    await supabase.from('notifications').delete().eq('id', id);

    return { error: null };
  }, [syncWithLocal]);

  const clearAllNotifications = useCallback(async () => {
    storage.saveNotifications([]);
    syncWithLocal();

    if (userId) {
      await supabase.from('notifications').delete().eq('user_id', String(userId).trim());
    }

    return { error: null };
  }, [userId, syncWithLocal]);

  return {
    notifications,
    unreadCount,
    permissionStatus,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    refresh: fetchAndSync,
    requestPermission
  };
};

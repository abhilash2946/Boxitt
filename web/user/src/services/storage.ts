import { User, SportType, Location } from '../types';

const AUTH_KEY = 'boxitt_auth';
const ADMIN_AUTH_KEY = 'boxitt_admin_auth';
const SUPER_ADMIN_SESSION_KEY = 'boxitt_super_admin_active';
const NAV_KEY = 'boxitt_nav_state';
const SESSION_FLAG = 'boxitt_session_active';
const PAGE_DATA_KEY = 'boxitt_page_data_';
const NOTIFICATIONS_KEY = 'boxitt_notifications';
const PERMISSIONS_KEY = 'boxitt_permissions';
const DATA_VERSION_KEY = 'boxitt_data_version';
export const MAX_LOCAL_NOTIFICATIONS = 200;

interface NavState {
  currentPage: string;
  selectedSport: SportType | null;
  selectedLocation: Location | null;
}

export interface LocalNotification {
  id: string;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
  data?: any;
}

export type PermissionChoice = 'allow' | 'later' | 'never';

export interface PermissionState {
  camera?: PermissionChoice;
  notifications?: PermissionChoice;
  files?: PermissionChoice;
  location?: PermissionChoice;
  lastPrompted?: number;
}

export const getNotificationExpirationTime = (notif: any): number => {
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  let dataObj: any = {};
  if (typeof notif.data === 'string') {
    try { dataObj = JSON.parse(notif.data); } catch (e) {}
  } else if (notif.data) {
    dataObj = notif.data;
  }

  const dateStr = dataObj.date || dataObj.booking_date || dataObj.challenge_date;
  const slotTimeStr = dataObj.slot_time || dataObj.booking_slot_time;
  const endHour = dataObj.end_hour;

  if (dateStr) {
    try {
      let slotDate: Date | null = null;
      if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        const p = dateStr.split('-');
        slotDate = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
      } else if (dateStr.includes('/')) {
        const p = dateStr.split('/');
        if (p.length === 3) {
          const p1 = parseInt(p[0], 10);
          const p2 = parseInt(p[1], 10);
          const yr = parseInt(p[2], 10);
          if (p1 > 12) slotDate = new Date(yr, p2 - 1, p1);
          else slotDate = new Date(yr, p1 - 1, p2);
        }
      }
      if (!slotDate || isNaN(slotDate.getTime())) {
        slotDate = new Date(dateStr);
      }

      if (!isNaN(slotDate.getTime())) {
        if (typeof endHour === 'number' && !isNaN(endHour)) {
          const hours = Math.floor(endHour);
          const mins = Math.round((endHour - hours) * 60);
          slotDate.setHours(hours, mins, 0, 0);
          return slotDate.getTime() + TWENTY_FOUR_HOURS;
        } else if (slotTimeStr && typeof slotTimeStr === 'string') {
          const parts = slotTimeStr.split('-');
          const endPart = (parts.length > 1 ? parts[1] : parts[0]).trim();
          const timeMatch = endPart.match(/(\d+):?(\d+)?\s*(AM|PM)?/i);
          if (timeMatch) {
            let h = parseInt(timeMatch[1], 10);
            const m = parseInt(timeMatch[2] || '0', 10);
            const ampm = timeMatch[3]?.toUpperCase();
            if (ampm === 'PM' && h < 12) h += 12;
            if (ampm === 'AM' && h === 12) h = 0;
            slotDate.setHours(h, m, 0, 0);

            const startPart = parts[0]?.trim();
            if (h === 0 || (startPart && startPart.toUpperCase().includes('PM') && (ampm === 'AM' || h <= 12))) {
              slotDate.setDate(slotDate.getDate() + 1);
            }
            return slotDate.getTime() + TWENTY_FOUR_HOURS;
          }
        }
        slotDate.setHours(23, 59, 59, 999);
        return slotDate.getTime() + TWENTY_FOUR_HOURS;
      }
    } catch (e) {
      // Fallback
    }
  }

  if (notif.auto_delete_at) {
    const autoDeleteMs = new Date(notif.auto_delete_at).getTime();
    if (!isNaN(autoDeleteMs) && autoDeleteMs > 0) return autoDeleteMs;
  }

  const createdAtMs = notif.created_at ? new Date(notif.created_at).getTime() : Date.now();
  return (isNaN(createdAtMs) ? Date.now() : createdAtMs) + TWENTY_FOUR_HOURS;
};

/**
 * Storage service now handles local notification history
 * to save Supabase database space.
 */
export const storage = {
  // Initialization: Keep existing state across sessions/tabs
  init: () => {
    try {
      const isNewSession = !sessionStorage.getItem(SESSION_FLAG);
      if (isNewSession) {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith(PAGE_DATA_KEY)) {
            localStorage.removeItem(key);
          }
        });
        sessionStorage.setItem(SESSION_FLAG, 'true');
      }
    } catch (e) { console.error('Storage init failed:', e); }
  },

  // Authentication & Session
  getUser: (): User | null => {
    try {
      const data = localStorage.getItem(AUTH_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) { return null; }
  },
  setUser: (user: User) => localStorage.setItem(AUTH_KEY, JSON.stringify(user)),
  getAdminAuth: (): { role: 'admin' | 'superadmin'; locationId?: string; email: string } | null => {
    try {
      const data = localStorage.getItem(ADMIN_AUTH_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) { return null; }
  },
  setAdminAuth: (auth: { role: 'admin' | 'superadmin'; locationId?: string; email: string }) => {
    localStorage.setItem(ADMIN_AUTH_KEY, JSON.stringify(auth));
  },
  setSuperAdminSession: (isActive: boolean) => {
    if (isActive) localStorage.setItem(SUPER_ADMIN_SESSION_KEY, 'true');
    else localStorage.removeItem(SUPER_ADMIN_SESSION_KEY);
  },
  isSuperAdminSession: (): boolean => {
    return localStorage.getItem(SUPER_ADMIN_SESSION_KEY) === 'true';
  },
  logout: () => {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(ADMIN_AUTH_KEY);
    localStorage.removeItem(SUPER_ADMIN_SESSION_KEY);
    localStorage.removeItem(NAV_KEY);
    localStorage.removeItem(NOTIFICATIONS_KEY);
    localStorage.removeItem(PERMISSIONS_KEY);
    sessionStorage.removeItem(SESSION_FLAG);
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(PAGE_DATA_KEY)) localStorage.removeItem(key);
    });
  },

  // Navigation state
  getNavState: (): NavState | null => {
    try {
      const data = localStorage.getItem(NAV_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) { return null; }
  },
  setNavState: (state: NavState) => {
    try {
      sessionStorage.setItem(SESSION_FLAG, 'true');
      localStorage.setItem(NAV_KEY, JSON.stringify(state));
    } catch (e) { console.error('Failed to save nav state:', e); }
  },
  clearNavState: () => {
    localStorage.removeItem(NAV_KEY);
    sessionStorage.removeItem(SESSION_FLAG);
  },

  // Page-specific transient data persistence
  getPageState: <T>(pageId: string): T | null => {
    try {
      const pData = localStorage.getItem(PAGE_DATA_KEY + pageId);
      const sData = sessionStorage.getItem(PAGE_DATA_KEY + pageId);
      const pObj = pData ? JSON.parse(pData) : {};
      const sObj = sData ? JSON.parse(sData) : {};
      const combined = { ...pObj, ...sObj };
      return Object.keys(combined).length > 0 ? combined as T : null;
    } catch (e) { return null; }
  },
  setPageState: <T>(pageId: string, data: T, sessionKeys: string[] = []) => {
    try {
      sessionStorage.setItem(SESSION_FLAG, 'true');
      const pObj: any = {};
      const sObj: any = {};

      Object.entries(data as any).forEach(([key, value]) => {
        if (sessionKeys.includes(key)) sObj[key] = value;
        else pObj[key] = value;
      });

      if (Object.keys(pObj).length > 0) {
        const existing = localStorage.getItem(PAGE_DATA_KEY + pageId);
        const existingObj = existing ? JSON.parse(existing) : {};
        localStorage.setItem(PAGE_DATA_KEY + pageId, JSON.stringify({ ...existingObj, ...pObj }));
      }
      if (Object.keys(sObj).length > 0) {
        const existing = sessionStorage.getItem(PAGE_DATA_KEY + pageId);
        const existingObj = existing ? JSON.parse(existing) : {};
        sessionStorage.setItem(PAGE_DATA_KEY + pageId, JSON.stringify({ ...existingObj, ...sObj }));
      }
    } catch (e) { console.error(`Failed to save page state for ${pageId}:`, e); }
  },
  clearPageState: (pageId: string) => {
    localStorage.removeItem(PAGE_DATA_KEY + pageId);
    sessionStorage.removeItem(PAGE_DATA_KEY + pageId);
  },

  // --- LOCAL NOTIFICATION STORAGE ---
  getNotifications: (): LocalNotification[] => {
    try {
      const data = localStorage.getItem(NOTIFICATIONS_KEY);
      if (!data) return [];
      const parsed: LocalNotification[] = JSON.parse(data);
      const now = Date.now();
      const valid = parsed.filter(n => Date.now() <= getNotificationExpirationTime(n));
      if (valid.length !== parsed.length) {
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(valid.slice(0, MAX_LOCAL_NOTIFICATIONS)));
      }
      return valid;
    } catch (e) { return []; }
  },
  saveNotifications: (notifs: LocalNotification[]) => {
    const now = Date.now();
    const valid = notifs.filter(n => now <= getNotificationExpirationTime(n));
    const deduped = valid.reduce<LocalNotification[]>((acc, current) => {
      if (!acc.some(item => item.id === current.id)) acc.push(current);
      return acc;
    }, []);
    const capped = deduped.slice(0, MAX_LOCAL_NOTIFICATIONS);
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(capped));
    window.dispatchEvent(new Event('boxitt_notifications_updated'));
  },
  addLocalNotification: (notif: LocalNotification) => {
    const current = storage.getNotifications();
    // Avoid duplicates by ID
    if (current.some(n => n.id === notif.id)) return;
    // Keep newest notifications and drop only when exceeding the cap.
    const updated = [notif, ...current].slice(0, MAX_LOCAL_NOTIFICATIONS);
    storage.saveNotifications(updated);
  },

  // --- PERMISSIONS STORAGE ---
  getPermissions: (): PermissionState => {
    try {
      const data = localStorage.getItem(PERMISSIONS_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) { return {}; }
  },
  setPermission: (key: keyof PermissionState, choice: PermissionChoice) => {
    const current = storage.getPermissions();
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify({
      ...current,
      [key]: choice,
      lastPrompted: Date.now()
    }));
  },

  // --- GENERIC KEY/VALUE STORAGE ---
  get: (key: string): any => {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) { return null; }
  },
  set: (key: string, value: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { console.error(`Failed to set storage key ${key}:`, e); }
  },

  // --- DATA VERSIONING & CACHE INVALIDATION ---
  getDataVersion: (): number => {
    return Number(localStorage.getItem(DATA_VERSION_KEY) || '0');
  },
  bumpDataVersion: () => {
    const next = storage.getDataVersion() + 1;
    localStorage.setItem(DATA_VERSION_KEY, String(next));
    window.dispatchEvent(new CustomEvent('boxitt_data_invalidated', { detail: { version: next } }));
    return next;
  },

  // --- FAVORITES STORAGE ---
  getFavorites: (): string[] => {
    try {
      const data = localStorage.getItem('boxitt_favorites');
      return data ? JSON.parse(data) : [];
    } catch (e) { return []; }
  },
  toggleFavorite: (id: string) => {
    const current = storage.getFavorites();
    const updated = current.includes(id) ? current.filter(i => i !== id) : [...current, id];
    localStorage.setItem('boxitt_favorites', JSON.stringify(updated));
    return updated;
  }
};

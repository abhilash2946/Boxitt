import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { storage, PermissionChoice, PermissionState } from '../services/storage';

export type PermissionType = 'camera' | 'notifications' | 'files' | 'location';

interface PermissionsContextType {
  permissions: PermissionState;
  showPrompt: { type: PermissionType } | null;
  setShowPrompt: (prompt: { type: PermissionType } | null) => void;
  handleChoice: (type: PermissionType, choice: PermissionChoice) => Promise<boolean>;
  checkAndPrompt: (type: PermissionType, force?: boolean, isSystemBlocked?: boolean, isGesture?: boolean) => Promise<boolean>;
  checkAllPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [permissions, setPermissions] = useState<PermissionState>(storage.getPermissions());
  const [showPrompt, setShowPrompt] = useState<{ type: PermissionType } | null>(null);

  // Track prompts in current page lifecycle (resets on refresh)
  const promptedThisLoad = useRef<Record<string, boolean>>({});

  const getSystemStatus = useCallback(async (type: PermissionType): Promise<PermissionChoice | 'prompt'> => {
    try {
      if (type === 'notifications') {
        if (Capacitor.isNativePlatform()) {
          const status = await LocalNotifications.checkPermissions();
          if (status.display === 'granted') return 'allow';
          if (status.display === 'denied') return 'never';
        } else {
          if (!('Notification' in window)) return 'never';
          const perm = Notification.permission;
          if (perm === 'granted') return 'allow';
          if (perm === 'denied') return 'never';
        }
      }

      // Geolocation is supported via navigator.permissions.query in modern WebViews (Android/iOS)
      // and it is the only way to check the origin-level (localhost) permission state.
      if (navigator.permissions) {
        const nameMap: Record<string, PermissionName> = {
          camera: 'camera' as PermissionName,
          location: 'geolocation' as PermissionName,
          notifications: 'notifications' as PermissionName
        };

        const permissionName = nameMap[type];
        if (permissionName) {
          try {
            const result = await navigator.permissions.query({ name: permissionName });
            if (result.state === 'granted') return 'allow';
            if (result.state === 'denied') return 'never';
          } catch (e) { }
        }
      }
    } catch (e) {
      console.warn(`Querying ${type} permission failed`, e);
    }
    return 'prompt';
  }, []);

  useEffect(() => {
    const syncAll = async () => {
      const types: PermissionType[] = ['camera', 'notifications', 'location'];
      const currentStorage = storage.getPermissions();
      let changed = false;

      for (const t of types) {
        const systemStatus = await getSystemStatus(t);
        if (systemStatus === 'allow' && !currentStorage[t]) {
          storage.setPermission(t as any, 'allow');
          changed = true;
        }
      }
      if (changed) setPermissions(storage.getPermissions());
    };
    syncAll();
  }, [getSystemStatus]);

  const requestSystemPermission = useCallback(async (type: PermissionType) => {
    console.log(`[Permissions] Requesting system permission for: ${type}`);
    try {
      if (type === 'notifications') {
        if (Capacitor.isNativePlatform()) {
          const res = await LocalNotifications.requestPermissions();
          console.log(`[Permissions] Native notification request result:`, res);
          return res.display === 'granted';
        } else if ('Notification' in window) {
          // Trigger native prompt. await ensures we wait for user interaction.
          const permission = await Notification.requestPermission();
          console.log(`[Permissions] Web notification request result:`, permission);
          return permission === 'granted';
        }
      } else if (type === 'camera') {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(t => t.stop());
        return true;
      } else if (type === 'location') {
        return await new Promise<boolean>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve(true),
            () => resolve(false),
            { timeout: 10000, enableHighAccuracy: true }
          );
        });
      } else if (type === 'files') {
        return true;
      }
    } catch (e) {
      console.warn(`Native ${type} permission request failed:`, e);
    }
    return false;
  }, []);

  const checkAndPrompt = useCallback(async (type: PermissionType, force: boolean = false, isSystemBlocked: boolean = false, isGesture: boolean = false): Promise<boolean> => {
    // On Web browsers, file permissions are handled automatically by the browser without permissions.
    // Bypass prompting for files on Web while preserving native Android support.
    if (type === 'files' && !Capacitor.isNativePlatform()) {
      return true;
    }

    const systemStatus = await getSystemStatus(type);

    if (systemStatus === 'allow') {
      if (!permissions[type] || permissions[type] !== 'allow') {
        storage.setPermission(type as any, 'allow');
        setPermissions(storage.getPermissions());
      }
      return true;
    }

    const current = permissions;
    const choice = current[type];

    if (systemStatus === 'never' || isSystemBlocked) {
      if (type !== 'files' || Capacitor.isNativePlatform()) {
        setShowPrompt({ type });
      }
      return false;
    }

    if (!force && promptedThisLoad.current[type]) return choice === 'allow';
    if (!force && (choice === 'allow' || choice === 'never' || choice === 'later')) return choice === 'allow';

    if (type !== 'files' || Capacitor.isNativePlatform()) {
      setShowPrompt({ type });
    }
    if (!force) promptedThisLoad.current[type] = true;
    return false;
  }, [getSystemStatus, permissions]);

  const checkAllPermissions = useCallback(async () => {
    // On Web, browsers do not require 'files' permission. Only include 'files' on native platform.
    const types: PermissionType[] = Capacitor.isNativePlatform()
      ? ['notifications', 'location', 'camera', 'files']
      : ['notifications', 'location', 'camera'];

    for (const t of types) {
      const current = storage.getPermissions();
      const choice = current[t];

      // If not granted in system AND not chosen before, prompt
      const systemStatus = await getSystemStatus(t);
      if (systemStatus !== 'allow' && !choice) {
        const success = await checkAndPrompt(t, false);
        if (!success) return; // Wait for user choice
      }
    }
  }, [checkAndPrompt, getSystemStatus]);

  const handleChoice = useCallback(async (type: PermissionType, choice: PermissionChoice): Promise<boolean> => {
    console.log(`[Permissions] User choice for ${type}: ${choice}`);
    let result = false;
    if (choice === 'allow' || choice === 'later') {
      const granted = await requestSystemPermission(type);
      if (granted || type === 'files') {
        if (choice !== 'later') {
          storage.setPermission(type as any, 'allow');
        }
        setPermissions(prev => ({ ...prev, [type]: choice }));
        result = true;
      } else {
        const systemStatus = await getSystemStatus(type);
        if (systemStatus === 'never') {
          storage.setPermission(type as any, 'never');
          setPermissions(prev => ({ ...prev, [type]: 'never' }));
        } else {
          setPermissions(prev => ({ ...prev, [type]: 'later' }));
        }
      }
    } else {
      storage.setPermission(type as any, 'never');
      setPermissions(prev => ({ ...prev, [type]: 'never' }));
    }

    setShowPrompt(null);
    // Check for next permission in onboarding
    setTimeout(() => checkAllPermissions(), 100);
    return result;
  }, [requestSystemPermission, getSystemStatus, checkAllPermissions]);

  return (
    <PermissionsContext.Provider value={{ permissions, showPrompt, setShowPrompt, handleChoice, checkAndPrompt, checkAllPermissions }}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
};

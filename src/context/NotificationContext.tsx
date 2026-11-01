import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  getNotificationPermission,
  isNotificationSupported,
  requestNotificationPermission,
  triggerBrowserNotification,
  playNotificationChime,
} from '../services/browserNotifications';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { INotification } from '../types';
import { Bell, CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

import {
  triggerVibration,
  getPatternForNotificationType,
  VibrationSettings,
  VibrationPatternType,
  DEFAULT_VIBRATION_SETTINGS,
  getStoredVibrationSettings,
  saveStoredVibrationSettings,
  isVibrationSupported as checkVibrationSupported,
} from '../services/vibrationService';

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'ALERT' | 'SUCCESS';
  link?: string;
  timestamp: string;
}

interface NotificationContextType {
  permission: NotificationPermission;
  isSupported: boolean;
  requestPermission: () => Promise<NotificationPermission>;
  notify: (opts: {
    titleEn: string;
    titleAm: string;
    messageEn: string;
    messageAm: string;
    type?: 'INFO' | 'WARNING' | 'ALERT' | 'SUCCESS';
    link?: string;
    sound?: boolean;
    vibrate?: boolean | VibrationPatternType;
  }) => void;
  removeToast: (id: string) => void;
  toasts: ToastItem[];
  testNotification: () => void;
  testVibration: (pattern?: VibrationPatternType) => void;
  vibrationSettings: VibrationSettings;
  updateVibrationSettings: (partial: Partial<VibrationSettings>) => void;
  isVibrationSupported: boolean;
  notifications: INotification[];
  unreadCount: number;
  markAllRead: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const { isAmharic } = useLanguage();

  const [permission, setPermission] = useState<NotificationPermission>(getNotificationPermission());
  const [isSupported] = useState<boolean>(isNotificationSupported());
  const [isVibSupported] = useState<boolean>(checkVibrationSupported());
  const [vibrationSettings, setVibrationSettings] = useState<VibrationSettings>(getStoredVibrationSettings());
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const seenNotificationIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef<boolean>(true);

  // Keep permission state updated
  useEffect(() => {
    if (isSupported) {
      setPermission(getNotificationPermission());
    }
  }, [isSupported]);

  const updateVibrationSettings = useCallback((partial: Partial<VibrationSettings>) => {
    setVibrationSettings((prev) => {
      const updated = { ...prev, ...partial };
      saveStoredVibrationSettings(updated);
      return updated;
    });
  }, []);

  const testVibration = useCallback((pattern?: VibrationPatternType) => {
    const chosenPattern = pattern || vibrationSettings.pattern;
    triggerVibration(chosenPattern, true);
  }, [vibrationSettings.pattern]);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    const res = await requestNotificationPermission();
    setPermission(res);
    if (res === 'granted') {
      triggerBrowserNotification(
        isAmharic ? 'የማህደር ማሳወቂያ ነቅቷል' : 'FHC Branch One Archive Notifications Active',
        {
          body: isAmharic
            ? 'አሁን የሰነድ ጥያቄ፣ ማጽደቂያ እና የመመለሻ ማሳሰቢያዎችን ያገኛሉ።'
            : 'You will receive real-time alerts for document requests, approvals, and returns.',
          sound: true,
          vibrate: true,
          type: 'success',
        }
      );
    }
    return res;
  }, [isAmharic]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (opts: {
      titleEn: string;
      titleAm: string;
      messageEn: string;
      messageAm: string;
      type?: 'INFO' | 'WARNING' | 'ALERT' | 'SUCCESS';
      link?: string;
      sound?: boolean;
      vibrate?: boolean | VibrationPatternType;
    }) => {
      const type = opts.type || 'INFO';
      const title = isAmharic ? opts.titleAm : opts.titleEn;
      const message = isAmharic ? opts.messageAm : opts.messageEn;

      // Determine if vibration should trigger based on settings & event category
      const shouldVibrate = (() => {
        if (opts.vibrate === false) return false;
        if (!vibrationSettings.enabled) return false;
        if (opts.link?.includes('request') && !vibrationSettings.vibrateOnRequests) return false;
        if (opts.link?.includes('approval') && !vibrationSettings.vibrateOnApprovals) return false;
        if (
          (opts.link?.includes('movement') ||
            opts.titleEn.toLowerCase().includes('return') ||
            opts.messageEn.toLowerCase().includes('return')) &&
          !vibrationSettings.vibrateOnReturns
        ) {
          return false;
        }
        if ((type === 'ALERT' || type === 'WARNING') && !vibrationSettings.vibrateOnAlerts) return false;
        return true;
      })();

      const patternToUse = shouldVibrate
        ? (typeof opts.vibrate === 'string'
            ? opts.vibrate
            : vibrationSettings.pattern)
        : undefined;

      // 1. Play audio chime and trigger native browser notification with vibration
      triggerBrowserNotification(title, {
        body: message,
        sound: opts.sound !== false,
        vibrate: shouldVibrate ? patternToUse : false,
        type: type === 'SUCCESS' ? 'success' : type === 'ALERT' || type === 'WARNING' ? 'warning' : 'info',
        onClick: () => {
          if (opts.link) {
            window.location.hash = opts.link;
          }
        },
      });

      // 2. Add in-app floating toast
      const toastId = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newToast: ToastItem = {
        id: toastId,
        title,
        message,
        type,
        link: opts.link,
        timestamp: new Date().toISOString(),
      };

      setToasts((prev) => [newToast, ...prev.slice(0, 4)]);

      // Auto dismiss after 6 seconds
      setTimeout(() => {
        removeToast(toastId);
      }, 6000);
    },
    [isAmharic, removeToast, vibrationSettings]
  );

  const testNotification = useCallback(() => {
    notify({
      titleEn: 'FHC Archive System Notification Test',
      titleAm: 'የኤፍ.ኤች.ሲ ማህደር ስርዓት የማሳወቂያ ሙከራ',
      messageEn: 'Browser notifications, audio chimes, and haptic vibration are operating correctly.',
      messageAm: 'የአሳሽ ማሳወቂያዎች፣ የድምፅ ምልክቶች እና የንዝረት ምልክት በአግባቡ እየሰሩ ነው።',
      type: 'SUCCESS',
      sound: true,
      vibrate: true,
    });
  }, [notify]);


  // Sync notifications from server and dispatch browser alerts for new items
  const syncServerNotifications = useCallback(async () => {
    if (!token || !user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      const res = await fetch('/api/notifications', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      if (res.ok) {
        const data = await res.json();
        const serverNotifs: INotification[] = Array.isArray(data.notifications) ? data.notifications : [];
        setNotifications(serverNotifs);
        const count = typeof data.unreadCount === 'number'
          ? data.unreadCount
          : serverNotifs.filter((n) => !n.read).length;
        setUnreadCount(count);

        // On first run, mark existing as seen so we don't spam the user with history
        if (isFirstLoad.current) {
          serverNotifs.forEach((n) => seenNotificationIds.current.add(n.id));
          isFirstLoad.current = false;
          return;
        }

        // For any newly received notification that wasn't seen:
        serverNotifs.forEach((n) => {
          if (!seenNotificationIds.current.has(n.id)) {
            seenNotificationIds.current.add(n.id);
            if (!n.read) {
              notify({
                titleEn: n.titleEn,
                titleAm: n.titleAm,
                messageEn: n.messageEn,
                messageAm: n.messageAm,
                type: n.type,
                link: n.link,
                sound: true,
              });
            }
          }
        });
      }
    } catch (err) {
      // Quiet debug log only; avoids console.error during server boot
      console.debug('Failed to poll notifications:', err);
    }
  }, [token, user, notify]);

  const markAllRead = useCallback(async () => {
    if (!token || !user) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await fetch('/api/notifications/mark-all-read', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.debug('Failed to mark all read:', err);
    }
  }, [token, user]);

  const markAsRead = useCallback(async (id: string) => {
    if (!token || !user) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.debug('Failed to mark notification read:', err);
    }
  }, [token, user]);

  const refreshNotifications = useCallback(async () => {
    await syncServerNotifications();
  }, [syncServerNotifications]);

  // Check for return deadlines ("when a user need to return")
  const checkReturnDeadlines = useCallback(async () => {
    if (!token || !user) return;
    try {
      const res = await fetch('/api/notifications/check-returns', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.alertedCount && data.alertedCount > 0) {
          // Re-sync to pick up the newly generated return notifications
          syncServerNotifications();
        }
      }
    } catch (err) {
      console.debug('Failed to check return deadlines:', err);
    }
  }, [token, user, syncServerNotifications]);

  useEffect(() => {
    if (!token || !user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    // Reset initial load tracking on user/token change
    isFirstLoad.current = true;
    seenNotificationIds.current.clear();

    syncServerNotifications();
    checkReturnDeadlines();

    // Poll every 10 seconds for real-time responsiveness
    const interval = setInterval(() => {
      syncServerNotifications();
    }, 10000);

    // Check return deadlines every 60 seconds
    const returnInterval = setInterval(() => {
      checkReturnDeadlines();
    }, 60000);

    return () => {
      clearInterval(interval);
      clearInterval(returnInterval);
    };
  }, [token, user, syncServerNotifications, checkReturnDeadlines]);

  const getTypeStyle = (type: ToastItem['type']) => {
    switch (type) {
      case 'SUCCESS':
        return {
          container: 'border-emerald-500/40 bg-white/95 text-slate-900 shadow-xl shadow-emerald-950/10 dark:bg-slate-900 dark:text-white',
          accentBar: 'bg-emerald-600',
          iconBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400',
          icon: <CheckCircle2 className="h-5 w-5" />,
          badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          badgeText: isAmharic ? 'ተሳክቷል' : 'Success',
        };
      case 'WARNING':
        return {
          container: 'border-amber-500/40 bg-white/95 text-slate-900 shadow-xl shadow-amber-950/10 dark:bg-slate-900 dark:text-white',
          accentBar: 'bg-amber-500',
          iconBg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-400',
          icon: <AlertTriangle className="h-5 w-5" />,
          badge: 'bg-amber-100 text-amber-800 border-amber-200',
          badgeText: isAmharic ? 'ማስጠንቀቂያ' : 'Warning',
        };
      case 'ALERT':
        return {
          container: 'border-rose-500/40 bg-white/95 text-slate-900 shadow-xl shadow-rose-950/10 dark:bg-slate-900 dark:text-white',
          accentBar: 'bg-rose-600',
          iconBg: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-400',
          icon: <AlertCircle className="h-5 w-5" />,
          badge: 'bg-rose-100 text-rose-800 border-rose-200',
          badgeText: isAmharic ? 'አስቸኳይ' : 'Urgent Alert',
        };
      default:
        return {
          container: 'border-blue-500/40 bg-white/95 text-slate-900 shadow-xl shadow-blue-950/10 dark:bg-slate-900 dark:text-white',
          accentBar: 'bg-blue-600',
          iconBg: 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-400',
          icon: <Info className="h-5 w-5" />,
          badge: 'bg-blue-100 text-blue-800 border-blue-200',
          badgeText: isAmharic ? 'መረጃ' : 'Info',
        };
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        permission,
        isSupported,
        requestPermission,
        notify,
        removeToast,
        toasts,
        testNotification,
        testVibration,
        vibrationSettings,
        updateVibrationSettings,
        isVibrationSupported: isVibSupported,
        notifications,
        unreadCount,
        markAllRead,
        markAsRead,
        refreshNotifications,
      }}
    >
      {children}

      {/* Floating In-App Toast Popup Notification Stack */}
      <div className="fixed top-20 right-4 z-50 flex flex-col space-y-3 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => {
          const style = getTypeStyle(toast.type);
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto relative overflow-hidden rounded-xl border p-4 shadow-2xl backdrop-blur-md transition-all duration-300 ease-out transform translate-y-0 animate-in fade-in slide-in-from-top-4 ${style.container}`}
            >
              {/* Left accent indicator bar */}
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${style.accentBar}`} />

              <div className="flex items-start justify-between gap-3 pl-1.5">
                <div className="flex items-start space-x-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-xs ${style.iconBg}`}>
                    {style.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold border uppercase tracking-wider ${style.badge}`}>
                        {style.badgeText}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(toast.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <h4 className="mt-1 text-xs font-bold leading-tight text-slate-900 truncate">
                      {toast.title}
                    </h4>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed line-clamp-3">
                      {toast.message}
                    </p>

                    {toast.link && (
                      <button
                        onClick={() => {
                          if (toast.link) {
                            window.location.hash = toast.link;
                            removeToast(toast.id);
                          }
                        }}
                        className="mt-2 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center space-x-1"
                      >
                        <span>{isAmharic ? 'ዝርዝር ተመልከት' : 'View Details'}</span>
                        <span>→</span>
                      </button>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => removeToast(toast.id)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                  aria-label="Close notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

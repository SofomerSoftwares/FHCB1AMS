/**
 * Browser-based notification service.
 * Supports:
 * - HTML5 Desktop Notifications (window.Notification)
 * - Web Audio API notification chimes (gentle dual-tone harmonic audio)
 * - Browser permission detection and request flow
 */

let audioCtx: AudioContext | null = null;

export const isNotificationSupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

export const getNotificationPermission = (): NotificationPermission => {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
};

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!isNotificationSupported()) return 'denied';
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn('Failed to request notification permission:', err);
    return Notification.permission;
  }
};

/**
 * Synthesizes a clean, pleasant two-tone chime via Web Audio API.
 * Frequency 1: 587.33 Hz (D5) -> Frequency 2: 880 Hz (A5)
 */
export const playNotificationChime = (type: 'info' | 'success' | 'alert' | 'warning' = 'info'): void => {
  if (typeof window === 'undefined') return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;

    // Frequencies tailored to notification urgency
    let f1 = 587.33; // D5
    let f2 = 880.00; // A5
    if (type === 'alert' || type === 'warning') {
      f1 = 659.25; // E5
      f2 = 523.25; // C5
    } else if (type === 'success') {
      f1 = 523.25; // C5
      f2 = 1046.50; // C6
    }

    // First tone
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(f1, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Second harmonic tone
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(f2, now + 0.12);
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.22, now + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.6);
  } catch (err) {
    // Audio autoplay or permission restriction gracefully ignored
    console.debug('Notification audio playback skipped:', err);
  }
};

import {
  triggerVibration,
  getPatternForNotificationType,
  VibrationPatternType,
  isVibrationSupported as checkVibrationSupported,
} from './vibrationService';

export interface DesktopNotificationOptions {
  body: string;
  tag?: string;
  icon?: string;
  badge?: string;
  onClick?: () => void;
  sound?: boolean;
  vibrate?: boolean | number[] | VibrationPatternType;
  type?: 'info' | 'success' | 'alert' | 'warning';
}

/**
 * Triggers a native browser notification (if permission granted),
 * Web Audio chime, and device vibration.
 */
export const triggerBrowserNotification = (
  title: string,
  options: DesktopNotificationOptions
): Notification | null => {
  // 1. Play chime if sound is enabled
  if (options.sound !== false) {
    playNotificationChime(options.type || 'info');
  }

  // 2. Trigger Web Vibration API on device
  let vibrationPattern: number[] | undefined;
  if (options.vibrate !== false) {
    if (Array.isArray(options.vibrate)) {
      vibrationPattern = options.vibrate;
    } else if (typeof options.vibrate === 'string') {
      vibrationPattern = getPatternForNotificationType(options.type, options.vibrate);
    } else {
      vibrationPattern = getPatternForNotificationType(options.type);
    }
    triggerVibration(vibrationPattern, true);
  }

  if (!isNotificationSupported()) return null;

  if (Notification.permission === 'granted') {
    try {
      const notificationInit: NotificationOptions = {
        body: options.body,
        tag: options.tag || `fhc-archive-${Date.now()}`,
        icon: options.icon || '/favicon.ico',
      };

      // Pass vibrate array to Notification options for Android/mobile Chrome
      if (vibrationPattern) {
        (notificationInit as any).vibrate = vibrationPattern;
      }

      const notification = new Notification(title, notificationInit);

      notification.onclick = () => {
        window.focus();
        if (options.onClick) {
          options.onClick();
        }
        notification.close();
      };

      return notification;
    } catch (err) {
      console.warn('Native notification failed:', err);
      return null;
    }
  }

  return null;
};


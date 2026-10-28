/**
 * Web Vibration API Service for ArchiveTrack.
 *
 * Provides haptic feedback when notifications are received for:
 * - Document borrow requests
 * - Manager approvals and rejections
 * - Return deadline approaches and overdue warnings ("when a user needs to return")
 * - Missing file investigations & security alerts
 */

export type VibrationPatternType = 'default' | 'subtle' | 'urgent' | 'heartbeat';

export interface VibrationSettings {
  enabled: boolean;
  pattern: VibrationPatternType;
  vibrateOnRequests: boolean;
  vibrateOnApprovals: boolean;
  vibrateOnReturns: boolean;
  vibrateOnAlerts: boolean;
}

export const VIBRATION_PATTERNS: Record<VibrationPatternType, number[]> = {
  // Classic double pulse: 200ms buzz, 100ms pause, 200ms buzz
  default: [200, 100, 200],
  // Subtle gentle pulse: 100ms buzz, 60ms pause, 100ms buzz
  subtle: [100, 60, 100],
  // Urgent triple pulse: 300ms buzz, 100ms pause, 300ms buzz, 100ms pause, 300ms buzz
  urgent: [300, 100, 300, 100, 300],
  // Distinctive heartbeat rhythm: 120ms buzz, 120ms pause, 240ms buzz
  heartbeat: [120, 120, 240],
};

const STORAGE_KEY = 'fhc_archive_vibration_settings';

export const DEFAULT_VIBRATION_SETTINGS: VibrationSettings = {
  enabled: true,
  pattern: 'default',
  vibrateOnRequests: true,
  vibrateOnApprovals: true,
  vibrateOnReturns: true,
  vibrateOnAlerts: true,
};

const getStorage = (): Storage | null => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
    return (globalThis as any).localStorage;
  }
  return null;
};

/**
 * Checks whether the current browser/device supports the Web Vibration API.
 */
export const isVibrationSupported = (): boolean => {
  return (
    typeof navigator !== 'undefined' &&
    'vibrate' in navigator &&
    typeof (navigator as any).vibrate === 'function'
  );
};

/**
 * Retrieves persisted vibration settings from localStorage or defaults.
 */
export const getStoredVibrationSettings = (): VibrationSettings => {
  const storage = getStorage();
  if (!storage) {
    return { ...DEFAULT_VIBRATION_SETTINGS };
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VIBRATION_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_VIBRATION_SETTINGS.enabled,
      pattern: parsed.pattern && parsed.pattern in VIBRATION_PATTERNS ? parsed.pattern : DEFAULT_VIBRATION_SETTINGS.pattern,
      vibrateOnRequests: typeof parsed.vibrateOnRequests === 'boolean' ? parsed.vibrateOnRequests : true,
      vibrateOnApprovals: typeof parsed.vibrateOnApprovals === 'boolean' ? parsed.vibrateOnApprovals : true,
      vibrateOnReturns: typeof parsed.vibrateOnReturns === 'boolean' ? parsed.vibrateOnReturns : true,
      vibrateOnAlerts: typeof parsed.vibrateOnAlerts === 'boolean' ? parsed.vibrateOnAlerts : true,
    };
  } catch (e) {
    return { ...DEFAULT_VIBRATION_SETTINGS };
  }
};

/**
 * Persists vibration settings to localStorage.
 */
export const saveStoredVibrationSettings = (settings: VibrationSettings): void => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.debug('Failed to save vibration settings to localStorage:', e);
  }
};

/**
 * Calculates the appropriate vibration pattern for a given notification type.
 */
export const getPatternForNotificationType = (
  type?: 'INFO' | 'WARNING' | 'ALERT' | 'SUCCESS' | 'info' | 'warning' | 'alert' | 'success',
  userPreset: VibrationPatternType = 'default'
): number[] => {
  const normType = type ? type.toLowerCase() : 'info';
  if (normType === 'alert' || normType === 'warning') {
    return VIBRATION_PATTERNS.urgent;
  }
  if (normType === 'success') {
    return [150, 75, 150];
  }
  return VIBRATION_PATTERNS[userPreset] || VIBRATION_PATTERNS.default;
};

/**
 * Triggers device vibration via Web Vibration API.
 * Returns true if the vibration was successfully dispatched, false otherwise.
 */
export const triggerVibration = (
  pattern?: number[] | number | VibrationPatternType,
  enabled: boolean = true
): boolean => {
  if (!enabled || !isVibrationSupported()) {
    return false;
  }

  try {
    let resolvedPattern: number | number[];
    if (typeof pattern === 'string' && pattern in VIBRATION_PATTERNS) {
      resolvedPattern = VIBRATION_PATTERNS[pattern as VibrationPatternType];
    } else if (Array.isArray(pattern) || typeof pattern === 'number') {
      resolvedPattern = pattern;
    } else {
      resolvedPattern = VIBRATION_PATTERNS.default;
    }

    const success = navigator.vibrate(resolvedPattern);
    return Boolean(success);
  } catch (err) {
    console.debug('Vibration dispatch failed or blocked by browser policy:', err);
    return false;
  }
};

/**
 * Cancels any ongoing vibration pattern.
 */
export const stopVibration = (): void => {
  if (isVibrationSupported()) {
    try {
      navigator.vibrate(0);
    } catch {
      // Ignored
    }
  }
};

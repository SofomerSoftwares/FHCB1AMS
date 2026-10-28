import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isVibrationSupported,
  getPatternForNotificationType,
  triggerVibration,
  stopVibration,
  VIBRATION_PATTERNS,
  DEFAULT_VIBRATION_SETTINGS,
  getStoredVibrationSettings,
  saveStoredVibrationSettings,
} from '../src/services/vibrationService';
import { triggerBrowserNotification } from '../src/services/browserNotifications';

describe('Vibration & Notification Feedback Tests', () => {
  let store: Record<string, string> = {};
  let mockVibrate: any;

  beforeEach(() => {
    store = {};
    mockVibrate = vi.fn().mockReturnValue(true);

    // Mock localStorage
    const mockLocalStorage = {
      getItem: vi.fn((k: string) => (k in store ? store[k] : null)),
      setItem: vi.fn((k: string, v: string) => {
        store[k] = String(v);
      }),
      removeItem: vi.fn((k: string) => {
        delete store[k];
      }),
      clear: vi.fn(() => {
        store = {};
      }),
    };

    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      configurable: true,
      writable: true,
    });

    // Mock navigator.vibrate
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        ...(globalThis.navigator || {}),
        vibrate: mockVibrate,
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Web Vibration API Detection', () => {
    it('should return true when navigator.vibrate function exists', () => {
      expect(isVibrationSupported()).toBe(true);
    });

    it('should return false if navigator.vibrate is removed', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        configurable: true,
        writable: true,
      });
      expect(isVibrationSupported()).toBe(false);
    });
  });

  describe('2. Pattern Resolution by Notification Type', () => {
    it('should resolve urgent pattern for ALERT and WARNING types', () => {
      const alertPattern = getPatternForNotificationType('ALERT');
      expect(alertPattern).toEqual(VIBRATION_PATTERNS.urgent);

      const warningPattern = getPatternForNotificationType('WARNING');
      expect(warningPattern).toEqual(VIBRATION_PATTERNS.urgent);

      const lowerAlert = getPatternForNotificationType('alert');
      expect(lowerAlert).toEqual(VIBRATION_PATTERNS.urgent);
    });

    it('should resolve success double-pulse for SUCCESS notifications', () => {
      const successPattern = getPatternForNotificationType('SUCCESS');
      expect(successPattern).toEqual([150, 75, 150]);
    });

    it('should return chosen preset or default for INFO notifications', () => {
      const defaultPattern = getPatternForNotificationType('INFO', 'default');
      expect(defaultPattern).toEqual(VIBRATION_PATTERNS.default);

      const subtlePattern = getPatternForNotificationType('INFO', 'subtle');
      expect(subtlePattern).toEqual(VIBRATION_PATTERNS.subtle);

      const heartbeatPattern = getPatternForNotificationType('INFO', 'heartbeat');
      expect(heartbeatPattern).toEqual(VIBRATION_PATTERNS.heartbeat);
    });
  });

  describe('3. Triggering and Cancelling Vibration', () => {
    it('should safely do nothing when disabled', () => {
      const result = triggerVibration(VIBRATION_PATTERNS.default, false);
      expect(result).toBe(false);
      expect(mockVibrate).not.toHaveBeenCalled();
    });

    it('should call navigator.vibrate with pattern array when enabled', () => {
      const result = triggerVibration(VIBRATION_PATTERNS.default, true);
      expect(result).toBe(true);
      expect(mockVibrate).toHaveBeenCalledWith(VIBRATION_PATTERNS.default);
    });

    it('should resolve pattern name string to numeric array', () => {
      triggerVibration('heartbeat', true);
      expect(mockVibrate).toHaveBeenCalledWith(VIBRATION_PATTERNS.heartbeat);
    });

    it('should cancel active vibration via stopVibration (vibrate 0)', () => {
      stopVibration();
      expect(mockVibrate).toHaveBeenCalledWith(0);
    });

    it('should catch any browser gesture or permission errors gracefully without throwing', () => {
      mockVibrate.mockImplementation(() => {
        throw new Error('User gesture required');
      });

      expect(() => {
        const result = triggerVibration([200, 100, 200], true);
        expect(result).toBe(false);
      }).not.toThrow();
    });
  });

  describe('4. Settings Persistence', () => {
    it('should return default settings when localStorage is empty', () => {
      const settings = getStoredVibrationSettings();
      expect(settings.enabled).toBe(true);
      expect(settings.pattern).toBe('default');
      expect(settings.vibrateOnRequests).toBe(true);
      expect(settings.vibrateOnApprovals).toBe(true);
      expect(settings.vibrateOnReturns).toBe(true);
      expect(settings.vibrateOnAlerts).toBe(true);
    });

    it('should save and load customized settings from localStorage', () => {
      const custom = {
        ...DEFAULT_VIBRATION_SETTINGS,
        pattern: 'heartbeat' as const,
        vibrateOnRequests: false,
      };
      saveStoredVibrationSettings(custom);

      const retrieved = getStoredVibrationSettings();
      expect(retrieved.pattern).toBe('heartbeat');
      expect(retrieved.vibrateOnRequests).toBe(false);
      expect(retrieved.vibrateOnApprovals).toBe(true);
    });
  });

  describe('5. Browser Notification with Vibration Integration', () => {
    it('should invoke device vibration when triggerBrowserNotification is called', () => {
      triggerBrowserNotification('Test Title', {
        body: 'Testing notification vibration',
        vibrate: true,
        type: 'alert',
        sound: false,
      });

      expect(mockVibrate).toHaveBeenCalledWith(VIBRATION_PATTERNS.urgent);
    });

    it('should skip vibration if vibrate is explicitly set to false', () => {
      triggerBrowserNotification('Silent Alert', {
        body: 'No vibration expected',
        vibrate: false,
        sound: false,
      });

      expect(mockVibrate).not.toHaveBeenCalled();
    });
  });
});

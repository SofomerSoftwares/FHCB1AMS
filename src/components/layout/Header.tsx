import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  LogOut,
  Menu,
  ChevronDown,
  Volume2,
  Sliders,
  Vibrate,
  VibrateOff,
  Shield,
  Building,
  CheckCircle2,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { INotification } from '../../types';

interface HeaderProps {
  onToggleSidebar: () => void;
  onNavigate?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, onNavigate }) => {
  const { locale, setLocale, t, isAmharic } = useLanguage();
  const { user, department, logout } = useAuth();
  const {
    notifications,
    unreadCount,
    markAllRead,
    markAsRead,
    permission,
    requestPermission,
    testNotification,
    testVibration,
    vibrationSettings,
    updateVibrationSettings,
  } = useNotification();

  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);
  const [isVibratingAnim, setIsVibratingAnim] = useState<boolean>(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTestVibrate = () => {
    testVibration();
    setIsVibratingAnim(true);
    setTimeout(() => setIsVibratingAnim(false), 800);
  };

  const handleNotificationClick = (n: INotification) => {
    if (!n.read) {
      markAsRead(n.id);
    }
    if (n.link && onNavigate) {
      const tab = n.link.replace('#', '').split('?')[0];
      const validTabs = [
        'dashboard',
        'documents',
        'locations',
        'requests',
        'approvals',
        'movements',
        'investigations',
        'reports',
        'users',
        'departments',
        'audit',
        'settings',
      ];
      if (validTabs.includes(tab)) {
        onNavigate(tab);
        setShowNotifications(false);
      }
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/90 bg-white px-4 shadow-xs sm:px-6">
      {/* Left: Mobile Toggle & Brand Architecture */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300 lg:hidden cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-3">
          {/* Institutional Coat / Seal */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-800 to-emerald-950 text-emerald-100 font-extrabold shadow-xs border border-emerald-700/60">
            <span className="text-[11px] font-black tracking-wider text-amber-300">FHC</span>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                {t('app.title')}
              </h1>
              <span className="hidden sm:inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200/80">
                Branch 1
              </span>
            </div>
            <p className="hidden text-[11px] text-slate-500 lg:block truncate max-w-md">
              {isAmharic
                ? 'የፌዴራል ቤቶች ኮርፖሬሽን - ቅርንጫፍ አንድ የማህደር ስርዓት'
                : 'Federal Housing Corporation • Branch One Physical Archive'}
            </p>
          </div>
        </div>
      </div>

      {/* Right Controls: Clean, Uncluttered, Enterprise-Grade */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Language Switcher Pill */}
        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 text-xs font-medium">
          <button
            onClick={() => setLocale('en')}
            className={`rounded-md px-2.5 py-1 text-xs transition cursor-pointer ${
              locale === 'en'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => setLocale('am')}
            className={`rounded-md px-2.5 py-1 text-xs transition cursor-pointer ${
              locale === 'am'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            አማርኛ
          </button>
        </div>

        {/* Subtle Divider */}
        <div className="h-5 w-px bg-slate-200 hidden sm:block" />

        {/* Notifications Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            title={isAmharic ? 'ማሳወቂያዎች' : 'Notifications'}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white p-3 shadow-xl z-50">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  {isAmharic ? 'ማሳወቂያዎች' : 'Notifications'} ({unreadCount})
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                  >
                    {isAmharic ? 'ሁሉንም እንዳነበብኩ አድርግ' : 'Mark all read'}
                  </button>
                )}
              </div>

              {/* Notification Preferences & Quick Action */}
              <div className="mt-2.5 mb-2 rounded-lg bg-slate-50 p-2.5 border border-slate-200/80 text-xs space-y-2">
                {/* Browser Alert Preference */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Volume2 className="h-3.5 w-3.5 text-emerald-700" />
                    <span className="font-semibold text-slate-800">
                      {isAmharic ? 'የአሳሽ ማሳወቂያ እና ድምፅ' : 'Browser Alerts & Sound'}
                    </span>
                  </div>
                  {permission === 'granted' ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                      {isAmharic ? 'ነቅቷል' : 'Active'}
                    </span>
                  ) : permission === 'denied' ? (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 border border-rose-200">
                      {isAmharic ? 'ተዘግቷል' : 'Blocked'}
                    </span>
                  ) : (
                    <button
                      onClick={requestPermission}
                      className="rounded-md bg-emerald-700 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-800 transition cursor-pointer"
                    >
                      {isAmharic ? 'ፍቀድ' : 'Enable'}
                    </button>
                  )}
                </div>

                {/* Vibration Feedback */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/70">
                  <div className="flex items-center space-x-1.5">
                    {vibrationSettings.enabled ? (
                      <Vibrate
                        className={`h-3.5 w-3.5 text-indigo-600 ${
                          isVibratingAnim ? 'animate-bounce text-amber-600' : ''
                        }`}
                      />
                    ) : (
                      <VibrateOff className="h-3.5 w-3.5 text-slate-400" />
                    )}
                    <span className="font-semibold text-slate-800">
                      {isAmharic ? 'የማሳወቂያ ንዝረት' : 'Haptic Vibration'}
                    </span>
                  </div>
                  <button
                    onClick={() => updateVibrationSettings({ enabled: !vibrationSettings.enabled })}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition border cursor-pointer ${
                      vibrationSettings.enabled
                        ? 'bg-indigo-100 text-indigo-800 border-indigo-200 hover:bg-indigo-200'
                        : 'bg-slate-200 text-slate-600 border-slate-300 hover:bg-slate-300'
                    }`}
                  >
                    {vibrationSettings.enabled
                      ? isAmharic
                        ? 'ነቅቷል'
                        : 'Enabled'
                      : isAmharic
                      ? 'ተዘግቷል'
                      : 'Off'}
                  </button>
                </div>

                {/* Testing Action Bar */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                  <span>{isAmharic ? 'ለጥያቄ እና ርክክብ' : 'On request & handover'}</span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleTestVibrate}
                      className={`font-semibold transition hover:underline cursor-pointer ${
                        isVibratingAnim ? 'text-amber-600 font-bold' : 'text-indigo-600'
                      }`}
                    >
                      {isVibratingAnim
                        ? isAmharic
                          ? 'እየነዘረ ነው...'
                          : 'Vibrating...'
                        : isAmharic
                        ? 'ንዝረት ሞክር'
                        : 'Test Vibrate'}
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      onClick={testNotification}
                      className="text-emerald-700 font-semibold hover:underline cursor-pointer"
                    >
                      {isAmharic ? 'ማሳወቂያ ሞክር' : 'Test Alert'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Notification List */}
              <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto mt-2">
                {notifications.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500">
                    {isAmharic ? 'ምንም አዲስ ማሳወቂያ የለም' : 'No notifications'}
                  </p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`py-2 px-2.5 text-xs rounded-lg transition cursor-pointer hover:bg-slate-50 ${
                        !n.read ? 'bg-blue-50/70 border-l-2 border-blue-500 font-medium' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">
                          {isAmharic ? n.titleAm : n.titleEn}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(n.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-0.5 text-slate-600 text-[11px]">
                        {isAmharic ? n.messageAm : n.messageEn}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Subtle Divider */}
        <div className="h-5 w-px bg-slate-200 hidden sm:block" />

        {/* User Profile Menu Pill */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center space-x-2 rounded-lg border border-slate-200 bg-slate-50/60 p-1.5 hover:bg-slate-100 hover:border-slate-300 transition cursor-pointer"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-emerald-400 text-xs font-black shadow-xs">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="hidden text-left md:block">
              <p className="text-xs font-bold text-slate-900 truncate max-w-[130px]">
                {isAmharic && user?.amharicName ? user.amharicName : user?.fullName}
              </p>
              <div className="flex items-center space-x-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <p className="text-[10px] font-semibold text-slate-500">{t(`roles.${user?.role || 'EMPLOYEE'}`)}</p>
              </div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50">
              {/* User Identity Card */}
              <div className="border-b border-slate-100 px-3 py-2.5">
                <p className="text-xs font-bold text-slate-900">{user?.fullName}</p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                {department && (
                  <div className="mt-1.5 flex items-center space-x-1.5 text-[10px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/80">
                    <Building className="h-3 w-3 shrink-0" />
                    <span className="truncate">{isAmharic ? department.nameAm : department.nameEn}</span>
                  </div>
                )}
                <div className="mt-1.5 flex items-center space-x-1.5 text-[10px] text-slate-600">
                  <Shield className="h-3 w-3 text-slate-400" />
                  <span>
                    Clearance: <strong className="text-slate-800">{user?.role}</strong>
                  </span>
                </div>
              </div>

              {/* Quick Navigation Links */}
              {onNavigate && (
                <div className="py-1 border-b border-slate-100">
                  <button
                    onClick={() => {
                      onNavigate('settings');
                      setShowProfileMenu(false);
                    }}
                    className="flex w-full items-center space-x-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <Sliders className="h-3.5 w-3.5 text-slate-500" />
                    <span>{isAmharic ? 'የስርዓት እና ፈቃድ ቅንብሮች' : 'Settings & RBAC Policy'}</span>
                  </button>
                </div>
              )}

              {/* Sign Out */}
              <div className="pt-1">
                <button
                  onClick={() => logout()}
                  className="flex w-full items-center space-x-2 rounded-lg px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>{t('nav.signOut')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

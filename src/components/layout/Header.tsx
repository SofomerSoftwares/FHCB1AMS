import React, { useState } from 'react';
import {
  Bell,
  Globe,
  User,
  LogOut,
  Building,
  ShieldAlert,
  CheckCircle,
  Clock,
  Menu,
  ChevronDown,
  Volume2,
  BellRing,
  Zap,
  Sliders,
  Vibrate,
  VibrateOff,
  Smartphone,
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
    isVibrationSupported,
  } = useNotification();

  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);
  const [isVibratingAnim, setIsVibratingAnim] = useState<boolean>(false);

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
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-4 shadow-xs sm:px-6">
      {/* Left: Mobile hamburger & Institutional Title */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-3">
          {/* Emblem placeholder / Ethiopian crest colors */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-800 text-white font-bold shadow-xs border border-emerald-900">
            <span className="text-xs tracking-wider">FHC</span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                {t('app.title')}
              </h1>
              <span className="hidden sm:inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
                Branch 1
              </span>
            </div>
            <p className="hidden text-xs text-slate-500 md:block truncate max-w-md">
              {isAmharic ? 'የፌዴራል ቤቶች ኮርፖሬሽን - ቅርንጫፍ አንድ የማህደር ስርዓት' : 'Federal Housing Corporation - Branch One Physical Archive'}
            </p>
          </div>
        </div>
      </div>

      {/* Right Controls: Fast Role Switcher, Language Switch, Notifications, Profile */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Institutional Role Clearance Badge */}
        <div className="hidden md:flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs">
          <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
          <span>{t(`roles.${user?.role || 'EMPLOYEE'}`)}</span>
        </div>

        {/* Language Switcher */}
        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
          <button
            onClick={() => setLocale('en')}
            className={`rounded-md px-2.5 py-1 transition ${
              locale === 'en'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => setLocale('am')}
            className={`rounded-md px-2.5 py-1 transition ${
              locale === 'am'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            አማርኛ
          </button>
        </div>

        {/* Fast Request Link in Header */}
        {onNavigate && (
          <button
            onClick={() => onNavigate('requests')}
            className="hidden md:inline-flex items-center space-x-1.5 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 transition shadow-xs cursor-pointer"
            title={isAmharic ? 'ወደ ፈጣን ሰነድ መጠየቂያ ሂድ' : 'Fast Request Physical Document'}
          >
            <Zap className="h-3.5 w-3.5 fill-current" />
            <span>{isAmharic ? 'ፈጣን ጥያቄ' : 'Fast Request'}</span>
          </button>
        )}

        {/* Settings & RBAC Button in Header */}
        {onNavigate && (
          <button
            onClick={() => onNavigate('settings')}
            className="hidden sm:inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
            title={isAmharic ? 'የስርዓት እና የመመለሻ ፖሊሲ ቅንብሮች' : 'System Settings & Return Policy'}
          >
            <Sliders className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden lg:inline">{isAmharic ? 'ቅንብሮች' : 'Settings'}</span>
          </button>
        )}

        {/* Quick Browser Notification Action (if not yet granted) */}
        {permission !== 'granted' && (
          <button
            onClick={requestPermission}
            title={isAmharic ? 'የአሳሽ ማሳወቂያዎችን ፍቀድ' : 'Enable Real-Time Browser Notifications'}
            className="hidden sm:inline-flex items-center space-x-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition shadow-2xs"
          >
            <BellRing className="h-3.5 w-3.5 animate-pulse text-emerald-700" />
            <span>{isAmharic ? 'ማሳወቂያ ፍቀድ' : 'Enable Alerts'}</span>
          </button>
        )}

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 transition"
            title="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                {unreadCount}
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
                    className="text-[11px] font-medium text-blue-600 hover:underline"
                  >
                    {isAmharic ? 'ሁሉንም እንዳነበብኩ አድርግ' : 'Mark all read'}
                  </button>
                )}
              </div>

              {/* Real-Time Browser Notification Banner */}
              <div className="mt-2 mb-2 rounded-lg bg-slate-50 p-2.5 border border-slate-200 text-xs space-y-2">
                {/* Audio & Browser Permission */}
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
                      className="rounded-md bg-emerald-700 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-800 transition"
                    >
                      {isAmharic ? 'ፍቀድ' : 'Enable'}
                    </button>
                  )}
                </div>

                {/* Vibration Feedback Row */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/80">
                  <div className="flex items-center space-x-1.5">
                    {vibrationSettings.enabled ? (
                      <Vibrate className={`h-3.5 w-3.5 text-indigo-600 ${isVibratingAnim ? 'animate-bounce text-amber-600' : ''}`} />
                    ) : (
                      <VibrateOff className="h-3.5 w-3.5 text-slate-400" />
                    )}
                    <span className="font-semibold text-slate-800">
                      {isAmharic ? 'የማሳወቂያ ንዝረት (Vibration)' : 'Notification Vibration'}
                    </span>
                  </div>
                  <button
                    onClick={() => updateVibrationSettings({ enabled: !vibrationSettings.enabled })}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition border ${
                      vibrationSettings.enabled
                        ? 'bg-indigo-100 text-indigo-800 border-indigo-200 hover:bg-indigo-200'
                        : 'bg-slate-200 text-slate-600 border-slate-300 hover:bg-slate-300'
                    }`}
                  >
                    {vibrationSettings.enabled
                      ? (isAmharic ? 'ነቅቷል' : 'Enabled')
                      : (isAmharic ? 'ተዘግቷል' : 'Off')}
                  </button>
                </div>

                {/* Testing Actions */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                  <span className="truncate max-w-[140px]">
                    {isAmharic ? 'ለጥያቄዎች፣ ማጽደቂያ እና መመለሻ' : 'Alert on request, approve & return'}
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleTestVibrate}
                      className={`font-semibold transition hover:underline ${
                        isVibratingAnim ? 'text-amber-600 font-bold' : 'text-indigo-600'
                      }`}
                      title={isAmharic ? 'የስልክ/መሣሪያ ንዝረት ሞክር' : 'Test haptic vibration'}
                    >
                      {isVibratingAnim
                        ? (isAmharic ? 'እየነዘረ ነው...' : 'Vibrating...')
                        : (isAmharic ? 'ንዝረት ሞክር' : 'Test Vibrate')}
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      onClick={testNotification}
                      className="text-emerald-700 font-semibold hover:underline"
                    >
                      {isAmharic ? 'ሙሉ ሞክር' : 'Test All'}
                    </button>
                  </div>
                </div>
              </div>
              <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto mt-2">
                {notifications.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-500">
                    {isAmharic ? 'ምንም አዲስ ማሳወቂያ የለም' : 'No notifications'}
                  </p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`py-2 px-2 text-xs rounded-lg transition cursor-pointer hover:bg-slate-50 ${
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

        {/* User Profile Menu */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center space-x-2 rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 transition"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-white text-xs font-bold">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-xs font-semibold text-slate-800 truncate max-w-[120px]">
                {isAmharic && user?.amharicName ? user.amharicName : user?.fullName}
              </p>
              <p className="text-[10px] text-slate-500">{user?.role}</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50">
              <div className="border-b border-slate-100 px-3 py-2">
                <p className="text-xs font-bold text-slate-900">{user?.fullName}</p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                {department && (
                  <p className="mt-1 text-[10px] font-medium text-emerald-700">
                    {isAmharic ? department.nameAm : department.nameEn}
                  </p>
                )}
              </div>

              <div className="pt-1">
                <button
                  onClick={() => logout()}
                  className="flex w-full items-center space-x-2 rounded-lg px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 transition"
                >
                  <LogOut className="h-4 w-4" />
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

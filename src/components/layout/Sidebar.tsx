import React from 'react';
import {
  LayoutDashboard,
  FileText,
  MapPin,
  ClipboardList,
  CheckSquare,
  History,
  AlertTriangle,
  BarChart3,
  Users,
  Building2,
  ShieldCheck,
  FolderArchive,
  ChevronRight,
  X,
  Sliders,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

export type ActiveTab =
  | 'dashboard'
  | 'documents'
  | 'locations'
  | 'requests'
  | 'approvals'
  | 'movements'
  | 'investigations'
  | 'reports'
  | 'users'
  | 'departments'
  | 'audit'
  | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpen,
  onClose,
}) => {
  const { t, isAmharic } = useLanguage();
  const { user, hasRole } = useAuth();

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    onClose();
  };

  const navItems = [
    {
      id: 'dashboard' as ActiveTab,
      label: t('nav.dashboard'),
      icon: LayoutDashboard,
      roles: ['ADMIN', 'ARCHIVE_OFFICER', 'DEPARTMENT_MANAGER', 'EMPLOYEE', 'AUDITOR'],
    },
    {
      id: 'documents' as ActiveTab,
      label: t('nav.documents'),
      icon: FileText,
      roles: ['ADMIN', 'ARCHIVE_OFFICER', 'DEPARTMENT_MANAGER', 'EMPLOYEE', 'AUDITOR'],
    },
    {
      id: 'locations' as ActiveTab,
      label: t('nav.locations'),
      icon: MapPin,
      roles: ['ADMIN', 'ARCHIVE_OFFICER', 'DEPARTMENT_MANAGER', 'AUDITOR'],
    },
    {
      id: 'requests' as ActiveTab,
      label: t('nav.requests'),
      icon: ClipboardList,
      roles: ['ADMIN', 'ARCHIVE_OFFICER', 'DEPARTMENT_MANAGER', 'EMPLOYEE', 'AUDITOR'],
    },
    {
      id: 'approvals' as ActiveTab,
      label: t('nav.approvals'),
      icon: CheckSquare,
      roles: ['ADMIN', 'DEPARTMENT_MANAGER'],
    },
    {
      id: 'movements' as ActiveTab,
      label: t('nav.movements'),
      icon: History,
      roles: ['ADMIN', 'ARCHIVE_OFFICER', 'DEPARTMENT_MANAGER', 'AUDITOR'],
    },
    {
      id: 'investigations' as ActiveTab,
      label: t('nav.investigations'),
      icon: AlertTriangle,
      roles: ['ADMIN', 'ARCHIVE_OFFICER', 'AUDITOR'],
    },
    {
      id: 'reports' as ActiveTab,
      label: t('nav.reports'),
      icon: BarChart3,
      roles: ['ADMIN', 'ARCHIVE_OFFICER', 'DEPARTMENT_MANAGER', 'AUDITOR'],
    },
    {
      id: 'users' as ActiveTab,
      label: t('nav.users'),
      icon: Users,
      roles: ['ADMIN'],
    },
    {
      id: 'departments' as ActiveTab,
      label: t('nav.departments'),
      icon: Building2,
      roles: ['ADMIN'],
    },
    {
      id: 'audit' as ActiveTab,
      label: t('nav.audit'),
      icon: ShieldCheck,
      roles: ['ADMIN', 'AUDITOR'],
    },
    {
      id: 'settings' as ActiveTab,
      label: isAmharic ? 'የስርዓት እና ፈቃድ ቅንብሮች' : 'Settings & RBAC Policy',
      icon: Sliders,
      roles: ['ADMIN', 'ARCHIVE_OFFICER', 'DEPARTMENT_MANAGER', 'EMPLOYEE', 'AUDITOR'],
    },
  ];

  const filteredNavItems = navItems.filter((item) => {
    if (!user) return false;
    return item.roles.includes(user.role);
  });

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-slate-900 text-slate-100 transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Institutional Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-black shadow-xs">
              <FolderArchive className="h-5 w-5" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-white">FHC Branch One</span>
              <span className="block text-[10px] text-emerald-400 font-medium">Archive System</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User Role Card inside sidebar */}
        <div className="mx-3 mt-4 rounded-lg bg-slate-800/80 p-3 border border-slate-700/60">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {isAmharic ? 'የስራ ኃላፊነት' : 'Active Role Clearance'}
            </p>
          </div>
          <p className="mt-0.5 text-xs font-semibold text-emerald-400">
            {t(`roles.${user?.role || 'EMPLOYEE'}`)}
          </p>
          <p className="text-[11px] text-slate-300 truncate mt-0.5">
            {user?.fullName}
          </p>
        </div>

        {/* Navigation list */}
        <nav className="mt-4 flex-1 space-y-1 px-3 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-xs font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {isActive && <ChevronRight className="h-3.5 w-3.5 opacity-70" />}
              </button>
            );
          })}
        </nav>

        {/* Institutional Footer */}
        <div className="border-t border-slate-800 p-3 text-[10px] text-slate-400 text-center">
          <p className="font-semibold text-slate-300">FHC Branch One Archive</p>
          <p className="text-slate-500 mt-0.5">Version 2026.1 • Security Hardened</p>
        </div>
      </aside>
    </>
  );
};

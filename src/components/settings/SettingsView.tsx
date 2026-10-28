import React, { useState, useEffect } from 'react';
import {
  Clock,
  Shield,
  Sliders,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Check,
  X,
  Calendar,
  Lock,
  Zap,
  Info,
  RefreshCw,
  Eye,
  FileText,
  Building,
  Bell,
  Vibrate,
  VibrateOff,
  Smartphone,
  Volume2,
  Sparkles,
  Radio,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import {
  VIBRATION_PATTERNS,
  VibrationPatternType,
  DEFAULT_VIBRATION_SETTINGS,
} from '../../services/vibrationService';
import {
  Role,
  PermissionKey,
  IReturnPolicySettings,
  IRolePermissions,
  ISystemSettings,
} from '../../types';

interface PermissionMeta {
  key: PermissionKey;
  labelEn: string;
  labelAm: string;
  category: 'DOCUMENTS' | 'REQUESTS' | 'CUSTODY' | 'DEADLINES' | 'ADMIN';
  descriptionEn: string;
  descriptionAm: string;
}

const PERMISSIONS_LIST: PermissionMeta[] = [
  // Documents
  {
    key: 'viewDocuments',
    labelEn: 'View Document Registry',
    labelAm: 'የማህደር ሰነዶችን መመልከት',
    category: 'DOCUMENTS',
    descriptionEn: 'Browse and search physical documents and metadata',
    descriptionAm: 'የተመዘገቡ ሰነዶችን እና መረጃዎችን መፈለግ እና መመልከት',
  },
  {
    key: 'registerDocuments',
    labelEn: 'Register New Document',
    labelAm: 'አዲስ ሰነድ መመዝገብ',
    category: 'DOCUMENTS',
    descriptionEn: 'Create and assign physical files to shelf/box coordinates',
    descriptionAm: 'አዳዲስ ሰነዶችን በቁምሳጥን እና በሳጥን መመደብ',
  },
  {
    key: 'editDocuments',
    labelEn: 'Edit Document Records',
    labelAm: 'የሰነድ መረጃዎችን ማስተካከል',
    category: 'DOCUMENTS',
    descriptionEn: 'Modify reference details, historical address, and classification',
    descriptionAm: 'የሰነዱን ማጣቀሻ፣ የቀድሞ አድራሻ እና ደረጃ ማሻሻል',
  },
  {
    key: 'importCsv',
    labelEn: 'Batch Import CSV',
    labelAm: 'የጅምላ CSV ሰነድ ማስመጣት',
    category: 'DOCUMENTS',
    descriptionEn: 'Import physical records in bulk with auto-generated references',
    descriptionAm: 'ብዙ ሰነዶችን በአንድ ጊዜ ከCSV ፋይል ማስመጣት',
  },

  // Requests
  {
    key: 'requestDocuments',
    labelEn: 'Submit Document Request',
    labelAm: 'የሰነድ ጥያቄ ማቅረብ',
    category: 'REQUESTS',
    descriptionEn: 'Submit standard request for physical file access',
    descriptionAm: 'የሰነድ ማውጣት መደበኛ ጥያቄ ማቅረብ',
  },
  {
    key: 'fastRequest',
    labelEn: 'Fast Request Access',
    labelAm: 'ፈጣን የሰነድ ጥያቄ ማቅረብ',
    category: 'REQUESTS',
    descriptionEn: 'One-click accelerated request with duration presets',
    descriptionAm: 'በአንድ ጠቅታ ፈጣን የሰነድ ጥያቄ ማቅረብ',
  },
  {
    key: 'requestExtension',
    labelEn: 'Request Return Extension',
    labelAm: 'የመመለሻ ጊዜ ማራዘሚያ መጠየቅ',
    category: 'REQUESTS',
    descriptionEn: 'Allow borrowers to request return deadline extensions',
    descriptionAm: 'ሰነድ የወሰዱ ተጠቃሚዎች የመመለሻ ጊዜ እንዲራዘምላቸው መጠየቅ',
  },

  // Custody & Handover
  {
    key: 'approveRequests',
    labelEn: 'Approve Access Requests',
    labelAm: 'የቀረቡ ጥያቄዎችን ማጽደቅ',
    category: 'CUSTODY',
    descriptionEn: 'Departmental approval for requested document custody',
    descriptionAm: 'የቀረቡትን የሰነድ ጥያቄዎች መገምገም እና ማጽደቅ',
  },
  {
    key: 'rejectRequests',
    labelEn: 'Reject Access Requests',
    labelAm: 'ጥያቄዎችን ውድቅ ማድረግ',
    category: 'CUSTODY',
    descriptionEn: 'Decline requests with formal justification',
    descriptionAm: 'የቀረቡ ጥያቄዎችን በምክንያት ውድቅ ማድረግ',
  },
  {
    key: 'issueHandover',
    labelEn: 'Physical File Handover / Issue',
    labelAm: 'ሰነዱን በአካል ማስረከብ',
    category: 'CUSTODY',
    descriptionEn: 'Release physical file to borrower and initiate custody clock',
    descriptionAm: 'ሰነዱን ለተጠያቂው በአካል አስረክቦ ሰዓት ማስጀመር',
  },
  {
    key: 'processReturn',
    labelEn: 'Inspect & Verify Return',
    labelAm: 'ሰነድ መመለስን አረጋግጦ መረከብ',
    category: 'CUSTODY',
    descriptionEn: 'Inspect returned document and place back into shelf/box',
    descriptionAm: 'የተመለሰውን ሰነድ ሁኔታ መርምሮ ወደ ማህደሩ መመለስ',
  },

  // Deadlines & Overdue
  {
    key: 'adjustReturnDate',
    labelEn: 'Adjust Returning Time & Date',
    labelAm: 'የመመለሻ ቀን እና ሰዓት ማስተካከል',
    category: 'DEADLINES',
    descriptionEn: 'Extend or modify return deadline for active requests with notification',
    descriptionAm: 'የተወሰዱ ሰነዶችን የመመለሻ ቀንና ሰዓት ማስተካከል እና ማራዘም',
  },
  {
    key: 'sendReturnNotice',
    labelEn: 'Send Return Demand Notice',
    labelAm: 'አስቸኳይ የመመለሻ ጥሪ መላክ',
    category: 'DEADLINES',
    descriptionEn: 'Dispatch high-priority browser alerts to borrowers with borrowed files',
    descriptionAm: 'ሰነዱን የያዙ ሰራተኞች እንዲመልሱ የአሳሽ አስቸኳይ ጥሪ መላክ',
  },

  // Administration
  {
    key: 'manageLocations',
    labelEn: 'Manage Archive Locations',
    labelAm: 'የማህደር ቦታዎችን ማስተዳደር',
    category: 'ADMIN',
    descriptionEn: 'Configure buildings, rooms, cabinets, shelves, and boxes',
    descriptionAm: 'ህንጻዎችን፣ ክፍሎችን፣ ሣጥኖችን እና መደርደሪያዎችን ማስተዳደር',
  },
  {
    key: 'manageUsers',
    labelEn: 'User Accounts & Roles',
    labelAm: 'የተጠቃሚ መለያዎችን ማስተዳደር',
    category: 'ADMIN',
    descriptionEn: 'Create, update, and deactivate user accounts and departments',
    descriptionAm: 'የተጠቃሚዎችን መለያ እና ስራ መፍጠርና ማስተካከል',
  },
  {
    key: 'manageDepartments',
    labelEn: 'Departments Management',
    labelAm: 'የስራ ክፍሎችን ማስተዳደር',
    category: 'ADMIN',
    descriptionEn: 'Manage directorates, branches, and manager assignments',
    descriptionAm: 'ዳይሬክቶሬቶችን እና የስራ ክፍል ኃላፊዎችን ማስተዳደር',
  },
  {
    key: 'viewAuditLogs',
    labelEn: 'View Security Audit Logs',
    labelAm: 'የደህንነት ኦዲት መዝገብ መመልከት',
    category: 'ADMIN',
    descriptionEn: 'Inspect tamper-evident chronological event ledgers',
    descriptionAm: 'የተከናወኑ ስርዓታዊ እንቅስቃሴዎችን ኦዲት መመርመር',
  },
  {
    key: 'manageInvestigations',
    labelEn: 'Missing File Investigations',
    labelAm: 'የጠፉ ሰነዶች ምርመራ',
    category: 'ADMIN',
    descriptionEn: 'Initiate and manage chain-of-custody loss investigations',
    descriptionAm: 'የጠፉ ሰነዶችን መመርመር እና ውሳኔ መስጠት',
  },
  {
    key: 'manageSettings',
    labelEn: 'System Settings & Return Policy',
    labelAm: 'የስርዓት እና የመመለሻ ፖሊሲ ማስተካከል',
    category: 'ADMIN',
    descriptionEn: 'Adjust borrowing return rules, deadline thresholds, and RBAC matrix',
    descriptionAm: 'የመመለሻ ቀናት ፖሊሲ፣ የሰዓት ገደብ እና የተጠቃሚ ፈቃድ ማስተካከል',
  },
];

const ALL_ROLES: Role[] = [
  'ADMIN',
  'ARCHIVE_OFFICER',
  'DEPARTMENT_MANAGER',
  'EMPLOYEE',
  'AUDITOR',
];

export const SettingsView: React.FC = () => {
  const { t, isAmharic } = useLanguage();
  const {
    user,
    token,
    hasPermission,
    refreshSettings,
  } = useAuth();
  const {
    notify,
    permission,
    requestPermission,
    testNotification,
    testVibration,
    vibrationSettings,
    updateVibrationSettings,
    isVibrationSupported,
  } = useNotification();

  const [activeTab, setActiveTab] = useState<'returnPolicy' | 'rbac' | 'notifications'>('returnPolicy');
  const [testingPattern, setTestingPattern] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);

  // Return policy state
  const [returnPolicy, setReturnPolicy] = useState<IReturnPolicySettings>({
    defaultReturnDays: 7,
    maxReturnDays: 30,
    minReturnDays: 1,
    defaultReturnTime: '17:00',
    allowRequesterExtensionRequest: true,
    overdueWarningHours: 24,
    quickDurationPresets: [3, 7, 14, 30],
    autoNotifyOnDueApproach: true,
    strictOverdueLockout: false,
  });

  // RBAC matrix state
  const [rolePermissions, setRolePermissions] = useState<IRolePermissions>({
    ADMIN: [],
    ARCHIVE_OFFICER: [],
    DEPARTMENT_MANAGER: [],
    EMPLOYEE: [],
    AUDITOR: [],
  });

  const [presetInput, setPresetInput] = useState<string>('3, 7, 14, 30');

  const fetchSettingsData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const settings: ISystemSettings = data.settings;
        if (settings.returnPolicy) {
          setReturnPolicy(settings.returnPolicy);
          if (Array.isArray(settings.returnPolicy.quickDurationPresets)) {
            setPresetInput(settings.returnPolicy.quickDurationPresets.join(', '));
          }
        }
        if (settings.rolePermissions) {
          setRolePermissions(settings.rolePermissions);
        }
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettingsData();
  }, [token]);

  // Toggle permission for a role in local state
  const handleTogglePermission = (role: Role, key: PermissionKey) => {
    // Admin always has all permissions
    if (role === 'ADMIN') return;

    setRolePermissions((prev) => {
      const currentList = prev[role] || [];
      const hasIt = currentList.includes(key);
      const updatedList = hasIt
        ? currentList.filter((k) => k !== key)
        : [...currentList, key];

      return {
        ...prev,
        [role]: updatedList,
      };
    });
  };

  // Save Settings
  const handleSaveSettings = async () => {
    if (!token) return;
    setSaving(true);

    try {
      // Parse preset input
      const parsedPresets = presetInput
        .split(',')
        .map((p) => parseInt(p.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0 && n <= returnPolicy.maxReturnDays);

      const finalPresets = parsedPresets.length > 0 ? parsedPresets : [3, 7, 14, 30];

      const payload = {
        returnPolicy: {
          ...returnPolicy,
          quickDurationPresets: finalPresets,
        },
        rolePermissions,
      };

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        notify({
          titleEn: 'Failed to Save Settings',
          titleAm: 'ቅንብሩን ማስቀመጥ አልተሳካም',
          messageEn: data.error || 'Server rejected settings update.',
          messageAm: data.error || 'ቅንብሩን ማስቀመጥ አልተቻለም።',
          type: 'ALERT',
          sound: true,
        });
        return;
      }

      await refreshSettings();
      notify({
        titleEn: 'Settings & RBAC Saved',
        titleAm: 'የስርዓት እና የተጠቃሚ ፈቃድ ቅንብሮች ተቀምጠዋል',
        messageEn: 'Return schedule policies and Role-Based Access permissions have been updated.',
        messageAm: 'የመመለሻ ቀን ፖሊሲ እና የተጠቃሚ ሚና ፈቃዶች በተሳካ ሁኔታ ተሻሽለዋል።',
        type: 'SUCCESS',
        sound: true,
      });
    } catch (err: any) {
      notify({
        titleEn: 'Network Error',
        titleAm: 'የኔትወርክ ስህተት',
        messageEn: err.message || 'Failed to update settings.',
        messageAm: err.message || 'ስህተት ተከስቷል።',
        type: 'ALERT',
        sound: true,
      });
    } finally {
      setSaving(false);
    }
  };

  // Reset to Baseline
  const handleResetBaseline = async () => {
    if (!window.confirm(isAmharic ? 'የስርዓቱን የመመለሻ ፖሊሲ እና የተጠቃሚ ፈቃዶች ወደ ነባሪው ይፋዊ መመሪያ መመለስ ይፈልጋሉ?' : 'Are you sure you want to restore default return policies and standard government RBAC permissions?')) {
      return;
    }

    if (!token) return;
    setResetting(true);

    try {
      const res = await fetch('/api/settings/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (res.ok) {
        if (data.settings?.returnPolicy) {
          setReturnPolicy(data.settings.returnPolicy);
          setPresetInput(data.settings.returnPolicy.quickDurationPresets.join(', '));
        }
        if (data.settings?.rolePermissions) {
          setRolePermissions(data.settings.rolePermissions);
        }
        await refreshSettings();
        notify({
          titleEn: 'Baseline Restored',
          titleAm: 'ነባሪ ቅንብሮች ተመልሰዋል',
          messageEn: 'Restored baseline government return schedule and RBAC matrix.',
          messageAm: 'የነባሪ ይፋዊ የመመለሻ መመሪያ እና የሚና ፈቃዶች ተመልሰዋል።',
          type: 'SUCCESS',
          sound: true,
        });
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setResetting(false);
    }
  };

  // Calculate live preview date based on current inputs
  const calculatePreviewDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + Number(returnPolicy.defaultReturnDays || 7));
    const [hh, mm] = (returnPolicy.defaultReturnTime || '17:00').split(':');
    d.setHours(Number(hh) || 17, Number(mm) || 0, 0, 0);
    return d.toLocaleString(isAmharic ? 'am-ET' : 'en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const canManage = hasPermission('manageSettings');

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center space-x-3 text-slate-500">
          <RefreshCw className="h-5 w-5 animate-spin text-emerald-600" />
          <span className="text-xs font-medium">Loading System Settings & RBAC Policy...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="rounded-lg bg-emerald-600 p-2 text-white shadow-xs">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {isAmharic ? 'የስርዓት ቅንብሮች እና የተጠቃሚ ሚና ፈቃዶች' : 'System Settings & Role-Based Access Control'}
              </h1>
              <p className="text-xs text-slate-500">
                {isAmharic
                  ? 'የማህደር ሰነዶች መመለሻ ቀንና ሰዓት ፖሊሲ፣ የጊዜ ገደብ እና የተጠቃሚ ሚና ፈቃድ ማስተዳደሪያ'
                  : 'Configure document return schedule policies, cutoff hours, and granular RBAC permissions.'}
              </p>
            </div>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleResetBaseline}
              disabled={resetting}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
              <span>{isAmharic ? 'ነባሪ አድርግ' : 'Reset Baseline'}</span>
            </button>

            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="inline-flex items-center space-x-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{isAmharic ? 'ለውጦችን መዝግብ' : 'Save Changes'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4 pt-2 shadow-xs">
        <button
          onClick={() => setActiveTab('returnPolicy')}
          className={`flex items-center space-x-2 border-b-2 px-4 py-3 text-xs font-bold transition ${
            activeTab === 'returnPolicy'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>{isAmharic ? 'የመመለሻ ቀን እና ሰዓት ፖሊሲ' : 'Return Policy & Schedule'}</span>
        </button>

        <button
          onClick={() => setActiveTab('rbac')}
          className={`flex items-center space-x-2 border-b-2 px-4 py-3 text-xs font-bold transition ${
            activeTab === 'rbac'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Shield className="h-4 w-4" />
          <span>{isAmharic ? 'የተጠቃሚ ሚና ፈቃዶች (RBAC Matrix)' : 'Role-Based Access Control'}</span>
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center space-x-2 border-b-2 px-4 py-3 text-xs font-bold transition ${
            activeTab === 'notifications'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Vibrate className="h-4 w-4" />
          <span>{isAmharic ? 'የማሳወቂያ እና ንዝረት ቅንብሮች' : 'Notifications & Vibration'}</span>
        </button>
      </div>

      {/* TAB 1: Return Policy & Time/Date Settings */}
      {activeTab === 'returnPolicy' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Return Settings Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-emerald-600" />
                  <span>{isAmharic ? 'የማህደር ሰነድ የመመለሻ ጊዜ እና የሰዓት ደንብ' : 'Archival Borrowing Duration & Return Time Configuration'}</span>
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {isAmharic
                    ? 'አንድ ሰራተኛ ሰነድ ሲጠይቅ የሚሰጠው የመደበኛ መመለሻ ቀን፣ ከፍተኛው የይዞታ ገደብ እና ይፋዊ የቢሮ መዝጊያ ሰዓት'
                    : 'Configure default return periods, maximum allowable custody time, and official archive counter return cutoff time.'}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Default Return Period */}
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    {isAmharic ? 'መደበኛ የመመለሻ ጊዜ (በቀናት)' : 'Default Return Duration (Days)'}
                  </label>
                  <div className="mt-1 flex rounded-lg shadow-xs">
                    <input
                      type="number"
                      min={returnPolicy.minReturnDays}
                      max={returnPolicy.maxReturnDays}
                      disabled={!canManage}
                      value={returnPolicy.defaultReturnDays}
                      onChange={(e) =>
                        setReturnPolicy({
                          ...returnPolicy,
                          defaultReturnDays: Math.max(1, parseInt(e.target.value, 10) || 1),
                        })
                      }
                      className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-emerald-500 focus:outline-hidden disabled:bg-slate-50"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {isAmharic ? 'አዲስ ጥያቄ ሲቀርብ በራስ-ሰር የሚሰጥ ቀጠሮ' : 'Automatically assigned when submitting standard or fast requests'}
                  </p>
                </div>

                {/* Return Cutoff Time */}
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    {isAmharic ? 'ይፋዊ የማህደር መመለሻ ሰዓት ገደብ (Cutoff Time)' : 'Daily Return Cutoff Time (24h)'}
                  </label>
                  <div className="mt-1 flex rounded-lg shadow-xs">
                    <input
                      type="time"
                      disabled={!canManage}
                      value={returnPolicy.defaultReturnTime}
                      onChange={(e) =>
                        setReturnPolicy({
                          ...returnPolicy,
                          defaultReturnTime: e.target.value || '17:00',
                        })
                      }
                      className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-emerald-500 focus:outline-hidden disabled:bg-slate-50"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {isAmharic ? 'የማህደር ዴስክ የሚዘጋበት ይፋዊ ሰዓት (ለምሳሌ 17፡00 / 11፡00 ሰዓት)' : 'Official daily counter closing time for physical document intake'}
                  </p>
                </div>

                {/* Maximum Borrowing Duration */}
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    {isAmharic ? 'ከፍተኛው የሚፈቀድ የመመለሻ ቀናት (ጣሪያ)' : 'Maximum Custody Duration (Cap in Days)'}
                  </label>
                  <div className="mt-1 flex rounded-lg shadow-xs">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      disabled={!canManage}
                      value={returnPolicy.maxReturnDays}
                      onChange={(e) =>
                        setReturnPolicy({
                          ...returnPolicy,
                          maxReturnDays: Math.max(1, parseInt(e.target.value, 10) || 30),
                        })
                      }
                      className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-emerald-500 focus:outline-hidden disabled:bg-slate-50"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {isAmharic ? 'ከዚህ ቀን በላይ ጥያቄም ሆነ ቀጠሮ ማራዘም አይቻልም' : 'Strict upper limit for any single request or extension'}
                  </p>
                </div>

                {/* Overdue Warning Lead Time */}
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    {isAmharic ? 'የቅድመ-ማስጠንቀቂያ ሰዓት (ሰዓታት በፊት)' : 'Advance Warning Notice Lead Time (Hours)'}
                  </label>
                  <div className="mt-1 flex rounded-lg shadow-xs">
                    <input
                      type="number"
                      min="1"
                      max="72"
                      disabled={!canManage}
                      value={returnPolicy.overdueWarningHours}
                      onChange={(e) =>
                        setReturnPolicy({
                          ...returnPolicy,
                          overdueWarningHours: Math.max(1, parseInt(e.target.value, 10) || 24),
                        })
                      }
                      className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-emerald-500 focus:outline-hidden disabled:bg-slate-50"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {isAmharic ? 'ቀነ ገደቡ ከመድረሱ በፊት ለተጠቃሚው ማሳወቂያ የሚላክበት ሰዓት' : 'Hours before due time when early reminder alerts are triggered'}
                  </p>
                </div>
              </div>

              {/* Quick Duration Preset Chips */}
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  {isAmharic ? 'የፈጣን ቀጠሮ ምርጫዎች (በቀናት ዝርዝር በነጠላ ሰረዝ የተለዩ)' : 'Fast Request Duration Preset Chips (Comma Separated Days)'}
                </label>
                <input
                  type="text"
                  disabled={!canManage}
                  value={presetInput}
                  onChange={(e) => setPresetInput(e.target.value)}
                  placeholder="3, 7, 14, 30"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-emerald-500 focus:outline-hidden disabled:bg-slate-50"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="text-[11px] text-slate-500 self-center">
                    {isAmharic ? 'ቅድመ-እይታ:' : 'Active Chip Buttons:'}
                  </span>
                  {presetInput
                    .split(',')
                    .map((p) => p.trim())
                    .filter((p) => p && !isNaN(Number(p)))
                    .map((val) => (
                      <span
                        key={val}
                        className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800"
                      >
                        +{val} {isAmharic ? 'ቀናት' : 'days'}
                      </span>
                    ))}
                </div>
              </div>

              {/* Toggle Switches */}
              <div className="space-y-4 pt-4 border-t border-slate-200">
                {/* Allow Requester Extensions */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      {isAmharic ? 'ተጠቃሚዎች የመመለሻ ጊዜ ማራዘሚያ እንዲጠይቁ ፍቀድ' : 'Allow Borrowers to Request Extensions'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {isAmharic
                        ? 'ሰነድ የወሰዱ ሰራተኞች ቀነ ገደቡ ከመድረሱ በፊት የጊዜ ማራዘሚያ ጥያቄ ማቅረብ ይችላሉ'
                        : 'Enables "Request Extension" button for active borrowers to request more time'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() =>
                      setReturnPolicy({
                        ...returnPolicy,
                        allowRequesterExtensionRequest: !returnPolicy.allowRequesterExtensionRequest,
                      })
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      returnPolicy.allowRequesterExtensionRequest ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        returnPolicy.allowRequesterExtensionRequest ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Automated Reminders */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      {isAmharic ? 'ራስ-ሰር የአሳሽ ማሳሰቢያ እና ድምፅ' : 'Automated Browser Reminders & Audio Chimes'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {isAmharic
                        ? 'የመመለሻ ቀን ሲደርስ ወይም ሲያልፍ ለያዡ በራስ-ሰር ማሳወቂያ ይላካል'
                        : 'Automatically trigger chime and desktop alert when return deadline approaches or lapses'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() =>
                      setReturnPolicy({
                        ...returnPolicy,
                        autoNotifyOnDueApproach: !returnPolicy.autoNotifyOnDueApproach,
                      })
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      returnPolicy.autoNotifyOnDueApproach ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        returnPolicy.autoNotifyOnDueApproach ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Policy Preview & Live Calculator Card */}
          <div className="space-y-6">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-xs">
              <div className="flex items-center space-x-2 text-emerald-800">
                <Calendar className="h-4 w-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  {isAmharic ? 'የቀጠሮ ስሌት ቅድመ-እይታ' : 'Live Calculation Preview'}
                </h3>
              </div>
              <p className="mt-2 text-xs text-slate-600">
                {isAmharic
                  ? 'ዛሬ የቀረበ ሰነድ ጥያቄ አሁን ባለው ፖሊሲ መሰረት የሚሰጠው የመመለሻ ቀንና ሰዓት:'
                  : 'A file requested right now under current policy rules will be scheduled as:'}
              </p>

              <div className="mt-3 rounded-lg border border-emerald-300 bg-white p-3 text-center shadow-xs">
                <p className="text-[10px] font-bold uppercase text-slate-500">
                  {isAmharic ? 'የሚሰላው ይፋዊ የመመለሻ ቀን' : 'Calculated Due Date & Time'}
                </p>
                <p className="mt-1 text-sm font-black text-emerald-800">
                  {calculatePreviewDate()}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  (+{returnPolicy.defaultReturnDays} {isAmharic ? 'ቀናት' : 'days'} @ {returnPolicy.defaultReturnTime})
                </p>
              </div>

              <div className="mt-4 space-y-2 text-[11px] text-slate-600">
                <div className="flex justify-between border-b border-emerald-200/60 pb-1">
                  <span>{isAmharic ? 'ከፍተኛው ጣሪያ:' : 'Maximum Allowable Custody:'}</span>
                  <span className="font-bold text-slate-800">{returnPolicy.maxReturnDays} {isAmharic ? 'ቀናት' : 'days'}</span>
                </div>
                <div className="flex justify-between border-b border-emerald-200/60 pb-1">
                  <span>{isAmharic ? 'የማስጠንቀቂያ ቅድመ-ሰዓት:' : 'Early Warning Alert:'}</span>
                  <span className="font-bold text-slate-800">{returnPolicy.overdueWarningHours}h {isAmharic ? 'በፊት' : 'prior'}</span>
                </div>
                <div className="flex justify-between">
                  <span>{isAmharic ? 'ቀጠሮ ማስተካከል ፈቃድ:' : 'Authorized to Adjust:'}</span>
                  <span className="font-bold text-emerald-700">
                    {ALL_ROLES.filter((r) => rolePermissions[r]?.includes('adjustReturnDate')).join(', ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Policy Guidance */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs text-xs text-slate-600 space-y-2">
              <div className="flex items-center space-x-1.5 font-bold text-slate-800">
                <Info className="h-4 w-4 text-emerald-600" />
                <span>{isAmharic ? 'የመመለሻ ሰዓት ማስተካከያ አሰራር' : 'Official Return Adjustment Rules'}</span>
              </div>
              <p>
                {isAmharic
                  ? 'የማህደር ኃላፊዎች እና አስተዳዳሪዎች በ"My Requests" ገጽ ላይ "ቀጠሮ ማስተካከያ" የሚለውን በመጫን በማንኛውም ጊዜ የመመለሻ ቀኑን እና ሰዓቱን ማራዘም ይችላሉ።'
                  : 'Authorized personnel can click "Adjust Return Date & Time" on any active request to change the deadline and notify the borrower.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Role-Based Access Control (RBAC) Matrix */}
      {activeTab === 'rbac' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-emerald-600" />
                  <span>{isAmharic ? 'የተጠቃሚ ሚና እና ፈቃድ ማስተዳደሪያ (RBAC Matrix)' : 'Role-Based Access Control (RBAC) Permission Matrix'}</span>
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {isAmharic
                    ? 'ለእያንዳንዱ ይፋዊ ሚና የሚፈቀዱትን እና የሚከለከሉትን ተግባራት ይቆጣጠሩ። ማስተካከያው በቅጽበት ተግባራዊ ይሆናል።'
                    : 'Configure granular functional permissions across all institutional roles. Changes take effect across UI and backend.'}
                </p>
              </div>

              <div className="flex items-center space-x-2 text-xs">
                <span className="inline-flex items-center space-x-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                  <Check className="h-3.5 w-3.5" />
                  <span>{isAmharic ? 'የተፈቀደ' : 'Granted'}</span>
                </span>
                <span className="inline-flex items-center space-x-1 text-slate-400 font-medium bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
                  <X className="h-3.5 w-3.5" />
                  <span>{isAmharic ? 'የተከለከለ' : 'Restricted'}</span>
                </span>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-700">
                    <th className="py-3 px-4 font-bold text-slate-900 w-1/3">
                      {isAmharic ? 'ተግባር / ፈቃድ (Functional Permission)' : 'Functional Capability / Permission'}
                    </th>
                    {ALL_ROLES.map((role) => (
                      <th key={role} className="py-3 px-3 font-bold text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-slate-900">{t(`roles.${role}`)}</span>
                          <span className="text-[10px] text-slate-400 font-mono">[{role}]</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {PERMISSIONS_LIST.map((perm) => {
                    const isDeadlineFeature = perm.key === 'adjustReturnDate' || perm.key === 'sendReturnNotice';
                    return (
                      <tr
                        key={perm.key}
                        className={`hover:bg-slate-50/80 transition ${
                          isDeadlineFeature ? 'bg-emerald-50/30' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-start space-x-2">
                            {isDeadlineFeature && (
                              <Clock className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                            )}
                            <div>
                              <p className="font-bold text-slate-900">
                                {isAmharic ? perm.labelAm : perm.labelEn}
                                {isDeadlineFeature && (
                                  <span className="ml-2 inline-flex items-center rounded-md bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800">
                                    ★ Focus Feature
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {isAmharic ? perm.descriptionAm : perm.descriptionEn}
                              </p>
                            </div>
                          </div>
                        </td>

                        {ALL_ROLES.map((role) => {
                          const isGranted =
                            role === 'ADMIN' || (rolePermissions[role] || []).includes(perm.key);
                          const isAdminCol = role === 'ADMIN';

                          return (
                            <td key={role} className="py-3 px-3 text-center align-middle">
                              {isAdminCol ? (
                                <div className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 text-emerald-800 shadow-2xs">
                                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={!canManage}
                                  onClick={() => handleTogglePermission(role, perm.key)}
                                  className={`inline-flex items-center justify-center h-7 w-7 rounded-lg transition-all ${
                                    isGranted
                                      ? 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                                      : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'
                                  } ${!canManage ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                                  title={`${isGranted ? 'Revoke' : 'Grant'} ${perm.labelEn} for ${role}`}
                                >
                                  {isGranted ? (
                                    <Check className="h-4 w-4 stroke-[3]" />
                                  ) : (
                                    <X className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Notifications & Vibration Settings */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          {/* Hardware & Browser Support Overview */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start space-x-3.5">
                <div className={`rounded-xl p-2.5 text-white shadow-xs ${
                  isVibrationSupported ? 'bg-indigo-600' : 'bg-slate-700'
                }`}>
                  <Smartphone className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-sm font-bold text-slate-900">
                      {isAmharic ? 'የመሣሪያ ንዝረት እና የአሳሽ ማሳወቂያ ሁኔታ' : 'Device Haptics & Notification Status'}
                    </h2>
                    {isVibrationSupported ? (
                      <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                        <Check className="h-3 w-3" />
                        <span>{isAmharic ? 'የንዝረት ድጋፍ አለ' : 'Haptics Supported'}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-medium text-blue-800 border border-blue-200">
                        <Info className="h-3 w-3" />
                        <span>{isAmharic ? 'ዴስክቶፕ / ድምፅ እና ቶስት' : 'Desktop / Audio Mode'}</span>
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-2xl">
                    {isVibrationSupported
                      ? (isAmharic
                          ? 'የWeb Vibration API በመሣሪያዎ ላይ ነቅቷል። አዲስ የሰነድ ጥያቄ፣ ማጽደቂያ ወይም የመመለሻ ማስጠንቀቂያ ሲደርስ መሣሪያዎ ይነዝራል።'
                          : 'Web Vibration API is supported on this device. Haptic pulses will fire for document requests, approvals, and return deadlines.')
                      : (isAmharic
                          ? 'የንዝረት ሞተር በሞባይል አሳሾች (አንድሮይድ እና PWA) ይደገፋል። በዴስክቶፕ ኮምፒውተሮች ላይ ስርዓቱ በድምፅ እና በስክሪን ማሳወቂያዎች ይሰራል፤ ቅንብሮችዎ በስልክ ሲገቡ ተፈጻሚ ይሆናሉ።'
                          : 'Web Vibration API is available on mobile browsers (Android and PWA). On desktop computers, notifications use two-tone harmonic audio chimes and floating toasts. Your vibration preferences are saved across devices.')}
                  </p>
                </div>
              </div>

              {/* Browser notification permission trigger */}
              <div className="flex items-center space-x-2 sm:self-center">
                {permission === 'granted' ? (
                  <span className="inline-flex items-center space-x-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>{isAmharic ? 'የአሳሽ ማሳወቂያ ነቅቷል' : 'Push Alerts Active'}</span>
                  </span>
                ) : (
                  <button
                    onClick={requestPermission}
                    className="inline-flex items-center space-x-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition"
                  >
                    <Bell className="h-4 w-4" />
                    <span>{isAmharic ? 'የአሳሽ ማሳወቂያ ፍቀድ' : 'Enable Browser Alerts'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Master Vibration Switch & Quick Actions */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
              <div className="flex items-start space-x-3">
                <div className={`rounded-xl p-2.5 ${
                  vibrationSettings.enabled ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'
                }`}>
                  {vibrationSettings.enabled ? <Vibrate className="h-6 w-6" /> : <VibrateOff className="h-6 w-6" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {isAmharic ? 'የማሳወቂያ ንዝረት ዋና ማብሪያ/ማጥፊያ' : 'Notification Vibration Feedback'}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {isAmharic
                      ? 'አዲስ የሰነድ ክስተቶች ሲከሰቱ በመሣሪያዎ ላይ የሚሰማውን የንዝረት ምልክት ይቆጣጠሩ'
                      : 'Control physical haptic vibration pulses whenever archive events and alerts trigger'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    const next = !vibrationSettings.enabled;
                    updateVibrationSettings({ enabled: next });
                    if (next) {
                      testVibration(vibrationSettings.pattern);
                    }
                  }}
                  className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    vibrationSettings.enabled ? 'bg-indigo-600' : 'bg-slate-300'
                  }`}
                  role="switch"
                  aria-checked={vibrationSettings.enabled}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      vibrationSettings.enabled ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-xs font-bold text-slate-700">
                  {vibrationSettings.enabled
                    ? (isAmharic ? 'ነቅቷል' : 'Enabled')
                    : (isAmharic ? 'ተዘግቷል' : 'Disabled')}
                </span>
              </div>
            </div>

            {/* Pattern Selection Cards */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {isAmharic ? 'የንዝረት ስርዓተ-ምት (Vibration Patterns)' : 'Vibration Pattern & Intensity'}
                </h4>
                <span className="text-[11px] text-slate-400">
                  {isAmharic ? 'የተመረጠውን ስርዓተ-ምት ወዲያውኑ ይሞክሩ' : 'Click "Test Pattern" to feel the vibration'}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                {/* 1. Default Standard Double Pulse */}
                <div
                  onClick={() => updateVibrationSettings({ pattern: 'default' })}
                  className={`group relative cursor-pointer rounded-xl border p-4 transition-all ${
                    vibrationSettings.pattern === 'default'
                      ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
                      {isAmharic ? 'ይፋዊ መደበኛ' : 'Recommended'}
                    </span>
                    <input
                      type="radio"
                      name="vibrationPattern"
                      checked={vibrationSettings.pattern === 'default'}
                      onChange={() => updateVibrationSettings({ pattern: 'default' })}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                    />
                  </div>
                  <h5 className="mt-2.5 text-xs font-bold text-slate-900">
                    {isAmharic ? 'መደበኛ ድርብ ንዝረት' : 'Standard Double Pulse'}
                  </h5>
                  <p className="mt-1 text-[11px] text-slate-500 leading-normal">
                    {isAmharic
                      ? 'ሁለት ፈጣን ምቶች (200ms - 100ms - 200ms)። ለመደበኛ የቢሮ ሰራተኛ ተስማሚ።'
                      : 'Classic double pulse (200ms - 100ms - 200ms). Balanced for workstation alert.'}
                  </p>
                  <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-slate-100">
                    <div className="flex items-center space-x-1">
                      <span className="h-2 w-4 rounded-full bg-indigo-500 inline-block"></span>
                      <span className="h-1 w-2 rounded-full bg-slate-300 inline-block"></span>
                      <span className="h-2 w-4 rounded-full bg-indigo-500 inline-block"></span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTestingPattern('default');
                        testVibration('default');
                        setTimeout(() => setTestingPattern(null), 700);
                      }}
                      className="rounded-md bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-indigo-700 shadow-2xs hover:bg-indigo-50 transition"
                    >
                      {testingPattern === 'default'
                        ? (isAmharic ? 'እየነዘረ...' : 'Vibrating...')
                        : (isAmharic ? 'ሞክር' : 'Test')}
                    </button>
                  </div>
                </div>

                {/* 2. Subtle & Gentle */}
                <div
                  onClick={() => updateVibrationSettings({ pattern: 'subtle' })}
                  className={`group relative cursor-pointer rounded-xl border p-4 transition-all ${
                    vibrationSettings.pattern === 'subtle'
                      ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      {isAmharic ? 'ረጋ ያለ' : 'Discreet'}
                    </span>
                    <input
                      type="radio"
                      name="vibrationPattern"
                      checked={vibrationSettings.pattern === 'subtle'}
                      onChange={() => updateVibrationSettings({ pattern: 'subtle' })}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                    />
                  </div>
                  <h5 className="mt-2.5 text-xs font-bold text-slate-900">
                    {isAmharic ? 'ቀላል እና ረጋ ያለ' : 'Subtle & Gentle'}
                  </h5>
                  <p className="mt-1 text-[11px] text-slate-500 leading-normal">
                    {isAmharic
                      ? 'አጭር እና ረጋ ያለ ንዝረት (100ms - 60ms - 100ms)። ጸጥታ ለሚፈልጉ የማህደር ክፍሎች።'
                      : 'Light haptic tap (100ms - 60ms - 100ms). Ideal for quiet archive reading rooms.'}
                  </p>
                  <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-slate-100">
                    <div className="flex items-center space-x-1">
                      <span className="h-1.5 w-3 rounded-full bg-emerald-500 inline-block"></span>
                      <span className="h-1 w-1 rounded-full bg-slate-300 inline-block"></span>
                      <span className="h-1.5 w-3 rounded-full bg-emerald-500 inline-block"></span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTestingPattern('subtle');
                        testVibration('subtle');
                        setTimeout(() => setTestingPattern(null), 500);
                      }}
                      className="rounded-md bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-indigo-700 shadow-2xs hover:bg-indigo-50 transition"
                    >
                      {testingPattern === 'subtle'
                        ? (isAmharic ? 'እየነዘረ...' : 'Vibrating...')
                        : (isAmharic ? 'ሞክር' : 'Test')}
                    </button>
                  </div>
                </div>

                {/* 3. Urgent Triple Pulse */}
                <div
                  onClick={() => updateVibrationSettings({ pattern: 'urgent' })}
                  className={`group relative cursor-pointer rounded-xl border p-4 transition-all ${
                    vibrationSettings.pattern === 'urgent'
                      ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                      {isAmharic ? 'አጣዳፊ' : 'High Priority'}
                    </span>
                    <input
                      type="radio"
                      name="vibrationPattern"
                      checked={vibrationSettings.pattern === 'urgent'}
                      onChange={() => updateVibrationSettings({ pattern: 'urgent' })}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                    />
                  </div>
                  <h5 className="mt-2.5 text-xs font-bold text-slate-900">
                    {isAmharic ? 'አጣዳፊ ሦስት ጊዜ ንዝረት' : 'Urgent Triple Pulse'}
                  </h5>
                  <p className="mt-1 text-[11px] text-slate-500 leading-normal">
                    {isAmharic
                      ? 'ሦስት ጠንካራ ምቶች (300ms - 100ms - 300ms)። ለጊዜ ላለፈባቸው ሰነዶች እና ጥብቅ ማስጠንቀቂያዎች።'
                      : 'Firm triple pulse (300ms x 3). High urgency for overdue returns and alerts.'}
                  </p>
                  <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-slate-100">
                    <div className="flex items-center space-x-1">
                      <span className="h-2 w-3 rounded-full bg-rose-500 inline-block"></span>
                      <span className="h-1 w-1 rounded-full bg-slate-300 inline-block"></span>
                      <span className="h-2 w-3 rounded-full bg-rose-500 inline-block"></span>
                      <span className="h-1 w-1 rounded-full bg-slate-300 inline-block"></span>
                      <span className="h-2 w-3 rounded-full bg-rose-500 inline-block"></span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTestingPattern('urgent');
                        testVibration('urgent');
                        setTimeout(() => setTestingPattern(null), 1200);
                      }}
                      className="rounded-md bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-indigo-700 shadow-2xs hover:bg-indigo-50 transition"
                    >
                      {testingPattern === 'urgent'
                        ? (isAmharic ? 'እየነዘረ...' : 'Vibrating...')
                        : (isAmharic ? 'ሞክር' : 'Test')}
                    </button>
                  </div>
                </div>

                {/* 4. Heartbeat Rhythm */}
                <div
                  onClick={() => updateVibrationSettings({ pattern: 'heartbeat' })}
                  className={`group relative cursor-pointer rounded-xl border p-4 transition-all ${
                    vibrationSettings.pattern === 'heartbeat'
                      ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      {isAmharic ? 'ልዩ ምት' : 'Rhythm'}
                    </span>
                    <input
                      type="radio"
                      name="vibrationPattern"
                      checked={vibrationSettings.pattern === 'heartbeat'}
                      onChange={() => updateVibrationSettings({ pattern: 'heartbeat' })}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                    />
                  </div>
                  <h5 className="mt-2.5 text-xs font-bold text-slate-900">
                    {isAmharic ? 'የልብ ምት ስርዓተ-ንዝረት' : 'Heartbeat Rhythm'}
                  </h5>
                  <p className="mt-1 text-[11px] text-slate-500 leading-normal">
                    {isAmharic
                      ? 'የልብ ምት የሚመስል ምት (120ms - 120ms - 240ms)። በቀላሉ የሚለይ ልዩ ምልክት።'
                      : 'Distinct syncopated cadence (120ms - 120ms - 240ms). Instantly recognizable.'}
                  </p>
                  <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-slate-100">
                    <div className="flex items-center space-x-1">
                      <span className="h-2 w-2 rounded-full bg-amber-500 inline-block"></span>
                      <span className="h-1 w-1 rounded-full bg-slate-300 inline-block"></span>
                      <span className="h-2 w-5 rounded-full bg-amber-500 inline-block"></span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTestingPattern('heartbeat');
                        testVibration('heartbeat');
                        setTimeout(() => setTestingPattern(null), 800);
                      }}
                      className="rounded-md bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-indigo-700 shadow-2xs hover:bg-indigo-50 transition"
                    >
                      {testingPattern === 'heartbeat'
                        ? (isAmharic ? 'እየነዘረ...' : 'Vibrating...')
                        : (isAmharic ? 'ሞክር' : 'Test')}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Granular Event Triggers */}
            <div className="mt-8 pt-6 border-t border-slate-200">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                {isAmharic ? 'ንዝረት የሚቀሰቀስባቸው ክስተቶች' : 'Vibration Event Triggers'}
              </h4>
              <p className="text-xs text-slate-500 mb-4">
                {isAmharic
                  ? 'የትኞቹ የማህደር ክስተቶች ሲከሰቱ መሣሪያዎ እንዲነዝር እንደሚፈልጉ ይምረጡ'
                  : 'Choose which archive activities trigger physical haptic vibration pulses'}
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Event 1: Requests */}
                <label className="flex items-start space-x-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50/70 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vibrationSettings.vibrateOnRequests}
                    onChange={(e) => updateVibrationSettings({ vibrateOnRequests: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      {isAmharic ? 'የሰነድ ውሰት ጥያቄዎች' : 'Document Borrow Requests'}
                    </span>
                    <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                      {isAmharic
                        ? 'አዲስ የሰነድ ውሰት ጥያቄ ሲቀርብ ወይም ፈጣን ጥያቄ ሲደረግ ይነዝራል'
                        : 'Vibrate when staff submit new borrow requests or fast requests'}
                    </span>
                  </div>
                </label>

                {/* Event 2: Approvals */}
                <label className="flex items-start space-x-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50/70 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vibrationSettings.vibrateOnApprovals}
                    onChange={(e) => updateVibrationSettings({ vibrateOnApprovals: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      {isAmharic ? 'የማኔጀር ማጽደቂያ እና ውሳኔዎች' : 'Manager Approvals & Rejections'}
                    </span>
                    <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                      {isAmharic
                        ? 'የሰነድ ጥያቄዎ በማኔጀር ወይም በማህደር ኃላፊ ሲፈቀድ ወይም ውድቅ ሲደረግ ይነዝራል'
                        : 'Vibrate when requests are approved or rejected by department heads'}
                    </span>
                  </div>
                </label>

                {/* Event 3: Returns */}
                <label className="flex items-start space-x-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50/70 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vibrationSettings.vibrateOnReturns}
                    onChange={(e) => updateVibrationSettings({ vibrateOnReturns: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      {isAmharic ? 'የመመለሻ ቀናት እና ማሳሰቢያዎች (Return Notices)' : 'Return Reminders & Deadlines'}
                    </span>
                    <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                      {isAmharic
                        ? 'ሰነድ መመለስ ሲኖርብዎ ወይም የመመለሻ ጥሪ ከማህደር ኃላፊ ሲላክልዎት ይነዝራል'
                        : 'Vibrate when you need to return borrowed documents or receive a return call'}
                    </span>
                  </div>
                </label>

                {/* Event 4: Alerts */}
                <label className="flex items-start space-x-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50/70 transition cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vibrationSettings.vibrateOnAlerts}
                    onChange={(e) => updateVibrationSettings({ vibrateOnAlerts: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      {isAmharic ? 'ጊዜ ያለፈባቸው እና የጠፉ ሰነድ ማስጠንቀቂያዎች' : 'Overdue & Security Alerts'}
                    </span>
                    <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                      {isAmharic
                        ? 'የመመለሻ ጊዜ ሲያልፍ ወይም የሰነድ መጥፋት ምርመራ ሲከፈት በጠንካራ ንዝረት ያሳውቃል'
                        : 'Vibrate with high-urgency triple pulse for overdue files and loss reports'}
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Test Lab Bar */}
            <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    testVibration();
                    notify({
                      titleEn: 'Haptic Vibration Test',
                      titleAm: 'የንዝረት ምልክት ሙከራ',
                      messageEn: `Triggered ${vibrationSettings.pattern} vibration pattern on your device.`,
                      messageAm: `በመሣሪያዎ ላይ የ${vibrationSettings.pattern} ንዝረት ተቀስቅሷል።`,
                      type: 'INFO',
                      sound: false,
                      vibrate: true,
                    });
                  }}
                  className="inline-flex items-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition"
                >
                  <Vibrate className="h-4 w-4" />
                  <span>{isAmharic ? 'ንዝረት ብቻ ሞክር' : 'Test Vibration Only'}</span>
                </button>

                <button
                  type="button"
                  onClick={testNotification}
                  className="inline-flex items-center space-x-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>{isAmharic ? 'ሙሉ ማሳወቂያ ሞክር (ድምፅ + ንዝረት + ቶስት)' : 'Test Full Alert (Sound + Vibrate + Toast)'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  updateVibrationSettings(DEFAULT_VIBRATION_SETTINGS);
                  notify({
                    titleEn: 'Vibration Settings Reset',
                    titleAm: 'የንዝረት ቅንብሮች ወደ ነባሪ ተመልሰዋል',
                    messageEn: 'Restored default double pulse vibration settings.',
                    messageAm: 'መደበኛው የንዝረት ቅንብር ተመልሷል።',
                    type: 'SUCCESS',
                    sound: true,
                    vibrate: true,
                  });
                }}
                className="text-xs text-slate-500 hover:text-slate-800 underline"
              >
                {isAmharic ? 'ወደ ነባሪ መልስ' : 'Reset to Defaults'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

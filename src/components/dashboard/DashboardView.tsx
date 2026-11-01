import React, { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertOctagon,
  FileSearch,
  ArrowRight,
  TrendingUp,
  FolderLock,
  Building,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../ui/StatusBadge';
import { formatBilingualDate } from '../../lib/ethiopianCalendar';

interface DashboardMetrics {
  totalDocuments: number;
  availableDocuments: number;
  borrowedDocuments: number;
  missingDocuments: number;
  archivedDocuments: number;
  pendingRequests: number;
  approvedRequests: number;
  issuedRequests: number;
  overdueCount: number;
  activeInvestigations: number;
}

interface DashboardViewProps {
  onNavigate: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { t, locale, isAmharic } = useLanguage();
  const { user, token, logout } = useAuth();

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [departmentStats, setDepartmentStats] = useState<any[]>([]);
  const [recentMovements, setRecentMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchDashboardData = async () => {
    if (!token || token === 'null' || token === 'undefined') return;
    setLoading(true);
    try {
      const res = await fetch('/api/reports/summary', {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setMetrics(data.metrics);
        setCategoryCounts(data.categoryCounts || {});
        setDepartmentStats(data.departmentStats || []);
        setRecentMovements(data.recentMovements || []);
      }
    } catch (err) {
      console.error('Error fetching dashboard summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  return (
    <div className="space-y-6">
      {/* Top Banner with Institutional Greeting & Ethiopian Calendar Date */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center space-x-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                {isAmharic ? 'የማህደር አስተዳደር ዋና ማዕከል' : 'Federal Physical Document Archive System'}
              </span>
            </div>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {isAmharic ? `እንኳን ደህና መጡ፣ ${user?.fullName}` : `Welcome, ${user?.fullName}`}
            </h2>
            <p className="mt-1 text-xs text-slate-600 sm:text-sm">
              {isAmharic
                ? 'የኢትዮጵያ መንግስት ይፋዊ አካላዊ ሰነዶች፣ ካቢኔቶች እና የርክክብ ታሪክ መከታተያ'
                : 'National physical file custody registry, multi-tier location management, and auditable movement tracking.'}
            </p>
          </div>

          <div className="flex flex-col items-start rounded-lg bg-slate-50 border border-slate-200 p-3 text-right md:items-end">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              {isAmharic ? 'የዛሬ ቀን' : 'Official Date'}
            </span>
            <span className="text-xs font-bold text-slate-900 sm:text-sm">
              {formatBilingualDate(new Date(), locale)}
            </span>
            <span className="mt-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-sm border border-emerald-200">
              {t(`roles.${user?.role || 'EMPLOYEE'}`)}
            </span>
          </div>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Documents */}
        <div
          onClick={() => onNavigate('documents')}
          className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-blue-400 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {t('dashboard.totalRegistered')}
            </span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-700 group-hover:bg-blue-100 transition">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {metrics ? metrics.totalDocuments : '...'}
            </span>
            <span className="text-xs text-emerald-600 font-medium flex items-center">
              {metrics?.availableDocuments} {isAmharic ? 'ዝግጁ' : 'available'}
            </span>
          </div>
        </div>

        {/* Borrowed in Custody */}
        <div
          onClick={() => onNavigate('requests')}
          className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-amber-400 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {t('dashboard.borrowedFiles')}
            </span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-700 group-hover:bg-amber-100 transition">
              <FolderLock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {metrics ? metrics.borrowedDocuments : '...'}
            </span>
            <span className="text-xs text-amber-700 font-medium">
              {metrics?.issuedRequests} {isAmharic ? 'በእጅ ላይ' : 'in hand'}
            </span>
          </div>
        </div>

        {/* Pending Requests */}
        <div
          onClick={() => onNavigate(user?.role === 'DEPARTMENT_MANAGER' || user?.role === 'ADMIN' ? 'approvals' : 'requests')}
          className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-indigo-400 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {t('dashboard.pendingRequests')}
            </span>
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-700 group-hover:bg-indigo-100 transition">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {metrics ? metrics.pendingRequests : '...'}
            </span>
            <span className="text-xs text-indigo-600 font-medium">
              {isAmharic ? 'ውሳኔ የሚጠብቁ' : 'awaiting review'}
            </span>
          </div>
        </div>

        {/* Overdue / Missing Alert Card */}
        <div
          onClick={() => onNavigate(metrics?.overdueCount ? 'reports' : 'investigations')}
          className="group cursor-pointer rounded-xl border border-rose-200 bg-rose-50/60 p-4 shadow-xs transition hover:border-rose-400 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-800">
              {t('dashboard.overdueFiles')}
            </span>
            <div className="rounded-lg bg-rose-100 p-2 text-rose-700">
              <AlertOctagon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-rose-900">
              {metrics ? metrics.overdueCount : '0'}
            </span>
            <span className="text-xs text-rose-700 font-semibold">
              {metrics?.missingDocuments || 0} {isAmharic ? 'የጠፉ/ምርመራ' : 'cases'}
            </span>
          </div>
        </div>
      </div>

      {/* Commercial vs Resident Category Split Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div
          onClick={() => onNavigate('documents')}
          className="cursor-pointer rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-xs hover:border-blue-300 transition"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                {isAmharic ? 'የንግድ ሰነዶች (Commercial Files)' : 'Commercial Documents'}
              </span>
              <p className="text-[11px] text-blue-700">
                Corporate deeds, business licenses, tenders & finance ledgers
              </p>
            </div>
            <span className="text-2xl font-black text-blue-900 font-mono">
              {categoryCounts['COMMERCIAL'] || 0}
            </span>
          </div>
        </div>

        <div
          onClick={() => onNavigate('documents')}
          className="cursor-pointer rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs hover:border-emerald-300 transition"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                {isAmharic ? 'የነዋሪዎች ሰነዶች (Resident Files)' : 'Resident Documents'}
              </span>
              <p className="text-[11px] text-emerald-700">
                Kebele residency, municipal land deeds & inheritance decrees
              </p>
            </div>
            <span className="text-2xl font-black text-emerald-900 font-mono">
              {categoryCounts['RESIDENT'] || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Middle Section: Recent Movements Ledger & Category Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent File Movement Timeline (2 cols) */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {t('dashboard.recentMovements')}
              </h3>
              <p className="text-xs text-slate-500">
                {isAmharic
                  ? 'የአካላዊ ሰነዶች የምዝገባ፣ የውሰት እና የመመለስ ቅጽበታዊ መዝገብ'
                  : 'Append-only chronological log of physical custody and locations'}
              </p>
            </div>
            <button
              onClick={() => onNavigate('movements')}
              className="text-xs font-semibold text-blue-700 hover:text-blue-800 flex items-center space-x-1"
            >
              <span>{isAmharic ? 'ሁሉንም እይ' : 'View all'}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {recentMovements.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                {isAmharic ? 'ምንም የእንቅስቃሴ ታሪክ አልተመዘገበም' : 'No recorded movements yet'}
              </p>
            ) : (
              recentMovements.map((m) => (
                <div key={m.id} className="py-3 flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <span className="mt-1 flex h-2 w-2 rounded-full bg-blue-600"></span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {m.documentRef}
                        </span>
                        <StatusBadge status={m.movementType} size="sm" />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-700 font-medium">
                        {m.documentTitle}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {m.reason} • <span className="font-medium text-slate-600">{m.actorName}</span>
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap ml-4">
                    {formatBilingualDate(m.timestamp, locale)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Categories Distribution (1 col) */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {t('dashboard.categoryBreakdown')}
              </h3>
              <p className="text-xs text-slate-500">
                {isAmharic ? 'ሰነዶች በይዘት ምደባ' : 'Classification categories'}
              </p>
            </div>

            <div className="mt-4 space-y-3">
              {Object.entries(categoryCounts).map(([cat, count]) => {
                const total = metrics?.totalDocuments || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-xs font-medium text-slate-700">
                      <span>{t(`categories.${cat}`, cat)}</span>
                      <span className="font-bold text-slate-900">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-600"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="mt-6 border-t border-slate-100 pt-4 space-y-2">
            <button
              onClick={() => onNavigate('requests')}
              className="w-full flex items-center justify-center space-x-2 rounded-lg bg-emerald-700 py-2.5 px-3 text-xs font-bold text-white hover:bg-emerald-800 transition shadow-xs cursor-pointer"
            >
              <Zap className="h-4 w-4 fill-current" />
              <span>{isAmharic ? '⚡ ፈጣን የሰነድ ጥያቄ አቅርብ' : '⚡ Fast Request File'}</span>
            </button>
            <button
              onClick={() => onNavigate('documents')}
              className="w-full flex items-center justify-center space-x-2 rounded-lg bg-slate-900 py-2 px-3 text-xs font-semibold text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <FileSearch className="h-4 w-4" />
              <span>{t('actions.search')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

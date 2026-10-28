import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Printer,
  FileSpreadsheet,
  AlertOctagon,
  Building,
  CheckCircle,
  FileText,
  Clock,
  Layers,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { formatBilingualDate } from '../../lib/ethiopianCalendar';

export const ReportsView: React.FC = () => {
  const { t, locale, isAmharic } = useLanguage();
  const { token } = useAuth();

  const [summaryData, setSummaryData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchSummary = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/reports/summary', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [token]);

  const handleDownloadCsv = (type: string) => {
    if (!token) return;
    // Download via link
    window.location.href = `/api/reports/export?type=${type}`;
  };

  return (
    <div className="space-y-6">
      {/* Header & Export Actions */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {t('nav.reports')}
          </h2>
          <p className="text-xs text-slate-500">
            {isAmharic
              ? 'ይፋዊ የመንግስት ማህደር ስታቲስቲክስ፣ የውሰት ክትትል እና የኦዲት ሪፖርቶች'
              : 'Institutional inventory metrics, custody reports, and controlled official CSV export.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleDownloadCsv('inventory')}
            className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
            <span>Export Inventory CSV</span>
          </button>
          <button
            onClick={() => handleDownloadCsv('overdue')}
            className="inline-flex items-center space-x-1.5 rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 shadow-xs transition"
          >
            <AlertOctagon className="h-4 w-4" />
            <span>Export Overdue CSV</span>
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center space-x-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 shadow-xs transition"
          >
            <Printer className="h-4 w-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            {t('dashboard.totalRegistered')}
          </span>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {summaryData?.metrics?.totalDocuments || 0}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            {t('dashboard.availableFiles')}
          </span>
          <p className="mt-2 text-2xl font-bold text-emerald-700">
            {summaryData?.metrics?.availableDocuments || 0}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            {t('dashboard.borrowedFiles')}
          </span>
          <p className="mt-2 text-2xl font-bold text-amber-700">
            {summaryData?.metrics?.borrowedDocuments || 0}
          </p>
        </div>

        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider">
            {t('dashboard.overdueFiles')}
          </span>
          <p className="mt-2 text-2xl font-bold text-rose-900">
            {summaryData?.metrics?.overdueCount || 0}
          </p>
        </div>
      </div>

      {/* Primary Category Distribution: Commercial vs Resident */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-blue-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-900">
                Commercial Classification (የንግድ ዘርፍ)
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                Financial, procurement, commercial leases, and enterprise contracts
              </p>
            </div>
            <span className="text-3xl font-black font-mono text-blue-900">
              {summaryData?.metrics?.commercialCount ?? summaryData?.categoryCounts?.COMMERCIAL ?? 0}
            </span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
              <span>Category Share</span>
              <span>
                {Math.round(
                  ((summaryData?.categoryCounts?.COMMERCIAL || 0) /
                    (summaryData?.metrics?.totalDocuments || 1)) *
                    100
                )}
                %
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{
                  width: `${Math.round(
                    ((summaryData?.categoryCounts?.COMMERCIAL || 0) /
                      (summaryData?.metrics?.totalDocuments || 1)) *
                      100
                  )}%`,
                }}
              ></div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                Resident Classification (የነዋሪዎች ዘርፍ)
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                Housing certificates, municipal deeds, kebele tenancy & family decrees
              </p>
            </div>
            <span className="text-3xl font-black font-mono text-emerald-900">
              {summaryData?.metrics?.residentCount ?? summaryData?.categoryCounts?.RESIDENT ?? 0}
            </span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
              <span>Category Share</span>
              <span>
                {Math.round(
                  ((summaryData?.categoryCounts?.RESIDENT || 0) /
                    (summaryData?.metrics?.totalDocuments || 1)) *
                    100
                )}
                %
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-600"
                style={{
                  width: `${Math.round(
                    ((summaryData?.categoryCounts?.RESIDENT || 0) /
                      (summaryData?.metrics?.totalDocuments || 1)) *
                      100
                  )}%`,
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Address & Physical Storage Distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Woreda Distribution */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Historical Address Distribution (Old Woreda)
          </h3>
          <p className="text-[11px] text-slate-500 mb-3">
            Concentration of archival files by historical municipal administrative districts
          </p>

          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {summaryData?.woredaDistribution && Object.keys(summaryData.woredaDistribution).length > 0 ? (
              Object.entries(summaryData.woredaDistribution).map(([woreda, count]: [string, any]) => (
                <div key={woreda} className="flex items-center justify-between text-xs p-2 rounded bg-slate-50 border border-slate-100">
                  <span className="font-semibold text-slate-800">{woreda}</span>
                  <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {count} file(s)
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-3 text-center">No address records registered yet</p>
            )}
          </div>
        </div>

        {/* Storage Shelf Distribution */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Physical Storage Utilization (Shelf Inventory)
          </h3>
          <p className="text-[11px] text-slate-500 mb-3">
            Active file density across steel shelving levels and archival box clusters
          </p>

          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {summaryData?.shelfDistribution && Object.keys(summaryData.shelfDistribution).length > 0 ? (
              Object.entries(summaryData.shelfDistribution).map(([shelf, count]: [string, any]) => (
                <div key={shelf} className="flex items-center justify-between text-xs p-2 rounded bg-slate-50 border border-slate-100">
                  <span className="font-semibold text-slate-800">{shelf}</span>
                  <span className="font-mono font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {count} active file(s)
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-3 text-center">No shelves recorded</p>
            )}
          </div>
        </div>
      </div>

      {/* Department Usage Analytics Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            {t('dashboard.departmentActivity')}
          </h3>
          <p className="text-[11px] text-slate-500">
            Real physical files registered and requested across federal institutions
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-4 py-3">Department Code</th>
                <th className="px-4 py-3">Department Name (English & Amharic)</th>
                <th className="px-4 py-3 text-center">Registered Physical Files</th>
                <th className="px-4 py-3 text-center">Requests Filed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summaryData?.departmentStats?.map((dept: any) => (
                <tr key={dept.departmentId} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{dept.code}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{dept.nameEn}</p>
                    <p className="text-[11px] text-slate-600 font-amharic">{dept.nameAm}</p>
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-slate-900">
                    {dept.documentCount}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-blue-700">
                    {dept.requestCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Archival Security & Compliance Checklist */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900">
          Federal Archive Legal Compliance & Custody Standards
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Conforms with Federal Democratic Republic of Ethiopia Archives & Public Records Proclamation
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
          <div className="flex items-start space-x-2">
            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800">100% Traceable Custody</p>
              <p className="text-slate-500 text-[11px]">
                Every physical file jacket possesses an unbroken cryptographic and historical movement record.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-2">
            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800">Physical Label Standard</p>
              <p className="text-slate-500 text-[11px]">
                High-density 2D QR labels encode unique reference numbers for barcode archive reader integration.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-2">
            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800">Immutable Audit Trail</p>
              <p className="text-slate-500 text-[11px]">
                System administrators cannot overwrite or delete file movement history or handover timestamps.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-2">
            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800">Separation of Duties</p>
              <p className="text-slate-500 text-[11px]">
                Managerial approval is strictly separated from physical officer file issue and return operations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

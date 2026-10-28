import React, { useState, useEffect } from 'react';
import {
  History,
  FileText,
  User,
  MapPin,
  Calendar,
  Filter,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../ui/StatusBadge';
import { formatBilingualDate } from '../../lib/ethiopianCalendar';

export const MovementsView: React.FC = () => {
  const { t, locale, isAmharic } = useLanguage();
  const { token } = useAuth();

  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>('ALL');

  const fetchMovements = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/reports/summary', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMovements(data.recentMovements || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, [token]);

  const filteredMovements =
    filterType === 'ALL'
      ? movements
      : movements.filter((m) => m.movementType === filterType);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {t('nav.movements')}
          </h2>
          <p className="text-xs text-slate-500">
            {isAmharic
              ? 'የማይሻር እና የማይሰረዝ የሰነዶች አካላዊ ርክክብ፣ ዝውውር እና የቦታ ለውጥ መዝገብ'
              : 'Append-only chronological custody ledger: full audit trail of document locations and holders.'}
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          {['ALL', 'REGISTRATION', 'ISSUE', 'RETURN', 'RELOCATION', 'MISSING_REPORT', 'RECOVERY'].map(
            (tp) => (
              <button
                key={tp}
                onClick={() => setFilterType(tp)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  filterType === tp
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {tp === 'ALL' ? (isAmharic ? 'ሁሉም እንቅስቃሴዎች' : 'All Events') : tp}
              </button>
            )
          )}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            {isAmharic ? 'የእንቅስቃሴ መዝገብ በመጫን ላይ ነው...' : 'Loading movement records...'}
          </div>
        ) : filteredMovements.length === 0 ? (
          <div className="p-12 text-center">
            <History className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-700">
              {isAmharic ? 'ምንም የእንቅስቃሴ መዝገብ አልተገኘም' : 'No movement events recorded.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Document Reference</th>
                  <th className="px-4 py-3">Event Type</th>
                  <th className="px-4 py-3">Reason & Details</th>
                  <th className="px-4 py-3">Acting Officer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMovements.map((m, idx) => (
                  <tr key={`${m.id}-${idx}`} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap">
                      {formatBilingualDate(m.timestamp, locale)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono font-bold text-slate-900">
                        {m.documentRef}
                      </span>
                      <span className="block text-[11px] text-slate-600 truncate max-w-xs">
                        {m.documentTitle}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={m.movementType} size="sm" />
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      <p className="font-semibold text-slate-800">{m.reason}</p>
                      {m.acknowledgmentDetails && (
                        <p className="text-[11px] text-slate-500 italic mt-0.5">
                          {m.acknowledgmentDetails}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-700">
                      <div className="flex items-center space-x-1.5">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        <span>{m.actorName}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

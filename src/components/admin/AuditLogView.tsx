import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  User,
  Clock,
  Laptop,
  CheckCircle,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { formatBilingualDate } from '../../lib/ethiopianCalendar';

export const AuditLogView: React.FC = () => {
  const { t, locale, isAmharic } = useLanguage();
  const { token } = useAuth();

  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  const fetchLogs = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/audit-logs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.auditLogs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [token]);

  const filteredLogs = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.actorName.toLowerCase().includes(search.toLowerCase()) ||
      l.details.toLowerCase().includes(search.toLowerCase()) ||
      l.targetId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">{t('nav.audit')}</h2>
          <p className="text-xs text-slate-500">
            {isAmharic
              ? 'የደህንነት ኦዲት ክትትል፣ የተጠቃሚዎች ድርጊት እና የማይቀየሩ ይፋዊ ምዝገባዎች'
              : 'Immutable security audit trail: all authentication, issue, return, and custody events.'}
          </p>
        </div>

        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search audit actions, actors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-4 text-xs focus:outline-none"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading audit log entries...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">No matching audit logs found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor & Role</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Audit Details</th>
                  <th className="px-4 py-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log, idx) => (
                  <tr key={`${log.id}-${idx}`} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-500 text-[11px]">
                      {formatBilingualDate(log.timestamp, locale)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-semibold text-slate-900">{log.actorName}</p>
                      <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                        {log.actorRole}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-[11px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-sm border border-blue-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-700 text-[11px]">
                      {log.targetType}:{log.targetId}
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-sm">{log.details}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-400">
                      {log.ipAddress || 'internal'}
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

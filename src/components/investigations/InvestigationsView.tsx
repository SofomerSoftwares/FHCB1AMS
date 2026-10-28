import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  FileSearch,
  CheckCircle,
  XCircle,
  Plus,
  User,
  MapPin,
  Calendar,
  X,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../ui/StatusBadge';
import { formatBilingualDate } from '../../lib/ethiopianCalendar';

export const InvestigationsView: React.FC = () => {
  const { t, locale, isAmharic } = useLanguage();
  const { user, token, hasRole } = useAuth();

  const [investigations, setInvestigations] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Selected investigation for notes & resolution
  const [selectedCase, setSelectedCase] = useState<any | null>(null);
  const [newFindingNote, setNewFindingNote] = useState<string>('');
  const [showResolveModal, setShowResolveModal] = useState<boolean>(false);
  const [resolutionType, setResolutionType] = useState<string>('RESOLVED_FOUND');
  const [resolutionDetails, setResolutionDetails] = useState<string>('');
  const [restoredLocationId, setRestoredLocationId] = useState<string>('');

  const fetchInvestigations = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [invRes, locRes] = await Promise.all([
        fetch('/api/investigations', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/locations', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (invRes.ok) {
        const data = await invRes.json();
        setInvestigations(data.investigations || []);
      }
      if (locRes.ok) {
        const locData = await locRes.json();
        setLocations(locData.locations || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvestigations();
  }, [token]);

  // Add investigation finding note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !newFindingNote.trim()) return;

    try {
      const res = await fetch(`/api/investigations/${selectedCase.id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ note: newFindingNote }),
      });

      if (res.ok) {
        setNewFindingNote('');
        fetchInvestigations();
        // Update selectedCase
        const updated = await res.json();
        setSelectedCase((prev: any) => ({ ...prev, notes: updated.notes }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Resolve case
  const handleResolveCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !resolutionDetails.trim()) {
      alert('Resolution details are required.');
      return;
    }

    try {
      const res = await fetch(`/api/investigations/${selectedCase.id}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          resolutionType,
          resolutionDetails,
          restoredLocationId: restoredLocationId || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setShowResolveModal(false);
        setSelectedCase(null);
        fetchInvestigations();
        alert(data.message || 'Case resolved.');
      } else {
        alert(data.error || 'Failed to resolve case.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          {t('investigation.title')}
        </h2>
        <p className="text-xs text-slate-500">
          {isAmharic
            ? 'በመደርደሪያ ላይ ያልተገኙ ሰነዶች የምርመራ መዝገብ፣ ግኝቶች እና ይፋዊ መፍትሔዎች'
            : 'Controlled formal investigation workflow for unaccounted or misplaced physical files.'}
        </p>
      </div>

      {/* Cases Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {loading ? (
          <div className="lg:col-span-2 p-8 text-center text-xs text-slate-500 rounded-xl border border-slate-200 bg-white">
            {isAmharic ? 'የምርመራ መዝገቦች በመጫን ላይ ናቸው...' : 'Loading investigation records...'}
          </div>
        ) : investigations.length === 0 ? (
          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-12 text-center shadow-xs">
            <CheckCircle className="mx-auto h-10 w-10 text-emerald-500" />
            <h3 className="mt-2 text-sm font-bold text-slate-900">
              {isAmharic ? 'ምንም የጠፋ ሰነድ ሪፖርት የለም' : 'No missing file investigations active.'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              All physical documents are accounted for in their designated boxes.
            </p>
          </div>
        ) : (
          investigations.map((inv) => (
            <div
              key={inv.id}
              className={`rounded-xl border p-5 shadow-xs transition ${
                inv.status === 'UNDER_INVESTIGATION' || inv.status === 'OPEN'
                  ? 'border-rose-300 bg-white'
                  : 'border-slate-200 bg-slate-50/60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      INC-{inv.id.substring(4)}
                    </span>
                    <span
                      className={`rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase ${
                        inv.status.startsWith('RESOLVED')
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800 animate-pulse'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>

                  <h3 className="mt-1 text-sm font-bold text-slate-900">
                    {inv.document?.titleEn}
                  </h3>
                  <p className="font-mono text-xs text-slate-500">
                    {inv.document?.referenceNumber}
                  </p>
                </div>

                {hasRole('ADMIN', 'ARCHIVE_OFFICER') &&
                  (inv.status === 'OPEN' || inv.status === 'UNDER_INVESTIGATION') && (
                    <button
                      onClick={() => {
                        setSelectedCase(inv);
                        setShowResolveModal(true);
                      }}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
                    >
                      Resolve Case
                    </button>
                  )}
              </div>

              {/* Last known details */}
              <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs space-y-1">
                <p>
                  <span className="font-semibold text-slate-500">
                    {t('investigation.lastLocation')}:
                  </span>{' '}
                  <span className="font-bold text-slate-800">
                    {inv.lastLocationPath || 'Storage Box'}
                  </span>
                </p>
                <p>
                  <span className="font-semibold text-slate-500">
                    {t('investigation.reporter')}:
                  </span>{' '}
                  <span className="font-medium text-slate-800">{inv.reporter?.fullName}</span> (
                  {formatBilingualDate(inv.reportedAt, locale)})
                </p>
                {inv.resolutionDetails && (
                  <p className="mt-2 border-t border-slate-200 pt-2 text-emerald-800 font-medium">
                    <span className="font-bold">Formal Resolution:</span> {inv.resolutionDetails}
                  </p>
                )}
              </div>

              {/* Notes Timeline */}
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t('investigation.notes')} ({inv.notes?.length || 0})
                </p>

                <div className="mt-2 space-y-2 max-h-36 overflow-y-auto pr-1">
                  {inv.notes?.map((n: any, idx: number) => (
                    <div key={idx} className="rounded-md bg-white p-2 border border-slate-200 text-xs">
                      <p className="text-slate-800">{n.note}</p>
                      <p className="mt-1 text-[10px] text-slate-400 font-mono">
                        {formatBilingualDate(n.timestamp, locale)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Add Note Input if active */}
                {(inv.status === 'OPEN' || inv.status === 'UNDER_INVESTIGATION') && (
                  <div className="mt-3 flex items-center space-x-2">
                    <button
                      onClick={() => setSelectedCase(inv)}
                      className="w-full rounded-md border border-slate-300 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
                    >
                      {t('investigation.addNote')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Note Modal */}
      {selectedCase && !showResolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setSelectedCase(null)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900">{t('investigation.addNote')}</h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              {selectedCase.document?.referenceNumber}
            </p>

            <form onSubmit={handleAddNote} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Finding Note *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Record interview notes, adjacent storage box check, or security camera findings..."
                  value={newFindingNote}
                  onChange={(e) => setNewFindingNote(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedCase(null)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t('actions.cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-800"
                >
                  Save Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Investigation Modal */}
      {showResolveModal && selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setShowResolveModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900">Resolve Investigation</h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              {selectedCase.document?.referenceNumber}
            </p>

            <form onSubmit={handleResolveCase} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Resolution Decision *
                </label>
                <select
                  value={resolutionType}
                  onChange={(e) => setResolutionType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:outline-none"
                >
                  <option value="RESOLVED_FOUND">{t('investigation.resolveFound')}</option>
                  <option value="RESOLVED_LOST">{t('investigation.resolveLost')}</option>
                </select>
              </div>

              {resolutionType === 'RESOLVED_FOUND' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Restored Storage Box / Shelf Location
                  </label>
                  <select
                    value={restoredLocationId}
                    onChange={(e) => setRestoredLocationId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:outline-none"
                  >
                    <option value="">Restore to Original Shelf Location</option>
                    {locations
                      .filter((l) => l.type === 'BOX' || l.type === 'SHELF')
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.code} - {l.fullPath}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Resolution Findings & Formal Summary *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detail where the document was located, conditions, and sign-off justification..."
                  value={resolutionDetails}
                  onChange={(e) => setResolutionDetails(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t('actions.cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-800"
                >
                  Confirm Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

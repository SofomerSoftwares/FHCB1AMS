import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  CheckCircle,
  XCircle,
  FileText,
  User,
  Calendar,
  AlertCircle,
  X,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { StatusBadge } from '../ui/StatusBadge';
import { formatBilingualDate } from '../../lib/ethiopianCalendar';

export const ApprovalsView: React.FC = () => {
  const { t, locale, isAmharic } = useLanguage();
  const { user, token } = useAuth();
  const { notify } = useNotification();

  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Reject modal
  const [rejectingReq, setRejectingReq] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [actionError, setActionError] = useState<string>('');

  const fetchPendingRequests = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/requests', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // Filter pending requests
        const pending = (data.requests || []).filter((r: any) => r.status === 'PENDING');
        setPendingRequests(pending);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingRequests();
  }, [token]);

  const handleApprove = async (requestId: string) => {
    if (!token) return;
    try {
      const targetReq = pendingRequests.find((r) => r.id === requestId);
      const res = await fetch(`/api/requests/${requestId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ decision: 'APPROVE' }),
      });

      if (res.ok) {
        notify({
          titleEn: 'Request Approved Successfully',
          titleAm: 'የሰነድ ጥያቄው ፀድቋል',
          messageEn: `Request ${targetReq?.requestNumber || ''} approved. Requester and Archive Officers alerted via browser notifications.`,
          messageAm: `ጥያቄ ${targetReq?.requestNumber || ''} ፀድቋል። ለጠያቂው እና ለማህደር ኃላፊዎች ማሳወቂያ ተልኳል።`,
          type: 'SUCCESS',
          sound: true,
        });
        fetchPendingRequests();
      } else {
        const data = await res.json();
        notify({
          titleEn: 'Approval Failed',
          titleAm: 'ማጽደቅ አልተሳካም',
          messageEn: data.error || 'Failed to approve request.',
          messageAm: data.error || 'ጥያቄ ማጽደቅ አልተሳካም።',
          type: 'ALERT',
          sound: true,
        });
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingReq || !rejectionReason.trim()) {
      setActionError('Rejection reason is required.');
      return;
    }

    try {
      const res = await fetch(`/api/requests/${rejectingReq.id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          decision: 'REJECT',
          rejectionReason,
        }),
      });

      if (res.ok) {
        notify({
          titleEn: 'Request Rejected',
          titleAm: 'ጥያቄው ውድቅ ተደርጓል',
          messageEn: `Request ${rejectingReq.requestNumber} rejected. Rejection notice dispatched to requester.`,
          messageAm: `ጥያቄ ${rejectingReq.requestNumber} ውድቅ ተደርጓል። ውሳኔው ለጠያቂው ተልኳል።`,
          type: 'ALERT',
          sound: true,
        });
        setRejectingReq(null);
        setRejectionReason('');
        fetchPendingRequests();
      } else {
        const data = await res.json();
        setActionError(data.error || 'Failed to reject request.');
      }
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          {t('nav.approvals')}
        </h2>
        <p className="text-xs text-slate-500">
          {isAmharic
            ? 'የመምሪያ ኃላፊ እና አስተዳዳሪ የሰነድ ጥያቄዎች ግምገማ እና ውሳኔ መስጫ'
            : 'Department Manager review queue: evaluate business justification before authorizing file handover.'}
        </p>
      </div>

      {/* Review Queue */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 rounded-xl border border-slate-200 bg-white">
            {isAmharic ? 'የሚገመገሙ ጥያቄዎች በመጫን ላይ ናቸው...' : 'Loading pending requests...'}
          </div>
        ) : pendingRequests.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-xs">
            <CheckCircle className="mx-auto h-10 w-10 text-emerald-500" />
            <h3 className="mt-2 text-sm font-bold text-slate-900">
              {isAmharic ? 'ሁሉም ጥያቄዎች ተገምግመዋል' : 'All clear! No pending requests awaiting review.'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isAmharic
                ? 'አዳዲስ ሰራተኞች ሰነድ ሲጠይቁ እዚህ ይዘረዘራሉ'
                : 'When employees in your department submit file access requests, they will appear here.'}
            </p>
          </div>
        ) : (
          pendingRequests.map((req) => (
            <div
              key={req.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300"
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {req.requestNumber}
                    </span>
                    <span
                      className={`rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase ${
                        req.priority === 'VERY_URGENT'
                          ? 'bg-rose-100 text-rose-800'
                          : req.priority === 'URGENT'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {req.priority}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Requested {formatBilingualDate(req.requestDate, locale)}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900">
                    {req.document?.titleEn}
                  </h3>
                  <p className="font-mono text-xs text-emerald-700">
                    {req.document?.referenceNumber}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setActionError('');
                      setRejectionReason('');
                      setRejectingReq(req);
                    }}
                    className="inline-flex items-center space-x-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>{t('actions.reject')}</span>
                  </button>

                  <button
                    onClick={() => handleApprove(req.id)}
                    className="inline-flex items-center space-x-1.5 rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 transition shadow-xs"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>{t('actions.approve')}</span>
                  </button>
                </div>
              </div>

              {/* Business Purpose & Requester Card */}
              <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t('requests.purpose')}
                </p>
                <p className="mt-1 text-slate-800 font-medium">"{req.purpose}"</p>

                <div className="mt-3 flex flex-wrap items-center justify-between border-t border-slate-200 pt-2 text-[11px] text-slate-500">
                  <div className="flex items-center space-x-1">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {req.requester?.fullName} ({req.department?.nameEn})
                    </span>
                  </div>
                  <div className="flex items-center space-x-1 font-semibold text-slate-700">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>Due: {formatBilingualDate(req.requestedReturnDate, locale)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reject Modal */}
      {rejectingReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-xl border border-rose-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setRejectingReq(null)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-2 text-rose-700">
              <AlertCircle className="h-5 w-5" />
              <h3 className="text-base font-bold text-slate-900">{t('actions.reject')}</h3>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              {rejectingReq.requestNumber} — {rejectingReq.document?.titleEn}
            </p>

            {actionError && (
              <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-2 text-xs text-rose-700">
                {actionError}
              </div>
            )}

            <form onSubmit={handleRejectSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Reason for Rejection *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain why this request is declined (e.g. insufficient security clearance, digital copy available)..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-rose-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => setRejectingReq(null)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t('actions.cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-rose-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-800"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

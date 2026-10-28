import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Clock,
  CheckCircle,
  XCircle,
  AlertOctagon,
  ArrowRight,
  User,
  Calendar,
  X,
  FileCheck,
  RotateCcw,
  ShieldAlert,
  BellRing,
  Zap,
  Send,
  Plus,
  Search,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { StatusBadge } from '../ui/StatusBadge';
import { formatBilingualDate } from '../../lib/ethiopianCalendar';
import { IArchiveLocation } from '../../types';

export const RequestsView: React.FC = () => {
  const { t, locale, isAmharic } = useLanguage();
  const { user, token, hasRole, hasPermission, settings } = useAuth();
  const { notify } = useNotification();

  const [requests, setRequests] = useState<any[]>([]);
  const [locations, setLocations] = useState<IArchiveLocation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Modals
  const [issueRequest, setIssueRequest] = useState<any | null>(null);
  const [returnRequest, setReturnRequest] = useState<any | null>(null);
  const [detailRequest, setDetailRequest] = useState<any | null>(null);

  // Adjust Return Time & Date State
  const [adjustRequest, setAdjustRequest] = useState<any | null>(null);
  const [adjustDate, setAdjustDate] = useState<string>('');
  const [adjustTime, setAdjustTime] = useState<string>('17:00');
  const [adjustReason, setAdjustReason] = useState<string>('Official Directorate schedule adjustment');
  const [adjustNotifyBorrower, setAdjustNotifyBorrower] = useState<boolean>(true);

  // Requester Extension Modal State
  const [extensionRequest, setExtensionRequest] = useState<any | null>(null);
  const [extensionDate, setExtensionDate] = useState<string>('');
  const [extensionTime, setExtensionTime] = useState<string>('17:00');
  const [extensionReason, setExtensionReason] = useState<string>('');

  // Issue modal fields
  const [issueNotes, setIssueNotes] = useState<string>('');
  const [issueAcknowledgment, setIssueAcknowledgment] = useState<string>('');

  // Return modal fields
  const [returnLocationId, setReturnLocationId] = useState<string>('');
  const [returnCondition, setReturnCondition] = useState<string>('GOOD');
  const [returnConditionNotes, setReturnConditionNotes] = useState<string>('');

  const [actionError, setActionError] = useState<string>('');
  const [actionSuccess, setActionSuccess] = useState<string>('');

  // Fast Request Modal State
  const [showFastRequestModal, setShowFastRequestModal] = useState<boolean>(false);
  const [availableDocs, setAvailableDocs] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(false);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [docSearchQuery, setDocSearchQuery] = useState<string>('');
  const [fastPurpose, setFastPurpose] = useState<string>('Official Directorate Review');
  const [fastReturnDate, setFastReturnDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().substring(0, 10);
  });
  const [fastPriority, setFastPriority] = useState<string>('NORMAL');
  const [fastSubmitError, setFastSubmitError] = useState<string>('');
  const [fastSubmitSuccess, setFastSubmitSuccess] = useState<string>('');

  const fetchRequests = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [reqRes, locRes] = await Promise.all([
        fetch('/api/requests', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/locations', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (reqRes.ok) {
        const data = await reqRes.json();
        setRequests(data.requests || []);
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
    fetchRequests();
  }, [token]);

  // Handle Physical Issue (Handover to Borrower)
  const handleConfirmIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueRequest) return;
    setActionError('');
    setActionSuccess('');

    try {
      const res = await fetch(`/api/requests/${issueRequest.id}/issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          notes: issueNotes,
          acknowledgmentDetails: issueAcknowledgment,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Failed to issue file.');
        return;
      }

      setActionSuccess('Physical document successfully issued into borrower custody.');
      setTimeout(() => {
        setIssueRequest(null);
        fetchRequests();
      }, 1000);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  // Handle Return Verification
  const handleConfirmReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnRequest) return;
    setActionError('');
    setActionSuccess('');

    try {
      const res = await fetch(`/api/requests/${returnRequest.id}/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          returnLocationId: returnLocationId || undefined,
          condition: returnCondition,
          conditionNotes: returnConditionNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Failed to process return.');
        return;
      }

      setActionSuccess('File return verified. Document restored in archive storage.');
      notify({
        titleEn: 'Document Return Completed',
        titleAm: 'የሰነድ ርክክብ ተጠናቋል',
        messageEn: `Physical file "${returnRequest.document?.titleEn}" restored to archive storage.`,
        messageAm: `ሰነድ "${returnRequest.document?.titleAm}" ወደ ማህደር ማከማቻው ተመልሷል።`,
        type: 'SUCCESS',
        sound: true,
      });
      setTimeout(() => {
        setReturnRequest(null);
        fetchRequests();
      }, 1000);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  // Borrower: Request to Return physical file
  const handleRequestToReturn = async (reqItem: any) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/requests/${reqItem.id}/request-return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        notify({
          titleEn: 'Return Request Sent',
          titleAm: 'የመመለሻ ጥያቄ ደርሷል',
          messageEn: `Archive Officers alerted for file "${reqItem.document?.titleEn}". Please present the physical document to the Archive desk.`,
          messageAm: `ለሰነድ "${reqItem.document?.titleAm}" ማሳወቂያ ተልኳል። ሰነዱን በማህደር ክፍል በአካል ያስረክቡ።`,
          type: 'SUCCESS',
          sound: true,
        });
        fetchRequests();
      } else {
        notify({
          titleEn: 'Return Request Failed',
          titleAm: 'የመመለሻ ጥያቄ አልተሳካም',
          messageEn: data.error || 'Failed to submit return notice.',
          messageAm: data.error || 'የመመለሻ ጥያቄ ማቅረብ አልተሳካም።',
          type: 'ALERT',
          sound: true,
        });
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  // Archive Officer / Admin: Send Return Notice to Borrower
  const handleSendReturnNotice = async (reqItem: any) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/requests/${reqItem.id}/send-return-notice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        notify({
          titleEn: 'Return Notice Dispatched',
          titleAm: 'የመመለሻ ማሳሰቢያ ተልኳል',
          messageEn: `Borrower ${reqItem.requester?.fullName} alerted via browser notification to return "${reqItem.document?.titleEn}".`,
          messageAm: `ለተጠቃሚ ${reqItem.requester?.fullName} ሰነድ "${reqItem.document?.titleAm}" እንዲመልሱ የአሳሽ ማሳሰቢያ ተልኳል።`,
          type: 'WARNING',
          sound: true,
        });
        fetchRequests();
      } else {
        notify({
          titleEn: 'Failed to Send Notice',
          titleAm: 'ማሳሰቢያ መላክ አልተሳካም',
          messageEn: data.error || 'Failed to send return notice.',
          messageAm: data.error || 'የመመለሻ ማሳሰቢያ መላክ አልተሳካም።',
          type: 'ALERT',
          sound: true,
        });
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  // Open Adjust Return Modal (RBAC Authorized)
  const handleOpenAdjustModal = (reqItem: any) => {
    setActionError('');
    setActionSuccess('');
    setAdjustRequest(reqItem);

    // Compute initial date & time
    const existing = reqItem.requestedReturnDate ? new Date(reqItem.requestedReturnDate) : new Date();
    if (!reqItem.requestedReturnDate) {
      existing.setDate(existing.getDate() + (settings?.returnPolicy?.defaultReturnDays || 7));
    }
    setAdjustDate(existing.toISOString().substring(0, 10));

    const timeMatch = reqItem.requestedReturnDate?.match(/T(\d{2}:\d{2})/);
    setAdjustTime(timeMatch ? timeMatch[1] : (settings?.returnPolicy?.defaultReturnTime || '17:00'));

    setAdjustReason(
      reqItem.extensionReason
        ? `Extension granted: ${reqItem.extensionReason}`
        : 'Official Directorate schedule adjustment'
    );
    setAdjustNotifyBorrower(true);
  };

  // Submit Adjust Return
  const handleSubmitAdjustReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !adjustRequest) return;
    setActionError('');
    setActionSuccess('');

    try {
      const res = await fetch(`/api/requests/${adjustRequest.id}/adjust-return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          newReturnDate: adjustDate,
          newReturnTime: adjustTime,
          reason: adjustReason,
          notifyBorrower: adjustNotifyBorrower,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Failed to adjust return date.');
        return;
      }

      setActionSuccess('Return deadline adjusted successfully.');
      notify({
        titleEn: 'Return Schedule Adjusted',
        titleAm: 'የመመለሻ ቀጠሮ ተስተካክሏል',
        messageEn: `New return deadline for "${adjustRequest.document?.titleEn}" set to ${adjustDate} @ ${adjustTime}.`,
        messageAm: `ለሰነድ "${adjustRequest.document?.titleAm}" አዲስ የመመለሻ ቀጠሮ ወደ ${adjustDate} @ ${adjustTime} ተስተካክሏል።`,
        type: 'SUCCESS',
        sound: true,
      });

      setTimeout(() => {
        setAdjustRequest(null);
        fetchRequests();
      }, 1000);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  // Open Extension Request Modal (for Borrowers)
  const handleOpenExtensionModal = (reqItem: any) => {
    setActionError('');
    setActionSuccess('');
    setExtensionRequest(reqItem);
    const target = new Date();
    target.setDate(target.getDate() + 7);
    setExtensionDate(target.toISOString().substring(0, 10));
    setExtensionTime(settings?.returnPolicy?.defaultReturnTime || '17:00');
    setExtensionReason('');
  };

  // Submit Extension Request
  const handleSubmitExtensionRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !extensionRequest) return;
    setActionError('');
    setActionSuccess('');

    try {
      const res = await fetch(`/api/requests/${extensionRequest.id}/request-extension`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requestedDate: extensionDate,
          requestedTime: extensionTime,
          reason: extensionReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Failed to submit extension request.');
        return;
      }

      setActionSuccess('Extension request submitted to archive desk.');
      notify({
        titleEn: 'Extension Request Sent',
        titleAm: 'የጊዜ ማራዘሚያ ጥያቄ ደርሷል',
        messageEn: `Archive Officers alerted for extension of "${extensionRequest.document?.titleEn}".`,
        messageAm: `የጊዜ ማራዘሚያ ጥያቄዎ ለማህደር ኃላፊዎች ደርሷል።`,
        type: 'SUCCESS',
        sound: true,
      });

      setTimeout(() => {
        setExtensionRequest(null);
        fetchRequests();
      }, 1000);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleOpenCreateFastRequest = async () => {
    setFastSubmitError('');
    setFastSubmitSuccess('');
    setShowFastRequestModal(true);
    if (availableDocs.length === 0) {
      setLoadingDocs(true);
      try {
        const res = await fetch('/api/documents?status=AVAILABLE&limit=100', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const docs = data.documents || [];
          setAvailableDocs(docs);
          if (docs.length > 0 && !selectedDocId) {
            setSelectedDocId(docs[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingDocs(false);
      }
    }
  };

  const handleFastRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocId) {
      setFastSubmitError(isAmharic ? 'እባክዎ የሚጠይቁትን ሰነድ ይምረጡ' : 'Please select an available document.');
      return;
    }
    if (!fastPurpose.trim()) {
      setFastSubmitError(isAmharic ? 'የስራ ዓላማ መጥቀስ ግዴታ ነው' : 'Business purpose is required.');
      return;
    }

    const doc = availableDocs.find((d) => d.id === selectedDocId);
    setFastSubmitError('');
    setFastSubmitSuccess('');

    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          documentId: selectedDocId,
          purpose: fastPurpose.trim(),
          requestedReturnDate: new Date(fastReturnDate).toISOString(),
          priority: fastPriority,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFastSubmitError(data.error || 'Failed to submit request.');
        return;
      }

      setFastSubmitSuccess(`Request ${data.request?.requestNumber} submitted successfully!`);
      notify({
        titleEn: 'Document Request Submitted',
        titleAm: 'የሰነድ ጥያቄ ተመዝግቧል',
        messageEn: `Request ${data.request?.requestNumber} for "${doc?.titleEn || 'Archival File'}" submitted. Reviewers and Archive Officers alerted.`,
        messageAm: `ለሰነድ "${doc?.titleAm || ''}" ያቀረቡት ጥያቄ ${data.request?.requestNumber} ተመዝግቧል። ለኃላፊዎች ማሳወቂያ ተልኳል።`,
        type: 'SUCCESS',
        sound: true,
      });

      setTimeout(() => {
        setShowFastRequestModal(false);
        fetchRequests();
      }, 1200);
    } catch (err: any) {
      setFastSubmitError(err.message || 'Network error.');
    }
  };

  const filteredRequests =
    filterStatus === 'ALL'
      ? requests
      : requests.filter((r) => r.status === filterStatus);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              {t('nav.requests')}
            </h2>
            <button
              onClick={handleOpenCreateFastRequest}
              className="inline-flex items-center space-x-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 transition shadow-xs cursor-pointer"
              title={isAmharic ? 'አዲስ ፈጣን የሰነድ ጥያቄ አቅርብ' : 'Submit a new fast physical document request'}
            >
              <Zap className="h-3.5 w-3.5 fill-current" />
              <span>{isAmharic ? 'ፈጣን ሰነድ መጠየቂያ' : 'Fast Request File'}</span>
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isAmharic
              ? 'የሰነዶች ጥያቄ፣ ማጽደቂያ፣ የአካል ርክክብ እና የመመለሻ ጊዜ ክትትል'
              : 'Physical document requests, custody handover tracking, and return verification.'}
          </p>
        </div>

        {/* Filter status buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          {['ALL', 'PENDING', 'APPROVED', 'ISSUED', 'RETURNED', 'REJECTED'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                filterStatus === st
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {st === 'ALL'
                ? isAmharic
                  ? 'ሁሉም ጥያቄዎች'
                  : 'All Requests'
                : t(`status.${st}`, st)}
            </button>
          ))}
        </div>
      </div>

      {/* Requests Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            {isAmharic ? 'ጥያቄዎች በመጫን ላይ ናቸው...' : 'Loading document requests...'}
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-700">
              {isAmharic ? 'ምንም የሰነድ ጥያቄ አልተገኘም' : 'No document requests found'}
            </p>
            <p className="text-xs text-slate-400">
              {isAmharic
                ? 'አዲስ ጥያቄ ለማቅረብ ወደ የሰነዶች መዝገብ ይሂዱ'
                : 'Browse the Document Registry to submit a physical file access request.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">{t('requests.reqNumber')}</th>
                  <th className="px-4 py-3">{t('document.title')}</th>
                  <th className="px-4 py-3">{t('requests.requester')}</th>
                  <th className="px-4 py-3">{t('requests.returnDate')}</th>
                  <th className="px-4 py-3">{t('requests.priority')}</th>
                  <th className="px-4 py-3">{t('document.status')}</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((req, idx) => (
                  <tr key={`${req.id}-${idx}`} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {req.requestNumber}
                      <span className="block text-[10px] text-slate-400 font-sans font-normal">
                        {formatBilingualDate(req.requestDate, locale)}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-mono text-[11px] text-slate-500">
                        {req.document?.referenceNumber}
                      </p>
                      <p className="font-semibold text-slate-900 line-clamp-1">
                        {req.document?.titleEn}
                      </p>
                      <p className="text-[11px] text-slate-500 line-clamp-1 italic">
                        "{req.purpose}"
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-semibold text-slate-800">{req.requester?.fullName}</p>
                      <p className="text-[10px] text-slate-500">{req.department?.nameEn}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1.5">
                          <span
                            className={`font-semibold ${
                              req.isOverdue
                                ? 'text-rose-700 bg-rose-50 px-2 py-0.5 rounded-sm border border-rose-300'
                                : 'text-slate-700'
                            }`}
                          >
                            {formatBilingualDate(req.requestedReturnDate, locale)}
                          </span>
                          {req.requestedReturnDate?.includes('T') && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {req.requestedReturnDate.match(/T(\d{2}:\d{2})/)?.[1] || '17:00'}
                            </span>
                          )}
                        </div>

                        {req.isOverdue && (
                          <span className="block text-[10px] font-bold text-rose-600 uppercase">
                            ⚠️ Overdue (ጊዜው አልፏል)
                          </span>
                        )}

                        {req.returnDateAdjusted && (
                          <div
                            className="inline-flex items-center space-x-1 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-800"
                            title={`Original: ${req.previousReturnDate ? new Date(req.previousReturnDate).toLocaleDateString() : 'N/A'} • Reason: ${req.adjustmentReason || 'N/A'}`}
                          >
                            <Clock className="h-3 w-3 text-purple-600" />
                            <span>{isAmharic ? 'ቀጠሮ የተራዘመ' : 'Schedule Adjusted'}</span>
                          </div>
                        )}

                        {req.extensionRequested && (
                          <div className="rounded bg-amber-50 border border-amber-300 px-1.5 py-0.5 text-[10px] text-amber-900 mt-1">
                            <span className="font-bold">⏳ {isAmharic ? 'ማራዘሚያ ተጠይቋል:' : 'Ext. Requested:'} </span>
                            <span>{formatBilingualDate(req.extensionRequestedDate, locale)}</span>
                            {req.extensionReason && (
                              <p className="text-[9px] text-amber-700 italic truncate max-w-xs">"{req.extensionReason}"</p>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
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
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={req.status} />
                      {req.status === 'ISSUED' && req.returnRequested && (
                        <span className="block text-[10px] font-bold text-emerald-700 mt-1">
                          {isAmharic ? '⚡ የመመለሻ ጥያቄ ቀርቧል' : '⚡ Return Requested'}
                        </span>
                      )}
                      {req.status === 'ISSUED' && req.returnNoticeSent && (
                        <span className="block text-[10px] font-bold text-amber-700 mt-0.5">
                          {isAmharic ? '🔔 የመመለሻ ጥሪ ተልኳል' : '🔔 Return Notice Sent'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-2">
                        {/* Detail button */}
                        <button
                          onClick={() => setDetailRequest(req)}
                          className="rounded-md border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-100 transition"
                        >
                          Details
                        </button>

                        {/* Adjust Returning Time & Date Button (Authorized Roles) */}
                        {hasPermission('adjustReturnDate') && ['PENDING', 'APPROVED', 'ISSUED'].includes(req.status) && (
                          <button
                            onClick={() => handleOpenAdjustModal(req)}
                            className={`rounded-md px-2 py-1 text-xs font-bold transition flex items-center space-x-1 shadow-2xs ${
                              req.extensionRequested
                                ? 'bg-amber-600 text-white hover:bg-amber-700 ring-2 ring-amber-400'
                                : 'bg-purple-700 text-white hover:bg-purple-800'
                            }`}
                            title={isAmharic ? 'የመመለሻ ቀንና ሰዓት ማስተካከል' : 'Adjust returning time and date'}
                          >
                            <Clock className="h-3 w-3" />
                            <span>
                              {req.extensionRequested
                                ? (isAmharic ? 'ማራዘሚያ ግምግም' : 'Review Ext.')
                                : (isAmharic ? 'ቀጠሮ ማስተካከያ' : 'Adjust Return')}
                            </span>
                          </button>
                        )}

                        {/* Borrower: Request Extension (if allowed and not already authorized to adjust directly) */}
                        {!hasPermission('adjustReturnDate') &&
                          hasPermission('requestExtension') &&
                          settings?.returnPolicy?.allowRequesterExtensionRequest &&
                          user?.id === req.requesterId &&
                          req.status === 'ISSUED' &&
                          !req.extensionRequested && (
                            <button
                              onClick={() => handleOpenExtensionModal(req)}
                              className="rounded-md border border-purple-300 bg-purple-50 px-2 py-1 text-xs font-bold text-purple-800 hover:bg-purple-100 transition flex items-center space-x-1"
                              title={isAmharic ? 'የመመለሻ ጊዜ ማራዘሚያ ጥያቄ አቅርብ' : 'Request return deadline extension'}
                            >
                              <Clock className="h-3 w-3 text-purple-600" />
                              <span>{isAmharic ? 'ማራዘሚያ ጠይቅ' : 'Request Ext.'}</span>
                            </button>
                          )}

                        {/* Borrower: Request to Return (Alerts Archive Officers) */}
                        {(user?.id === req.requesterId || user?.role === 'EMPLOYEE') && req.status === 'ISSUED' && (
                          <button
                            onClick={() => handleRequestToReturn(req)}
                            disabled={req.returnRequested}
                            className={`rounded-md px-2.5 py-1 text-xs font-bold transition flex items-center space-x-1 ${
                              req.returnRequested
                                ? 'bg-amber-100 text-amber-800 border border-amber-300 cursor-default'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs'
                            }`}
                            title={
                              req.returnRequested
                                ? (isAmharic ? 'የመመለሻ ጥያቄ ደርሷል - ርክክብ ይጠበቃል' : 'Return notice already submitted to archive desk')
                                : (isAmharic ? 'ሰነዱን ለመመለስ ለማህደር ኃላፊዎች አሳውቅ' : 'Alert Archive Officers that you are ready to return this file')
                            }
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>
                              {req.returnRequested
                                ? (isAmharic ? 'የመመለሻ ጥሪ ተልኳል' : 'Return Pending')
                                : (isAmharic ? 'ሰነድ ለመመለስ አሳውቅ' : 'Request to Return')}
                            </span>
                          </button>
                        )}

                        {/* Archive Officer / Admin: Send Return Notice / Reminder */}
                        {hasRole('ADMIN', 'ARCHIVE_OFFICER') && req.status === 'ISSUED' && (
                          <button
                            onClick={() => handleSendReturnNotice(req)}
                            className={`rounded-md px-2 py-1 text-xs font-medium transition flex items-center space-x-1 border ${
                              req.returnNoticeSent
                                ? 'border-amber-400 bg-amber-50 text-amber-900'
                                : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-amber-50 hover:text-amber-900'
                            }`}
                            title={isAmharic ? 'ለተጠቃሚው አፋጣኝ የመመለሻ ማሳሰቢያ በአሳሽ ላክ' : 'Send urgent browser alert to borrower requesting file return'}
                          >
                            <BellRing className="h-3 w-3 text-amber-600" />
                            <span>
                              {req.returnNoticeSent
                                ? (isAmharic ? 'ማሳሰቢያ ተልኳል' : 'Notice Sent')
                                : (isAmharic ? 'የመመለሻ ጥሪ ላክ' : 'Send Notice')}
                            </span>
                          </button>
                        )}

                        {/* Archive Officer: Physical Issue */}
                        {hasRole('ADMIN', 'ARCHIVE_OFFICER') && req.status === 'APPROVED' && (
                          <button
                            onClick={() => {
                              setActionError('');
                              setActionSuccess('');
                              setIssueNotes('');
                              setIssueAcknowledgment(`Handover to ${req.requester?.fullName} completed.`);
                              setIssueRequest(req);
                            }}
                            className="rounded-md bg-emerald-700 px-2.5 py-1 text-white font-bold hover:bg-emerald-800 transition flex items-center space-x-1"
                          >
                            <FileCheck className="h-3.5 w-3.5" />
                            <span>{t('actions.issue')}</span>
                          </button>
                        )}

                        {/* Archive Officer: Verify Return */}
                        {hasRole('ADMIN', 'ARCHIVE_OFFICER') && req.status === 'ISSUED' && (
                          <button
                            onClick={() => {
                              setActionError('');
                              setActionSuccess('');
                              setReturnCondition('GOOD');
                              setReturnConditionNotes('');
                              setReturnLocationId('');
                              setReturnRequest(req);
                            }}
                            className="rounded-md bg-blue-700 px-2.5 py-1 text-white font-bold hover:bg-blue-800 transition flex items-center space-x-1"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>{t('actions.return')}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 1. PHYSICAL FILE ISSUE MODAL (Archive Officer Handover) */}
      {/* ========================================================= */}
      {issueRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setIssueRequest(null)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-2 text-emerald-800">
              <FileCheck className="h-5 w-5" />
              <h3 className="text-base font-bold text-slate-900">{t('actions.issue')}</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Record physical handover of file to approved requester.
            </p>

            {actionError && (
              <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-2 text-xs text-rose-700">
                {actionError}
              </div>
            )}
            {actionSuccess && (
              <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-xs text-emerald-800">
                {actionSuccess}
              </div>
            )}

            <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs space-y-1">
              <p>
                <span className="font-semibold text-slate-600">Document:</span>{' '}
                <span className="font-mono font-bold text-slate-900">
                  {issueRequest.document?.referenceNumber}
                </span>{' '}
                — {issueRequest.document?.titleEn}
              </p>
              <p>
                <span className="font-semibold text-slate-600">Approved Recipient:</span>{' '}
                <span className="font-bold text-slate-900">{issueRequest.requester?.fullName}</span>{' '}
                ({issueRequest.department?.nameEn})
              </p>
              <p>
                <span className="font-semibold text-slate-600">Due Return Date:</span>{' '}
                <span className="font-bold text-amber-900">
                  {formatBilingualDate(issueRequest.requestedReturnDate, locale)}
                </span>
              </p>
            </div>

            <form onSubmit={handleConfirmIssue} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Physical Acknowledgment / Handover Verification *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Physical badge inspected, signed custody ledger #402"
                  value={issueAcknowledgment}
                  onChange={(e) => setIssueAcknowledgment(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Issuing Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Folder contains 2 technical annexes in blue binder"
                  value={issueNotes}
                  onChange={(e) => setIssueNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => setIssueRequest(null)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t('actions.cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-800"
                >
                  Confirm Physical Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. PHYSICAL RETURN VERIFICATION MODAL */}
      {/* ========================================================= */}
      {returnRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setReturnRequest(null)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-2 text-blue-800">
              <RotateCcw className="h-5 w-5" />
              <h3 className="text-base font-bold text-slate-900">{t('actions.return')}</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Inspect physical condition and verify storage box placement.
            </p>

            {actionError && (
              <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-2 text-xs text-rose-700">
                {actionError}
              </div>
            )}
            {actionSuccess && (
              <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-xs text-emerald-800">
                {actionSuccess}
              </div>
            )}

            <form onSubmit={handleConfirmReturn} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Return Condition *
                </label>
                <select
                  value={returnCondition}
                  onChange={(e) => setReturnCondition(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:outline-none"
                >
                  <option value="EXCELLENT">EXCELLENT (Pristine, no tears)</option>
                  <option value="GOOD">GOOD (Normal handling wear)</option>
                  <option value="FAIR">FAIR (Minor creases/wear)</option>
                  <option value="DAMAGED">DAMAGED (Torn pages or missing seals)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Destination Storage Box / Shelf
                </label>
                <select
                  value={returnLocationId}
                  onChange={(e) => setReturnLocationId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:outline-none"
                >
                  <option value="">Restore to Original Shelf Location</option>
                  {locations
                    .filter((l) => l.type === 'BOX' || l.type === 'SHELF')
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code} ({l.type}) - {l.fullPath}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Condition & Physical Inspection Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. All annexes present and verified against index"
                  value={returnConditionNotes}
                  onChange={(e) => setReturnConditionNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => setReturnRequest(null)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t('actions.cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-800"
                >
                  Confirm Verified Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. REQUEST DETAIL MODAL */}
      {/* ========================================================= */}
      {detailRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setDetailRequest(null)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-2">
              <span className="font-mono text-sm font-bold text-slate-900">
                {detailRequest.requestNumber}
              </span>
              <StatusBadge status={detailRequest.status} />
            </div>

            <h4 className="mt-2 text-sm font-bold text-slate-900">
              {detailRequest.document?.titleEn}
            </h4>
            <p className="font-mono text-xs text-slate-500">
              {detailRequest.document?.referenceNumber}
            </p>

            <div className="mt-4 space-y-2 text-xs border-t border-slate-200 pt-3">
              <div>
                <span className="font-semibold text-slate-600">Requester:</span>{' '}
                <span className="text-slate-900 font-bold">{detailRequest.requester?.fullName}</span>{' '}
                ({detailRequest.department?.nameEn})
              </div>
              <div>
                <span className="font-semibold text-slate-600">Business Purpose:</span>
                <p className="mt-0.5 text-slate-700 bg-slate-50 p-2 rounded-md border border-slate-200">
                  {detailRequest.purpose}
                </p>
              </div>
              <div>
                <span className="font-semibold text-slate-600">Requested Due Date:</span>{' '}
                <span className="font-bold text-slate-900">
                  {formatBilingualDate(detailRequest.requestedReturnDate, locale)}
                </span>
              </div>
              {detailRequest.approver && (
                <div>
                  <span className="font-semibold text-slate-600">Authorized Approver:</span>{' '}
                  <span className="font-bold text-slate-900">{detailRequest.approver.fullName}</span>{' '}
                  ({formatBilingualDate(detailRequest.decisionDate, locale)})
                </div>
              )}
              {detailRequest.rejectionReason && (
                <div className="rounded-md bg-rose-50 p-2 border border-rose-200 text-rose-800">
                  <span className="font-bold">Rejection Reason:</span>{' '}
                  {detailRequest.rejectionReason}
                </div>
              )}
              {detailRequest.issuer && (
                <div>
                  <span className="font-semibold text-slate-600">Issued by Officer:</span>{' '}
                  <span className="font-bold text-slate-900">{detailRequest.issuer.fullName}</span>{' '}
                  ({formatBilingualDate(detailRequest.issuedDate, locale)})
                </div>
              )}
              {detailRequest.actualReturnDate && (
                <div>
                  <span className="font-semibold text-slate-600">Returned & Verified on:</span>{' '}
                  <span className="font-bold text-emerald-800">
                    {formatBilingualDate(detailRequest.actualReturnDate, locale)}
                  </span>{' '}
                  (Condition: {detailRequest.returnCondition || 'GOOD'})
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end border-t border-slate-200 pt-3">
              <button
                onClick={() => setDetailRequest(null)}
                className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. FAST DOCUMENT REQUEST MODAL (Direct from Requests View) */}
      {/* ========================================================= */}
      {showFastRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowFastRequestModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-2 text-emerald-800">
              <Zap className="h-5 w-5 text-emerald-600 fill-emerald-500" />
              <h3 className="text-base font-bold text-slate-900">
                {isAmharic ? 'ፈጣን የሰነድ ጥያቄ አቅርብ' : 'Fast Official Document Request'}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAmharic
                ? 'የሚፈልጉትን ዝግጁ ሰነድ ይምረጡና ጥያቄዎን በአንድ ጠቅታ ይላኩ።'
                : 'Select an available archive record and submit your physical custody request.'}
            </p>

            {fastSubmitError && (
              <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
                {fastSubmitError}
              </div>
            )}
            {fastSubmitSuccess && (
              <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800">
                {fastSubmitSuccess}
              </div>
            )}

            <form onSubmit={handleFastRequestSubmit} className="mt-4 space-y-4">
              {/* Document Selector & Live Search */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isAmharic ? 'የሚጠየቀው የማህደር ሰነድ (ዝግጁ የሆኑ)' : 'Select Available Document *'}
                </label>

                {loadingDocs ? (
                  <div className="py-4 text-center text-xs text-slate-500">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent mx-auto"></div>
                    <span className="mt-1 block">Loading available archive records...</span>
                  </div>
                ) : (
                  <>
                    {/* Filter Input */}
                    <div className="relative mb-2">
                      <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder={isAmharic ? 'በመለያ ቁጥር ወይም ርዕስ ፈልግ...' : 'Search available files by Ref, Title, Shelf...'}
                        value={docSearchQuery}
                        onChange={(e) => setDocSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-xs focus:border-emerald-600 focus:outline-none bg-slate-50/50"
                      />
                    </div>

                    {/* Document Dropdown / List */}
                    <select
                      value={selectedDocId}
                      onChange={(e) => setSelectedDocId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-emerald-600 focus:outline-none font-mono"
                      size={4}
                    >
                      {availableDocs
                        .filter((d) => {
                          if (!docSearchQuery.trim()) return true;
                          const q = docSearchQuery.toLowerCase();
                          return (
                            d.referenceNumber?.toLowerCase().includes(q) ||
                            d.titleEn?.toLowerCase().includes(q) ||
                            d.titleAm?.includes(q) ||
                            d.shelfNumber?.includes(q) ||
                            d.boxNumber?.includes(q) ||
                            d.oldWoreda?.includes(q) ||
                            d.oldKebele?.includes(q) ||
                            d.houseNumber?.includes(q)
                          );
                        })
                        .map((d) => (
                          <option key={d.id} value={d.id} className="py-1 px-1.5">
                            [{d.category}] {d.referenceNumber} — {d.titleEn} (Shelf {d.shelfNumber || '?'}, Box {d.boxNumber || '?'})
                          </option>
                        ))}
                    </select>

                    {/* Selected Document Details Card */}
                    {selectedDocId && (
                      <div className="mt-2 rounded-lg bg-emerald-50/70 border border-emerald-200 p-2.5 text-xs">
                        {(() => {
                          const doc = availableDocs.find((d) => d.id === selectedDocId);
                          if (!doc) return null;
                          return (
                            <div>
                              <div className="flex items-center justify-between font-mono font-bold text-slate-900">
                                <span>{doc.referenceNumber}</span>
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                                  {doc.category}
                                </span>
                              </div>
                              <p className="font-semibold text-slate-800 mt-0.5 line-clamp-1">{doc.titleEn}</p>
                              <div className="mt-1 flex items-center space-x-3 text-[11px] text-slate-600">
                                <span>Shelf: <strong className="font-mono">{doc.shelfNumber || '-'}</strong></span>
                                <span>Box: <strong className="font-mono">{doc.boxNumber || '-'}</strong></span>
                                {doc.oldWoreda && <span>Woreda: <strong>{doc.oldWoreda}</strong></span>}
                                {doc.houseNumber && <span>House: <strong>{doc.houseNumber}</strong></span>}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Purpose & Fast Chips */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    {t('requests.purpose')} *
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {isAmharic ? 'ፈጣን ምርጫዎች:' : 'Quick Select:'}
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap gap-1.5 mb-1.5">
                  {[
                    { en: 'Official Directorate Review', am: 'የስራ አስፈፃሚ ግምገማ' },
                    { en: 'Financial & Contract Audit', am: 'የፋይናንስ እና ውል ኦዲት' },
                    { en: 'Legal Court Verification', am: 'የህግና ፍርድ ቤት ማረጋገጫ' },
                    { en: 'Administrative Public Deed Check', am: 'የህዝብ ሰነድ ምዝገባ ማጣሪያ' },
                  ].map((preset) => (
                    <button
                      key={preset.en}
                      type="button"
                      onClick={() => setFastPurpose(preset.en)}
                      className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition ${
                        fastPurpose === preset.en
                          ? 'bg-emerald-700 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      {isAmharic ? preset.am : preset.en}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={2}
                  required
                  placeholder="Official government purpose for physical custody..."
                  value={fastPurpose}
                  onChange={(e) => setFastPurpose(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {/* Return Date & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    {t('requests.returnDate')} *
                  </label>
                  <div className="mt-1 flex gap-1 mb-1">
                    {[3, 7, 14, 30].map((days) => {
                      const d = new Date();
                      d.setDate(d.getDate() + days);
                      const dateStr = d.toISOString().substring(0, 10);
                      const isSelected = fastReturnDate === dateStr;
                      return (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setFastReturnDate(dateStr)}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${
                            isSelected
                              ? 'bg-emerald-700 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          +{days}d
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="date"
                    required
                    value={fastReturnDate}
                    onChange={(e) => setFastReturnDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-1.5 text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    {t('requests.priority')}
                  </label>
                  <select
                    value={fastPriority}
                    onChange={(e) => setFastPriority(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:outline-none"
                  >
                    <option value="NORMAL">Normal (መደበኛ)</option>
                    <option value="URGENT">Urgent (አስቸኳይ)</option>
                    <option value="VERY_URGENT">Very Urgent (በጣም አስቸኳይ)</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => setShowFastRequestModal(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t('actions.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!selectedDocId || loadingDocs}
                  className="inline-flex items-center space-x-1.5 rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50 transition shadow-xs cursor-pointer"
                >
                  <Zap className="h-3.5 w-3.5 fill-current" />
                  <span>{isAmharic ? 'ፈጣን ጥያቄ ላክ' : 'Send Fast Request'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. ADJUST RETURNING TIME & DATE MODAL (RBAC Authorized) */}
      {/* ========================================================= */}
      {adjustRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setAdjustRequest(null)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-2 text-purple-800">
              <Clock className="h-5 w-5" />
              <h2 className="text-base font-bold">
                {isAmharic ? 'የመመለሻ ቀን እና ሰዓት ማስተካከያ' : 'Adjust Returning Time & Date'}
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {isAmharic
                ? 'የተጠየቀውን ወይም የተወሰደውን ሰነድ ይፋዊ የመመለሻ ቀንና ሰዓት ያስተካክሉ። ለያዡ በራስ-ሰር ማሳወቂያ ይላካል።'
                : 'Modify official return deadline and counter cutoff hour. Borrower will receive real-time notification.'}
            </p>

            {/* Document & Request Summary Card */}
            <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50/50 p-3 text-xs space-y-1">
              <div className="flex justify-between font-mono font-bold text-slate-900">
                <span>{adjustRequest.requestNumber}</span>
                <span className="text-[10px] bg-purple-200 text-purple-900 px-1.5 py-0.5 rounded">
                  {adjustRequest.document?.referenceNumber}
                </span>
              </div>
              <p className="font-semibold text-slate-800 line-clamp-1">
                {adjustRequest.document?.titleEn}
              </p>
              <div className="flex justify-between text-[11px] text-slate-600 pt-1">
                <span>
                  {isAmharic ? 'ተጠቃሚ / ያዥ:' : 'Borrower:'} <strong>{adjustRequest.requester?.fullName}</strong>
                </span>
                <span>
                  {isAmharic ? 'የአሁኑ ቀጠሮ:' : 'Current Due:'} <strong className="text-rose-700">{formatBilingualDate(adjustRequest.requestedReturnDate, locale)}</strong>
                </span>
              </div>
            </div>

            {actionError && (
              <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 font-medium">
                {actionError}
              </div>
            )}
            {actionSuccess && (
              <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 font-bold">
                {actionSuccess}
              </div>
            )}

            <form onSubmit={handleSubmitAdjustReturn} className="mt-4 space-y-4">
              {/* Quick Preset Extension Chips */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isAmharic ? 'ፈጣን የማራዘሚያ ቀናት:' : 'Quick Duration Adjustments:'}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[3, 7, 14, 21, 30].map((days) => {
                    const d = new Date();
                    d.setDate(d.getDate() + days);
                    const dateStr = d.toISOString().substring(0, 10);
                    const isSelected = adjustDate === dateStr;
                    return (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setAdjustDate(dateStr)}
                        className={`rounded-md px-2 py-1 text-xs font-bold transition ${
                          isSelected
                            ? 'bg-purple-700 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-purple-50 hover:text-purple-800 border border-slate-200'
                        }`}
                      >
                        +{days} {isAmharic ? 'ቀናት' : 'days'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date & Time Picker Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    {isAmharic ? 'አዲስ የመመለሻ ቀን *' : 'New Return Date *'}
                  </label>
                  <input
                    type="date"
                    required
                    value={adjustDate}
                    onChange={(e) => setAdjustDate(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:border-purple-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    {isAmharic ? 'ይፋዊ መመለሻ ሰዓት *' : 'Return Cutoff Time *'}
                  </label>
                  <input
                    type="time"
                    required
                    value={adjustTime}
                    onChange={(e) => setAdjustTime(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:border-purple-600 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Adjustment Reason & Preset Chips */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    {isAmharic ? 'የማስተካከያ / የማራዘሚያ ምክንያት *' : 'Reason for Schedule Adjustment *'}
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {isAmharic ? 'ፈጣን ምክንያቶች:' : 'Presets:'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1 mb-1.5">
                  {[
                    { en: 'Official Directorate Audit Review', am: 'የስራ አስፈፃሚ ኦዲት ግምገማ' },
                    { en: 'Court Proceedings Rescheduled', am: 'የፍርድ ቤት ቀጠሮ መዛወር' },
                    { en: 'Inter-Agency Legal Analysis', am: 'የተቋማት የህግ ትንተና' },
                    { en: 'Borrower Extension Request Approved', am: 'የተጠቃሚው ማራዘሚያ ጥያቄ ፀድቋል' },
                  ].map((preset) => (
                    <button
                      key={preset.en}
                      type="button"
                      onClick={() => setAdjustReason(preset.en)}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition ${
                        adjustReason === preset.en
                          ? 'bg-purple-700 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {isAmharic ? preset.am : preset.en}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={2}
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Justification for schedule adjustment..."
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-purple-600 focus:outline-hidden"
                />
              </div>

              {/* Notify Borrower Checkbox */}
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="notifyBorrower"
                  checked={adjustNotifyBorrower}
                  onChange={(e) => setAdjustNotifyBorrower(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="notifyBorrower" className="text-xs text-slate-700 font-medium">
                  {isAmharic
                    ? 'ለተጠቃሚው / ለያዡ ፈጣን የአሳሽ ማሳወቂያ እና ድምፅ ላክ'
                    : 'Dispatch browser notification & chime to borrower with new deadline'}
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => setAdjustRequest(null)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t('actions.cancel')}
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center space-x-1.5 rounded-lg bg-purple-700 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-purple-800 transition cursor-pointer"
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>{isAmharic ? 'ቀጠሮውን አጽድቅ' : 'Apply Adjustment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. REQUEST EXTENSION MODAL (Borrower Form) */}
      {/* ========================================================= */}
      {extensionRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setExtensionRequest(null)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-2 text-purple-800">
              <Clock className="h-5 w-5" />
              <h2 className="text-base font-bold">
                {isAmharic ? 'የመመለሻ ጊዜ ማራዘሚያ መጠየቂያ' : 'Request Return Deadline Extension'}
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {isAmharic
                ? 'በእጅዎ ያለውን ሰነድ ለመመለስ ተጨማሪ ጊዜ የሚያስፈልግዎት ከሆነ ማራዘሚያ ጥያቄ ያቅርቡ።'
                : 'If you require additional time with this physical document, submit an extension request to the Archive Office.'}
            </p>

            <div className="mt-3 rounded-lg border border-purple-200 bg-purple-50/50 p-3 text-xs">
              <p className="font-mono font-bold text-slate-900">{extensionRequest.document?.referenceNumber}</p>
              <p className="font-semibold text-slate-800">{extensionRequest.document?.titleEn}</p>
              <p className="text-[11px] text-slate-600 mt-1">
                {isAmharic ? 'የአሁኑ የመመለሻ ቀን:' : 'Current Due Date:'} <strong>{formatBilingualDate(extensionRequest.requestedReturnDate, locale)}</strong>
              </p>
            </div>

            {actionError && (
              <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 font-medium">
                {actionError}
              </div>
            )}
            {actionSuccess && (
              <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 font-bold">
                {actionSuccess}
              </div>
            )}

            <form onSubmit={handleSubmitExtensionRequest} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    {isAmharic ? 'የሚፈለገው አዲስ ቀን *' : 'Target Extension Date *'}
                  </label>
                  <input
                    type="date"
                    required
                    value={extensionDate}
                    onChange={(e) => setExtensionDate(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:border-purple-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    {isAmharic ? 'የመመለሻ ሰዓት *' : 'Target Return Time *'}
                  </label>
                  <input
                    type="time"
                    required
                    value={extensionTime}
                    onChange={(e) => setExtensionTime(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:border-purple-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isAmharic ? 'የማራዘሚያው ምክንያት *' : 'Reason for Extension *'}
                </label>
                <textarea
                  rows={3}
                  required
                  value={extensionReason}
                  onChange={(e) => setExtensionReason(e.target.value)}
                  placeholder="Explain why custody extension is needed for official duty..."
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-purple-600 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end space-x-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => setExtensionRequest(null)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t('actions.cancel')}
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center space-x-1.5 rounded-lg bg-purple-700 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-purple-800 transition cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{isAmharic ? 'የማራዘሚያ ጥያቄ ላክ' : 'Submit Extension Request'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Plus,
  Folder,
  Layers,
  Box,
  Building,
  CheckCircle,
  XCircle,
  ChevronRight,
  X,
  FileText,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { IArchiveLocation, IDepartment, LocationType } from '../../types';
import { safeJson } from '../../lib/apiUtils';

export const LocationsView: React.FC = () => {
  const { t, isAmharic } = useLanguage();
  const { token, hasRole } = useAuth();
  const { notify } = useNotification();

  const [locations, setLocations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<IDepartment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedType, setSelectedType] = useState<string>('ALL');

  // Multi-selection & Deletion state
  const [selectedLocIds, setSelectedLocIds] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [locToDelete, setLocToDelete] = useState<any | null>(null);
  const [isBatchDelete, setIsBatchDelete] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string>('');

  // Add Location Modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [code, setCode] = useState<string>('');
  const [type, setType] = useState<LocationType>('BOX');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [shelfNumber, setShelfNumber] = useState<string>('');
  const [boxNumber, setBoxNumber] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  const [formError, setFormError] = useState<string>('');
  const [formSuccess, setFormSuccess] = useState<string>('');

  const fetchLocations = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [locRes, deptRes] = await Promise.all([
        fetch('/api/locations', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/departments', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (locRes.ok) {
        const data = await locRes.json();
        setLocations(data.locations || []);
      }
      if (deptRes.ok) {
        const deptData = await deptRes.json();
        setDepartments(deptData.departments || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, [token]);

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!code) {
      setFormError('Location code is required.');
      return;
    }

    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          type,
          departmentId: departmentId || undefined,
          shelfNumber: shelfNumber.trim() || undefined,
          boxNumber: boxNumber.trim() || undefined,
          description: description.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to create archive location.');
        return;
      }

      setFormSuccess(`Location unit [${data.location?.code}] registered successfully.`);
      setTimeout(() => {
        setShowAddModal(false);
        setCode('');
        setShelfNumber('');
        setBoxNumber('');
        setDescription('');
        fetchLocations();
      }, 1000);
    } catch (err: any) {
      setFormError(err.message || 'Network error.');
    }
  };

  // Selection handlers
  const handleToggleSelectLoc = (id: string) => {
    setSelectedLocIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const visibleIds = filteredLocations.map((l) => l.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedLocIds.includes(id));
    if (allSelected) {
      setSelectedLocIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedLocIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  // Open single delete modal
  const handleOpenDeleteSingle = (loc: any) => {
    setLocToDelete(loc);
    setIsBatchDelete(false);
    setDeleteError('');
    setShowDeleteModal(true);
  };

  // Open batch delete modal
  const handleOpenDeleteBatch = () => {
    if (selectedLocIds.length === 0) return;
    setLocToDelete(null);
    setIsBatchDelete(true);
    setDeleteError('');
    setShowDeleteModal(true);
  };

  // Execute deletion
  const handleExecuteDelete = async () => {
    setIsDeleting(true);
    setDeleteError('');
    try {
      if (isBatchDelete) {
        const res = await fetch('/api/locations/batch-delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
          body: JSON.stringify({ locationIds: selectedLocIds }),
        });

        const { ok, data } = await safeJson<{ deletedCount: number; failedCount: number; message: string; error?: string }>(res);
        if (ok) {
          notify({
            titleEn: 'Archive Locations Removed',
            titleAm: 'የማህደር ቦታዎች ተሰርዘዋል',
            messageEn: `Successfully removed ${data?.deletedCount || selectedLocIds.length} location unit(s).`,
            messageAm: `${data?.deletedCount || selectedLocIds.length} የማህደር ቦታዎች ከስርዓቱ ተሰርዘዋል።`,
            type: 'ALERT',
          });
          setSelectedLocIds([]);
          setShowDeleteModal(false);
          fetchLocations();
        } else {
          setDeleteError(data?.error || 'Failed to delete selected locations.');
        }
      } else if (locToDelete) {
        const res = await fetch(`/api/locations/${locToDelete.id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });

        const { ok, data } = await safeJson<{ success: boolean; message?: string; error?: string }>(res);
        if (ok) {
          notify({
            titleEn: 'Location Removed',
            titleAm: 'የማህደር ቦታ ተሰርዟል',
            messageEn: `Location unit [${locToDelete.code}] removed successfully.`,
            messageAm: `የማህደር መገኛ [${locToDelete.code}] ከስርዓቱ ተሰርዟል።`,
            type: 'ALERT',
          });
          setSelectedLocIds((prev) => prev.filter((id) => id !== locToDelete.id));
          setShowDeleteModal(false);
          setLocToDelete(null);
          fetchLocations();
        } else {
          setDeleteError(data?.error || 'Failed to remove location.');
        }
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Error occurred during deletion.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getTypeIcon = (t: LocationType) => {
    switch (t) {
      case 'BUILDING':
        return <Building className="h-4 w-4 text-emerald-700" />;
      case 'ROOM':
        return <Folder className="h-4 w-4 text-blue-700" />;
      case 'CABINET':
        return <Layers className="h-4 w-4 text-indigo-700" />;
      case 'SHELF':
        return <Layers className="h-4 w-4 text-teal-700" />;
      case 'BOX':
        return <Box className="h-4 w-4 text-amber-700" />;
      default:
        return <MapPin className="h-4 w-4 text-slate-500" />;
    }
  };

  const filteredLocations =
    selectedType === 'ALL' ? locations : locations.filter((l) => l.type === selectedType);

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <MapPin className="h-6 w-6 text-emerald-700" />
            <span>{isAmharic ? 'አካላዊ የማህደር መገኛዎች' : 'Physical Archive Locations'}</span>
          </h1>
          <p className="text-xs text-slate-500">
            {isAmharic
              ? 'የህንፃ፣ ክፍል፣ ካቢኔ፣ መደርደሪያ እና ሳጥን ማከማቻዎችን ያስተዳድሩ'
              : 'Configure Buildings, Vault Rooms, Cabinets, Shelves, and Storage Boxes.'}
          </p>
        </div>

        {hasRole('ADMIN', 'ARCHIVE_OFFICER') && (
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center space-x-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{isAmharic ? 'አዲስ የማከማቻ ቦታ መዝግብ' : 'Add Storage Location'}</span>
          </button>
        )}
      </div>

      {/* Tier Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {['ALL', 'BUILDING', 'ROOM', 'CABINET', 'SHELF', 'BOX'].map((tier) => (
          <button
            key={tier}
            onClick={() => setSelectedType(tier)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              selectedType === tier
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tier === 'ALL'
              ? isAmharic
                ? 'ሁሉም ደረጃዎች'
                : 'All Tiers'
              : tier}
          </button>
        ))}
      </div>

      {/* Bulk Action Bar for Selected Locations */}
      {selectedLocIds.length > 0 && hasRole('ADMIN', 'ARCHIVE_OFFICER') && (
        <div className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-2.5 text-white shadow-lg animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center space-x-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-slate-950">
              {selectedLocIds.length}
            </span>
            <span className="text-xs font-medium">
              {isAmharic
                ? `${selectedLocIds.length} የማህደር ቦታ(ዎች) ተመርጠዋል`
                : `${selectedLocIds.length} archive location unit(s) selected`}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSelectedLocIds([])}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition cursor-pointer"
            >
              {isAmharic ? 'ምርጫ ሰርዝ' : 'Deselect All'}
            </button>

            <button
              onClick={handleOpenDeleteBatch}
              className="inline-flex items-center space-x-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700 transition cursor-pointer shadow-sm"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>
                {isAmharic
                  ? `የተመረጡትን አስወግድ (${selectedLocIds.length})`
                  : `Remove Selected (${selectedLocIds.length})`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Locations Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            {isAmharic ? 'የማከማቻ ቦታዎች በመጫን ላይ ናቸው...' : 'Loading archive locations...'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  {hasRole('ADMIN', 'ARCHIVE_OFFICER') && (
                    <th className="px-3 py-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredLocations.length > 0 &&
                          filteredLocations.every((l) => selectedLocIds.includes(l.id))
                        }
                        onChange={handleToggleSelectAll}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        title="Select/Deselect all visible locations"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3">Location Code & Tier</th>
                  <th className="px-4 py-3">Shelf Number</th>
                  <th className="px-4 py-3">Box Number</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-center">Files Contained</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLocations.map((loc, idx) => {
                  const isSelected = selectedLocIds.includes(loc.id);
                  const hasFiles = (loc.documentsCount || 0) > 0;
                  return (
                    <tr
                      key={`${loc.id}-${idx}`}
                      className={`hover:bg-slate-50/80 transition ${isSelected ? 'bg-emerald-50/40' : ''}`}
                    >
                      {/* Checkbox column */}
                      {hasRole('ADMIN', 'ARCHIVE_OFFICER') && (
                        <td className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectLoc(loc.id)}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>
                      )}

                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {getTypeIcon(loc.type)}
                          <span className="font-mono font-bold text-slate-900">{loc.code}</span>
                          <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                            {loc.type}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-800">
                        {loc.shelfNumber ? (
                          <span className="rounded-sm bg-blue-50 px-2 py-0.5 text-xs text-blue-800 border border-blue-200">
                            {loc.shelfNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-800">
                        {loc.boxNumber ? (
                          <span className="rounded-sm bg-amber-50 px-2 py-0.5 text-xs text-amber-800 border border-amber-200">
                            {loc.boxNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {loc.description || <span className="text-slate-400 italic">No notes</span>}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                          <FileText className="h-3 w-3" />
                          <span>{loc.documentsCount || 0}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {loc.active ? (
                          <span className="inline-flex items-center text-emerald-700 text-xs font-medium">
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-slate-400 text-xs font-medium">
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {hasRole('ADMIN', 'ARCHIVE_OFFICER') && (
                          <button
                            onClick={() => handleOpenDeleteSingle(loc)}
                            disabled={hasFiles}
                            className={`rounded-md border p-1.5 transition ${
                              hasFiles
                                ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                                : 'border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 cursor-pointer'
                            }`}
                            title={
                              hasFiles
                                ? 'Cannot delete location: contains active physical files'
                                : isAmharic
                                ? 'ይህንን የማከማቻ ቦታ አስወግድ'
                                : 'Remove archive location'
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Location Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-base font-bold text-slate-900">
              {isAmharic ? 'አዲስ የማህደር ማከማቻ መገኛ መዝግብ' : 'Register Archive Location Unit'}
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              {isAmharic
                ? 'መደርደሪያ ወይም ሳጥን ቁጥር በማስገባት አካላዊ ማከማቻውን ይመዝግቡ'
                : 'Define physical Shelf and Box coordinates for precise file cataloging.'}
            </p>

            {formError && (
              <div className="mb-3 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 border border-rose-200">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="mb-3 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-700 border border-emerald-200">
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleCreateLocation} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Location Code (መለያ ኮድ) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SH-08 or BOX-021"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 p-2 text-xs font-mono uppercase focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Storage Tier (ደረጃ) *
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as LocationType)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-xs font-semibold text-slate-800 focus:outline-none"
                  >
                    <option value="BOX">BOX (የማህደር ሳጥን)</option>
                    <option value="SHELF">SHELF (መደርደሪያ ደረጃ)</option>
                    <option value="CABINET">CABINET (ካቢኔ)</option>
                    <option value="ROOM">ROOM (የማህደር ክፍል)</option>
                    <option value="BUILDING">BUILDING (ዋና ህንፃ)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Assigned Department (የስራ ክፍል)
                </label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-xs text-slate-800 focus:outline-none"
                >
                  <option value="">General Facility Storage</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} - {isAmharic ? d.nameAm : d.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Explicit Shelf Number and Box Number */}
              {(type === 'SHELF' || type === 'BOX') && (
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Shelf Number (መደርደሪያ ቁጥር)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 03 or SH-03"
                      value={shelfNumber}
                      onChange={(e) => setShelfNumber(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-xs font-mono focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400">Preserves leading zeros</span>
                  </div>

                  {type === 'BOX' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Box Number (ሳጥን ቁጥር)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 012 or BX-012"
                        value={boxNumber}
                        onChange={(e) => setBoxNumber(e.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-xs font-mono focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400">Preserves leading zeros</span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Description / Archival Purpose
                </label>
                <input
                  type="text"
                  placeholder="e.g. For commercial tax certificates & deed registries"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 p-2 text-xs focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {t('actions.cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 cursor-pointer shadow-xs"
                >
                  Create Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Location Confirmation Modal (Single & Batch) */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <button
              onClick={() => {
                setShowDeleteModal(false);
                setLocToDelete(null);
                setDeleteError('');
              }}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-start space-x-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 border border-rose-200">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">
                  {isAmharic
                    ? isBatchDelete
                      ? `${selectedLocIds.length} የተመረጡ የማህደር ቦታዎችን ማስወገድ`
                      : 'የማህደር ማከማቻ ቦታን ማስወገድ'
                    : isBatchDelete
                    ? `Remove ${selectedLocIds.length} Selected Locations`
                    : 'Remove Archive Storage Location'}
                </h3>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  {isBatchDelete ? (
                    isAmharic ? (
                      `የተመረጡትን ${selectedLocIds.length} የማከማቻ ቦታዎች ከስርዓቱ በቋሚነት ማስወገድ ይፈልጋሉ?`
                    ) : (
                      `Are you sure you want to permanently remove ${selectedLocIds.length} selected storage locations?`
                    )
                  ) : (
                    <>
                      {isAmharic ? 'የማከማቻ ቦታውን ' : 'Are you sure you want to permanently remove location unit '}
                      <strong className="text-slate-900 font-mono">[{locToDelete?.code}]</strong>
                      {' '}({locToDelete?.type})?
                    </>
                  )}
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="mt-3 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 border border-rose-200">
                <p className="font-semibold">{deleteError}</p>
              </div>
            )}

            <div className="mt-4 rounded-xl bg-amber-50 p-3 border border-amber-200 text-xs text-amber-800 space-y-1">
              <p className="font-semibold flex items-center space-x-1">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                <span>{isAmharic ? 'የደህንነት ማስጠንቀቂያ:' : 'Integrity Guard:'}</span>
              </p>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                {isAmharic
                  ? 'ፋይሎች ያሉባቸው ወይም በስራቸው ንዑስ ቦታዎች ያሉባቸው የማከማቻ ክፍሎች ሊወገዱ አይችሉም።'
                  : 'Storage units containing active physical files or sub-locations cannot be deleted until files are relocated.'}
              </p>
            </div>

            <div className="mt-5 flex justify-end space-x-2 border-t border-slate-100 pt-3.5">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setLocToDelete(null);
                  setDeleteError('');
                }}
                disabled={isDeleting}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                {t('actions.cancel')}
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={isDeleting}
                className="inline-flex items-center space-x-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 transition cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>
                  {isDeleting
                    ? isAmharic
                      ? 'በማስወገድ ላይ...'
                      : 'Removing...'
                    : isAmharic
                    ? 'አስወግድ (Confirm Removal)'
                    : 'Confirm Removal'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

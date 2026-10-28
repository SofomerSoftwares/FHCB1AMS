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
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { IArchiveLocation, IDepartment, LocationType } from '../../types';

export const LocationsView: React.FC = () => {
  const { t, isAmharic } = useLanguage();
  const { token, hasRole } = useAuth();

  const [locations, setLocations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<IDepartment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedType, setSelectedType] = useState<string>('ALL');

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

    if (!code || !type) {
      setFormError('Code and Type are required.');
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
          code,
          type,
          departmentId: departmentId || null,
          shelfNumber: shelfNumber ? shelfNumber.trim() : null,
          boxNumber: boxNumber ? boxNumber.trim() : null,
          description: description ? description.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to create location.');
        return;
      }

      setFormSuccess('Location created successfully.');
      setTimeout(() => {
        setShowAddModal(false);
        setCode('');
        setShelfNumber('');
        setBoxNumber('');
        setDescription('');
        fetchLocations();
      }, 1000);
    } catch (err: any) {
      setFormError(err.message || 'Error creating location.');
    }
  };

  const filteredLocations =
    selectedType === 'ALL'
      ? locations
      : locations.filter((l) => l.type === selectedType);

  const getTypeIcon = (locType: LocationType) => {
    switch (locType) {
      case 'BUILDING':
        return <Building className="h-4 w-4 text-slate-700" />;
      case 'ROOM':
        return <Layers className="h-4 w-4 text-blue-700" />;
      case 'CABINET':
        return <Folder className="h-4 w-4 text-indigo-700" />;
      case 'SHELF':
        return <Layers className="h-4 w-4 text-emerald-700" />;
      case 'BOX':
        return <Box className="h-4 w-4 text-amber-700" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {t('nav.locations')}
          </h2>
          <p className="text-xs text-slate-500">
            {isAmharic
              ? 'የማህደር ህንፃዎች፣ ክፍሎች፣ ካቢኔቶች፣ መደርደሪያዎች እና የማከማቻ ሳጥኖች'
              : 'Multi-tier storage hierarchy: Building → Room → Cabinet → Shelf → Box'}
          </p>
        </div>

        {hasRole('ADMIN', 'ARCHIVE_OFFICER') && (
          <button
            onClick={() => {
              setFormError('');
              setFormSuccess('');
              setShowAddModal(true);
            }}
            className="inline-flex items-center space-x-2 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 transition"
          >
            <Plus className="h-4 w-4" />
            <span>{t('actions.newLocation')}</span>
          </button>
        )}
      </div>

      {/* Filter Tabs by Tier */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {['ALL', 'BUILDING', 'ROOM', 'CABINET', 'SHELF', 'BOX'].map((tier) => (
          <button
            key={tier}
            onClick={() => setSelectedType(tier)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
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
                  <th className="px-4 py-3">Location Code & Tier</th>
                  <th className="px-4 py-3">Shelf Number</th>
                  <th className="px-4 py-3">Box Number</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-center">Files Contained</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLocations.map((loc, idx) => (
                  <tr key={`${loc.id}-${idx}`} className="hover:bg-slate-50/80 transition">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Location Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900">{t('actions.newLocation')}</h3>
            <p className="text-xs text-slate-500">
              {isAmharic
                ? 'አዲስ ህንፃ፣ ማህደር ክፍል፣ ካቢኔት፣ መደርደሪያ ወይም ሳጥን መመዝገቢያ'
                : 'Define an archive storage location (Building, Room, Cabinet, Shelf, Box).'}
            </p>

            {formError && (
              <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-2 text-xs text-rose-700">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-xs text-emerald-800">
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleCreateLocation} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Location Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CAB-C or BOX-14"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs uppercase font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Tier Type *</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as LocationType)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:outline-none"
                  >
                    <option value="BUILDING">BUILDING (ህንፃ)</option>
                    <option value="ROOM">ROOM (ክፍል)</option>
                    <option value="CABINET">CABINET (ካቢኔት)</option>
                    <option value="SHELF">SHELF (መደርደሪያ)</option>
                    <option value="BOX">BOX (ሳጥን)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Description / Label</label>
                <input
                  type="text"
                  placeholder="e.g. East wing storage shelf for commercial records"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none"
                />
              </div>

              {(type === 'SHELF' || type === 'BOX') && (
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Shelf Number (መደርደሪያ ቁጥር)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 05 or B-05"
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

              <div className="flex justify-end space-x-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t('actions.cancel')}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-800"
                >
                  Create Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

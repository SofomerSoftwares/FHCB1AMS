import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  CheckCircle,
  XCircle,
  User,
  X,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { IDepartment } from '../../types';

export const DepartmentsView: React.FC = () => {
  const { t, isAmharic } = useLanguage();
  const { token } = useAuth();

  const [departments, setDepartments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Add department modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [code, setCode] = useState<string>('');
  const [nameEn, setNameEn] = useState<string>('');
  const [nameAm, setNameAm] = useState<string>('');
  const [managerId, setManagerId] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  const [formError, setFormError] = useState<string>('');
  const [formSuccess, setFormSuccess] = useState<string>('');

  const fetchDepartments = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [deptRes, userRes] = await Promise.all([
        fetch('/api/departments', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (deptRes.ok) {
        const dData = await deptRes.json();
        setDepartments(dData.departments || []);
      }
      if (userRes.ok) {
        const uData = await userRes.json();
        setUsers(uData.users || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, [token]);

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!code || !nameEn || !nameAm) {
      setFormError('Code, English name, and Amharic name are required.');
      return;
    }

    try {
      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code,
          nameEn,
          nameAm,
          managerId: managerId || undefined,
          description,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to create department.');
        return;
      }

      setFormSuccess('Department created successfully.');
      setTimeout(() => {
        setShowAddModal(false);
        setCode('');
        setNameEn('');
        setNameAm('');
        setDescription('');
        fetchDepartments();
      }, 1000);
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {t('nav.departments')}
          </h2>
          <p className="text-xs text-slate-500">
            {isAmharic
              ? 'የፌዴራል ሚኒስቴሮች፣ ኤጀንሲዎች እና የስራ ክፍሎች መዋቅር'
              : 'Federal institutional departments, code prefixes, and designated managers.'}
          </p>
        </div>

        <button
          onClick={() => {
            setFormError('');
            setFormSuccess('');
            setShowAddModal(true);
          }}
          className="inline-flex items-center space-x-2 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 transition"
        >
          <Plus className="h-4 w-4" />
          <span>{t('actions.newDepartment')}</span>
        </button>
      </div>

      {/* Departments Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading departments...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">English Name</th>
                  <th className="px-4 py-3">Amharic Name (አማርኛ)</th>
                  <th className="px-4 py-3">Department Manager</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departments.map((d, idx) => (
                  <tr key={`${d.id}-${idx}`} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {d.code}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{d.nameEn}</td>
                    <td className="px-4 py-3 text-slate-700 font-amharic">{d.nameAm}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {d.manager ? (
                        <div className="flex items-center space-x-1.5 text-slate-800">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span className="font-medium">{d.manager.fullName}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {d.active ? (
                        <span className="inline-flex items-center text-emerald-700 text-xs font-semibold">
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-slate-400 text-xs">
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

      {/* Add Department Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900">{t('actions.newDepartment')}</h3>
            <p className="text-xs text-slate-500">
              Register a new government department or agency unit.
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

            <form onSubmit={handleCreateDepartment} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Code Prefix *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MOTI or DARA"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs uppercase font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">English Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ministry of Trade and Regional Integration"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Amharic Name *</label>
                <input
                  type="text"
                  required
                  placeholder="ለምሳሌ፡ የንግድ እና ቀጣናዊ ትስስር ሚኒስቴር"
                  value={nameAm}
                  onChange={(e) => setNameAm(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-amharic focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Department Manager</label>
                <select
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:outline-none"
                >
                  <option value="">Select Manager</option>
                  {users
                    .filter((u) => u.role === 'DEPARTMENT_MANAGER' || u.role === 'ADMIN')
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.role})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Description</label>
                <input
                  type="text"
                  placeholder="Mandate and scope of records..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none"
                />
              </div>

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
                  Save Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

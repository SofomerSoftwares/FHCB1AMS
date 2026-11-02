import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  CheckCircle,
  XCircle,
  User,
  X,
  Edit,
  Trash2,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { IDepartment } from '../../types';

export const DepartmentsView: React.FC = () => {
  const { t, isAmharic } = useLanguage();
  const { token } = useAuth();
  const { notify } = useNotification();

  const [departments, setDepartments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Add department modal state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [code, setCode] = useState<string>('');
  const [nameEn, setNameEn] = useState<string>('');
  const [nameAm, setNameAm] = useState<string>('');
  const [managerId, setManagerId] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Edit department modal state
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingDept, setEditingDept] = useState<any | null>(null);
  const [editCode, setEditCode] = useState<string>('');
  const [editNameEn, setEditNameEn] = useState<string>('');
  const [editNameAm, setEditNameAm] = useState<string>('');
  const [editManagerId, setEditManagerId] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editActive, setEditActive] = useState<boolean>(true);

  // Delete department modal state
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deletingDept, setDeletingDept] = useState<any | null>(null);

  const [formError, setFormError] = useState<string>('');
  const [formSuccess, setFormSuccess] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

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

  // Open Edit Modal
  const handleOpenEdit = (dept: any) => {
    setEditingDept(dept);
    setEditCode(dept.code || '');
    setEditNameEn(dept.nameEn || '');
    setEditNameAm(dept.nameAm || '');
    setEditManagerId(dept.managerId || '');
    setEditDescription(dept.description || '');
    setEditActive(dept.active !== false);
    setFormError('');
    setFormSuccess('');
    setShowEditModal(true);
  };

  // Open Delete Modal
  const handleOpenDelete = (dept: any) => {
    setDeletingDept(dept);
    setFormError('');
    setShowDeleteModal(true);
  };

  // Create Department
  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!code || !nameEn || !nameAm) {
      setFormError('Code, English name, and Amharic name are required.');
      return;
    }

    setActionLoading(true);
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
        setActionLoading(false);
        return;
      }

      setFormSuccess('Department created successfully.');
      notify({
        titleEn: 'Department Created',
        titleAm: 'የስራ ክፍል ተፈጥሯል',
        messageEn: `Department ${code} (${nameEn}) has been created.`,
        messageAm: `የስራ ክፍል ${code} (${nameAm}) በተሳካ ሁኔታ ተፈጥሯል።`,
        type: 'SUCCESS',
      });

      setTimeout(() => {
        setShowAddModal(false);
        setCode('');
        setNameEn('');
        setNameAm('');
        setDescription('');
        setManagerId('');
        setActionLoading(false);
        fetchDepartments();
      }, 800);
    } catch (err: any) {
      setFormError(err.message || 'Error creating department.');
      setActionLoading(false);
    }
  };

  // Update Department
  const handleUpdateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept) return;
    setFormError('');
    setFormSuccess('');

    if (!editCode || !editNameEn || !editNameAm) {
      setFormError('Code, English name, and Amharic name are required.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/departments/${editingDept.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: editCode,
          nameEn: editNameEn,
          nameAm: editNameAm,
          managerId: editManagerId || undefined,
          active: editActive,
          description: editDescription,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to update department.');
        setActionLoading(false);
        return;
      }

      setFormSuccess('Department updated successfully.');
      notify({
        titleEn: 'Department Updated',
        titleAm: 'የስራ ክፍል ታድሷል',
        messageEn: `Department ${editCode} (${editNameEn}) updated.`,
        messageAm: `የስራ ክፍል ${editCode} መረጃ ታድሷል።`,
        type: 'SUCCESS',
      });

      setTimeout(() => {
        setShowEditModal(false);
        setEditingDept(null);
        setActionLoading(false);
        fetchDepartments();
      }, 800);
    } catch (err: any) {
      setFormError(err.message || 'Error updating department.');
      setActionLoading(false);
    }
  };

  // Delete Department
  const handleDeleteDepartment = async () => {
    if (!deletingDept) return;
    setFormError('');

    setActionLoading(true);
    try {
      const res = await fetch(`/api/departments/${deletingDept.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to delete department.');
        setActionLoading(false);
        return;
      }

      notify({
        titleEn: 'Department Deleted',
        titleAm: 'የስራ ክፍል ተሰርዟል',
        messageEn: `Department ${deletingDept.code} (${deletingDept.nameEn}) has been removed.`,
        messageAm: `የስራ ክፍል ${deletingDept.code} በቋሚነት ተሰርዟል።`,
        type: 'ALERT',
      });

      setShowDeleteModal(false);
      setDeletingDept(null);
      setActionLoading(false);
      fetchDepartments();
    } catch (err: any) {
      setFormError(err.message || 'Error deleting department.');
      setActionLoading(false);
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
              ? 'የፌዴራል ሚኒስቴሮች፣ ኤጀንሲዎች እና የስራ ክፍሎች መዋቅር፣ ማረም እና ማስወገድ'
              : 'Federal institutional departments, code prefixes, designated managers, and lifecycle.'}
          </p>
        </div>

        <button
          onClick={() => {
            setFormError('');
            setFormSuccess('');
            setShowAddModal(true);
          }}
          className="inline-flex items-center space-x-2 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 transition cursor-pointer"
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
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departments.map((d, idx) => (
                  <tr key={`${d.id}-${idx}`} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-mono font-bold text-slate-800 border border-slate-200">
                        {d.code}
                      </span>
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
                        <span className="inline-flex items-center text-slate-400 text-xs font-semibold">
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => handleOpenEdit(d)}
                          className="inline-flex items-center space-x-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
                          title="Edit department details"
                        >
                          <Edit className="h-3 w-3 text-slate-500" />
                          <span>{t('actions.edit', 'Edit')}</span>
                        </button>

                        <button
                          onClick={() => handleOpenDelete(d)}
                          className="inline-flex items-center space-x-1 rounded-md border border-rose-200 bg-rose-50/70 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 transition cursor-pointer shadow-2xs"
                          title="Delete department"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>{t('actions.delete', 'Delete')}</span>
                        </button>
                      </div>
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
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900">{t('actions.newDepartment')}</h3>
            <p className="text-xs text-slate-500">
              Register a new government department or agency unit.
            </p>

            {formError && (
              <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}
            {formSuccess && (
              <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-700 flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateDepartment} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Code (Prefix) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MOF, MINT, DARA"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-mono font-bold uppercase focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">English Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ministry of Innovation and Technology"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Amharic Name (አማርኛ ስም) *</label>
                <input
                  type="text"
                  required
                  placeholder="ለምሳሌ፡ የኢኖቬሽን እና ቴክኖሎጂ ሚኒስቴር"
                  value={nameAm}
                  onChange={(e) => setNameAm(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-amharic focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Department Manager</label>
                <select
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:outline-none focus:border-emerald-600"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({t(`roles.${u.role}`, u.role)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Description</label>
                <textarea
                  rows={2}
                  placeholder="Mandate, function, or scope of archive records"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none focus:border-emerald-600"
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
                  disabled={actionLoading}
                  className="rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Creating...' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Department Modal */}
      {showEditModal && editingDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => {
                setShowEditModal(false);
                setEditingDept(null);
              }}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                <Edit className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {isAmharic ? 'የስራ ክፍል አርም' : 'Edit Department'}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {editingDept.code} • {editingDept.nameEn}
                </p>
              </div>
            </div>

            {formError && (
              <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}
            {formSuccess && (
              <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-700 flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUpdateDepartment} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Code (Prefix) *</label>
                <input
                  type="text"
                  required
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-mono font-bold uppercase focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">English Name *</label>
                <input
                  type="text"
                  required
                  value={editNameEn}
                  onChange={(e) => setEditNameEn(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Amharic Name (አማርኛ ስም) *</label>
                <input
                  type="text"
                  required
                  value={editNameAm}
                  onChange={(e) => setEditNameAm(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-amharic focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Department Manager</label>
                <select
                  value={editManagerId}
                  onChange={(e) => setEditManagerId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:outline-none focus:border-emerald-600"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({t(`roles.${u.role}`, u.role)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Description</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="editDeptActive"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="editDeptActive" className="text-xs font-medium text-slate-700 cursor-pointer">
                  {isAmharic ? 'የስራ ክፍሉ ንቁ (Active) ይሁን' : 'Department is active'}
                </label>
              </div>

              <div className="flex justify-end space-x-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingDept(null);
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {t('actions.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : t('actions.save', 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Department Modal */}
      {showDeleteModal && deletingDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => {
                setShowDeleteModal(false);
                setDeletingDept(null);
              }}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-start space-x-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 border border-rose-200">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {isAmharic ? 'የስራ ክፍል ማስወገድ' : 'Confirm Department Deletion'}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Are you sure you want to permanently delete department{' '}
                  <strong className="text-slate-900">{deletingDept.code}</strong> ({deletingDept.nameEn})?
                </p>
              </div>
            </div>

            {formError && (
              <div className="mt-4 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <div className="mt-4 rounded-lg bg-amber-50 p-3 border border-amber-200 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">Integrity Notice:</p>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                A department cannot be deleted if physical archive records or staff members are currently assigned to it.
              </p>
            </div>

            <div className="mt-5 flex justify-end space-x-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingDept(null);
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {t('actions.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteDepartment}
                disabled={actionLoading}
                className="rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-700 cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  CheckCircle,
  XCircle,
  Shield,
  Key,
  X,
  Building,
  Mail,
  UserCheck,
  Edit,
  Trash2,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { Role, IDepartment, IUser } from '../../types';

export const UsersView: React.FC = () => {
  const { t, isAmharic } = useLanguage();
  const { token, user: currentUser } = useAuth();
  const { notify } = useNotification();

  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<IDepartment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Add User Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [amharicName, setAmharicName] = useState<string>('');
  const [role, setRole] = useState<Role>('EMPLOYEE');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [employeeId, setEmployeeId] = useState<string>('');

  // Edit User Modal State
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editFullName, setEditFullName] = useState<string>('');
  const [editAmharicName, setEditAmharicName] = useState<string>('');
  const [editRole, setEditRole] = useState<Role>('EMPLOYEE');
  const [editDepartmentId, setEditDepartmentId] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editEmployeeId, setEditEmployeeId] = useState<string>('');
  const [editPassword, setEditPassword] = useState<string>('');
  const [editActive, setEditActive] = useState<boolean>(true);

  // Delete User Modal State
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deletingUser, setDeletingUser] = useState<any | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('');

  const [formError, setFormError] = useState<string>('');
  const [formSuccess, setFormSuccess] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const fetchUsers = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [uRes, dRes] = await Promise.all([
        fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/departments', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (uRes.ok) {
        const uData = await uRes.json();
        setUsers(uData.users || []);
      }
      if (dRes.ok) {
        const dData = await dRes.json();
        setDepartments(dData.departments || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  // Open Edit Modal with user data
  const handleOpenEdit = (user: any) => {
    setEditingUser(user);
    setEditFullName(user.fullName || '');
    setEditAmharicName(user.amharicName || '');
    setEditRole(user.role || 'EMPLOYEE');
    setEditDepartmentId(user.departmentId || '');
    setEditPhone(user.phone || '');
    setEditEmployeeId(user.employeeId || '');
    setEditPassword('');
    setEditActive(user.active !== false);
    setFormError('');
    setFormSuccess('');
    setShowEditModal(true);
  };

  // Open Delete Modal
  const handleOpenDelete = (user: any) => {
    setDeletingUser(user);
    setDeleteConfirmText('');
    setFormError('');
    setShowDeleteModal(true);
  };

  // Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!username || !email || !fullName || !role || !password) {
      setFormError('Required user fields are missing.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username,
          email,
          fullName,
          amharicName,
          role,
          departmentId: departmentId || undefined,
          password,
          phone,
          employeeId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to create user.');
        setActionLoading(false);
        return;
      }

      setFormSuccess('User account created successfully.');
      notify({
        titleEn: 'User Registered',
        titleAm: 'ተጠቃሚ ተመዝግቧል',
        messageEn: `Created user account @${username} for ${fullName}.`,
        messageAm: `ለ${fullName} የተጠቃሚ መለያ @${username} ተፈጥሯል።`,
        type: 'SUCCESS',
      });

      setTimeout(() => {
        setShowAddModal(false);
        setUsername('');
        setEmail('');
        setFullName('');
        setAmharicName('');
        setPassword('');
        setPhone('');
        setEmployeeId('');
        setActionLoading(false);
        fetchUsers();
      }, 800);
    } catch (err: any) {
      setFormError(err.message || 'Error occurred while creating user.');
      setActionLoading(false);
    }
  };

  // Update User
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setFormError('');
    setFormSuccess('');

    if (!editFullName || !editRole) {
      setFormError('Full name and role are required.');
      return;
    }

    if (editPassword && editPassword.length < 8) {
      setFormError('New password must be at least 8 characters long.');
      return;
    }

    setActionLoading(true);
    try {
      const bodyPayload: any = {
        fullName: editFullName.trim(),
        amharicName: editAmharicName.trim() || undefined,
        role: editRole,
        departmentId: editDepartmentId || undefined,
        phone: editPhone.trim() || undefined,
        employeeId: editEmployeeId.trim() || undefined,
        active: editActive,
      };

      if (editPassword) {
        bodyPayload.password = editPassword;
      }

      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to update user.');
        setActionLoading(false);
        return;
      }

      setFormSuccess('User account updated successfully.');
      notify({
        titleEn: 'User Account Updated',
        titleAm: 'የተጠቃሚ መለያ ታድሷል',
        messageEn: `Updated details for @${editingUser.username} (${editFullName}).`,
        messageAm: `የ@${editingUser.username} (${editFullName}) መረጃ በተሳካ ሁኔታ ታድሷል።`,
        type: 'SUCCESS',
      });

      setTimeout(() => {
        setShowEditModal(false);
        setEditingUser(null);
        setActionLoading(false);
        fetchUsers();
      }, 800);
    } catch (err: any) {
      setFormError(err.message || 'Error updating user.');
      setActionLoading(false);
    }
  };

  // Delete User
  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setFormError('');

    if (currentUser?.id === deletingUser.id) {
      setFormError('You cannot delete your own active administrator account.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/users/${deletingUser.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Failed to delete user.');
        setActionLoading(false);
        return;
      }

      notify({
        titleEn: 'User Deleted',
        titleAm: 'ተጠቃሚ ተሰርዟል',
        messageEn: `User account @${deletingUser.username} has been permanently deleted.`,
        messageAm: `የተጠቃሚ መለያ @${deletingUser.username} በቋሚነት ተሰርዟል።`,
        type: 'ALERT',
      });

      setShowDeleteModal(false);
      setDeletingUser(null);
      setActionLoading(false);
      fetchUsers();
    } catch (err: any) {
      setFormError(err.message || 'Error deleting user.');
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ active: !currentStatus }),
      });

      if (res.ok) {
        fetchUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">{t('nav.users')}</h2>
          <p className="text-xs text-slate-500">
            {isAmharic
              ? 'የተጠቃሚ መለያዎች አስተዳደር፣ የስራ ክፍሎች ምደባ፣ ማረም እና ማስወገድ'
              : 'User accounts, role assignment, editing profiles, and account decommissioning.'}
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
          <span>{t('actions.newUser')}</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading user accounts...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">User & ID</th>
                  <th className="px-4 py-3">Email & Contact</th>
                  <th className="px-4 py-3">Role & Clearance</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Account Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u, idx) => (
                  <tr key={`${u.id}-${idx}`} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-semibold text-slate-900">{u.fullName}</p>
                      {u.amharicName && (
                        <p className="text-[11px] text-slate-500 font-amharic">{u.amharicName}</p>
                      )}
                      <p className="font-mono text-[10px] text-slate-400">
                        @{u.username} • {u.employeeId || 'No ID'}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-slate-800">{u.email}</p>
                      <p className="text-[10px] text-slate-400">{u.phone || '-'}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-bold text-slate-800">
                        {t(`roles.${u.role}`, u.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-slate-700">
                        {u.department ? u.department.nameEn : 'Institutional Wide'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {u.active ? (
                        <span className="inline-flex items-center text-emerald-700 font-semibold text-xs">
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-rose-600 font-semibold text-xs">
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Deactivated
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => handleToggleActive(u.id, u.active)}
                          className={`rounded-md px-2 py-1 text-[11px] font-semibold transition cursor-pointer ${
                            u.active
                              ? 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                          title={u.active ? 'Deactivate user login' : 'Activate user login'}
                        >
                          {u.active ? 'Deactivate' : 'Activate'}
                        </button>

                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="inline-flex items-center space-x-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
                          title="Edit user details and role"
                        >
                          <Edit className="h-3 w-3 text-slate-500" />
                          <span>{t('actions.edit', 'Edit')}</span>
                        </button>

                        <button
                          onClick={() => handleOpenDelete(u)}
                          disabled={currentUser?.id === u.id}
                          className={`inline-flex items-center space-x-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition shadow-2xs ${
                            currentUser?.id === u.id
                              ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'
                              : 'border-rose-200 bg-rose-50/70 text-rose-700 hover:bg-rose-100 cursor-pointer'
                          }`}
                          title={currentUser?.id === u.id ? 'Cannot delete own account' : 'Delete user account'}
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

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900">{t('actions.newUser')}</h3>
            <p className="text-xs text-slate-500">
              Create an official user account for an employee, archive officer, or manager.
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

            <form onSubmit={handleCreateUser} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Username *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. officer.kebede"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Official Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="name@fhc.gov.et"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Full Name (English) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Almaz Kebede Desta"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Amharic Name (አማርኛ ስም)</label>
                <input
                  type="text"
                  placeholder="ለምሳሌ፡ አልማዝ ከበደ ደስታ"
                  value={amharicName}
                  onChange={(e) => setAmharicName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-amharic focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Role *</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:outline-none focus:border-emerald-600"
                  >
                    <option value="EMPLOYEE">Public Servant / Employee</option>
                    <option value="ARCHIVE_OFFICER">Archive Officer</option>
                    <option value="DEPARTMENT_MANAGER">Department Manager</option>
                    <option value="AUDITOR">Federal Auditor</option>
                    <option value="ADMIN">System Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Department</label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:outline-none focus:border-emerald-600"
                  >
                    <option value="">No Department (Institutional Wide)</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} - {isAmharic ? d.nameAm : d.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Initial Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Employee ID</label>
                  <input
                    type="text"
                    placeholder="e.g. ET-FHC-104"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. +251 911 234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
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
                  {actionLoading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setShowEditModal(false);
                setEditingUser(null);
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
                  {isAmharic ? 'የተጠቃሚ መለያ አርም' : 'Edit User Account'}
                </h3>
                <p className="text-xs text-slate-500">
                  @{editingUser.username} • {editingUser.email}
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

            <form onSubmit={handleUpdateUser} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Full Name (English) *</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Amharic Name (አማርኛ ስም)</label>
                <input
                  type="text"
                  value={editAmharicName}
                  onChange={(e) => setEditAmharicName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-amharic focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Role & Clearance *</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as Role)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:outline-none focus:border-emerald-600"
                  >
                    <option value="EMPLOYEE">Public Servant / Employee</option>
                    <option value="ARCHIVE_OFFICER">Archive Officer</option>
                    <option value="DEPARTMENT_MANAGER">Department Manager</option>
                    <option value="AUDITOR">Federal Auditor</option>
                    <option value="ADMIN">System Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Department</label>
                  <select
                    value={editDepartmentId}
                    onChange={(e) => setEditDepartmentId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:outline-none focus:border-emerald-600"
                  >
                    <option value="">No Department (Institutional Wide)</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} - {isAmharic ? d.nameAm : d.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Employee ID</label>
                  <input
                    type="text"
                    placeholder="e.g. ET-FHC-104"
                    value={editEmployeeId}
                    onChange={(e) => setEditEmployeeId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. +251 911 234567"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Reset Password Optional */}
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 space-y-1.5">
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700">
                  <Lock className="h-3.5 w-3.5 text-slate-500" />
                  <span>{isAmharic ? 'የይለፍ ቃል መቀየሪያ (ከተፈለገ ብቻ)' : 'Reset Password (Optional)'}</span>
                </div>
                <input
                  type="password"
                  placeholder="Leave empty to keep current password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:outline-none focus:border-emerald-600"
                />
                <p className="text-[10px] text-slate-400">
                  Must be at least 8 characters if providing a new password.
                </p>
              </div>

              {/* Status Toggle */}
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="editActiveStatus"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="editActiveStatus" className="text-xs font-medium text-slate-700 cursor-pointer">
                  {isAmharic ? 'መለያው ንቁ (Active) ይሁን' : 'Account is active and authorized to log in'}
                </label>
              </div>

              <div className="flex justify-end space-x-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
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

      {/* Delete User Modal */}
      {showDeleteModal && deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => {
                setShowDeleteModal(false);
                setDeletingUser(null);
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
                  {isAmharic ? 'ተጠቃሚውን ማስወገድ' : 'Confirm User Deletion'}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Are you sure you want to permanently delete user account{' '}
                  <strong className="text-slate-900">@{deletingUser.username}</strong> ({deletingUser.fullName})?
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
              <p className="font-semibold">Institutional Safety Notice:</p>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                This action is audited. Users currently holding checked-out physical documents cannot be deleted until custody is restored.
              </p>
            </div>

            <div className="mt-5 flex justify-end space-x-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingUser(null);
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {t('actions.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
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

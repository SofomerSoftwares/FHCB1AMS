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
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { Role, IDepartment } from '../../types';

export const UsersView: React.FC = () => {
  const { t, isAmharic } = useLanguage();
  const { token } = useAuth();

  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<IDepartment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Add User Modal
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

  const [formError, setFormError] = useState<string>('');
  const [formSuccess, setFormSuccess] = useState<string>('');

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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!username || !email || !fullName || !role || !password) {
      setFormError('Required user fields are missing.');
      return;
    }

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
        return;
      }

      setFormSuccess('User account created successfully.');
      setTimeout(() => {
        setShowAddModal(false);
        setUsername('');
        setEmail('');
        setFullName('');
        setAmharicName('');
        setPassword('');
        fetchUsers();
      }, 1000);
    } catch (err: any) {
      setFormError(err.message);
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
              ? 'የተጠቃሚ መለያዎች አስተዳደር፣ የስራ ክፍሎች ምደባ እና የደህንነት ደረጃዎች'
              : 'User accounts, role assignment, and institutional department scoping.'}
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
                      <button
                        onClick={() => handleToggleActive(u.id, u.active)}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                          u.active
                            ? 'border border-slate-200 text-rose-600 hover:bg-rose-50'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {u.active ? 'Deactivate' : 'Activate'}
                      </button>
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
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900">{t('actions.newUser')}</h3>
            <p className="text-xs text-slate-500">
              Provision an authorized public sector employee account.
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

            <form onSubmit={handleCreateUser} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Username *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. officer.haile"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="name@agency.gov.et"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Full Name (English) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Haile Gebreselassie Mengistu"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Amharic Name (አማርኛ ስም)</label>
                <input
                  type="text"
                  placeholder="ለምሳሌ፡ ኃይሌ ገብረስላሴ መንግስቱ"
                  value={amharicName}
                  onChange={(e) => setAmharicName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-amharic focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Role *</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:outline-none"
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
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:outline-none"
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
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Employee ID</label>
                  <input
                    type="text"
                    placeholder="e.g. ET-GOV-4091"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs focus:outline-none"
                  />
                </div>
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
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

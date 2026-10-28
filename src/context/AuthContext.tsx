import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { IUser, IDepartment, Role, PermissionKey, ISystemSettings, IRolePermissions } from '../types';

interface AuthContextType {
  user: IUser | null;
  department: IDepartment | null;
  token: string | null;
  loading: boolean;
  settings: ISystemSettings | null;
  rolePermissions: IRolePermissions | null;
  originalRole: Role | null;
  isSimulatingRole: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
  hasPermission: (permission: PermissionKey) => boolean;
  switchRole: (role: Role) => Promise<{ success: boolean; error?: string }>;
  resetRoleSimulation: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<IUser | null>(null);
  const [department, setDepartment] = useState<IDepartment | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('archivetrack_token'));
  const [loading, setLoading] = useState<boolean>(true);
  const [settings, setSettings] = useState<ISystemSettings | null>(null);
  const [originalRole, setOriginalRole] = useState<Role | null>(() => {
    return (localStorage.getItem('archivetrack_original_role') as Role) || null;
  });

  const fetchSettings = useCallback(async (authToken?: string) => {
    const activeToken = authToken || token;
    if (!activeToken) return;
    try {
      const res = await fetch('/api/settings', {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
      }
    } catch (err) {
      console.warn('Failed to fetch system settings:', err);
    }
  }, [token]);

  const fetchCurrentUser = useCallback(async (authToken?: string) => {
    const activeToken = authToken || token;
    if (!activeToken) {
      setUser(null);
      setDepartment(null);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${activeToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setDepartment(data.department || null);
        await fetchSettings(activeToken);
      } else {
        // Token expired or invalid
        localStorage.removeItem('archivetrack_token');
        localStorage.removeItem('archivetrack_original_role');
        setToken(null);
        setUser(null);
        setDepartment(null);
        setOriginalRole(null);
      }
    } catch (err) {
      console.error('Failed to authenticate session:', err);
    } finally {
      setLoading(false);
    }
  }, [token, fetchSettings]);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        // In case non-JSON response was returned
      }

      if (!res.ok) {
        return { success: false, error: data.error || `Authentication failed (${res.status} ${res.statusText})` };
      }

      localStorage.setItem('archivetrack_token', data.token);
      localStorage.removeItem('archivetrack_original_role');
      setOriginalRole(null);
      setToken(data.token);
      setUser(data.user);
      await fetchCurrentUser(data.token);
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.message === 'Failed to fetch'
          ? 'Connection to backend service was refused. Please try again or check server connectivity.'
          : err.message || 'Network error during sign-in.',
      };
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('archivetrack_token');
      localStorage.removeItem('archivetrack_original_role');
      setToken(null);
      setUser(null);
      setDepartment(null);
      setOriginalRole(null);
    }
  };

  const hasRole = (...roles: Role[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const hasPermission = (permission: PermissionKey): boolean => {
    if (!user) return false;
    // System administrator always has all permissions
    if (user.role === 'ADMIN') return true;

    // Check dynamic settings permissions
    if (settings?.rolePermissions && settings.rolePermissions[user.role]) {
      return settings.rolePermissions[user.role].includes(permission);
    }

    // Default baseline permissions fallback
    const fallbackPerms: Record<Role, PermissionKey[]> = {
      ADMIN: [
        'viewDocuments', 'registerDocuments', 'editDocuments', 'importCsv',
        'requestDocuments', 'fastRequest', 'approveRequests', 'rejectRequests',
        'issueHandover', 'processReturn', 'adjustReturnDate', 'sendReturnNotice',
        'requestExtension', 'manageLocations', 'manageUsers', 'manageDepartments',
        'viewAuditLogs', 'manageInvestigations', 'manageSettings'
      ],
      ARCHIVE_OFFICER: [
        'viewDocuments', 'registerDocuments', 'editDocuments', 'importCsv',
        'requestDocuments', 'fastRequest', 'issueHandover', 'processReturn',
        'adjustReturnDate', 'sendReturnNotice', 'requestExtension', 'manageLocations',
        'manageInvestigations'
      ],
      DEPARTMENT_MANAGER: [
        'viewDocuments', 'requestDocuments', 'fastRequest',
        'approveRequests', 'rejectRequests', 'adjustReturnDate', 'requestExtension'
      ],
      EMPLOYEE: [
        'viewDocuments', 'requestDocuments', 'fastRequest', 'requestExtension'
      ],
      AUDITOR: [
        'viewDocuments', 'viewAuditLogs', 'manageInvestigations'
      ],
    };

    return fallbackPerms[user.role]?.includes(permission) || false;
  };

  // Live Role Switcher (Simulates clearance for RBAC testing)
  const switchRole = async (targetRole: Role): Promise<{ success: boolean; error?: string }> => {
    if (!token || !user) return { success: false, error: 'Not authenticated.' };

    try {
      // Remember original role if not already simulating
      if (!originalRole) {
        localStorage.setItem('archivetrack_original_role', user.role);
        setOriginalRole(user.role);
      }

      const res = await fetch('/api/auth/switch-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: targetRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to switch role.' };
      }

      localStorage.setItem('archivetrack_token', data.token);
      setToken(data.token);
      setUser(data.user);
      await fetchSettings(data.token);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const resetRoleSimulation = async (): Promise<void> => {
    if (originalRole) {
      const target = originalRole;
      localStorage.removeItem('archivetrack_original_role');
      setOriginalRole(null);
      await switchRole(target);
    }
  };

  const refreshUser = async () => {
    if (token) await fetchCurrentUser(token);
  };

  const refreshSettings = async () => {
    if (token) await fetchSettings(token);
  };

  const isSimulatingRole = Boolean(originalRole && originalRole !== user?.role);

  return (
    <AuthContext.Provider
      value={{
        user,
        department,
        token,
        loading,
        settings,
        rolePermissions: settings?.rolePermissions || null,
        originalRole,
        isSimulatingRole,
        login,
        logout,
        hasRole,
        hasPermission,
        switchRole,
        resetRoleSimulation,
        refreshUser,
        refreshSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

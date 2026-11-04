import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Role } from '../../types';
import { ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: Role[];
}

/**
 * Institutional Protected Route Wrapper:
 * Ensures the user has an active session and the necessary role clearance.
 * If unauthorized, renders an access denial message or redirects.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { user, loading, hasRole } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !hasRole(...allowedRoles)) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 mb-4">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
        <p className="mt-1 max-w-md text-xs text-slate-500 leading-relaxed">
          Your current account role (<span className="font-semibold text-slate-700">{user.role}</span>) does not have sufficient clearance to access this archival module.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};

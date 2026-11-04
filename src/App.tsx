import React, { useState, Suspense, lazy } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { Header } from './components/layout/Header';
import { DatabaseStationBar } from './components/layout/DatabaseStationBar';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { LoginView } from './components/auth/LoginView';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { LoadingFallback } from './components/ui/LoadingFallback';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

// Lazy-loaded Views for bundle splitting and faster initial load
const DashboardView = lazy(() =>
  import('./components/dashboard/DashboardView').then((m) => ({ default: m.DashboardView }))
);
const DocumentsView = lazy(() =>
  import('./components/documents/DocumentsView').then((m) => ({ default: m.DocumentsView }))
);
const LocationsView = lazy(() =>
  import('./components/locations/LocationsView').then((m) => ({ default: m.LocationsView }))
);
const RequestsView = lazy(() =>
  import('./components/requests/RequestsView').then((m) => ({ default: m.RequestsView }))
);
const ApprovalsView = lazy(() =>
  import('./components/approvals/ApprovalsView').then((m) => ({ default: m.ApprovalsView }))
);
const MovementsView = lazy(() =>
  import('./components/movements/MovementsView').then((m) => ({ default: m.MovementsView }))
);
const InvestigationsView = lazy(() =>
  import('./components/investigations/InvestigationsView').then((m) => ({ default: m.InvestigationsView }))
);
const ReportsView = lazy(() =>
  import('./components/reports/ReportsView').then((m) => ({ default: m.ReportsView }))
);
const UsersView = lazy(() =>
  import('./components/admin/UsersView').then((m) => ({ default: m.UsersView }))
);
const DepartmentsView = lazy(() =>
  import('./components/admin/DepartmentsView').then((m) => ({ default: m.DepartmentsView }))
);
const AuditLogView = lazy(() =>
  import('./components/admin/AuditLogView').then((m) => ({ default: m.AuditLogView }))
);
const SettingsView = lazy(() =>
  import('./components/settings/SettingsView').then((m) => ({ default: m.SettingsView }))
);

const MainApp: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Derive active tab directly from URL pathname (e.g. /documents -> 'documents')
  const currentTab = (location.pathname.replace(/^\//, '') || 'dashboard') as ActiveTab;

  const handleNavigate = (tab: ActiveTab | string) => {
    navigate(`/${tab === 'dashboard' ? '' : tab}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mx-auto"></div>
          <p className="mt-3 text-xs font-semibold text-slate-300">
            Initializing FHC Branch One Archive System...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900 antialiased overflow-hidden">
      {/* Sidebar navigation */}
      <Sidebar
        activeTab={currentTab}
        setActiveTab={handleNavigate}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Workspace */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Administrator Database Station Bar */}
        <DatabaseStationBar />

        <Header
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onNavigate={(tab) => handleNavigate(tab as ActiveTab)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {/* Suspense boundary for lazy view loading */}
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                {/* Dashboard: All authenticated roles */}
                <Route path="/" element={<DashboardView onNavigate={handleNavigate} />} />
                <Route path="/dashboard" element={<Navigate to="/" replace />} />

                {/* Documents & Registries */}
                <Route
                  path="/documents"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'ARCHIVE_OFFICER', 'DEPARTMENT_MANAGER', 'EMPLOYEE', 'AUDITOR']}>
                      <DocumentsView />
                    </ProtectedRoute>
                  }
                />

                {/* Locations: Storage & Hierarchy */}
                <Route
                  path="/locations"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'ARCHIVE_OFFICER', 'DEPARTMENT_MANAGER', 'AUDITOR']}>
                      <LocationsView />
                    </ProtectedRoute>
                  }
                />

                {/* Requests & Requisitions */}
                <Route
                  path="/requests"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'ARCHIVE_OFFICER', 'DEPARTMENT_MANAGER', 'EMPLOYEE', 'AUDITOR']}>
                      <RequestsView />
                    </ProtectedRoute>
                  }
                />

                {/* Approvals: Department Managers & Admins */}
                <Route
                  path="/approvals"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'DEPARTMENT_MANAGER']}>
                      <ApprovalsView />
                    </ProtectedRoute>
                  }
                />

                {/* Movements & Custody */}
                <Route
                  path="/movements"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'ARCHIVE_OFFICER', 'DEPARTMENT_MANAGER', 'AUDITOR']}>
                      <MovementsView />
                    </ProtectedRoute>
                  }
                />

                {/* Missing File Security Investigations */}
                <Route
                  path="/investigations"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'ARCHIVE_OFFICER', 'AUDITOR']}>
                      <InvestigationsView />
                    </ProtectedRoute>
                  }
                />

                {/* Reports & Analytics */}
                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'ARCHIVE_OFFICER', 'DEPARTMENT_MANAGER', 'AUDITOR']}>
                      <ReportsView />
                    </ProtectedRoute>
                  }
                />

                {/* Admin Management Views */}
                <Route
                  path="/users"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <UsersView />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/departments"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <DepartmentsView />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/audit"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN', 'AUDITOR']}>
                      <AuditLogView />
                    </ProtectedRoute>
                  }
                />

                {/* Settings & Policies */}
                <Route path="/settings" element={<SettingsView />} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
};

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <LanguageProvider>
          <AuthProvider>
            <NotificationProvider>
              <MainApp />
            </NotificationProvider>
          </AuthProvider>
        </LanguageProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;

import React, { useState } from 'react';
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
import { DashboardView } from './components/dashboard/DashboardView';
import { DocumentsView } from './components/documents/DocumentsView';
import { LocationsView } from './components/locations/LocationsView';
import { RequestsView } from './components/requests/RequestsView';
import { ApprovalsView } from './components/approvals/ApprovalsView';
import { MovementsView } from './components/movements/MovementsView';
import { InvestigationsView } from './components/investigations/InvestigationsView';
import { ReportsView } from './components/reports/ReportsView';
import { UsersView } from './components/admin/UsersView';
import { DepartmentsView } from './components/admin/DepartmentsView';
import { AuditLogView } from './components/admin/AuditLogView';
import { SettingsView } from './components/settings/SettingsView';

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
        {/* Administrator MySQLi / MySQL Database Station Bar */}
        <DatabaseStationBar />

        <Header
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onNavigate={(tab) => handleNavigate(tab as ActiveTab)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {/* React Router declarative Routes instead of switch-case */}
            <Routes>
              <Route path="/" element={<DashboardView onNavigate={handleNavigate} />} />
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route path="/documents" element={<DocumentsView />} />
              <Route path="/locations" element={<LocationsView />} />
              <Route path="/requests" element={<RequestsView />} />
              <Route path="/approvals" element={<ApprovalsView />} />
              <Route path="/movements" element={<MovementsView />} />
              <Route path="/investigations" element={<InvestigationsView />} />
              <Route path="/reports" element={<ReportsView />} />
              <Route path="/users" element={<UsersView />} />
              <Route path="/departments" element={<DepartmentsView />} />
              <Route path="/audit" element={<AuditLogView />} />
              <Route path="/settings" element={<SettingsView />} />
              {/* Catch-all route to redirect back to Dashboard */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
};

export function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <NotificationProvider>
            <MainApp />
          </NotificationProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

export default App;

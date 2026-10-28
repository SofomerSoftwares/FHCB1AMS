import React, { useState } from 'react';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { Header } from './components/layout/Header';
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
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

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

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView onNavigate={(tab) => setActiveTab(tab)} />;
      case 'documents':
        return <DocumentsView />;
      case 'locations':
        return <LocationsView />;
      case 'requests':
        return <RequestsView />;
      case 'approvals':
        return <ApprovalsView />;
      case 'movements':
        return <MovementsView />;
      case 'investigations':
        return <InvestigationsView />;
      case 'reports':
        return <ReportsView />;
      case 'users':
        return <UsersView />;
      case 'departments':
        return <DepartmentsView />;
      case 'audit':
        return <AuditLogView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView onNavigate={(tab) => setActiveTab(tab)} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900 antialiased overflow-hidden">
      {/* Sidebar navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Workspace */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onNavigate={(tab) => setActiveTab(tab as any)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{renderActiveView()}</div>
        </main>
      </div>
    </div>
  );
};

export function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <NotificationProvider>
          <MainApp />
        </NotificationProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;

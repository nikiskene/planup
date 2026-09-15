// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from './contexts/WorkspaceContext';
import { ToastProvider } from './contexts/ToastContext';
import { SyncProvider } from './contexts/SyncContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppPage from './components/AppPage';
import ShoppingPage from './components/ShoppingPage';

import Auth from './pages/Auth';
import Landing from './pages/Landing';
import AuthCallback from './pages/AuthCallback';
import { LegalNotice, Privacy, Terms } from './pages/Legal';
import Onboarding from './pages/Onboarding';
import WorkspaceSwitcher from './pages/WorkspaceSwitcher';

import Inbox from './pages/Inbox';
import Tasks from './pages/Tasks';
import TaskDetail from './pages/TaskDetail';
import Notes from './pages/Notes';
import QR from './pages/QR';
import Dues from './pages/Dues';
import Shopping from './pages/Shopping';
import Settings from './pages/Settings';
import SettingsPage from './pages/settings/SettingsPage';

// ✅ default import (CrmContacts.tsx exports default)
import { PeoplePage } from './pages/crm/contacts/PeoplePage';

import CrmCompanies from './pages/crm/CrmCompanies';
import CrmInteractions from './pages/crm/CrmInteractions';
import CrmContactDetail from './pages/crm/CrmContactDetail';
import CrmDeals from './pages/crm/deals/CrmDeals';
import LeadsPage from './pages/crm/LeadsPage';
import CompanyDetailPage from './pages/crm/companies/CompanyDetailPage';

function HomeRedirect() {
  const { activeWorkspaceId, loading, isOnlyShopping, error, refreshWorkspaces } = useWorkspace();
  if (loading) return null;

  const wid = activeWorkspaceId;

  if (error && !wid) return <div className="p-8"><p role="alert">{error}</p><button onClick={() => refreshWorkspaces()} className="mt-4 text-blue-700">Try again</button></div>;
  if (!wid) return <Navigate to="/workspace" replace />;
  if (isOnlyShopping) return <Navigate to="/shopping" replace />;
  return <Navigate to="/inbox" replace />;
}

function AccountWorkspace({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return <WorkspaceProvider key={user?.id || 'anonymous'}>{children}</WorkspaceProvider>;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AccountWorkspace>
          <SyncProvider>
            <ToastProvider>
            <Routes>
              {/* Public */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/auth/reset-password" element={<AuthCallback reset />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/legal-notice" element={<LegalNotice />} />

              {/* Workspace setup */}
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <Onboarding />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/workspace"
                element={
                  <ProtectedRoute>
                    <WorkspaceSwitcher />
                  </ProtectedRoute>
                }
              />

              {/* Core app */}
              <Route path="/qr" element={<AppPage><QR /></AppPage>} />
              <Route
                path="/inbox"
                element={
                  <AppPage>
                    <Inbox />
                  </AppPage>
                }
              />
              <Route
                path="/tasks"
                element={
                  <AppPage>
                    <Tasks />
                  </AppPage>
                }
              />
              <Route
                path="/tasks/:id"
                element={
                  <AppPage>
                    <TaskDetail />
                  </AppPage>
                }
              />
              <Route
                path="/notes"
                element={
                  <AppPage>
                    <Notes />
                  </AppPage>
                }
              />
              <Route
                path="/dues"
                element={
                  <AppPage>
                    <Dues />
                  </AppPage>
                }
              />
              <Route
                path="/settings"
                element={
                  <AppPage>
                    <SettingsPage><Settings /></SettingsPage>
                  </AppPage>
                }
              />

              {/* Shopping (allowed in only_shopping mode) */}
              <Route
                path="/shopping"
                element={
                  <ShoppingPage>
                    <Shopping />
                  </ShoppingPage>
                }
              />

              {/* CRM */}
              <Route
                path="/crm/contacts"
                element={
                  <AppPage>
                    <LeadsPage view="people"><PeoplePage /></LeadsPage>
                  </AppPage>
                }
              />
              <Route
                path="/crm/contacts/:id"
                element={
                  <AppPage>
                    <CrmContactDetail />
                  </AppPage>
                }
              />
              <Route
                path="/crm/companies"
                element={
                  <AppPage>
                    <LeadsPage view="companies"><CrmCompanies /></LeadsPage>
                  </AppPage>
                }
              />
              <Route
                path="/crm/companies/:id"
                element={
                  <AppPage>
                    <CompanyDetailPage />
                  </AppPage>
                }
              />
              <Route
                path="/crm/interactions"
                element={
                  <AppPage>
                    <CrmInteractions />
                  </AppPage>
                }
              />
              <Route
                path="/crm/deals"
                element={
                  <AppPage>
                    <CrmDeals />
                  </AppPage>
                }
              />

              {/* Root */}
              <Route path="/" element={<Landing />} />
              <Route path="/app" element={<ProtectedRoute><HomeRedirect /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </ToastProvider>
          </SyncProvider>
        </AccountWorkspace>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

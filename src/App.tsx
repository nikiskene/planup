// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from './contexts/WorkspaceContext';
import { ToastProvider } from './contexts/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppPage from './components/AppPage';
import ShoppingPage from './components/ShoppingPage';

import Auth from './pages/Auth';
import Onboarding from './pages/Onboarding';
import WorkspaceSwitcher from './pages/WorkspaceSwitcher';

import Inbox from './pages/Inbox';
import Tasks from './pages/Tasks';
import TaskDetail from './pages/TaskDetail';
import Notes from './pages/Notes';
import Dues from './pages/Dues';
import Shopping from './pages/Shopping';
import Settings from './pages/Settings';

// ✅ default import (CrmContacts.tsx exports default)
import CrmContacts from './pages/crm/contacts/CrmContacts';

import CrmCompanies from './pages/crm/CrmCompanies';
import CrmInteractions from './pages/crm/CrmInteractions';
import CrmContactDetail from './pages/crm/CrmContactDetail';
import CrmDeals from './pages/crm/deals/CrmDeals';

function HomeRedirect() {
  const { activeWorkspaceId, loading, membership } = useWorkspace();
  if (loading) return null;

  const onlyShopping = Boolean((membership as any)?.only_shopping);
  const stored = localStorage.getItem('active_workspace_id');
  const wid = activeWorkspaceId || stored;

  if (!wid) return <Navigate to="/workspace" replace />;
  if (onlyShopping) return <Navigate to="/shopping" replace />;
  return <Navigate to="/inbox" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WorkspaceProvider>
          <ToastProvider>
            <Routes>
              {/* Public */}
              <Route path="/auth" element={<Auth />} />

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
                    <Settings />
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
                    <CrmContacts />
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
                    <CrmCompanies />
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
              <Route path="/" element={<HomeRedirect />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
// src/components/AppPage.tsx
import React from 'react';
import ProtectedRoute from './ProtectedRoute';
import Layout from './Layout';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { Navigate, useLocation } from 'react-router-dom';

function OnlyShoppingGuard({ children }: { children: React.ReactNode }) {
  const { isOnlyShopping, loading } = useWorkspace();
  const location = useLocation();

  if (loading) return null;

  const path = location.pathname;

  const allowed =
    path === '/shopping' ||
    path === '/auth' ||
    path === '/workspace' ||
    path === '/onboarding';

  if (isOnlyShopping && !allowed) return <Navigate to="/shopping" replace />;

  return <>{children}</>;
}

export default function AppPage({ children }: { children: React.ReactNode }) {
  const { activeWorkspaceId } = useWorkspace();
  return (
    <ProtectedRoute requireWorkspace>
      <OnlyShoppingGuard>
        <Layout key={activeWorkspaceId}>{children}</Layout>
      </OnlyShoppingGuard>
    </ProtectedRoute>
  );
}
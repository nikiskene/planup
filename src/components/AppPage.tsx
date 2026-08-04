// src/components/AppPage.tsx
import React from 'react';
import ProtectedRoute from './ProtectedRoute';
import Layout from './Layout';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { Navigate, useLocation } from 'react-router-dom';

function OnlyShoppingGuard({ children }: { children: React.ReactNode }) {
  const { membership, loading } = useWorkspace();
  const location = useLocation();

  if (loading) return null;

  const onlyShopping = Boolean((membership as any)?.only_shopping);
  const path = location.pathname;

  const allowed =
    path === '/shopping' ||
    path === '/auth' ||
    path === '/workspace' ||
    path === '/onboarding';

  if (onlyShopping && !allowed) return <Navigate to="/shopping" replace />;

  return <>{children}</>;
}

export default function AppPage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requireWorkspace>
      <OnlyShoppingGuard>
        <Layout>{children}</Layout>
      </OnlyShoppingGuard>
    </ProtectedRoute>
  );
}
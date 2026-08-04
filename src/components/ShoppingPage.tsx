// src/components/ShoppingPage.tsx
import React from 'react';
import ProtectedRoute from './ProtectedRoute';
import Layout from './Layout';

export default function ShoppingPage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requireWorkspace>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}
import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';

type Props = {
  children: React.ReactNode;
  requireWorkspace?: boolean;
};

export default function ProtectedRoute({ children, requireWorkspace = false }: Props) {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const {
    activeWorkspaceId,
    workspaces,
    loading: workspaceLoading,
    refreshWorkspaces,
  } = useWorkspace();

  const stored = localStorage.getItem('active_workspace_id');
  const wid = activeWorkspaceId || stored;

  // If we have a wid but workspace list is empty after loading, refresh once.
  useEffect(() => {
    if (!requireWorkspace) return;
    if (!user) return;
    if (!wid) return;
    if (workspaceLoading) return;

    if (workspaces.length === 0) {
      refreshWorkspaces();
    }
  }, [requireWorkspace, user, wid, workspaceLoading, workspaces.length, refreshWorkspaces]);

  // Wait for auth; for workspace-required pages also wait for workspace init.
  if (authLoading || (requireWorkspace && workspaceLoading)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  if (!requireWorkspace) return <>{children}</>;

  // If we have a wid but the list is still empty, do NOT redirect yet.
  if (wid && workspaces.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Preparing workspace...</div>
      </div>
    );
  }

  // No workspaces and no wid => onboarding
  if (!wid && workspaces.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  // No active workspace => switcher
  if (!wid) {
    return <Navigate to="/workspace" replace state={{ from: location.pathname }} />;
  }

  // wid not in list => switcher
  if (workspaces.length > 0 && !workspaces.some((w) => w.id === wid)) {
    return <Navigate to="/workspace" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
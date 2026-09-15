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
    error,
  } = useWorkspace();

  const wid = activeWorkspaceId;

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

  if (error && workspaces.length === 0) {
    return <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <p role="alert">{error}</p>
      <button onClick={() => refreshWorkspaces()} className="rounded-xl bg-slate-950 px-5 py-3 text-white">Try again</button>
    </div>;
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
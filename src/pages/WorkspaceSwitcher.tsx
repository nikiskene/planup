import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useToast } from '../contexts/ToastContext';
import { Plus, ChevronRight } from 'lucide-react';

export default function WorkspaceSwitcher() {
  const { workspaces, activeWorkspaceId, setActiveWorkspaceId, createWorkspace, loading } = useWorkspace();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSelectWorkspace = (workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
    showToast('Workspace switched', 'success');
    navigate('/inbox');
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;

    setCreating(true);
    try {
      const workspaceId = await createWorkspace(newWorkspaceName);
      if (workspaceId) {
        setActiveWorkspaceId(workspaceId);
        showToast('Workspace created successfully!', 'success');
        navigate('/inbox');
      } else {
        showToast('Failed to create workspace', 'error');
      }
    } catch (error: any) {
      showToast(error?.message || 'An error occurred', 'error');
    } finally {
      setCreating(false);
      setShowCreateForm(false);
      setNewWorkspaceName('');
    }
  };

  // Critical: do not redirect while workspaces are still loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading workspace…</div>
      </div>
    );
  }

  // After loading: no workspaces means onboarding
  if (workspaces.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-xl font-semibold text-gray-900">Select Workspace</h1>
          </div>

          <div className="divide-y divide-gray-200">
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                onClick={() => handleSelectWorkspace(workspace.id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{workspace.name}</h3>
                  {workspace.id === activeWorkspaceId && (
                    <p className="text-sm text-blue-600 mt-0.5">Active</p>
                  )}
                </div>
                <ChevronRight size={20} className="text-gray-400" />
              </button>
            ))}
          </div>

          {showCreateForm ? (
            <form onSubmit={handleCreateWorkspace} className="p-6 border-t border-gray-200">
              <input
                type="text"
                required
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="Workspace name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewWorkspaceName('');
                  }}
                  className="py-2 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  disabled={creating}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                Create New Workspace
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
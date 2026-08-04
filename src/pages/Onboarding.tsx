import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useToast } from '../contexts/ToastContext';

export default function Onboarding() {
  const [workspaceName, setWorkspaceName] = useState('My Workspace');
  const [loading, setLoading] = useState(false);

  const { createWorkspace, setActiveWorkspaceId } = useWorkspace();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);

    try {
      const workspaceId = await createWorkspace(workspaceName);

      if (!workspaceId) {
        showToast('Failed to create workspace (no id returned)', 'error');
        return;
      }

      // Persist FIRST so any route guards can read it immediately
      localStorage.setItem('active_workspace_id', workspaceId);

      // Update context/state
      setActiveWorkspaceId(workspaceId);

      showToast('Workspace created successfully!', 'success');

      // Give React state a tick to propagate before routing guards run
      setTimeout(() => {
        navigate('/inbox', { replace: true });
      }, 0);
    } catch (error: any) {
      showToast(error?.message || 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Create Your Workspace
          </h1>
          <p className="text-gray-600 mb-6">
            Let's get started by setting up your first workspace.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="workspaceName"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Workspace Name
              </label>
              <input
                id="workspaceName"
                type="text"
                required
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="My Workspace"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creating...' : 'Create Workspace'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
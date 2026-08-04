import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { CheckSquare, FileText, Plus } from 'lucide-react';
import { Database } from '../lib/types';

type Task = Database['public']['Tables']['tasks']['Row'];
type Note = Database['public']['Tables']['notes']['Row'];

type InboxItem =
  | { type: 'task'; data: Task }
  | { type: 'note'; data: Note };

export default function Inbox() {
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newNoteBody, setNewNoteBody] = useState('');

  const fetchInboxItems = async () => {
    if (!activeWorkspaceId) return;

    try {
      const [tasksResult, notesResult] = await Promise.all([
        supabase
          .from('tasks')
          .select('*')
          .eq('workspace_id', activeWorkspaceId)
          .eq('status', 'inbox')
          .order('created_at', { ascending: false }),
        supabase
          .from('notes')
          .select('*')
          .eq('workspace_id', activeWorkspaceId)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (tasksResult.error) throw tasksResult.error;
      if (notesResult.error) throw notesResult.error;

      const taskItems: InboxItem[] = (tasksResult.data || []).map(task => ({
        type: 'task',
        data: task,
      }));

      const noteItems: InboxItem[] = (notesResult.data || []).map(note => ({
        type: 'note',
        data: note,
      }));

      const combined = [...taskItems, ...noteItems].sort((a, b) => {
        const aDate = new Date(a.data.created_at).getTime();
        const bDate = new Date(b.data.created_at).getTime();
        return bDate - aDate;
      });

      setItems(combined);
    } catch (error: any) {
      showToast(error.message || 'Failed to load inbox', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInboxItems();
  }, [activeWorkspaceId]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceId || !user || !newTaskTitle.trim()) return;

    try {
      const { error } = await supabase.from('tasks').insert({
        workspace_id: activeWorkspaceId,
        title: newTaskTitle,
        status: 'inbox',
        priority: 'P2',
        time_estimate_min: 15,
        created_by: user.id,
      });

      if (error) throw error;

      setNewTaskTitle('');
      showToast('Task created', 'success');
      fetchInboxItems();
    } catch (error: any) {
      showToast(error.message || 'Failed to create task', 'error');
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceId || !user || !newNoteBody.trim()) return;

    try {
      const { error } = await supabase.from('notes').insert({
        workspace_id: activeWorkspaceId,
        body: newNoteBody,
        created_by: user.id,
      });

      if (error) throw error;

      setNewNoteBody('');
      showToast('Note created', 'success');
      fetchInboxItems();
    } catch (error: any) {
      showToast(error.message || 'Failed to create note', 'error');
    }
  };

  if (loading) {
    return <div className="text-center text-gray-600 py-8">Loading...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Dashboard</h1>

      <div className="space-y-4 mb-6">
        <form onSubmit={handleCreateTask} className="flex gap-2">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="New task..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
          </button>
        </form>

        <form onSubmit={handleCreateNote} className="flex gap-2">
          <input
            type="text"
            value={newNoteBody}
            onChange={(e) => setNewNoteBody(e.target.value)}
            placeholder="New note..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
          </button>
        </form>
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <p>Your inbox is empty</p>
            <p className="text-sm mt-1">Create a task or note to get started</p>
          </div>
        ) : (
          items.map((item) => (
            <button
              key={`${item.type}-${item.data.id}`}
              onClick={() => {
                if (item.type === 'task') {
                  navigate(`/tasks/${item.data.id}`);
                } else {
                  navigate('/notes');
                }
              }}
              className="w-full bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all text-left"
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${item.type === 'task' ? 'text-blue-600' : 'text-green-600'}`}>
                  {item.type === 'task' ? <CheckSquare size={20} /> : <FileText size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900">
                    {item.type === 'task' ? item.data.title : item.data.headline || 'Note'}
                  </h3>
                  {item.type === 'note' && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {item.data.body}
                    </p>
                  )}
                  {item.type === 'task' && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        item.data.priority === 'P0'
                          ? 'bg-red-100 text-red-700'
                          : item.data.priority === 'P1'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {item.data.priority}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

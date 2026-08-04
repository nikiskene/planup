import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ArrowLeft, Trash2, UserRound, ExternalLink } from 'lucide-react';
import { Database } from '../lib/types';

type Task = Database['public']['Tables']['tasks']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

type CrmContactLite = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  linkedin_url: string | null;
  phone: string | null;
};

function contactLabel(c: CrmContactLite) {
  const fn = (c.first_name || '').trim();
  const ln = (c.last_name || '').trim();
  const name = `${fn} ${ln}`.trim();
  return name || c.email || 'Contact';
}

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeWorkspaceId, membership } = useWorkspace();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [task, setTask] = useState<Task | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // CRM read-only card state
  const [crmContact, setCrmContact] = useState<CrmContactLite | null>(null);
  const [crmLoading, setCrmLoading] = useState(false);

  const isNew = id === 'new';

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'inbox' as Task['status'],
    priority: 'P2' as Task['priority'],
    next_step: '',
    time_estimate_min: 15,
    due_at: '',
    waiting_for: '',
    energy_level: '' as Task['energy_level'],
    category_id: '',
  });

  const fetchCrmContact = useCallback(
    async (contactId: string) => {
      if (!activeWorkspaceId) return;
      setCrmLoading(true);
      try {
        const { data, error } = await supabase
          .from('crm_contacts')
          .select('id, first_name, last_name, email, linkedin_url, phone')
          .eq('id', contactId)
          .eq('workspace_id', activeWorkspaceId)
          .maybeSingle();

        if (error) throw error;
        setCrmContact((data || null) as CrmContactLite | null);
      } catch (err: any) {
        console.error(err);
        // silent-ish: task should still be editable even if CRM lookup fails
        setCrmContact(null);
      } finally {
        setCrmLoading(false);
      }
    },
    [activeWorkspaceId]
  );

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      if (!activeWorkspaceId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        // categories for dropdown
        const { data: cats, error: catsErr } = await supabase
          .from('categories')
          .select('*')
          .eq('workspace_id', activeWorkspaceId)
          .order('name', { ascending: true });

        if (catsErr) throw catsErr;
        if (!cancelled) setCategories(cats || []);

        if (!isNew && id) {
          const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', id)
            .maybeSingle();

          if (error) throw error;

          if (!data) {
            showToast('Task not found', 'error');
            navigate('/tasks');
            return;
          }

          if (data.workspace_id !== activeWorkspaceId) {
            showToast('Task is not in the active workspace', 'error');
            navigate('/tasks');
            return;
          }

          if (!cancelled) {
            setTask(data);
            setFormData({
              title: data.title,
              description: data.description || '',
              status: data.status,
              priority: data.priority,
              next_step: data.next_step || '',
              time_estimate_min: data.time_estimate_min || 15,
              due_at: data.due_at ? data.due_at.split('T')[0] : '',
              waiting_for: data.waiting_for || '',
              energy_level: data.energy_level || '',
              category_id: data.category_id || '',
            });
          }

          // CRM contact fetch (read-only)
          if (data.crm_contact_id) {
            await fetchCrmContact(data.crm_contact_id);
          } else {
            if (!cancelled) setCrmContact(null);
          }
        } else {
          if (!cancelled) {
            setTask(null);
            setCrmContact(null);
            setFormData((prev) => ({
              ...prev,
              title: '',
              description: '',
              status: 'inbox',
              priority: 'P2',
              next_step: '',
              time_estimate_min: 15,
              due_at: '',
              waiting_for: '',
              energy_level: '',
              category_id: '',
            }));
          }
        }
      } catch (error: any) {
        showToast(error?.message || 'Failed to load task', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, activeWorkspaceId, isNew, fetchCrmContact]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceId || !user) return;

    if (!formData.title.trim()) {
      showToast('Title is required', 'error');
      return;
    }

    if (formData.priority === 'P0' && !membership?.can_set_priority_p0) {
      showToast("You don't have permission to set P0.", 'error');
      return;
    }

    setSaving(true);

    try {
      const taskData = {
        workspace_id: activeWorkspaceId,
        title: formData.title.trim(),
        description: formData.description?.trim() ? formData.description.trim() : null,
        status: formData.status,
        priority: formData.priority,
        next_step: formData.next_step?.trim() ? formData.next_step.trim() : null,
        time_estimate_min: formData.time_estimate_min,
        due_at: formData.due_at ? formData.due_at : null,
        waiting_for: formData.waiting_for?.trim() ? formData.waiting_for.trim() : null,
        energy_level: formData.energy_level ? formData.energy_level : null,
        category_id: formData.category_id ? formData.category_id : null,
      };

      if (isNew) {
        const { error } = await supabase.from('tasks').insert({
          ...taskData,
          created_by: user.id,
        });

        if (error) throw error;
        showToast('Task created', 'success');
        navigate('/tasks');
      } else {
        if (!id) throw new Error('Missing task id');

        const { error } = await supabase.from('tasks').update(taskData).eq('id', id);

        if (error) throw error;
        showToast('Task updated', 'success');
        navigate('/tasks');
      }
    } catch (error: any) {
      if (error?.message?.toLowerCase?.().includes('permission') || error?.code === '42501') {
        showToast("You don't have permission for this action.", 'error');
      } else {
        showToast(error?.message || 'Failed to save task', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleMarkDone = async () => {
    if (!id || isNew) return;
    setSaving(true);

    try {
      const { error } = await supabase.from('tasks').update({ status: 'done' }).eq('id', id);

      if (error) throw error;
      showToast('Task marked as done', 'success');
      navigate('/tasks');
    } catch (error: any) {
      showToast(error?.message || 'Failed to update task', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || isNew) return;
    if (!confirm('Are you sure you want to delete this task?')) return;

    setSaving(true);

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);

      if (error) throw error;
      showToast('Task deleted', 'success');
      navigate('/tasks');
    } catch (error: any) {
      showToast(error?.message || 'Failed to delete task', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center text-gray-600 py-8">Loading...</div>;
  }

  const canSetP0 = membership?.can_set_priority_p0 ?? false;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/tasks')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">{isNew ? 'New Task' : 'Edit Task'}</h1>
      </div>

      {/* CRM read-only card */}
      {!isNew && task?.crm_contact_id ? (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <UserRound size={16} className="text-gray-600" />
                CRM link
              </div>

              {crmLoading ? (
                <div className="text-sm text-gray-600 mt-2">Loading linked contact…</div>
              ) : crmContact ? (
                <div className="mt-2">
                  <div className="font-medium text-gray-900 truncate">{contactLabel(crmContact)}</div>
                  <div className="mt-1 text-sm text-gray-600 space-y-1">
                    {crmContact.email ? <div className="truncate">{crmContact.email}</div> : null}
                    {crmContact.phone ? <div className="truncate">{crmContact.phone}</div> : null}
                    {crmContact.linkedin_url ? (
                      <a
                        href={crmContact.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-blue-600 hover:underline inline-block"
                      >
                        {crmContact.linkedin_url}
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600 mt-2">
                  Linked contact not found in this workspace.
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Link
                to={`/crm/contacts/${task.crm_contact_id}`}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Open contact <ExternalLink size={14} />
              </Link>
            </div>
          </div>

          <div className="mt-3 text-xs text-gray-500">
            Read-only. CRM data is edited in the CRM module.
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSave} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Title
          </label>
          <input
            id="title"
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as Task['status'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="inbox">Inbox</option>
              <option value="next">Next</option>
              <option value="waiting">Waiting</option>
              <option value="scheduled">Scheduled</option>
              <option value="done">Done</option>
            </select>
          </div>

          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <select
              id="priority"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as Task['priority'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {canSetP0 && <option value="P0">P0 (Urgent)</option>}
              <option value="P1">P1 (High)</option>
              <option value="P2">P2 (Normal)</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="next_step" className="block text-sm font-medium text-gray-700 mb-1">
            Next Step
          </label>
          <input
            id="next_step"
            type="text"
            value={formData.next_step}
            onChange={(e) => setFormData({ ...formData, next_step: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="time_estimate_min" className="block text-sm font-medium text-gray-700 mb-1">
              Time Estimate (min)
            </label>
            <select
              id="time_estimate_min"
              value={formData.time_estimate_min}
              onChange={(e) =>
                setFormData({ ...formData, time_estimate_min: parseInt(e.target.value, 10) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="60">60 min</option>
              <option value="120">120 min</option>
            </select>
          </div>

          <div>
            <label htmlFor="due_at" className="block text-sm font-medium text-gray-700 mb-1">
              Due Date
            </label>
            <input
              id="due_at"
              type="date"
              value={formData.due_at}
              onChange={(e) => setFormData({ ...formData, due_at: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label htmlFor="waiting_for" className="block text-sm font-medium text-gray-700 mb-1">
            Waiting For
          </label>
          <input
            id="waiting_for"
            type="text"
            value={formData.waiting_for}
            onChange={(e) => setFormData({ ...formData, waiting_for: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="energy_level" className="block text-sm font-medium text-gray-700 mb-1">
              Energy Level
            </label>
            <select
              id="energy_level"
              value={formData.energy_level || ''}
              onChange={(e) => setFormData({ ...formData, energy_level: e.target.value as Task['energy_level'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">None</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              id="category_id"
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">None</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>

          {!isNew && (
            <>
              <button
                type="button"
                onClick={handleMarkDone}
                disabled={saving}
                className="px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Mark Done
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="p-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Delete task"
              >
                <Trash2 size={20} />
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
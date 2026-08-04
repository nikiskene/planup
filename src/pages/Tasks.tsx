import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Plus, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { Database } from '../lib/types';

type Task = Database['public']['Tables']['tasks']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];
type TaskStatus = 'inbox' | 'next' | 'waiting' | 'scheduled' | 'done';

export default function Tasks() {
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Pick<Category, 'id' | 'name'>[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<TaskStatus>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const categoryById = useMemo(() => {
    return Object.fromEntries(categories.map((c) => [c.id, c.name]));
  }, [categories]);

  const groupedTasks = useMemo(() => {
    if (statusFilter !== 'done') return null;

    const grouped: Record<string, Record<string, Task[]>> = {};

    tasks.forEach((task) => {
      const date = new Date(task.updated_at);
      const year = date.getFullYear().toString();
      const month = date.toLocaleString('default', { month: 'long' });

      if (!grouped[year]) grouped[year] = {};
      if (!grouped[year][month]) grouped[year][month] = [];
      grouped[year][month].push(task);
    });

    return grouped;
  }, [tasks, statusFilter]);

  const toggleMonth = (yearMonth: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(yearMonth)) {
        next.delete(yearMonth);
      } else {
        next.add(yearMonth);
      }
      return next;
    });
  };

  const fetchCategories = async () => {
    if (!activeWorkspaceId) return;

    const { data, error } = await supabase
      .from('categories')
      .select('id,name')
      .eq('workspace_id', activeWorkspaceId)
      .order('name', { ascending: true });

    if (error) throw error;
    setCategories((data || []) as any);
  };

  const fetchTasks = async () => {
    if (!activeWorkspaceId) return;

    try {
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('workspace_id', activeWorkspaceId);

      if (statusFilter === 'next') {
        query = query.eq('priority', 'P0').neq('status', 'done');
      } else if (statusFilter === 'waiting') {
        query = query.in('priority', ['P1', 'P2']).neq('status', 'done');
      } else if (statusFilter === 'scheduled') {
        query = query.not('due_at', 'is', null).neq('status', 'done');
      } else if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      if (categoryFilter) {
        query = query.eq('category_id', categoryFilter);
      }

      if (searchQuery) {
        query = query.ilike('title', `%${searchQuery}%`);
      }

      const { data, error } = await query
        .order('priority', { ascending: true })
        .order('due_at', { ascending: true, nullsFirst: false })
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error: any) {
      showToast(error?.message || 'Failed to load tasks', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!activeWorkspaceId) return;

      setLoading(true);

      try {
        await fetchCategories();

        if (!cancelled) {
          await fetchTasks();
        }
      } catch (error: any) {
        showToast(error?.message || 'Failed to load data', 'error');
        setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId]);

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId, statusFilter, searchQuery, categoryFilter]);

  const statuses: { value: TaskStatus; label: string }[] = [
    { value: 'inbox', label: 'Inbox' },
    { value: 'next', label: 'Next' },
    { value: 'waiting', label: 'Waiting' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'done', label: 'Done' },
  ];

  if (loading) {
    return <div className="text-center text-gray-600 py-8">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Tasks</h1>
        <button
          onClick={() => navigate('/tasks/new')}
          className="lg:flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors hidden"
        >
          <Plus size={20} />
          New Task
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 mb-4">
        <div className="flex overflow-x-auto border-b border-gray-200">
          {statuses.map((status) => (
            <button
              key={status.value}
              onClick={() => setStatusFilter(status.value)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                statusFilter === status.value
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="hidden sm:block" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {tasks.length === 0 ? (
          <div className="text-center text-gray-500 py-12 bg-white rounded-lg border border-gray-200">
            <p>No tasks found</p>
            <p className="text-sm mt-1">Create a new task to get started</p>
          </div>
        ) : statusFilter === 'done' && groupedTasks ? (
          <div className="space-y-4">
            {Object.keys(groupedTasks).sort((a, b) => parseInt(b) - parseInt(a)).map((year) => (
              <div key={year} className="bg-white rounded-lg border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">{year}</h2>
                </div>
                {Object.keys(groupedTasks[year]).map((month) => {
                  const yearMonth = `${year}-${month}`;
                  const isExpanded = expandedMonths.has(yearMonth);
                  const monthTasks = groupedTasks[year][month];

                  return (
                    <div key={yearMonth} className="border-b border-gray-200 last:border-b-0">
                      <button
                        onClick={() => toggleMonth(yearMonth)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown size={20} className="text-gray-500" />
                          ) : (
                            <ChevronRight size={20} className="text-gray-500" />
                          )}
                          <span className="font-medium text-gray-900">{month}</span>
                          <span className="text-sm text-gray-500">({monthTasks.length})</span>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-2">
                          {monthTasks.map((task) => {
                            const categoryName = task.category_id ? categoryById[task.category_id] : null;

                            return (
                              <button
                                key={task.id}
                                onClick={() => navigate(`/tasks/${task.id}`)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all text-left"
                              >
                                <div className="flex items-start gap-3">
                                  <div className="flex-1 min-w-0">
                                    <h3 className="font-medium text-gray-900">{task.title}</h3>

                                    {task.description && (
                                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{task.description}</p>
                                    )}

                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                      <span
                                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                                          task.priority === 'P0'
                                            ? 'bg-red-100 text-red-700'
                                            : task.priority === 'P1'
                                            ? 'bg-orange-100 text-orange-700'
                                            : 'bg-blue-100 text-blue-700'
                                        }`}
                                      >
                                        {task.priority}
                                      </span>

                                      {categoryName && (
                                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                                          {categoryName}
                                        </span>
                                      )}

                                      {task.due_at && (
                                        <span className="text-xs text-gray-600">
                                          Due: {new Date(task.due_at).toLocaleDateString()}
                                        </span>
                                      )}

                                      {task.created_by === user?.id && <span className="text-xs text-gray-500">You</span>}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          tasks.map((task) => {
            const categoryName = task.category_id ? categoryById[task.category_id] : null;

            return (
              <button
                key={task.id}
                onClick={() => navigate(`/tasks/${task.id}`)}
                className="w-full bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900">{task.title}</h3>

                    {task.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{task.description}</p>
                    )}

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          task.priority === 'P0'
                            ? 'bg-red-100 text-red-700'
                            : task.priority === 'P1'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {task.priority}
                      </span>

                      {categoryName && (
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                          {categoryName}
                        </span>
                      )}

                      {task.due_at && (
                        <span className="text-xs text-gray-600">
                          Due: {new Date(task.due_at).toLocaleDateString()}
                        </span>
                      )}

                      {task.created_by === user?.id && <span className="text-xs text-gray-500">You</span>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      <button
        onClick={() => navigate('/tasks/new')}
        className="lg:hidden fixed bottom-20 right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center z-20"
        aria-label="New task"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}
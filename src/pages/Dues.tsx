import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Plus, X, Save } from 'lucide-react';
import { Database } from '../lib/types';

type Due = Database['public']['Tables']['dues']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

export default function Dues() {
  const { activeWorkspaceId, membership } = useWorkspace();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [dues, setDues] = useState<Due[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDue, setEditingDue] = useState<Due | null>(null);
  const [showNewDue, setShowNewDue] = useState(false);
  const [formData, setFormData] = useState({
    payee: '',
    amount: '',
    currency: 'USD',
    due_date: '',
    status: 'pending' as Due['status'],
    reference: '',
    category_id: '',
  });

  const canManageDues = membership?.can_manage_dues ?? false;

  const fetchDues = async () => {
    if (!activeWorkspaceId) return;

    try {
      const { data, error } = await supabase
        .from('dues')
        .select('*')
        .eq('workspace_id', activeWorkspaceId)
        .order('due_date', { ascending: true });

      if (error) throw error;
      setDues(data || []);
    } catch (error: any) {
      showToast(error.message || 'Failed to load dues', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    if (!activeWorkspaceId) return;

    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('workspace_id', activeWorkspaceId)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      console.error('Failed to load categories', error);
    }
  };

  useEffect(() => {
    fetchDues();
    fetchCategories();
  }, [activeWorkspaceId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceId || !user) return;

    try {
      const dueData = {
        workspace_id: activeWorkspaceId,
        payee: formData.payee,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        due_date: formData.due_date,
        status: formData.status,
        reference: formData.reference || null,
        category_id: formData.category_id || null,
      };

      if (editingDue) {
        const { error } = await supabase
          .from('dues')
          .update(dueData)
          .eq('id', editingDue.id);

        if (error) throw error;
        showToast('Due updated', 'success');
      } else {
        const { error } = await supabase.from('dues').insert({
          ...dueData,
          created_by: user.id,
        });

        if (error) throw error;
        showToast('Due created', 'success');
      }

      setFormData({
        payee: '',
        amount: '',
        currency: 'USD',
        due_date: '',
        status: 'pending',
        reference: '',
        category_id: '',
      });
      setEditingDue(null);
      setShowNewDue(false);
      fetchDues();
    } catch (error: any) {
      if (error.message?.includes('permission') || error.code === '42501') {
        showToast("You don't have access to do that.", 'error');
      } else {
        showToast(error.message || 'Failed to save due', 'error');
      }
    }
  };

  const handleEdit = (due: Due) => {
    setEditingDue(due);
    setFormData({
      payee: due.payee,
      amount: due.amount.toString(),
      currency: due.currency,
      due_date: due.due_date,
      status: due.status,
      reference: due.reference || '',
      category_id: due.category_id || '',
    });
    setShowNewDue(true);
  };

  const handleDelete = async (dueId: string) => {
    if (!confirm('Are you sure you want to delete this due?')) return;

    try {
      const { error } = await supabase.from('dues').delete().eq('id', dueId);

      if (error) throw error;
      showToast('Due deleted', 'success');
      fetchDues();
    } catch (error: any) {
      showToast(error.message || 'Failed to delete due', 'error');
    }
  };

  const handleCancel = () => {
    setFormData({
      payee: '',
      amount: '',
      currency: 'USD',
      due_date: '',
      status: 'pending',
      reference: '',
      category_id: '',
    });
    setEditingDue(null);
    setShowNewDue(false);
  };

  const groupedDues = {
    overdue: dues.filter(d => d.status !== 'paid' && new Date(d.due_date) < new Date()),
    dueSoon: dues.filter(d => {
      const dueDate = new Date(d.due_date);
      const today = new Date();
      const in14Days = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
      return d.status !== 'paid' && dueDate >= today && dueDate <= in14Days;
    }),
    later: dues.filter(d => {
      const dueDate = new Date(d.due_date);
      const in14Days = new Date(new Date().getTime() + 14 * 24 * 60 * 60 * 1000);
      return d.status !== 'paid' && dueDate > in14Days;
    }),
    paid: dues.filter(d => d.status === 'paid'),
  };

  if (loading) {
    return <div className="text-center text-gray-600 py-8">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Dues</h1>
        {!showNewDue && canManageDues && (
          <button
            onClick={() => setShowNewDue(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            New Due
          </button>
        )}
      </div>

      {!canManageDues && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            You don't have permission to manage dues in this workspace.
          </p>
        </div>
      )}

      {showNewDue && canManageDues && (
        <form onSubmit={handleSave} className="bg-white rounded-lg border border-gray-200 p-6 mb-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingDue ? 'Edit Due' : 'New Due'}
            </h2>
            <button
              type="button"
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          <div>
            <label htmlFor="payee" className="block text-sm font-medium text-gray-700 mb-1">
              Payee
            </label>
            <input
              id="payee"
              type="text"
              required
              value={formData.payee}
              onChange={(e) => setFormData({ ...formData, payee: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                Amount
              </label>
              <input
                id="amount"
                type="number"
                required
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-1">
                Currency
              </label>
              <select
                id="currency"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="due_date" className="block text-sm font-medium text-gray-700 mb-1">
                Due Date
              </label>
              <input
                id="due_date"
                type="date"
                required
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as Due['status'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="reference" className="block text-sm font-medium text-gray-700 mb-1">
              Reference (optional)
            </label>
            <input
              id="reference"
              type="text"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
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

          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Save size={20} />
            {editingDue ? 'Update Due' : 'Save Due'}
          </button>
        </form>
      )}

      <div className="space-y-6">
        {Object.entries(groupedDues).map(([group, items]) => {
          if (items.length === 0) return null;

          const labels = {
            overdue: 'Overdue',
            dueSoon: 'Due Soon (Next 14 Days)',
            later: 'Later',
            paid: 'Paid',
          };

          return (
            <div key={group}>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                {labels[group as keyof typeof labels]}
              </h2>
              <div className="space-y-2">
                {items.map((due) => (
                  <div
                    key={due.id}
                    className={`bg-white border rounded-lg p-4 ${
                      group === 'overdue' ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{due.payee}</h3>
                        <p className="text-lg text-gray-700 mt-1">
                          {due.currency} {due.amount.toFixed(2)}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
                          <span>Due: {new Date(due.due_date).toLocaleDateString()}</span>
                          {due.reference && <span>Ref: {due.reference}</span>}
                        </div>
                      </div>
                      {canManageDues && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(due)}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(due.id)}
                            className="text-sm text-red-600 hover:text-red-700 font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {dues.length === 0 && (
          <div className="text-center text-gray-500 py-12 bg-white rounded-lg border border-gray-200">
            <p>No dues yet</p>
            {canManageDues && <p className="text-sm mt-1">Create your first due to get started</p>}
          </div>
        )}
      </div>
    </div>
  );
}

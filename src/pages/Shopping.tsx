import { useState, useEffect } from 'react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Check, X, Archive } from 'lucide-react';
import type { Database } from '../lib/types';

type ShoppingList = Database['public']['Tables']['shopping_lists']['Row'];
type ShoppingItem = Database['public']['Tables']['shopping_items']['Row'];
type WorkspaceMember = Database['public']['Tables']['workspace_members']['Row'];

interface ShoppingListWithItems extends ShoppingList {
  items: ShoppingItem[];
}

export default function Shopping() {
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [lists, setLists] = useState<ShoppingListWithItems[]>([]);
  const [permissions, setPermissions] = useState<WorkspaceMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [newListName, setNewListName] = useState('');
  const [showNewListForm, setShowNewListForm] = useState(false);
  const [newItemNames, setNewItemNames] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (activeWorkspaceId && user) {
      loadData();
    }
  }, [activeWorkspaceId, user]);

  async function loadData() {
    if (!activeWorkspaceId || !user) return;

    try {
      const [permissionsResult, listsResult] = await Promise.all([
        supabase
          .from('workspace_members')
          .select('*')
          .eq('workspace_id', activeWorkspaceId)
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('shopping_lists')
          .select('*')
          .eq('workspace_id', activeWorkspaceId)
          .is('archived_at', null)
          .order('created_at', { ascending: false })
      ]);

      if (permissionsResult.error) throw permissionsResult.error;
      if (listsResult.error) throw listsResult.error;

      setPermissions(permissionsResult.data);

      const listsWithItems = await Promise.all(
        (listsResult.data || []).map(async (list) => {
          const { data: items, error } = await supabase
            .from('shopping_items')
            .select('*')
            .eq('list_id', list.id)
            .order('created_at', { ascending: true });

          if (error) throw error;

          return {
            ...list,
            items: items || []
          };
        })
      );

      setLists(listsWithItems);
    } catch (error) {
      console.error('Error loading shopping data:', error);
      showToast('Failed to load shopping lists', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function createList() {
    if (!activeWorkspaceId || !user || !newListName.trim()) return;

    try {
      const { data, error } = await supabase
        .from('shopping_lists')
        .insert({
          workspace_id: activeWorkspaceId,
          title: newListName.trim(),
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      setLists([{ ...data, items: [] }, ...lists]);
      setNewListName('');
      setShowNewListForm(false);
      showToast('Shopping list created', 'success');
    } catch (error) {
      console.error('Error creating list:', error);
      showToast('Failed to create list', 'error');
    }
  }

  async function archiveList(listId: string) {
    try {
      const { error } = await supabase
        .from('shopping_lists')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', listId);

      if (error) throw error;

      setLists(lists.filter(l => l.id !== listId));
      showToast('List archived', 'success');
    } catch (error) {
      console.error('Error archiving list:', error);
      showToast('Failed to archive list', 'error');
    }
  }

  async function addItem(listId: string) {
    if (!activeWorkspaceId || !user || !newItemNames[listId]?.trim()) return;

    try {
      const { data, error } = await supabase
        .from('shopping_items')
        .insert({
          workspace_id: activeWorkspaceId,
          list_id: listId,
          name: newItemNames[listId].trim(),
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      setLists(lists.map(list =>
        list.id === listId
          ? { ...list, items: [...list.items, data] }
          : list
      ));
      setNewItemNames({ ...newItemNames, [listId]: '' });
      setSuggestions({ ...suggestions, [listId]: [] });
      showToast('Item added', 'success');
    } catch (error) {
      console.error('Error adding item:', error);
      showToast('Failed to add item', 'error');
    }
  }

  async function toggleItem(listId: string, item: ShoppingItem) {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('shopping_items')
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      setLists(lists.map(list =>
        list.id === listId
          ? { ...list, items: list.items.filter(i => i.id !== item.id) }
          : list
      ));
    } catch (error) {
      console.error('Error removing item:', error);
      showToast('Failed to remove item', 'error');
    }
  }

  async function deleteItem(listId: string, itemId: string) {
    try {
      const { error } = await supabase
        .from('shopping_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      setLists(lists.map(list =>
        list.id === listId
          ? { ...list, items: list.items.filter(i => i.id !== itemId) }
          : list
      ));
      showToast('Item deleted', 'success');
    } catch (error) {
      console.error('Error deleting item:', error);
      showToast('Failed to delete item', 'error');
    }
  }

  async function fetchSuggestions(listId: string, input: string) {
    if (!activeWorkspaceId || input.trim().length < 3) {
      setSuggestions({ ...suggestions, [listId]: [] });
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_shopping_suggestions', {
        p_workspace_id: activeWorkspaceId,
        p_prefix: input.trim(),
        p_limit: 10
      });

      if (error) throw error;

      setSuggestions({
        ...suggestions,
        [listId]: (data || []).map((s: { name: string }) => s.name)
      });
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  }

  function handleItemInputChange(listId: string, value: string) {
    setNewItemNames({ ...newItemNames, [listId]: value });
    fetchSuggestions(listId, value);
  }

  function selectSuggestion(listId: string, suggestion: string) {
    setNewItemNames({ ...newItemNames, [listId]: suggestion });
    setSuggestions({ ...suggestions, [listId]: [] });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading shopping lists...</div>
      </div>
    );
  }

  const canAddItems = permissions?.can_add_shopping || permissions?.can_write_shopping;
  const canCheckItems = permissions?.can_check_shopping || permissions?.can_write_shopping;
  const canWriteLists = permissions?.can_write_shopping;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Shopping Lists</h1>
        {canWriteLists && (
          <button
            onClick={() => setShowNewListForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            New List
          </button>
        )}
      </div>

      {showNewListForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Create New List</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createList()}
              placeholder="List name"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            <button
              onClick={createList}
              disabled={!newListName.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={20} />
            </button>
            <button
              onClick={() => {
                setShowNewListForm(false);
                setNewListName('');
              }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {lists.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-gray-500 mb-4">No shopping lists yet</p>
          {canWriteLists && (
            <button
              onClick={() => setShowNewListForm(true)}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Create your first list
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {lists.map((list) => (
            <div key={list.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">{list.title}</h2>
                {canWriteLists && (
                  <button
                    onClick={() => archiveList(list.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Archive list"
                  >
                    <Archive size={18} />
                  </button>
                )}
              </div>

              <div className="space-y-2 mb-3">
                {list.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    {canCheckItems ? (
                      <button
                        onClick={() => toggleItem(list.id, item)}
                        className="flex-shrink-0 w-5 h-5 rounded border-2 border-gray-300 hover:border-green-500 flex items-center justify-center transition-colors"
                      />
                    ) : (
                      <div className="flex-shrink-0 w-5 h-5 rounded border-2 border-gray-300 flex items-center justify-center" />
                    )}
                    <span className="flex-1 text-gray-900">
                      {item.name}
                    </span>
                    {canWriteLists && (
                      <button
                        onClick={() => deleteItem(list.id, item.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 transition-opacity"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {canAddItems && (
                <div className="relative">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newItemNames[list.id] || ''}
                      onChange={(e) => handleItemInputChange(list.id, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addItem(list.id)}
                      placeholder="Add item (type 3+ characters for suggestions)"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                    <button
                      onClick={() => addItem(list.id)}
                      disabled={!newItemNames[list.id]?.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  {suggestions[list.id] && suggestions[list.id].length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {suggestions[list.id].map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => selectSuggestion(list.id, suggestion)}
                          className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!canAddItems && !canCheckItems && (
                <p className="text-sm text-gray-400 italic">
                  You do not have permission to modify this list
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

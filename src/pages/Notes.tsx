import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Plus, X, Save } from 'lucide-react';
import { Database } from '../lib/types';

type Note = Database['public']['Tables']['notes']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

export default function Notes() {
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [showNewNote, setShowNewNote] = useState(false);
  const [formData, setFormData] = useState({
    headline: '',
    body: '',
    category_id: '',
  });

  const fetchNotes = async () => {
    if (!activeWorkspaceId) return;

    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('workspace_id', activeWorkspaceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error: any) {
      showToast(error.message || 'Failed to load notes', 'error');
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
    fetchNotes();
    fetchCategories();
  }, [activeWorkspaceId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceId || !user || !formData.body.trim()) return;

    try {
      if (editingNote) {
        const { error } = await supabase
          .from('notes')
          .update({
            headline: formData.headline || null,
            body: formData.body,
            category_id: formData.category_id || null,
          })
          .eq('id', editingNote.id);

        if (error) throw error;
        showToast('Note updated', 'success');
      } else {
        const { error } = await supabase.from('notes').insert({
          workspace_id: activeWorkspaceId,
          headline: formData.headline || null,
          body: formData.body,
          category_id: formData.category_id || null,
          created_by: user.id,
        });

        if (error) throw error;
        showToast('Note created', 'success');
      }

      setFormData({ headline: '', body: '', category_id: '' });
      setEditingNote(null);
      setShowNewNote(false);
      fetchNotes();
    } catch (error: any) {
      showToast(error.message || 'Failed to save note', 'error');
    }
  };

  const handleEdit = (note: Note) => {
    setEditingNote(note);
    setFormData({
      headline: note.headline || '',
      body: note.body,
      category_id: note.category_id || '',
    });
    setShowNewNote(true);
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      const { error } = await supabase.from('notes').delete().eq('id', noteId);

      if (error) throw error;
      showToast('Note deleted', 'success');
      fetchNotes();
    } catch (error: any) {
      showToast(error.message || 'Failed to delete note', 'error');
    }
  };

  const handleCancel = () => {
    setFormData({ headline: '', body: '', category_id: '' });
    setEditingNote(null);
    setShowNewNote(false);
  };

  if (loading) {
    return <div className="text-center text-gray-600 py-8">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Notes</h1>
        {!showNewNote && (
          <button
            onClick={() => setShowNewNote(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            New Note
          </button>
        )}
      </div>

      {showNewNote && (
        <form onSubmit={handleSave} className="bg-white rounded-lg border border-gray-200 p-6 mb-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingNote ? 'Edit Note' : 'New Note'}
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
            <label htmlFor="headline" className="block text-sm font-medium text-gray-700 mb-1">
              Headline (optional)
            </label>
            <input
              id="headline"
              type="text"
              value={formData.headline}
              onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Note title"
            />
          </div>

          <div>
            <label htmlFor="body" className="block text-sm font-medium text-gray-700 mb-1">
              Body
            </label>
            <textarea
              id="body"
              required
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Write your note..."
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
            {editingNote ? 'Update Note' : 'Save Note'}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {notes.length === 0 ? (
          <div className="text-center text-gray-500 py-12 bg-white rounded-lg border border-gray-200">
            <p>No notes yet</p>
            <p className="text-sm mt-1">Create your first note to get started</p>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              {note.headline && (
                <h3 className="font-semibold text-gray-900 mb-2">{note.headline}</h3>
              )}
              <p className="text-gray-700 whitespace-pre-wrap">{note.body}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                <span className="text-xs text-gray-500">
                  {new Date(note.created_at).toLocaleDateString()}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(note)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

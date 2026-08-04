import { useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../contexts/ToastContext';

import InteractionModal from './interactions/InteractionModal';
import InteractionsList from './interactions/InteractionsList';
import { useCrmInteractions } from './interactions/useCrmInteractions';
import { useCrmInteractionOptions } from './interactions/useCrmInteractionOptions';
import type { InteractionRow } from './interactions/types';

export default function CrmInteractions() {
  const { activeWorkspaceId } = useWorkspace();
  const { showToast } = useToast();

  const { interactions, loading, reload } = useCrmInteractions(activeWorkspaceId, showToast);
  const { contacts, companies } = useCrmInteractionOptions(activeWorkspaceId, showToast);

  const [q, setQ] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InteractionRow | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return interactions;

    return interactions.filter((it) => {
      const hay = [
        it.title,
        it.type,
        it.channel,
        it.note,
        it.next_action,
        it.link,
        it.contact_id,
        it.company_id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return hay.includes(term);
    });
  }, [interactions, q]);

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (row: InteractionRow) => {
    setEditing(row);
    setModalOpen(true);
  };

  const saveInteraction = async (payload: any) => {
    if (!activeWorkspaceId) return;

    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from('crm_interactions')
          .update(payload)
          .eq('workspace_id', activeWorkspaceId)
          .eq('id', editing.id);

        if (error) throw error;
        showToast('Interaction updated', 'success');
      } else {
        const { error } = await supabase.from('crm_interactions').insert({
          workspace_id: activeWorkspaceId,
          ...payload,
        });

        if (error) throw error;
        showToast('Interaction created', 'success');
      }

      setModalOpen(false);
      setEditing(null);
      await reload();
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to save interaction', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteInteraction = async (row: InteractionRow) => {
    if (!activeWorkspaceId) return;

    const ok = confirm('Delete this interaction?');
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('crm_interactions')
        .delete()
        .eq('workspace_id', activeWorkspaceId)
        .eq('id', row.id);

      if (error) throw error;

      showToast('Interaction deleted', 'success');
      await reload();
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to delete interaction', 'error');
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">CRM · Interactions</h1>
          <p className="text-sm text-gray-600 mt-1">
            Log calls, emails, meetings, and next steps.
          </p>
        </div>

        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
        >
          <Plus size={18} />
          New interaction
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2">
          <Search size={18} className="text-gray-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, note, channel, next action…"
            className="w-full px-2 py-2 text-sm focus:outline-none"
          />
          {q.trim() ? (
            <button
              type="button"
              onClick={() => setQ('')}
              className="p-2 rounded-lg hover:bg-gray-100"
              title="Clear"
            >
              <X size={16} className="text-gray-500" />
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="text-gray-600">Loading interactions…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-gray-700">
          No interactions yet.
        </div>
      ) : (
        <InteractionsList
          interactions={filtered}
          contacts={contacts}
          companies={companies}
          onEdit={openEdit}
          onDelete={deleteInteraction}
        />
      )}

      <InteractionModal
        open={modalOpen}
        title={editing ? 'Edit interaction' : 'New interaction'}
        saving={saving}
        contacts={contacts}
        companies={companies}
        initial={editing || undefined}
        onClose={() => {
          if (saving) return;
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={saveInteraction}
      />
    </div>
  );
}
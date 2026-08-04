// src/pages/crm/CrmContactDetail.tsx
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../contexts/ToastContext';

import ContactHeader from './contactDetail/ContactHeader';
import ContactForm from './contactDetail/ContactForm';
import ContactTagsEditor from './contactDetail/ContactTagsEditor';
import ContactInteractions from './contactDetail/ContactInteractions';

import { useCrmCompanies } from './contactDetail/useCrmCompanies';
import { useCrmContact } from './contactDetail/useCrmContact';
import { useCrmContactTags } from './contactDetail/useCrmContactTags';
import { useCrmTags } from './contactDetail/useCrmTags';
import { useCrmContactInteractions } from './contactDetail/useCrmContactInteractions';
import { useCrmDeals } from './contactDetail/useCrmDeals';

import InteractionModal from './interactions/InteractionModal';

type TabKey = 'credentials' | 'interactions';

export default function CrmContactDetail() {
  const { id: contactId } = useParams();
  const navigate = useNavigate();
  const { activeWorkspaceId } = useWorkspace();
  const { showToast } = useToast();

  const [tab, setTab] = useState<TabKey>('credentials');

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tagBusy, setTagBusy] = useState(false);

  // interactions modal state
  const [itModalOpen, setItModalOpen] = useState(false);
  const [itSaving, setItSaving] = useState(false);
  const [itEditing, setItEditing] = useState<any>(null);

  const { companies } = useCrmCompanies(activeWorkspaceId, showToast);
  const { deals } = useCrmDeals(activeWorkspaceId, showToast);

  const {
    loadingContact,
    contact,
    reloadContact,

    companyId,
    setCompanyId,

    associatedDealId,
    setAssociatedDealId,

    leadStatus,
    setLeadStatus,

    firstName,
    setFirstName,
    lastName,
    setLastName,
    email,
    setEmail,
    linkedinUrl,
    setLinkedinUrl,
    phone,
    setPhone,
  } = useCrmContact({
    activeWorkspaceId,
    id: contactId,
    showToast,
    onNotFound: () => navigate('/crm/contacts'),
  }) as any;

  const { tags, reloadTags } = useCrmContactTags(activeWorkspaceId, contactId, showToast);
  const { allTags } = useCrmTags(activeWorkspaceId, showToast);

  const {
    interactions,
    loading: loadingInteractions,
    reload: reloadInteractions,
  } = useCrmContactInteractions(activeWorkspaceId, contactId, showToast);

  const contactOption = useMemo(() => {
    if (!contact) return [];
    return [
      {
        id: contact.id,
        first_name: contact.first_name,
        last_name: contact.last_name,
        email: contact.email,
      },
    ];
  }, [contact]);

  const save = async () => {
    if (!activeWorkspaceId || !contactId) return;

    const fn = firstName.trim() || null;
    const ln = lastName.trim() || null;
    const em = email.trim().toLowerCase() || null;
    const li = linkedinUrl.trim() || null;
    const ph = phone.trim() || null;

    const cid = companyId?.trim() || null;

    const ls = (leadStatus || null) as any;
    const dealId = (associatedDealId || '').trim() || null;

    if (!fn && !ln && !em && !li && !ph) {
      showToast('Add at least a name, email, LinkedIn, or phone.', 'error');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('crm_contacts')
        .update({
          company_id: cid,
          first_name: fn,
          last_name: ln,
          email: em,
          linkedin_url: li,
          phone: ph,

          lead_status: ls,
          associated_deal_id: dealId,
        })
        .eq('workspace_id', activeWorkspaceId)
        .eq('id', contactId);

      if (error) throw error;

      showToast('Contact updated', 'success');
      await reloadContact();
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to update contact', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addTag = async (tagId: string) => {
    if (!activeWorkspaceId || !contactId) return;

    setTagBusy(true);
    try {
      const { error } = await supabase.from('crm_contact_tags').insert({
        workspace_id: activeWorkspaceId,
        contact_id: contactId,
        tag_id: tagId,
      });

      if (error) throw error;
      await reloadTags();
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to add tag', 'error');
    } finally {
      setTagBusy(false);
    }
  };

  const removeTag = async (tagId: string) => {
    if (!activeWorkspaceId || !contactId) return;

    setTagBusy(true);
    try {
      const { error } = await supabase
        .from('crm_contact_tags')
        .delete()
        .eq('workspace_id', activeWorkspaceId)
        .eq('contact_id', contactId)
        .eq('tag_id', tagId);

      if (error) throw error;
      await reloadTags();
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to remove tag', 'error');
    } finally {
      setTagBusy(false);
    }
  };

  const remove = async () => {
    if (!activeWorkspaceId || !contactId) return;

    const ok = confirm(
      'Delete this contact?\n\nNote: interactions for this contact may need to be deleted first if foreign keys enforce integrity.'
    );
    if (!ok) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('crm_contacts')
        .delete()
        .eq('workspace_id', activeWorkspaceId)
        .eq('id', contactId);

      if (error) throw error;

      showToast('Contact deleted', 'success');
      navigate('/crm/contacts');
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to delete contact', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const openNewInteraction = () => {
    if (!contactId) return;
    setItEditing(null);
    setItModalOpen(true);
  };

  const openEditInteraction = (row: any) => {
    setItEditing(row);
    setItModalOpen(true);
  };

  const deleteInteraction = async (row: any) => {
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
      await reloadInteractions();
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to delete interaction', 'error');
    }
  };

  const saveInteraction = async (payload: any) => {
    if (!activeWorkspaceId || !contactId) return;

    const fixedPayload = {
      ...payload,
      contact_id: contactId,
      company_id: payload.company_id || contact?.company_id || null,
    };

    setItSaving(true);
    try {
      if (itEditing?.id) {
        const { error } = await supabase
          .from('crm_interactions')
          .update(fixedPayload)
          .eq('workspace_id', activeWorkspaceId)
          .eq('id', itEditing.id);

        if (error) throw error;
        showToast('Interaction updated', 'success');
      } else {
        const { error } = await supabase.from('crm_interactions').insert({
          workspace_id: activeWorkspaceId,
          ...fixedPayload,
        });

        if (error) throw error;
        showToast('Interaction created', 'success');
      }

      setItModalOpen(false);
      setItEditing(null);
      await reloadInteractions();
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Failed to save interaction', 'error');
    } finally {
      setItSaving(false);
    }
  };

  const loading = loadingContact;

  return (
    <div className="max-w-3xl mx-auto">
      <ContactHeader
        contact={contact}
        tags={tags}
        loading={loading}
        saving={saving}
        deleting={deleting}
        onBack={() => navigate('/crm/contacts')}
        onSave={save}
        onDelete={remove}
        linkedinUrl={linkedinUrl}
      />

      {/* Tabs */}
      <div className="mb-4">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setTab('credentials')}
            className={`px-4 py-2 text-sm font-medium ${
              tab === 'credentials' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            Credentials
          </button>
          <button
            type="button"
            onClick={() => setTab('interactions')}
            className={`px-4 py-2 text-sm font-medium ${
              tab === 'interactions' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            Interactions
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-600">Loading…</div>
      ) : !contact ? (
        <div className="text-gray-700">Contact not found.</div>
      ) : tab === 'credentials' ? (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <ContactTagsEditor
              tags={tags}
              allTags={allTags}
              disabled={tagBusy || saving || deleting}
              onAddTag={addTag}
              onRemoveTag={removeTag}
            />
          </div>

          <ContactForm
            contact={contact}
            companies={companies}
            companyId={companyId}
            setCompanyId={setCompanyId}
            deals={deals}
            associatedDealId={associatedDealId}
            setAssociatedDealId={setAssociatedDealId}
            leadStatus={leadStatus}
            setLeadStatus={setLeadStatus}
            firstName={firstName}
            setFirstName={setFirstName}
            lastName={lastName}
            setLastName={setLastName}
            email={email}
            setEmail={setEmail}
            linkedinUrl={linkedinUrl}
            setLinkedinUrl={setLinkedinUrl}
            phone={phone}
            setPhone={setPhone}
          />
        </div>
      ) : (
        <>
          <ContactInteractions
            loading={loadingInteractions}
            interactions={interactions}
            onNew={openNewInteraction}
            onEdit={openEditInteraction}
            onDelete={deleteInteraction}
          />

          <InteractionModal
            open={itModalOpen}
            title={itEditing ? 'Edit interaction' : 'New interaction'}
            saving={itSaving}
            contacts={contactOption}
            companies={companies}
            initial={
              itEditing
                ? itEditing
                : {
                    contact_id: contactId,
                    company_id: contact.company_id || null,
                  }
            }
            onClose={() => {
              if (itSaving) return;
              setItModalOpen(false);
              setItEditing(null);
            }}
            onSave={saveInteraction}
          />
        </>
      )}
    </div>
  );
}
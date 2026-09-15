import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import QRForm, { buttonClass, inputClass } from '../components/qr/QRForm';
import QRCustomize from '../components/qr/QRCustomize';
import QRPreview from '../components/qr/QRPreview';
import SavedQRList from '../components/qr/SavedQRList';
import { defaultConfiguration, emptyContent, typeLabels, type QRContent, type QRType } from '../lib/qr/types';
import { generateSvg } from '../lib/qr/generator';
import { buildPayload } from '../lib/qr/payloads';
import { restore, saveQR, type QRRecord } from '../lib/qr/persistence';
// Other app tools may navigate('/qr', { state: { qr: { url, name } } }). No sensitive query strings.
export interface QRPrefill { qr?: { url?: string; name?: string } }
export default function QR() {
  const { activeWorkspaceId } = useWorkspace();
  const { user } = useAuth();
  const location = useLocation();
  return activeWorkspaceId && user ? <QRWorkspace key={`${activeWorkspaceId}:${user.id}:${location.key}`} workspaceId={activeWorkspaceId} userId={user.id} prefill={location.state as QRPrefill | null} /> : null;
}
function QRWorkspace({ workspaceId, userId, prefill }: { workspaceId: string; userId: string; prefill: QRPrefill | null }) {
  const { showToast } = useToast();
  const [content, setContent] = useState<QRContent>(() => typeof prefill?.qr?.url === 'string' ? { type: 'url', data: { url: prefill.qr.url } } : emptyContent('url'));
  const [config, setConfig] = useState(defaultConfiguration);
  const [name, setName] = useState(typeof prefill?.qr?.name === 'string' ? prefill.qr.name : '');
  const [saved, setSaved] = useState<QRRecord | null>(null);
  const [tab, setTab] = useState<'create' | 'saved'>('create');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const result = useMemo(() => {
    try { return { payload: buildPayload(content), message: '' }; }
    catch (error) { return { payload: '', message: error instanceof Error ? error.message : 'Check the entered information.' }; }
  }, [content]);
  const change = (value: QRContent) => { setContent(value); setDirty(true); };
  const discard = () => !dirty || window.confirm('Discard your unsaved QR changes?');
  function open(record: QRRecord, duplicate = false) {
    if (!discard()) return;
    try {
      const restored = restore(record);
      setContent(restored.content); setConfig(restored.config); setName(record.name + (duplicate ? ' copy' : '')); setSaved(duplicate ? null : record); setDirty(duplicate); setTab('create');
    } catch { showToast('Unable to open this saved QR. Its data is incomplete or unsupported.', 'error'); }
  }
  async function save() {
    if (!result.payload || busy) return;
    setBusy(true);
    try { await generateSvg(result.payload, config); const record = await saveQR(workspaceId, userId, name, content, config, result.payload, saved); setSaved(record); setDirty(false); showToast('QR saved', 'success'); }
    catch { showToast('Unable to save. Check your connection. If someone edited this QR, reopen it or save a new copy.', 'error'); }
    finally { setBusy(false); }
  }
  return <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
    <header><h1 className="text-2xl font-bold text-gray-900">QR Codes</h1><p className="mt-1 text-sm text-gray-500">Create a QR code. Download it. Ready to use.</p></header>
    <div className="flex gap-2" aria-label="QR views"><button className={buttonClass} disabled={busy} aria-pressed={tab === 'create'} onClick={() => setTab('create')}>Create</button><button className={buttonClass} disabled={busy} aria-pressed={tab === 'saved'} onClick={() => setTab('saved')}>Saved</button></div>
    {tab === 'saved' ? <SavedQRList workspaceId={workspaceId} onOpen={open} /> : <div className="grid items-start gap-6 lg:grid-cols-2">
      <fieldset disabled={busy} className="min-w-0 space-y-5 rounded-xl border border-gray-200 bg-white p-5">
        <legend className="sr-only">Create a QR code</legend>
        <label className="block text-sm font-medium">QR type<select className={inputClass} value={content.type} onChange={e => { if (discard()) { setContent(emptyContent(e.target.value as QRType)); setSaved(null); setDirty(false); } }}>{Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <QRForm content={content} onChange={change} />
        {content.type === 'url' && result.payload && <p className="break-all text-sm text-gray-500">Destination: {result.payload}</p>}
        <QRCustomize config={config} onChange={value => { setConfig(value); setDirty(true); }} />
        <label className="block text-sm font-medium">Name (optional)<input className={inputClass} maxLength={200} value={name} onChange={e => { setName(e.target.value); setDirty(true); }} placeholder="e.g. Tour registration" /></label>
        <div className="flex flex-wrap gap-2"><button className={buttonClass} disabled={!result.payload || busy} onClick={save}>{busy ? 'Saving…' : saved ? 'Save changes' : 'Save to workspace'}</button>{saved && <button className={buttonClass} onClick={() => { setSaved(null); setName(name + ' copy'); setDirty(true); }}>Make a copy</button>}<button className={buttonClass} onClick={() => { if (discard()) { setContent(emptyContent('url')); setSaved(null); setName(''); setConfig(defaultConfiguration); setDirty(false); } }}>New QR</button></div>
        <p className="text-xs text-gray-500">Saving is optional. Static QR codes contain the entered information; changing a saved record does not change an already printed QR.</p>
      </fieldset>
      <QRPreview payload={result.payload} message={result.message} config={config} name={name || (content.type === 'url' ? content.data.url : typeLabels[content.type])} isLink={content.type === 'url' || content.type === 'whatsapp'} />
    </div>}
  </div>;
}

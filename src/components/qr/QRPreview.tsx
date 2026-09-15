import { useEffect, useState } from 'react';
import { generatePng, generateSvg } from '../../lib/qr/generator';
import { download, filename } from '../../lib/qr/download';
import type { QRConfiguration } from '../../lib/qr/types';
import { useToast } from '../../contexts/ToastContext';
import { buttonClass } from './QRForm';
export default function QRPreview({ payload, config, name, message, isLink }: { payload: string; config: QRConfiguration; name: string; message: string; isLink: boolean }) {
  const { showToast } = useToast();
  const [result, setResult] = useState<{ key: string; svg: string; png: Blob } | null>(null);
  const [failure, setFailure] = useState('');
  const key = JSON.stringify([payload, config]);
  useEffect(() => {
    let cancelled = false;
    setFailure('');
    const timer = window.setTimeout(async () => {
      if (!payload) return;
      try {
        const [svg, png] = await Promise.all([generateSvg(payload, config), generatePng(payload, config)]);
        if (!cancelled) setResult({ key, svg, png });
      } catch { if (!cancelled) setFailure('Unable to generate this QR. Try shorter content or lower error correction.'); }
    }, 150);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [payload, config, key]);
  const current = result?.key === key && payload ? result : null;
  const file = current ? new File([current.png], filename(name) + '.png', { type: 'image/png' }) : null;
  const canShare = !!(file && navigator.canShare?.({ files: [file] }));
  const copyImage = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;
  const run = async (action: () => void | Promise<void>, success: string) => {
    try { await action(); if (success) showToast(success, 'success'); }
    catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) showToast('Unable to complete this action. Try downloading the QR instead.', 'error'); }
  };
  return <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-5" aria-label="QR preview">
    <div className="flex min-h-64 items-center justify-center">
      {current ? <img className="h-auto w-full max-w-sm" src={'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(current.svg)} alt="Generated QR code for the entered content" /> : <p className="p-6 text-center text-gray-500" role="status">{failure || message || 'Updating QR…'}</p>}
    </div>
    {payload.length > 1000 && <p className="my-3 text-sm text-amber-800">This QR contains a lot of information. Print it larger and test scanning before use.</p>}
    <div className="mt-5 flex flex-wrap gap-2">
      <button className={buttonClass} disabled={!current} onClick={() => run(() => { if (current) download(current.png, filename(name) + '.png'); }, 'Download ready')}>Download PNG</button>
      <button className={buttonClass} disabled={!current} onClick={() => run(() => { if (current) download(new Blob([current.svg], { type: 'image/svg+xml' }), filename(name) + '.svg'); }, 'Download ready')}>Download SVG</button>
      {copyImage && <button className={buttonClass} disabled={!current} onClick={() => run(() => navigator.clipboard.write([new ClipboardItem({ 'image/png': current!.png })]), 'QR copied')}>Copy QR</button>}
      {isLink && navigator.clipboard?.writeText && <button className={buttonClass} disabled={!current} onClick={() => run(() => navigator.clipboard.writeText(payload), 'Link copied')}>Copy destination</button>}
      {canShare && <button className={buttonClass} onClick={() => run(() => navigator.share({ files: [file!], title: name || 'QR code' }), '')}>Share</button>}
    </div><p className="mt-4 text-xs text-gray-500">PNG: 1024 × 1024 · SVG: vector · Generated on your device</p>
  </section>;
}

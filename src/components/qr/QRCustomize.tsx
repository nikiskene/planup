import { contrast } from '../../lib/qr/generator';
import type { QRConfiguration } from '../../lib/qr/types';
import { inputClass } from './QRForm';
export default function QRCustomize({ config, onChange }: { config: QRConfiguration; onChange: (value: QRConfiguration) => void }) {
  return <details className="rounded-lg border border-gray-200 p-4"><summary className="cursor-pointer font-medium">Customize</summary><div className="mt-4 grid grid-cols-2 gap-4">
    {(['foreground', 'background'] as const).map(key => <label key={key} className="text-sm capitalize">{key}<input className="mt-1 block h-11 w-full" type="color" value={config[key]} onChange={e => onChange({ ...config, [key]: e.target.value })} /></label>)}
    <label className="text-sm">Margin<select className={inputClass} value={config.margin} onChange={e => onChange({ ...config, margin: Number(e.target.value) })}>{[0, 1, 2, 3, 4, 6, 8].map(n => <option key={n}>{n}</option>)}</select></label>
    <label className="text-sm">Error correction<select className={inputClass} value={config.errorCorrectionLevel} onChange={e => onChange({ ...config, errorCorrectionLevel: e.target.value as QRConfiguration['errorCorrectionLevel'] })}>{['L', 'M', 'Q', 'H'].map(n => <option key={n}>{n}</option>)}</select></label>
  </div>{(contrast(config) < 4.5 || config.margin < 4) && <p role="status" className="mt-3 text-sm text-amber-800">For reliable scanning, use a dark foreground, a light background, and a margin of at least 4. Test your customized QR before printing.</p>}</details>;
}

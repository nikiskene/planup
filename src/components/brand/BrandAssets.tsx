import { useEffect, useState } from 'react';

const backgroundImages = [
  'https://zvdraynveyfktpfmoetv.supabase.co/storage/v1/object/public/Assets/wrxsfemale.png',
  'https://zvdraynveyfktpfmoetv.supabase.co/storage/v1/object/public/Assets/wrxsmale.png',
];
const logoUrl = 'https://zvdraynveyfktpfmoetv.supabase.co/storage/v1/object/public/Assets/wrx%20neg%20logo.png';

export function BrandLogo({ className = 'h-9 w-32' }: { className?: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? <span className="text-3xl font-bold tracking-tighter text-white">wrxs.</span> : <img src={logoUrl} alt="wrxs" className={`${className} object-contain`} onError={() => setFailed(true)} />;
}

/** Decorative images stay on their supplied public URLs; no private assets are cached. */
export function BrandBackground() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (backgroundImages.length < 2) return;
    backgroundImages.forEach((url) => { const image = new Image(); image.src = url; });
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer: ReturnType<typeof setInterval> | undefined;
    const schedule = () => {
      if (timer) clearInterval(timer);
      if (!reducedMotion.matches) timer = setInterval(() => setIndex(value => (value + 1) % backgroundImages.length), 7000);
    };
    schedule();
    reducedMotion.addEventListener('change', schedule);
    return () => { if (timer) clearInterval(timer); reducedMotion.removeEventListener('change', schedule); };
  }, []);
  return <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-slate-950">
    {backgroundImages.map((url, imageIndex) => <div key={url} className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 motion-reduce:transition-none" style={{ backgroundImage: `url("${url}")`, opacity: imageIndex === index ? 1 : 0 }} />)}
    <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-slate-950/50" />
  </div>;
}

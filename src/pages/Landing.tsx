import { Link } from 'react-router-dom';
import { ArrowRight, Check, CheckSquare, FileText, Users, Briefcase, QrCode, ShoppingCart, CalendarDays, WifiOff } from 'lucide-react';
import { BrandBackground, BrandLogo } from '../components/brand/BrandAssets';
import { useAuth } from '../contexts/AuthContext';

const features = [
  { icon: CheckSquare, title: 'Know what needs attention', text: 'Bring tasks and relationship follow-ups into one daily view. Set priorities, due dates and reminders, and keep the next action clear.' },
  { icon: FileText, title: 'Give ideas somewhere to go', text: 'Capture notes, organise them by category and link them to tasks. Turn a thought into something you can act on.' },
  { icon: Users, title: 'Remember the relationship', text: 'Keep people and companies together with contact details, tags, relationship stages and conversation history. See who needs a follow-up.' },
  { icon: Briefcase, title: 'Keep opportunities moving', text: 'Track deals alongside your contacts and companies. Record interactions and connect the next task to the conversation that started it.' },
  { icon: CalendarDays, title: 'Stay ahead of recurring dues', text: 'Organise recurring obligations by category, keep track of due dates and record what has been paid.' },
  { icon: QrCode, title: 'Make a useful connection', text: 'Create, customise, save and download static QR codes for links, contact details and more. Printed codes contain their destination directly.' },
  { icon: ShoppingCart, title: 'Share the everyday list', text: 'Keep shared shopping lists, check off items and reuse suggestions. Give someone shopping-only access when that is all they need.' },
  { icon: WifiOff, title: 'Keep writing on the move', text: 'Tasks and notes work offline after an initial sync on that device. Changes wait for your connection; conflicting edits are kept in Lost & Found for review.' },
];

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-stone-50 text-slate-950">
      <main>
      <div className="relative isolate flex min-h-[100svh] flex-col overflow-hidden text-white">
      <BrandBackground />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" aria-label="wrxs home" className="inline-flex"><BrandLogo /></Link>
        <nav aria-label="Main navigation" className="flex items-center gap-5 text-sm font-medium">
          <a href="#features" className="hidden sm:block">Features</a><a href="#pricing">Pricing</a>
          <Link to={user ? '/app' : '/auth'} className="rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-white">{user ? 'Open workspace' : 'Log in'}</Link>
        </nav>
      </header>
        <section className="mx-auto grid w-full max-w-6xl flex-1 content-center gap-8 px-5 py-10 sm:px-6 sm:py-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:gap-12 lg:py-16">
          <div>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-blue-200">A little order. A clearer day.</p>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">Make room for<br />what matters.</h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:mt-6 sm:text-lg">Your tasks, notes, relationships and everyday lists, together in one workspace. wrxs helps you see what needs attention and take the next step.</p>
            <div className="mt-7 flex flex-wrap items-center gap-4 sm:mt-8 sm:gap-5">
              <Link to={user ? '/app' : '/auth?mode=signup'} className="inline-flex items-center gap-2 rounded-full bg-blue-700 px-6 py-3 font-medium text-white hover:bg-blue-800">{user ? 'Open your workspace' : 'Create an account'}<ArrowRight size={18} /></Link>
              <a href="#features" className="text-sm font-medium">Explore the tools ↓</a>
            </div>
            <p className="mt-4 text-xs text-white/70">Create a workspace, then choose monthly or annual billing in Settings.</p>
          </div>
          <div className="rounded-3xl border border-white/25 bg-slate-950/50 p-5 shadow-xl shadow-black/20 backdrop-blur-sm sm:p-6" aria-label="How wrxs works">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">How it works</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">One place to turn input into action.</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {[['Capture', 'Tasks, notes, leads and email.'], ['Focus', 'See what needs attention today.'], ['Move', 'Keep the next step close to the work.']].map(([label, text], index) => <div key={label} className="rounded-2xl border border-white/15 bg-white/10 p-4"><span className="text-xs font-semibold text-blue-200">0{index + 1}</span><h3 className="mt-2 font-medium">{label}</h3><p className="mt-1 text-sm leading-5 text-white/70">{text}</p></div>)}
            </div>
          </div>
        </section>
      </div>
        <section id="features" className="border-y border-stone-200 bg-white px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">The tools</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">From a passing thought to a finished task.</h2>
            <div className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">{features.map(({ icon: Icon, title, text }) => <article key={title}><Icon size={23} className="mb-5 text-blue-700" /><h3 className="text-base font-semibold">{title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{text}</p></article>)}</div>
          </div>
        </section>
        <section className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-2">
          <div><h2 className="text-3xl font-semibold tracking-tight">Your workspace.<br />Your people.</h2><p className="mt-5 max-w-lg leading-7 text-slate-600">Keep separate workspaces for separate contexts. Choose what collaborators can read and change, with roles for full collaboration, viewing and shopping only. Workspace records live behind sign-in and database access rules.</p></div>
          <div className="rounded-3xl border border-stone-200 p-7"><h3 className="font-semibold">Email capture is coming to more workspaces</h3><p className="mt-3 text-sm leading-7 text-slate-600">We are preparing workspace-specific email capture for contact and conversation history. New email addresses and personal Gmail connections are not available yet. Your workspace settings show when an email route has actually been enabled.</p></div>
        </section>
        <section id="pricing" className="bg-slate-950 px-6 py-20 text-white">
          <div className="mx-auto max-w-4xl"><h2 className="text-center text-3xl font-semibold tracking-tight">One plan. Choose your rhythm.</h2><p className="mt-4 text-center text-slate-400">One subscription covers a workspace. Prices are in US dollars.</p>
            <div className="mt-10 grid gap-5 sm:grid-cols-2">{[{ label: 'Monthly', amount: '4', interval: 'month', detail: 'Pay month by month.' }, { label: 'Annual', amount: '40', interval: 'year', detail: 'Save $8 compared with 12 monthly payments.' }].map(plan => <div key={plan.label} className="rounded-3xl border border-slate-700 p-8"><h3 className="text-lg font-medium">{plan.label}</h3><p className="mt-5"><span className="text-5xl font-semibold">${plan.amount}</span><span className="text-slate-400"> / {plan.interval}</span></p><p className="mt-4 text-sm text-slate-400">{plan.detail}</p><p className="mt-7 flex gap-2 text-sm"><Check size={18} /> All core workspace tools</p><Link to={user ? '/settings' : '/auth?mode=signup'} className="mt-7 block rounded-xl bg-white px-4 py-3 text-center text-sm font-medium text-slate-950">{user ? 'Choose in Settings' : 'Get started'}</Link></div>)}</div>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-slate-500"><Link to="/" className="text-xl font-bold tracking-tighter text-slate-950">wrxs.</Link><span>Tasks, notes, relationships. A clearer day.</span><span className="flex gap-4"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/legal-notice">Legal notice</Link><Link to={user ? '/app' : '/auth'}>{user ? 'Open workspace' : 'Log in'} →</Link></span></footer>
    </div>
  );
}

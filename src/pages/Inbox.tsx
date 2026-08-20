//src/pages/Inbox.tsx

import { ArrowRight, CheckSquare, HandCoins, NotebookPen, ShoppingCart, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

const actions = [
  { title: 'Tasks', detail: 'What needs to get done.', href: '/tasks', icon: CheckSquare },
  { title: 'Opportunities', detail: 'What may be worth pursuing.', href: '/crm/deals', icon: HandCoins },
  { title: 'Leads', detail: 'People, companies and relationship history.', href: '/crm/contacts', icon: Users },
  { title: 'Notes', detail: 'Things worth remembering.', href: '/notes', icon: NotebookPen },
];

export default function Inbox() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Home</p>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-950">What needs your attention?</h1>
          <p className="mt-2 max-w-xl text-sm text-gray-500">The planner should reduce administration, not create it. Choose where you want to work.</p>
        </div>
        <Link to="/shopping" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <ShoppingCart size={17} /> Shopping List
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map((action) => (
          <Link key={action.href} to={action.href} className="group rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-gray-300 hover:shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700"><action.icon size={19} /></div>
                <div>
                  <h2 className="font-semibold text-gray-950">{action.title}</h2>
                  <p className="mt-1 text-sm text-gray-500">{action.detail}</p>
                </div>
              </div>
              <ArrowRight size={18} className="mt-2 text-gray-300 transition group-hover:translate-x-1 group-hover:text-gray-700" />
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-950 p-5 text-white">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Automatic CRM</div>
        <div className="mt-2 text-lg font-medium">Keep working in email.</div>
        <p className="mt-1 text-sm leading-relaxed text-gray-300">BCC crm@iacy.com. The conversation is captured in the CRM without another input interface.</p>
      </div>
    </div>
  );
}

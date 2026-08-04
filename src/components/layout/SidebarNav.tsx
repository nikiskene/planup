//src/components/layout/SidebarNav.tsx

import { NavLink } from 'react-router-dom';
import type { NavItem } from './navTypes';

type Props = { homeItems: NavItem[]; workItems: NavItem[] };

function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
  return (
    <div className="space-y-1">
      <div className="px-3 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">{label}</div>
      {items.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
              isActive ? 'bg-gray-950 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950'
            }`
          }
        >
          <item.icon size={18} />
          <span className="text-sm font-medium">{item.label}</span>
        </NavLink>
      ))}
    </div>
  );
}

export default function SidebarNav({ homeItems, workItems }: Props) {
  return (
    <aside className="sticky top-[57px] hidden min-h-[calc(100vh-57px)] w-60 border-r border-gray-200 bg-white lg:block">
      <nav className="space-y-5 p-4">
        <NavGroup label="Home" items={homeItems} />
        <NavGroup label="Work" items={workItems} />
        <div className="mx-3 border-t border-gray-100" />
        <div className="px-3 text-xs leading-relaxed text-gray-400">
          BCC <span className="font-medium text-gray-600">crm@iacy.com</span> on email. People and conversations update automatically.
        </div>
      </nav>
    </aside>
  );
}

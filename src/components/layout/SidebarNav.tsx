import { NavLink } from 'react-router-dom';
import type { NavItem } from './navTypes';

export default function SidebarNav({
  mainItems,
  secondaryItems = [],
}: {
  mainItems: NavItem[];
  secondaryItems?: NavItem[];
}) {
  const renderItem = (item: NavItem) => (
    <NavLink
      key={item.href}
      to={item.href}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
          isActive
            ? 'bg-gray-950 text-white'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950'
        }`
      }
    >
      <item.icon size={18} />
      <span className="font-medium text-sm">{item.label}</span>
    </NavLink>
  );

  return (
    <aside className="hidden lg:block w-60 bg-white border-r border-gray-200 min-h-[calc(100vh-57px)] sticky top-[57px]">
      <nav className="p-4 space-y-1">
        <div className="px-3 pt-2 pb-4 text-[11px] uppercase tracking-[0.18em] text-gray-400 font-semibold">
          Your work
        </div>

        {mainItems.map(renderItem)}

        {secondaryItems.length > 0 && (
          <>
            <div className="mx-3 my-5 border-t border-gray-100" />

            <div className="px-3 pb-2 text-[11px] uppercase tracking-[0.18em] text-gray-400 font-semibold">
              CRM archive
            </div>

            {secondaryItems.map(renderItem)}
          </>
        )}

        <div className="mx-3 my-5 border-t border-gray-100" />

        <div className="px-3 text-xs leading-relaxed text-gray-400">
          BCC <span className="font-medium text-gray-500">crm@iacy.com</span>.
          {' '}The CRM updates itself.
        </div>
      </nav>
    </aside>
  );
}
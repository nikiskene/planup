import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, Users } from 'lucide-react';
import type { NavItem } from './navTypes';

export default function CrmNavSection({ items }: { items: NavItem[] }) {
  const location = useLocation();
  const isCrmRoute = useMemo(() => location.pathname.startsWith('/crm'), [location.pathname]);

  const [open, setOpen] = useState(true);

  // If user navigates directly to /crm/*, auto-open the section
  useEffect(() => {
    if (isCrmRoute) setOpen(true);
  }, [isCrmRoute]);

  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <span className="flex items-center gap-3">
          <Users size={20} />
          <span className="font-medium">CRM</span>
        </span>
        <ChevronDown
          size={16}
          className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="mt-1 space-y-1 pl-2">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              <item.icon size={18} />
              <span className="text-sm font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
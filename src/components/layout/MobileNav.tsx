//src/components/layout/MobileNav.tsx

import { NavLink } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import type { NavItem } from './navTypes';

type Props = {
  mainItems: NavItem[];
  secondaryItems?: NavItem[];
};

export default function MobileNav({
  mainItems,
  secondaryItems = [],
}: Props) {
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryItems = mainItems.slice(0, 4);
  const remainingMainItems = mainItems.slice(4);

  const moreItems = [
    ...remainingMainItems,
    ...secondaryItems,
  ];

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-[73px] left-3 right-3 rounded-3xl border border-gray-200 bg-white p-3 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
              More
            </div>

            <div className="space-y-1">
              {moreItems.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                      isActive
                        ? 'bg-gray-950 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                >
                  <item.icon size={18} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white lg:hidden">
        <div className="grid h-[73px] grid-cols-5">
          {primaryItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition ${
                  isActive
                    ? 'text-gray-950'
                    : 'text-gray-400'
                }`
              }
            >
              <item.icon size={19} />
              <span className="max-w-[68px] truncate">
                {item.label}
              </span>
            </NavLink>
          ))}

          <button
            type="button"
            onClick={() => setMoreOpen((value) => !value)}
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition ${
              moreOpen
                ? 'text-gray-950'
                : 'text-gray-400'
            }`}
          >
            <MoreHorizontal size={20} />
            More
          </button>
        </div>
      </nav>
    </>
  );
}
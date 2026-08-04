//src/components/Layout.tsx

import type { ReactNode } from 'react';
import WorkspaceMenu from './layout/WorkspaceMenu';
import SidebarNav from './layout/SidebarNav';
import MobileNav from './layout/MobileNav';
import {
  NAV_ITEMS,
  SECONDARY_NAV_ITEMS,
} from './layout/navConfig';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0">
      <header className="sticky top-0 z-40 h-[57px] border-b border-gray-200 bg-white">
        <div className="flex h-full items-center justify-between px-4 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-950 text-sm font-semibold text-white">
              EP
            </div>

            <div>
              <div className="text-sm font-semibold leading-tight text-gray-950">
                Efficiency Planner
              </div>
              <div className="text-[11px] leading-tight text-gray-400">
                Relationship intelligence
              </div>
            </div>
          </div>

          <WorkspaceMenu />
        </div>
      </header>

      <div className="flex">
        <SidebarNav
          mainItems={NAV_ITEMS}
          secondaryItems={SECONDARY_NAV_ITEMS}
        />

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      <MobileNav
        mainItems={NAV_ITEMS}
        secondaryItems={SECONDARY_NAV_ITEMS}
      />
    </div>
  );
}
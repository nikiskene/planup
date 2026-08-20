// src/pages/crm/LeadsPage.tsx
import type { ReactNode } from 'react';
import { Building2, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';

type Props = { children: ReactNode; view: 'people' | 'companies' };

export default function LeadsPage({ children, view }: Props) {
  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-2 px-4 py-2 text-sm font-medium ${
      active ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'
    }`;

  return (
    <div>
      <div className="max-w-5xl mx-auto mb-5">
        <h1 className="text-3xl font-semibold text-gray-900">Leads</h1>
        <p className="mt-1 text-sm text-gray-600">Manage people and the companies they work with.</p>
        <nav className="mt-4 inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white">
          <NavLink to="/crm/contacts" className={tabClass(view === 'people')}>
            <Users size={17} /> People
          </NavLink>
          <NavLink to="/crm/companies" className={`${tabClass(view === 'companies')} border-l border-gray-200`}>
            <Building2 size={17} /> Companies
          </NavLink>
        </nav>
      </div>
      {children}
    </div>
  );
}

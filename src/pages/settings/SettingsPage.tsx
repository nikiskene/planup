// src/pages/settings/SettingsPage.tsx
import type { ReactNode } from 'react';
import LeadTagsSettings from './LeadTagsSettings';

export default function SettingsPage({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <div className="mx-auto mt-6 max-w-3xl">
        <LeadTagsSettings />
      </div>
    </>
  );
}

// src/pages/settings/SettingsPage.tsx
import type { ReactNode } from 'react';
import LeadTagsSettings from './LeadTagsSettings';
import RelationshipStatusesSettings from './RelationshipStatusesSettings';

export default function SettingsPage({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <div className="mx-auto mt-6 max-w-3xl">
        <div className="space-y-6">
          <LeadTagsSettings />
          <RelationshipStatusesSettings />
        </div>
      </div>
    </>
  );
}

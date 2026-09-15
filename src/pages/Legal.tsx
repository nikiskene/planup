import { Link } from 'react-router-dom';

const updated = '15 September 2026';

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="min-h-screen bg-stone-50 px-5 py-10 text-slate-900 sm:px-8">
    <div className="mx-auto max-w-3xl">
      <header className="flex items-center justify-between border-b border-stone-200 pb-6">
        <Link to="/" className="text-3xl font-bold tracking-tighter">wrxs<span className="text-blue-700">.</span></Link>
        <Link to="/" className="text-sm text-blue-700">Back to home</Link>
      </header>
      <article className="prose prose-slate mt-10 max-w-none prose-headings:tracking-tight prose-a:text-blue-700">
        <h1>{title}</h1><p className="lead">Last updated: {updated}</p>{children}
      </article>
      <footer className="mt-14 border-t border-stone-200 py-6 text-sm text-slate-500"><Link to="/privacy">Privacy</Link><span className="mx-3">·</span><Link to="/terms">Terms</Link><span className="mx-3">·</span><Link to="/legal-notice">Legal notice</Link><span className="mx-3">·</span><a href="mailto:wrxs@iacy.com">wrxs@iacy.com</a></footer>
    </div>
  </main>;
}

export function LegalNotice() {
  return <Shell title="Legal notice"><p>wrxs is operated by IACy International FZCO, Dubai Airport Free Zone, Building 9W, Block C, Office 523, 68 9WC 523, Dubai, United Arab Emirates.</p><p>Contact: <a href="mailto:wrxs@iacy.com">wrxs@iacy.com</a>.</p><p>Managing representative where required: Nikolaus Skene.</p><p>This notice applies to wrxs.cc and the wrxs web application.</p></Shell>;
}

export function Privacy() {
  return <Shell title="Privacy notice">
    <h2>Who controls your data</h2><p>IACy International FZCO is the controller for personal data processed to provide wrxs. Contact us at <a href="mailto:wrxs@iacy.com">wrxs@iacy.com</a>. We have not appointed a data protection officer; use this address for privacy requests.</p>
    <h2>What we process</h2><p>We process account details such as email address and name; workspace membership and permission details; the tasks, notes, contacts, companies, interactions, QR records and other content you or your collaborators add; technical and security information needed to operate the service; and, when billing is available, subscription and Stripe customer identifiers. Card details are handled by Stripe and are not stored in wrxs.</p>
    <h2>Why we process it</h2><p>We process account, workspace and service content to perform our contract with you and provide the requested service. We process security, access-control and reliability information for our legitimate interests in keeping the service secure and functioning. We process billing information to perform the subscription contract and meet applicable accounting or tax obligations. Where consent is required by law, we ask for it separately and you may withdraw it at any time.</p>
    <h2>Who receives data</h2><p>We use service providers to host and operate wrxs, including Supabase for authentication and database services, Netlify for web delivery, and Stripe for subscription payments when enabled. Providers receive only the information needed for their service. They may process information outside the European Economic Area; where applicable, transfers are made using an adequacy decision or appropriate safeguards such as standard contractual clauses.</p>
    <h2>Retention</h2><p>We keep account and workspace content while the account or workspace remains active. We delete or anonymise it when it is no longer needed to provide the service, resolve disputes, prevent abuse, or meet legal retention duties. Billing records may be retained for the period required by applicable law. You can request deletion at any time; deleting a workspace may remove shared content for all its members.</p>
    <h2>Your rights</h2><p>If the GDPR applies to you, you may request access, correction, deletion, restriction, portability, or object to processing based on legitimate interests. You may withdraw consent where processing is based on consent. Contact <a href="mailto:wrxs@iacy.com">wrxs@iacy.com</a>. You may also complain to the data-protection authority in your habitual residence, place of work, or the place of the alleged infringement.</p>
    <h2>Cookies and local storage</h2><p>wrxs uses essential browser storage for sign-in, workspace selection, offline work and service operation. We do not currently use advertising or analytics cookies. If we add optional cookies or similar tracking, we will request consent where required before enabling them.</p>
    <h2>Children and changes</h2><p>wrxs is not intended for children. If we materially change this notice, we will publish the new version here and update its date.</p>
  </Shell>;
}

export function Terms() {
  return <Shell title="Terms of service">
    <h2>Service and agreement</h2><p>These terms govern your use of wrxs, operated by IACy International FZCO. By creating an account, using the service, or purchasing a subscription, you agree to these terms and the <Link to="/privacy">Privacy notice</Link>. If you use wrxs for an organisation, you confirm that you can accept these terms for it.</p>
    <h2>Accounts and workspaces</h2><p>Keep your sign-in details secure and provide accurate account information. You are responsible for activity in your account and for choosing appropriate workspace members and permissions. Do not use wrxs unlawfully, interfere with its operation, attempt unauthorised access, or upload content that violates others’ rights.</p>
    <h2>Your content</h2><p>You retain ownership of the content you add. You give us the limited permission needed to host, process, back up and display that content to you and the collaborators you authorise. You are responsible for ensuring you have the right to add personal data and content to a workspace.</p>
    <h2>Subscriptions, renewal and cancellation</h2><p>When checkout is available, the displayed subscription price is in US dollars: USD 4 per month or USD 40 per year, plus any taxes Stripe is required to collect. Subscriptions renew automatically for the selected period unless cancelled through the Stripe customer portal before the next renewal. We may change prices for future renewal periods with advance notice where required by law. Payment processing is provided by Stripe.</p>
    <h2>Consumer rights</h2><p>Nothing in these terms removes mandatory consumer rights. If you are an EU consumer, you may have a 14-day right of withdrawal for a distance contract. Before paid digital service starts during that period, checkout will present any consent and acknowledgement required for early performance. Contact <a href="mailto:wrxs@iacy.com">wrxs@iacy.com</a> to exercise a withdrawal right or ask a billing question.</p>
    <h2>Availability, suspension and ending access</h2><p>We aim to keep wrxs available but do not promise uninterrupted or error-free operation. We may suspend access where reasonably necessary for security, maintenance, legal compliance, or misuse. You may stop using wrxs at any time. We may end access for a material breach, non-payment, or where required by law, subject to any mandatory notice obligations.</p>
    <h2>Liability and changes</h2><p>To the maximum extent permitted by law, wrxs is provided without warranties not expressly stated here, and IACy International FZCO is not liable for indirect or consequential loss. This does not limit liability that cannot lawfully be excluded, including mandatory consumer protections. We may update these terms for legal, security or service changes; material changes will be notified through the service or by email where appropriate.</p>
    <h2>Contact and law</h2><p>For support or legal notices, contact <a href="mailto:wrxs@iacy.com">wrxs@iacy.com</a>. These terms are governed by the law applicable to IACy International FZCO, without limiting mandatory protections available to consumers in their country of residence.</p>
  </Shell>;
}

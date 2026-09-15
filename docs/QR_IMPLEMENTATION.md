# QR Codes — local implementation report

## Implemented

Authenticated `/qr` route through AppPage, existing desktop/mobile navigation, and the shopping-only route guard. Eight static QR types: Website, Text, Email, Phone, WhatsApp, Wi-Fi, Contact, Event. Debounced preview; 1024px PNG and genuine SVG export; filename sanitization; colors, margin, error correction and contrast warning; supported-browser image/link copy and file sharing.

Saved records support workspace ownership, open/edit/rename, duplicate, download from the editor, and confirmed deletion. Saves are explicit, online-only, and use an updated_at condition to avoid silently overwriting another editor. The migration must be applied before saving works. The existing Tasks/Notes offline queue is unchanged.

Local content generation and downloads make no network requests. Unsaved inputs remain in React state. Existing application authentication and workspace loading still use the established application infrastructure. Wi-Fi credentials are uploaded only when the user saves that QR and then are visible to authorized members of that workspace.

## Files added

- src/pages/QR.tsx
- src/components/qr/QRForm.tsx
- src/components/qr/QRCustomize.tsx
- src/components/qr/QRPreview.tsx
- src/components/qr/SavedQRList.tsx
- src/lib/qr/types.ts
- src/lib/qr/payloads.ts
- src/lib/qr/generator.ts
- src/lib/qr/download.ts
- src/lib/qr/persistence.ts
- src/lib/qr/payloads.test.ts
- supabase/migrations/20260915_create_qr_codes.sql
- docs/QR_IMPLEMENTATION.md

## Files modified

- src/App.tsx: /qr route
- src/components/layout/navConfig.ts: QR Codes entry using Lucide QrCode
- package.json and package-lock.json: QR generation dependency and TypeScript declarations

## Dependencies

qrcode 1.5.4 is the sole generation library; @types/qrcode 1.5.6 provides development types. The same engine produces the preview and both exports. See the [library documentation](https://www.npmjs.com/package/qrcode?activeTab=readme).

## Database

Migration creates public.qr_codes, a workspace/creation index, membership-based SELECT/INSERT/UPDATE/DELETE policies excluding only_shopping users, creator validation, immutable ownership, and a server-managed update timestamp. Anonymous access is not granted. No image binaries are stored. Optional source_type/source_id reserve future object associations.

Deployment status: migration prepared only, not executed. Live schema and effective RLS behavior have not been verified. Before applying, verify the deployed workspace_members.only_shopping column and membership policies. After applying, verify normal member CRUD, cross-workspace denial, shopping-only denial, anonymous denial, and stale-update rejection with representative accounts.

## Static QR

Implementation complete locally; payload and SVG tests pass. Browser PNG, phone scanning, mobile layout, clipboard/share, and authenticated persistence remain unverified. Event dates intentionally use floating local times, explained in the form; they retain entered wall-clock values in the importing calendar. This follows [iCalendar floating-time semantics](https://www.rfc-editor.org/rfc/rfc5545#section-3.3.5). Payload escaping follows [ZXing's QR content documentation](https://github.com/zxing/zxing/wiki/Barcode-Contents).

## Dynamic QR

Architecture prepared, not implemented. Payload generation, rendering, and persistence are separated, but there is no public redirect endpoint, dynamic record schema, editable printed destination, or scan analytics. Current Netlify hosting serves a static SPA; a safe public backend contract would require separate implementation and verification.

## Tests

- npm test: 46 tests pass, including 18 QR tests.
- npm run typecheck: 28 existing errors; before and after output identical.
- npm run lint: 132 errors and 10 warnings, same totals as baseline; focused QR lint passes.
- npm run build: passes, including PWA precaching; Vite reports a bundle-size warning.
- git diff --check: passes.

QR tests cover all eight types, URL scheme rejection and normalization, exact multiline text, email parameter encoding, international WhatsApp numbers, Wi-Fi punctuation, vCard escaping, calendar dates and invalid ranges, UTF-8 line folding, empty input, vector output, oversized content, and filenames.

Browser verification was blocked because the browser tool could not verify an administrator-enforced policy. No browser-security bypass was attempted. No physical phone scan was performed.

## Manual test

1. Start PlanUp locally, sign in, and choose a normal workspace. Open `/qr` or click **QR Codes** (on mobile: **More → QR Codes**).
2. Enter `https://example.com`; confirm the preview appears. Download PNG and SVG, open them, and scan with iPhone/Android. Confirm the intended URL. Repeat with `example.com`.
3. Choose Wi-Fi, enter a test network and password containing punctuation, and scan with a compatible phone. Verify no QR request is sent over the network while editing.
4. Choose Contact; enter a name and contact details. Scan and check the imported fields.
5. Choose Event; enter title, start/end dates and times. Scan and verify the dates and times in the importing calendar.
6. With the page loaded, disconnect the network and repeat creation and both downloads.
7. After the migration is applied, reconnect, name a QR, click **Save to workspace**, then **Saved**. Open it, rename/edit/save, duplicate it, and delete the test records. Verify another workspace cannot see them.
8. Check a phone-width screen, keyboard navigation, a shopping-only account, and optional clipboard/share support.

## Remaining

Release path: push to GitHub main to trigger Netlify automatic deployment. The database migration is separate and has not been applied. Apply/verify the migration and run authenticated/phone QA before considering the feature fully released. Logo support, saved-record offline sync, actual object actions, and dynamic redirects are deferred. Existing type/lint debt remains outside this change.

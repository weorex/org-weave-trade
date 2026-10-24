# Phase 5 — Separate Chrome capture extension

## Delivered
- Separate TypeScript Manifest V3 extension in `extension/`, not embedded browsing capture in the web app.
- Explicit active-tab DOM extraction of company name/address, accessible email/phone links, product cards and HTML tables. No automatic/background/history capture.
- Organization and metadata-driven entity selection, typed editable fields, relationship choices, source URL editing, table-column mapping, selected product rows and named contacts.
- Advisory duplicate company/SKU indicators; non-overwriting authoritative duplicate checks in the atomic capture RPC.
- User-approved connection with exact stable extension callback and random state. Fifteen-minute encrypted capture-only credentials stored in trusted session storage; no privileged keys or app bearer exposed to the extension.
- Authenticated HTTP capture API revalidates identity, active tenant membership, latest configuration, dynamic Zod fields, relationship targets and trade permissions.
- `data_captures` with tenant/actor/request idempotency, stored payload comparison, immutable history grants, tenant foreign keys and protected capture audit trigger.
- Build command: `bun run extension/build.ts`; output `extension/dist`, packaged and inspected ZIP `public/weorex-capture.zip`.
- Dashboard Browser capture link opens download, approval and installation instructions.

## Verified
- Standalone extension TypeScript check and production build passed; ZIP entries inspected.
- Actual unpacked MV3 popup loaded in headless Chromium, with pre-connection selectors disabled.
- Signed-in approval issued an opaque capture-only credential; authenticated organization enumeration and empty dynamic configuration read returned successfully.
- Authenticated foreign organization request returned 403; missing credential returned 401.
- Browser download returned `weorex-capture.zip`; installation page rendered correctly.
- Capture privacy, field/table limits, selection mapping, callback allowlist, expiry, tampering and raw-bearer denial tests passed.
- Live database checks confirmed `data_captures` exists, anonymous access is revoked, authenticated update/delete revoked, audit insertion denied and RPC execution restricted to authenticated.

## Incomplete verification and limits
- Full populated capture/save/readback flow is not verified: all four current organizations have no configured entity types. No invented business entities/products/contacts were saved.
- `src/test/capture-postgres.sql` is a rollback-only atomicity/idempotency/duplicate/audit test. It could not execute because sandbox SQL role lacks permission to call the authenticated-only RPC. Do not widen production grants to run it. Needs a database testing context capable of the authenticated role.
- End-to-end extension identity window plus production API is not verified: the web app is not published. The fixed production host must be published before extension Connect works for users.
- Duplicate preview is advisory; SKU preview covers the first 1,000 SKUs. The RPC checks the whole tenant catalogue. Company matching is heuristic, not legal-entity identity verification; direct inserts outside the capture RPC can race company/contact detection. Existing unique SKU constraints remain authoritative.
- Capture history is stored and audited, but a dedicated history-management UI, undo/delete workflow, extension-store publishing, shadow-DOM/image/OCR capture and automatic token refresh are not included.
- Source paths may contain sensitive data; users can edit the source URL before saving. Queries/fragments/embedded credentials are automatically removed.
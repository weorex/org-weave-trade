# Phase 1
- [x] Fix onboarding address validation, lowercase country codes, and dashboard entry after organization creation; verified real organization creation and dashboard refresh.
- [x] Apply organization foundation and secure access policies.
- [x] Add real sign-in, user profiles, and organization onboarding.
- [x] Build dashboard and organization switching with typed services.
- [x] Run unit tests, public access checks, and live privilege checks; document incomplete functionality in PHASE1.md.
- [ ] Verify organization switching and cross-tenant read/write denial. Creation and dashboard refresh verified; blocker: no second real organization/account membership exists.

# Phase 2
- [x] Apply immutable entity configuration versions, shared records, permissions, and tenant-safe relationships.
- [x] Build typed validation, reusable forms/details/tables, builder, preview, and version history.
- [x] Test multiple entity types, shared forms, data preservation, membership isolation, and permissions; 32 tests pass and live grants are verified.
- [ ] Verify authenticated publication, record flows, organization switching, and live cross-tenant read/write denial. Blocker: no real entity records or second organization exist.

# Phase 3
- [x] Add tenant-safe trade catalogue, supplier links, contacts, relationships, manufacturer profiles, and immutable price history.
- [x] Build catalogue and profile screens, duplicate detection, CSV import/export, filters and pagination.
- [x] Test relationship constraints and price history in rollback-only PostgreSQL tests; validate CSV, currencies, dates, duplicates and permissions in unit tests.
- [ ] Verify populated signed-in catalogue/profile/link/quote/import/export flows and authenticated RLS/RPC tests. Blockers: no real entity records; sandbox SQL connection cannot impersonate authenticated role. See PHASE3.md.

# Phase 4
- [x] Add tenant-isolated routes, immutable shipping/transport rates, vehicles, service areas, documents, and activity history.
- [x] Build shared logistics profiles and workspace with filters and relationships.
- [x] Test logistics validation, historical rates, tenant-key isolation and signed-in port/activity flows; report gaps in PHASE4.md.
- [ ] Verify populated profiles, shipping routes, vehicles, transport quotes and document uploads in the browser. Blocker: no real logistics entity records or partner/quote/document details have been provided.

# Phase 5
- [ ] Build separate TypeScript Manifest V3 capture extension with explicit capture, field editing, table mapping and selected rows.
- [ ] Add authenticated pairing and capture operations, tenant checks, server validation, duplicate handling, atomic idempotency and audit history.
- [ ] Package buildable source and installable ZIP; add installation instructions and run extension/API/database tests.
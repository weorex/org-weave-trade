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
- [ ] Add tenant-isolated routes, immutable shipping/transport rates, vehicles, service areas, documents, and activity history.
- [ ] Build shared logistics profiles and workspace with filters and relationships.
- [ ] Test logistics validation, historical rates, tenant isolation, and signed-in flows; report verification gaps.
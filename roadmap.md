# Phase 1
- [x] Apply organization foundation and secure access policies.
- [x] Add real sign-in, user profiles, and organization onboarding.
- [x] Build dashboard and organization switching with typed services.
- [x] Run unit tests, public access checks, and live privilege checks; document incomplete functionality in PHASE1.md.
- [ ] Verify signed-in creation, switching, and cross-tenant read/write denial. Blocker: confirmed account exists but has no organizations; real organization onboarding is required.

# Phase 2
- [x] Apply immutable entity configuration versions, shared records, permissions, and tenant-safe relationships.
- [x] Build typed validation, reusable forms/details/tables, builder, preview, and version history.
- [x] Test multiple entity types, shared forms, data preservation, membership isolation, and permissions; 32 tests pass and live grants are verified.
- [ ] Verify authenticated publication, record flows, organization switching, and live cross-tenant read/write denial. Blocker: no real organizations/entity records exist; real onboarding is required.

# Phase 3
- [x] Add tenant-safe trade catalogue, supplier links, contacts, relationships, manufacturer profiles, and immutable price history.
- [x] Build catalogue and profile screens, duplicate detection, CSV import/export, filters and pagination.
- [x] Test relationship constraints and price history in rollback-only PostgreSQL tests; validate CSV, currencies, dates, duplicates and permissions in unit tests.
- [ ] Verify populated signed-in catalogue/profile/link/quote/import/export flows and authenticated RLS/RPC tests. Blockers: no real organization/entity records; sandbox SQL connection cannot impersonate authenticated role. See PHASE3.md.
# Phase 1
- [x] Apply organization foundation and secure access policies.
- [x] Add real sign-in, user profiles, and organization onboarding.
- [x] Build dashboard and organization switching with typed services.
- [x] Run unit tests, public access checks, and live privilege checks; document incomplete functionality in PHASE1.md.
- [ ] Verify signed-in creation, switching, and cross-tenant read/write denial. Blocker: no confirmed auth account exists; user must create and confirm their first account.

# Phase 2
- [x] Apply immutable entity configuration versions, shared records, permissions, and tenant-safe relationships.
- [x] Build typed validation, reusable forms/details/tables, builder, preview, and version history.
- [x] Test multiple entity types, shared forms, data preservation, membership isolation, and permissions; 32 tests pass and live grants are verified.
- [ ] Verify authenticated publication, record flows, organization switching, and live cross-tenant read/write denial. Blocker: no real auth users exist; a confirmed account is required.

# Phase 3
- [ ] Add tenant-safe trade catalogue, supplier links, contacts, relationships, manufacturer profiles, and immutable price history.
- [ ] Build catalogue and profile screens, duplicate detection, CSV import/export, filters and pagination.
- [ ] Test relationship constraints, currency history, import validation and permissions; verify authenticated flows when a real account is available.
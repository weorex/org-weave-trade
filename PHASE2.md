# Phase 2 — Entity Type Builder

## Implemented
- Four shared tables: `entity_types`, `entity_field_definitions`, `entity_type_layouts`, and `entities`. No per-type database tables or React pages.
- Immutable, atomically published configuration versions; optimistic publish and record-edit concurrency checks.
- Custom text, textarea, number, boolean, date, email, URL, select, and single-record relationship fields. Zod validates configuration and record values on both client and server; database triggers validate direct record writes.
- Configurable form/detail field order, table columns, filter fields, detail tabs, and member read/create/update/delete permissions. Organization owners/admins retain configuration management and record access.
- Interactive form/detail/table preview, historical configuration browsing, and restoration as a new version.
- Shared record creation, editing, details, relationship navigation, search, sorting, contains/equality/numeric filters, table pagination, and confirmed deletion. Referenced records cannot be deleted.
- Records remain pinned to the version under which they were created. Older records use their original forms and validation; retired values are preserved on edits. Changes apply to new records; there is no automatic destructive migration of older data.
- Every entity request resolves active organization membership. Composite configuration references, user-scoped clients, row-level policies, and same-organization relationship checks enforce isolation. Direct configuration writes and updates to record organization/type/version are denied.

## Verification
- Unit tests cover two entity types, required/email/numeric/select/date validation, layout validity, relationship configuration, data preservation, active organization access, and per-type permissions.
- Shared React form tests exercise supplier/shipment submissions, required-value rejection, and preservation of undisplayed data.
- Live database checks confirm all four tables exist with RLS enabled, no anonymous entity reads, no direct configuration insert, and only data-column updates on records.
- Browser verification confirms unauthenticated entity workspace navigation returns to sign-in. All content routes have unique Weorex title/description and sharing metadata.

## Not verified / limitations
- No real auth users exist; session minting cannot proceed. Signed-in publish/create/edit/switch/relationship flows and live cross-tenant record read/write denial remain unverified until a real account is created and confirmed. No fabricated accounts or business records were inserted.
- Relationships are single-record links within the organization; multi-value/inverse relationship editors, file uploads, computed fields, conditional visibility, field-level permissions, configurable roles, automatic data upgrades, and server-side query optimization for very large record sets are not part of this implementation.
- Configuration edits stay local until published. Persistent drafts are not implemented.
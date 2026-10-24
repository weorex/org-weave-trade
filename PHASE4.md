# Phase 4 — Shipping & transport

## Delivered
- Shared logistics workspace linked to existing entities, not per-type pages.
- Shipping-agent/transporter profiles, licenses and contact details.
- Tenant-scoped UN/LOCODE ports, FCL/LCL routes, container types, transit ranges and frequency.
- Vehicles, weight/volume capacity, pickup/delivery service zones and transit ranges.
- Append-only shipping and transporter rates, currency/unit/quantity tiers, inclusive validity dates and full history.
- Search, partner/mode/currency/validity filters and table pagination.
- Existing entity relationships, private document uploads, short-lived document download links and protected activity history.
- User-scoped authenticated services, active organization membership resolution, owner/admin writes, linked-entity permissions and tenant-composite foreign keys.

## Verification
- Ten logistics validation/permission tests passed.
- Rollback-only PostgreSQL checks cover retained shipping rates, rejected updates/deletes, tenant-key ports and rates, reversed validity, transport vehicle/service-area rates and restricted grants.
- Signed-in browser check opened the workspace, saved the real Chennai port (INMAA), read it back, confirmed activity history, and denied an inaccessible organization ID.

## Limitations
- Populated partner/route/vehicle/rate/document browser flows remain unverified: the account has no real logistics entity records. No invented partners or quotes were added.
- Profiles, ports, routes, vehicles and zones are create/read only in this phase; service attributes remain stable for historical quotes. Corrections currently require a new service record; no editing/archive workflow exists.
- Rates are manual quotes, not live carrier pricing or currency conversion. Overlapping dated quotes are retained, not silently replaced.
- PostgreSQL rollback checks use the sandbox role, not an authenticated RLS impersonation; that impersonation is unavailable in this environment.
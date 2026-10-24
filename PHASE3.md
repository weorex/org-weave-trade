# Phase 3 — Manufacturers and product catalogue

## Implemented
- Existing shared entities retain manufacturer/supplier profiles, certifications, capacity, country, address, website and notes. Existing metadata values remain intact.
- Added the five absent trade tables to the live foundation: products, entity_products, contacts, product_prices and entity_relationships. The older unapplied proposal was not used as the live schema.
- Catalogue creation/edit/archive, exact SKU and name duplicate checks, case-insensitive SKU uniqueness, supplier-product links with MOQ/capacity/packaging/lead time, contact create/edit/remove, and directed partner relationships.
- Append-only decimal price history with currency, unit, quantity tier and effective date; historical quotes cannot be updated/deleted. Same-date duplicate quotes are blocked within a series.
- Database-backed catalogue filters and pagination; partner search includes names, countries and certifications. Supplier and currency price history filters and quote pagination.
- CSV parsing, row validation and preview, atomic import of up to 500 rows, optional supplier links/initial prices, existing-SKU skip without overwriting, downloadable template, filtered catalogue/partner exports and quote-history export. Spreadsheet formula escaping is enabled.
- Every server operation verifies active organization membership. Owners/admins manage catalogue data; linked entity permissions are enforced by RLS. Tenant-key foreign keys protect all linked records. No service-role client is used.

## Verification
- 45 unit/component tests pass across the project, including decimal/currency/date validation, positive MOQ, shared profile preservation, duplicate detection, CSV parsing and formula escaping.
- `src/test/trade-postgres-constraints.sql` passes against real PostgreSQL in one rolled-back transaction: supplier-product attributes, USD/INR historical values, latest USD quote, tenant-key foreign-key denial, duplicate SKU/dated quote denial, MOQ and live append-only grants.
- Live checks confirm RLS, no anonymous reads, no price-history update/delete grants, and immutable history trigger. No test organizations or business records remain.
- Signed-in browser navigation reaches organization onboarding; inaccessible organization navigation displays the access-denied workspace state without runtime errors.

## Not verified / limitations
- A confirmed account is now available, but there are no organizations or real entity/product records. Full signed-in catalogue creation, profile editing, supplier linking, price entry, import/export readback and responsive populated-screen checks await organization onboarding and real records; no invented production data was added.
- The complete RLS/RPC integration script (`src/test/trade-postgres.sql`) is retained, but the sandbox SQL connection cannot impersonate the authenticated role. It stopped at SET ROLE and rolled back. This script has NOT passed. Rollback-only database constraint tests are separate and passed; they do not prove authenticated RLS behavior.
- Certifications are text identifiers, not uploaded certificates or expiry/verification tracking. Capacity is descriptive text. Currency-aware history keeps currencies distinct; exchange-rate conversion is not included.
- Partner creation reuses Entity Type Builder records, then attaches a trade profile. No separate per-type page/table is created. Catalogue records archive rather than delete; supplier links and prices remain to preserve history.
- Bulk import covers products with optional supplier attributes and initial quotes, not contacts or partner profiles. Filters are text category, status, supplier, partner search and price currency/supplier; no advanced query builder.
# Phase 1 status

Implemented: real email/password and managed social sign-in, recovery pages, user profiles with signup trigger, organization creation with atomic owner/role bootstrap, organization switching, live member list, organization details, trigger-authored activity, typed server services, membership-scoped RLS, and protected routes.

The applied foundation is `drizzle/migrations/0000_weorex_phase1_secure_foundation.sql`, hardened by `0001_restrict_phase1_client_grants.sql` to remove inherited Data API grants. The older `supabase/migrations/0001_phase1_initial_schema.sql` is an unapplied full-product proposal with unresolved SQL/security issues. It is not the live schema. Only the five Phase 1 tables are deployed; no fake business rows are seeded.

Not implemented: member invitation/acceptance, member role changes/removal, editable organization/profile preferences, configurable permissions, entity/product/logistics/workflow/capture/import modules, and the full-product schema. Fixed owner/admin/member roles are deployed; memberships and role definitions cannot be modified by browser clients. These later modules are not shown as mock screens.

Authentication requires email confirmation. Social provider settings and email sign-in have been enabled; interactive external-provider round trips require the account holder.

## Verification
- Six unit/routing tests passed: membership-list switching, foreign selection fallback, onboarding resolution, organization input acceptance/rejection, and root routing.
- Desktop and mobile sign-in rendered without runtime errors. Protected dashboard/onboarding redirected signed-out visitors to sign-in. Empty credentials were blocked, and reserved test-email signup was correctly rejected.
- Live database privilege checks confirmed clients cannot insert/update memberships, update role definitions, change ownership, or anonymously read organizations after grant hardening.
- Latest preview build succeeded.
- Signed-in organization creation, owner/profile bootstrap, dashboard rendering, switching, cross-tenant RLS read/write denial, sign-out, and password-reset completion remain unverified: there are no auth users, and managed test-session minting could not proceed. A confirmed real account is needed; email confirmation was not weakened to bypass this. No test accounts or business rows were created.
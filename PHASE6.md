# Phase 6 — Workflows, roles, approvals, invitations

## What exists
- **Custom roles & permissions**: owner/admin/member stay as system roles; owners/role managers create roles from an 8-permission allowlist. Nobody can grant a permission they do not hold; only the owner can invite or change administrators; ownership cannot change; nobody can change their own access.
- **Invitations**: single-use copyable links (`/invite#token`). The token is in the URL fragment (never sent to servers), stored only as a SHA-256 hash, expires in 1–168 hours, revocable.
- **Statuses & approvals**: per entity type, explicit allowed transitions (records start as `new`). Rules can require approval; requesters cannot approve their own requests; approvals become `stale` if the record moved meanwhile.
- **Workflows**: ordered steps from an allowlist of four actions (change status, request approval, notify, assign). Definitions are validated in the browser (Zod) and again in the database (exact keys, status format, active-member assignees, existing roles). Nothing is ever executed as SQL or JavaScript.
- **Execution**: each attempt runs atomically — on any failure every step of that attempt is rolled back, logs record `rolled_back`/`failed`, the runner is notified. Up to 3 attempts per run; runs are idempotent per request ID.
- **Notifications**: in-app only, per user, per organization.
- **Audit log**: every role, member, invitation, status, approval and workflow action. Readable by owner/admin or `audit.read`.
- **Rate limits** (per user, per organization, hourly windows): invitations 20, invitation acceptance 10, role saves 30, workflow saves 60, workflow runs/retries 60, status changes 120.
- **Secure storage**: existing private logistics document bucket with organization/entity-scoped paths and short-lived signed URLs.
- **Monitoring**: Workflows & access → Monitoring shows failures, pending approvals, open invitations and unread notifications.

All writes go through permission-checked database functions; tables expose read-only, row-filtered access to signed-in members.

## Tests
- `src/test/governance.test.ts`, `src/test/return-to.test.ts`: allowlist, role/invite input rules, safe error messages, sign-in return paths.
- `src/test/phase6-postgres.sql`: 41 database checks run as real signed-in roles inside a transaction that is always rolled back (expected result: error `PHASE6_ALL_PASSED`). Covers cross-tenant reads/writes, privilege escalation (self-elevation, admin invites, direct table writes, owner demotion, hidden invite hashes), invitation reuse, file path access, duplicate imports, workflow failure rollback, retries, retry limit, idempotent replay, approvals and rate limits. Last run: all passed.

## Deployment checklist
1. Publish the latest version (the live site is currently behind the preview).
2. Set site visibility to public if the browser extension must connect (sign-in still protects all data).
3. Run `bunx vitest run` — all tests must pass.
4. Run `src/test/phase6-postgres.sql` with the privileged SQL runner — must end with `PHASE6_ALL_PASSED`.
5. Run the security scan and resolve new findings.
6. Confirm a recent daily backup exists (Cloud → Database → Backups). Daily backups are kept about 14 days and do not include uploaded files; export the database before risky changes.
7. Sign in as owner: create a role, create and accept an invite link in a second account, add a status rule, run a workflow, approve from the second account.
8. Remove duplicate test organizations you no longer need (ask in chat — the app cannot delete organizations yet).
9. Re-download and reinstall the browser extension after publishing.

## Unresolved risks
- **Custom roles and entity permissions**: entity-type read/create/update/delete rules still only recognise owner/admin/member. Records are visible to custom-role members only via `member` rules; custom roles cannot be named in entity layouts yet.
- **Workflows pause at approvals**: steps after an approval step do not resume automatically once approved; the run is marked succeeded when approved.
- **Rate limiting** is a simple database counter, not network-level protection; it does not stop unauthenticated traffic floods and counters are best-effort cleaned.
- **Invite links are bearer links**: anyone holding an unexpired link can join with its role. Share privately; revoke unused links.
- **No organization deletion, ownership transfer, or member removal** (members can be suspended).
- **No email or push notifications** (in-app only, by choice).
- **Backups** rely on the platform's daily snapshots: no point-in-time recovery; uploaded documents are not backed up.
- **Monitoring** is in-app counts only; no external alerting or uptime checks.
- **Member names**: other members' display names are not readable under current profile privacy rules, so they appear as "Member xxxxxxxx".
- **Live site**: the published version is older and private; Phase 5/6 features are untested there.
- **Database tests** run through a privileged SQL tool, not CI; they must be re-run manually after schema changes.
- Earlier open items remain: populated trade/logistics/capture flows need real records.

<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- Keep the MV3 TypeScript capture extension separate under extension; it uses explicit active-tab injection and a fixed app host, never background browsing collection.
- Delegate extension access with a 15-minute encrypted capture-only credential and an exact stable extension callback; decrypt only in authenticated capture API handlers, retaining user-scoped RLS and avoiding application bearer exposure.
- Commit reviewed captures through an invoker-rights atomic RPC with actor/tenant/request idempotency, configuration validation, non-overwriting duplicate matches and protected audit triggers; direct writers remain governed by existing uniqueness and RLS.
- Keep logistics partners linked one-to-one with shared entities; tenant-keyed ports, services, vehicles and append-only shipping/transport quotes use restrictive foreign keys so historical rates retain their original service attributes.
- Store logistics documents in private organization/entity-scoped storage with matching entity-access policies and short-lived user-scoped signed URLs; capture logistics activity through protected insert triggers.
- Store postal addresses separately from generated unique organization identifiers; read created organizations in a separate query after membership bootstrap completes, and invalidate the membership list before navigation to avoid cached-empty onboarding loops.
- Use the TanStack Start file router; protected pages live under the integration-compatible `_authenticated` gate because sessions are browser-managed.
- Keep authenticated organization operations in typed server functions using the user-scoped client, and resolve active membership on every tenant data request; browser organization selection is only a preference.
- Store profiles separately from immutable organization role definitions and protected memberships; bootstrap owner access only when creating a new owned organization.
- The applied Phase 1 foundation lives in Drizzle migrations; the older full-schema proposal in supabase/migrations is not applied and must not be treated as the live schema.
- Entity types use immutable configuration revisions and a shared JSON record store; records retain their original revision so configuration changes never discard stored values.
- Publish configuration atomically through a role-checked database function; reusable metadata renderers and user-scoped server functions share Zod schemas, while database policies and validation triggers protect direct API writes.
- Store manufacturer profiles inside the shared entity JSON; normalized tenant-keyed trade tables hold products, supplier links, contacts, relationships and append-only quotes so catalogue and history queries stay indexed without per-type storage.
- Trade catalogue writes require owner/admin membership and linked entity access; CSV import uses an invoker-rights atomic database function, skipping existing SKUs without overwriting records, to retain RLS and prevent partial imports.

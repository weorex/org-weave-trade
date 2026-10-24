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
- Use the TanStack Start file router; protected pages live under the integration-compatible `_authenticated` gate because sessions are browser-managed.
- Keep authenticated organization operations in typed server functions using the user-scoped client, and resolve active membership on every tenant data request; browser organization selection is only a preference.
- Store profiles separately from immutable organization role definitions and protected memberships; bootstrap owner access only when creating a new owned organization.
- The applied Phase 1 foundation lives in Drizzle migrations; the older full-schema proposal in supabase/migrations is not applied and must not be treated as the live schema.
- Entity types use immutable configuration revisions and a shared JSON record store; records retain their original revision so configuration changes never discard stored values.
- Publish configuration atomically through a role-checked database function; reusable metadata renderers and user-scoped server functions share Zod schemas, while database policies and validation triggers protect direct API writes.

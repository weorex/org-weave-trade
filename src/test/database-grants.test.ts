import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync('drizzle/migrations/0001_restrict_phase1_client_grants.sql', 'utf8')
describe('Tenant grant hardening', () => {
  it('removes inherited membership write privileges before granting read-only access', () => {
    const revoke = sql.indexOf('FROM authenticated;')
    const read = sql.indexOf('GRANT SELECT ON public.organization_roles, public.organization_memberships, public.audit_logs TO authenticated;')
    expect(revoke).toBeGreaterThan(-1)
    expect(read).toBeGreaterThan(revoke)
    expect(sql).not.toMatch(/GRANT\s+(?:ALL|INSERT|UPDATE|DELETE).*ON public\.organization_memberships TO authenticated/i)
  })
  it('allows organization edits only on non-ownership fields', () => {
    expect(sql).toContain('GRANT UPDATE(name,default_currency,default_country,timezone) ON public.organizations TO authenticated;')
    expect(sql).not.toMatch(/GRANT UPDATE\([^)]*owner_user_id/i)
  })
  it('revokes anonymous organization table access', () => {
    expect(sql).toContain('REVOKE ALL ON public.profiles, public.organizations, public.organization_roles, public.organization_memberships, public.audit_logs FROM anon;')
    expect(sql).not.toMatch(/GRANT .* TO anon;/i)
  })
})
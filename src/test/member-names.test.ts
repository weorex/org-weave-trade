import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('Organization member name boundary', () => {
  const sql = readFileSync('drizzle/migrations/0013_organization_member_display_names.sql', 'utf8')
  it('requires membership and scopes names to the requested organization', () => {
    expect(sql).toContain('IF NOT public.is_org_member(p_org)')
    expect(sql).toContain('WHERE m.organization_id=p_org')
    expect(sql).toContain('RETURNS TABLE(user_id uuid, display_name text)')
    expect(sql).not.toMatch(/SELECT[^;]*(preferences|avatar_url)/i)
  })
  it('denies anonymous callers and grants authenticated execution only', () => {
    expect(sql).toContain('FROM PUBLIC, anon')
    expect(sql).toContain('TO authenticated, service_role')
  })
})
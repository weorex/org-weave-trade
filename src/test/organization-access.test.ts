import { describe, expect, it } from 'vitest'
import { organizationSchema, organizationSlug, resolveOrganization } from '@/services/organization-schemas'

describe('Active organization resolution', () => {
  const organizations = [{ id: 'a', name: 'Company A' }, { id: 'b', name: 'Company B' }]
  it('switches to an organization in the membership list', () => expect(resolveOrganization(organizations, 'b')?.id).toBe('b'))
  it('never resolves an unlisted tenant from browser preference', () => expect(resolveOrganization(organizations, 'foreign-tenant')?.id).toBe('a'))
  it('requires onboarding when there are no memberships', () => expect(resolveOrganization([], 'a')).toBeNull())
  it('validates organization creation input', () => expect(organizationSchema.safeParse({name:'Company A',slug:'company-a',default_currency:'USD',default_country:'IN'}).success).toBe(true))
  it('rejects malformed creation input', () => expect(organizationSchema.safeParse({name:'',slug:'invalid address',default_currency:'dollars',default_country:'India'}).success).toBe(false))
  it('accepts lowercase country codes and stores uppercase', () => {
    expect(organizationSchema.parse({name:'weorex',slug:'weorex-12345678',default_currency:'USD',default_country:'in'}).default_country).toBe('IN')
  })
  it('stores a real street address independently from the identifier', () => {
    const postal_address = '125 D ramnagar 5th st , ss colony madurai'
    const result = organizationSchema.parse({name:'weorex',slug:organizationSlug('weorex','12345678'),postal_address,default_currency:'USD',default_country:'IN'})
    expect(result.postal_address).toBe(postal_address)
    expect(result.slug).toBe('weorex-12345678')
  })
})
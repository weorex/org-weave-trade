import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { organizationSchema, organizationRequest } from './organization-schemas'

export const listOrganizations = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from('organizations').select('*').order('created_at')
    if (error) throw new Error('Unable to load organizations')
    return data
  })

export const createOrganization = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => organizationSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Read only after the INSERT finishes: the AFTER trigger establishes membership,
    // while INSERT RETURNING checks the member-only SELECT policy too early.
    // The slug doubles as an idempotency key: a retried request returns the organization
    // this user already created instead of creating a duplicate.
    const existing = await context.supabase.from('organizations').select('*').eq('slug', data.slug).eq('owner_user_id', context.userId).maybeSingle()
    if (existing.data) return existing.data
    const result = await context.supabase.from('organizations').insert({ ...data, owner_user_id: context.userId })
    if (result.error) {
      if (result.error.code === '23505') {
        const retried = await context.supabase.from('organizations').select('*').eq('slug', data.slug).eq('owner_user_id', context.userId).maybeSingle()
        if (retried.data) return retried.data
        throw new Error('This organization identifier is already taken. Please try again.')
      }
      throw new Error('Unable to create organization. Please try again.')
    }
    const organization = await context.supabase.from('organizations').select('*').eq('slug', data.slug).single()
    if (organization.error) throw new Error('Organization created, but unable to open it. Please return to the dashboard.')
    return organization.data
  })

export const getOrganizationOverview = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => organizationRequest.parse(data))
  .handler(async ({ data, context }) => {
    // Every tenant request resolves membership again; browser selection is only a preference.
    const membership = await context.supabase.from('organization_memberships').select('*').eq('organization_id', data.organizationId).eq('user_id', context.userId).eq('status', 'active').single()
    const organization = await context.supabase.from('organizations').select('*').eq('id', data.organizationId).single()
    if (membership.error || organization.error || organization.data.status !== 'active') throw new Error('Organization access denied')
    const [members, audit, profile] = await Promise.all([
      context.supabase.from('organization_memberships').select('*').eq('organization_id', organization.data.id).order('created_at'),
      context.supabase.from('audit_logs').select('*').eq('organization_id', organization.data.id).order('created_at', { ascending: false }).limit(8),
      context.supabase.from('profiles').select('*').eq('id', context.userId).maybeSingle(),
    ])
    if (members.error || audit.error || profile.error) throw new Error('Unable to load organization overview')
    return { organization: organization.data, membership: membership.data, members: members.data, audit: audit.data, profile: profile.data }
  })
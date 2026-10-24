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
    const result = await context.supabase.from('organizations').insert({ ...data, owner_user_id: context.userId }).select('*').single()
    if (result.error) throw new Error(result.error.code === '23505' ? 'This organization identifier is already taken. Please try again.' : 'Unable to create organization. Please try again.')
    return result.data
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
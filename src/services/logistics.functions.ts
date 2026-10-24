import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { assertOrganizationAccess } from './entity-schemas'
import { logisticsRequest, logisticsProfileSchema, portSchema, routeSchema, assetSchema, areaSchema, rateSchema, documentSchema, mayManageLogistics } from './logistics-schemas'
type Client = SupabaseClient<Database>
async function access(c: Client, user: string, org: string, write = false) {
  const [m, o] = await Promise.all([c.from('organization_memberships').select('organization_id,status,role_key').eq('organization_id', org).eq('user_id', user).maybeSingle(), c.from('organizations').select('name,status,default_currency').eq('id', org).maybeSingle()])
  assertOrganizationAccess(org, m.data, o.data?.status ?? '')
  if (m.error || o.error || !m.data || !o.data) throw new Error('Organization access denied')
  if (write && !mayManageLogistics(m.data.role_key)) throw new Error('Only owners and administrators can manage logistics')
  return { organizationName: o.data.name, currency: o.data.default_currency, role: m.data.role_key }
}
function check(error: { code?: string } | null) { if (error) throw new Error(error.code === '23505' ? 'This record already exists.' : 'Unable to save or load logistics. Check related records and permissions.') }
const tables = ['logistics_profiles', 'ports', 'shipping_routes', 'shipping_rates', 'transporter_assets', 'transporter_service_areas', 'logistics_documents', 'logistics_activity', 'entities', 'entity_relationships'] as const
async function rows<T extends typeof tables[number]>(c: Client, table: T, org: string): Promise<Database['public']['Tables'][T]['Row'][]> {
  const result: Database['public']['Tables'][T]['Row'][] = []
  for (let offset = 0; ; offset += 500) {
    const order = table === 'logistics_profiles' ? 'entity_id' : 'id'
    const r = await c.from(table as typeof tables[number]).select('*').eq('organization_id', org).order(order).range(offset, offset + 499)
    check(r.error)
    result.push(...(r.data ?? []) as unknown as Database['public']['Tables'][T]['Row'][])
    if ((r.data?.length ?? 0) < 500) return result
  }
}
export const getLogisticsWorkspace = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => logisticsRequest.parse(d)).handler(async ({ data, context }) => {
  const c = context.supabase, org = data.organizationId
  const membership = await access(c, context.userId, org)
  // Keep below the worker's six outbound connections per invocation.
  const [profiles, ports, routes, rates, assets] = await Promise.all([rows(c, 'logistics_profiles', org), rows(c, 'ports', org), rows(c, 'shipping_routes', org), rows(c, 'shipping_rates', org), rows(c, 'transporter_assets', org)])
  const [areas, documents, activity, entities, relationships] = await Promise.all([rows(c, 'transporter_service_areas', org), rows(c, 'logistics_documents', org), rows(c, 'logistics_activity', org), rows(c, 'entities', org), rows(c, 'entity_relationships', org)])
  return { ...membership, profiles, ports, routes, rates, assets, areas, documents, activity, entities, relationships }
})
const saveSchema = z.discriminatedUnion('kind', [
  logisticsRequest.extend({ kind: z.literal('profile'), values: logisticsProfileSchema }),
  logisticsRequest.extend({ kind: z.literal('port'), values: portSchema }),
  logisticsRequest.extend({ kind: z.literal('route'), values: routeSchema }),
  logisticsRequest.extend({ kind: z.literal('asset'), values: assetSchema }),
  logisticsRequest.extend({ kind: z.literal('area'), values: areaSchema }),
  logisticsRequest.extend({ kind: z.literal('rate'), values: rateSchema }),
  logisticsRequest.extend({ kind: z.literal('document'), values: documentSchema }),
])
export const addLogisticsRecord = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => saveSchema.parse(d)).handler(async ({ data, context }) => {
  const c = context.supabase, org = data.organizationId
  await access(c, context.userId, org, true)
  let error: { code?: string } | null = null
  if (data.kind === 'profile') ({ error } = await c.from('logistics_profiles').insert({ ...data.values, organization_id: org }))
  if (data.kind === 'port') ({ error } = await c.from('ports').insert({ ...data.values, organization_id: org }))
  if (data.kind === 'route') {
    const p = await c.from('logistics_profiles').select('kind').eq('organization_id', org).eq('entity_id', data.values.shipping_agent_entity_id).single()
    if (!p.data || p.data.kind === 'transporter') throw new Error('Choose a shipping agent')
    ;({ error } = await c.from('shipping_routes').insert({ ...data.values, organization_id: org }))
  }
  if (data.kind === 'asset' || data.kind === 'area') {
    const p = await c.from('logistics_profiles').select('kind').eq('organization_id', org).eq('entity_id', data.values.transporter_entity_id).single()
    if (!p.data || p.data.kind === 'shipping_agent') throw new Error('Choose a transporter')
    if (data.kind === 'asset') ({ error } = await c.from('transporter_assets').insert({ ...data.values, organization_id: org }))
    else ({ error } = await c.from('transporter_service_areas').insert({ ...data.values, organization_id: org }))
  }
  if (data.kind === 'rate') ({ error } = await c.from('shipping_rates').insert({ ...data.values, organization_id: org, created_by: context.userId }))
  if (data.kind === 'document') {
    if (!data.values.object_path.startsWith(`${org}/${data.values.entity_id}/`)) throw new Error('Document organization mismatch')
    const path = data.values.object_path.split('/').slice(0, -1).join('/'), filename = data.values.object_path.split('/').at(-1)
    if (!filename) throw new Error('Invalid document path')
    const stored = await c.storage.from('logistics-documents').list(path, { search: filename })
    if (stored.error || !stored.data?.some(f => f.name === filename)) throw new Error('Upload the document before saving')
    ;({ error } = await c.from('logistics_documents').insert({ ...data.values, organization_id: org, created_by: context.userId }))
  }
  check(error)
  return { saved: true }
})
export const openLogisticsDocument = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => logisticsRequest.extend({ id: z.string().uuid() }).parse(d)).handler(async ({ data, context }) => {
  await access(context.supabase, context.userId, data.organizationId)
  const doc = await context.supabase.from('logistics_documents').select('object_path').eq('organization_id', data.organizationId).eq('id', data.id).single()
  if (doc.error || !doc.data) throw new Error('Document access denied')
  const r = await context.supabase.storage.from('logistics-documents').createSignedUrl(doc.data.object_path, 60)
  if (r.error || !r.data) throw new Error('Unable to open document')
  return { url: r.data.signedUrl }
})
export type LogisticsWorkspaceData = Awaited<ReturnType<typeof getLogisticsWorkspace>>
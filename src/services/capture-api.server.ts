import { createClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/integrations/supabase/types'
import { buildRecordSchema, configurationSchema, may, type EntityData } from './entity-schemas'
import { captureRequest } from './capture-schemas'

export const captureCors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Authorization,Content-Type', 'Cache-Control': 'no-store' }
export async function handleCaptureApi(request: Request) {
  const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: captureCors })
  try {
    const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1]
    if (!token) return reply({ error: 'Sign in to connect your extension.' }, 401)
    const url = process.env['SUPABASE_URL']; const key = process.env['SUPABASE_PUBLISHABLE_KEY']
    if (!url || !key) return reply({ error: 'Capture service unavailable.' }, 503)
    const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } })
    const auth = await client.auth.getUser(token)
    if (auth.error || !auth.data.user) return reply({ error: 'Session expired. Reconnect the extension.' }, 401)
    const userId = auth.data.user.id
    const organizationId = new URL(request.url).searchParams.get('org')
    if (request.method === 'GET' && !organizationId) {
      const memberships = await client.from('organization_memberships').select('organization_id,role_key').eq('user_id', userId).eq('status', 'active')
      if (memberships.error) throw new Error('Unable to load organizations')
      const orgs = await client.from('organizations').select('id,name').eq('status', 'active').in('id', memberships.data.map(m => m.organization_id))
      if (orgs.error) throw new Error('Unable to load organizations')
      return reply({ organizations: orgs.data })
    }
    // Bound the body before parsing; never store extracted HTML or whole pages.
    const raw = request.method === 'POST' ? await request.text() : ''
    if (raw.length > 1000000) return reply({ error: 'Capture is too large.' }, 413)
    const input = request.method === 'POST' ? captureRequest.parse(JSON.parse(raw)) : null
    const org = input?.organizationId ?? organizationId ?? ''
    if (!/^[0-9a-f-]{36}$/i.test(org)) return reply({ error: 'Choose an organization.' }, 400)
    const [membership, organization] = await Promise.all([
      client.from('organization_memberships').select('role_key,status').eq('organization_id', org).eq('user_id', userId).maybeSingle(),
      client.from('organizations').select('status').eq('id', org).maybeSingle(),
    ])
    if (membership.error || organization.error || membership.data?.status !== 'active' || organization.data?.status !== 'active') return reply({ error: 'Organization access denied.' }, 403)
    const role = membership.data.role_key
    const [types, fields, layouts] = await Promise.all([
      client.from('entity_types').select('*').eq('organization_id', org).order('version', { ascending: false }),
      client.from('entity_field_definitions').select('*').eq('organization_id', org).order('position'),
      client.from('entity_type_layouts').select('*').eq('organization_id', org),
    ])
    if (types.error || fields.error || layouts.error) throw new Error('Unable to load configuration')
    const seen = new Set<string>()
    const configurations = types.data.filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true }).map(t => ({
      id: t.id, version: t.version,
      config: configurationSchema.parse({ name: t.name, key: t.type_key, fields: fields.data.filter(f => f.entity_type_id === t.id && f.configuration_version === t.version).map(f => ({ key: f.field_key, label: f.label, type: f.field_type, required: f.required, settings: f.settings })), layout: layouts.data.find(l => l.entity_type_id === t.id && l.configuration_version === t.version)?.layout }),
    })).filter(t => may(role, t.config, 'read') && may(role, t.config, 'create'))
    if (!input) {
      const records: { id: string; typeId: string; values: Json }[] = []
      for (let offset = 0; ; offset += 500) {
        const page = await client.from('entities').select('id,entity_type_id,data').eq('organization_id', org).order('id').range(offset, offset + 499)
        if (page.error) throw new Error('Unable to load duplicate candidates')
        records.push(...page.data.map(e => ({ id: e.id, typeId: e.entity_type_id, values: e.data })))
        if (page.data.length < 500) break
      }
      const products = await client.from('products').select('sku').eq('organization_id', org).limit(1000)
      return reply({ types: configurations, records, productSkus: products.data?.map(p => p.sku) ?? [], canTrade: ['owner','admin'].includes(membership.data.role_key) })
    }
    const type = configurations.find(t => t.id === input.typeId)
    if (!type) return reply({ error: 'Entity type access denied.' }, 403)
    if (type.version !== input.version) return reply({ error: 'Configuration changed. Reload the organization.' }, 409)
    const parsed = buildRecordSchema(type.config.fields).safeParse(input.values)
    if (!parsed.success) return reply({ error: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }, 400)
    const values = parsed.data as EntityData
    if ((input.products.length || input.contacts.length) && (!['owner','admin'].includes(membership.data.role_key) || !may(membership.data.role_key, type.config, 'update'))) return reply({ error: 'Trade capture requires administrator access.' }, 403)
    for (const field of type.config.fields.filter(f => f.type === 'relationship')) {
      const targetId = values[field.key]; if (!targetId) continue
      const target = await client.from('entities').select('id').eq('organization_id', org).eq('entity_type_id', field.settings.targetTypeId ?? '').eq('id', String(targetId)).maybeSingle()
      if (target.error || !target.data) return reply({ error: 'Related record is unavailable.' }, 400)
    }
    const result = await client.rpc('save_data_capture', { p_org: org, p_type: type.id, p_version: type.version, p_request: input.requestId, p_source: input.sourceUrl, p_values: values, p_products: input.products as Json, p_contacts: input.contacts as Json })
    if (result.error) return reply({ error: result.error.message.includes('Idempotency') ? 'This capture changed after submission. Capture the page again.' : 'Capture could not be saved. Check permissions and values.' }, 409)
    return reply(result.data)
  } catch { return reply({ error: 'Invalid capture or unavailable service. Check your fields and try again.' }, 400) }
}
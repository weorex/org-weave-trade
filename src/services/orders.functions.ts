import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { assertOrganizationAccess } from './entity-schemas'
import { orderRequest, orderIdRequest, orderSchema, orderUpdateSchema, itemSchema, quoteSchema, decisionSchema, paymentSchema, documentSchema, mayManageOrders, summarizeOrder } from './order-schemas'

type Client = SupabaseClient<Database>
type Tables = Database['public']['Tables']
export type Order = Tables['orders']['Row']
export type OrderQuote = Tables['order_quotes']['Row']
export type OrderPayment = Tables['order_payments']['Row']
export type Party = { id: string; name: string; typeName: string; logisticsKind: string | null }

async function access(c: Client, user: string, org: string, write = false) {
  // Resolve active membership on every request; the browser's organization choice is only a preference.
  const [m, o] = await Promise.all([c.from('organization_memberships').select('organization_id,status,role_key').eq('organization_id', org).eq('user_id', user).maybeSingle(), c.from('organizations').select('name,status,default_currency').eq('id', org).maybeSingle()])
  assertOrganizationAccess(org, m.data, o.data?.status ?? '')
  if (m.error || o.error || !m.data || !o.data) throw new Error('Organization access denied')
  if (write && !mayManageOrders(m.data.role_key)) throw new Error('Only owners and administrators can change orders')
  return { organizationName: o.data.name, currency: o.data.default_currency, role: m.data.role_key }
}
// Database rule violations (raised by our own triggers/functions) are written for people; show them as-is.
function check(error: { code?: string; message?: string } | null, fallback: string) {
  if (!error) return
  if (error.code === '23505') throw new Error('That order number is already used in this organization.')
  if (error.code === 'P0001' && error.message) throw new Error(error.message)
  throw new Error(fallback)
}
const listed = ['orders', 'order_quotes', 'order_payments', 'entities', 'entity_types', 'logistics_profiles', 'products'] as const
async function all<T extends typeof listed[number]>(c: Client, table: T, org: string): Promise<Tables[T]['Row'][]> {
  const result: Tables[T]['Row'][] = []
  for (let offset = 0; ; offset += 500) {
    const r = await c.from(table as typeof listed[number]).select('*').eq('organization_id', org).order(table === 'logistics_profiles' ? 'entity_id' : 'id').range(offset, offset + 499)
    check(r.error, 'Unable to load orders')
    result.push(...(r.data ?? []) as unknown as Tables[T]['Row'][])
    if ((r.data?.length ?? 0) < 500) return result
  }
}
// Every company in the organization (buyers, manufacturers, logistics partners…) with a readable name and its type.
async function lookups(c: Client, org: string) {
  const [entities, types, profiles, products] = await Promise.all([all(c, 'entities', org), all(c, 'entity_types', org), all(c, 'logistics_profiles', org), all(c, 'products', org)])
  const typeName = new Map<string, string>(); for (const t of [...types].sort((a, b) => a.version - b.version)) typeName.set(t.id, t.name)
  const parties: Party[] = entities.map(e => {
    const d = (e.data && typeof e.data === 'object' && !Array.isArray(e.data) ? e.data : {}) as Record<string, unknown>
    const profile = profiles.find(p => p.entity_id === e.id)
    const trade = d['trade_profile'] as Record<string, unknown> | undefined
    const name = profile?.legal_name ?? (typeof trade?.['legal_name'] === 'string' ? trade['legal_name'] : undefined) ?? (typeof d['name'] === 'string' ? d['name'] : e.id.slice(0, 8))
    return { id: e.id, name, typeName: typeName.get(e.entity_type_id) ?? 'Company', logisticsKind: profile?.kind ?? null }
  }).sort((a, b) => a.name.localeCompare(b.name))
  return { parties, products: products.map(p => ({ id: p.id, sku: p.sku, name: p.name, unit: p.unit })) }
}

export const getOrders = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => orderRequest.parse(d)).handler(async ({ data, context }) => {
  const c = context.supabase, org = data.organizationId
  const membership = await access(c, context.userId, org)
  const [orders, quotes, payments, { parties }] = await Promise.all([all(c, 'orders', org), all(c, 'order_quotes', org), all(c, 'order_payments', org), lookups(c, org)])
  return {
    ...membership, parties,
    orders: orders.sort((a, b) => b.created_at.localeCompare(a.created_at)).map(o => ({ ...o, summary: summarizeOrder(o, quotes.filter(q => q.order_id === o.id), payments.filter(p => p.order_id === o.id)), quoteCount: quotes.filter(q => q.order_id === o.id).length, partyIds: [...new Set(quotes.filter(q => q.order_id === o.id).map(q => q.party_entity_id))] })),
  }
})

export const getOrder = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => orderIdRequest.parse(d)).handler(async ({ data, context }) => {
  const c = context.supabase, org = data.organizationId, id = data.orderId
  const membership = await access(c, context.userId, org)
  const order = await c.from('orders').select('*').eq('organization_id', org).eq('id', id).maybeSingle()
  if (order.error || !order.data) throw new Error('Order not found')
  const [items, quotes, payments, documents, events, names, refs] = await Promise.all([
    c.from('order_items').select('*').eq('organization_id', org).eq('order_id', id).order('created_at'),
    c.from('order_quotes').select('*').eq('organization_id', org).eq('order_id', id).order('created_at'),
    c.from('order_payments').select('*').eq('organization_id', org).eq('order_id', id).order('paid_on'),
    c.from('order_documents').select('*').eq('organization_id', org).eq('order_id', id).order('created_at', { ascending: false }),
    c.from('order_events').select('*').eq('organization_id', org).eq('order_id', id).order('created_at', { ascending: false }).limit(200),
    c.rpc('list_org_member_names', { p_org: org }),
    lookups(c, org),
  ])
  for (const r of [items, quotes, payments, documents, events, names]) check(r.error, 'Unable to load this order')
  return {
    ...membership, ...refs, order: order.data, items: items.data ?? [], quotes: quotes.data ?? [], payments: payments.data ?? [], documents: documents.data ?? [], events: events.data ?? [],
    members: (names.data ?? []).map(n => ({ id: n.user_id, name: n.display_name })),
    summary: summarizeOrder(order.data, quotes.data ?? [], payments.data ?? []),
  }
})
export type OrderDetail = Awaited<ReturnType<typeof getOrder>>
export type OrderList = Awaited<ReturnType<typeof getOrders>>

export const createOrder = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => orderRequest.extend({ order: orderSchema }).parse(d)).handler(async ({ data, context }) => {
  await access(context.supabase, context.userId, data.organizationId, true)
  const r = await context.supabase.from('orders').insert({ ...data.order, organization_id: data.organizationId, created_by: context.userId }).select('id').single()
  check(r.error, 'Unable to create the order. Check the buyer and values.'); return { id: r.data!.id }
})
export const updateOrder = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => orderIdRequest.extend({ order: orderUpdateSchema }).parse(d)).handler(async ({ data, context }) => {
  await access(context.supabase, context.userId, data.organizationId, true)
  const { order_type, ...values } = data.order
  // The order type never changes; it decides whether a buyer and incoming payments are allowed.
  const current = await context.supabase.from('orders').select('order_type').eq('organization_id', data.organizationId).eq('id', data.orderId).single()
  if (current.error || current.data.order_type !== order_type) throw new Error('Order not found')
  const r = await context.supabase.from('orders').update(values).eq('organization_id', data.organizationId).eq('id', data.orderId)
  check(r.error, 'Unable to update the order'); return { ok: true }
})
export const addOrderItem = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => orderIdRequest.extend({ item: itemSchema }).parse(d)).handler(async ({ data, context }) => {
  await access(context.supabase, context.userId, data.organizationId, true)
  const r = await context.supabase.from('order_items').insert({ ...data.item, organization_id: data.organizationId, order_id: data.orderId })
  check(r.error, 'Unable to add the item'); return { ok: true }
})
export const removeOrderItem = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => orderIdRequest.extend({ itemId: z.string().uuid() }).parse(d)).handler(async ({ data, context }) => {
  await access(context.supabase, context.userId, data.organizationId, true)
  const r = await context.supabase.from('order_items').delete().eq('organization_id', data.organizationId).eq('order_id', data.orderId).eq('id', data.itemId)
  check(r.error, 'Unable to remove the item'); return { ok: true }
})
export const addOrderQuote = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => orderIdRequest.extend({ quote: quoteSchema }).parse(d)).handler(async ({ data, context }) => {
  await access(context.supabase, context.userId, data.organizationId, true)
  const r = await context.supabase.from('order_quotes').insert({ ...data.quote, organization_id: data.organizationId, order_id: data.orderId, created_by: context.userId })
  check(r.error, 'Unable to save the quote'); return { ok: true }
})
export const decideOrderQuote = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => orderRequest.extend({ decision: decisionSchema }).parse(d)).handler(async ({ data, context }) => {
  await access(context.supabase, context.userId, data.organizationId, true)
  const r = await context.supabase.rpc('decide_order_quote', { p_org: data.organizationId, p_quote: data.decision.quoteId, p_status: data.decision.status, p_note: data.decision.note })
  check(r.error, 'Unable to record the decision'); return { ok: true }
})
export const addOrderPayment = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => orderIdRequest.extend({ payment: paymentSchema }).parse(d)).handler(async ({ data, context }) => {
  await access(context.supabase, context.userId, data.organizationId, true)
  const r = await context.supabase.from('order_payments').insert({ ...data.payment, organization_id: data.organizationId, order_id: data.orderId, created_by: context.userId })
  check(r.error, 'Unable to record the payment'); return { ok: true }
})
export const removeOrderPayment = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => orderIdRequest.extend({ paymentId: z.string().uuid() }).parse(d)).handler(async ({ data, context }) => {
  await access(context.supabase, context.userId, data.organizationId, true)
  const r = await context.supabase.from('order_payments').delete().eq('organization_id', data.organizationId).eq('order_id', data.orderId).eq('id', data.paymentId)
  check(r.error, 'Unable to remove the payment'); return { ok: true }
})
export const addOrderNote = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => orderIdRequest.extend({ note: z.string().trim().min(1).max(2000) }).parse(d)).handler(async ({ data, context }) => {
  await access(context.supabase, context.userId, data.organizationId, true)
  const r = await context.supabase.rpc('add_order_note', { p_org: data.organizationId, p_order: data.orderId, p_note: data.note })
  check(r.error, 'Unable to add the note'); return { ok: true }
})
export const addOrderDocument = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => orderIdRequest.extend({ document: documentSchema }).parse(d)).handler(async ({ data, context }) => {
  await access(context.supabase, context.userId, data.organizationId, true)
  const prefix = `${data.organizationId}/${data.orderId}/`
  if (!data.document.object_path.startsWith(prefix)) throw new Error('Document order mismatch')
  const filename = data.document.object_path.slice(prefix.length)
  const stored = await context.supabase.storage.from('order-documents').list(prefix.slice(0, -1), { search: filename })
  if (stored.error || !stored.data?.some(f => f.name === filename)) throw new Error('Upload the document before saving')
  const r = await context.supabase.from('order_documents').insert({ ...data.document, organization_id: data.organizationId, order_id: data.orderId, created_by: context.userId })
  check(r.error, 'Unable to save the document'); return { ok: true }
})
export const openOrderDocument = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => orderRequest.extend({ id: z.string().uuid() }).parse(d)).handler(async ({ data, context }) => {
  await access(context.supabase, context.userId, data.organizationId)
  const doc = await context.supabase.from('order_documents').select('object_path').eq('organization_id', data.organizationId).eq('id', data.id).single()
  if (doc.error || !doc.data) throw new Error('Document access denied')
  const r = await context.supabase.storage.from('order-documents').createSignedUrl(doc.data.object_path, 60)
  if (r.error || !r.data) throw new Error('Unable to open document')
  // Keep storage URLs on the browser-facing origin while retaining the signed path (see logistics documents).
  const signed = new URL(r.data.signedUrl)
  return { url: `${import.meta.env['VITE_SUPABASE_URL']}${signed.pathname}${signed.search}` }
})

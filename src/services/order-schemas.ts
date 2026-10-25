import { z } from 'zod'

export const orderTypes = ['export', 'stock'] as const
export const orderStatuses = ['draft', 'sourcing', 'confirmed', 'in_production', 'shipped', 'delivered', 'closed', 'cancelled'] as const
export const quoteKinds = ['supplier', 'shipping', 'transport', 'other'] as const
export const paymentMethods = ['bank_transfer', 'lc', 'upi', 'cheque', 'cash', 'card', 'other'] as const
export const documentTypes = ['proforma_invoice', 'purchase_order', 'commercial_invoice', 'packing_list', 'bill_of_lading', 'certificate', 'quote', 'payment_proof', 'other'] as const
export const incoterms = ['', 'EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'] as const
export const label = (value: string) => value === 'lc' ? 'LC' : value === 'upi' ? 'UPI' : value.replaceAll('_', ' ').replace(/^\w/, c => c.toUpperCase())

const uuid = z.string().uuid()
const currency = z.string().regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code')
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date')
const optionalDate = z.preprocess(v => v === '' ? null : v, date.nullable())
const text = (max: number) => z.string().max(max).default('')

export const orderRequest = z.object({ organizationId: uuid })
export const orderIdRequest = orderRequest.extend({ orderId: uuid })

const orderFields = {
  buyer_entity_id: z.preprocess(v => v === '' ? null : v, uuid.nullable()),
  title: z.string().trim().min(1, 'Give the order a short title').max(160),
  currency, order_value: z.number().min(0).nullable().default(null),
  incoterm: z.enum(incoterms).default(''), destination: text(160), required_by: optionalDate.default(null), notes: text(5000),
}
// Export orders always have a buyer (and may have a sale value); stock purchases never do. The database enforces the same rule.
const buyerRule = (o: { order_type: string; buyer_entity_id: string | null; order_value: number | null }, ctx: z.RefinementCtx) => {
  if (o.order_type === 'export' && !o.buyer_entity_id) ctx.addIssue({ code: 'custom', path: ['buyer_entity_id'], message: 'Choose the buyer for this export order' })
  if (o.order_type === 'stock' && o.buyer_entity_id) ctx.addIssue({ code: 'custom', path: ['buyer_entity_id'], message: 'Stock purchases have no buyer' })
  if (o.order_type === 'stock' && o.order_value !== null) ctx.addIssue({ code: 'custom', path: ['order_value'], message: 'Stock purchases have no sale value' })
}
export const orderSchema = z.object({ order_number: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9/_.-]{0,39}$/, 'Use letters, numbers, - / _ . (max 40)'), order_type: z.enum(orderTypes), ...orderFields }).superRefine(buyerRule)
export const orderUpdateSchema = z.object({ order_type: z.enum(orderTypes), status: z.enum(orderStatuses), ...orderFields }).superRefine(buyerRule)
export const itemSchema = z.object({ product_id: z.preprocess(v => v === '' ? null : v, uuid.nullable()).default(null), description: z.string().trim().min(1).max(300), quantity: z.number().positive(), unit: z.string().trim().min(1).max(40), target_price: z.number().min(0).nullable().default(null), notes: text(2000) })
export const quoteSchema = z.object({
  party_entity_id: uuid, kind: z.enum(quoteKinds), quote_number: text(80), description: text(500), amount: z.number().min(0), currency,
  received_on: date, valid_until: optionalDate.default(null), revises_quote_id: z.preprocess(v => v === '' ? null : v, uuid.nullable()).default(null), notes: text(2000),
}).refine(q => !q.valid_until || q.valid_until >= q.received_on, { path: ['valid_until'], message: 'Valid until must be on or after the received date' })
export const decisionSchema = z.object({ quoteId: uuid, status: z.enum(['accepted', 'rejected', 'withdrawn']), note: z.string().max(1000).default('') })
  .refine(d => d.status === 'accepted' || d.note.trim().length > 0, { path: ['note'], message: 'Give a reason' })
export const paymentSchema = z.object({
  direction: z.enum(['in', 'out']), party_entity_id: uuid, quote_id: z.preprocess(v => v === '' ? null : v, uuid.nullable()).default(null),
  amount: z.number().positive(), currency, paid_on: date, method: z.enum(paymentMethods), reference: text(120), notes: text(2000),
})
export const documentSchema = z.object({ doc_type: z.enum(documentTypes), name: z.string().min(1).max(200), object_path: z.string().min(1).max(1000) })
export const mayManageOrders = (role: string) => role === 'owner' || role === 'admin'

export type Money = Record<string, number>
const add = (m: Money, c: string, v: number) => { m[c] = (m[c] ?? 0) + v }
/** Money position of one order, kept per currency (supplier and freight quotes are often in different currencies). */
export function summarizeOrder(
  order: { order_type: string; currency: string; order_value: number | null; buyer_entity_id: string | null },
  quotes: { party_entity_id: string; amount: number; currency: string; status: string }[],
  payments: { direction: string; party_entity_id: string; amount: number; currency: string }[],
) {
  const cost: Money = {}, paidOut: Money = {}, paidIn: Money = {}
  const parties = new Map<string, { accepted: Money; paid: Money }>()
  const party = (id: string) => { let p = parties.get(id); if (!p) { p = { accepted: {}, paid: {} }; parties.set(id, p) } return p }
  for (const q of quotes) if (q.status === 'accepted') { add(cost, q.currency, Number(q.amount)); add(party(q.party_entity_id).accepted, q.currency, Number(q.amount)) }
  for (const p of payments) {
    if (p.direction === 'in') add(paidIn, p.currency, Number(p.amount))
    else { add(paidOut, p.currency, Number(p.amount)); add(party(p.party_entity_id).paid, p.currency, Number(p.amount)) }
  }
  const due = [...parties].map(([id, p]) => ({ partyId: id, due: Object.fromEntries([...new Set([...Object.keys(p.accepted), ...Object.keys(p.paid)])].map(c => [c, (p.accepted[c] ?? 0) - (p.paid[c] ?? 0)])) as Money, accepted: p.accepted, paid: p.paid }))
  const outstandingOut: Money = {}; for (const d of due) for (const [c, v] of Object.entries(d.due)) add(outstandingOut, c, v)
  const sale = order.order_type === 'export' ? order.order_value : null
  const buyerDue = sale === null ? null : sale - (paidIn[order.currency] ?? 0)
  // Margin only when every accepted cost is in the order currency; no exchange rates are guessed.
  const mixedCurrency = Object.keys(cost).some(c => c !== order.currency)
  const margin = sale === null || mixedCurrency ? null : sale - (cost[order.currency] ?? 0)
  return { cost, paidOut, paidIn, outstandingOut, due, buyerDue, margin, mixedCurrency }
}

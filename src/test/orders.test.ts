import { describe, expect, it } from 'vitest'
import { decisionSchema, orderSchema, paymentSchema, quoteSchema, summarizeOrder } from '@/services/order-schemas'

const buyer = 'd0000000-0000-4000-8000-000000000001', supplier = 'd0000000-0000-4000-8000-000000000002', agent = 'd0000000-0000-4000-8000-000000000003'
const base = { order_number: 'EX-2026-001', title: '20 t turmeric', currency: 'USD' }

describe('orders', () => {
  it('requires a buyer on export orders and forbids one on stock purchases', () => {
    expect(orderSchema.safeParse({ ...base, order_type: 'export', buyer_entity_id: null }).success).toBe(false)
    expect(orderSchema.safeParse({ ...base, order_type: 'export', buyer_entity_id: buyer, order_value: 10000 }).success).toBe(true)
    expect(orderSchema.safeParse({ ...base, order_type: 'stock', buyer_entity_id: buyer }).success).toBe(false)
    expect(orderSchema.safeParse({ ...base, order_type: 'stock', buyer_entity_id: null, order_value: 5 }).success).toBe(false)
    expect(orderSchema.safeParse({ ...base, order_type: 'stock', buyer_entity_id: '' }).success).toBe(true)
  })
  it('validates quotes, decisions and payments', () => {
    expect(quoteSchema.safeParse({ party_entity_id: supplier, kind: 'supplier', amount: 100, currency: 'USD', received_on: '2026-10-25', valid_until: '2026-10-01' }).success).toBe(false)
    expect(decisionSchema.safeParse({ quoteId: supplier, status: 'rejected', note: ' ' }).success).toBe(false)
    expect(decisionSchema.safeParse({ quoteId: supplier, status: 'accepted' }).success).toBe(true)
    expect(paymentSchema.safeParse({ direction: 'out', party_entity_id: supplier, amount: 0, currency: 'USD', paid_on: '2026-10-25', method: 'lc' }).success).toBe(false)
  })
  it('summarizes costs, payments, dues and margin per currency', () => {
    const order = { order_type: 'export', currency: 'USD', order_value: 10000, buyer_entity_id: buyer }
    const quotes = [
      { party_entity_id: supplier, amount: 6000, currency: 'USD', status: 'rejected' },
      { party_entity_id: supplier, amount: 5500, currency: 'USD', status: 'accepted' },
      { party_entity_id: agent, amount: 1200, currency: 'USD', status: 'accepted' },
    ]
    const payments = [{ direction: 'in', party_entity_id: buyer, amount: 3000, currency: 'USD' }, { direction: 'out', party_entity_id: supplier, amount: 2000, currency: 'USD' }]
    const s = summarizeOrder(order, quotes, payments)
    expect(s.cost).toEqual({ USD: 6700 })
    expect(s.margin).toBe(3300)
    expect(s.buyerDue).toBe(7000)
    expect(s.outstandingOut).toEqual({ USD: 4700 })
    expect(s.due.find(d => d.partyId === supplier)?.due).toEqual({ USD: 3500 })
    // A cost in another currency means no margin is guessed.
    const mixed = summarizeOrder(order, [...quotes, { party_entity_id: agent, amount: 50000, currency: 'INR', status: 'accepted' }], payments)
    expect(mixed.mixedCurrency).toBe(true); expect(mixed.margin).toBeNull()
    // Stock purchases have no sale side.
    expect(summarizeOrder({ ...order, order_type: 'stock', order_value: null, buyer_entity_id: null }, quotes, []).buyerDue).toBeNull()
  })
})

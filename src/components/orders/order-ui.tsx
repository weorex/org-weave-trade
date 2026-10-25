import type { FormField } from '@/components/trade/trade-form'
import { formatMoney } from '@/services/trade-schemas'
import { incoterms, label, orderStatuses, type Money } from '@/services/order-schemas'
import type { Party } from '@/services/orders.functions'

export const currencies = Intl.supportedValuesOf('currency').map(c => ({ value: c, label: c }))
/** "USD 1,200 + INR 50,000": amounts stay per currency; no exchange rates are guessed. */
export function moneyText(m: Money | null | undefined) {
  const parts = Object.entries(m ?? {}).filter(([, v]) => Math.abs(v) > 0.000001).map(([c, v]) => formatMoney(Math.round(v * 100) / 100, c))
  return parts.length ? parts.join(' + ') : '—'
}
const statusTone: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground', sourcing: 'bg-amber-100 text-amber-900', confirmed: 'bg-sky-100 text-sky-900', in_production: 'bg-indigo-100 text-indigo-900',
  shipped: 'bg-violet-100 text-violet-900', delivered: 'bg-emerald-100 text-emerald-900', closed: 'bg-emerald-200 text-emerald-950', cancelled: 'bg-red-100 text-red-900',
  pending: 'bg-amber-100 text-amber-900', accepted: 'bg-emerald-100 text-emerald-900', rejected: 'bg-red-100 text-red-900', withdrawn: 'bg-muted text-muted-foreground', superseded: 'bg-muted text-muted-foreground',
}
export function Badge({ value }: { value: string }) { return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${statusTone[value] ?? 'bg-muted'}`}>{label(value)}</span> }
export function TypeBadge({ type }: { type: string }) {
  return type === 'export' ? <span className="inline-flex rounded-md border border-primary/30 bg-accent px-2 py-0.5 text-xs font-semibold text-primary whitespace-nowrap">Export order</span> : <span className="inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Stock purchase</span>
}
export const partyLabel = (p: Party) => `${p.name} — ${p.typeName}${p.logisticsKind ? ` (${label(p.logisticsKind)})` : ''}`
// Buyer-like types first so the export order buyer is easy to find.
export const buyerOptions = (parties: Party[]) => [...parties].sort((a, b) => Number(/buyer|importer|customer/i.test(b.typeName)) - Number(/buyer|importer|customer/i.test(a.typeName))).map(p => ({ value: p.id, label: partyLabel(p) }))
export function orderFields(type: 'export' | 'stock', parties: Party[], withNumber: boolean, withStatus: boolean): FormField[] {
  return [
    ...(withNumber ? [{ key: 'order_number', label: 'Order number', required: true }] : []),
    { key: 'title', label: type === 'export' ? 'Short title (e.g. 20 t turmeric to Dubai)' : 'Short title (e.g. Packaging stock Nov)', required: true },
    ...(type === 'export' ? [{ key: 'buyer_entity_id', label: 'Buyer', kind: 'select' as const, required: true, options: buyerOptions(parties) }] : []),
    ...(withStatus ? [{ key: 'status', label: 'Status', kind: 'select' as const, required: true, options: orderStatuses.map(s => ({ value: s, label: label(s) })) }] : []),
    { key: 'currency', label: 'Order currency', kind: 'select' as const, required: true, options: currencies },
    ...(type === 'export' ? [{ key: 'order_value', label: 'Sale value to buyer', kind: 'number' as const }] : []),
    { key: 'incoterm', label: 'Incoterm', kind: 'select' as const, options: incoterms.filter(Boolean).map(i => ({ value: i, label: i })) },
    { key: 'destination', label: type === 'export' ? 'Destination (port / city)' : 'Deliver to (warehouse)' },
    { key: 'required_by', label: 'Required by', kind: 'date' as const },
    { key: 'notes', label: 'Notes', kind: 'textarea' as const },
  ]
}

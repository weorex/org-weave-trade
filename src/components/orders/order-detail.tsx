import { useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { ArrowLeft, Check, Download, FileText, Pencil, Plus, RotateCcw, Trash2, Upload, Wallet, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormDialog } from '@/components/form-dialog'
import { TradeForm } from '@/components/trade/trade-form'
import { supabase } from '@/integrations/supabase/client'
import { addOrderDocument, addOrderItem, addOrderNote, addOrderPayment, addOrderQuote, decideOrderQuote, openOrderDocument, removeOrderItem, removeOrderPayment, updateOrder, type OrderDetail, type OrderQuote } from '@/services/orders.functions'
import { decisionSchema, documentTypes, itemSchema, label, mayManageOrders, orderStatuses, orderUpdateSchema, paymentMethods, paymentSchema, quoteSchema } from '@/services/order-schemas'
import { formatMoney } from '@/services/trade-schemas'
import { Badge, TypeBadge, currencies, moneyText, orderFields, partyLabel } from './order-ui'

type Tab = 'overview' | 'items' | 'supplier' | 'logistics' | 'payments' | 'documents' | 'timeline'
type Dialog = { kind: 'edit' | 'item' | 'quote' | 'decision' | 'payment'; title: string; initial: Record<string, unknown>; scope?: 'supplier' | 'logistics' | 'in' | 'out'; partyId?: string | undefined } | null
const today = () => new Date().toISOString().slice(0, 10)
const eventLabels: Record<string, string> = {
  'order.created': 'Order created', 'order.status': 'Status changed', 'order.updated': 'Order details updated', 'item.added': 'Item added', 'item.removed': 'Item removed',
  'quote.received': 'Quote received', 'quote.revised': 'Revised quote received', 'quote.accepted': 'Quote accepted', 'quote.rejected': 'Quote rejected', 'quote.withdrawn': 'Quote withdrawn',
  'payment.recorded': 'Payment recorded', 'payment.removed': 'Payment removed', 'document.added': 'Document added', note: 'Note',
}
const isLogistics = (kind: string) => kind === 'shipping' || kind === 'transport'

export function OrderDetailView({ org, userId, data }: { org: string; userId: string; data: OrderDetail }) {
  const cache = useQueryClient(); const o = data.order; const manage = mayManageOrders(data.role); const exportOrder = o.order_type === 'export'
  const [tab, setTab] = useState<Tab>('overview'), [dialog, setDialog] = useState<Dialog>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [note, setNote] = useState(''), [docType, setDocType] = useState<string>('proforma_invoice')
  const update = useServerFn(updateOrder), addItem = useServerFn(addOrderItem), removeItem = useServerFn(removeOrderItem), addQuote = useServerFn(addOrderQuote), decide = useServerFn(decideOrderQuote)
  const addPayment = useServerFn(addOrderPayment), removePayment = useServerFn(removeOrderPayment), addNote = useServerFn(addOrderNote), addDocument = useServerFn(addOrderDocument), openDocument = useServerFn(openOrderDocument)
  const party = (id: string | null) => data.parties.find(p => p.id === id)
  const name = (id: string | null) => party(id)?.name ?? '—'
  const quoteName = (q: OrderQuote | undefined) => q ? (q.quote_number || 'quote without number') : ''
  async function refresh() { await cache.invalidateQueries({ queryKey: ['orders', userId, org] }) }
  async function run(work: () => Promise<unknown>) { setBusy(true); setError(''); try { await work(); await refresh() } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong') } finally { setBusy(false) } }
  const current = { order_type: o.order_type, status: o.status, buyer_entity_id: o.buyer_entity_id, title: o.title, currency: o.currency, order_value: o.order_value, incoterm: o.incoterm, destination: o.destination, required_by: o.required_by, notes: o.notes }
  const setStatus = (status: string) => run(() => update({ data: { organizationId: org, orderId: o.id, order: orderUpdateSchema.parse({ ...current, status }) } }))
  const supplierQuotes = data.quotes.filter(q => !isLogistics(q.kind)), logisticsQuotes = data.quotes.filter(q => isLogistics(q.kind))
  const acceptedQuotes = data.quotes.filter(q => q.status === 'accepted')
  const s = data.summary

  const openQuote = (scope: 'supplier' | 'logistics', revise?: OrderQuote) => setDialog({ kind: 'quote', scope, title: revise ? `Revised quote from ${name(revise.party_entity_id)}` : scope === 'supplier' ? 'New supplier quote' : 'New logistics quote', partyId: revise?.party_entity_id,
    initial: { received_on: today(), currency: revise?.currency ?? o.currency, kind: revise?.kind ?? (scope === 'supplier' ? 'supplier' : 'shipping'), party_entity_id: revise?.party_entity_id ?? '', revises_quote_id: revise?.id ?? null, description: revise?.description ?? '' } })
  const openPayment = (direction: 'in' | 'out', q?: OrderQuote) => {
    const owed = q ? (s.due.find(d => d.partyId === q.party_entity_id)?.due[q.currency] ?? q.amount) : null
    setDialog({ kind: 'payment', scope: direction, title: direction === 'in' ? 'Payment received from buyer' : q ? `Payment to ${name(q.party_entity_id)}` : 'Payment to supplier / logistics partner',
      initial: { direction, paid_on: today(), method: 'bank_transfer', currency: q?.currency ?? o.currency, party_entity_id: direction === 'in' ? o.buyer_entity_id : q?.party_entity_id ?? '', quote_id: q?.id ?? null, amount: owed !== null && owed > 0 ? owed : '' } })
  }
  const decideDialog = (q: OrderQuote, status: 'accepted' | 'rejected' | 'withdrawn') => setDialog({ kind: 'decision', title: `${label(status === 'accepted' ? 'accept' : status === 'rejected' ? 'reject' : 'withdraw')} ${quoteName(q)} from ${name(q.party_entity_id)}`, initial: { quoteId: q.id, status, note: '' } })

  const tabs: [Tab, string, number?][] = [['overview', 'Overview'], ['items', 'Items', data.items.length], ['supplier', 'Supplier quotes', supplierQuotes.length], ['logistics', 'Logistics quotes', logisticsQuotes.length], ['payments', 'Payments', data.payments.length], ['documents', 'Documents', data.documents.length], ['timeline', 'Timeline', data.events.length]]
  const stat = (title: string, value: ReactNode, sub?: ReactNode) => <article className="stat-item"><p className="text-xs text-muted-foreground">{title}</p><p className="mt-3 text-xl font-semibold">{value}</p>{sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}</article>

  return <main className="mx-auto max-w-[1500px] px-5 py-8 md:px-9">
    <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2"><Link to="/orders" search={{ org }}><ArrowLeft/>All orders</Link></Button>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold">{o.order_number}</h1><TypeBadge type={o.order_type}/><Badge value={o.status}/></div>
      <p className="mt-2 text-muted-foreground">{o.title}{exportOrder && <> · Buyer: <span className="font-medium text-foreground">{name(o.buyer_entity_id)}</span></>}{o.destination && <> · {o.incoterm && `${o.incoterm} `}{o.destination}</>}</p></div>
      {manage && <div className="flex flex-wrap items-center gap-2"><select className="native-select" aria-label="Order status" value={o.status} disabled={busy} onChange={e => void setStatus(e.target.value)}>{orderStatuses.map(st => <option key={st} value={st}>{label(st)}</option>)}</select><Button variant="outline" onClick={() => setDialog({ kind: 'edit', title: 'Edit order', initial: current })}><Pencil/>Edit</Button></div>}</div>
    <section className="stats-grid mb-8">{exportOrder ? <>
      {stat('Sale value', o.order_value === null ? '—' : formatMoney(o.order_value, o.currency), o.order_value === null ? 'Add it with Edit' : undefined)}
      {stat('Accepted costs', moneyText(s.cost), 'Supplier + logistics quotes accepted')}
      {stat('Margin', s.margin === null ? '—' : formatMoney(s.margin, o.currency), s.mixedCurrency ? 'Costs are in several currencies' : s.margin === null ? 'Needs a sale value' : undefined)}
      {stat('Received from buyer', moneyText(s.paidIn), s.buyerDue !== null ? `Buyer still owes ${formatMoney(Math.max(0, s.buyerDue), o.currency)}` : undefined)}
      {stat('Paid out', moneyText(s.paidOut), `Still to pay ${moneyText(s.outstandingOut)}`)}
    </> : <>
      {stat('Accepted costs', moneyText(s.cost), 'Supplier + transport quotes accepted')}
      {stat('Paid out', moneyText(s.paidOut))}
      {stat('Still to pay', moneyText(s.outstandingOut))}
    </>}</section>
    <nav className="mb-6 flex flex-wrap gap-1 border-b">{tabs.map(([key, text, count]) => <Button key={key} variant="ghost" className={tab === key ? 'rounded-none border-b-2 border-primary text-primary' : 'rounded-none'} onClick={() => { setTab(key); setError('') }}>{text}{count !== undefined && <span className="text-xs text-muted-foreground">{count}</span>}</Button>)}</nav>
    {error && <p role="alert" className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

    {tab === 'overview' && <div className="grid gap-8 lg:grid-cols-2">
      <section><div className="section-heading mb-3"><h2>Order details</h2></div><dl className="details-list">{[['Type', exportOrder ? 'Export order (for a buyer)' : 'Stock purchase (own inventory)'], ...(exportOrder ? [['Buyer', name(o.buyer_entity_id)]] : []), ['Status', label(o.status)], ['Currency', o.currency], ['Incoterm', o.incoterm || '—'], [exportOrder ? 'Destination' : 'Deliver to', o.destination || '—'], ['Required by', o.required_by ?? '—'], ['Created', new Date(o.created_at).toLocaleDateString()], ['Notes', o.notes || '—']].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></section>
      <section><div className="section-heading mb-3"><h2>Who's involved</h2></div>{s.due.length || exportOrder ? <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Company</th><th>Role</th><th>Accepted</th><th>Paid</th><th>Still to pay</th></tr></thead><tbody>
        {exportOrder && <tr><td className="font-medium">{name(o.buyer_entity_id)}</td><td>Buyer</td><td>{o.order_value === null ? '—' : formatMoney(o.order_value, o.currency)}</td><td>{moneyText(s.paidIn)}</td><td>{s.buyerDue === null ? '—' : `Owes ${formatMoney(Math.max(0, s.buyerDue), o.currency)}`}</td></tr>}
        {s.due.map(d => <tr key={d.partyId}><td className="font-medium">{name(d.partyId)}</td><td>{party(d.partyId)?.typeName ?? '—'}</td><td>{moneyText(d.accepted)}</td><td>{moneyText(d.paid)}</td><td>{moneyText(d.due)}</td></tr>)}
      </tbody></table></div> : <p className="text-sm text-muted-foreground">No accepted quotes or payments yet.</p>}
        <ol className="mt-6 grid gap-2 text-sm text-muted-foreground"><li>1. Add the <b>items</b> being bought.</li><li>2. Collect <b>supplier quotes</b> and <b>logistics quotes</b>; accept or reject each (reject asks for a reason, revise keeps the history).</li><li>3. Record <b>payments</b>{exportOrder ? ' received from the buyer and' : ''} paid to each partner.</li><li>4. Upload <b>documents</b> (PI, PO, invoice, B/L) and move the <b>status</b> forward.</li></ol></section>
    </div>}

    {tab === 'items' && <section><div className="section-heading mb-3"><h2>Items</h2>{manage && <Button size="sm" variant="outline" onClick={() => setDialog({ kind: 'item', title: 'Add item', initial: { unit: 'kg' } })}><Plus/>Add item</Button>}</div>
      {data.items.length ? <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Item</th><th>Quantity</th><th>Target price</th><th>Notes</th><th/></tr></thead><tbody>{data.items.map(i => <tr key={i.id}><td className="font-medium">{i.description}{i.product_id && <p className="text-xs text-muted-foreground">{data.products.find(p => p.id === i.product_id)?.sku}</p>}</td><td>{i.quantity} {i.unit}</td><td>{i.target_price === null ? '—' : `${formatMoney(i.target_price, o.currency)} / ${i.unit}`}</td><td>{i.notes || '—'}</td><td>{manage && <Button variant="ghost" size="icon" title="Remove item" aria-label={`Remove ${i.description}`} disabled={busy} onClick={() => window.confirm('Remove this item?') && void run(() => removeItem({ data: { organizationId: org, orderId: o.id, itemId: i.id } }))}><Trash2/></Button>}</td></tr>)}</tbody></table></div> : <p className="py-6 text-sm text-muted-foreground">No items yet. Add what is being bought, with quantity and target price.</p>}
    </section>}

    {(tab === 'supplier' || tab === 'logistics') && <QuoteBoard quotes={tab === 'supplier' ? supplierQuotes : logisticsQuotes} all={data.quotes} name={name} typeName={id => party(id)?.typeName ?? ''} manage={manage} busy={busy}
      heading={tab === 'supplier' ? 'Supplier quotes' : 'Logistics quotes'} hint={tab === 'supplier' ? 'Quotes from manufacturers and suppliers for this order, grouped by company.' : 'Freight and transport quotes from shipping agents and transporters for this order.'}
      onAdd={() => openQuote(tab)} onRevise={q => openQuote(tab, q)} onDecide={decideDialog} onPay={q => openPayment('out', q)}/>}

    {tab === 'payments' && <div className="grid gap-8">
      {exportOrder && <PaymentTable title="Received from buyer" rows={data.payments.filter(p => p.direction === 'in')} name={name} quoteName={id => quoteName(data.quotes.find(q => q.id === id))} manage={manage} busy={busy} onAdd={() => openPayment('in')} onRemove={id => run(() => removePayment({ data: { organizationId: org, orderId: o.id, paymentId: id } }))}/>}
      <PaymentTable title="Paid to suppliers & logistics" rows={data.payments.filter(p => p.direction === 'out')} name={name} quoteName={id => quoteName(data.quotes.find(q => q.id === id))} manage={manage} busy={busy} onAdd={() => openPayment('out')} onRemove={id => run(() => removePayment({ data: { organizationId: org, orderId: o.id, paymentId: id } }))}/>
    </div>}

    {tab === 'documents' && <section><div className="section-heading mb-3"><h2>Documents</h2></div>
      {manage && <div className="mb-5 flex flex-wrap items-end gap-3 rounded-md border p-4"><label className="field-label">Document type<select className="native-select" value={docType} onChange={e => setDocType(e.target.value)}>{documentTypes.map(t => <option key={t} value={t}>{label(t)}</option>)}</select></label>
        <label className="field-label">File (max 10 MB)<Input type="file" disabled={busy} onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
          const path = `${org}/${o.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
          await run(async () => { if (file.size > 10 * 1024 * 1024) throw new Error('Documents must be under 10 MB'); const up = await supabase.storage.from('order-documents').upload(path, file, { upsert: false }); if (up.error) throw new Error('Unable to upload document')
            try { await addDocument({ data: { organizationId: org, orderId: o.id, document: { doc_type: docType as typeof documentTypes[number], name: file.name, object_path: path } } }) } catch (err) { await supabase.storage.from('order-documents').remove([path]); throw err } }) }}/></label>{busy && <span className="flex items-center gap-2 text-sm"><Upload className="size-4"/>Uploading…</span>}</div>}
      {data.documents.length ? data.documents.map(d => <div key={d.id} className="flex flex-wrap items-center justify-between gap-4 border-b py-3"><span className="flex items-center gap-3"><FileText className="size-4 text-primary"/><span className="font-medium">{d.name}</span><span className="text-xs text-muted-foreground">{label(d.doc_type)} · {new Date(d.created_at).toLocaleDateString()}</span></span><Button variant="outline" size="sm" onClick={() => run(async () => { const r = await openDocument({ data: { organizationId: org, id: d.id } }); window.open(r.url, '_blank', 'noopener') })}><Download/>Open</Button></div>) : <p className="py-6 text-sm text-muted-foreground">No documents yet.</p>}
    </section>}

    {tab === 'timeline' && <section><div className="section-heading mb-3"><h2>Timeline</h2></div>
      {manage && <div className="mb-6 grid gap-2"><Textarea placeholder="Add a note (e.g. called supplier, sample approved)…" value={note} maxLength={2000} onChange={e => setNote(e.target.value)}/><Button className="justify-self-start" size="sm" disabled={busy || !note.trim()} onClick={() => run(async () => { await addNote({ data: { organizationId: org, orderId: o.id, note } }); setNote('') })}><Plus/>Add note</Button></div>}
      <ol className="grid gap-0">{data.events.map(e => <li key={e.id} className="flex gap-4 border-b py-3"><span className="w-40 shrink-0 text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span><div><p className="text-sm font-medium">{eventLabels[e.action] ?? label(e.action)}</p><p className="text-sm text-muted-foreground">{e.detail}</p><p className="mt-1 text-xs text-muted-foreground">{data.members.find(m => m.id === e.actor_user_id)?.name || 'System'}</p></div></li>)}</ol>
    </section>}

    <FormDialog open={!!dialog} onClose={() => setDialog(null)} title={dialog?.title ?? ''} wide={dialog?.kind === 'edit' || dialog?.kind === 'quote' || dialog?.kind === 'payment'}>
      {dialog?.kind === 'edit' && <TradeForm fields={orderFields(exportOrder ? 'export' : 'stock', data.parties, false, true)} schema={orderUpdateSchema} initial={dialog.initial} onCancel={() => setDialog(null)} onSave={async v => { await update({ data: { organizationId: org, orderId: o.id, order: orderUpdateSchema.parse(v) } }); setDialog(null); await refresh() }}/>}
      {dialog?.kind === 'item' && <TradeForm fields={[{ key: 'product_id', label: 'Catalogue product (optional)', kind: 'select', options: data.products.map(p => ({ value: p.id, label: `${p.sku} · ${p.name}` })) }, { key: 'description', label: 'Description', required: true }, { key: 'quantity', label: 'Quantity', kind: 'number', required: true }, { key: 'unit', label: 'Unit (kg, tonne, piece, carton…)', required: true }, { key: 'target_price', label: `Target price per unit (${o.currency})`, kind: 'number' }, { key: 'notes', label: 'Notes', kind: 'textarea' }]}
        schema={itemSchema} initial={dialog.initial} onCancel={() => setDialog(null)} onSave={async v => { const item = itemSchema.parse({ ...v, description: v['description'] || data.products.find(p => p.id === v['product_id'])?.name }); await addItem({ data: { organizationId: org, orderId: o.id, item } }); setDialog(null); await refresh() }}/>}
      {dialog?.kind === 'quote' && <TradeForm key={JSON.stringify(dialog.initial)} schema={quoteSchema} initial={dialog.initial} onCancel={() => setDialog(null)} label="Save quote"
        fields={[{ key: 'party_entity_id', label: dialog.scope === 'supplier' ? 'Manufacturer / supplier' : 'Shipping agent / transporter', kind: 'select', required: true, options: data.parties.filter(p => dialog.partyId ? p.id === dialog.partyId : dialog.scope === 'logistics' ? !!p.logisticsKind : !p.logisticsKind && p.id !== o.buyer_entity_id).map(p => ({ value: p.id, label: partyLabel(p) })) },
          { key: 'kind', label: 'Quote for', kind: 'select', required: true, options: (dialog.scope === 'supplier' ? ['supplier', 'other'] : ['shipping', 'transport']).map(k => ({ value: k, label: k === 'supplier' ? 'Goods (supplier)' : k === 'other' ? 'Other service' : label(k) })) },
          { key: 'quote_number', label: 'Their quote number' }, { key: 'amount', label: 'Total amount', kind: 'number', required: true }, { key: 'currency', label: 'Currency', kind: 'select', required: true, options: currencies },
          { key: 'received_on', label: 'Received on', kind: 'date', required: true }, { key: 'valid_until', label: 'Valid until', kind: 'date' }, { key: 'description', label: 'What is quoted (e.g. 20 t @ 2.40/kg, FOB Chennai)', kind: 'textarea' }, { key: 'notes', label: 'Notes', kind: 'textarea' }]}
        onSave={async v => { await addQuote({ data: { organizationId: org, orderId: o.id, quote: quoteSchema.parse(v) } }); setDialog(null); await refresh() }}/>}
      {dialog?.kind === 'decision' && <TradeForm schema={decisionSchema} initial={dialog.initial} label={dialog.initial['status'] === 'accepted' ? 'Accept quote' : dialog.initial['status'] === 'rejected' ? 'Reject quote' : 'Withdraw acceptance'} onCancel={() => setDialog(null)}
        fields={[{ key: 'note', label: dialog.initial['status'] === 'accepted' ? 'Note (optional)' : 'Reason (required, e.g. price too high, delivery too late)', kind: 'textarea', required: dialog.initial['status'] !== 'accepted' }]}
        onSave={async v => { await decide({ data: { organizationId: org, decision: decisionSchema.parse(v) } }); setDialog(null); await refresh() }}/>}
      {dialog?.kind === 'payment' && <TradeForm key={JSON.stringify(dialog.initial)} schema={paymentSchema} initial={dialog.initial} label="Record payment" onCancel={() => setDialog(null)}
        fields={[{ key: 'party_entity_id', label: dialog.scope === 'in' ? 'Received from (buyer)' : 'Paid to', kind: 'select', required: true, options: (dialog.scope === 'in' ? data.parties.filter(p => p.id === o.buyer_entity_id) : [...data.parties].sort((a, b) => Number(acceptedQuotes.some(q => q.party_entity_id === b.id)) - Number(acceptedQuotes.some(q => q.party_entity_id === a.id)))).map(p => ({ value: p.id, label: partyLabel(p) })) },
          ...(dialog.scope === 'out' ? [{ key: 'quote_id', label: 'For accepted quote (optional)', kind: 'select' as const, options: acceptedQuotes.map(q => ({ value: q.id, label: `${name(q.party_entity_id)} · ${quoteName(q)} · ${formatMoney(q.amount, q.currency)}` })) }] : []),
          { key: 'amount', label: 'Amount', kind: 'number', required: true }, { key: 'currency', label: 'Currency', kind: 'select', required: true, options: currencies }, { key: 'paid_on', label: dialog.scope === 'in' ? 'Received on' : 'Paid on', kind: 'date', required: true },
          { key: 'method', label: 'Method', kind: 'select', required: true, options: paymentMethods.map(m => ({ value: m, label: label(m) })) }, { key: 'reference', label: 'Reference (UTR / LC / cheque no.)' }, { key: 'notes', label: 'Notes', kind: 'textarea' }]}
        onSave={async v => { await addPayment({ data: { organizationId: org, orderId: o.id, payment: paymentSchema.parse(v) } }); setDialog(null); await refresh() }}/>}
    </FormDialog>
  </main>
}

function QuoteBoard({ quotes, all, name, typeName, manage, busy, heading, hint, onAdd, onRevise, onDecide, onPay }: {
  quotes: OrderQuote[]; all: OrderQuote[]; name: (id: string) => string; typeName: (id: string) => string; manage: boolean; busy: boolean; heading: string; hint: string
  onAdd: () => void; onRevise: (q: OrderQuote) => void; onDecide: (q: OrderQuote, status: 'accepted' | 'rejected' | 'withdrawn') => void; onPay: (q: OrderQuote) => void
}) {
  const parties = [...new Set(quotes.map(q => q.party_entity_id))]
  return <section><div className="section-heading mb-1"><h2>{heading}</h2>{manage && <Button size="sm" variant="outline" onClick={onAdd}><Plus/>Add quote</Button>}</div><p className="mb-5 text-sm text-muted-foreground">{hint}</p>
    {!parties.length && <p className="py-6 text-sm text-muted-foreground">No quotes yet.</p>}
    <div className="grid gap-5">{parties.map(id => <article key={id} className="rounded-lg border bg-card"><header className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3"><p className="font-semibold">{name(id)}</p><span className="text-xs text-muted-foreground">{typeName(id)}</span></header>
      <ul>{quotes.filter(q => q.party_entity_id === id).map(q => { const revised = all.find(v => v.id === q.revises_quote_id); return <li key={q.id} className={`flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3 last:border-b-0 ${q.status === 'superseded' || q.status === 'withdrawn' || q.status === 'rejected' ? 'opacity-70' : ''}`}>
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{q.quote_number || 'No quote number'}</span><Badge value={q.status}/><span className="text-xs text-muted-foreground">{label(q.kind)}</span></div>
          <p className="mt-1 text-lg font-semibold">{formatMoney(q.amount, q.currency)}</p>
          <p className="text-xs text-muted-foreground">Received {q.received_on}{q.valid_until && ` · valid until ${q.valid_until}`}{revised && ` · revision of ${revised.quote_number || 'earlier quote'}`}</p>
          {q.description && <p className="mt-1 text-sm">{q.description}</p>}
          {q.decision_note && <p className="mt-1 text-sm"><span className="text-muted-foreground">{q.status === 'accepted' ? 'Note' : 'Reason'}:</span> {q.decision_note}</p>}</div>
        {manage && <div className="flex flex-wrap gap-2">{q.status === 'pending' && <><Button size="sm" disabled={busy} onClick={() => onDecide(q, 'accepted')}><Check/>Accept</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => onDecide(q, 'rejected')}><X/>Reject</Button></>}
          {(q.status === 'pending' || q.status === 'rejected') && <Button size="sm" variant="outline" disabled={busy} title="They sent a new price: record it as a revision" onClick={() => onRevise(q)}><RotateCcw/>Revised quote</Button>}
          {q.status === 'accepted' && <><Button size="sm" variant="outline" disabled={busy} onClick={() => onPay(q)}><Wallet/>Record payment</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => onDecide(q, 'withdrawn')}>Withdraw</Button></>}</div>}
      </li> })}</ul></article>)}</div>
  </section>
}

function PaymentTable({ title, rows, name, quoteName, manage, busy, onAdd, onRemove }: { title: string; rows: OrderDetail['payments']; name: (id: string) => string; quoteName: (id: string | null) => string; manage: boolean; busy: boolean; onAdd: () => void; onRemove: (id: string) => void }) {
  const totals: Record<string, number> = {}; for (const p of rows) totals[p.currency] = (totals[p.currency] ?? 0) + Number(p.amount)
  return <section><div className="section-heading mb-3"><h2>{title} <span className="text-sm font-normal text-muted-foreground">{moneyText(totals)}</span></h2>{manage && <Button size="sm" variant="outline" onClick={onAdd}><Plus/>Record payment</Button>}</div>
    {rows.length ? <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Date</th><th>{title.startsWith('Received') ? 'From' : 'To'}</th><th>Amount</th><th>Method</th><th>Reference</th><th>For quote</th><th>Notes</th><th/></tr></thead><tbody>{rows.map(p => <tr key={p.id}><td>{p.paid_on}</td><td className="font-medium">{name(p.party_entity_id)}</td><td>{formatMoney(p.amount, p.currency)}</td><td>{label(p.method)}</td><td>{p.reference || '—'}</td><td>{p.quote_id ? quoteName(p.quote_id) : '—'}</td><td>{p.notes || '—'}</td><td>{manage && <Button variant="ghost" size="icon" title="Remove wrong entry (kept in timeline)" aria-label="Remove payment" disabled={busy} onClick={() => window.confirm('Remove this payment entry? The removal is recorded in the timeline.') && onRemove(p.id)}><Trash2/></Button>}</td></tr>)}</tbody></table></div> : <p className="py-4 text-sm text-muted-foreground">None yet.</p>}
  </section>
}

import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { ClipboardList, Plus, Ship, Warehouse } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormDialog } from '@/components/form-dialog'
import { TradeForm } from '@/components/trade/trade-form'
import { createOrder, type OrderList } from '@/services/orders.functions'
import { orderSchema, orderStatuses, label, mayManageOrders } from '@/services/order-schemas'
import { formatMoney } from '@/services/trade-schemas'
import { Badge, TypeBadge, moneyText, orderFields } from './order-ui'

export function OrdersList({ org, userId, data }: { org: string; userId: string; data: OrderList }) {
  const navigate = useNavigate(); const cache = useQueryClient(); const create = useServerFn(createOrder)
  const manage = mayManageOrders(data.role)
  const [type, setType] = useState(''), [status, setStatus] = useState(''), [party, setParty] = useState(''), [search, setSearch] = useState('')
  const [newType, setNewType] = useState<'export' | 'stock' | null>(null), [choosing, setChoosing] = useState(false)
  const name = (id: string | null) => data.parties.find(p => p.id === id)?.name ?? '—'
  const year = new Date().getFullYear()
  const nextNumber = (t: 'export' | 'stock') => { const prefix = `${t === 'export' ? 'EX' : 'PO'}-${year}-`; const used = data.orders.filter(o => o.order_number.startsWith(prefix)).map(o => Number(o.order_number.slice(prefix.length)) || 0); return prefix + String(Math.max(0, ...used) + 1).padStart(3, '0') }
  const rows = data.orders.filter(o => (!type || o.order_type === type) && (!status || o.status === status) && (!party || o.buyer_entity_id === party || o.partyIds.includes(party))
    && (!search || `${o.order_number} ${o.title} ${name(o.buyer_entity_id)} ${o.destination}`.toLowerCase().includes(search.toLowerCase())))
  const open = (id: string) => void navigate({ to: '/orders', search: { org, id } })
  const involved = data.parties.filter(p => data.orders.some(o => o.buyer_entity_id === p.id || o.partyIds.includes(p.id)))
  return <main className="mx-auto max-w-[1500px] px-5 py-8 md:px-9">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><div className="mb-3 text-primary"><ClipboardList/></div><h1 className="text-3xl font-semibold">Orders</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">One place per deal. An order links the buyer, the manufacturers' and logistics partners' quotes (accepted, rejected, revised), every payment in and out, documents and a full timeline.</p></div>
      {manage && <Button onClick={() => setChoosing(true)}><Plus/>New order</Button>}</div>
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <label className="field-label min-w-0 flex-1">Search<Input placeholder="Order number, title, buyer, destination…" value={search} onChange={e => setSearch(e.target.value)}/></label>
      <label className="field-label">Type<select className="native-select" value={type} onChange={e => setType(e.target.value)}><option value="">All orders</option><option value="export">Export orders</option><option value="stock">Stock purchases</option></select></label>
      <label className="field-label">Status<select className="native-select" value={status} onChange={e => setStatus(e.target.value)}><option value="">Any status</option>{orderStatuses.map(s => <option key={s} value={s}>{label(s)}</option>)}</select></label>
      <label className="field-label">Company<select className="native-select max-w-64" value={party} onChange={e => setParty(e.target.value)}><option value="">Any buyer or partner</option>{involved.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    </div>
    {rows.length ? <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Order</th><th>Type</th><th>Buyer</th><th>Status</th><th>Sale value</th><th>Accepted costs</th><th>Received</th><th>Paid out</th><th>Still to pay</th><th>Required by</th></tr></thead>
      <tbody>{rows.map(o => <tr key={o.id} className="cursor-pointer" onClick={() => open(o.id)}>
        <td><Link to="/orders" search={{ org, id: o.id }} className="font-medium text-primary hover:underline" onClick={e => e.stopPropagation()}>{o.order_number}</Link><p className="mt-1 max-w-72 truncate text-xs text-muted-foreground">{o.title}</p></td>
        <td><TypeBadge type={o.order_type}/></td><td>{o.order_type === 'export' ? name(o.buyer_entity_id) : <span className="text-muted-foreground">Own stock</span>}</td><td><Badge value={o.status}/></td>
        <td>{o.order_value === null ? '—' : formatMoney(o.order_value, o.currency)}</td><td>{moneyText(o.summary.cost)}</td><td>{o.order_type === 'export' ? moneyText(o.summary.paidIn) : '—'}</td><td>{moneyText(o.summary.paidOut)}</td><td>{moneyText(o.summary.outstandingOut)}</td><td>{o.required_by ?? '—'}</td>
      </tr>)}</tbody></table></div>
      : <div className="py-20 text-center"><ClipboardList className="mx-auto mb-4 size-9 text-primary"/><h2 className="text-lg font-semibold">{data.orders.length ? 'No orders match these filters' : 'No orders yet'}</h2><p className="mt-2 text-sm text-muted-foreground">Create an export order for a buyer, or a stock purchase for your own inventory.</p>{manage && !data.orders.length && <Button className="mt-5" onClick={() => setChoosing(true)}><Plus/>New order</Button>}</div>}
    <FormDialog open={choosing} onClose={() => setChoosing(false)} title="What kind of order?" description="This choice is permanent for the order, so payments and margin are always tracked the right way.">
      <div className="grid gap-4 sm:grid-cols-2">
        <button className="rounded-lg border p-5 text-left hover:border-primary hover:bg-accent" onClick={() => { setChoosing(false); setNewType('export') }}><Ship className="mb-3 text-primary"/><p className="font-semibold">Export order</p><p className="mt-2 text-sm text-muted-foreground">A buyer ordered from you. Link the buyer, collect supplier and freight quotes, record money received from the buyer and paid out, and see the margin.</p></button>
        <button className="rounded-lg border p-5 text-left hover:border-primary hover:bg-accent" onClick={() => { setChoosing(false); setNewType('stock') }}><Warehouse className="mb-3 text-primary"/><p className="font-semibold">Stock purchase</p><p className="mt-2 text-sm text-muted-foreground">You buy for your own stock. No buyer — collect supplier and transport quotes and record what you pay.</p></button>
      </div>
    </FormDialog>
    <FormDialog open={!!newType} onClose={() => setNewType(null)} title={newType === 'export' ? 'New export order' : 'New stock purchase'} wide>
      {newType && <TradeForm key={newType} fields={orderFields(newType, data.parties, true, false)} schema={orderSchema} label="Create order"
        initial={{ order_type: newType, order_number: nextNumber(newType), currency: data.currency, buyer_entity_id: null, order_value: null }}
        onCancel={() => setNewType(null)}
        onSave={async values => { const r = await create({ data: { organizationId: org, order: orderSchema.parse(values) } }); setNewType(null); await cache.invalidateQueries({ queryKey: ['orders', userId, org] }); open(r.id) }}/>}
    </FormDialog>
  </main>
}

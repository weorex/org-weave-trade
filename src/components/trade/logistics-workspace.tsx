import { useState } from 'react'
import { ArrowUpDown, ExternalLink } from 'lucide-react'
import { useServerFn } from '@tanstack/react-start'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Ship, Truck, MapPin, Plus, FileText, Download, Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TradeForm, type FormField } from './trade-form'
import { FormDialog } from '@/components/form-dialog'
import { addLogisticsRecord, openLogisticsDocument, type LogisticsWorkspaceData } from '@/services/logistics.functions'
import { logisticsProfileSchema, portSchema, routeSchema, assetSchema, areaSchema, rateSchema, containerTypes, rateValidity, mayManageLogistics } from '@/services/logistics-schemas'
import { addRelationship } from '@/services/trade.functions'
import { relationshipSchema, formatMoney } from '@/services/trade-schemas'
import { supabase } from '@/integrations/supabase/client'
type View = 'profiles' | 'routes' | 'vehicles' | 'areas' | 'rates' | 'ports' | 'documents' | 'activity' | 'relationships'
const views: { key: View; label: string; hint: string }[] = [
  { key: 'profiles', label: 'Partners', hint: 'Every shipping agent and transporter you work with. Click a partner to see all of their routes, vehicles, rates and documents in one place.' },
  { key: 'routes', label: 'Shipping routes', hint: 'Sea routes offered by shipping agents (port → port). Click a route to see its rate history, or a port or agent to jump to it.' },
  { key: 'vehicles', label: 'Vehicles', hint: 'Trucks, vans and trailers owned by transporters, with their capacity.' },
  { key: 'areas', label: 'Service areas', hint: 'Where each transporter picks up and delivers by road. Click an area to see its transport rates and vehicles.' },
  { key: 'rates', label: 'Rate history', hint: 'Every freight and transport quote received. Old quotes are kept as history, never overwritten. Pick an "As of" date to see which rates were valid then.' },
  { key: 'ports', label: 'Ports', hint: 'Ports used by shipping routes (UN/LOCODE codes). Click a port to see the routes from and to it.' },
  { key: 'documents', label: 'Documents', hint: 'Licences, contracts and certificates uploaded for partners. Files are private; links expire after a minute.' },
  { key: 'activity', label: 'Activity', hint: 'An automatic log of everything added in this workspace.' },
  { key: 'relationships', label: 'Relationships', hint: 'Links between partners and other companies, e.g. which transporter serves which manufacturer.' },
]
// A table cell is plain text or a link that opens the related record's detail.
type Cell = string | number | null | undefined | { text: string; open: () => void }
type Row = { id: string; cells: Record<string, Cell> }
type Detail = { kind: 'partner' | 'route' | 'port' | 'area'; id: string }
const today = () => new Date().toISOString().slice(0, 10)
const f = (key: string, label: string, kind?: FormField['kind'], options?: FormField['options']): FormField => ({ key, label, ...(kind ? { kind } : {}), ...(options ? { options } : {}) })
const opts = (values: readonly string[]) => values.map(value => ({ value, label: value.replaceAll('_', ' ') }))
export function LogisticsWorkspace({ org, userId, data }: { org: string; userId: string; data: LogisticsWorkspaceData }) {
  const [view, setView] = useState<View>('profiles'), [search, setSearch] = useState(''), [partner, setPartner] = useState(''), [mode, setMode] = useState(''), [currency, setCurrency] = useState(''), [validity, setValidity] = useState(''), [form, setForm] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [asOf, setAsOf] = useState(''), [partnerKind, setPartnerKind] = useState(''), [detail, setDetail] = useState<Detail | null>(null), [formInitial, setFormInitial] = useState<Record<string, unknown>>({}), [docPartner, setDocPartner] = useState('')
  const cache = useQueryClient(), save = useServerFn(addLogisticsRecord), openDocument = useServerFn(openLogisticsDocument), relate = useServerFn(addRelationship)
  const manage = mayManageLogistics(data.role)
  const names = data.profiles.map(p => ({ value: p.entity_id, label: p.legal_name }))
  const entityName = (id: string) => { const d = data.entities.find(e => e.id === id)?.data; return d && typeof d === 'object' && !Array.isArray(d) && typeof d['name'] === 'string' ? d['name'] : undefined }
  // Partners use their logistics legal name; other linked companies (e.g. manufacturers) use their record name.
  const name = (id: string | null | undefined) => !id ? '—' : names.find(p => p.value === id)?.label ?? entityName(id) ?? id.slice(0, 8)
  const entityOptions = data.entities.filter(e => !data.profiles.some(p => p.entity_id === e.id)).map(e => ({ value: e.id, label: entityName(e.id) ?? e.id.slice(0, 8) }))
  const agents = names.filter(n => data.profiles.find(p => p.entity_id === n.value)?.kind !== 'transporter')
  const transporters = names.filter(n => data.profiles.find(p => p.entity_id === n.value)?.kind !== 'shipping_agent')
  const ports = data.ports.map(p => ({ value: p.id, label: `${p.code} · ${p.name}` }))
  const portName = (id: string) => ports.find(p => p.value === id)?.label ?? '—'
  const routeName = (id: string) => { const r = data.routes.find(r => r.id === id); return r ? `${portName(r.origin_port_id)} → ${portName(r.destination_port_id)} · ${r.mode} ${r.container_type}` : '—' }
  const ratePartner = (r: LogisticsWorkspaceData['rates'][number]) => r.shipping_route_id ? data.routes.find(v => v.id === r.shipping_route_id)?.shipping_agent_entity_id : data.areas.find(v => v.id === r.service_area_id)?.transporter_entity_id
  const latestRate = (rates: LogisticsWorkspaceData['rates']) => { const r = [...rates].sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0]; return r ? `${formatMoney(r.amount, r.currency)} / ${r.unit}` : '—' }
  const isPartner = (id: string) => data.profiles.some(p => p.entity_id === id)
  const partnerCell = (id: string | null | undefined): Cell => id && isPartner(id) ? { text: name(id), open: () => setDetail({ kind: 'partner', id }) } : name(id)
  const portCell = (id: string): Cell => ({ text: portName(id), open: () => setDetail({ kind: 'port', id }) })
  const routeCell = (id: string): Cell => ({ text: routeName(id), open: () => setDetail({ kind: 'route', id }) })
  const areaCell = (id: string | null): Cell => { const a = data.areas.find(v => v.id === id); return a ? { text: a.name, open: () => setDetail({ kind: 'area', id: a.id }) } : '—' }
  const routesOf = (id: string) => data.routes.filter(r => r.shipping_agent_entity_id === id), vehiclesOf = (id: string) => data.assets.filter(a => a.transporter_entity_id === id)
  const areasOf = (id: string) => data.areas.filter(a => a.transporter_entity_id === id), ratesOf = (id: string) => data.rates.filter(r => ratePartner(r) === id)
  const transitText = (min: number, max: number) => `${min}–${max} days`
  const rateRow = (r: LogisticsWorkspaceData['rates'][number], on = asOf): Row => ({ id: r.id, cells: { Partner: partnerCell(ratePartner(r)), Service: r.shipping_route_id ? routeCell(r.shipping_route_id) : areaCell(r.service_area_id), Vehicle: data.assets.find(a => a.id === r.asset_id)?.registration ?? 'Any', Rate: formatMoney(r.amount, r.currency), Unit: r.unit, 'Min qty': r.min_quantity, From: r.valid_from, Until: r.valid_until, Status: on ? rateValidity(r, on) : '—' } })
  const routeRow = (r: LogisticsWorkspaceData['routes'][number]): Row => ({ id: r.id, cells: { Agent: partnerCell(r.shipping_agent_entity_id), Route: routeCell(r.id), Transit: transitText(r.transit_min_days, r.transit_max_days), Frequency: r.frequency, 'Latest rate': latestRate(data.rates.filter(v => v.shipping_route_id === r.id)) } })
  const vehicleRow = (a: LogisticsWorkspaceData['assets'][number]): Row => ({ id: a.id, cells: { Transporter: partnerCell(a.transporter_entity_id), Registration: a.registration, Vehicle: a.vehicle_type.replaceAll('_', ' '), 'Capacity kg': a.capacity_kg, 'Capacity cbm': a.capacity_cbm, Notes: a.notes } })
  const areaRow = (a: LogisticsWorkspaceData['areas'][number]): Row => ({ id: a.id, cells: { Transporter: partnerCell(a.transporter_entity_id), Area: areaCell(a.id), Country: a.country, Pickup: a.pickup_zone, Delivery: a.delivery_zone, Transit: transitText(a.transit_min_days, a.transit_max_days), 'Latest rate': latestRate(data.rates.filter(v => v.service_area_id === a.id)) } })
  const relationshipRow = (r: LogisticsWorkspaceData['relationships'][number]): Row => ({ id: r.id, cells: { From: partnerCell(r.source_entity_id), Relationship: r.relationship_type, To: partnerCell(r.target_entity_id), Notes: r.notes } })
  const activityRow = (a: LogisticsWorkspaceData['activity'][number]): Row => ({ id: a.id, cells: { Date: new Date(a.created_at).toLocaleString(), Partner: partnerCell(a.entity_id), Record: a.resource_type.replaceAll('_', ' '), Action: a.action } })
  const selected = (id: string | null | undefined) => !partner || id === partner
  const kindMatches = (kind: string) => !partnerKind || kind === partnerKind || kind === 'both'
  const rows: Row[] = view === 'profiles' ? data.profiles.filter(p => selected(p.entity_id) && kindMatches(p.kind)).map(p => ({ id: p.entity_id, cells: { Partner: partnerCell(p.entity_id), Type: p.kind.replaceAll('_', ' '), Country: p.country, Contact: [p.email, p.phone].filter(Boolean).join(' · '), Routes: routesOf(p.entity_id).length, Vehicles: vehiclesOf(p.entity_id).length, 'Service areas': areasOf(p.entity_id).length, Rates: ratesOf(p.entity_id).length } }))
    : view === 'routes' ? data.routes.filter(r => selected(r.shipping_agent_entity_id) && (!mode || r.mode === mode)).map(routeRow)
    : view === 'vehicles' ? data.assets.filter(a => selected(a.transporter_entity_id)).map(vehicleRow)
    : view === 'areas' ? data.areas.filter(a => selected(a.transporter_entity_id)).map(areaRow)
    : view === 'rates' ? data.rates.filter(r => selected(ratePartner(r)) && (!currency || r.currency === currency) && (!validity || (!!asOf && rateValidity(r, asOf) === validity))).sort((a, b) => b.valid_from.localeCompare(a.valid_from)).map(r => rateRow(r))
    : view === 'ports' ? data.ports.map(p => ({ id: p.id, cells: { Code: p.code, Port: portCell(p.id), Country: p.country, City: p.city, Routes: data.routes.filter(r => r.origin_port_id === p.id || r.destination_port_id === p.id).length } }))
    : view === 'activity' ? data.activity.filter(a => selected(a.entity_id)).sort((a, b) => b.created_at.localeCompare(a.created_at)).map(activityRow)
    : view === 'relationships' ? data.relationships.filter(r => (isPartner(r.source_entity_id) || isPartner(r.target_entity_id)) && (!partner || [r.source_entity_id, r.target_entity_id].includes(partner))).map(relationshipRow) : []
  const cellText = (c: Cell) => c && typeof c === 'object' ? c.text : String(c ?? '')
  const filtered = rows.filter(r => !search || Object.values(r.cells).some(c => cellText(c).toLowerCase().includes(search.toLowerCase())))
  const counts: Record<View, number> = { profiles: data.profiles.length, routes: data.routes.length, vehicles: data.assets.length, areas: data.areas.length, rates: data.rates.length, ports: data.ports.length, documents: data.documents.length, activity: data.activity.length, relationships: data.relationships.filter(r => isPartner(r.source_entity_id) || isPartner(r.target_entity_id)).length }
  // Opens a form, optionally pre-filled from the record currently shown in a detail pop-up.
  function openForm(kind: string, initial: Record<string, unknown> = {}, rate?: { transport: boolean; service: string }) {
    setForm(kind); setFormInitial(initial); setError(''); setTransportRate(rate?.transport ?? false); setRateService(rate?.service ?? '')
    if (kind === 'document') setDocPartner(typeof initial['entity_id'] === 'string' ? initial['entity_id'] : '')
  }
  async function refresh() { await cache.invalidateQueries({ queryKey: ['logistics', userId, org] }); setForm('') }
  const transit = [f('transit_min_days', 'Minimum transit days', 'number'), f('transit_max_days', 'Maximum transit days', 'number')]
  const fields: Record<string, FormField[]> = {
    profile: [f('entity_id', 'Entity record', 'select', entityOptions), f('legal_name', 'Legal name'), f('kind', 'Partner type', 'select', opts(['shipping_agent', 'transporter', 'both'])), f('country', 'Country code'), f('address', 'Address', 'textarea'), f('phone', 'Phone'), f('email', 'Email', 'email'), f('license_number', 'License number'), f('notes', 'Notes', 'textarea')],
    port: [f('code', 'UN/LOCODE'), f('name', 'Port name'), f('country', 'Country code'), f('city', 'City')],
    route: [f('shipping_agent_entity_id', 'Shipping agent', 'select', agents), f('origin_port_id', 'Origin port', 'select', ports), f('destination_port_id', 'Destination port', 'select', ports), f('mode', 'Load mode', 'select', opts(['FCL', 'LCL'])), f('container_type', 'Container type (FCL only)', 'select', opts(containerTypes)), ...transit, f('frequency', 'Frequency'), f('notes', 'Notes', 'textarea')],
    asset: [f('transporter_entity_id', 'Transporter', 'select', transporters), f('registration', 'Vehicle registration'), f('vehicle_type', 'Vehicle type', 'select', opts(['truck', 'van', 'trailer', 'reefer', 'container_truck'])), f('capacity_kg', 'Capacity (kg)', 'number'), f('capacity_cbm', 'Capacity (cbm)', 'number'), f('notes', 'Notes', 'textarea')],
    area: [f('transporter_entity_id', 'Transporter', 'select', transporters), f('name', 'Service area name'), f('country', 'Country code'), f('pickup_zone', 'Pickup zone'), f('delivery_zone', 'Delivery zone'), ...transit, f('notes', 'Notes', 'textarea')],
    rate: [f('amount', 'Rate amount', 'number'), f('currency', 'Currency', 'select', opts(Intl.supportedValuesOf('currency'))), f('unit', 'Rate unit', 'select', opts(['container', 'cbm', 'tonne', 'trip', 'km', 'kg'])), f('min_quantity', 'Minimum quantity', 'number'), f('valid_from', 'Valid from', 'date'), f('valid_until', 'Valid until', 'date'), f('notes', 'Notes', 'textarea')],
    relationship: [f('source_entity_id', 'Source partner', 'select', names), f('target_entity_id', 'Related entity', 'select', data.entities.map(e => ({ value: e.id, label: name(e.id) }))), f('relationship_type', 'Relationship type', 'select', opts(['supplier', 'manufacturer', 'distributor', 'partner'])), f('notes', 'Notes', 'textarea')],
  }
  const [rateService, setRateService] = useState(''), [transportRate, setTransportRate] = useState(false)
  const schemas = { profile: logisticsProfileSchema, port: portSchema, route: routeSchema, asset: assetSchema, area: areaSchema }
  const addKind = { profiles: 'profile', routes: 'route', vehicles: 'asset', areas: 'area', rates: 'rate', ports: 'port', documents: 'document', relationships: 'relationship', activity: '' }[view]
  const title = views.find(v => v.key === view)?.label
  return <main className="mx-auto max-w-[1500px] px-5 py-8 md:px-9"><div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><div className="mb-3 flex gap-3 text-primary"><Ship/><Truck/></div><h1 className="text-3xl font-semibold">Shipping & transport</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">How it fits together: a <b>partner</b> (shipping agent or transporter) offers <b>shipping routes</b> by sea or <b>service areas</b> by road, and each of those has <b>rates</b> over time. Click any blue name to open everything linked to it.</p></div>{manage && addKind && <Button onClick={() => openForm(addKind)}><Plus/>Add {view === 'rates' ? 'rate' : view === 'profiles' ? 'partner profile' : title?.toLowerCase().replace(/s$/, '')}</Button>}</div>
      <nav className="mb-3 flex flex-wrap gap-1 border-b">{views.map(v => <Button key={v.key} variant="ghost" className={view === v.key ? 'rounded-none border-b-2 border-primary text-primary' : 'rounded-none'} onClick={() => { setView(v.key); setForm('') }}>{v.label}<span className="text-xs text-muted-foreground">{counts[v.key]}</span></Button>)}</nav>
      <p className="mb-5 text-sm text-muted-foreground">{views.find(v => v.key === view)?.hint}</p>
      <div className="mb-6 flex flex-wrap items-end gap-3"><label className="field-label min-w-0 flex-1">Search<Input aria-label="Search logistics" placeholder="Search any column…" value={search} onChange={e => setSearch(e.target.value)}/></label>{view !== 'ports' && <label className="field-label">Partner<select className="native-select" aria-label="Partner filter" value={partner} onChange={e => setPartner(e.target.value)}><option value="">All partners</option>{names.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}</select></label>}{view === 'profiles' && <label className="field-label">Type<select className="native-select" aria-label="Partner type filter" value={partnerKind} onChange={e => setPartnerKind(e.target.value)}><option value="">All types</option><option value="shipping_agent">Shipping agents</option><option value="transporter">Transporters</option></select></label>}{view === 'routes' && <label className="field-label">Mode<select className="native-select" value={mode} onChange={e => setMode(e.target.value)}><option value="">FCL & LCL</option><option>FCL</option><option>LCL</option></select></label>}{view === 'rates' && <><label className="field-label">Currency<select className="native-select" value={currency} onChange={e => setCurrency(e.target.value)}><option value="">All currencies</option>{[...new Set(data.rates.map(r => r.currency))].map(c => <option key={c}>{c}</option>)}</select></label><label className="field-label">As of<Input type="date" value={asOf} onChange={e => setAsOf(e.target.value)}/></label><label className="field-label">Validity<select className="native-select" value={validity} disabled={!asOf} onChange={e => setValidity(e.target.value)}><option value="">All history</option><option>Valid</option><option>Upcoming</option><option>Expired</option></select></label></>}</div>
      {error && <p role="alert" className="my-4 text-destructive">{error}</p>}
      {view === 'documents' ? <DocumentList documents={data.documents.filter(d => selected(d.entity_id) && (!search || `${d.name} ${name(d.entity_id)}`.toLowerCase().includes(search.toLowerCase())))} partnerCell={partnerCell} onOpen={openDoc}/> : <LogisticsTable key={view} rows={filtered} empty={`No ${title?.toLowerCase()} found.`}/>}
      <FormDialog open={!!detail} onClose={() => setDetail(null)} size="xl" title={detail?.kind === 'partner' ? name(detail.id) : detail?.kind === 'route' ? routeName(detail.id) : detail?.kind === 'port' ? portName(detail.id) : data.areas.find(a => a.id === detail?.id)?.name ?? ''} description={detail?.kind === 'partner' ? data.profiles.find(p => p.entity_id === detail.id)?.kind.replaceAll('_', ' ') : detail?.kind === 'route' ? 'Shipping route' : detail?.kind === 'port' ? 'Port' : 'Transport service area'}>{detail && renderDetail(detail)}</FormDialog>
      <FormDialog open={!!form && manage} onClose={() => setForm('')} title={`New ${form}`}>
        {form === 'profile' && !entityOptions.length ? <Button variant="outline" asChild><Link to="/entity-types" search={{ org }}>Create entity record</Link></Button> : Object.hasOwn(schemas, form) && <TradeForm key={`${form}-${JSON.stringify(formInitial)}`} fields={fields[form] ?? []} schema={schemas[form as keyof typeof schemas]} initial={{ kind: 'shipping_agent', mode: 'FCL', container_type: '20GP', vehicle_type: 'truck', transit_min_days: 0, transit_max_days: 0, ...formInitial }} onCancel={() => setForm('')} onSave={async values => {
          if (form === 'profile') await save({ data: { organizationId: org, kind: 'profile', values: logisticsProfileSchema.parse(values) } })
          if (form === 'port') await save({ data: { organizationId: org, kind: 'port', values: portSchema.parse(values) } })
          if (form === 'route') await save({ data: { organizationId: org, kind: 'route', values: routeSchema.parse(values) } })
          if (form === 'asset') await save({ data: { organizationId: org, kind: 'asset', values: assetSchema.parse(values) } })
          if (form === 'area') await save({ data: { organizationId: org, kind: 'area', values: areaSchema.parse(values) } })
          await refresh()
        }}/>} 
        {form === 'rate' && <><div className="mb-5 flex gap-2"><Button variant={transportRate ? 'outline' : 'default'} onClick={() => { setTransportRate(false); setRateService('') }}><Ship/>Shipping</Button><Button variant={transportRate ? 'default' : 'outline'} onClick={() => { setTransportRate(true); setRateService('') }}><Truck/>Transport</Button></div><label className="field-label mb-5">{transportRate ? 'Service area' : 'Shipping route'}<select className="native-select" aria-label="Rate service" value={rateService} onChange={e => setRateService(e.target.value)}><option value="">Choose…</option>{(transportRate ? data.areas.map(a => ({ value: a.id, label: `${name(a.transporter_entity_id)} · ${a.name}` })) : data.routes.map(r => ({ value: r.id, label: `${name(r.shipping_agent_entity_id)} · ${routeName(r.id)}` }))).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label><TradeForm key={`${transportRate}-${rateService}`} fields={transportRate ? [...(fields['rate'] ?? []), f('asset_id', 'Vehicle (optional)', 'select', data.assets.filter(a => a.transporter_entity_id === data.areas.find(a => a.id === rateService)?.transporter_entity_id).map(a => ({ value: a.id, label: a.registration })))] : (fields['rate'] ?? [])} schema={rateSchema} initial={{ shipping_route_id: transportRate ? null : rateService || null, service_area_id: transportRate ? rateService || null : null, currency: data.currency, unit: transportRate ? 'trip' : data.routes.find(r => r.id === rateService)?.mode === 'LCL' ? 'cbm' : 'container', min_quantity: 1 }} onSave={async v => { await save({ data: { organizationId: org, kind: 'rate', values: rateSchema.parse(v) } }); await refresh() }}/></>}
        {form === 'relationship' && <TradeForm key={JSON.stringify(formInitial)} fields={fields['relationship'] ?? []} initial={formInitial} schema={relationshipSchema} onSave={async v => { await relate({ data: { organizationId: org, relationship: relationshipSchema.parse(v) } }); await refresh() }}/>} 
        {form === 'document' && <div className="grid gap-5"><label className="field-label">Partner<select className="native-select" aria-label="Document partner" value={docPartner} onChange={e => setDocPartner(e.target.value)}><option value="">Choose…</option>{names.map(n => <option value={n.value} key={n.value}>{n.label}</option>)}</select></label><label className="field-label">Document<Input type="file" aria-label="Logistics document" disabled={!docPartner || busy} onChange={async e => { const file = e.target.files?.[0]; if (!file || !docPartner) return; setBusy(true); setError(''); const path = `${org}/${docPartner}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`; let uploaded = false; try { if (file.size > 10 * 1024 * 1024) throw new Error('Documents must be under 10 MB'); const r = await supabase.storage.from('logistics-documents').upload(path, file, { upsert: false }); if (r.error) throw new Error('Unable to upload document'); uploaded = true; await save({ data: { organizationId: org, kind: 'document', values: { entity_id: docPartner, name: file.name, object_path: path } } }); await refresh() } catch (err) { if (uploaded) await supabase.storage.from('logistics-documents').remove([path]); setError(err instanceof Error ? err.message : 'Upload failed') } finally { setBusy(false) } }}/></label>{busy && <p>Uploading…</p>}</div>}
      </FormDialog>
    </main>

  async function openDoc(id: string) {
    try { const r = await openDocument({ data: { organizationId: org, id } }); const a = document.createElement('a'); a.href = r.url; a.target = '_blank'; a.rel = 'noopener'; a.click() } catch (e) { setError(e instanceof Error ? e.message : 'Unable to open document') }
  }
  function renderDetail(d: Detail) {
    const on = today()
    const facts = (items: [string, Cell][]) => <dl className="details-list mb-6">{items.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v && typeof v === 'object' ? <button className="font-medium text-primary hover:underline" onClick={v.open}>{v.text}</button> : String(v ?? '') || '—'}</dd></div>)}</dl>
    const section = (heading: string, rows: Row[], action?: { label: string; run: () => void }, empty = 'None yet.') => <section className="mt-7"><div className="section-heading mb-3"><h2>{heading} <span className="text-sm font-normal text-muted-foreground">{rows.length}</span></h2>{manage && action && <Button size="sm" variant="outline" onClick={action.run}><Plus/>{action.label}</Button>}</div>{rows.length ? <LogisticsTable rows={rows} empty="" compact/> : <p className="py-3 text-sm text-muted-foreground">{empty}</p>}</section>
    if (d.kind === 'partner') {
      const p = data.profiles.find(v => v.entity_id === d.id); if (!p) return <p>Partner not found.</p>
      const agent = p.kind !== 'transporter', transporter = p.kind !== 'shipping_agent'
      return <>
        {facts([['Type', p.kind.replaceAll('_', ' ')], ['Country', p.country], ['Address', p.address], ['Phone', p.phone], ['Email', p.email], ['Licence', p.license_number], ['Notes', p.notes]])}
        <Button variant="outline" size="sm" asChild><Link to="/entity-types" search={{ org }}><ExternalLink/>Open company record</Link></Button>
        {agent && section('Shipping routes', routesOf(p.entity_id).map(routeRow), { label: 'Add route', run: () => openForm('route', { shipping_agent_entity_id: p.entity_id }) }, 'No routes yet. Add the port-to-port routes this agent offers.')}
        {transporter && section('Service areas', areasOf(p.entity_id).map(areaRow), { label: 'Add service area', run: () => openForm('area', { transporter_entity_id: p.entity_id }) }, 'No service areas yet. Add where this transporter picks up and delivers.')}
        {transporter && section('Vehicles', vehiclesOf(p.entity_id).map(vehicleRow), { label: 'Add vehicle', run: () => openForm('asset', { transporter_entity_id: p.entity_id }) })}
        {section('Rates', ratesOf(p.entity_id).sort((a, b) => b.valid_from.localeCompare(a.valid_from)).map(r => rateRow(r, on)), { label: 'Add rate', run: () => openForm('rate', {}, { transport: !agent, service: (agent ? routesOf(p.entity_id)[0]?.id : areasOf(p.entity_id)[0]?.id) ?? '' }) }, `No rates yet.${agent ? ' Add a route first, then its rates.' : ' Add a service area first, then its rates.'}`)}
        <section className="mt-7"><div className="section-heading mb-3"><h2>Documents <span className="text-sm font-normal text-muted-foreground">{data.documents.filter(v => v.entity_id === p.entity_id).length}</span></h2>{manage && <Button size="sm" variant="outline" onClick={() => openForm('document', { entity_id: p.entity_id })}><Plus/>Upload document</Button>}</div><DocumentList documents={data.documents.filter(v => v.entity_id === p.entity_id)} partnerCell={partnerCell} onOpen={openDoc}/></section>
        {section('Relationships', data.relationships.filter(r => r.source_entity_id === p.entity_id || r.target_entity_id === p.entity_id).map(relationshipRow), { label: 'Add relationship', run: () => openForm('relationship', { source_entity_id: p.entity_id }) })}
        {section('Recent activity', data.activity.filter(a => a.entity_id === p.entity_id).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10).map(activityRow))}
      </>
    }
    if (d.kind === 'route') {
      const r = data.routes.find(v => v.id === d.id); if (!r) return <p>Route not found.</p>
      return <>
        {facts([['Shipping agent', partnerCell(r.shipping_agent_entity_id)], ['Origin port', portCell(r.origin_port_id)], ['Destination port', portCell(r.destination_port_id)], ['Load mode', r.mode], ['Container', r.container_type], ['Transit', transitText(r.transit_min_days, r.transit_max_days)], ['Frequency', r.frequency], ['Notes', r.notes]])}
        {section('Rate history', data.rates.filter(v => v.shipping_route_id === r.id).sort((a, b) => b.valid_from.localeCompare(a.valid_from)).map(v => rateRow(v, on)), { label: 'Add rate', run: () => openForm('rate', {}, { transport: false, service: r.id }) }, 'No rates for this route yet.')}
      </>
    }
    if (d.kind === 'port') {
      const p = data.ports.find(v => v.id === d.id); if (!p) return <p>Port not found.</p>
      return <>
        {facts([['Code', p.code], ['Country', p.country], ['City', p.city]])}
        {section('Routes from this port', data.routes.filter(r => r.origin_port_id === p.id).map(routeRow))}
        {section('Routes to this port', data.routes.filter(r => r.destination_port_id === p.id).map(routeRow))}
      </>
    }
    const a = data.areas.find(v => v.id === d.id); if (!a) return <p>Service area not found.</p>
    return <>
      {facts([['Transporter', partnerCell(a.transporter_entity_id)], ['Country', a.country], ['Pickup zone', a.pickup_zone], ['Delivery zone', a.delivery_zone], ['Transit', transitText(a.transit_min_days, a.transit_max_days)], ['Notes', a.notes]])}
      {section('Transport rates', data.rates.filter(v => v.service_area_id === a.id).sort((x, y) => y.valid_from.localeCompare(x.valid_from)).map(v => rateRow(v, on)), { label: 'Add rate', run: () => openForm('rate', {}, { transport: true, service: a.id }) }, 'No rates for this area yet.')}
      {section("Transporter's vehicles", vehiclesOf(a.transporter_entity_id).map(vehicleRow))}
    </>
  }
}
function DocumentList({ documents, partnerCell, onOpen }: { documents: LogisticsWorkspaceData['documents']; partnerCell: (id: string) => Cell; onOpen: (id: string) => void }) {
  if (!documents.length) return <p className="py-6 text-sm text-muted-foreground">No documents.</p>
  return <div>{documents.map(d => { const owner = partnerCell(d.entity_id); return <div key={d.id} className="flex items-center justify-between gap-4 border-b py-4"><span className="flex flex-wrap items-center gap-3"><FileText/>{d.name} · {owner && typeof owner === 'object' ? <button className="text-primary hover:underline" onClick={owner.open}>{owner.text}</button> : String(owner ?? '')}</span><Button variant="outline" onClick={() => onOpen(d.id)}><Download/>Open</Button></div> })}</div>
}
function LogisticsTable({ rows, empty, compact = false }: { rows: Row[]; empty: string; compact?: boolean }) {
  const [page, setPage] = useState(1), [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null)
  const value = (c: Cell) => c && typeof c === 'object' ? c.text : c ?? ''
  const sorted = sort ? [...rows].sort((a, b) => { const x = value(a.cells[sort.key]), y = value(b.cells[sort.key]); return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * sort.dir }) : rows
  const size = compact ? 10 : 25, current = Math.min(page, Math.max(1, Math.ceil(rows.length / size)))
  const headers = Object.keys(rows[0]?.cells ?? {})
  return <><div className="overflow-x-auto"><table className="data-table"><thead><tr>{headers.map(k => <th key={k}><button className="inline-flex items-center gap-1 hover:text-primary" title="Sort" onClick={() => setSort(sort?.key === k ? { key: k, dir: sort.dir === 1 ? -1 : 1 } : { key: k, dir: 1 })}>{k}<ArrowUpDown className={`size-3 ${sort?.key === k ? 'text-primary' : 'opacity-40'}`}/></button></th>)}</tr></thead><tbody>{sorted.slice((current - 1) * size, current * size).map(r => <tr key={r.id}>{headers.map(k => { const c = r.cells[k]; return <td key={k}>{c && typeof c === 'object' ? <button className="text-left font-medium text-primary hover:underline" onClick={c.open}>{c.text}</button> : String(c ?? '') || '—'}</td> })}</tr>)}</tbody></table>{!rows.length && empty && <div className="py-14 text-center text-muted-foreground"><MapPin className="mx-auto mb-4 size-8 text-primary"/>{empty}</div>}</div>{rows.length > size && <div className="mt-4 flex justify-between border-t pt-3 text-sm text-muted-foreground"><span>{rows.length} records · Page {current}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={current * size >= rows.length} onClick={() => setPage(current + 1)}>Next</Button></div></div>}{!compact && rows.length > 0 && rows.length <= size && <p className="mt-4 border-t pt-3 text-sm text-muted-foreground">{rows.length} records</p>}</>
}

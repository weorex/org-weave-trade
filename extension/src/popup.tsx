import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Plug, Scan, Save, LogOut, RefreshCw } from 'lucide-react'
import { Button } from '../../src/components/ui/button'
import { buildRecordSchema, type EntityConfiguration, type EntityData } from '../../src/services/entity-schemas'
import { cleanSourceUrl, mapProductRows } from '../../src/services/capture-schemas'
import { extractAccessiblePage } from './extract'
import './styles.css'

const APP = 'https://org-weave-trade.lovable.app'
type Session = { token: string; expires: number }
type Snapshot = ReturnType<typeof extractAccessiblePage>
type Context = { types: { id: string; version: number; config: EntityConfiguration }[]; records: { id: string; typeId: string; values: EntityData }[]; productSkus: string[]; canTrade: boolean }
type Contact = { name: string; email: string; phone: string; position: string; notes: string; selected: boolean }

function Popup() {
  const [session, setSession] = useState<Session | null>(null)
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([])
  const [org, setOrg] = useState(''); const [context, setContext] = useState<Context | null>(null)
  const [typeId, setTypeId] = useState(''); const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [values, setValues] = useState<EntityData>({}); const [contacts, setContacts] = useState<Contact[]>([])
  const [tableIndex, setTableIndex] = useState(0); const [mapping, setMapping] = useState<Record<string, number>>({})
  const [selected, setSelected] = useState<number[]>([]); const [requestId, setRequestId] = useState(crypto.randomUUID())
  const [busy, setBusy] = useState(false); const [status, setStatus] = useState(''); const [saved, setSaved] = useState(false)
  const type = context?.types.find(t => t.id === typeId)
  const table = snapshot?.tables[tableIndex]
  const change = () => { setSaved(false); setRequestId(crypto.randomUUID()) }
  async function api(path: string, active: Session, body?: unknown) {
    if (active.expires * 1000 <= Date.now()) throw new Error('Session expired. Reconnect.')
    const response = await fetch(`${APP}/api/public/capture${path}`, { method: body ? 'POST' : 'GET', credentials: 'omit', headers: { Authorization: `Bearer ${active.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Request failed')
    return data
  }
  async function loadOrganizations(active: Session) { const result = await api('', active); setOrgs(result.organizations) }
  async function task(work: () => Promise<void>) { setBusy(true); setStatus(''); try { await work() } catch (e) { setStatus(e instanceof Error ? e.message : 'Unable to complete request') } finally { setBusy(false) } }
  useEffect(() => { void task(async () => {
    await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
    const stored = await chrome.storage.session.get('session')
    const active = stored.session as Session | undefined
    if (active && active.expires * 1000 > Date.now()) { setSession(active); await loadOrganizations(active) }
  }) }, [])
  async function connect() { await task(async () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32)); const state = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
    const redirect = chrome.identity.getRedirectURL()
    const result = await chrome.identity.launchWebAuthFlow({ interactive: true, url: `${APP}/extension-connect?${new URLSearchParams({ redirect, state })}` })
    if (!result) throw new Error('Connection cancelled')
    const url = new URL(result); if (`${url.origin}${url.pathname}` !== redirect) throw new Error('Invalid connection response')
    const hash = new URLSearchParams(url.hash.slice(1)); if (hash.get('state') !== state) throw new Error('Connection response did not match')
    const token = hash.get('capture_session'); const expires = Number(hash.get('expires_at'))
    if (!token || !Number.isFinite(expires) || expires * 1000 <= Date.now()) throw new Error('Expired connection')
    const active = { token, expires }; await chrome.storage.session.set({ session: active }); setSession(active); await loadOrganizations(active)
  }) }
  async function chooseOrg(id: string) { setOrg(id); setContext(null); setTypeId(''); setValues({}); change(); if (session && id) await task(async () => { const result: Context = await api(`?org=${id}`, session); setContext(result); if (!result.types.length) setStatus('No available entity types. Create a type in Weorex first.') }) }
  function chooseType(id: string, captured = snapshot) {
    setTypeId(id); const config = context?.types.find(t => t.id === id)?.config
    const next: EntityData = {}
    config?.fields.forEach(f => { const hint = f.key.toLowerCase(); next[f.key] = f.type === 'boolean' ? false : f.type === 'number' ? null : f.type === 'email' ? captured?.emails[0] ?? '' : f.type === 'url' ? captured?.sourceUrl ?? '' : hint.includes('address') ? captured?.address ?? '' : hint.includes('name') || hint.includes('company') ? captured?.company ?? '' : hint.includes('phone') ? captured?.phones[0] ?? '' : '' })
    setValues(next); change()
  }
  async function capture() { await task(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id || !tab.url || !/^https?:\/\//.test(tab.url)) throw new Error('Open an accessible company web page first.')
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractAccessiblePage })
    if (!result?.result) throw new Error('This page could not be read')
    const extracted = result.result; setSnapshot(extracted); setTableIndex(0); setMapping({}); setSelected([])
    setContacts(extracted.emails.map(email => ({ name: '', email, phone: '', position: '', notes: '', selected: false })).concat(extracted.phones.map(phone => ({ name: '', email: '', phone, position: '', notes: '', selected: false }))))
    chooseType(typeId, extracted); setStatus('Page captured. Review before saving.')
  }) }
  const identityField = type?.config.fields.filter(f => ['text','email','url'].includes(f.type)).sort((a,b) => Number(b.required) - Number(a.required))[0]
  const duplicate = identityField && values[identityField.key] ? context?.records.find(r => r.typeId === typeId && String(r.values[identityField.key] ?? '').trim().toLowerCase() === String(values[identityField.key]).trim().toLowerCase()) : undefined
  let products: ReturnType<typeof mapProductRows> = []; let mappingError = ''
  try { products = mapProductRows(table?.rows ?? [], mapping, selected) } catch (e) { mappingError = e instanceof Error ? e.message : 'Map SKU and name' }
  const skuSet = new Set(context?.productSkus.map(s => s.trim().toLowerCase()))
  async function save() { await task(async () => {
    if (!session || !type || !snapshot) throw new Error('Capture a page and choose an entity type.')
    const validated = buildRecordSchema(type.config.fields).safeParse(values)
    if (!validated.success) throw new Error(validated.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '))
    if (mappingError) throw new Error(mappingError)
    const result = await api('', session, { organizationId: org, typeId, version: type.version, requestId, sourceUrl: cleanSourceUrl(snapshot.sourceUrl), values: validated.data, products: context?.canTrade ? products : [], contacts: context?.canTrade ? contacts.filter(c => c.selected).map(({ selected: _, ...c }) => c) : [] })
    setSaved(true); setStatus(`${result.replayed ? 'Already saved' : 'Saved'} · ${result.entityDuplicate ? 'Existing company retained' : 'Company created'} · ${result.productsInserted} products added · ${result.productsSkipped} existing SKUs retained · ${result.contactsInserted} contacts added`)
  }) }
  return <><header><h1>Weorex <span className="text-primary">Capture</span></h1>{session ? <Button variant="ghost" size="icon" title="Disconnect" aria-label="Disconnect" onClick={() => { void chrome.storage.session.clear(); setSession(null); setContext(null); setSnapshot(null); setValues({}); setContacts([]); setOrgs([]); setStatus('Disconnected') }}><LogOut/></Button> : <Button disabled={busy} onClick={connect}><Plug/>Connect</Button>}</header><main><div className="fields"><label>Organization<select disabled={busy || !session} value={org} onChange={e => void chooseOrg(e.target.value)}><option value="">Select organization</option>{orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label><label>Entity type<select disabled={busy || !context} value={typeId} onChange={e => chooseType(e.target.value)}><option value="">Select entity type</option>{context?.types.map(t => <option key={t.id} value={t.id}>{t.config.name} · v{t.version}</option>)}</select></label></div><div className="mt-4 flex gap-2"><Button disabled={busy} onClick={capture}><Scan/>Capture page</Button><Button variant="outline" size="icon" title="Reload organization" aria-label="Reload organization" disabled={!org || busy} onClick={() => void chooseOrg(org)}><RefreshCw/></Button></div>{snapshot && <><p className="source">{snapshot.company}<br/>{snapshot.sourceUrl}</p><h2>Company fields</h2>{duplicate && <p className="status text-primary">Possible duplicate. Existing company values will be kept; selected products and contacts will be linked.</p>}<div className="fields">{type?.config.fields.map(f => <label key={f.key}>{f.label}{f.required ? ' *' : ''}{f.type === 'boolean' ? <input type="checkbox" checked={values[f.key] === true} onChange={e => { setValues({ ...values, [f.key]: e.target.checked }); change() }}/> : f.type === 'select' || f.type === 'relationship' ? <select value={String(values[f.key] ?? '')} onChange={e => { setValues({ ...values, [f.key]: e.target.value }); change() }}><option value="">Select</option>{f.type === 'select' ? f.settings.options?.map(v => <option key={v}>{v}</option>) : context?.records.filter(r => r.typeId === f.settings.targetTypeId).map(r => <option key={r.id} value={r.id}>{String(Object.values(r.values)[0] ?? r.id)}</option>)}</select> : <input type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : f.type === 'url' ? 'url' : 'text'} value={String(values[f.key] ?? '')} onChange={e => { setValues({ ...values, [f.key]: f.type === 'number' ? e.target.value === '' ? null : Number(e.target.value) : e.target.value }); change() }}/>}</label>)}</div>{context?.canTrade && <><h2>Products & tables</h2><label>Table<select value={tableIndex} onChange={e => { setTableIndex(Number(e.target.value)); setSelected([]); setMapping({}); change() }}>{snapshot.tables.map((t,i) => <option value={i} key={i}>{t.name} · {t.rows.length} rows</option>)}</select></label>{table && <><div className="fields mt-3">{['sku','name','category','description','unit'].map(key => <label key={key}>{key === 'sku' ? 'SKU *' : key === 'name' ? 'Product name *' : key}<select value={mapping[key] ?? -1} onChange={e => { setMapping({ ...mapping, [key]: Number(e.target.value) }); change() }}><option value={-1}>Not mapped</option>{table.headers.map((h,i) => <option key={i} value={i}>{h || `Column ${i+1}`}</option>)}</select></label>)}</div><label className="my-3 flex flex-row items-center gap-2"><input type="checkbox" checked={selected.length === table.rows.length && selected.length > 0} onChange={e => { setSelected(e.target.checked ? table.rows.map((_,i) => i) : []); change() }}/>Select all rows</label><div className="table-scroll"><table><thead><tr><th>Save</th>{table.headers.map((h,i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{table.rows.map((row,i) => <tr key={i}><td><input aria-label={`Select row ${i+1}`} type="checkbox" checked={selected.includes(i)} onChange={e => { setSelected(e.target.checked ? [...selected,i] : selected.filter(n => n !== i)); change() }}/></td>{row.map((cell,j) => <td key={j}>{cell}{j === mapping['sku'] && skuSet.has(cell.trim().toLowerCase()) && <span className="text-primary"> · Existing SKU</span>}</td>)}</tr>)}</tbody></table></div>{mappingError && <p className="status">Map valid SKU and product name columns for selected rows.</p>}</>}<h2>Contacts</h2>{contacts.map((c,i) => <div key={i} className="mb-3 flex items-center gap-2"><input aria-label={`Save contact ${i+1}`} type="checkbox" checked={c.selected} onChange={e => { setContacts(contacts.map((v,j) => j === i ? { ...v, selected: e.target.checked } : v)); change() }}/>{(['name','email','phone'] as const).map(k => <label key={k}>{k}<input value={c[k]} onChange={e => { setContacts(contacts.map((v,j) => j === i ? { ...v, [k]: e.target.value } : v)); change() }}/></label>)}</div>)}</> }<div className="mt-5"><Button disabled={busy || !session || !type || !!mappingError || saved} onClick={save}><Save/>{saved ? 'Saved' : 'Save capture'}</Button></div></>}<p role="status" className="status">{busy ? 'Working…' : status}</p></main></>
}
const root = document.getElementById('root')
if (root) createRoot(root).render(<Popup/>)
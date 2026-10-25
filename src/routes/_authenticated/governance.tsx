import { createFileRoute, Link } from '@tanstack/react-router'
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useState, type ReactNode } from 'react'
import { z } from 'zod'
import { Bell, Check, Copy, Play, RotateCcw, X } from 'lucide-react'
import { Brand } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormDialog } from '@/components/form-dialog'
import { AppShell } from '@/components/app-shell'
import { pageHead } from '@/lib/page-head'
import { friendlyError } from '@/lib/server-retry'
import { PERMISSIONS, PERMISSION_LABELS, workflowDefinition, type WorkflowStep } from '@/services/governance-schemas'
import { createInvite, decideApproval, getGovernance, markRead, retryRun, revokeInvite, runWorkflow, saveRole, saveTransitionRule, saveWorkflow, transitionRecord, updateMember } from '@/services/governance.functions'

const governanceQuery = (org: string, userId: string) => queryOptions({ queryKey: ['governance', userId, org], queryFn: () => getGovernance({ data: { organizationId: org } }) })
export const Route = createFileRoute('/_authenticated/governance')({
  validateSearch: s => z.object({ org: z.string().uuid() }).parse(s), loaderDeps: ({ search }) => ({ org: search.org }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(governanceQuery(deps.org, context.user.id)),
  head: () => pageHead('Workflows & access', 'Manage Weorex roles, invitations, approvals, status rules, workflows and notifications.'),
  component: Governance,
  errorComponent: () => <main className="simple-page"><Brand/><h1 className="mt-12 text-2xl font-semibold">Workflows & access unavailable</h1><p className="my-5 text-sm text-muted-foreground">Choose an organization you have access to.</p><Button asChild><Link to="/dashboard">Return to dashboard</Link></Button></main>,
})
type Data = Awaited<ReturnType<typeof getGovernance>>
const TABS = ['Monitoring', 'Members', 'Roles', 'Statuses', 'Workflows', 'Approvals', 'Runs', 'Notifications', 'Activity'] as const

function Governance() {
  const { org } = Route.useSearch(); const { user } = Route.useRouteContext()
  const { data } = useSuspenseQuery(governanceQuery(org, user.id))
  const cache = useQueryClient(); const [tab, setTab] = useState<(typeof TABS)[number]>('Monitoring')
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false)
  async function act(fn: () => Promise<unknown>, done?: string) {
    setBusy(true); setMessage('')
    try { await fn(); if (done) setMessage(done); await cache.invalidateQueries({ queryKey: ['governance', user.id, org] }) }
    catch (e) { setMessage(friendlyError(e, 'Something went wrong.')) } finally { setBusy(false) }
  }
  const unread = data.notifications.filter(n => !n.read_at).length
  const ctx = { data, org, act, busy }
  return <AppShell user={user} activeOrgId={org} title="Workflows & access"><main className="mx-auto max-w-6xl px-5 py-8">
    <h1 className="text-3xl font-semibold">Workflows & access</h1>
    <p className="mt-2 text-sm text-muted-foreground">Your role: <span className="capitalize">{data.role}</span>. Every action is checked again on the server.</p>
    <nav className="mt-6 flex flex-wrap gap-2" aria-label="Sections">{TABS.map(t => <Button key={t} size="sm" variant={t === tab ? 'default' : 'outline'} onClick={() => { setTab(t); setMessage('') }}>{t === 'Notifications' && <Bell/>}{t}{t === 'Notifications' && unread > 0 && ` (${unread})`}</Button>)}</nav>
    {message && <p role="status" className="mt-5 rounded-md bg-muted p-3 text-sm">{message}</p>}
    <section className="mt-8">
      {tab === 'Monitoring' && <Monitoring {...ctx}/>}
      {tab === 'Members' && <Members {...ctx}/>}
      {tab === 'Roles' && <Roles {...ctx}/>}
      {tab === 'Statuses' && <Statuses {...ctx}/>}
      {tab === 'Workflows' && <Workflows {...ctx}/>}
      {tab === 'Approvals' && <Approvals {...ctx}/>}
      {tab === 'Runs' && <Runs {...ctx}/>}
      {tab === 'Notifications' && <Notifications {...ctx}/>}
      {tab === 'Activity' && <Activity {...ctx}/>}
    </section>
  </main></AppShell>
}
type Ctx = { data: Data; org: string; act: (fn: () => Promise<unknown>, done?: string) => Promise<void>; busy: boolean }
const Card = ({ title, children }: { title: string; children: ReactNode }) => <div className="rounded-lg border bg-card p-5"><h2 className="mb-4 font-semibold">{title}</h2>{children}</div>
const Empty = ({ children }: { children: ReactNode }) => <p className="py-6 text-sm text-muted-foreground">{children}</p>
const sel = 'native-select'
const when = (d: string | null) => d ? new Date(d).toLocaleString() : '—'

function Monitoring({ data }: Ctx) {
  const day = Date.now() - 864e5
  const stats = [
    ['Failed workflow runs (24h)', data.runs.filter(r => r.status === 'failed' && new Date(r.created_at).getTime() > day).length],
    ['Runs waiting for approval', data.runs.filter(r => r.status === 'pending_approval').length],
    ['Pending approvals', data.approvals.filter(a => a.status === 'pending').length],
    ['Open invitations', data.invitations.filter(i => !i.accepted_at && !i.revoked_at && new Date(i.expires_at).getTime() > Date.now()).length],
    ['Active members', data.members.filter(m => m.status === 'active').length],
    ['Unread notifications', data.notifications.filter(n => !n.read_at).length],
  ] as const
  return <div className="grid gap-6"><div className="grid gap-4 sm:grid-cols-3">{stats.map(([k, v]) => <div key={k} className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="mt-3 text-2xl font-semibold">{v}</p></div>)}</div>
    <Card title="Backups and recovery"><p className="text-sm text-muted-foreground">The database is backed up automatically once a day, with about 14 days kept. Uploaded files are not part of these backups. Restoring replaces all data changed after the chosen backup; see the deployment checklist.</p></Card>
    <Card title="Recent failures">{data.runs.filter(r => r.status === 'failed').slice(0, 5).map(r => <p key={r.id} className="border-b py-2 text-sm"><span className="font-medium">{data.workflows.find(w => w.id === r.workflow_id)?.name ?? 'Workflow'}</span> — {r.last_error} <span className="text-muted-foreground">({when(r.created_at)})</span></p>)}{!data.runs.some(r => r.status === 'failed') && <Empty>No failed runs.</Empty>}</Card></div>
}

function Members({ data, org, act, busy }: Ctx) {
  const invite = useServerFn(createInvite); const revoke = useServerFn(revokeInvite); const update = useServerFn(updateMember)
  const [role, setRole] = useState('member'); const [hours, setHours] = useState(72); const [link, setLink] = useState('')
  const roles = data.roles.filter(r => r.role_key !== 'owner')
  return <div className="grid gap-6">
    {data.can['members.invite'] && <Card title="Invite with a link">
      <div className="flex flex-wrap items-end gap-3"><label className="field-label">Role<select className={sel} value={role} onChange={e => setRole(e.target.value)}>{roles.map(r => <option key={r.role_key} value={r.role_key}>{r.display_name}</option>)}</select></label>
        <label className="field-label">Valid for (hours)<Input type="number" min={1} max={168} value={hours} onChange={e => setHours(Number(e.target.value))}/></label>
        <Button disabled={busy} onClick={() => act(async () => { const r = await invite({ data: { organizationId: org, role, hours } }); setLink(`${window.location.origin}/invite#${r.token}`) }, 'Invitation created. Copy the link now — it is shown only once.')}>Create link</Button></div>
      {link && <div className="mt-4 flex gap-2"><Input readOnly value={link} aria-label="Invitation link"/><Button variant="outline" onClick={() => void navigator.clipboard.writeText(link)}><Copy/>Copy</Button></div>}
      <p className="mt-3 text-xs text-muted-foreground">Each link works once. Anyone with the link can join, so share it privately.</p>
      <table className="data-table mt-5"><thead><tr><th>Role</th><th>Created</th><th>Expires</th><th>Status</th><th/></tr></thead><tbody>{data.invitations.map(i => { const st = i.accepted_at ? 'accepted' : i.revoked_at ? 'revoked' : new Date(i.expires_at) < new Date() ? 'expired' : 'open'; return <tr key={i.id}><td className="capitalize">{i.role_key}</td><td>{when(i.created_at)}</td><td>{when(i.expires_at)}</td><td><span className="status-pill">{st}</span></td><td>{st === 'open' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => revoke({ data: { organizationId: org, id: i.id } }), 'Invitation revoked.')}>Revoke</Button>}</td></tr> })}</tbody></table>
    </Card>}
    <Card title="Members"><table className="data-table"><thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Joined</th></tr></thead><tbody>{data.members.map(m => {
      const editable = data.can['members.manage'] && m.user_id !== data.userId && m.role_key !== 'owner' && (data.role === 'owner' || m.role_key !== 'admin')
      return <tr key={m.id}><td>{m.name}</td><td>{editable ? <select aria-label={`Role for ${m.name}`} className={sel} value={m.role_key} disabled={busy} onChange={e => act(() => update({ data: { organizationId: org, membershipId: m.id, role: e.target.value, status: m.status as 'active' } }), 'Role updated.')}>{roles.filter(r => data.role === 'owner' || r.role_key !== 'admin').map(r => <option key={r.role_key} value={r.role_key}>{r.display_name}</option>)}</select> : <span className="capitalize">{m.role_key}</span>}</td>
        <td>{editable ? <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => update({ data: { organizationId: org, membershipId: m.id, role: m.role_key, status: m.status === 'active' ? 'suspended' : 'active' } }), 'Access updated.')}>{m.status === 'active' ? 'Suspend' : 'Reactivate'}</Button> : <span className="status-pill">{m.status}</span>}</td><td>{new Date(m.created_at).toLocaleDateString()}</td></tr> })}</tbody></table></Card>
  </div>
}

function Roles({ data, org, act, busy }: Ctx) {
  const save = useServerFn(saveRole); const [key, setKey] = useState(''); const [name, setName] = useState(''); const [perms, setPerms] = useState<string[]>([])
  const editable = (k: string) => !['owner', 'admin'].includes(k)
  return <div className="grid gap-6">
    <Card title="Roles"><table className="data-table"><thead><tr><th>Role</th><th>Permissions</th><th/></tr></thead><tbody>{data.roles.map(r => { const p = data.rolePermissions.filter(x => x.role_key === r.role_key).map(x => x.permission); return <tr key={r.role_key}><td>{r.display_name}<p className="text-xs text-muted-foreground">{r.role_key}</p></td><td className="text-sm">{['owner', 'admin'].includes(r.role_key) ? 'Everything' + (r.role_key === 'admin' ? ' except managing administrators' : '') : p.length ? p.map(x => PERMISSION_LABELS[x as keyof typeof PERMISSION_LABELS] ?? x).join(', ') : 'View only'}</td><td>{data.can['roles.manage'] && editable(r.role_key) && <Button size="sm" variant="ghost" onClick={() => { setKey(r.role_key); setName(r.display_name); setPerms(p) }}>Edit</Button>}</td></tr> })}</tbody></table></Card>
    {data.can['roles.manage'] && <Card title={key && data.roles.some(r => r.role_key === key) ? 'Edit role' : 'New role'}>
      <div className="grid gap-4 sm:grid-cols-2"><label className="field-label">Role name<Input value={name} maxLength={80} onChange={e => { setName(e.target.value); if (!data.roles.some(r => r.role_key === key)) setKey(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)) }}/></label><label className="field-label">Identifier<Input value={key} onChange={e => setKey(e.target.value)}/></label></div>
      <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">{PERMISSIONS.map(p => <label key={p} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={perms.includes(p)} disabled={!data.can[p]} onChange={e => setPerms(e.target.checked ? [...perms, p] : perms.filter(x => x !== p))}/>{PERMISSION_LABELS[p]}{!data.can[p] && <span className="text-xs text-muted-foreground">(you don't hold this)</span>}</label>)}</fieldset>
      <Button className="mt-5" disabled={busy || !key || !name} onClick={() => act(() => save({ data: { organizationId: org, key, name, permissions: perms as never } }), 'Role saved.')}>Save role</Button>
    </Card>}
  </div>
}

function statusOf(data: Data, entityId: string) { return data.states.find(s => s.entity_id === entityId)?.status ?? 'new' }
function Statuses({ data, org, act, busy }: Ctx) {
  const saveRule = useServerFn(saveTransitionRule); const move = useServerFn(transitionRecord)
  const [type, setType] = useState(data.entityTypes[0]?.id ?? ''); const [from, setFrom] = useState('new'); const [to, setTo] = useState(''); const [approval, setApproval] = useState(false)
  const [entity, setEntity] = useState(''); const [target, setTarget] = useState(''); const [reason, setReason] = useState('')
  if (!data.entityTypes.length) return <Empty>Create an entity type first; status rules apply to its records.</Empty>
  const rules = data.transitions.filter(t => t.entity_type_id === type); const records = data.entities.filter(e => e.entityTypeId === type)
  const options = rules.filter(r => r.from_status === statusOf(data, entity))
  return <div className="grid gap-6">
    <label className="field-label max-w-sm">Entity type<select className={sel} value={type} onChange={e => setType(e.target.value)}>{data.entityTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    <Card title="Allowed status changes"><p className="mb-3 text-sm text-muted-foreground">Every record starts as “new”. Only the changes listed here are allowed.</p>
      {rules.length ? <table className="data-table"><thead><tr><th>From</th><th>To</th><th>Approval</th></tr></thead><tbody>{rules.map(r => <tr key={r.id}><td>{r.from_status}</td><td>{r.to_status}</td><td>{r.requires_approval ? 'Required' : 'Not required'}</td></tr>)}</tbody></table> : <Empty>No status rules yet.</Empty>}
      {data.can['workflows.manage'] && <div className="mt-5 flex flex-wrap items-end gap-3"><label className="field-label">From<Input value={from} onChange={e => setFrom(e.target.value)}/></label><label className="field-label">To<Input value={to} placeholder="under_review" onChange={e => setTo(e.target.value)}/></label><label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={approval} onChange={e => setApproval(e.target.checked)}/>Needs approval</label><Button disabled={busy} onClick={() => act(() => saveRule({ data: { organizationId: org, entityTypeId: type, from: from.trim(), to: to.trim(), requiresApproval: approval } }), 'Status rule saved.')}>Add rule</Button></div>}
    </Card>
    {data.can['entities.transition'] && <Card title="Change a record's status">
      <div className="flex flex-wrap items-end gap-3"><label className="field-label">Record<select className={sel} value={entity} onChange={e => { setEntity(e.target.value); setTarget('') }}><option value="">Choose record</option>{records.map(r => <option key={r.id} value={r.id}>{r.label} ({statusOf(data, r.id)})</option>)}</select></label>
        <label className="field-label">New status<select className={sel} value={target} disabled={!entity} onChange={e => setTarget(e.target.value)}><option value="">Choose</option>{options.map(o => <option key={o.id} value={o.to_status}>{o.to_status}{o.requires_approval ? ' (needs approval)' : ''}</option>)}</select></label>
        <label className="field-label">Reason<Input value={reason} maxLength={1000} onChange={e => setReason(e.target.value)}/></label>
        <Button disabled={busy || !entity || !target} onClick={() => act(async () => { const r = await move({ data: { organizationId: org, entityId: entity, to: target, reason } }); if (r.result === 'pending') throw new Error('Approval requested. The status changes once someone approves it.') })}>Change status</Button></div>
      {!records.length && <Empty>No records of this type yet.</Empty>}
    </Card>}
  </div>
}

const blankStep = (): WorkflowStep => ({ action: 'set_status', to: '' })
function StepEditor({ step, data, onChange, onRemove }: { step: WorkflowStep; data: Data; onChange: (s: WorkflowStep) => void; onRemove: () => void }) {
  const roles = data.roles
  return <div className="flex flex-wrap items-end gap-3 rounded-md border p-3">
    <label className="field-label">Action<select className={sel} value={step.action} onChange={e => { const a = e.target.value; onChange(a === 'assign' ? { action: 'assign', user_id: data.members[0]?.user_id ?? '' } : a === 'notify' ? { action: 'notify', recipient: 'assignee', message: '' } : { action: a as 'set_status', to: '' }) }}><option value="set_status">Change status</option><option value="request_approval">Request approval</option><option value="notify">Send notification</option><option value="assign">Assign to member</option></select></label>
    {(step.action === 'set_status' || step.action === 'request_approval') && <label className="field-label">Status<Input value={step.to} placeholder="approved" onChange={e => onChange({ ...step, to: e.target.value.trim() })}/></label>}
    {step.action === 'assign' && <label className="field-label">Member<select className={sel} value={step.user_id} onChange={e => onChange({ action: 'assign', user_id: e.target.value })}>{data.members.filter(m => m.status === 'active').map(m => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}</select></label>}
    {step.action === 'notify' && <><label className="field-label">Recipient<select className={sel} value={step.recipient === 'role' ? `role:${step.role}` : step.recipient} onChange={e => { const v = e.target.value; onChange(v.startsWith('role:') ? { action: 'notify', recipient: 'role', role: v.slice(5), message: step.message } : { action: 'notify', recipient: v as 'assignee', message: step.message }) }}><option value="assignee">Assigned member</option><option value="requester">Person running it</option>{roles.map(r => <option key={r.role_key} value={`role:${r.role_key}`}>Everyone with role {r.display_name}</option>)}</select></label><label className="field-label grow">Message<Input value={step.message} maxLength={300} onChange={e => onChange({ ...step, message: e.target.value })}/></label></>}
    <Button variant="ghost" size="icon" aria-label="Remove step" onClick={onRemove}><X/></Button>
  </div>
}
function Workflows({ data, org, act, busy }: Ctx) {
  const save = useServerFn(saveWorkflow); const run = useServerFn(runWorkflow)
  const [editing, setEditing] = useState<{ id: string | null; name: string; type: string; steps: WorkflowStep[]; active: boolean } | null>(null)
  const [runFor, setRunFor] = useState<Record<string, string>>({})
  if (!data.entityTypes.length) return <Empty>Create an entity type first; workflows run on its records.</Empty>
  return <div className="grid gap-6">
    <Card title="Workflows">{data.workflows.length ? <div className="grid gap-3">{data.workflows.map(w => { const steps = workflowDefinition.safeParse(w.definition); return <div key={w.id} className="flex flex-wrap items-center gap-3 border-b pb-3"><div className="grow"><p className="font-medium">{w.name} <span className="text-xs text-muted-foreground">v{w.version} · {data.entityTypes.find(t => t.id === w.entity_type_id)?.name}{!w.active && ' · paused'}</span></p><p className="text-xs text-muted-foreground">{steps.success ? steps.data.map(s => s.action.replace('_', ' ')).join(' → ') : ''}</p></div>
      {data.can['workflows.run'] && w.active && <><select aria-label={`Record for ${w.name}`} className={sel} value={runFor[w.id] ?? ''} onChange={e => setRunFor({ ...runFor, [w.id]: e.target.value })}><option value="">Choose record</option>{data.entities.filter(e => e.entityTypeId === w.entity_type_id).map(e => <option key={e.id} value={e.id}>{e.label}</option>)}</select><Button size="sm" disabled={busy || !runFor[w.id]} onClick={() => act(async () => { const r = await run({ data: { organizationId: org, workflowId: w.id, entityId: runFor[w.id]!, requestId: crypto.randomUUID() } }); if (r.status === 'failed') throw new Error(`Workflow failed: ${r.error}. Nothing was changed; you can retry from Runs.`) }, 'Workflow ran.')}><Play/>Run</Button></>}
      {data.can['workflows.manage'] && <Button size="sm" variant="outline" onClick={() => setEditing({ id: w.id, name: w.name, type: w.entity_type_id, steps: steps.success ? steps.data : [blankStep()], active: w.active })}>Edit</Button>}</div> })}</div> : <Empty>No workflows yet.</Empty>}
      {data.can['workflows.manage'] && !editing && <Button className="mt-4" onClick={() => setEditing({ id: null, name: '', type: data.entityTypes[0]!.id, steps: [blankStep()], active: true })}>New workflow</Button>}
    </Card>
    <FormDialog open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit workflow' : 'New workflow'} description="Steps run in order. If any step fails, every change from that run is undone. Only these four actions are available." wide>
      {editing && <>
      <div className="grid gap-4 sm:grid-cols-2"><label className="field-label">Name<Input value={editing.name} maxLength={120} onChange={e => setEditing({ ...editing, name: e.target.value })}/></label><label className="field-label">Entity type<select className={sel} value={editing.type} disabled={!!editing.id} onChange={e => setEditing({ ...editing, type: e.target.value })}>{data.entityTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label></div>
      <div className="mt-3 grid gap-3">{editing.steps.map((s, i) => <StepEditor key={i} step={s} data={data} onChange={n => setEditing({ ...editing, steps: editing.steps.map((x, j) => j === i ? n : x) })} onRemove={() => setEditing({ ...editing, steps: editing.steps.filter((_, j) => j !== i) })}/>)}</div>
      <div className="mt-4 flex flex-wrap gap-3"><Button variant="outline" disabled={editing.steps.length >= 20} onClick={() => setEditing({ ...editing, steps: [...editing.steps, blankStep()] })}>Add step</Button><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.active} onChange={e => setEditing({ ...editing, active: e.target.checked })}/>Active</label>
        <Button disabled={busy} onClick={() => act(async () => { const parsed = workflowDefinition.safeParse(editing.steps); if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Check the workflow steps.'); await save({ data: { organizationId: org, id: editing.id, name: editing.name, entityTypeId: editing.type, definition: parsed.data, active: editing.active } }); setEditing(null) }, 'Workflow saved.')}>Save workflow</Button><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
      </>}
    </FormDialog>
  </div>
}

function Approvals({ data, org, act, busy }: Ctx) {
  const decide = useServerFn(decideApproval); const [note, setNote] = useState<Record<string, string>>({})
  const label = (id: string) => data.entities.find(e => e.id === id)?.label ?? 'Record'
  return <Card title="Approval requests">{data.approvals.length ? <table className="data-table"><thead><tr><th>Record</th><th>Change</th><th>Requested</th><th>Status</th><th/></tr></thead><tbody>{data.approvals.map(a => <tr key={a.id}><td>{label(a.entity_id)}<p className="text-xs text-muted-foreground">{a.reason}</p></td><td>{a.from_status} → {a.to_status}</td><td>{a.requested_by === data.userId ? 'You' : data.members.find(m => m.user_id === a.requested_by)?.name}<p className="text-xs text-muted-foreground">{when(a.created_at)}</p></td><td><span className="status-pill">{a.status}</span>{a.decision_note && <p className="text-xs text-muted-foreground">{a.decision_note}</p>}</td>
    <td>{a.status === 'pending' && data.can['approvals.decide'] && a.requested_by !== data.userId && <div className="flex gap-2"><Input aria-label="Decision note" placeholder="Note" value={note[a.id] ?? ''} onChange={e => setNote({ ...note, [a.id]: e.target.value })}/><Button size="sm" disabled={busy} onClick={() => act(async () => { const r = await decide({ data: { organizationId: org, id: a.id, approve: true, note: note[a.id] ?? '' } }); if (r.result === 'stale') throw new Error('The record changed status since this request; it was closed without changes.') }, 'Approved.')}><Check/>Approve</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => decide({ data: { organizationId: org, id: a.id, approve: false, note: note[a.id] ?? '' } }), 'Rejected.')}>Reject</Button></div>}{a.status === 'pending' && a.requested_by === data.userId && <span className="text-xs text-muted-foreground">Someone else must decide</span>}</td></tr>)}</tbody></table> : <Empty>No approval requests.</Empty>}</Card>
}

function Runs({ data, org, act, busy }: Ctx) {
  const retry = useServerFn(retryRun); const [open, setOpen] = useState<string | null>(null)
  return <Card title="Workflow runs">{data.runs.length ? <div className="grid gap-2">{data.runs.map(r => <div key={r.id} className="border-b pb-2"><div className="flex flex-wrap items-center gap-3"><button className="grow text-left text-sm" onClick={() => setOpen(open === r.id ? null : r.id)}><span className="font-medium">{data.workflows.find(w => w.id === r.workflow_id)?.name ?? 'Workflow'}</span> on {data.entities.find(e => e.id === r.entity_id)?.label ?? 'record'} · {when(r.created_at)}</button><span className="status-pill">{r.status.replace('_', ' ')}</span><span className="text-xs text-muted-foreground">attempt {r.attempts}/{r.max_attempts}</span>
    {r.status === 'failed' && r.attempts < r.max_attempts && data.can['workflows.run'] && <Button size="sm" variant="outline" disabled={busy} onClick={() => act(async () => { const x = await retry({ data: { organizationId: org, runId: r.id } }); if (x.status === 'failed') throw new Error(`Retry failed: ${x.error}`) }, 'Retry succeeded.')}><RotateCcw/>Retry</Button>}</div>
    {r.last_error && <p className="mt-1 text-xs text-destructive">{r.last_error}</p>}
    {open === r.id && <ol className="mt-2 grid gap-1 pl-4 text-xs">{[...r.workflow_run_logs].sort((a, b) => a.attempt - b.attempt || a.step_index - b.step_index).map(l => <li key={l.id}>Attempt {l.attempt}, step {l.step_index + 1}: {l.action.replace('_', ' ')} — <strong>{l.outcome.replace('_', ' ')}</strong>{l.message && ` (${l.message})`}</li>)}</ol>}</div>)}</div> : <Empty>No workflow runs yet.</Empty>}</Card>
}

function Notifications({ data, org, act, busy }: Ctx) {
  const read = useServerFn(markRead)
  return <Card title="Notifications">{data.notifications.some(n => !n.read_at) && <Button size="sm" variant="outline" className="mb-3" disabled={busy} onClick={() => act(() => read({ data: { organizationId: org, ids: null } }))}>Mark all as read</Button>}
    {data.notifications.length ? data.notifications.map(n => <div key={n.id} className={`border-b py-2 text-sm ${n.read_at ? 'text-muted-foreground' : ''}`}><p className="font-medium">{n.title}</p>{n.body && <p>{n.body}</p>}<p className="text-xs text-muted-foreground">{when(n.created_at)}</p></div>) : <Empty>No notifications.</Empty>}</Card>
}

function Activity({ data }: Ctx) {
  if (!data.can['audit.read']) return <Empty>You don't have access to the activity log.</Empty>
  return <Card title="Activity log">{data.audit.length ? <table className="data-table"><thead><tr><th>Action</th><th>By</th><th>When</th></tr></thead><tbody>{data.audit.map(a => <tr key={a.id}><td>{a.action.replace(/[._]/g, ' ')}</td><td>{a.actor_user_id === data.userId ? 'You' : data.members.find(m => m.user_id === a.actor_user_id)?.name ?? 'System'}</td><td>{when(a.created_at)}</td></tr>)}</tbody></table> : <Empty>No activity yet.</Empty>}</Card>
}

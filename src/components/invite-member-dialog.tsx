import { useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { Copy, Plus } from 'lucide-react'
import { createInvite } from '@/services/governance.functions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'

export function InviteMemberDialog({ organizationId, roles, onCreated }: { organizationId: string; roles: { role_key: string; display_name: string }[]; onCreated: () => void }) {
  const issue = useServerFn(createInvite)
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState('member')
  const [hours, setHours] = useState(24)
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState('')
  const [expires, setExpires] = useState('')
  const [message, setMessage] = useState('')
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      const invitation = await issue({ data: { organizationId, role, hours } })
      setLink(`${window.location.origin}/invite#${invitation.token}`)
      setExpires(invitation.expiresAt); onCreated()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to create invitation') }
    finally { setBusy(false) }
  }
  return <><Button onClick={() => { setOpen(true); setLink(''); setMessage(''); setRole(roles.find(r => r.role_key === 'member')?.role_key ?? roles[0]?.role_key ?? '') }}><Plus/>Add member</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogTitle>Add member</DialogTitle><DialogDescription>Create a single-use invitation link for your organization.</DialogDescription>{!link ? <form onSubmit={submit} className="grid gap-5"><label className="grid gap-2 text-sm">Role<select className="h-10 rounded-md border border-input bg-background px-3" value={role} onChange={e => setRole(e.target.value)} required>{roles.filter(r => r.role_key !== 'owner').map(r => <option key={r.role_key} value={r.role_key}>{r.display_name}</option>)}</select></label><label className="grid gap-2 text-sm">Expires after (hours)<Input type="number" min={1} max={168} required value={hours} onChange={e => setHours(Number(e.target.value))}/></label><Button type="submit" disabled={busy || !role}>{busy ? 'Creating…' : 'Create invitation link'}</Button></form> : <div className="grid gap-4"><label className="grid gap-2 text-sm">Invitation link<Input aria-label="Invitation link" readOnly value={link} onFocus={e => e.target.select()}/></label><p className="text-sm text-muted-foreground">Expires {new Date(expires).toLocaleString()}. The member appears after accepting.</p><Button onClick={async () => { try { await navigator.clipboard.writeText(link); setMessage('Invitation link copied') } catch { setMessage('Select and copy the invitation link above') } }}><Copy/>Copy invitation link</Button></div>}{message && <p role="status" className="text-sm">{message}</p>}</DialogContent></Dialog></>
}
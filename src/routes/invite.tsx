import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useState } from 'react'
import { LogIn, UserPlus } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { Brand } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { pageHead } from '@/lib/page-head'
import { rememberReturnPath } from '@/lib/return-to'
import { friendlyError } from '@/lib/server-retry'
import { acceptInvite } from '@/services/governance.functions'

export const Route = createFileRoute('/invite')({ head: () => pageHead('Join an organization', 'Accept your invitation to a Weorex organization.'), component: Invite })
function Invite() {
  const accept = useServerFn(acceptInvite); const navigate = useNavigate()
  // The token travels in the URL fragment so it is never sent to servers or logs.
  const [token, setToken] = useState<string | null>(null); const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false)
  useEffect(() => { const t = window.location.hash.slice(1); setToken(/^[0-9a-f]{64}$/.test(t) ? t : null); void supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session)) }, [])
  async function join() {
    if (!token) return; setBusy(true); setMessage('')
    try { const r = await accept({ data: { token } }); localStorage.setItem('weorex.activeOrgId', r.organizationId); window.history.replaceState(null, '', '/invite'); await navigate({ to: '/dashboard', replace: true }) }
    catch (e) { setMessage(friendlyError(e, 'Invitation is invalid or expired.')) } finally { setBusy(false) }
  }
  return <main className="simple-page"><Brand/><div className="simple-form"><span className="flex size-12 items-center justify-center rounded-md bg-accent text-primary"><UserPlus/></span><h1 className="text-3xl font-semibold">Join an organization</h1>
    {token === null && signedIn !== null ? <p className="text-muted-foreground">This invitation link is incomplete. Ask for a new link.</p> : signedIn === false ? <><p className="text-muted-foreground">Sign in or create an account to accept this invitation.</p><Button size="lg" onClick={() => { rememberReturnPath(`/invite#${token}`); window.location.assign('/auth') }}><LogIn/>Sign in to continue</Button></> : <><p className="text-muted-foreground">You've been invited to join a Weorex organization.</p><Button size="lg" disabled={busy || !token} onClick={join}>{busy ? 'Joining…' : 'Accept invitation'}</Button></>}
    {message && <p role="alert" className="text-sm text-destructive">{message}</p>}</div></main>
}

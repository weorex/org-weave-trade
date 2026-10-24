import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { ShieldCheck, Plug, Download, LogIn } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Brand } from '@/components/brand'
import { pageHead } from '@/lib/page-head'
import { rememberReturnPath } from '@/lib/return-to'
import { extensionRedirect } from '@/services/capture-schemas'
import { connectCaptureExtension } from '@/services/capture-session.functions'

export const Route = createFileRoute('/extension-connect')({
  head: () => pageHead('Trade Capture extension', 'Download, install and securely connect the Weorex browser capture extension.'),
  validateSearch: (s: Record<string, unknown>) => ({ requested: typeof s['redirect'] === 'string' && s['redirect'] !== 'null', redirect: extensionRedirect(typeof s['redirect'] === 'string' ? s['redirect'] : null), state: typeof s['state'] === 'string' && /^[a-f0-9]{64}$/.test(s['state']) ? s['state'] : null }),
  component: Connect,
})
function Connect() {
  const { redirect, state, requested } = Route.useSearch()
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  useEffect(() => { void supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session)) }, [])
  function signIn() { rememberReturnPath(window.location.pathname + window.location.search); window.location.assign('/auth') }
  const issue = useServerFn(connectCaptureExtension)
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false)
  async function connect() {
    setBusy(true)
    const { data } = await supabase.auth.getSession()
    if (!data.session) { setMessage('Sign in first, then choose Connect extension.'); setBusy(false); return }
    if (!redirect || !state) { setMessage('Start the connection from the installed extension.'); setBusy(false); return }
    try {
      const result = await issue({ data: { redirect,state } })
      const target = new URL(redirect)
      target.hash = new URLSearchParams({ capture_session: result.credential, expires_at: String(result.expires), state }).toString()
      window.location.assign(target.href)
    } catch { setMessage('Connection failed. Sign in again and retry.'); setBusy(false) }
  }
  async function download() {
    try { const r = await fetch('/weorex-capture.zip'); if (!r.ok) throw new Error(); const url = URL.createObjectURL(await r.blob()); const a = document.createElement('a'); a.href = url; a.download = 'weorex-capture.zip'; a.click(); URL.revokeObjectURL(url) } catch { setMessage('Download unavailable. Please try again.') }
  }
  return <main className="mx-auto max-w-3xl px-6 py-10"><div className="flex justify-between"><Brand/><Button variant="outline" asChild><Link to="/dashboard">Dashboard</Link></Button></div><h1 className="mt-12 text-3xl font-semibold">Weorex Trade Capture</h1><div className="my-8 flex flex-wrap gap-3"><Button disabled={busy || !redirect || !state} onClick={connect}><Plug/>Connect extension</Button><Button variant="outline" onClick={download}><Download/>Download extension</Button>{signedIn === false && <Button variant="ghost" onClick={signIn}><LogIn/>Sign in</Button>}</div><p className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck/>Only pages you explicitly capture are read. Saves use your existing organization permissions.</p>{redirect && <p className="mt-4 break-all text-sm text-muted-foreground">Extension: {new URL(redirect).hostname.split('.')[0]}</p>}{!redirect && requested && <p role="alert" className="mt-5 text-sm text-destructive">This copy of the extension is not recognized. Remove it from Chrome, download the latest version below, and install it again.</p>}{!redirect && !requested && <p className="mt-5 text-sm text-muted-foreground">To connect, open the installed extension and choose Connect there.</p>}{redirect && signedIn === false && <p className="mt-5 text-sm">Sign in first, then choose Connect extension.</p>}{message && <p role="status" className="mt-5 text-sm">{message}</p>}<section className="mt-12 border-t pt-8"><h2 className="text-xl font-semibold">Install in Chrome</h2><ol className="mt-5 list-decimal space-y-3 pl-5 text-sm"><li>Download and unzip the extension.</li><li>Open <code>chrome://extensions</code>.</li><li>Enable Developer mode.</li><li>Choose Load unpacked and select the unzipped folder.</li><li>Open Weorex Trade Capture and choose Connect. Approve on this page.</li><li>Open a company website, choose Capture page, review fields and selected rows, then Save capture.</li></ol><p className="mt-6 text-sm text-muted-foreground">The extension connects to the published Weorex app. Chrome Web Store installation is not available yet.</p></section></main>
}
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, ArrowRight } from 'lucide-react'
import { createOrganization, listOrganizations } from '@/services/organizations.functions'
import { organizationSchema, organizationSlug } from '@/services/organization-schemas'
import { Brand } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { pageHead } from '@/lib/page-head'
export const Route = createFileRoute('/_authenticated/onboarding')({head:()=>pageHead('Create organization','Create a secure organization in Weorex.'),component:Onboarding})
function Onboarding() {
  const create = useServerFn(createOrganization)
  const list = useServerFn(listOrganizations)
  const navigate = useNavigate()
  const cache = useQueryClient()
  const { user } = Route.useRouteContext()
  const organizations = useQuery({ queryKey: ['organizations', user.id], queryFn: () => list() })
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  return <main className="simple-page"><Brand/><form className="simple-form" onSubmit={async e => {
    e.preventDefault()
    setMessage('')
    const form = new FormData(e.currentTarget)
    const parsed = organizationSchema.safeParse({ name, slug: organizationSlug(name, crypto.randomUUID().slice(0, 8)), postal_address: address, default_currency: String(form.get('currency')), default_country: String(form.get('country')).trim() || null })
    if (!parsed.success) { setMessage(parsed.error.issues[0]?.message ?? 'Please check your organization details.'); return }
    setBusy(true)
    try {
      const org = await create({ data: parsed.data })
      localStorage.setItem('weorex.activeOrgId', org.id)
      await cache.invalidateQueries({ queryKey: ['organizations', user.id] })
      await navigate({ to: '/dashboard', replace: true })
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to create organization.') }
    finally { setBusy(false) }
  }}>
    <span className="flex size-12 items-center justify-center rounded-md bg-accent text-primary"><Building2/></span>
    <div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Your trade workspace</p><h1 className="text-3xl font-semibold">Create an organization</h1><p className="mt-3 text-muted-foreground">A dedicated home for your business and team.</p></div>
    <label className="field-label">Organization name<Input value={name} required minLength={2} maxLength={120} placeholder="Your company name" onChange={e => setName(e.target.value)}/></label>
    <label className="field-label">Organization address<Input value={address} required minLength={2} maxLength={500} autoComplete="street-address" onChange={e => setAddress(e.target.value)}/></label>
    <div className="grid grid-cols-2 gap-4"><label className="field-label">Currency<select name="currency" className="native-select"><option>USD</option><option>INR</option><option>EUR</option><option>GBP</option><option>AED</option></select></label><label className="field-label">Country code<Input name="country" placeholder="IN" maxLength={2} pattern="[A-Za-z]{2}" autoComplete="country" onChange={e => { e.target.value = e.target.value.toUpperCase() }}/></label></div>
    {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
    <Button size="lg" disabled={busy}>{busy ? 'Creating…' : 'Create organization'}<ArrowRight/></Button>
    {!!organizations.data?.length && <Button variant="ghost" type="button" onClick={() => navigate({ to: '/dashboard' })}>Back to dashboard</Button>}
  </form></main>
}
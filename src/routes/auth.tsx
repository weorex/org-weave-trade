import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowRight, Loader2, ShieldCheck } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { lovable } from '@/integrations/lovable/index'
import '@lovable.dev/cloud-auth-js/styles.css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Brand } from '@/components/brand'
import { pageHead } from '@/lib/page-head'
import { takeReturnPath } from '@/lib/return-to'
import port from '@/assets/trade-port.jpg'

export const Route = createFileRoute('/auth')({ head: () => pageHead('Sign in', 'Sign in to your Weorex global trade workspace.'), component: Auth })
function Auth() {
  const navigate = useNavigate()
  const [signup, setSignup] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('')
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email')); const password = String(form.get('password'))
    try {
      const result = signup ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin, data: { display_name: String(form.get('name') ?? '') } } }) : await supabase.auth.signInWithPassword({ email, password })
      if (result.error) { setMessage(result.error.message); return }
      if (signup && !result.data.session) { setMessage('Check your email to confirm your account before signing in.'); return }
      const back = takeReturnPath(); if (back) { window.location.assign(back); return }
      await navigate({ to: '/dashboard' })
    } catch { setMessage('Unable to connect. Please try again.') } finally { setBusy(false) }
  }
  async function social(provider: 'google' | 'lovable') {
    setBusy(true); setMessage('')
    try { const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin }); if (result.error) setMessage('Sign-in could not be completed. Please try again.'); else if (!result.redirected) await navigate({ to: '/dashboard' }) } catch { setMessage('Sign-in could not be completed.') } finally { setBusy(false) }
  }
  return <main className="auth-page"><section className="auth-form"><Link to="/"><Brand /></Link><div className="auth-content"><div className="mb-8 text-xs font-semibold uppercase tracking-widest text-primary">Global trade. One workspace.</div><h1 className="text-3xl font-semibold">{signup ? 'Create your account' : 'Welcome back'}</h1><p className="mt-3 mb-7 text-muted-foreground">{signup ? 'Your next chapter in global trade starts here.' : 'Sign in to your Weorex workspace.'}</p><div className="grid gap-3"><Button variant="outline" disabled={busy} onClick={() => social('google')}><span className="font-bold text-primary">G</span> Continue with Google</Button><Button className="lovable-auth-button" disabled={busy} onClick={() => social('lovable')}>Continue with Lovable</Button></div><div className="my-6 flex items-center gap-4 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or continue with email<span className="h-px flex-1 bg-border" /></div><form onSubmit={submit} className="grid gap-4">{signup && <label className="field-label">Full name<Input name="name" autoComplete="name" maxLength={100} required /></label>}<label className="field-label">Email address<Input name="email" type="email" placeholder="you@company.com" autoComplete="email" maxLength={255} required /></label><label className="field-label">Password<Input name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={8} maxLength={128} required /></label>{!signup && <Link className="text-right text-xs text-primary" to="/forgot-password">Forgot password?</Link>}{message && <p role="status" className="rounded-md bg-muted p-3 text-sm">{message}</p>}<Button type="submit" size="lg" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <>{signup ? 'Create account' : 'Sign in'}<ArrowRight /></>}</Button></form><p className="mt-6 text-center text-sm text-muted-foreground">{signup ? 'Already have an account?' : 'New to Weorex?'} <Button variant="link" className="px-1" onClick={() => { setSignup(!signup); setMessage('') }}>{signup ? 'Sign in' : 'Create an account'}</Button></p></div><p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4" />Secure, organization-based access</p></section><section className="auth-photo"><img src={port} width={1408} height={768} alt="International container port" /><div className="photo-caption"><span className="text-xs uppercase tracking-widest">Weorex Global Trade</span><h2 className="mt-4 text-4xl font-semibold">A connected world.<br />A clearer way to trade.</h2></div></section></main>
}
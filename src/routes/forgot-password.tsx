import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Brand } from '@/components/brand'
import { pageHead } from '@/lib/page-head'
export const Route = createFileRoute('/forgot-password')({ head: () => pageHead('Reset access', 'Request a password reset for your Weorex account.'), component: Forgot })
function Forgot() { const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false); return <main className="simple-page"><Brand /><form className="simple-form" onSubmit={async e=>{e.preventDefault();setBusy(true);const email=String(new FormData(e.currentTarget).get('email'));try{const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+'/reset-password'});setMessage(error ? 'Unable to send the reset email.' : 'If an account exists, a password reset link will arrive shortly.')}catch{setMessage('Unable to connect.')}finally{setBusy(false)}}}><h1 className="text-3xl font-semibold">Forgot your password?</h1><label className="field-label">Email address<Input name="email" type="email" required /></label><Button disabled={busy}>Send reset link</Button>{message&&<p role="status">{message}</p>}<Link to="/auth" className="text-sm text-primary">Back to sign in</Link></form></main> }
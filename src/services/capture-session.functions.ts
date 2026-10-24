import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { z } from 'zod'
import { extensionRedirect } from './capture-schemas'

export const connectCaptureExtension = createServerFn({ method:'POST' }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({ redirect:z.string().refine(v => extensionRedirect(v) !== null), state:z.string().regex(/^[a-f0-9]{64}$/) }).parse(input)).handler(async ({ context }) => {
  const bearer = getRequest().headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1]
  if (!bearer) throw new Error('Sign in before connecting')
  const auth = await context.supabase.auth.getUser(bearer)
  if (auth.error || !auth.data.user) throw new Error('Sign in before connecting')
  const expires = Math.min(Math.floor(Date.now()/1000) + 900, Number(context.claims['exp']) || 0)
  if (expires <= Date.now()/1000) throw new Error('Session expired')
  const { issueCaptureSession } = await import('./capture-session.server')
  return { credential:await issueCaptureSession(bearer,expires), expires }
})
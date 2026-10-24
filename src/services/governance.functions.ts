import { createServerFn } from '@tanstack/react-start'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import type { Database } from '@/integrations/supabase/types'
import { acceptRequest, decisionRequest, inviteRequest, memberRequest, orgRequest, readRequest, retryRequest, revokeRequest, roleRequest, runRequest, safeDbError, transitionRequest, transitionRuleRequest, workflowRequest } from './governance-schemas'

type Ctx = { supabase: SupabaseClient<Database>; userId: string }
async function member(ctx: Ctx, org: string) {
  // Resolve active membership on every request; the browser's choice is only a preference.
  const m = await ctx.supabase.from('organization_memberships').select('role_key,status').eq('organization_id', org).eq('user_id', ctx.userId).eq('status', 'active').maybeSingle()
  if (m.error || !m.data) throw new Error('Organization access denied')
  return m.data.role_key as string
}
async function rpc(ctx: Ctx, fn: string, args: Record<string, unknown>, fallback: string) {
  const r = await (ctx.supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }> }).rpc(fn, args)
  if (r.error) throw new Error(safeDbError(r.error, fallback))
  return r.data
}

export const getGovernance = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => orgRequest.parse(d)).handler(async ({ data, context }) => {
  const org = data.organizationId; const role = await member(context, org); const db = context.supabase
  const perms = ['members.invite','members.manage','roles.manage','workflows.manage','workflows.run','approvals.decide','entities.transition','audit.read'] as const
  const granted = await Promise.all(perms.map(p => db.rpc('has_permission', { p_org: org, p_perm: p })))
  const can = Object.fromEntries(perms.map((p, i) => [p, granted[i]!.data === true])) as Record<(typeof perms)[number], boolean>
  const [roles, rolePerms, members, invites, types, entities, states, transitions, workflows, approvals, runs, notifications, audit, profiles] = await Promise.all([
    db.from('organization_roles').select('role_key,display_name,is_system').eq('organization_id', org).order('role_key'),
    db.from('role_permissions').select('role_key,permission').eq('organization_id', org),
    db.from('organization_memberships').select('id,user_id,role_key,status,created_at').eq('organization_id', org).order('created_at'),
    can['members.invite'] ? db.from('organization_invitations').select('id,role_key,expires_at,accepted_at,revoked_at,created_at').eq('organization_id', org).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [], error: null }),
    db.from('entity_types').select('id,name,version').eq('organization_id', org).order('version', { ascending: false }),
    db.from('entities').select('id,entity_type_id,data').eq('organization_id', org).order('created_at', { ascending: false }).limit(500),
    db.from('entity_states').select('entity_id,status,assignee_user_id,updated_at').eq('organization_id', org),
    db.from('status_transitions').select('id,entity_type_id,from_status,to_status,requires_approval').eq('organization_id', org).order('created_at'),
    db.from('workflows').select('id,name,entity_type_id,definition,active,version,updated_at').eq('organization_id', org).order('updated_at', { ascending: false }),
    db.from('approval_requests').select('id,entity_id,from_status,to_status,requested_by,reason,status,decided_by,decided_at,decision_note,created_at').eq('organization_id', org).order('created_at', { ascending: false }).limit(100),
    db.from('workflow_runs').select('id,workflow_id,workflow_version,entity_id,status,attempts,max_attempts,last_error,created_by,created_at,finished_at,workflow_run_logs(id,attempt,step_index,action,outcome,message,created_at)').eq('organization_id', org).order('created_at', { ascending: false }).limit(50),
    db.from('notifications').select('id,title,body,link_entity_id,read_at,created_at').eq('organization_id', org).eq('user_id', context.userId).order('created_at', { ascending: false }).limit(50),
    can['audit.read'] ? db.from('audit_logs').select('id,action,resource_type,actor_user_id,created_at').eq('organization_id', org).order('created_at', { ascending: false }).limit(100) : Promise.resolve({ data: [], error: null }),
    db.from('profiles').select('id,display_name'),
  ])
  for (const r of [roles, rolePerms, members, invites, types, entities, states, transitions, workflows, approvals, runs, notifications, audit]) if (r.error) throw new Error('Unable to load workflows and access')
  const latest = new Map<string, { id: string; name: string }>()
  for (const t of types.data ?? []) if (!latest.has(t.id)) latest.set(t.id, { id: t.id, name: t.name })
  const names = new Map((profiles.data ?? []).map(p => [p.id, p.display_name]))
  return {
    role, can, userId: context.userId,
    roles: roles.data ?? [], rolePermissions: rolePerms.data ?? [],
    members: (members.data ?? []).map(m => ({ ...m, name: (names.get(m.user_id) as string | undefined) || (m.user_id === context.userId ? 'You' : `Member ${m.user_id.slice(0, 8)}`) })),
    invitations: (invites.data ?? []) as { id: string; role_key: string; expires_at: string; accepted_at: string | null; revoked_at: string | null; created_at: string }[], entityTypes: [...latest.values()],
    entities: (entities.data ?? []).map(e => ({ id: e.id, entityTypeId: e.entity_type_id, label: String(Object.values((e.data ?? {}) as Record<string, unknown>).find(v => typeof v === 'string' && v) ?? e.id.slice(0, 8)) })),
    states: states.data ?? [], transitions: transitions.data ?? [], workflows: workflows.data ?? [], approvals: approvals.data ?? [], runs: runs.data ?? [], notifications: notifications.data ?? [], audit: (audit.data ?? []) as { id: string; action: string; resource_type: string; actor_user_id: string | null; created_at: string }[],
  }
})

export const saveRole = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => roleRequest.parse(d)).handler(async ({ data, context }) => {
  await member(context, data.organizationId); await rpc(context, 'save_custom_role', { p_org: data.organizationId, p_key: data.key, p_name: data.name, p_permissions: data.permissions }, 'Unable to save role'); return { ok: true }
})
export const createInvite = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => inviteRequest.parse(d)).handler(async ({ data, context }) => {
  await member(context, data.organizationId)
  return await rpc(context, 'create_invitation', { p_org: data.organizationId, p_role: data.role, p_hours: data.hours }, 'Unable to create invitation') as { id: string; token: string; expiresAt: string }
})
export const revokeInvite = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => revokeRequest.parse(d)).handler(async ({ data, context }) => {
  await member(context, data.organizationId); await rpc(context, 'revoke_invitation', { p_org: data.organizationId, p_id: data.id }, 'Unable to revoke invitation'); return { ok: true }
})
export const acceptInvite = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => acceptRequest.parse(d)).handler(async ({ data, context }) => {
  return { organizationId: await rpc(context, 'accept_invitation', { p_token: data.token }, 'Invitation is invalid or expired') as string }
})
export const updateMember = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => memberRequest.parse(d)).handler(async ({ data, context }) => {
  await member(context, data.organizationId); await rpc(context, 'update_member', { p_org: data.organizationId, p_membership: data.membershipId, p_role: data.role, p_status: data.status }, 'Unable to update member'); return { ok: true }
})
export const saveTransitionRule = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => transitionRuleRequest.parse(d)).handler(async ({ data, context }) => {
  await member(context, data.organizationId); await rpc(context, 'save_status_transition', { p_org: data.organizationId, p_type: data.entityTypeId, p_from: data.from, p_to: data.to, p_requires_approval: data.requiresApproval }, 'Unable to save status rule'); return { ok: true }
})
export const transitionRecord = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => transitionRequest.parse(d)).handler(async ({ data, context }) => {
  await member(context, data.organizationId); return { result: await rpc(context, 'transition_entity', { p_org: data.organizationId, p_entity: data.entityId, p_to: data.to, p_reason: data.reason }, 'Unable to change status') as string }
})
export const decideApproval = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => decisionRequest.parse(d)).handler(async ({ data, context }) => {
  await member(context, data.organizationId); return { result: await rpc(context, 'decide_approval', { p_org: data.organizationId, p_id: data.id, p_approve: data.approve, p_note: data.note }, 'Unable to record decision') as string }
})
export const saveWorkflow = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => workflowRequest.parse(d)).handler(async ({ data, context }) => {
  await member(context, data.organizationId)
  return { id: await rpc(context, 'save_workflow', { p_org: data.organizationId, p_id: data.id, p_name: data.name, p_type: data.entityTypeId, p_definition: data.definition, p_active: data.active }, 'Unable to save workflow') as string }
})
export const runWorkflow = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => runRequest.parse(d)).handler(async ({ data, context }) => {
  await member(context, data.organizationId)
  return await rpc(context, 'run_workflow', { p_org: data.organizationId, p_workflow: data.workflowId, p_entity: data.entityId, p_request: data.requestId }, 'Unable to run workflow') as { runId: string; status: string; attempts: number; error: string }
})
export const retryRun = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => retryRequest.parse(d)).handler(async ({ data, context }) => {
  await member(context, data.organizationId)
  return await rpc(context, 'retry_workflow_run', { p_org: data.organizationId, p_run: data.runId }, 'Unable to retry workflow') as { runId: string; status: string; attempts: number; error: string }
})
export const markRead = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => readRequest.parse(d)).handler(async ({ data, context }) => {
  await member(context, data.organizationId); return { count: await rpc(context, 'mark_notifications_read', { p_org: data.organizationId, p_ids: data.ids }, 'Unable to update notifications') as number }
})

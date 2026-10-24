import { z } from 'zod'

// Mirrors the database allowlists; the database re-validates everything.
export const PERMISSIONS = ['members.invite','members.manage','roles.manage','workflows.manage','workflows.run','approvals.decide','entities.transition','audit.read'] as const
export const PERMISSION_LABELS: Record<(typeof PERMISSIONS)[number], string> = {
  'members.invite': 'Invite people', 'members.manage': 'Change member roles', 'roles.manage': 'Manage roles',
  'workflows.manage': 'Design workflows and status rules', 'workflows.run': 'Run workflows', 'approvals.decide': 'Approve or reject requests',
  'entities.transition': 'Change record status', 'audit.read': 'View activity log',
}
const status = z.string().regex(/^[a-z][a-z0-9_]{1,39}$/, 'Statuses use lowercase letters, numbers and underscores, e.g. under_review')
const uuid = z.string().uuid()
export const workflowStep = z.discriminatedUnion('action', [
  z.object({ action: z.literal('set_status'), to: status }).strict(),
  z.object({ action: z.literal('request_approval'), to: status }).strict(),
  z.object({ action: z.literal('assign'), user_id: uuid }).strict(),
  z.object({ action: z.literal('notify'), recipient: z.enum(['assignee','requester']), message: z.string().trim().min(1).max(300) }).strict(),
  z.object({ action: z.literal('notify'), recipient: z.literal('role'), role: z.string().regex(/^[a-z][a-z0-9_]{2,39}$/), message: z.string().trim().min(1).max(300) }).strict(),
])
export type WorkflowStep = z.infer<typeof workflowStep>
export const workflowDefinition = z.array(workflowStep).min(1).max(20)
const org = { organizationId: uuid }
export const orgRequest = z.object(org)
export const roleRequest = z.object({ ...org, key: z.string().regex(/^[a-z][a-z0-9_]{2,39}$/).refine(k => k !== 'owner' && k !== 'admin', 'Reserved role'), name: z.string().trim().min(1).max(80), permissions: z.array(z.enum(PERMISSIONS)).max(8) })
export const inviteRequest = z.object({ ...org, role: z.string().regex(/^[a-z][a-z0-9_]{2,39}$/).refine(r => r !== 'owner', 'Owners cannot be invited'), hours: z.number().int().min(1).max(168) })
export const revokeRequest = z.object({ ...org, id: uuid })
export const acceptRequest = z.object({ token: z.string().regex(/^[0-9a-f]{64}$/, 'Invitation is invalid or expired') })
export const memberRequest = z.object({ ...org, membershipId: uuid, role: z.string().regex(/^[a-z][a-z0-9_]{2,39}$/), status: z.enum(['active','suspended']) })
export const transitionRuleRequest = z.object({ ...org, entityTypeId: uuid, from: status, to: status, requiresApproval: z.boolean() }).refine(d => d.from !== d.to, 'Choose two different statuses')
export const transitionRequest = z.object({ ...org, entityId: uuid, to: status, reason: z.string().max(1000) })
export const decisionRequest = z.object({ ...org, id: uuid, approve: z.boolean(), note: z.string().max(1000) })
export const workflowRequest = z.object({ ...org, id: uuid.nullable(), name: z.string().trim().min(1).max(120), entityTypeId: uuid, definition: workflowDefinition, active: z.boolean() })
export const runRequest = z.object({ ...org, workflowId: uuid, entityId: uuid, requestId: uuid })
export const retryRequest = z.object({ ...org, runId: uuid })
export const readRequest = z.object({ ...org, ids: z.array(uuid).max(200).nullable() })

/** Database errors raised by our own checks (P0001) are safe to show; anything else is generic. */
export function safeDbError(error: { code?: string; message?: string } | null, fallback: string) {
  if (error?.code === 'P0001' && error.message) return error.message
  return fallback
}

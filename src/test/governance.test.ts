import { describe, expect, it } from 'vitest'
import { inviteRequest, roleRequest, safeDbError, workflowDefinition } from '@/services/governance-schemas'

const org = '2f0d3b40-e624-4e0d-90b0-c03579c455a3'
describe('workflow allowlist', () => {
  it('accepts the four allowed actions', () => {
    expect(workflowDefinition.safeParse([{ action: 'set_status', to: 'approved' }, { action: 'request_approval', to: 'closed' }, { action: 'assign', user_id: org }, { action: 'notify', recipient: 'role', role: 'member', message: 'Hi' }]).success).toBe(true)
  })
  it('rejects SQL, scripts and unknown actions', () => {
    expect(workflowDefinition.safeParse([{ action: 'sql', query: 'drop table entities' }]).success).toBe(false)
    expect(workflowDefinition.safeParse([{ action: 'set_status', to: 'done', script: 'fetch()' }]).success).toBe(false)
    expect(workflowDefinition.safeParse([{ action: 'set_status', to: "x'; drop table" }]).success).toBe(false)
  })
  it('limits workflows to 1-20 steps', () => {
    expect(workflowDefinition.safeParse([]).success).toBe(false)
    expect(workflowDefinition.safeParse(Array(21).fill({ action: 'set_status', to: 'done' })).success).toBe(false)
  })
})
describe('roles and invitations', () => {
  it('cannot create owner or admin roles or invite owners', () => {
    expect(roleRequest.safeParse({ organizationId: org, key: 'owner', name: 'x', permissions: [] }).success).toBe(false)
    expect(roleRequest.safeParse({ organizationId: org, key: 'admin', name: 'x', permissions: [] }).success).toBe(false)
    expect(roleRequest.safeParse({ organizationId: org, key: 'buyer', name: 'Buyer', permissions: ['superuser'] }).success).toBe(false)
    expect(inviteRequest.safeParse({ organizationId: org, role: 'owner', hours: 24 }).success).toBe(false)
  })
  it('invitations last between 1 and 168 hours', () => {
    expect(inviteRequest.safeParse({ organizationId: org, role: 'member', hours: 169 }).success).toBe(false)
    expect(inviteRequest.safeParse({ organizationId: org, role: 'member', hours: 168 }).success).toBe(true)
  })
  it('only shows messages raised by our own database checks', () => {
    expect(safeDbError({ code: 'P0001', message: 'Retry limit reached' }, 'x')).toBe('Retry limit reached')
    expect(safeDbError({ code: '42501', message: 'permission denied for table secrets' }, 'Unable')).toBe('Unable')
  })
})

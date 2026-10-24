import { describe, expect, it } from 'vitest'
import { isSafeReturnPath } from '@/lib/return-to'

describe('sign-in return path', () => {
  it('allows returning to the extension connection page', () => {
    expect(isSafeReturnPath('/extension-connect?redirect=https%3A%2F%2Fabc.chromiumapp.org%2F&state=ab12')).toBe(true)
  })
  it('rejects other sites and other pages', () => {
    expect(isSafeReturnPath('https://evil.example/extension-connect')).toBe(false)
    expect(isSafeReturnPath('//evil.example')).toBe(false)
    expect(isSafeReturnPath('/dashboard')).toBe(false)
  })
})

describe('invitation return path', () => {
  it('allows returning to an invitation link and nothing else', () => {
    expect(isSafeReturnPath('/invite#' + 'a'.repeat(64))).toBe(true)
    expect(isSafeReturnPath('/invite#abc')).toBe(false)
    expect(isSafeReturnPath('/invite?next=https://evil.example')).toBe(false)
  })
})

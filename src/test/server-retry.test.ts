import { describe, expect, it } from 'vitest'
import { friendlyError, isTransientError, retryServerCall } from '@/lib/server-retry'

describe('server call retries', () => {
  it('retries a temporary Unauthorized failure and then succeeds', async () => {
    let calls = 0; let refreshed = 0
    const result = await retryServerCall(async () => { calls++; if (calls < 3) throw new Error('Unauthorized'); return 'ok' }, { delayMs: 1, beforeRetry: async () => { refreshed++ } })
    expect(result).toBe('ok'); expect(calls).toBe(3); expect(refreshed).toBe(2)
  })
  it('never retries business errors such as access denial', async () => {
    let calls = 0
    await expect(retryServerCall(async () => { calls++; throw new Error('Organization access denied') }, { delayMs: 1 })).rejects.toThrow('Organization access denied')
    expect(calls).toBe(1)
  })
  it('stops after the attempt limit', async () => {
    let calls = 0
    await expect(retryServerCall(async () => { calls++; throw new Error('Failed to fetch') }, { delayMs: 1, attempts: 4 })).rejects.toThrow()
    expect(calls).toBe(4)
  })
  it('shows a plain message instead of raw Unauthorized', () => {
    expect(isTransientError(new Error('Unauthorized: Invalid token'))).toBe(true)
    expect(friendlyError(new Error('Unauthorized'), 'x')).toBe('The connection was interrupted. Please try again in a moment.')
    expect(friendlyError(new Error('Enter a two-letter country code, such as IN.'), 'x')).toBe('Enter a two-letter country code, such as IN.')
  })
})

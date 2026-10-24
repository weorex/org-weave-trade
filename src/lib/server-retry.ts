// Retries server calls that fail for temporary reasons (preview restarts, dropped
// connections, a session token mid-refresh). Business errors are never retried.
const transientPattern = /^unauthorized|failed to fetch|network|load failed|fetch failed|timeout|aborted|bad gateway|service unavailable|gateway timeout|internal server error/i

export function isTransientError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return transientPattern.test(message.trim())
}

export function friendlyError(error: unknown, fallback: string) {
  if (isTransientError(error)) return 'The connection was interrupted. Please try again in a moment.'
  return error instanceof Error && error.message ? error.message : fallback
}

export async function retryServerCall<T>(
  call: () => Promise<T>,
  options: { attempts?: number; delayMs?: number; beforeRetry?: () => Promise<unknown> } = {},
): Promise<T> {
  const attempts = options.attempts ?? 4
  const delayMs = options.delayMs ?? 600
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await call()
    } catch (error) {
      lastError = error
      if (!isTransientError(error) || attempt === attempts) throw error
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt))
      await options.beforeRetry?.().catch(() => undefined)
    }
  }
  throw lastError
}

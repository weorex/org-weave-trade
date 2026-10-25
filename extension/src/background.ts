import { APP } from './config'

// Connection only — this worker never reads pages or browsing activity.
// The approval page opens in a normal tab (Chrome closes the popup as soon as
// another window takes focus) and returns the capture-only credential through
// externally_connectable messaging, restricted to the fixed app origin.
const PENDING_MS = 10 * 60 * 1000

async function startConnect() {
  const bytes = crypto.getRandomValues(new Uint8Array(32)); const state = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  // The app validates this exact, stable callback before issuing a credential.
  const redirect = chrome.identity.getRedirectURL()
  await chrome.storage.session.set({ pending: { state, created: Date.now() } })
  await chrome.tabs.create({ url: `${APP}/extension-connect?${new URLSearchParams({ redirect, state })}` })
}

async function completeConnect(message: { state?: unknown; credential?: unknown; expires?: unknown }) {
  const { pending } = await chrome.storage.session.get('pending') as { pending?: { state: string; created: number } }
  if (!pending || Date.now() - pending.created > PENDING_MS) throw new Error('Connection request expired. Choose Connect in the extension again.')
  if (message.state !== pending.state) throw new Error('Connection response did not match')
  const token = message.credential; const expires = Number(message.expires)
  if (typeof token !== 'string' || !token.startsWith('wc1.') || !Number.isFinite(expires) || expires * 1000 <= Date.now()) throw new Error('Expired connection')
  await chrome.storage.session.remove(['pending', 'connectError'])
  await chrome.storage.session.set({ session: { token, expires } })
}

chrome.runtime.onMessage.addListener((message: unknown, sender, reply) => {
  if (sender.id !== chrome.runtime.id || (message as { type?: string } | null)?.type !== 'weorex-connect') return false
  void chrome.storage.session.remove('connectError')
  startConnect().then(() => reply({ ok: true }), (e: unknown) => reply({ ok: false, error: e instanceof Error ? e.message : 'Connection failed' }))
  return true
})

chrome.runtime.onMessageExternal.addListener((message: unknown, sender, reply) => {
  const data = message as { type?: string; state?: unknown; credential?: unknown; expires?: unknown } | null
  if (sender.origin !== new URL(APP).origin || data?.type !== 'weorex-capture-session') return false
  completeConnect(data).then(() => {
    reply({ ok: true })
    if (sender.tab?.id !== undefined) void chrome.tabs.remove(sender.tab.id)
  }, async (e: unknown) => {
    const error = e instanceof Error ? e.message : 'Connection failed'
    // Kept for the next popup opening, since the popup is usually closed by now.
    await chrome.storage.session.set({ connectError: error })
    reply({ ok: false, error })
  })
  return true
})

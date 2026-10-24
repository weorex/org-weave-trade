// Opaque, short-lived, capture-only delegation: the extension never receives
// an application bearer token. The server decrypts it only for this API.
const audience = 'weorex-capture-v1'
async function encryptionKey() {
  const secret = process.env['CAPTURE_SESSION_SECRET']
  if (!secret) throw new Error('Capture connection unavailable')
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt','decrypt'])
}
const encode = (bytes: Uint8Array) => btoa(Array.from(bytes, c => String.fromCharCode(c)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
const decode = (s: string) => Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0))
export async function issueCaptureSession(bearer: string, expires: number) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const body = new TextEncoder().encode(JSON.stringify({ audience, bearer, expires }))
  const encrypted = await crypto.subtle.encrypt({ name:'AES-GCM', iv, additionalData:new TextEncoder().encode(audience) }, await encryptionKey(), body)
  return `wc1.${encode(iv)}.${encode(new Uint8Array(encrypted))}`
}
export async function readCaptureSession(token: string) {
  const [prefix, ivText, text, extra] = token.split('.')
  if (prefix !== 'wc1' || !ivText || !text || extra || token.length > 12000) throw new Error('Invalid capture session')
  const iv = decode(ivText); if (iv.length !== 12) throw new Error('Invalid capture session')
  const raw = await crypto.subtle.decrypt({ name:'AES-GCM', iv, additionalData:new TextEncoder().encode(audience) }, await encryptionKey(), decode(text))
  const payload = JSON.parse(new TextDecoder().decode(raw))
  if (payload.audience !== audience || typeof payload.bearer !== 'string' || !Number.isFinite(payload.expires) || payload.expires * 1000 <= Date.now()) throw new Error('Expired capture session')
  return payload.bearer as string
}
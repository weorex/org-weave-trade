// Remembers where to return after sign-in. Only the extension connection page is allowed,
// so this can never be used to send people to another site.
const KEY = 'weorex.returnTo'
export function isSafeReturnPath(path: string | null): path is string {
  return !!path && /^\/extension-connect(\?[A-Za-z0-9=&%._~-]*)?$/.test(path)
}
export function rememberReturnPath(path: string) {
  if (isSafeReturnPath(path)) sessionStorage.setItem(KEY, path)
}
export function takeReturnPath(): string | null {
  const path = sessionStorage.getItem(KEY)
  sessionStorage.removeItem(KEY)
  return isSafeReturnPath(path) ? path : null
}

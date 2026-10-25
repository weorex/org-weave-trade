// Fixed app host; override at build time (e.g. VITE_WEOREX_APP_URL=http://localhost:8080) for local development.
export const APP: string = import.meta.env['VITE_WEOREX_APP_URL'] ?? 'https://org-weave-trade.lovable.app'

import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/capture')({ server: { handlers: {
  OPTIONS: async () => new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Authorization,Content-Type', 'Cache-Control': 'no-store' } }),
  GET: async ({ request }) => { const { handleCaptureApi } = await import('@/services/capture-api.server'); return handleCaptureApi(request) },
  POST: async ({ request }) => { const { handleCaptureApi } = await import('@/services/capture-api.server'); return handleCaptureApi(request) },
} } })
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { issueCaptureSession, readCaptureSession } from '../services/capture-session.server'
import { handleCaptureApi } from '../services/capture-api.server'

const previous = process.env['CAPTURE_SESSION_SECRET']
beforeAll(() => { process.env['CAPTURE_SESSION_SECRET'] = 'unit-test-only-capture-key-not-a-deployed-credential' })
afterAll(() => { if (previous === undefined) delete process.env['CAPTURE_SESSION_SECRET']; else process.env['CAPTURE_SESSION_SECRET'] = previous })
describe('Capture-only credential boundary', () => {
  it('encrypts rather than exposes the application bearer', async () => {
    const token = await issueCaptureSession('test-only-bearer', Math.floor(Date.now()/1000)+900)
    expect(token).not.toContain('test-only-bearer'); expect(await readCaptureSession(token)).toBe('test-only-bearer')
  })
  it('rejects tampering', async () => { const token = await issueCaptureSession('test-only-bearer',Math.floor(Date.now()/1000)+900); const parts=token.split('.'); parts[2]='a'+parts[2]?.slice(1); await expect(readCaptureSession(parts.join('.'))).rejects.toThrow() })
  it('rejects expired credentials', async () => { const token = await issueCaptureSession('test-only-bearer',Math.floor(Date.now()/1000)-1); await expect(readCaptureSession(token)).rejects.toThrow('Expired') })
  it('rejects ordinary application bearers at the capture API', async () => { const response=await handleCaptureApi(new Request('https://app.test/api/public/capture',{headers:{Authorization:'Bearer unrelated.application.token'}})); expect(response.status).toBe(401); expect(response.headers.get('Cache-Control')).toBe('no-store'); expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*') })
  it('rejects missing credentials', async () => { expect((await handleCaptureApi(new Request('https://app.test/api/public/capture'))).status).toBe(401) })
})
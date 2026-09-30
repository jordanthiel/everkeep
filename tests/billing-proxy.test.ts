import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from '../workers/stripe-license/src/index'
const destination = 'https://project.supabase.co/functions/v1/sharing/api/billing/webhook'
afterEach(() => vi.unstubAllGlobals())
describe('legacy billing endpoint migration', () => {
  it('forwards the exact signed webhook without issuing a license', async () => {
    const payload = '{ "id": "evt_test", "data": {} }'
    const forward = vi.fn(async (url: URL, init: RequestInit) => {
      expect(url.toString()).toBe(destination)
      expect(init.headers).toMatchObject({ 'Stripe-Signature': 't=123,v1=signature' })
      expect(await new Response(init.body).text()).toBe(payload)
      expect(init.redirect).toBe('error')
      return Response.json({ received: true })
    })
    vi.stubGlobal('fetch', forward)
    const response = await worker.fetch(new Request('https://worker.example/webhooks/stripe', { method: 'POST', headers: { 'Stripe-Signature': 't=123,v1=signature' }, body: payload }), { BILLING_SERVICE_URL: destination })
    expect(response.status).toBe(200); expect(forward).toHaveBeenCalledTimes(1)
  })
  it('fails closed without a trusted destination and retires key retrieval', async () => {
    const request = () => new Request('https://worker.example/webhooks/stripe', { method: 'POST', body: '{}' })
    expect((await worker.fetch(request(), {})).status).toBe(503)
    expect((await worker.fetch(request(), { BILLING_SERVICE_URL: 'https://attacker.example' })).status).toBe(503)
    const retired = await worker.fetch(new Request('https://worker.example/license?session_id=cs_old'), {})
    expect(retired.status).toBe(410)
    expect(await retired.text()).not.toContain('licenseKey')
  })
})

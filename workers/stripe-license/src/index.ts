/** Compatibility proxy for existing Stripe endpoint URLs. New installs point Stripe
 * directly at the Supabase billing webhook. No keys are issued or returned here. */
export interface Env { BILLING_SERVICE_URL?: string }
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'POST' && url.pathname === '/webhooks/stripe') {
      if (!env.BILLING_SERVICE_URL) return Response.json({ error: 'Email billing is not connected.' }, { status: 503 })
      const destination = new URL(env.BILLING_SERVICE_URL)
      if (destination.protocol !== 'https:' || !destination.hostname.endsWith('.supabase.co') || destination.pathname !== '/functions/v1/sharing/api/billing/webhook' || destination.username || destination.password || destination.search || destination.hash) return Response.json({ error: 'Invalid billing service configuration.' }, { status: 503 })
      return fetch(destination, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': request.headers.get('Stripe-Signature') ?? '' }, body: request.body, redirect: 'error' })
    }
    if (url.pathname === '/license') return Response.json({ error: 'Purchases are restored by signing into Everkeep with the email used at checkout. License keys are no longer issued.' }, { status: 410 })
    if (url.pathname === '/health') return Response.json({ ok: true, mode: 'email-billing-proxy' })
    return new Response('Not found', { status: 404 })
  }
}

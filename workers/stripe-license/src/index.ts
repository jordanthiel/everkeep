import { mintLicense, type LicenseClaims } from './license'

export interface Env {
  LICENSES: KVNamespace
  STRIPE_WEBHOOK_SECRET: string
  LICENSE_PRIVATE_KEY: string
  RESEND_API_KEY?: string
  FROM_EMAIL: string
  PRODUCT_NAME: string
  ALLOWED_ORIGIN?: string
}

interface StripeEvent {
  id: string
  type: string
  data: {
    object: {
      id: string
      customer_details?: { email?: string | null } | null
      customer_email?: string | null
      payment_status?: string
      status?: string
      amount_total?: number | null
      currency?: string | null
      metadata?: Record<string, string>
    }
  }
}

function json(data: unknown, status = 200, origin?: string): Response {
  const headers: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8'
  }
  if (origin) {
    headers['access-control-allow-origin'] = origin
    headers['access-control-allow-methods'] = 'GET, OPTIONS'
    headers['access-control-allow-headers'] = 'content-type'
  }
  return new Response(JSON.stringify(data), { status, headers })
}

async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string
): Promise<boolean> {
  if (!header) return false
  const parts = Object.fromEntries(
    header.split(',').map((item) => {
      const [key, ...rest] = item.split('=')
      return [key.trim(), rest.join('=')]
    })
  )
  const timestamp = parts.t
  const signature = parts.v1
  if (!timestamp || !signature) return false

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp))
  if (!Number.isFinite(ageSeconds) || ageSeconds > 60 * 5) return false

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${timestamp}.${payload}`)
  )
  const digest = [...new Uint8Array(signed)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return timingSafeEqual(digest, signature)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

async function emailLicense(
  env: Env,
  to: string,
  licenseKey: string,
  orderId: string
): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log(`Resend not configured; license for ${to} / ${orderId} stored in KV only.`)
    return
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: [to],
      subject: `Your ${env.PRODUCT_NAME} license key`,
      text: [
        `Thanks for purchasing ${env.PRODUCT_NAME}.`,
        '',
        'Paste this license key in Everkeep → Settings → License:',
        '',
        licenseKey,
        '',
        `Order: ${orderId}`,
        '',
        'Your vault stays on your computer and remains readable forever.'
      ].join('\n')
    })
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Failed to email license: ${response.status} ${body}`)
  }
}

async function handleCheckoutCompleted(env: Env, event: StripeEvent): Promise<Response> {
  const session = event.data.object
  const sessionId = session.id
  const email =
    session.customer_details?.email?.trim() ||
    session.customer_email?.trim() ||
    ''

  if (!sessionId) {
    return json({ error: 'Missing session id' }, 400)
  }
  if (!email) {
    return json({ error: 'Checkout session is missing a customer email' }, 400)
  }

  const existing = await env.LICENSES.get(`session:${sessionId}`)
  if (existing) {
    return json({ ok: true, reused: true })
  }

  const claims: LicenseClaims = {
    v: 1,
    email,
    product: 'lifetime',
    seats: 1,
    issuedAt: new Date().toISOString(),
    orderId: sessionId
  }
  const licenseKey = mintLicense(claims, env.LICENSE_PRIVATE_KEY)

  await env.LICENSES.put(
    `session:${sessionId}`,
    JSON.stringify({
      licenseKey,
      email,
      issuedAt: claims.issuedAt,
      orderId: sessionId
    })
  )

  await emailLicense(env, email, licenseKey, sessionId)
  return json({ ok: true })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = env.ALLOWED_ORIGIN

    if (request.method === 'OPTIONS') {
      return json({ ok: true }, 204, origin)
    }

    if (request.method === 'POST' && url.pathname === '/webhooks/stripe') {
      const payload = await request.text()
      const valid = await verifyStripeSignature(
        payload,
        request.headers.get('stripe-signature'),
        env.STRIPE_WEBHOOK_SECRET
      )
      if (!valid) {
        return json({ error: 'Invalid Stripe signature' }, 400)
      }

      const event = JSON.parse(payload) as StripeEvent
      if (event.type === 'checkout.session.completed') {
        return handleCheckoutCompleted(env, event)
      }
      return json({ ok: true, ignored: event.type })
    }

    if (request.method === 'GET' && url.pathname === '/license') {
      const sessionId = url.searchParams.get('session_id')?.trim()
      if (!sessionId) {
        return json({ error: 'session_id is required' }, 400, origin)
      }
      const stored = await env.LICENSES.get(`session:${sessionId}`)
      if (!stored) {
        return json({ error: 'License not ready yet. Refresh in a moment.' }, 404, origin)
      }
      const parsed = JSON.parse(stored) as {
        licenseKey: string
        email: string
        issuedAt: string
        orderId: string
      }
      return json(
        {
          licenseKey: parsed.licenseKey,
          email: parsed.email,
          issuedAt: parsed.issuedAt,
          orderId: parsed.orderId
        },
        200,
        origin
      )
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true })
    }

    return json({ error: 'Not found' }, 404)
  }
}

import { z } from 'zod'
import type { SharingEnv } from './ports.ts'
import type { SharingAccount } from './schema.ts'

export class BillingError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}
const emailSchema = z.string().trim().email().max(200).transform(email => email.toLowerCase())
const stripeId = z.string().max(255).regex(/^[a-z]+_[A-Za-z0-9_]+$/)

export async function stripeWebhook(env: SharingEnv, payload: string, header: string | null) {
  if (!env.STRIPE_WEBHOOK_SECRET || !env.STRIPE_SECRET_KEY || !env.STRIPE_LIFETIME_PRICE_ID) throw new BillingError(503, 'Payments are not configured.')
  const parts = (header ?? '').split(',').map(part => part.trim().split('='))
  const timestamp = parts.find(([key]) => key === 't')?.[1]
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) throw new BillingError(400, 'Invalid Stripe signature.')
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.STRIPE_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  let verified = false
  for (const [name, signature] of parts) {
    if (name !== 'v1' || !/^[a-f0-9]{64}$/.test(signature ?? '')) continue
    const bytes = Uint8Array.from(signature.match(/../g)!, hex => parseInt(hex, 16))
    if (await crypto.subtle.verify('HMAC', key, bytes, encoder.encode(`${timestamp}.${payload}`))) verified = true
  }
  if (!verified) throw new BillingError(400, 'Invalid Stripe signature.')
  let parsed: unknown
  try { parsed = JSON.parse(payload) } catch { throw new BillingError(400, 'Invalid event.') }
  const event = z.object({ id: stripeId, type: z.string(), livemode: z.boolean(), data: z.object({ object: z.record(z.unknown()) }) }).parse(parsed)
  if (event.livemode !== (env.STRIPE_LIVEMODE ?? true)) throw new BillingError(400, 'Stripe mode does not match this service.')
  if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
    const payment = stripeId.parse(event.data.object.payment_intent)
    if (event.type === 'charge.refunded' && !(Number(event.data.object.amount_refunded) > 0)) return { received: true }
    // A tombstone also handles a refund/dispute arriving before the checkout webhook.
    await env.DB.prepare('INSERT INTO billing_payment_blocks(payment_intent,reason) VALUES(?,?) ON CONFLICT(payment_intent) DO NOTHING').bind(payment, event.type).run()
    return { received: true }
  }
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) return { received: true }
  const id = stripeId.parse(event.data.object.id)
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}?expand[]=line_items`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` }, signal: AbortSignal.timeout(15000)
  })
  if (!response.ok) throw new BillingError(502, 'Unable to verify payment with Stripe. Retry this event.')
  const session = z.object({
    id: stripeId, livemode: z.boolean(), mode: z.string(), payment_status: z.string(), status: z.string().nullable(),
    payment_intent: stripeId.nullable(), created: z.number().int().nonnegative(),
    customer_details: z.object({ email: z.string().nullable() }).nullable(),
    line_items: z.object({ has_more: z.boolean(), data: z.array(z.object({ quantity: z.number().nullable(), price: z.object({ id: z.string() }).nullable() })) })
  }).parse(await response.json())
  if (session.id !== id || session.livemode !== (env.STRIPE_LIVEMODE ?? true)) throw new BillingError(400, 'Payment does not match the event.')
  if (session.mode !== 'payment' || session.status !== 'complete' || session.payment_status !== 'paid' || !session.payment_intent) return { received: true }
  if (session.line_items.has_more || session.line_items.data.length !== 1 || session.line_items.data[0].price?.id !== env.STRIPE_LIFETIME_PRICE_ID || session.line_items.data[0].quantity !== 1) return { received: true }
  const email = emailSchema.parse(session.customer_details?.email)
  await env.DB.prepare('INSERT INTO billing_orders(session_id,payment_intent,email,created_at) VALUES(?,?,?,?) ON CONFLICT(session_id) DO NOTHING')
    .bind(session.id, session.payment_intent, email, new Date(session.created * 1000).toISOString()).run()
  return { received: true }
}

export async function accountEntitlement(env: SharingEnv, user: SharingAccount) {
  // Claim website purchases only after email verification. Once claimed, ownership follows
  // the immutable Auth ID; changing an account email cannot give the purchase to someone else.
  await env.DB.prepare('UPDATE billing_orders SET account_id=? WHERE account_id IS NULL AND email=?').bind(user.id, user.email.toLowerCase()).run()
  const order = await env.DB.prepare('SELECT session_id,created_at FROM billing_orders WHERE account_id=? AND NOT EXISTS (SELECT 1 FROM billing_payment_blocks WHERE billing_payment_blocks.payment_intent=billing_orders.payment_intent) ORDER BY created_at DESC LIMIT 1')
    .bind(user.id).first<{ session_id: string; created_at: string }>()
  return { email: user.email, product: order ? 'lifetime' : 'free', orderId: order?.session_id ?? null, issuedAt: order?.created_at ?? null }
}

export function accountCheckout(env: SharingEnv, user: SharingAccount) {
  if (!env.STRIPE_PAYMENT_LINK_URL) throw new BillingError(503, 'Checkout is not configured.')
  const url = new URL(env.STRIPE_PAYMENT_LINK_URL)
  if (url.protocol !== 'https:' || url.hostname !== 'buy.stripe.com' || url.username || url.password) throw new BillingError(503, 'Checkout is not configured correctly.')
  url.searchParams.delete('prefilled_email')
  url.searchParams.set('locked_prefilled_email', user.email)
  return { url: url.toString() }
}

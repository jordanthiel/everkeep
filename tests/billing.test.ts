import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { createHmac, randomUUID } from 'crypto'
import { readFileSync } from 'fs'
import { createSharingHandler, type SharingEnv } from '../supabase/functions/_shared/sharing/handler'
import { authFixture } from './fixtures/sharing-auth'

let db: Database.Database, env: SharingEnv, handler: ReturnType<typeof createSharingHandler>
let session: Record<string, unknown>, stripeFails: boolean
const secret = 'whsec_test_only'
class Statement {
  constructor(readonly sql: string, readonly values: unknown[] = []) {}
  bind(...values: unknown[]) { return new Statement(this.sql, values) }
  async first<T>() { return (db.prepare(this.sql).get(...this.values) as T) ?? null }
  async all<T>() { return { results: db.prepare(this.sql).all(...this.values) as T[] } }
  async run() { return { meta: { changes: db.prepare(this.sql).run(...this.values).changes } } }
}
beforeEach(() => {
  db = new Database(':memory:'); db.exec(readFileSync('tests/fixtures/sharing-sqlite.sql', 'utf8'))
  session = { id: 'cs_purchase', livemode: false, mode: 'payment', status: 'complete', payment_status: 'paid', payment_intent: 'pi_purchase', created: 1790000000, customer_details: { email: ' Buyer@Example.com ' }, line_items: { has_more: false, data: [{ quantity: 1, price: { id: 'price_lifetime' } }] } }
  stripeFails = false
  env = {
    DB: { prepare: sql => new Statement(sql), batch: async () => [] }, AUTH: authFixture(() => {}),
    FILES: { put: async () => {}, get: async () => null, delete: async () => {} },
    PUBLIC_URL: 'https://everkeep.example/share', FROM_EMAIL: '', RESEND_API_KEY: '', DATA_KEY: 'configured', AUTH_SECRET: 'test-secret-'.repeat(5),
    STRIPE_WEBHOOK_SECRET: secret, STRIPE_SECRET_KEY: 'sk_test_fixture', STRIPE_LIFETIME_PRICE_ID: 'price_lifetime', STRIPE_LIVEMODE: false, STRIPE_PAYMENT_LINK_URL: 'https://buy.stripe.com/test_fixture'
  }
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions/cs_purchase?expand[]=line_items')
    expect(init.headers).toEqual({ Authorization: 'Bearer sk_test_fixture' })
    return Response.json(stripeFails ? { error: 'unavailable' } : session, { status: stripeFails ? 503 : 200 })
  }))
  handler = createSharingHandler(env)
})
afterEach(() => { db.close(); vi.unstubAllGlobals() })
function call(path: string, token = '', method = 'GET', payload?: string, signature?: string) {
  return handler(new Request(`https://everkeep.example/api${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(signature ? { 'Stripe-Signature': signature } : {}) }, body: payload }))
}
async function signIn(email = 'buyer@example.com') {
  await env.AUTH.requestCode(email)
  return env.AUTH.verifyCode(email, '123456')
}
function webhook(type = 'checkout.session.completed', object: Record<string, unknown> = { id: 'cs_purchase' }, options: { age?: number; signingSecret?: string; live?: boolean; extraSignature?: boolean } = {}) {
  const payload = JSON.stringify({ id: `evt_${randomUUID().replaceAll('-', '')}`, type, livemode: options.live ?? false, data: { object } })
  const time = Math.floor(Date.now() / 1000) - (options.age ?? 0)
  const sig = createHmac('sha256', options.signingSecret ?? secret).update(`${time}.${payload}`).digest('hex')
  return call('/billing/webhook', '', 'POST', payload, `t=${time},v1=${sig}${options.extraSignature ? ',v1=' + '0'.repeat(64) : ''}`)
}
async function plan(token: string) { const response = await call('/billing/entitlement', token); expect(response.status).toBe(200); return response.json() }

describe('email billing', () => {
  it('grants a verified buyer automatically, deduplicates retries, and never trusts supplied email or metadata', async () => {
    const buyer = await signIn(), other = await signIn('other@example.com')
    expect((await webhook('checkout.session.completed', { id: 'cs_purchase', customer_details: { email: 'other@example.com' }, metadata: { product: 'family' } }, { extraSignature: true })).status).toBe(200)
    expect((await webhook()).status).toBe(200)
    expect(db.prepare('SELECT count(*) AS count FROM billing_orders').get()).toEqual({ count: 1 })
    expect((await call('/billing/entitlement')).status).toBe(401)
    expect(await plan(buyer.token)).toMatchObject({ product: 'lifetime', email: 'buyer@example.com', orderId: 'cs_purchase' })
    expect(await plan(other.token)).toMatchObject({ product: 'free', orderId: null })
    expect(await (await call('/billing/entitlement?email=buyer@example.com', other.token)).json()).toMatchObject({ product: 'free' })
    const checkout = await (await call('/billing/checkout', buyer.token)).json() as { url: string }
    expect(new URL(checkout.url).searchParams.get('locked_prefilled_email')).toBe('buyer@example.com')
    expect((await call('/billing/checkout')).status).toBe(401)
  })
  it('keeps a claimed purchase with its account ID after an email change', async () => {
    const buyer = await signIn(); await webhook(); await plan(buyer.token)
    env.AUTH.user = async token => token === buyer.token ? { id: buyer.account.id, email: 'changed@example.com' } : { id: randomUUID(), email: 'buyer@example.com' }
    expect(await plan(buyer.token)).toMatchObject({ product: 'lifetime', email: 'changed@example.com' })
    expect(await plan('replacement-account')).toMatchObject({ product: 'free' })
  })
  it('rejects forged, expired and wrong-mode events; fails closed without configuration', async () => {
    expect((await webhook(undefined, undefined, { signingSecret: 'wrong' })).status).toBe(400)
    expect((await webhook(undefined, undefined, { age: 301 })).status).toBe(400)
    expect((await webhook(undefined, undefined, { live: true })).status).toBe(400)
    env.STRIPE_WEBHOOK_SECRET = ''
    expect((await webhook()).status).toBe(503)
    expect(db.prepare('SELECT count(*) AS count FROM billing_orders').get()).toEqual({ count: 0 })
  })
  it('waits for settlement and only grants the configured one-time product', async () => {
    const buyer = await signIn()
    session.payment_status = 'unpaid'; await webhook()
    expect(await plan(buyer.token)).toMatchObject({ product: 'free' })
    session.payment_status = 'paid'; session.line_items = { has_more: false, data: [{ quantity: 1, price: { id: 'price_other' } }] }; await webhook()
    expect(await plan(buyer.token)).toMatchObject({ product: 'free' })
    session.line_items = { has_more: false, data: [{ quantity: 1, price: { id: 'price_lifetime' } }] }
    session.mode = 'subscription'; await webhook()
    expect(await plan(buyer.token)).toMatchObject({ product: 'free' })
    session.mode = 'payment'; expect((await webhook('checkout.session.async_payment_succeeded')).status).toBe(200)
    expect(await plan(buyer.token)).toMatchObject({ product: 'lifetime' })
  })
  it('retries Stripe outages without granting an unverified purchase', async () => {
    stripeFails = true; expect((await webhook()).status).toBe(502)
    expect(db.prepare('SELECT count(*) AS count FROM billing_orders').get()).toEqual({ count: 0 })
    stripeFails = false; expect((await webhook()).status).toBe(200)
  })
  it.each(['charge.refunded', 'charge.dispute.created'])('blocks %s even before checkout arrives, without letting retries reinstate it', async type => {
    const buyer = await signIn()
    expect((await webhook(type, { payment_intent: 'pi_purchase', amount_refunded: 7900 })).status).toBe(200)
    await webhook(); await webhook()
    expect(await plan(buyer.token)).toMatchObject({ product: 'free' })
  })
  it('removes refunded access but retains a separate valid purchase', async () => {
    const buyer = await signIn(); await webhook()
    expect(await plan(buyer.token)).toMatchObject({ product: 'lifetime' })
    await webhook('charge.refunded', { payment_intent: 'pi_purchase', amount_refunded: 7900 })
    expect(await plan(buyer.token)).toMatchObject({ product: 'free' })
    db.prepare('INSERT INTO billing_orders VALUES(?,?,?,?,?)').run('cs_second', 'pi_second', 'buyer@example.com', null, '2026-09-30T12:00:00Z')
    expect(await plan(buyer.token)).toMatchObject({ product: 'lifetime', orderId: 'cs_second' })
  })
})

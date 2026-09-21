import { describe, it, expect, vi } from 'vitest'
import { randomUUID } from 'crypto'
import { createSupabaseAuth, createSupabaseBucket } from '../supabase/functions/_shared/sharing/supabase'
import { SharingTransport, type SharingSession } from '../src/shared/sharingTransport'
const session = (): SharingSession => ({ token: 'access', refreshToken: 'refresh', expiresAt: Date.now() + 3600000, account: { id: randomUUID(), email: 'owner@example.com' } })
describe('Supabase integration contracts', () => {
  it('uses Supabase OTP, verified identities, refresh tokens and local logout', async () => {
    const value = session(), calls: Array<{ url: string; body: unknown; headers: Headers }> = []
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null, headers: new Headers(init?.headers) })
      return Response.json(String(url).endsWith('/user') ? { ...value.account, email_confirmed_at: '2026-01-01' } : { access_token: value.token, refresh_token: value.refreshToken, expires_in: 3600, user: { ...value.account, email_confirmed_at: '2026-01-01' } })
    })
    const auth = createSupabaseAuth('https://project.supabase.co', 'public-key', fetcher)
    await auth.requestCode(value.account.email); expect(calls[0].url).toContain('/auth/v1/otp'); expect(calls[0].body).toEqual({ email: value.account.email, create_user: true })
    expect((await auth.verifyCode(value.account.email, '123456')).account).toEqual(value.account); expect(calls[1].body).toMatchObject({ type: 'email', token: '123456' })
    await auth.refresh('refresh'); expect(calls[2].url).toContain('grant_type=refresh_token')
    expect(await auth.user('access')).toEqual(value.account); expect(calls[3].headers.get('Authorization')).toBe('Bearer access')
    await auth.logout('access'); expect(calls[4].url).toContain('/logout?scope=local')
    expect(calls.every(call => call.headers.get('apikey') === 'public-key')).toBe(true)
  })
  it('rejects an unverified Supabase email and preserves outage errors', async () => {
    const auth = createSupabaseAuth('https://project.supabase.co', 'key', async () => Response.json({ user: { id: randomUUID(), email: 'unverified@example.com' } }))
    await expect(auth.verifyCode('unverified@example.com', '123456')).rejects.toThrow('Verify your email')
    const unavailable = createSupabaseAuth('https://project.supabase.co', 'key', async () => new Response('', { status: 503 }))
    await expect(unavailable.user('token')).rejects.toMatchObject({ status: 503 })
  })
  it('keeps Storage requests private and authenticates only with the server key', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const bucket = createSupabaseBucket('https://project.supabase.co', 'server-only', 'everkeep-shared-files', async (url, init) => { calls.push({ url: String(url), init }); return new Response('content') })
    await bucket.put('vaults/example', new Uint8Array([1, 2, 3])); expect(await (await bucket.get('vaults/example'))!.arrayBuffer()).toBeInstanceOf(ArrayBuffer); await bucket.delete('vaults/example')
    expect(calls.every(call => !call.url.includes('/public/') && new Headers(call.init?.headers).get('Authorization') === 'Bearer server-only')).toBe(true)
    expect(JSON.parse(String(calls[2].init?.body))).toEqual({ prefixes: ['vaults/example'] })
  })
})
describe('sharing session renewal', () => {
  it('renews once for concurrent requests and persists the rotated refresh token', async () => {
    const initial = session(); initial.expiresAt = 0
    const next = { ...initial, token: 'next-access', refreshToken: 'next-refresh', expiresAt: Date.now() + 3600000 }, persisted = vi.fn()
    const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith('/auth/refresh')) return Response.json(next)
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer next-access'); return Response.json({ ready: true })
    })
    const transport = new SharingTransport('https://project.supabase.co/functions/v1/sharing', persisted, initial, fetcher)
    expect(await Promise.all([transport.request('/vaults'), transport.request('/vaults')])).toEqual([{ ready: true }, { ready: true }]); expect(fetcher.mock.calls.filter(call => String(call[0]).endsWith('/auth/refresh'))).toHaveLength(1); expect(persisted).toHaveBeenCalledWith(next)
  })
  it('retains a session on outages but clears a rejected refresh token', async () => {
    const initial = session(); initial.expiresAt = 0
    let status = 503
    const transport = new SharingTransport('https://example.com', () => {}, initial, async () => Response.json({ error: 'Unavailable' }, { status }))
    await expect(transport.request('/vaults')).rejects.toThrow('[503]'); expect(transport.session).not.toBeNull()
    status = 401; await expect(transport.request('/vaults')).rejects.toThrow('[401]'); expect(transport.session).toBeNull()
  })
  it('cannot restore the previous account when a refresh finishes after logout', async () => {
    const initial = session(); initial.expiresAt = 0
    let finish!: (response: Response) => void
    const transport = new SharingTransport('https://example.com', () => {}, initial, () => new Promise(resolve => { finish = resolve }))
    const pending = transport.request('/vaults'); transport.setSession(null); finish(Response.json({ ...initial, expiresAt: Date.now() + 3600000 }))
    await expect(pending).rejects.toThrow('account changed'); expect(transport.session).toBeNull()
  })
})

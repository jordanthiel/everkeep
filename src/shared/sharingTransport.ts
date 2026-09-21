import { z } from 'zod'
const SessionSchema = z.object({ token: z.string().min(1), refreshToken: z.string().min(1), expiresAt: z.number(), account: z.object({ id: z.string().uuid(), email: z.string().email() }) })
export type SharingSession = z.infer<typeof SessionSchema>
export class SharingRequestError extends Error { constructor(message: string, readonly status: number) { super(`[${status}] ${message}`) } }
/** Auth tokens only. Vault records, passwords and packet contents are never persisted here. */
export class SharingTransport {
  session: SharingSession | null = null
  private generation = 0
  private refreshing: Promise<void> | null = null
  constructor(readonly url: string, private readonly onSession: (session: SharingSession | null) => void, saved?: unknown, private readonly fetcher: typeof fetch = fetch.bind(globalThis)) { if (saved) { const result = SessionSchema.safeParse(saved); if (result.success) this.session = result.data } }
  setSession(value: unknown) { this.session = value ? SessionSchema.parse(value) : null; this.generation++; this.onSession(this.session) }
  private async raw(path: string, method: string, input?: unknown) {
    if (!this.url) throw new Error('Online sharing is not configured for this build.')
    return this.fetcher(`${this.url}/api${path}`, { method, headers: { 'Content-Type': 'application/json', ...(this.session ? { Authorization: `Bearer ${this.session.token}` } : {}) }, body: input === undefined ? undefined : JSON.stringify(input), signal: AbortSignal.timeout(30000) })
  }
  private async refresh() {
    if (this.refreshing) return this.refreshing
    const generation = this.generation, token = this.session?.refreshToken
    if (!token) throw new SharingRequestError('Sign in to continue.', 401)
    this.refreshing = (async () => {
      const response = await this.raw('/auth/refresh', 'POST', { refreshToken: token })
      const result = await response.json()
      if (generation !== this.generation) throw new Error('Your sharing account changed.')
      if (!response.ok) { if (response.status === 401) this.setSession(null); throw new SharingRequestError(result.error || 'Unable to renew your session.', response.status) }
      this.setSession(result)
    })()
    try { await this.refreshing } finally { this.refreshing = null }
  }
  async fetch(path: string, init: RequestInit = {}) {
    if (!this.url) throw new Error('Online sharing is not configured for this build.')
    if (this.session && this.session.expiresAt < Date.now() + 30000) await this.refresh()
    let generation = this.generation
    const send = () => this.fetcher(`${this.url}/api${path}`, { ...init, headers: { ...init.headers, ...(this.session ? { Authorization: `Bearer ${this.session.token}` } : {}) } })
    let response = await send()
    if (generation !== this.generation) throw new Error('Your sharing session changed. Try again.')
    if (response.status === 401 && this.session?.refreshToken) { await this.refresh(); generation = this.generation; response = await send() }
    if (generation !== this.generation) throw new Error('Your sharing session changed. Try again.')
    if (response.status === 401) this.setSession(null)
    return response
  }
  async request<T>(path: string, method = 'GET', input?: unknown): Promise<T> {
    const response = path.startsWith('/auth/') ? await this.raw(path, method, input) : await this.fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: input === undefined ? undefined : JSON.stringify(input), signal: AbortSignal.timeout(30000) })
    const result = await response.json()
    if (!response.ok) throw new SharingRequestError(result.error || 'Sharing request failed.', response.status)
    return result as T
  }
  async verify(challengeId: string, email: string, code: string) {
    const generation = this.generation
    const result = await this.request<SharingSession>('/auth/verify', 'POST', { challengeId, email, code })
    if (generation !== this.generation) throw new Error('Your sharing account changed.')
    this.setSession(result); return result.account
  }
  async logout() { try { if (this.session) await this.request('/auth/logout', 'POST', {}) } finally { this.setSession(null) } }
}

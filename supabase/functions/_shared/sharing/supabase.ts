import { AuthError, type AuthSession, type Bucket, type SharingAuth } from './ports.ts'
interface SessionResponse { access_token: string; refresh_token: string; expires_in: number; user: { id: string; email?: string; email_confirmed_at?: string } }
export function createSupabaseAuth(url: string, anonKey: string, fetcher: typeof fetch = fetch, serviceKey = ''): SharingAuth {
  async function request(path: string, method: string, input?: unknown, token?: string) {
    const response = await fetcher(`${url}/auth/v1${path}`, { method, headers: { apikey: anonKey, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: input === undefined ? undefined : JSON.stringify(input) })
    if (!response.ok) { const status = response.status === 429 ? 429 : response.status >= 500 ? 503 : 401; throw new AuthError(status, status === 429 ? 'Too many sign-in attempts. Please try again later.' : status === 503 ? 'Sign-in is temporarily unavailable. Please try again.' : 'Incorrect or expired sign-in code or session.') }
    return response.status === 204 ? {} : await response.json()
  }
  function session(result: SessionResponse): AuthSession {
    if (!result.user.email || !result.user.email_confirmed_at) throw new AuthError(401, 'Verify your email before sharing.')
    return { token: result.access_token, refreshToken: result.refresh_token, expiresAt: Date.now() + result.expires_in * 1000, account: { id: result.user.id, email: result.user.email.toLowerCase() } }
  }
  return {
    createEmailLink: async email => {
      if (!serviceKey) throw new AuthError(503, 'Invitation sign-in is not configured.')
      const response = await fetcher(`${url}/auth/v1/admin/generate_link`, { method: 'POST', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', email }) })
      if (!response.ok) throw new AuthError(503, 'Unable to create invitation sign-in link. Please retry.')
      const result = await response.json()
      if (typeof result.hashed_token !== 'string' || !result.hashed_token) throw new AuthError(503, 'Unable to create invitation sign-in link.')
      return result.hashed_token
    },
    verifyEmailLink: async tokenHash => session(await request('/verify', 'POST', { token_hash: tokenHash, type: 'email' })),
    requestCode: async email => { await request('/otp', 'POST', { email, create_user: true }) },
    verifyCode: async (email, code) => session(await request('/verify', 'POST', { email, token: code, type: 'email' })),
    refresh: async refreshToken => session(await request('/token?grant_type=refresh_token', 'POST', { refresh_token: refreshToken })),
    user: async token => { try { const user = await request('/user', 'GET', undefined, token); return user.email && user.email_confirmed_at ? { id: user.id, email: user.email.toLowerCase() } : null } catch (error) { if (error instanceof AuthError && error.status === 401) return null; throw error } },
    logout: async token => { await request('/logout?scope=local', 'POST', undefined, token) }
  }
}
// All objects are private. Browser and desktop callers never receive this service key.
export function createSupabaseBucket(url: string, serviceKey: string, bucket = 'everkeep-shared-files', fetcher: typeof fetch = fetch): Bucket {
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  const path = (key: string) => `${url}/storage/v1/object/${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`
  return {
    put: async (key, value) => { const response = await fetcher(path(key), { method: 'POST', headers: { ...headers, 'Content-Type': 'application/octet-stream', 'x-upsert': 'true' }, body: typeof value === 'string' ? value : new Uint8Array(value) }); if (!response.ok) throw new Error('Unable to store shared content.') },
    get: async key => { const response = await fetcher(path(key), { headers }); if (response.status === 404 || response.status === 400) return null; if (!response.ok) throw new Error('Unable to read shared content.'); return { arrayBuffer: () => response.arrayBuffer() } },
    delete: async key => { const response = await fetcher(`${url}/storage/v1/object/${encodeURIComponent(bucket)}`, { method: 'DELETE', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [key] }) }); if (!response.ok) throw new Error('Unable to remove outdated shared content.') }
  }
}

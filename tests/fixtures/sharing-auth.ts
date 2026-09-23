import { randomUUID } from 'crypto'
import { AuthError, type AuthSession, type SharingAuth } from '../../supabase/functions/_shared/sharing/ports'
/** Test-only Supabase Auth stand-in. Production always uses the Supabase Auth API. */
export function authFixture(mail: (to: string, text: string) => void): SharingAuth {
  const users = new Map<string, string>(), codes = new Map<string, { code: string; attempts: number }>(), sessions = new Map<string, AuthSession>(), refreshes = new Map<string, AuthSession>()
  function issue(email: string) {
    if (!users.has(email)) users.set(email, randomUUID())
    const session = { token: randomUUID(), refreshToken: randomUUID(), expiresAt: Date.now() + 3600000, account: { id: users.get(email)!, email } }
    sessions.set(session.token, session); refreshes.set(session.refreshToken, session); return session
  }
  const links = new Map<string, string>()
  return {
    createEmailLink: async email => { const token = randomUUID(); links.set(token, email); return token },
    verifyEmailLink: async token => { const email = links.get(token); if (!email) throw new AuthError(401, 'Expired sign-in link.'); links.delete(token); return issue(email) },
    requestCode: async email => { const code = '123456'; codes.set(email, { code, attempts: 0 }); mail(email, `Your sign-in code is ${code}.`) },
    verifyCode: async (email, code) => { const pending = codes.get(email); if (!pending || pending.attempts++ >= 5 || code !== pending.code) throw new AuthError(401, 'Incorrect or expired code.'); codes.delete(email); return issue(email) },
    refresh: async token => { const previous = refreshes.get(token); if (!previous) throw new AuthError(401, 'Session expired.'); refreshes.delete(token); return issue(previous.account.email) },
    user: async token => sessions.get(token)?.account ?? null,
    logout: async token => { const session = sessions.get(token); sessions.delete(token); if (session) refreshes.delete(session.refreshToken) }
  }
}

import React from 'react'
import { createRoot } from 'react-dom/client'
import { SharedVaultApp } from '../src/sharing/SharedVaultApp'
import type { SharingClient } from '../src/shared/sharing'
import { SharingTransport } from '../src/shared/sharingTransport'
// Supabase Edge Function base URL; the portal itself can stay on the existing website.
const endpoint = (import.meta.env.VITE_SHARING_API_URL || (['localhost', '127.0.0.1'].includes(location.hostname) ? location.origin : '')).replace(/\/$/, '')
const storageKey = `everkeep-sharing-session:${endpoint}`
let saved: unknown
try { saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null') } catch { /* Invalid sessions require sign-in again. */ }
const transport = new SharingTransport(endpoint, session => { try { if (session) sessionStorage.setItem(storageKey, JSON.stringify(session)); else sessionStorage.removeItem(storageKey) } catch { /* With storage disabled, sign-in lasts until this page closes. */ } }, saved)
const request = <T,>(path: string, method = 'GET', input?: unknown) => transport.request<T>(path, method, input)
const client: SharingClient = {
  status: async () => ({ configured: Boolean(endpoint), url: `${location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/share`, account: await request('/account'), local: null }),
  requestCode: email => request('/auth/request', 'POST', { email }),
  verifyCode: async (challengeId, email, code) => transport.verify(challengeId, email, code),
  logout: () => transport.logout(),
  list: () => request('/vaults'), get: id => request(`/vaults/${id}`), accept: id => request(`/vaults/${id}/accept`, 'POST', {}),
  edit: (id, recordId, input) => request(`/vaults/${id}/records/${recordId}`, 'PATCH', input),
  members: id => request(`/vaults/${id}/members`), invite: (id, input) => request(`/vaults/${id}/invite`, 'POST', input),
  grant: (id, input) => request(`/vaults/${id}/grant`, 'PATCH', input), revoke: (id, email) => request(`/vaults/${id}/revoke`, 'POST', { email }),
  attachment: async (id, recordId, attachmentId) => {
    const response = await transport.fetch(`/vaults/${id}/records/${recordId}/attachments/${attachmentId}`)
    if (!response.ok) throw new Error('Attachment unavailable. Your access may have changed.')
    const url = URL.createObjectURL(await response.blob()), anchor = document.createElement('a')
    anchor.href = url; anchor.download = decodeURIComponent(response.headers.get('Content-Disposition')?.match(/filename\*=UTF-8''(.+)/)?.[1] || 'attachment'); anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
// An unsigned-in visitor should see the email form, not an authentication error.
const rawStatus = client.status
client.status = async () => { try { return await rawStatus() } catch { return { configured: Boolean(endpoint), url: `${location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/share`, account: null, local: null } } }
const match = location.hash.match(/^#vault\/([a-f0-9-]{36})$/)
createRoot(document.getElementById('root')!).render(<React.StrictMode><nav aria-label="Everkeep website" style={{ padding: '16px 24px' }}><a href="/">← Everkeep home</a></nav><SharedVaultApp client={client} initialVaultId={match?.[1]} /></React.StrictMode>)

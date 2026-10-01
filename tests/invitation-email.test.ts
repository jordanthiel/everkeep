import { describe, expect, it } from 'vitest'
import { invitationHtml } from '../supabase/functions/_shared/sharing/invitation-email'
import type { ShareInvitation } from '../supabase/functions/_shared/sharing/schema'

const input: ShareInvitation = { email: 'recipient@example.com', scope: { type: 'selected', recordIds: ['record'] }, canEdit: true, instructions: '<script>alert(1)</script>\nDownload here', password: 'local-secret', requestId: 'request' }

describe('vault invitation email', () => {
  it('escapes owner content and preserves the personal sign-in URL', () => {
    const html = invitationHtml('<Vault>', 'owner@example.com', 'https://example.com/share/#vault/id?token_hash=abc&type=email', input)
    expect(html).toContain('&lt;Vault&gt;')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;<br>Download here')
    expect(html).not.toContain('<script>')
    expect(html).toContain('href="https://example.com/share/#vault/id?token_hash=abc&amp;type=email"')
    expect(html).toContain('1 selected record(s) · Can edit')
    expect(html).toContain('local-secret')
    expect(html).toContain('Do not forward it')
  })

  it('explains file access without including the original vault password', () => {
    const html = invitationHtml('Vault', 'Owner', 'https://example.com/share', input, 'file')
    expect(html).toContain('Open an Everkeep file')
    expect(html).toContain('Changes do not synchronize automatically')
    expect(html).not.toContain('local-secret')
    expect(html).toContain('Revocation cannot erase')
  })
})

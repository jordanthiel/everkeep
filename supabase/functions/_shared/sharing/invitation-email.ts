import type { ShareInvitation } from './schema.ts'

const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)

export function invitationHtml(vaultName: string, owner: string, url: string, input: ShareInvitation, storage: 'file' | 'hosted' = 'hosted'): string {
  const paragraph = (text: string) => `<p style="margin:0 0 20px;font-size:16px;line-height:26px;color:#3D3A36;">${text}</p>`
  const scope = input.scope.type === 'all' ? 'Entire vault' : `${input.scope.recordIds.length} selected record(s)`
  const permissions = input.canEdit
    ? storage === 'file' ? 'You may edit your own file copy. Changes do not synchronize automatically.' : 'You may edit the information shared with you. You cannot manage access.'
    : 'View only. Editing is not enabled.'
  const instructions = storage === 'file'
    ? 'Download the access-controlled .everkeep file from the location supplied by the owner. Open the link below, accept the invitation, and choose Open an Everkeep file. You can also open the file from Shared with me in the desktop app.'
    : 'Open the link below to sign in and access the vault in your browser. You can also choose “Open in Everkeep” on that page after installing the app.'
  const privacy = storage === 'file'
    ? 'Everkeep stores permissions and protected encryption keys, not this file’s contents. An internet connection is required to verify access. Revocation cannot erase information already opened or copied.'
    : 'This link shows the latest synchronized information. The owner can change or revoke your access.'
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>You’re invited to an Everkeep vault</title></head>
<body style="margin:0;padding:0;background-color:#F8F5F0;color:#1C1A18;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escape(owner)} shared ${escape(vaultName)} with you.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#F8F5F0;"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;">
<tr><td style="padding:0 8px 24px;color:#3A4533;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:38px;">Everkeep<span style="color:#B08D5B;">.</span></td></tr>
<tr><td style="padding:32px 24px;background-color:#FDFCFA;border:1px solid #E5DDD2;border-top:4px solid #3A4533;border-radius:8px;">
<h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:36px;font-weight:normal;">A vault has been shared with you</h1>
${paragraph(`<strong>${escape(owner)}</strong> invited you to <strong>${escape(vaultName)}</strong>.`)}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:20px;background-color:#F0EBE3;border:1px solid #E5DDD2;border-radius:6px;font-size:14px;line-height:23px;color:#3D3A36;"><strong>${escape(scope)} · ${input.canEdit ? 'Can edit' : 'View only'}</strong><br>${permissions}</td></tr></table>
<div style="padding-top:24px;">${paragraph(instructions)}</div>
${input.instructions ? paragraph(`<strong>A note from the owner</strong><br>${escape(input.instructions).replace(/\r?\n/g, '<br>')}`) : ''}
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#3A4533" style="border-radius:6px;"><a href="${escape(url)}" style="display:inline-block;padding:15px 24px;border:1px solid #3A4533;border-radius:6px;color:#FFFFFF;font-size:16px;line-height:22px;font-weight:bold;text-decoration:none;">Open shared vault</a></td></tr></table>
<p style="margin:16px 0 24px;font-size:13px;line-height:21px;color:#7A7268;">This personal sign-in link expires and can be used once. Do not forward it. If it expires, use email sign-in on the portal.</p>
${storage === 'hosted' && input.password ? paragraph(`<strong>Password for the owner’s local vault file</strong><br><span style="font-family:'Courier New',Courier,monospace;">${escape(input.password)}</span><br>This is not required for the online link.`) : ''}
<p style="margin:0 0 20px;font-size:13px;line-height:21px;color:#7A7268;">If the button doesn’t work, copy this link into your browser:<br><a href="${escape(url)}" style="color:#3A4533;word-break:break-all;">${escape(url)}</a></p>
<p style="margin:0;padding-top:24px;border-top:1px solid #E5DDD2;font-size:14px;line-height:23px;color:#7A7268;">${privacy}</p>
</td></tr><tr><td style="padding:24px 8px 0;font-size:13px;line-height:21px;color:#7A7268;">A little organization. A lot of peace of mind.</td></tr>
</table></td></tr></table></body></html>`
}

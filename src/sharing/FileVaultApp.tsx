import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SharingClient, SharedVaultView } from '../shared/sharing'
import { AccessFileSchema, MAX_ACCESS_FILE_BYTES, fromBase64, openRecord, sealRecord, type AccessFile } from '../shared/accessFile'
import { SharedVaultApp } from './SharedVaultApp'
import { message } from './SharingAccount'

function download(bytes: BlobPart, name: string) {
  const url = URL.createObjectURL(new Blob([bytes])), anchor = document.createElement('a')
  anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function FileVaultApp({ client, initialVaultId, desktop = false, onEditingChange, takeOpenFile }: { takeOpenFile?: () => Promise<string | null>; client: SharingClient; initialVaultId?: string; desktop?: boolean; onEditingChange?: (dirty: boolean, busy: boolean) => void }) {
  const [file, setFile] = useState<AccessFile | null>(null), current = useRef<AccessFile | null>(null)
  const [dirty, setDirty] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [formDirty, setFormDirty] = useState(false), [formBusy, setFormBusy] = useState(false)
  const changed = useCallback((dirty: boolean, busy: boolean) => { setFormDirty(dirty); setFormBusy(busy) }, [])
  useEffect(() => { onEditingChange?.(dirty || formDirty, busy || formBusy) }, [dirty, formDirty, busy, formBusy, onEditingChange])
  useEffect(() => { if (!dirty) return; const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn) }, [dirty])
  const clear = useCallback(() => { current.current = null; setFile(null); setDirty(false); setError('') }, [])
  useEffect(() => {
    if (!takeOpenFile) return
    void takeOpenFile().then(text => { if (text) { const next = AccessFileSchema.parse(JSON.parse(text)); current.current = next; setFile(next); setDirty(false) } }).catch(error => setError(message(error)))
  }, [takeOpenFile, initialVaultId])
  const wrapped = useMemo<SharingClient>(() => {
    async function access() {
      const opened = current.current
      if (!opened || !client.fileAccess) throw new Error('Open an access-controlled Everkeep file first.')
      const result = await client.fileAccess(opened.vaultId, opened.packageId)
      if (opened !== current.current) throw new Error('The open file changed.')
      if (result.owner.id !== opened.owner.id) throw new Error('File ownership does not match the service.')
      return { opened, result }
    }
    return {
      ...client,
      logout: async () => { if (current.current && !window.confirm('Close this file and sign out? Save an updated file first if you made changes.')) throw new Error('Sign-out cancelled.'); await client.logout(); clear() },
      get: async id => {
        if (current.current?.vaultId !== id) return client.get(id)
        const { opened, result } = await access()
        const records = []
        for (const record of opened.records) if (result.keys[record.id]) records.push((await openRecord(opened, record.id, result)).record)
        if (opened !== current.current) throw new Error('The open file changed.')
        return { id, name: opened.name, records, role: result.role, scope: result.scope, revision: 1, updatedAt: '', storage: 'file' } satisfies SharedVaultView
      },
      edit: async (id, recordId, input) => {
        if (current.current?.vaultId !== id) return client.edit(id, recordId, input)
        const { opened, result } = await access()
        if (result.role === 'viewer') throw new Error('You have view-only access.')
        const { record, attachments } = await openRecord(opened, recordId, result)
        if (record.version !== input.baseVersion) throw new Error('This record changed. Reopen it before saving.')
        for (const [name, value] of Object.entries(input.values)) {
          const field = record.fields[name]
          if (!field?.editable || typeof value !== 'string' || value.length > (field.maxLength || 20000) || (field.required && !value.trim()) || (field.options && !field.options.some(option => option.value === value))) throw new Error('An edited field is invalid.')
          field.value = value
        }
        record.updatedBy = result.actor?.email
        record.version++; record.updatedAt = new Date().toISOString()
        const sealed = await sealRecord(opened, record, attachments, result.keys[recordId])
        // Recheck authorization before committing to this local session.
        const latest = await access()
        if (latest.result.role === 'viewer' || !latest.result.keys[recordId] || opened !== current.current) throw new Error('Your access or open file changed.')
        const next = { ...opened, records: opened.records.map(item => item.id === recordId ? sealed : item) }
        current.current = next; setDirty(true)
        return record
      },
      attachment: async (id, recordId, attachmentId) => {
        if (current.current?.vaultId !== id) return client.attachment(id, recordId, attachmentId)
        const { opened, result } = await access(), value = await openRecord(opened, recordId, result)
        const attachment = value.record.attachments.find(item => item.id === attachmentId)
        if (!attachment || !value.attachments[attachmentId]) throw new Error('Attachment unavailable.')
        const bytes = fromBase64(value.attachments[attachmentId])
        const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('')
        if (digest !== attachment.checksum) throw new Error('The attachment failed its integrity check.')
        if (opened !== current.current) throw new Error('The open file changed.')
        download(bytes, attachment.name)
      }
    }
  }, [client, clear])
  return <>
    <section className="ek-sharing" style={{ paddingBottom: 0 }}><div className="ek-card"><h2>Open an Everkeep file</h2><p>Download the shared file from its owner, then choose it here. Its contents stay on this device. Sign in and accept your invitation to unlock the information you can access.</p>
      <label><span>Choose an access-controlled .everkeep file</span><input type="file" accept=".everkeep" disabled={busy || formBusy || formDirty} onChange={async event => {
        const selected = event.target.files?.[0]; event.target.value = ''; if (!selected) return
        if (dirty && !window.confirm('Discard unsaved file changes?')) return
        setBusy(true); setError('')
        try {
          if (selected.size > MAX_ACCESS_FILE_BYTES) throw new Error('Shared files are limited to 200 MB.')
          const raw = await selected.text()
          let value: unknown
          try { value = JSON.parse(raw) } catch { throw new Error('This is an original local vault. Ask its owner to save an access-controlled file from Review & share.') }
          if ((value as { format?: string })?.format !== 'everkeep-access') throw new Error('This file uses local password protection. Its owner must save an access-controlled copy for email-based permissions.')
          const next = AccessFileSchema.parse(value); current.current = next; setFile(next); setDirty(false)
        } catch (error) { setError(message(error)) } finally { setBusy(false) }
      }} /></label>
      {file && <><p>File: {file.name}. Ownership will be checked with Everkeep. No automatic synchronization.</p><button disabled={busy || formDirty || formBusy} onClick={() => { if (dirty && !window.confirm('Discard unsaved file changes?')) return; clear() }}>Close file</button> <button disabled={!dirty || busy || formDirty || formBusy} onClick={() => { if (!current.current) return; download(JSON.stringify(current.current), `${current.current.name.replace(/[^a-zA-Z0-9 -]/g, '_')} updated.everkeep`); setDirty(false) }}>Save updated Everkeep file</button>{dirty && <p role="status">Your edits are in this session. Save an updated file to keep them. They have not been sent to the owner.</p>}</>}
      {error && <p className="ek-error" role="alert">{error}</p>}
    </div></section>
    <SharedVaultApp key={file?.packageId || 'hosted'} client={wrapped} initialVaultId={file?.vaultId || initialVaultId} desktop={desktop} onEditingChange={changed} />
  </>
}

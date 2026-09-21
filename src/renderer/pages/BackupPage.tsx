import type { FamilyHandoff } from '@shared/types/handoff'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { SectionPage } from '@renderer/components/layout/SectionPage'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'
export function BackupPage() {
  const vaultId = useVaultStore(s => s.session?.metadata.id)
  const plan = useQuery({ queryKey: ['handoff', vaultId], queryFn: () => unwrap(getEverkeepApi().vault.getHandoff()) })
  if (!plan.data) return <SectionPage title="Saved copies & recovery" description="Recovery copies and instructions for a separately saved file."><p role="status">{plan.isError ? 'Unable to load access instructions.' : 'Loading…'}</p>{plan.isError && <Button onClick={() => void plan.refetch()}>Try again</Button>}</SectionPage>
  return <BackupEditor key={vaultId} initial={plan.data} />
}
function BackupEditor({ initial }: { initial: FamilyHandoff }) {
  const session = useVaultStore((s) => s.session)
  const client = useQueryClient()
  const plan = useQuery({ queryKey: ['handoff', session?.metadata.id], queryFn: () => unwrap(getEverkeepApi().vault.getHandoff()) })
  const [access, setAccess] = useState({ vaultLocation: initial.vaultLocation, backupLocation: initial.backupLocation, passwordInstructions: initial.passwordInstructions, sharedWith: initial.sharedWith, handoffTestedAt: initial.handoffTestedAt })
  const [savedAccess, setSavedAccess] = useState(access)
  const dirty = JSON.stringify(access) !== JSON.stringify(savedAccess)
  const setSaveStatus = useVaultStore(s => s.setSaveStatus)
  function changeAccess(key: keyof typeof access, value: string) { setAccess(previous => ({ ...previous, [key]: value, ...(key !== 'handoffTestedAt' ? { handoffTestedAt: '' } : {}) })) }
  function accessArea(key: 'vaultLocation' | 'backupLocation' | 'passwordInstructions', label: string, hint: string) {
    return <label className="block text-sm">{label}<span className="my-1 block text-warm-500">{hint}</span><textarea rows={3} className="w-full rounded-md border border-warm-300 bg-white p-3" value={access[key]} onChange={event => changeAccess(key, event.target.value)} /></label>
  }
  const [path, setPath] = useState(''), [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('')
  async function run(action: () => Promise<void>) { setBusy(true); setError(''); setMessage(''); try { await action(); await client.invalidateQueries({ queryKey: ['handoff'] }) } catch (e) { setError(e instanceof Error ? e.message : 'Unable to complete this step.') } finally { setBusy(false); setPassword('') } }
  return <SectionPage title="Saved copies & recovery" description="Your original vault is already saved on this computer. Keep a recovery copy or practice opening a separately saved file." journeyBlocked={dirty || busy}>
    <div className="space-y-5">
      <section className="rounded-xl border border-warm-200 bg-ivory-50 p-5"><h2 className="font-display text-xl">1. Create a separate backup</h2><p className="my-3 text-sm text-warm-500">Include the vault and all attached files. Password-protected vaults produce protected backups. Keep older copies secure; enabling protection does not change backups or reports you already made.</p><Button disabled={busy} onClick={() => void run(async () => { const destinationPath = await unwrap(getEverkeepApi().vault.pickBackupPath(`${session?.metadata.name ?? 'Vault'}-backup`)); if (!destinationPath) return; const result = await unwrap(getEverkeepApi().vault.backup({ destinationPath })); setPath(result.backupPath); setMessage(`Backup saved: ${result.backupPath}`) })}>Create backup</Button>{plan.data?.lastBackupAt && <p className="mt-3 text-xs text-warm-500">Last created {new Date(plan.data.lastBackupAt).toLocaleString()}</p>}</section>
      <section className="space-y-3 rounded-xl border border-warm-200 bg-ivory-50 p-5"><h2 className="font-display text-xl">2. Test that the backup opens</h2><p className="text-sm text-warm-500">Check that the backup opens and its attached files are intact. Your current vault is not replaced.</p><Button variant="secondary" disabled={busy} onClick={() => void run(async () => { const selected = await unwrap(getEverkeepApi().vault.pickRestorePath()); if (selected) setPath(selected) })}>Choose backup to test</Button>{path && <p className="break-all text-xs text-warm-500">{path}</p>}<label className="block text-sm">Backup password (if protected)<Input type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 max-w-sm" /></label><Button disabled={busy || !path} onClick={() => void run(async () => { const result = await unwrap(getEverkeepApi().vault.verifyBackup({ backupPath: path, password: password || undefined })); setMessage(`${result.vaultName}: database and ${result.attachmentCount} attachment(s) verified.${result.matchesCurrentVault ? '' : ' This backup belongs to a different vault; your current plan was not marked verified.'}`) })}>{busy ? 'Working…' : 'Test backup'}</Button>{plan.data?.lastBackupVerifiedAt && <p className="text-xs text-warm-500">Last verified {new Date(plan.data.lastBackupVerifiedAt).toLocaleString()} · {plan.data.verifiedBackupPath}</p>}</section>
      <section className="space-y-4 rounded-xl border border-warm-200 p-5">
        <h2 className="font-display text-xl">3. Access to a saved file</h2>
        {accessArea('vaultLocation', 'Where to find the vault', 'Include the computer or storage location and explain that Everkeep opens the file.')}
        {accessArea('backupLocation', 'Where to find a separate backup', 'Keep a copy on another device or storage location in case this computer is lost.')}
        {accessArea('passwordInstructions', 'How an authorized person can obtain access', 'Describe a separate password handoff. Keep an accessible copy of these instructions outside a locked vault.')}
        <label className="block text-sm">Who has received these access instructions?<Input className="mt-1" value={access.sharedWith} onChange={event => changeAccess('sharedWith', event.target.value)} /></label>
        <h3 className="font-medium">Practice opening the full vault together</h3>
        <p className="text-sm text-warm-500">Ask your trusted person to find the backup, obtain access through your separate instructions, and open a restored copy in Everkeep. Online sharing permissions apply to the shared link. Someone with a separate file and its password has an independent copy.</p>
        <Link className="text-sm text-forest-700 underline" to="/restore">Restore a backup into a new vault</Link>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={Boolean(access.handoffTestedAt)} onChange={event => changeAccess('handoffTestedAt', event.target.checked ? new Date().toISOString() : '')} /><span>We practiced: this person found and opened the full vault without my help.{access.handoffTestedAt && <span className="block text-xs text-warm-500">Confirmed {new Date(access.handoffTestedAt).toLocaleDateString()}</span>}</span></label>
        <p className="text-xs text-warm-500">Changing these access instructions clears the practice confirmation so you can check them again.</p>
        <div className="flex gap-3"><Button disabled={busy || !dirty} onClick={() => void run(async () => {
          setSaveStatus('saving')
          try {
            const current = await unwrap(getEverkeepApi().vault.getHandoff())
            await unwrap(getEverkeepApi().vault.updateHandoff({ ...current, ...access }))
            setSavedAccess(access); setSaveStatus('saved'); setMessage('Access instructions saved.')
          } catch (error) { setSaveStatus('error'); throw error }
        })}>Save access instructions</Button>{dirty && <Button variant="ghost" disabled={busy} onClick={() => setAccess(savedAccess)}>Cancel changes</Button>}</div>
      </section>
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}{message && <p role="status" className="break-words text-sm text-forest-700">{message}</p>}
    </div>
  </SectionPage>
}

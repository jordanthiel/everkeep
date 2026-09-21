import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { SectionPage } from '@renderer/components/layout/SectionPage'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'
export function BackupPage() {
  const session = useVaultStore((s) => s.session)
  const client = useQueryClient()
  const plan = useQuery({ queryKey: ['handoff', session?.metadata.id], queryFn: () => unwrap(getEverkeepApi().vault.getHandoff()) })
  const [path, setPath] = useState(''), [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('')
  async function run(action: () => Promise<void>) { setBusy(true); setError(''); setMessage(''); try { await action(); await client.invalidateQueries({ queryKey: ['handoff'] }) } catch (e) { setError(e instanceof Error ? e.message : 'Unable to complete this step.') } finally { setBusy(false); setPassword('') } }
  return <SectionPage title="Backup & access check" description="Make sure the plan survives a lost computer and that someone else can use it.">
    <div className="space-y-5">
      <section className="rounded-xl border border-warm-200 bg-ivory-50 p-5"><h2 className="font-display text-xl">1. Create a separate backup</h2><p className="my-3 text-sm text-warm-500">Include the vault and all attached files. Password-protected vaults produce protected backups. Keep older copies secure; enabling protection does not change backups or reports you already made.</p><Button disabled={busy} onClick={() => void run(async () => { const destinationPath = await unwrap(getEverkeepApi().vault.pickBackupPath(`${session?.metadata.name ?? 'Vault'}-backup`)); if (!destinationPath) return; const result = await unwrap(getEverkeepApi().vault.backup({ destinationPath })); setPath(result.backupPath); setMessage(`Backup saved: ${result.backupPath}`) })}>Create backup</Button>{plan.data?.lastBackupAt && <p className="mt-3 text-xs text-warm-500">Last created {new Date(plan.data.lastBackupAt).toLocaleString()}</p>}</section>
      <section className="space-y-3 rounded-xl border border-warm-200 bg-ivory-50 p-5"><h2 className="font-display text-xl">2. Test that the backup opens</h2><p className="text-sm text-warm-500">Check that the backup opens and its attached files are intact. Your current vault is not replaced.</p><Button variant="secondary" disabled={busy} onClick={() => void run(async () => { const selected = await unwrap(getEverkeepApi().vault.pickRestorePath()); if (selected) setPath(selected) })}>Choose backup to test</Button>{path && <p className="break-all text-xs text-warm-500">{path}</p>}<label className="block text-sm">Backup password (if protected)<Input type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 max-w-sm" /></label><Button disabled={busy || !path} onClick={() => void run(async () => { const result = await unwrap(getEverkeepApi().vault.verifyBackup({ backupPath: path, password: password || undefined })); setMessage(`${result.vaultName}: database and ${result.attachmentCount} attachment(s) verified.${result.matchesCurrentVault ? '' : ' This backup belongs to a different vault; your current plan was not marked verified.'}`) })}>{busy ? 'Working…' : 'Test backup'}</Button>{plan.data?.lastBackupVerifiedAt && <p className="text-xs text-warm-500">Last verified {new Date(plan.data.lastBackupVerifiedAt).toLocaleString()} · {plan.data.verifiedBackupPath}</p>}</section>
      <section className="rounded-xl border border-warm-200 p-5"><h2 className="font-display text-xl">3. Practice with your trusted person</h2><p className="my-3 text-sm text-warm-500">Ask them to find the backup, obtain the password through your separate instructions, and open a restored copy on another computer. A successful file check is not a substitute for this practice.</p><Link className="text-sm text-forest-700 underline" to="/start-here">Record the family handoff</Link><span className="mx-3 text-warm-300">·</span><Link className="text-sm text-forest-700 underline" to="/restore">Restore a backup into a new vault</Link></section>
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}{message && <p role="status" className="break-words text-sm text-forest-700">{message}</p>}
    </div>
  </SectionPage>
}

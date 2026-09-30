import { OwnerVerification } from '@renderer/components/OwnerVerification'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { getEverkeepApi, unwrap, ApiError } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'
export function RestoreVaultPage() {
  const [search] = useSearchParams()
  const [needsEmail, setNeedsEmail] = useState(false)
  const [backupPath, setBackupPath] = useState(search.get('backup') ?? ''), [password, setPassword] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const setSession = useVaultStore((s) => s.setSession)
  const navigate = useNavigate(), client = useQueryClient()
  async function run(action: () => Promise<void>) { setError(''); setBusy(true); try { await action() } catch (e) { if (e instanceof ApiError && e.code === 'EMAIL_REQUIRED') setNeedsEmail(true); setError(e instanceof Error ? e.message : 'Restore failed.') } finally { setBusy(false) } }
  return <main className="mx-auto max-w-xl space-y-5 px-6 py-16"><Link className="text-sm text-forest-700 underline" to="/">Back</Link><h1 className="font-display text-3xl">Restore an Everkeep backup</h1><p className="text-warm-500">Restore into a new file. Existing vaults will not be overwritten. Email-protected backups require the verified owner and internet access. Older password-protected backups require their original password.</p><Button variant="secondary" disabled={busy} onClick={() => void run(async () => { const selected = await unwrap(getEverkeepApi().vault.pickRestorePath()); if (selected) setBackupPath(selected) })}>Choose backup</Button>{backupPath && <p className="break-all text-sm">{backupPath}</p>}<label className="block text-sm">Password (older password-protected backups only)<Input className="mt-2" type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} /></label><Button disabled={busy || !backupPath} onClick={() => void run(async () => { const destinationPath = await unwrap(getEverkeepApi().vault.pickSavePath('Restored vault')); if (!destinationPath) return; const session = await unwrap(getEverkeepApi().vault.restoreBackup({ backupPath, destinationPath, password: password || undefined })); client.clear(); setSession(session); setPassword(''); navigate('/start-here') })}>{busy ? 'Restoring…' : 'Choose a new location and restore'}</Button>{needsEmail && <OwnerVerification busy={busy} onContinue={() => { setNeedsEmail(false); setError('Signed in. Choose a new location and restore to verify access.') }} />}{error && <p role="alert" className="text-sm text-red-800">{error}</p>}</main>
}

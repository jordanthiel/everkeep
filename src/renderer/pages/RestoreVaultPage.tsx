import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'
export function RestoreVaultPage() {
  const [search] = useSearchParams()
  const [backupPath, setBackupPath] = useState(search.get('backup') ?? ''), [password, setPassword] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const setSession = useVaultStore((s) => s.setSession)
  const navigate = useNavigate(), client = useQueryClient()
  async function run(action: () => Promise<void>) { setError(''); setBusy(true); try { await action() } catch (e) { setError(e instanceof Error ? e.message : 'Restore failed.') } finally { setBusy(false) } }
  return <main className="mx-auto max-w-xl space-y-5 px-6 py-16"><Link className="text-sm text-forest-700 underline" to="/">Back</Link><h1 className="font-display text-3xl">Restore an Everkeep backup</h1><p className="text-warm-500">Restore into a new file. Existing vaults will not be overwritten. Use the password that protected this backup when it was created.</p><Button variant="secondary" disabled={busy} onClick={() => void run(async () => { const selected = await unwrap(getEverkeepApi().vault.pickRestorePath()); if (selected) setBackupPath(selected) })}>Choose backup</Button>{backupPath && <p className="break-all text-sm">{backupPath}</p>}<label className="block text-sm">Backup password (if protected)<Input className="mt-2" type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} /></label><Button disabled={busy || !backupPath} onClick={() => void run(async () => { const destinationPath = await unwrap(getEverkeepApi().vault.pickSavePath('Restored vault')); if (!destinationPath) return; const session = await unwrap(getEverkeepApi().vault.restoreBackup({ backupPath, destinationPath, password: password || undefined })); client.clear(); setSession(session); setPassword(''); navigate('/start-here') })}>{busy ? 'Restoring…' : 'Choose a new location and restore'}</Button>{error && <p role="alert" className="text-sm text-red-800">{error}</p>}</main>
}

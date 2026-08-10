import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { EverkeepMark } from '@renderer/components/brand/EverkeepMark'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { Label } from '@renderer/components/ui/Label'
import { getEverkeepApi, unwrap, ApiError } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'

export function UnlockPage() {
  const navigate = useNavigate()
  const session = useVaultStore((s) => s.session)
  const setSession = useVaultStore((s) => s.setSession)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function unlock() {
    setBusy(true)
    setError(null)
    try {
      const unlocked = await unwrap(getEverkeepApi().vault.unlock(password))
      setSession(unlocked)
      setPassword('')
      navigate('/')
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PASSWORD_INCORRECT') {
        setError('Incorrect password.')
      } else {
        setError(err instanceof Error ? err.message : 'Unable to unlock vault.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function closeVault() {
    await unwrap(getEverkeepApi().vault.close())
    setSession(null)
    navigate('/welcome')
  }

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <EverkeepMark className="mb-8 justify-center" />
        <div className="rounded-2xl border border-warm-200 bg-ivory-50/90 p-6 shadow-soft">
          <div className="mb-4 flex items-center gap-2 text-forest-700">
            <Lock className="h-4 w-4" />
            <h1 className="font-display text-2xl text-charcoal-900">Vault locked</h1>
          </div>
          <p className="text-sm text-warm-500">
            {session?.metadata.name ?? 'This vault'} is password protected. Enter the password to
            continue. Everkeep never sends it anywhere.
          </p>
          <div className="mt-6">
            <Label htmlFor="unlockPassword">Password</Label>
            <Input
              id="unlockPassword"
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void unlock()
              }}
            />
          </div>
          {error && <p className="mt-3 text-sm text-red-800">{error}</p>}
          <div className="mt-6 flex gap-3">
            <Button className="flex-1" disabled={busy || !password} onClick={() => void unlock()}>
              {busy ? 'Unlocking…' : 'Unlock'}
            </Button>
            <Button variant="ghost" onClick={() => void closeVault()}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

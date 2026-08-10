import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Folder, Shield } from 'lucide-react'
import { EverkeepMark } from '@renderer/components/brand/EverkeepMark'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { Label } from '@renderer/components/ui/Label'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'
import { cn } from '@renderer/lib/utils'

type Step = 1 | 2 | 3

export function CreateVaultPage() {
  const navigate = useNavigate()
  const setSession = useVaultStore((s) => s.setSession)

  const [step, setStep] = useState<Step>(1)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [owner, setOwner] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    preferredName: '',
    dateOfBirth: '',
    spousePartner: '',
    householdName: ''
  })

  const [protectWithPassword, setProtectWithPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [filePath, setFilePath] = useState<string | null>(null)

  const suggestedName = useMemo(() => {
    if (owner.householdName.trim()) return owner.householdName.trim()
    const parts = [owner.lastName, 'Family'].filter(Boolean)
    return parts.join('-') || 'My Family'
  }, [owner.householdName, owner.lastName])

  function validateStep1(): boolean {
    if (!owner.firstName.trim() || !owner.lastName.trim()) {
      setError('First name and last name are required.')
      return false
    }
    setError(null)
    return true
  }

  function validateStep2(): boolean {
    if (!protectWithPassword) {
      setError(null)
      return true
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return false
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return false
    }
    setError(null)
    return true
  }

  async function pickLocation() {
    setError(null)
    try {
      const path = await unwrap(getEverkeepApi().vault.pickSavePath(suggestedName))
      if (path) setFilePath(path)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to choose location.')
    }
  }

  async function createVault() {
    if (!filePath) {
      setError('Choose where to save your Everkeep Vault.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const session = await unwrap(
        getEverkeepApi().vault.create({
          name: suggestedName,
          filePath,
          householdName: owner.householdName || suggestedName,
          ownerFirstName: owner.firstName,
          ownerMiddleName: owner.middleName || undefined,
          ownerLastName: owner.lastName,
          ownerPreferredName: owner.preferredName || undefined,
          ownerDateOfBirth: owner.dateOfBirth || undefined,
          spousePartnerName: owner.spousePartner || undefined,
          password: protectWithPassword ? password : undefined
        })
      )
      setSession(session)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create vault.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl">
        <button
          type="button"
          onClick={() => (step === 1 ? navigate('/welcome') : setStep((s) => (s - 1) as Step))}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-warm-500 hover:text-charcoal-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <EverkeepMark className="mb-6" />

        <div className="mb-8 flex gap-2">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={cn(
                'h-1.5 flex-1 rounded-full',
                n <= step ? 'bg-forest-600' : 'bg-warm-200'
              )}
            />
          ))}
        </div>

        {step === 1 && (
          <div>
            <h1 className="font-display text-3xl font-medium text-charcoal-900">About you</h1>
            <p className="mt-2 text-warm-500">
              This helps label your vault and seed your household information.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={owner.firstName}
                  onChange={(e) => setOwner((o) => ({ ...o, firstName: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="middleName">Middle name</Label>
                <Input
                  id="middleName"
                  value={owner.middleName}
                  onChange={(e) => setOwner((o) => ({ ...o, middleName: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={owner.lastName}
                  onChange={(e) => setOwner((o) => ({ ...o, lastName: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="preferredName">Preferred name</Label>
                <Input
                  id="preferredName"
                  value={owner.preferredName}
                  onChange={(e) => setOwner((o) => ({ ...o, preferredName: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="dob">Date of birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={owner.dateOfBirth}
                  onChange={(e) => setOwner((o) => ({ ...o, dateOfBirth: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="spouse">Spouse / partner</Label>
                <Input
                  id="spouse"
                  value={owner.spousePartner}
                  onChange={(e) => setOwner((o) => ({ ...o, spousePartner: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="household">Household name</Label>
                <Input
                  id="household"
                  placeholder="e.g. Thiel Family"
                  value={owner.householdName}
                  onChange={(e) => setOwner((o) => ({ ...o, householdName: e.target.value }))}
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <Button
                onClick={() => {
                  if (validateStep1()) setStep(2)
                }}
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="font-display text-3xl font-medium text-charcoal-900">
              Would you like to protect this Everkeep Vault with a password?
            </h1>
            <p className="mt-3 text-warm-500">
              The password is never sent anywhere. If you forget it, Everkeep cannot recover it.
            </p>

            <div className="mt-8 grid gap-3">
              <button
                type="button"
                onClick={() => setProtectWithPassword(true)}
                className={cn(
                  'rounded-xl border px-5 py-4 text-left transition',
                  protectWithPassword
                    ? 'border-forest-600 bg-forest-700/5'
                    : 'border-warm-200 bg-ivory-50 hover:border-warm-300'
                )}
              >
                <div className="flex items-center gap-2 font-medium text-charcoal-900">
                  <Shield className="h-4 w-4 text-forest-600" />
                  Protect with Password
                </div>
                <p className="mt-1 text-sm text-warm-500">
                  Recommended for vaults that include sensitive identifiers and financial details.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setProtectWithPassword(false)
                  setPassword('')
                  setConfirmPassword('')
                }}
                className={cn(
                  'rounded-xl border px-5 py-4 text-left transition',
                  !protectWithPassword
                    ? 'border-forest-600 bg-forest-700/5'
                    : 'border-warm-200 bg-ivory-50 hover:border-warm-300'
                )}
              >
                <div className="font-medium text-charcoal-900">Continue Without Password</div>
                <p className="mt-1 text-sm text-warm-500">
                  Anyone with access to this file on your computer can open it.
                </p>
              </button>
            </div>

            {protectWithPassword && (
              <div className="mt-6 grid gap-4">
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="confirm">Confirm password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <p className="text-xs text-warm-400">
                  Full encryption of sensitive fields arrives in the next milestone. Your preference
                  is saved with the vault now.
                </p>
              </div>
            )}

            <div className="mt-8 flex justify-end">
              <Button
                onClick={() => {
                  if (validateStep2()) setStep(3)
                }}
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="font-display text-3xl font-medium text-charcoal-900">
              Where should we save your vault?
            </h1>
            <p className="mt-2 text-warm-500">
              Your Everkeep Vault is a single file on your computer. Suggested default:
              Documents/Everkeep/
            </p>

            <div className="mt-8 rounded-xl border border-warm-200 bg-ivory-50 p-5">
              <p className="text-sm font-medium text-charcoal-800">Vault file</p>
              <p className="mt-1 break-all text-sm text-warm-500">
                {filePath ?? 'No location selected yet'}
              </p>
              <Button className="mt-4" variant="secondary" onClick={() => void pickLocation()}>
                <Folder className="h-4 w-4" />
                Choose location
              </Button>
            </div>

            <div className="mt-8 flex justify-end">
              <Button disabled={busy || !filePath} onClick={() => void createVault()}>
                {busy ? 'Creating…' : 'Create Vault'}
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

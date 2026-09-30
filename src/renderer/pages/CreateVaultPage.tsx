import type { SharingAccount as Account } from '@shared/sharing'
import { SharingAccount } from '../../sharing/SharingAccount'
import '../../sharing/sharing.css'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Folder } from 'lucide-react'
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
    lastName: '',
    preferredName: '',
    spousePartner: '',
    householdName: ''
  })

  const [account, setAccount] = useState<Account | null>(null)
  const [selectedFilePath, setFilePath] = useState<string | null>(null)
  const [defaultDirectory, setDefaultDirectory] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void unwrap(getEverkeepApi().vault.getDefaultVaultDir())
      .then((directory) => { if (active) setDefaultDirectory(directory) })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load the default location. Choose a location to continue.')
      })
    return () => { active = false }
  }, [])

  const suggestedName = useMemo(() => {
    if (owner.householdName.trim()) return owner.householdName.trim()
    const parts = [owner.lastName, 'Family'].filter(Boolean)
    return parts.join('-') || 'My Family'
  }, [owner.householdName, owner.lastName])

  const safeFileName = Array.from(suggestedName, (character) =>
    character.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(character) ? '-' : character
  ).join('').replace(/[. ]+$/, '') || 'My Family'
  const separator = defaultDirectory?.includes('\\') ? '\\' : '/'
  const filePath = selectedFilePath ?? (defaultDirectory ? `${defaultDirectory}${separator}${safeFileName}.everkeep` : null)

  function validateStep1(): boolean {
    if (!owner.firstName.trim() || !owner.lastName.trim()) {
      setError('First name and last name are required.')
      return false
    }
    setError(null)
    return true
  }

  async function pickLocation() {
    setError(null)
    try {
      const path = await unwrap(getEverkeepApi().vault.pickSavePath(safeFileName))
      if (path) setFilePath(path)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to choose location.')
    }
  }

  async function createVault() {
    if (!account) {
      setError('Verify your email before creating a vault.')
      setStep(2)
      return
    }
    if (!filePath) {
      setError('Choose where to save your Everkeep Vault.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const session = await unwrap(
        getEverkeepApi().vault.create({
          ownerEmail: account.email,
          name: suggestedName,
          filePath,
          householdName: owner.householdName || suggestedName,
          ownerFirstName: owner.firstName,
          ownerLastName: owner.lastName,
          ownerPreferredName: owner.preferredName || undefined,
          spousePartnerName: owner.spousePartner || undefined
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
          disabled={busy}
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
              This starts your household in Contacts. Use the name you go by — legal names and IDs
              like a passport go in Identity after the vault is created, so you won’t type them twice.
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
                  placeholder="Optional — what family should call you here"
                />
              </div>
              <div>
                <Label htmlFor="spouse">Spouse / partner</Label>
                <Input
                  id="spouse"
                  value={owner.spousePartner}
                  onChange={(e) => setOwner((o) => ({ ...o, spousePartner: e.target.value }))}
                  placeholder="Optional — we’ll add them to Contacts too"
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
                <p className="mt-1 text-xs text-warm-400">
                  Labels the vault file and home screen. It is not a legal name.
                </p>
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
            <h1 className="font-display text-3xl font-medium text-charcoal-900">Secure your vault with your email</h1>
            <p className="mt-3 text-warm-500">Your original vault is encrypted and can only be unlocked by your verified account. Your records stay in the file on your computer. Internet access is required each time you open or unlock it.</p>
            <div className="ek-sharing mt-6" style={{ padding: 0 }}>
              <SharingAccount client={getEverkeepApi().sharing} onChange={setAccount} ownerVault />
            </div>
            <p className="mt-3 text-sm text-warm-500">Keep access to this email account. You can invite other people to separate shared copies after creating your vault.</p>
            <div className="mt-8 flex justify-end">
              <Button disabled={!account} onClick={() => { setError(null); setStep(3) }}>Continue<ArrowRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="font-display text-3xl font-medium text-charcoal-900">
              Where should we save your vault?
            </h1>
            <p className="mt-2 text-warm-500">
              Your Everkeep Vault is a single file on your computer. We’ll save it in
              Documents/Everkeep unless you choose another location.
            </p>

            <div className="mt-8 rounded-xl border border-warm-200 bg-ivory-50 p-5">
              <p className="mb-3 text-sm text-forest-700">Owner: {account?.email}</p>
              <p className="text-sm font-medium text-charcoal-800">Vault file</p>
              <p className="mt-1 break-all text-sm text-warm-500">
                {filePath ?? 'Choose a location to continue.'}
              </p>
              <Button className="mt-4" variant="secondary" disabled={busy} onClick={() => void pickLocation()}>
                <Folder className="h-4 w-4" />
                Change location
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

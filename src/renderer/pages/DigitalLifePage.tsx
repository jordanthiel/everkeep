import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { SectionPage } from '@renderer/components/layout/SectionPage'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { Label } from '@renderer/components/ui/Label'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'

const PASSWORD_MANAGERS = [
  '1Password',
  'Bitwarden',
  'Apple Passwords',
  'Google Password Manager',
  'LastPass',
  'Dashlane',
  'Other'
]

export function DigitalLifePage() {
  const queryClient = useQueryClient()
  const setSaveStatus = useVaultStore((s) => s.setSaveStatus)
  const [provider, setProvider] = useState('1Password')
  const [accountEmail, setAccountEmail] = useState('')
  const [instructions, setInstructions] = useState('')
  const [recoveryKitLocation, setRecoveryKitLocation] = useState('')

  const digitalQuery = useQuery({
    queryKey: ['digital'],
    queryFn: () => unwrap(getEverkeepApi().digital.list())
  })

  const createMutation = useMutation({
    mutationFn: () =>
      unwrap(
        getEverkeepApi().digital.create({
          category: 'password_manager',
          provider,
          accountIdentifier: accountEmail.trim() || null,
          instructions: [
            instructions.trim(),
            recoveryKitLocation.trim()
              ? `Recovery kit location: ${recoveryKitLocation.trim()}`
              : ''
          ]
            .filter(Boolean)
            .join('\n\n') || null,
          notes:
            'Do not store every individual password here. Document emergency access to the password manager.'
        })
      ),
    onMutate: () => setSaveStatus('saving'),
    onSuccess: async () => {
      setAccountEmail('')
      setInstructions('')
      setRecoveryKitLocation('')
      setSaveStatus('saved')
      await queryClient.invalidateQueries({ queryKey: ['digital'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      window.setTimeout(() => setSaveStatus('idle'), 1500)
    },
    onError: () => setSaveStatus('error')
  })

  const passwordManagers = (digitalQuery.data ?? []).filter(
    (item) => item.category === 'password_manager'
  )

  return (
    <SectionPage
      title="Digital Life"
      description="Help an authorized person reach your digital world — especially your password manager — without collecting every password."
      badge="High impact"
    >
      <div className="mb-6 rounded-xl border border-brass-400/30 bg-brass-400/5 px-5 py-4 text-sm text-charcoal-800">
        Strong recommendation: do not type every individual password into Everkeep. Document how
        someone with authority could access your password manager, emergency kit, or legacy contact
        settings.
      </div>

      <div className="mb-6 grid gap-4 rounded-xl border border-warm-200 bg-ivory-50/80 p-5 md:grid-cols-2">
        <div>
          <Label htmlFor="provider">Password manager</Label>
          <select
            id="provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="flex h-10 w-full rounded-md border border-warm-300 bg-ivory-50 px-3 text-sm"
          >
            {PASSWORD_MANAGERS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="email">Account email</Label>
          <Input
            id="email"
            value={accountEmail}
            onChange={(e) => setAccountEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="recovery">Recovery kit / emergency access location</Label>
          <Input
            id="recovery"
            value={recoveryKitLocation}
            onChange={(e) => setRecoveryKitLocation(e.target.value)}
            placeholder="Home safe, sealed envelope…"
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="instructions">Emergency access instructions</Label>
          <textarea
            id="instructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-warm-300 bg-ivory-50 px-3 py-2 text-sm"
            placeholder="Who has emergency access? Where is the recovery kit? What should they do first?"
          />
        </div>
        <div className="md:col-span-2">
          <Button disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
            <Plus className="h-4 w-4" />
            Save password manager notes
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {passwordManagers.map((item) => (
          <article
            key={item.id}
            className="rounded-xl border border-warm-200 bg-ivory-50/80 px-5 py-4 shadow-soft"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-medium text-charcoal-900">{item.provider}</h3>
                <p className="mt-1 text-sm text-warm-500">
                  {item.accountIdentifier || 'No account email listed'}
                </p>
                {item.instructions && (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-charcoal-800">
                    {item.instructions}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  void unwrap(getEverkeepApi().digital.archive(item.id)).then(async () => {
                    await queryClient.invalidateQueries({ queryKey: ['digital'] })
                    await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
                  })
                }
              >
                Archive
              </Button>
            </div>
          </article>
        ))}

        {passwordManagers.length === 0 && (
          <div className="rounded-xl border border-dashed border-warm-300 px-6 py-12 text-center text-sm text-warm-500">
            No password manager notes yet. This is one of the highest-leverage items you can add.
          </div>
        )}
      </div>
    </SectionPage>
  )
}

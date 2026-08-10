import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { SectionPage } from '@renderer/components/layout/SectionPage'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { Label } from '@renderer/components/ui/Label'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'
import type { AccountType } from '@shared/types/account'

const ACCOUNT_TYPES: Array<{ value: AccountType; label: string }> = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'brokerage', label: 'Brokerage' },
  { value: 'ira', label: 'IRA' },
  { value: 'roth_ira', label: 'Roth IRA' },
  { value: '401k', label: '401(k)' },
  { value: '403b', label: '403(b)' },
  { value: 'hsa', label: 'HSA' },
  { value: '529', label: '529' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'other', label: 'Other' }
]

export function FinancialPage() {
  const queryClient = useQueryClient()
  const setSaveStatus = useVaultStore((s) => s.setSaveStatus)
  const [institution, setInstitution] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('checking')
  const [lastFour, setLastFour] = useState('')
  const [fullAccountNumber, setFullAccountNumber] = useState('')
  const [beneficiaryPersonId, setBeneficiaryPersonId] = useState('')
  const [beneficiaryPercent, setBeneficiaryPercent] = useState('100')
  const [error, setError] = useState<string | null>(null)

  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: () => unwrap(getEverkeepApi().accounts.list())
  })

  const peopleQuery = useQuery({
    queryKey: ['people'],
    queryFn: () => unwrap(getEverkeepApi().people.list())
  })

  const defaultBeneficiary = useMemo(
    () => peopleQuery.data?.[0]?.id ?? '',
    [peopleQuery.data]
  )
  const people = peopleQuery.data ?? []

  const createMutation = useMutation({
    mutationFn: () => {
      const beneficiaries =
        (beneficiaryPersonId || defaultBeneficiary) && Number(beneficiaryPercent) > 0
          ? [
              {
                personId: beneficiaryPersonId || defaultBeneficiary,
                designationType: 'primary' as const,
                percentage: Number(beneficiaryPercent),
                perStirpes: false
              }
            ]
          : []

      return unwrap(
        getEverkeepApi().accounts.create({
          institution: institution.trim(),
          accountName: accountName.trim() || null,
          accountType,
          lastFour: lastFour.trim() || null,
          fullAccountNumber: fullAccountNumber.trim() || null,
          beneficiaries
        })
      )
    },
    onMutate: () => {
      setError(null)
      setSaveStatus('saving')
    },
    onSuccess: async () => {
      setInstitution('')
      setAccountName('')
      setLastFour('')
      setFullAccountNumber('')
      setBeneficiaryPercent('100')
      setSaveStatus('saved')
      await queryClient.invalidateQueries({ queryKey: ['accounts'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      window.setTimeout(() => setSaveStatus('idle'), 1500)
    },
    onError: (err) => {
      setSaveStatus('error')
      setError(err instanceof Error ? err.message : 'Unable to save account.')
    }
  })

  return (
    <SectionPage
      title="Financial"
      description="Accounts your family would need to discover — institutions, ownership, and beneficiaries. Balances are optional."
      badge="Discovery first"
    >
      <div className="mb-6 grid gap-4 rounded-xl border border-warm-200 bg-ivory-50/80 p-5 md:grid-cols-2">
        <div>
          <Label htmlFor="institution">Institution</Label>
          <Input
            id="institution"
            placeholder="Fidelity, Chase…"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="accountName">Account name</Label>
          <Input
            id="accountName"
            placeholder="Roth IRA"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="accountType">Account type</Label>
          <select
            id="accountType"
            value={accountType}
            onChange={(e) => setAccountType(e.target.value as AccountType)}
            className="flex h-10 w-full rounded-md border border-warm-300 bg-ivory-50 px-3 text-sm"
          >
            {ACCOUNT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="lastFour">Last four digits</Label>
          <Input
            id="lastFour"
            maxLength={4}
            value={lastFour}
            onChange={(e) => setLastFour(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="fullNumber">Full account number (optional, encrypted if vault is protected)</Label>
          <Input
            id="fullNumber"
            value={fullAccountNumber}
            onChange={(e) => setFullAccountNumber(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div>
          <Label htmlFor="beneficiary">Primary beneficiary</Label>
          <select
            id="beneficiary"
            value={beneficiaryPersonId || defaultBeneficiary}
            onChange={(e) => setBeneficiaryPersonId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-warm-300 bg-ivory-50 px-3 text-sm"
          >
            <option value="">None yet</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.fullName}
              </option>
            ))}
          </select>
          {people.length === 0 && (
            <p className="mt-1 text-xs text-warm-400">Add people first to assign beneficiaries.</p>
          )}
        </div>
        <div>
          <Label htmlFor="percent">Beneficiary %</Label>
          <Input
            id="percent"
            type="number"
            min={0}
            max={100}
            value={beneficiaryPercent}
            onChange={(e) => setBeneficiaryPercent(e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <Button
            disabled={!institution.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            <Plus className="h-4 w-4" />
            Add account
          </Button>
          {error && <p className="mt-2 text-sm text-red-800">{error}</p>}
        </div>
      </div>

      <div className="space-y-3">
        {(accountsQuery.data ?? []).map((account) => {
          const primary = account.beneficiaries.filter((b) => b.designationType === 'primary')
          const primaryTotal = primary.reduce((sum, b) => sum + b.percentage, 0)
          return (
            <article
              key={account.id}
              className="rounded-xl border border-warm-200 bg-ivory-50/80 px-5 py-4 shadow-soft"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium text-charcoal-900">
                    {account.accountName || account.institution}
                  </h3>
                  <p className="mt-1 text-sm text-warm-500">
                    {ACCOUNT_TYPES.find((t) => t.value === account.accountType)?.label ??
                      account.accountType}
                    {' · '}
                    {account.institution}
                    {account.lastFour ? ` · •••• ${account.lastFour}` : ''}
                  </p>
                  <div className="mt-3 text-sm text-warm-500">
                    <p className="font-medium text-charcoal-800">Beneficiaries</p>
                    {primary.length === 0 ? (
                      <p className="mt-1">None listed</p>
                    ) : (
                      <ul className="mt-1 space-y-1">
                        {primary.map((b) => (
                          <li key={b.id}>
                            {b.personName ?? 'Person'} — {b.percentage}%
                          </li>
                        ))}
                      </ul>
                    )}
                    {primary.length > 0 && Math.abs(primaryTotal - 100) > 0.01 && (
                      <p className="mt-2 text-xs text-brass-500">
                        Primary percentages total {primaryTotal}% (should be 100%). This is a
                        checklist flag, not legal validation.
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void unwrap(getEverkeepApi().accounts.archive(account.id)).then(async () => {
                      await queryClient.invalidateQueries({ queryKey: ['accounts'] })
                      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
                    })
                  }
                >
                  Archive
                </Button>
              </div>
            </article>
          )
        })}

        {accountsQuery.data?.length === 0 && (
          <div className="rounded-xl border border-dashed border-warm-300 px-6 py-12 text-center text-sm text-warm-500">
            No accounts yet. Add a checking account or retirement account your family should know about.
          </div>
        )}
      </div>
    </SectionPage>
  )
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Save } from 'lucide-react'
import { SectionPage } from '@renderer/components/layout/SectionPage'
import { RecordActions } from '@renderer/components/records/RecordActions'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { Label } from '@renderer/components/ui/Label'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'
import type { Account, AccountType } from '@shared/types/account'

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

function emptyForm() {
  return {
    institution: '',
    accountName: '',
    accountType: 'checking' as AccountType,
    lastFour: '',
    fullAccountNumber: '',
    beneficiaryPersonId: '',
    beneficiaryPercent: '100'
  }
}

export function FinancialPage() {
  const queryClient = useQueryClient()
  const setSaveStatus = useVaultStore((s) => s.setSaveStatus)
  const formRef = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: () => unwrap(getEverkeepApi().accounts.list())
  })

  const peopleQuery = useQuery({
    queryKey: ['people'],
    queryFn: () => unwrap(getEverkeepApi().people.list())
  })

  const people = peopleQuery.data ?? []
  const defaultBeneficiary = people[0]?.id ?? ''

  function resetForm() {
    setForm(emptyForm())
    setEditingId(null)
    setError(null)
  }

  function startEdit(account: Account) {
    const primary = account.beneficiaries.find((item) => item.designationType === 'primary')
    setEditingId(account.id)
    setForm({
      institution: account.institution,
      accountName: account.accountName ?? '',
      accountType: account.accountType,
      lastFour: account.lastFour ?? '',
      fullAccountNumber: account.fullAccountNumber ?? '',
      beneficiaryPersonId: primary?.personId ?? '',
      beneficiaryPercent: String(primary?.percentage ?? 100)
    })
    setError(null)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const personId = form.beneficiaryPersonId || defaultBeneficiary
      const beneficiaries =
        personId && Number(form.beneficiaryPercent) > 0
          ? [
              {
                personId,
                designationType: 'primary' as const,
                percentage: Number(form.beneficiaryPercent),
                perStirpes: false
              }
            ]
          : []

      const payload = {
        institution: form.institution.trim(),
        accountName: form.accountName.trim() || null,
        accountType: form.accountType,
        lastFour: form.lastFour.trim() || null,
        fullAccountNumber: form.fullAccountNumber.trim() || null,
        beneficiaries
      }

      if (editingId) {
        return unwrap(
          getEverkeepApi().accounts.update({
            id: editingId,
            ...payload,
            lastReviewedAt: new Date().toISOString()
          })
        )
      }
      return unwrap(getEverkeepApi().accounts.create(payload))
    },
    onMutate: () => {
      setError(null)
      setSaveStatus('saving')
    },
    onSuccess: async () => {
      resetForm()
      setSaveStatus('saved')
      await queryClient.invalidateQueries({ queryKey: ['accounts'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['review'] })
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
      <div
        ref={formRef}
        className={`mb-6 grid gap-4 rounded-xl border bg-ivory-50/80 p-5 md:grid-cols-2 ${
          editingId ? 'border-forest-600/40 ring-1 ring-forest-600/20' : 'border-warm-200'
        }`}
      >
        <div className="md:col-span-2 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-charcoal-900">
              {editingId ? 'Edit account' : 'New account'}
            </p>
            <p className="mt-1 text-xs text-warm-400">
              Save stores this account. A blank record is then ready so you can keep going.
            </p>
          </div>
          {editingId && (
            <Button size="sm" variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
          )}
        </div>
        <div>
          <Label htmlFor="institution">Institution</Label>
          <Input
            id="institution"
            placeholder="Fidelity, Chase…"
            value={form.institution}
            onChange={(e) => setForm((current) => ({ ...current, institution: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="accountName">Account name</Label>
          <Input
            id="accountName"
            placeholder="Roth IRA"
            value={form.accountName}
            onChange={(e) => setForm((current) => ({ ...current, accountName: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="accountType">Account type</Label>
          <select
            id="accountType"
            value={form.accountType}
            onChange={(e) =>
              setForm((current) => ({ ...current, accountType: e.target.value as AccountType }))
            }
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
            value={form.lastFour}
            onChange={(e) =>
              setForm((current) => ({
                ...current,
                lastFour: e.target.value.replace(/\D/g, '').slice(0, 4)
              }))
            }
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="fullNumber">
            Full account number (optional, encrypted if vault is protected)
          </Label>
          <Input
            id="fullNumber"
            value={form.fullAccountNumber}
            onChange={(e) =>
              setForm((current) => ({ ...current, fullAccountNumber: e.target.value }))
            }
            autoComplete="off"
          />
        </div>
        <div>
          <Label htmlFor="beneficiary">Primary beneficiary</Label>
          <select
            id="beneficiary"
            value={form.beneficiaryPersonId || defaultBeneficiary}
            onChange={(e) =>
              setForm((current) => ({ ...current, beneficiaryPersonId: e.target.value }))
            }
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
            value={form.beneficiaryPercent}
            onChange={(e) =>
              setForm((current) => ({ ...current, beneficiaryPercent: e.target.value }))
            }
          />
        </div>
        <div className="md:col-span-2">
          <Button
            disabled={!form.institution.trim() || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? 'Saving…' : 'Save'}
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
                <RecordActions
                  onEdit={() => startEdit(account)}
                  onArchive={() =>
                    void unwrap(getEverkeepApi().accounts.archive(account.id)).then(async () => {
                      if (editingId === account.id) resetForm()
                      await queryClient.invalidateQueries({ queryKey: ['accounts'] })
                      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
                    })
                  }
                />
              </div>
            </article>
          )
        })}

        {accountsQuery.data?.length === 0 && (
          <div className="rounded-xl border border-dashed border-warm-300 px-6 py-12 text-center text-sm text-warm-500">
            No accounts yet. Save a checking account or retirement account your family should know
            about.
          </div>
        )}
      </div>
    </SectionPage>
  )
}

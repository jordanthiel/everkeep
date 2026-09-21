import { useJourneyStore } from '@renderer/state/journeyStore'
import { RecordLoginFields } from '@renderer/components/records/RecordLoginFields'
import { Link, useSearchParams } from 'react-router-dom'
import { TOPIC_CONTENT } from '@shared/sections/topicContent'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { emptyAccountForm as emptyForm, accountToForm } from '@shared/accountForm'
import { Save } from 'lucide-react'
import { SectionPage } from '@renderer/components/layout/SectionPage'
import { PersonPicker } from '@renderer/components/people/PersonPicker'
import { RecordActions } from '@renderer/components/records/RecordActions'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { Label } from '@renderer/components/ui/Label'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { ensurePersonRoles } from '@renderer/lib/people'
import { useVaultStore } from '@renderer/state/vaultStore'
import type { Account, AccountType } from '@shared/types/account'

const ACCOUNT_TYPES: Array<{ value: AccountType; label: string }> = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'money_market', label: 'Money market' },
  { value: 'cd', label: 'Certificate of deposit' },
  { value: 'pension', label: 'Pension' },
  { value: 'annuity', label: 'Annuity' },
  { value: 'treasury', label: 'Treasury' },
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
  const [searchParams, setSearchParams] = useSearchParams()
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

  function resetForm() {
    setForm(emptyForm())
    setEditingId(null)
    setError(null)
  }

  const startEdit = useCallback((account: Account) => {
    setEditingId(account.id)
    setForm(accountToForm(account))
    setError(null)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  useEffect(() => {
    const id = searchParams.get('edit')
    const account = accountsQuery.data?.find(item => item.id === id)
    if (!account) return
    startEdit(account)
    setSearchParams({}, { replace: true })
  }, [searchParams, accountsQuery.data, setSearchParams, startEdit])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (form.login && !form.login.provider.trim()) throw new Error('Enter the login’s provider or service, or remove the optional login before saving.')
      const beneficiaries = form.beneficiaries
      for (const beneficiary of beneficiaries) {
        if (!beneficiary.personId || !Number.isFinite(beneficiary.percentage) || beneficiary.percentage <= 0) throw new Error('Choose a contact and a percentage greater than zero for each beneficiary, or remove the unused row.')
        await ensurePersonRoles(beneficiary.personId, ['beneficiary'], people)
      }
      const payload = {
        login: form.login,
        institution: form.institution.trim(),
        accountName: form.accountName.trim() || null,
        accountType: form.accountType,
        lastFour: form.lastFour.trim() || null,
        fullAccountNumber: form.fullAccountNumber.trim() || null,
        beneficiaries,
        ownerPersonIds: form.ownerPersonIds,
        notes: form.notes
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
      const vaultId = useVaultStore.getState().session?.metadata.id
      const status = vaultId ? useJourneyStore.getState().vaults[vaultId]?.['financial'] : undefined
      if (vaultId && (!status || status === 'reviewed' || status === 'not-applicable')) useJourneyStore.getState().mark(vaultId, 'financial', 'in-progress')
      await queryClient.invalidateQueries({ queryKey: ['accounts'] })
      await queryClient.invalidateQueries({ queryKey: ['entries'] })
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
    <SectionPage journeyBlocked={Boolean(editingId) || JSON.stringify(form) !== JSON.stringify(emptyForm()) || saveMutation.isPending}
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
            <h2 className="font-display text-2xl text-charcoal-900">
              {editingId ? 'Update this account' : TOPIC_CONTENT.financial.heading}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-warm-500">
              {TOPIC_CONTENT.financial.guidance}
            </p>
          </div>
          {(editingId || JSON.stringify(form) !== JSON.stringify(emptyForm())) && (
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
          <Label htmlFor="owners">Account owners</Label>
          <PersonPicker id="owners" people={people} multi value={form.ownerPersonIds.join(',')} onChange={(value) => setForm((f) => ({ ...f, ownerPersonIds: value.split(',').filter(Boolean) }))} />
        </div>
        <fieldset className="space-y-3 rounded-lg border border-warm-200 p-4">
          <legend className="px-1 text-sm font-medium">Beneficiaries recorded with the institution</legend>
          <p className="text-xs text-warm-500">Record primary and contingent beneficiaries separately. Confirm changes with the institution; editing Everkeep does not change a designation.</p>
          {form.beneficiaries.map((beneficiary, index) => {
            const change = (patch: Partial<typeof beneficiary>) => setForm((f) => ({ ...f, beneficiaries: f.beneficiaries.map((b, i) => i === index ? { ...b, ...patch } : b) }))
            return <div key={index} className="space-y-3 border-t border-warm-200 pt-3">
              <Label htmlFor={`beneficiary-${index}`}>Beneficiary {index + 1}</Label>
              <PersonPicker id={`beneficiary-${index}`} people={people} value={beneficiary.personId} onChange={(personId) => change({ personId })} />
              <div className="flex flex-wrap gap-3">
                <label className="text-sm">Designation<select className="ml-2 rounded border border-warm-300 p-2" value={beneficiary.designationType} onChange={(e) => change({ designationType: e.target.value as 'primary' | 'contingent' })}><option value="primary">Primary</option><option value="contingent">Contingent</option></select></label>
                <label className="text-sm">Percentage<Input aria-label={`Beneficiary ${index + 1} percentage`} type="number" min="0.01" max="100" step="0.01" className="mt-1 w-24" value={beneficiary.percentage} onChange={(e) => change({ percentage: Number(e.target.value) })} /></label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={beneficiary.perStirpes} onChange={(e) => change({ perStirpes: e.target.checked })} />Per stirpes recorded</label>
              </div>
              <Input aria-label={`Beneficiary ${index + 1} notes`} placeholder="Designation notes (optional)" value={beneficiary.notes} onChange={(e) => change({ notes: e.target.value })} />
              <Button size="sm" variant="ghost" onClick={() => setForm((f) => ({ ...f, beneficiaries: f.beneficiaries.filter((_, i) => i !== index) }))}>Remove beneficiary {index + 1}</Button>
            </div>
          })}
          <Button variant="secondary" size="sm" onClick={() => setForm((f) => ({ ...f, beneficiaries: [...f.beneficiaries, { personId: '', designationType: 'primary', percentage: 100, perStirpes: false, notes: '' }] }))}>Add beneficiary</Button>
        </fieldset>
        <RecordLoginFields key={editingId ?? 'new'} value={form.login} provider={form.institution} onChange={login => setForm(current => ({ ...current, login }))} />
        <div><Label htmlFor="account-notes">Notes</Label><Input id="account-notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
        <div>
          <Button disabled={!form.institution.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()}><Save className="h-4 w-4" />{saveMutation.isPending ? 'Saving…' : 'Save account'}</Button>
          {error && <p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}
        </div>
      </div>
      <h2 className="mb-4 font-display text-2xl">{TOPIC_CONTENT.financial.collection}</h2>
      <div className="space-y-3">
        {(accountsQuery.data ?? []).map((account) => {
          const primary = account.beneficiaries.filter((b) => b.designationType === 'primary')
          const primaryTotal = primary.reduce((sum, b) => sum + b.percentage, 0)
          return <article key={account.id} className="rounded-xl border border-warm-200 bg-ivory-50/80 px-5 py-4 shadow-soft">
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
                  {account.login?.id && <p className="mt-3 text-sm"><Link className="text-forest-700 underline" to={`/digital?edit=${account.login.id}`}>Digital login: {account.login.provider}</Link></p>}
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
                      await queryClient.invalidateQueries({ queryKey: ['entries'] })
                      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
                    })
                  }
                />
              </div>
            </article>
        })}

        {accountsQuery.data?.length === 0 && (
          <div className="rounded-xl border border-dashed border-warm-300 px-6 py-12 text-center text-sm text-warm-500">
            {TOPIC_CONTENT.financial.empty}
          </div>
        )}
      </div>
    </SectionPage>
  )
}

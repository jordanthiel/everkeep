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
import type { Contact, ContactRole } from '@shared/types/contact'

const ROLE_OPTIONS: Array<{ value: ContactRole; label: string }> = [
  { value: 'estate_attorney', label: 'Estate attorney' },
  { value: 'cpa', label: 'CPA' },
  { value: 'financial_advisor', label: 'Financial advisor' },
  { value: 'insurance_agent', label: 'Insurance agent' },
  { value: 'banker', label: 'Banker' },
  { value: 'employer_hr', label: 'Employer HR' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'funeral_home', label: 'Funeral home' },
  { value: 'property_manager', label: 'Property manager' },
  { value: 'business_partner', label: 'Business partner' },
  { value: 'clergy', label: 'Clergy' },
  { value: 'other', label: 'Other' }
]

function emptyForm() {
  return {
    name: '',
    company: '',
    role: 'estate_attorney' as ContactRole,
    phone: '',
    email: ''
  }
}

export function ContactsPage() {
  const queryClient = useQueryClient()
  const setSaveStatus = useVaultStore((s) => s.setSaveStatus)
  const formRef = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const contactsQuery = useQuery({
    queryKey: ['contacts'],
    queryFn: () => unwrap(getEverkeepApi().contacts.list())
  })

  function resetForm() {
    setForm(emptyForm())
    setEditingId(null)
    setError(null)
  }

  function startEdit(contact: Contact) {
    setEditingId(contact.id)
    setForm({
      name: contact.name,
      company: contact.company ?? '',
      role: contact.role ?? 'estate_attorney',
      phone: contact.phone ?? '',
      email: contact.email ?? ''
    })
    setError(null)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        company: form.company.trim() || null,
        role: form.role,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null
      }
      if (editingId) {
        return unwrap(
          getEverkeepApi().contacts.update({
            id: editingId,
            ...payload,
            lastReviewedAt: new Date().toISOString()
          })
        )
      }
      return unwrap(getEverkeepApi().contacts.create(payload))
    },
    onMutate: () => {
      setError(null)
      setSaveStatus('saving')
    },
    onSuccess: async () => {
      resetForm()
      setSaveStatus('saved')
      await queryClient.invalidateQueries({ queryKey: ['contacts'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['review'] })
      window.setTimeout(() => setSaveStatus('idle'), 1500)
    },
    onError: (err) => {
      setSaveStatus('error')
      setError(err instanceof Error ? err.message : 'Unable to save.')
    }
  })

  return (
    <SectionPage
      title="Important Contacts"
      description="Professionals and organizations your family may need to reach — attorneys, advisors, doctors, and more. Family members belong in People."
      badge="Actionable"
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
              {editingId ? 'Edit contact' : 'New contact'}
            </p>
            <p className="mt-1 text-xs text-warm-400">
              Save stores this contact. A blank record is then ready so you can keep going.
            </p>
          </div>
          {editingId && (
            <Button size="sm" variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
          )}
        </div>
        <div>
          <Label htmlFor="contactName">Name</Label>
          <Input
            id="contactName"
            value={form.name}
            onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="company">Company</Label>
          <Input
            id="company"
            value={form.company}
            onChange={(e) => setForm((current) => ({ ...current, company: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="role">Role</Label>
          <select
            id="role"
            value={form.role}
            onChange={(e) =>
              setForm((current) => ({ ...current, role: e.target.value as ContactRole }))
            }
            className="flex h-10 w-full rounded-md border border-warm-300 bg-ivory-50 px-3 text-sm"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={form.phone}
            onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            value={form.email}
            onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
          />
        </div>
        <div className="md:col-span-2">
          <Button
            disabled={!form.name.trim() || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
          {error && <p className="mt-2 text-sm text-red-800">{error}</p>}
        </div>
      </div>

      <div className="space-y-3">
        {(contactsQuery.data ?? []).map((contact) => (
          <article
            key={contact.id}
            className="rounded-xl border border-warm-200 bg-ivory-50/80 px-5 py-4 shadow-soft"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-medium text-charcoal-900">{contact.name}</h3>
                <p className="mt-1 text-sm text-warm-500">
                  {ROLE_OPTIONS.find((r) => r.value === contact.role)?.label ?? 'Contact'}
                  {contact.company ? ` · ${contact.company}` : ''}
                </p>
                <p className="mt-2 text-sm text-warm-500">
                  {[contact.phone, contact.email].filter(Boolean).join(' · ') ||
                    'No phone or email yet'}
                </p>
              </div>
              <RecordActions
                onEdit={() => startEdit(contact)}
                onArchive={() =>
                  void unwrap(getEverkeepApi().contacts.archive(contact.id)).then(async () => {
                    if (editingId === contact.id) resetForm()
                    await queryClient.invalidateQueries({ queryKey: ['contacts'] })
                    await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
                  })
                }
              />
            </div>
          </article>
        ))}

        {contactsQuery.data?.length === 0 && (
          <div className="rounded-xl border border-dashed border-warm-300 px-6 py-12 text-center text-sm text-warm-500">
            No contacts yet. Start with your estate attorney or financial advisor.
          </div>
        )}
      </div>
    </SectionPage>
  )
}

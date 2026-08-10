import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { SectionPage } from '@renderer/components/layout/SectionPage'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { Label } from '@renderer/components/ui/Label'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'
import type { ContactRole } from '@shared/types/contact'

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

export function ContactsPage() {
  const queryClient = useQueryClient()
  const setSaveStatus = useVaultStore((s) => s.setSaveStatus)
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState<ContactRole>('estate_attorney')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  const contactsQuery = useQuery({
    queryKey: ['contacts'],
    queryFn: () => unwrap(getEverkeepApi().contacts.list())
  })

  const createMutation = useMutation({
    mutationFn: () =>
      unwrap(
        getEverkeepApi().contacts.create({
          name: name.trim(),
          company: company.trim() || null,
          role,
          phone: phone.trim() || null,
          email: email.trim() || null
        })
      ),
    onMutate: () => setSaveStatus('saving'),
    onSuccess: async () => {
      setName('')
      setCompany('')
      setPhone('')
      setEmail('')
      setSaveStatus('saved')
      await queryClient.invalidateQueries({ queryKey: ['contacts'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      window.setTimeout(() => setSaveStatus('idle'), 1500)
    },
    onError: () => setSaveStatus('error')
  })

  return (
    <SectionPage
      title="Important Contacts"
      description="Professionals and organizations your family may need to reach — attorneys, advisors, doctors, and more."
      badge="Actionable"
    >
      <div className="mb-6 grid gap-4 rounded-xl border border-warm-200 bg-ivory-50/80 p-5 md:grid-cols-2">
        <div>
          <Label htmlFor="contactName">Name</Label>
          <Input id="contactName" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="company">Company</Label>
          <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="role">Role</Label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as ContactRole)}
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
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Button
            disabled={!name.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            <Plus className="h-4 w-4" />
            Add contact
          </Button>
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
                  {[contact.phone, contact.email].filter(Boolean).join(' · ') || 'No phone or email yet'}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  void unwrap(getEverkeepApi().contacts.archive(contact.id)).then(() =>
                    queryClient.invalidateQueries({ queryKey: ['contacts'] })
                  )
                }
              >
                Archive
              </Button>
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

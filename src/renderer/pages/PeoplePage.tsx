import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Check } from 'lucide-react'
import { SectionPage } from '@renderer/components/layout/SectionPage'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { Label } from '@renderer/components/ui/Label'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { useVaultStore } from '@renderer/state/vaultStore'

export function PeoplePage() {
  const queryClient = useQueryClient()
  const setSaveStatus = useVaultStore((s) => s.setSaveStatus)
  const [fullName, setFullName] = useState('')
  const [relationship, setRelationship] = useState('spouse')

  const peopleQuery = useQuery({
    queryKey: ['people'],
    queryFn: () => unwrap(getEverkeepApi().people.list())
  })

  const createMutation = useMutation({
    mutationFn: () =>
      unwrap(
        getEverkeepApi().people.create({
          fullName: fullName.trim(),
          relationship: relationship as 'spouse' | 'partner' | 'child' | 'parent' | 'sibling' | 'friend' | 'other'
        })
      ),
    onMutate: () => setSaveStatus('saving'),
    onSuccess: async () => {
      setFullName('')
      setSaveStatus('saved')
      await queryClient.invalidateQueries({ queryKey: ['people'] })
      window.setTimeout(() => setSaveStatus('idle'), 1500)
    },
    onError: () => setSaveStatus('error')
  })

  const reviewMutation = useMutation({
    mutationFn: (id: string) => unwrap(getEverkeepApi().people.markReviewed(id)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['people'] })
    }
  })

  return (
    <SectionPage
      title="People"
      description="Reusable records for family members, executors, trustees, and other trusted people."
      badge="Foundation"
      actions={
        <Button
          disabled={!fullName.trim() || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          <Plus className="h-4 w-4" />
          Add person
        </Button>
      }
    >
      <div className="mb-6 grid gap-4 rounded-xl border border-warm-200 bg-ivory-50/80 p-5 sm:grid-cols-[1fr_180px_auto]">
        <div>
          <Label htmlFor="personName">Full name</Label>
          <Input
            id="personName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Smith"
          />
        </div>
        <div>
          <Label htmlFor="relationship">Relationship</Label>
          <select
            id="relationship"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            className="flex h-10 w-full rounded-md border border-warm-300 bg-ivory-50 px-3 text-sm"
          >
            <option value="spouse">Spouse</option>
            <option value="partner">Partner</option>
            <option value="child">Child</option>
            <option value="parent">Parent</option>
            <option value="sibling">Sibling</option>
            <option value="friend">Friend</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button
            className="w-full sm:w-auto"
            disabled={!fullName.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Save
          </Button>
        </div>
      </div>

      {peopleQuery.isLoading && <p className="text-sm text-warm-500">Loading people…</p>}
      {peopleQuery.isError && (
        <p className="text-sm text-red-800">Unable to load people. Is a vault open?</p>
      )}

      <div className="space-y-3">
        {(peopleQuery.data ?? []).map((person) => (
          <article
            key={person.id}
            className="rounded-xl border border-warm-200 bg-ivory-50/80 px-5 py-4 shadow-soft"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-medium text-charcoal-900">{person.fullName}</h3>
                <p className="mt-1 text-sm capitalize text-warm-500">
                  {person.relationship ?? 'No relationship set'}
                </p>
                <p className="mt-2 text-xs text-warm-400">
                  Last reviewed{' '}
                  {person.lastReviewedAt
                    ? new Date(person.lastReviewedAt).toLocaleDateString()
                    : 'never'}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => reviewMutation.mutate(person.id)}
              >
                <Check className="h-3.5 w-3.5" />
                Still accurate
              </Button>
            </div>
          </article>
        ))}

        {peopleQuery.data?.length === 0 && (
          <div className="rounded-xl border border-dashed border-warm-300 px-6 py-12 text-center text-sm text-warm-500">
            No people yet. Add yourself and the people who would need access to this information.
          </div>
        )}
      </div>
    </SectionPage>
  )
}

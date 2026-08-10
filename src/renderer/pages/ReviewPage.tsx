import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Check, ArrowRight } from 'lucide-react'
import { SectionPage } from '@renderer/components/layout/SectionPage'
import { Button } from '@renderer/components/ui/Button'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'

export function ReviewPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const reviewQuery = useQuery({
    queryKey: ['review'],
    queryFn: () => unwrap(getEverkeepApi().review.list())
  })

  const markMutation = useMutation({
    mutationFn: async (item: { id: string; entity: string }) => {
      if (item.entity === 'people') {
        return unwrap(getEverkeepApi().people.markReviewed(item.id))
      }
      if (item.entity === 'contacts') {
        return unwrap(getEverkeepApi().contacts.markReviewed(item.id))
      }
      if (item.entity === 'accounts') {
        return unwrap(getEverkeepApi().accounts.markReviewed(item.id))
      }
      return unwrap(getEverkeepApi().entries.markReviewed(item.id))
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['review'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['people'] })
      await queryClient.invalidateQueries({ queryKey: ['contacts'] })
      await queryClient.invalidateQueries({ queryKey: ['accounts'] })
      await queryClient.invalidateQueries({ queryKey: ['entries'] })
    }
  })

  const items = reviewQuery.data ?? []

  return (
    <SectionPage
      title="Review"
      description="Information becomes risky when people assume it is current but it isn’t. Confirm what is still accurate."
      badge="Yearly habit"
    >
      <div className="mb-6 rounded-xl border border-warm-200 bg-ivory-50/80 px-5 py-4 text-sm text-warm-500">
        {items.length === 0
          ? 'Everything recently reviewed looks current. Nice work.'
          : `${items.length} item${items.length === 1 ? '' : 's'} haven’t been reviewed in over a year (or ever).`}
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <article
            key={`${item.entity}-${item.id}`}
            className="flex flex-col gap-3 rounded-xl border border-warm-200 bg-ivory-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-xs uppercase tracking-wide text-warm-400">{item.section}</p>
              <h3 className="mt-1 font-medium text-charcoal-900">{item.title}</h3>
              <p className="mt-1 text-sm text-warm-500">
                {item.lastReviewedAt
                  ? `Last reviewed ${new Date(item.lastReviewedAt).toLocaleDateString()} (${item.staleDays} days ago)`
                  : 'Never reviewed'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => markMutation.mutate({ id: item.id, entity: item.entity })}
              >
                <Check className="h-3.5 w-3.5" />
                Still accurate
              </Button>
              <Button size="sm" variant="ghost" onClick={() => navigate(item.path)}>
                Open
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </article>
        ))}
      </div>
    </SectionPage>
  )
}

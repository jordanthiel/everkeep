import { useNavigate } from 'react-router-dom'
import { ArrowRight, Clock3, Users } from 'lucide-react'
import { useVaultStore } from '@renderer/state/vaultStore'
import { Button } from '@renderer/components/ui/Button'

const placeholderNeeds = [
  'Add people who matter most',
  'Record where your will is kept',
  'Document your password manager access',
  'List primary financial accounts'
]

export function DashboardPage() {
  const navigate = useNavigate()
  const session = useVaultStore((s) => s.session)
  const name =
    session?.metadata.ownerPreferredName ||
    session?.metadata.ownerFirstName ||
    session?.metadata.householdName ||
    'there'

  return (
    <div>
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brass-500">Home</p>
        <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-charcoal-900">
          Welcome, {name}
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-warm-500">
          Your Everkeep Vault is taking shape. Keep adding the details your family would need if you
          couldn’t explain them yourself.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-warm-200 bg-ivory-50/80 p-6 shadow-soft">
          <p className="text-sm font-medium text-warm-500">Overall Readiness</p>
          <div className="mt-4 flex items-end gap-4">
            <p className="font-display text-5xl font-medium text-charcoal-900">—</p>
            <p className="mb-1 text-sm text-warm-500">Completion scoring arrives with more sections</p>
          </div>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-warm-200">
            <div className="h-full w-[8%] rounded-full bg-forest-600 transition-all" />
          </div>
          <p className="mt-4 text-sm text-warm-500">
            Start with People, then Legal & Estate and Financial — the foundation of a useful vault.
          </p>
        </section>

        <section className="rounded-2xl border border-warm-200 bg-gradient-to-br from-forest-700 to-forest-600 p-6 text-ivory-50 shadow-soft">
          <p className="text-sm text-ivory-200">Continue where you left off</p>
          <h2 className="mt-3 font-display text-2xl">People</h2>
          <p className="mt-2 text-sm text-ivory-200">
            Add family members, executors, and trusted contacts as reusable person records.
          </p>
          <Button
            className="mt-6 bg-ivory-50 text-forest-700 hover:bg-white"
            onClick={() => navigate('/people')}
          >
            Open People
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <section className="rounded-2xl border border-warm-200 bg-ivory-50/80 p-6">
          <div className="mb-4 flex items-center gap-2 text-charcoal-800">
            <Clock3 className="h-4 w-4 text-brass-500" />
            <h2 className="font-medium">Needs Attention</h2>
          </div>
          <ul className="space-y-3">
            {placeholderNeeds.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-warm-500">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brass-500" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-warm-200 bg-ivory-50/80 p-6">
          <h2 className="mb-4 font-medium text-charcoal-800">Recently Updated</h2>
          <p className="text-sm text-warm-500">
            Edits will appear here as you begin filling sections. Autosave keeps every change durable.
          </p>
        </section>

        <section className="rounded-2xl border border-warm-200 bg-ivory-50/80 p-6">
          <div className="mb-4 flex items-center gap-2 text-charcoal-800">
            <Users className="h-4 w-4 text-forest-600" />
            <h2 className="font-medium">Important People</h2>
          </div>
          <dl className="space-y-3 text-sm">
            {[
              ['Spouse', session?.metadata.spousePartnerName || 'Not set'],
              ['Executor', 'Not set'],
              ['Trustee', 'Not set'],
              ['Power of Attorney', 'Not set']
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-warm-500">{label}</dt>
                <dd className="text-right text-charcoal-800">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  )
}

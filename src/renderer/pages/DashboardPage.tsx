import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Circle, Lock, Sparkles } from 'lucide-react'
import { useVaultStore } from '@renderer/state/vaultStore'
import { Button } from '@renderer/components/ui/Button'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'
import { cn } from '@renderer/lib/utils'

export function DashboardPage() {
  const navigate = useNavigate()
  const session = useVaultStore((s) => s.session)
  const setSession = useVaultStore((s) => s.setSession)
  const name =
    session?.metadata.ownerPreferredName ||
    session?.metadata.ownerFirstName ||
    session?.metadata.householdName ||
    'there'

  const dashboardQuery = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => unwrap(getEverkeepApi().vault.getDashboard())
  })

  const summary = dashboardQuery.data
  const nextAction = summary?.actions.find((action) => !action.done)
  const completedCount = summary?.actions.filter((a) => a.done).length ?? 0
  const totalActions = summary?.actions.length ?? 5

  async function lockVault() {
    const locked = await unwrap(getEverkeepApi().vault.lock())
    setSession(locked)
    navigate('/unlock')
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brass-500">Home</p>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-charcoal-900">
            Welcome, {name}
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-warm-500">
            {summary && summary.overallPercent >= 80
              ? 'Your Everkeep Vault is in good shape. Review anything that still needs attention.'
              : 'Your Everkeep Vault is taking shape. Follow the steps below — each one makes things clearer for the people you trust.'}
          </p>
        </div>
        {session?.metadata.isPasswordProtected && (
          <Button variant="secondary" onClick={() => void lockVault()}>
            <Lock className="h-4 w-4" />
            Lock vault
          </Button>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-warm-200 bg-ivory-50/80 p-6 shadow-soft">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-warm-500">Overall readiness</p>
              <p className="mt-2 font-display text-5xl font-medium text-charcoal-900">
                {summary ? `${summary.overallPercent}%` : '—'}
              </p>
            </div>
            <p className="mb-1 text-sm text-warm-500">
              {completedCount} of {totalActions} starter steps complete
            </p>
          </div>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-warm-200">
            <div
              className="h-full rounded-full bg-forest-600 transition-all"
              style={{ width: `${summary?.overallPercent ?? 0}%` }}
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            <StatChip label="People" value={summary?.peopleCount ?? 0} />
            <StatChip label="Contacts" value={summary?.contactsCount ?? 0} />
            <StatChip label="Accounts" value={summary?.accountsCount ?? 0} />
          </div>
        </section>

        <section className="rounded-2xl border border-warm-200 bg-gradient-to-br from-forest-700 to-forest-600 p-6 text-ivory-50 shadow-soft">
          <p className="inline-flex items-center gap-1.5 text-sm text-ivory-200">
            <Sparkles className="h-3.5 w-3.5" />
            Do this next
          </p>
          {nextAction ? (
            <>
              <h2 className="mt-3 font-display text-2xl">{nextAction.title}</h2>
              <p className="mt-2 text-sm text-ivory-200">{nextAction.description}</p>
              <Button
                className="mt-6 bg-ivory-50 text-forest-700 hover:bg-white"
                onClick={() => navigate(nextAction.path)}
              >
                {nextAction.cta}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <h2 className="mt-3 font-display text-2xl">Starter steps complete</h2>
              <p className="mt-2 text-sm text-ivory-200">
                Nice work. Keep reviewing sections yearly, and add insurance, property, and legal
                details when you are ready.
              </p>
              <Button
                className="mt-6 bg-ivory-50 text-forest-700 hover:bg-white"
                onClick={() => navigate('/financial')}
              >
                Review financial accounts
                <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </section>
      </div>

      <section className="mt-5 rounded-2xl border border-warm-200 bg-ivory-50/80 p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-medium text-charcoal-900">Getting started checklist</h2>
          <p className="text-xs text-warm-400">Clear actions — not busywork</p>
        </div>
        <ol className="space-y-3">
          {(summary?.actions ?? []).map((action, index) => (
            <li
              key={action.id}
              className={cn(
                'flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
                action.done
                  ? 'border-forest-600/20 bg-forest-700/5'
                  : 'border-warm-200 bg-white/70'
              )}
            >
              <div className="flex min-w-0 items-start gap-3">
                {action.done ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-forest-600" />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-warm-300" />
                )}
                <div className="min-w-0">
                  <p className="font-medium text-charcoal-900">
                    <span className="mr-2 text-warm-400">{index + 1}.</span>
                    {action.title}
                  </p>
                  <p className="mt-1 text-sm text-warm-500">{action.description}</p>
                </div>
              </div>
              {!action.done && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="shrink-0"
                  onClick={() => navigate(action.path)}
                >
                  {action.cta}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-warm-200 bg-ivory-50/80 p-6">
          <h2 className="mb-4 font-medium text-charcoal-800">Recently updated</h2>
          {(summary?.recentlyUpdated.length ?? 0) === 0 ? (
            <p className="text-sm text-warm-500">
              Edits will appear here as you add people, contacts, and accounts.
            </p>
          ) : (
            <ul className="space-y-3">
              {summary?.recentlyUpdated.map((item) => (
                <li key={`${item.entity}-${item.title}-${item.updatedAt}`}>
                  <button
                    type="button"
                    onClick={() => navigate(item.path)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-warm-100"
                  >
                    <div>
                      <p className="text-sm font-medium text-charcoal-900">{item.title}</p>
                      <p className="text-xs text-warm-400">{item.entity}</p>
                    </div>
                    <span className="text-xs text-warm-400">
                      {new Date(item.updatedAt).toLocaleDateString()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-warm-200 bg-ivory-50/80 p-6">
          <h2 className="mb-4 font-medium text-charcoal-800">Important people</h2>
          <dl className="space-y-3 text-sm">
            {(summary?.importantPeople ?? []).map((item) => (
              <div key={item.role} className="flex justify-between gap-3">
                <dt className="text-warm-500">{item.role}</dt>
                <dd className="text-right text-charcoal-800">{item.name || 'Not set'}</dd>
              </div>
            ))}
          </dl>
          <Button
            className="mt-5"
            variant="secondary"
            size="sm"
            onClick={() => navigate('/people')}
          >
            Manage people
          </Button>
        </section>
      </div>
    </div>
  )
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full border border-warm-200 bg-white px-2.5 py-1 text-warm-500">
      <span className="font-medium text-charcoal-800">{value}</span> {label}
    </span>
  )
}

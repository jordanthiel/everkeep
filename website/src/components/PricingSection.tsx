import { Check } from '../lib/check-icon'
import { formatPrice, pricing } from '../config/pricing'

const included = [
  'Unlimited vaults, people, and entries',
  'Document attachments that stay on your computer',
  'Password-protected vaults (Argon2id + AES-256-GCM)',
  'Human-readable reports for the people you trust',
  'Portable backups you control',
  'Free updates for the life of the 1.x line'
]

export function PricingSection() {
  const price = formatPrice(pricing.price, pricing.currency)
  return (
    <section id="pricing" className="border-t border-warm-200 bg-ivory-100">
      <div className="mx-auto max-w-6xl px-6 py-20 md:px-8 md:py-28">
        <p className="font-display text-sm font-medium tracking-wide text-brass-500">Pricing</p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-medium tracking-tight text-charcoal-900 md:text-4xl">
          One price. Yours forever.
        </h2>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-charcoal-700">
          No subscription, no account, no cloud watching your data. Pay once and Everkeep is yours —
          the way local-first software should be.
        </p>

        <div className="mt-12 max-w-md rounded-2xl border border-warm-200 bg-ivory-50 p-8 shadow-sm">
          <p className="font-display text-sm font-medium tracking-wide text-brass-500">
            Everkeep for your household
          </p>
          <p className="mt-4 flex items-baseline gap-2">
            <span className="font-display text-5xl font-medium tracking-tight text-charcoal-900">
              {price}
            </span>
            <span className="text-sm text-warm-500">one-time</span>
          </p>
          <ul className="mt-6 space-y-3">
            {included.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-charcoal-800">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-forest-700" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            {pricing.paymentLink ? (
              <a
                href={pricing.paymentLink}
                className="inline-flex w-full items-center justify-center rounded-md bg-forest-700 px-6 py-3.5 text-base font-medium text-ivory-50 transition hover:bg-forest-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass-400"
              >
                Buy Everkeep — {price}
              </a>
            ) : (
              <p className="rounded-md border border-warm-200 bg-ivory-100 px-4 py-3 text-sm text-warm-500">
                Online purchase opening soon — download the free trial below to start.
              </p>
            )}
            <a
              href="#download"
              className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-charcoal-900/15 bg-ivory-50/80 px-6 py-3.5 text-base font-medium text-charcoal-800 transition hover:border-charcoal-900/25 hover:bg-ivory-50"
            >
              Try it free first
            </a>
          </div>
          <p className="mt-5 text-center text-sm text-warm-500">
            {pricing.guaranteeDays}-day money-back guarantee. If Everkeep isn&apos;t right for your
            family, email us for a full refund.
          </p>
        </div>
      </div>
    </section>
  )
}

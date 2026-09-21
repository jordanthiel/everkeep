import { BuySuccess } from './components/BuySuccess'
import { DownloadButtons } from './components/DownloadButtons'
import { EverkeepMark } from './components/EverkeepMark'
import { HeroScene } from './components/HeroScene'
import { SiteHeader } from './components/SiteHeader'
import { checkout } from './config/checkout'
import { downloads } from './config/downloads'

const capabilities = [
  {
    title: 'Gather the essentials',
    body: 'People, contacts, identity records, legal documents, finances, insurance, property, healthcare, and more — in one guided vault.'
  },
  {
    title: 'Attach the real files',
    body: 'Keep scans and PDFs with the entries they belong to. Attachments stay with your saved vault and are included when you enable online sharing.'
  },
  {
    title: 'Leave clear instructions',
    body: 'Final wishes, letters, and household details so the people you trust are not left guessing.'
  },
  {
    title: 'Review and share thoughtfully',
    body: 'Spot stale items, export a readable report, and back up the whole vault when you are ready.'
  }
]

const vaultTopics = [
  'People & contacts',
  'Identity',
  'Legal & estate',
  'Financial',
  'Insurance',
  'Property',
  'Healthcare',
  'Digital life',
  'Household',
  'Final wishes',
  'Letters',
  'Documents'
]

const LEGAL_DISCLAIMER =
  'Everkeep helps you organize and communicate information. It does not create a will, trust, power of attorney, beneficiary designation, or other legally binding estate-planning document and does not provide legal, tax, or financial advice.'

function isBuySuccessPath(pathname: string): boolean {
  return pathname === '/buy/success' || pathname.endsWith('/buy/success')
}

export default function App() {
  if (typeof window !== 'undefined' && isBuySuccessPath(window.location.pathname)) {
    return <BuySuccess />
  }

  return (
    <div id="top" className="min-h-screen">
      <SiteHeader />

      <section className="relative min-h-[100svh] overflow-hidden">
        <HeroScene />
        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-center px-6 pb-20 pt-28 md:px-8 md:pb-28">
          <div className="max-w-xl">
            <EverkeepMark size="hero" className="animate-fade-up" />
            <h1 className="mt-8 animate-fade-up-delay font-display text-4xl font-medium leading-[1.12] tracking-tight text-charcoal-900 text-balance md:text-5xl lg:text-[3.35rem]">
              Keep what matters, where your family can find it.
            </h1>
            <p className="mt-5 max-w-md animate-fade-up-delay-2 text-lg leading-relaxed text-charcoal-700">
              A private desktop vault for the life and estate information someone would need if you
              could not explain it yourself.
            </p>
            <div className="mt-8 animate-fade-up-delay-2">
              <DownloadButtons />
              <p className="mt-3 text-sm text-warm-500">
                macOS &amp; Windows · v{downloads.version} · free to try · runs on your computer
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="capabilities" className="border-t border-warm-200 bg-ivory-50">
        <div className="mx-auto max-w-6xl px-6 py-20 md:px-8 md:py-28">
          <p className="font-display text-sm font-medium tracking-wide text-brass-500">What you can do</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-medium tracking-tight text-charcoal-900 md:text-4xl">
            Build a clear record of the information that keeps a household going.
          </h2>
          <ol className="mt-14 grid gap-10 md:grid-cols-2 md:gap-x-16 md:gap-y-12">
            {capabilities.map((item, index) => (
              <li key={item.title} className="flex gap-5">
                <span className="font-display text-2xl text-brass-500 tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="font-display text-xl font-medium text-charcoal-900">{item.title}</h3>
                  <p className="mt-2 max-w-md leading-relaxed text-charcoal-700">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="privacy" className="relative overflow-hidden bg-forest-800 text-ivory-100">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          aria-hidden
          style={{
            backgroundImage:
              'radial-gradient(ellipse at 10% 20%, rgba(196,165,116,0.35), transparent 40%), radial-gradient(ellipse at 90% 70%, rgba(92,107,74,0.5), transparent 45%)'
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 py-20 md:px-8 md:py-28">
          <p className="font-display text-sm font-medium tracking-wide text-brass-400">Local-first by design</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-medium tracking-tight text-ivory-50 md:text-4xl">
            Your vault never leaves your computer unless you choose to share it.
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ivory-200/90">
            Everkeep stores everything in a local <span className="text-ivory-50">.everkeep</span> file
            on your machine. Optional password protection encrypts sensitive fields. There is no
            Everkeep cloud account and no sync service watching your data.
          </p>
          <dl className="mt-14 grid gap-8 sm:grid-cols-3">
            {[
              ['SQLite vaults', 'Portable files you control and can back up yourself.'],
              ['Optional encryption', 'Argon2id + AES-GCM for password-protected vaults.'],
              ['Export when ready', 'Save an Everkeep file or export a readable copy.']
            ].map(([term, detail]) => (
              <div key={term}>
                <dt className="font-display text-lg text-brass-400">{term}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-ivory-200/85">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-t border-warm-200 bg-ivory-100">
        <div className="mx-auto max-w-6xl px-6 py-20 md:px-8 md:py-24">
          <p className="font-display text-sm font-medium tracking-wide text-brass-500">Guided sections</p>
          <h2 className="mt-3 max-w-xl font-display text-3xl font-medium tracking-tight text-charcoal-900">
            Structured prompts so nothing important stays only in your head.
          </h2>
          <ul className="mt-10 flex flex-wrap gap-x-3 gap-y-3">
            {vaultTopics.map((topic) => (
              <li
                key={topic}
                className="border-b border-forest-700/25 pb-0.5 font-medium text-forest-700"
              >
                {topic}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="pricing" className="border-t border-warm-200 bg-ivory-50">
        <div className="mx-auto max-w-6xl px-6 py-20 md:px-8 md:py-28">
          <p className="font-display text-sm font-medium tracking-wide text-brass-500">Pricing</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-medium tracking-tight text-charcoal-900 md:text-4xl">
            Free to try. Lifetime when you are ready.
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-charcoal-700">
            Start with {checkout.freeEntryCap} entries and {checkout.freeAttachmentCap} attachments.
            Your vault never locks — unpaid installs stay readable and exportable forever.
          </p>
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="font-display text-xl font-medium text-charcoal-900">Free</h3>
              <p className="mt-2 text-sm leading-relaxed text-charcoal-700">
                Up to {checkout.freeEntryCap} entries, {checkout.freeAttachmentCap} attachments, and
                watermarked HTML reports. Enough to finish a real household vault and decide if
                Lifetime is worth it.
              </p>
            </div>
            <div>
              <h3 className="font-display text-xl font-medium text-charcoal-900">
                Lifetime · ${checkout.lifetimePriceUsd}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-charcoal-700">
                One-time payment for unlimited entries and attachments, clean exports, and continued
                updates. No subscription required to keep your vault open.
              </p>
              <a
                href={checkout.paymentLink}
                className="mt-5 inline-flex rounded-md bg-forest-700 px-3.5 py-2 text-sm font-medium text-ivory-50 transition hover:bg-forest-600"
              >
                Buy Lifetime — ${checkout.lifetimePriceUsd}
              </a>
            </div>
          </div>
          <p className="mt-10 max-w-2xl text-sm leading-relaxed text-warm-500">
            Does my vault lock if I don&apos;t pay? No. Free caps only affect creating new entries,
            attaching more files, and watermark-free exports. Opening, reading, reviewing, and
            backing up always work.
          </p>
        </div>
      </section>

      <section id="download" className="border-t border-warm-200 bg-ivory-50">
        <div className="mx-auto max-w-6xl px-6 py-20 md:px-8 md:py-28">
          <div className="max-w-xl">
            <EverkeepMark size="lg" />
            <h2 className="mt-8 font-display text-3xl font-medium tracking-tight text-charcoal-900 md:text-4xl">
              Download Everkeep
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-charcoal-700">
              Install on your Mac or Windows PC and create your first vault in minutes. Free to try
              with {checkout.freeEntryCap} entries — your information is saved locally until you choose online sharing.
            </p>
            <div className="mt-8">
              <DownloadButtons />
            </div>
            <p className="mt-4 text-sm text-warm-500">
              Looking for an older build?{' '}
              <a href={downloads.releases} className="underline decoration-warm-300 underline-offset-4 hover:text-forest-700">
                Browse all releases
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-warm-200 bg-ivory-100">
        <div className="mx-auto max-w-6xl px-6 py-12 md:px-8">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <EverkeepMark size="sm" />
            <p className="max-w-xl text-sm leading-relaxed text-warm-500">{LEGAL_DISCLAIMER}</p>
          </div>
          <p className="mt-10 text-sm text-warm-400">© {new Date().getFullYear()} Everkeep</p>
        </div>
      </footer>
    </div>
  )
}

import { EverkeepMark } from './EverkeepMark'

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 md:px-8">
        <a href="#top" className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-400">
          <EverkeepMark size="sm" />
        </a>
        <nav className="flex items-center gap-6 text-sm font-medium text-charcoal-800">
          <a href="#capabilities" className="hidden transition hover:text-forest-700 sm:inline">
            What you can do
          </a>
          <a href="#privacy" className="hidden transition hover:text-forest-700 sm:inline">
            Privacy
          </a>
          <a href="#pricing" className="hidden transition hover:text-forest-700 sm:inline">
            Pricing
          </a>
          <a
            href="#download"
            className="rounded-md bg-forest-700 px-3.5 py-2 text-ivory-50 transition hover:bg-forest-600"
          >
            Download
          </a>
        </nav>
      </div>
    </header>
  )
}

import { EverkeepMark } from './EverkeepMark'

export function BuySuccess() {
  return <div className="min-h-screen bg-ivory-50">
    <div className="mx-auto max-w-2xl px-6 py-16 md:px-8">
      <a href="/" className="inline-block"><EverkeepMark size="sm" /></a>
      <h1 className="mt-10 font-display text-3xl font-medium text-charcoal-900 md:text-4xl">Your purchase follows your email</h1>
      <p className="mt-4 text-lg leading-relaxed text-charcoal-700">Once Stripe confirms your payment, Everkeep Lifetime is linked to the email you used at checkout. There is no license key to copy or enter.</p>
      <ol className="mt-8 list-decimal space-y-3 pl-6 text-charcoal-700">
        <li>Download and open Everkeep.</li>
        <li>Sign in with the same email address you used at checkout.</li>
        <li>Verify the email code. Your Lifetime purchase is applied automatically.</li>
      </ol>
      <p className="mt-6 text-sm text-warm-500">Already have the app open? Return to Settings and select “Restore purchase / Check again.” If payment is still processing, wait for your Stripe receipt and check again. Your vault files keep their existing access protection.</p>
      <a href="/#download" className="mt-8 inline-flex rounded-md bg-forest-700 px-5 py-3 font-medium text-ivory-50">Download Everkeep</a>
      <p className="mt-8 text-sm text-warm-500"><a href="/" className="underline">Back to Everkeep</a></p>
    </div>
  </div>
}

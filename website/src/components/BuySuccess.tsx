import { useEffect, useState } from 'react'
import { EverkeepMark } from './EverkeepMark'
import { checkout } from '../config/checkout'

interface LicenseResponse {
  licenseKey: string
  email: string
  issuedAt: string
  orderId: string
}

export function BuySuccess() {
  const sessionId = new URLSearchParams(window.location.search).get('session_id')?.trim() ?? ''
  const [license, setLicense] = useState<LicenseResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!sessionId) {
      setError('Missing checkout session. If you just paid, open the success link from your Stripe receipt.')
      return
    }
    if (!checkout.licenseApiUrl) {
      setError(
        'License lookup is not configured on this site yet. Check your purchase email for the license key, then paste it in Everkeep → Settings → License.'
      )
      return
    }

    let cancelled = false
    let attempts = 0

    async function load() {
      attempts += 1
      try {
        const response = await fetch(
          `${checkout.licenseApiUrl.replace(/\/$/, '')}/license?session_id=${encodeURIComponent(sessionId)}`
        )
        if (response.status === 404 && attempts < 8) {
          window.setTimeout(() => {
            if (!cancelled) void load()
          }, 1500)
          return
        }
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error || 'Unable to load license key.')
        }
        const data = (await response.json()) as LicenseResponse
        if (!cancelled) setLicense(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load license key.')
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  async function copyKey() {
    if (!license?.licenseKey) return
    await navigator.clipboard.writeText(license.licenseKey)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-ivory-50">
      <div className="mx-auto max-w-2xl px-6 py-16 md:px-8">
        <a href="/" className="inline-block">
          <EverkeepMark size="sm" />
        </a>
        <h1 className="mt-10 font-display text-3xl font-medium tracking-tight text-charcoal-900 md:text-4xl">
          Payment received
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-charcoal-700">
          Thank you for purchasing Everkeep Lifetime. Paste your license key in the app under
          Settings → License. Your vault stays on your computer and remains readable forever.
        </p>

        {license ? (
          <div className="mt-8 rounded-xl border border-warm-200 bg-white p-5">
            <p className="text-sm text-warm-500">Licensed to {license.email}</p>
            <pre className="mt-3 overflow-x-auto rounded-md bg-ivory-100 p-3 text-xs text-charcoal-900">
              {license.licenseKey}
            </pre>
            <button
              type="button"
              onClick={() => void copyKey()}
              className="mt-4 rounded-md bg-forest-700 px-3.5 py-2 text-sm font-medium text-ivory-50 transition hover:bg-forest-600"
            >
              {copied ? 'Copied' : 'Copy license key'}
            </button>
          </div>
        ) : error ? (
          <p className="mt-8 text-sm text-red-800">{error}</p>
        ) : (
          <p className="mt-8 text-sm text-warm-500">Preparing your license key…</p>
        )}

        <p className="mt-10 text-sm text-warm-500">
          <a href="/" className="underline decoration-warm-300 underline-offset-4 hover:text-forest-700">
            Back to Everkeep
          </a>
        </p>
      </div>
    </div>
  )
}

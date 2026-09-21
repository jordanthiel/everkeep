/**
 * Checkout / license API configuration for the marketing site.
 * Override via .env:
 *   VITE_STRIPE_PAYMENT_LINK=https://buy.stripe.com/...
 *   VITE_LICENSE_API_URL=https://license-worker.example.com
 */
export const checkout = {
  paymentLink:
    import.meta.env.VITE_STRIPE_PAYMENT_LINK?.trim() ||
    'https://buy.stripe.com/test_everkeep_lifetime',
  licenseApiUrl: import.meta.env.VITE_LICENSE_API_URL?.trim() || '',
  lifetimePriceUsd: 79,
  freeEntryCap: 15,
  freeAttachmentCap: 5
} as const

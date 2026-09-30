/**
 * Checkout configuration for the marketing site.
 * Override via .env:
 *   VITE_STRIPE_PAYMENT_LINK=https://buy.stripe.com/...
 */
export const checkout = {
  paymentLink:
    import.meta.env.VITE_STRIPE_PAYMENT_LINK?.trim() ||
    'https://buy.stripe.com/test_everkeep_lifetime',
  lifetimePriceUsd: 79,
  freeEntryCap: 15,
  freeAttachmentCap: 5
} as const

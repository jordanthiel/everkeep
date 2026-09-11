/**
 * One-time pricing for Everkeep.
 * Override via .env:
 *   VITE_PRODUCT_PRICE=79
 *   VITE_STRIPE_PAYMENT_LINK=https://buy.stripe.com/...
 */
export const pricing = {
  price: Number(import.meta.env.VITE_PRODUCT_PRICE?.trim() || '79'),
  currency: 'USD',
  /** Stripe Payment Link (test or live). Empty string = buy buttons hidden until configured. */
  paymentLink: import.meta.env.VITE_STRIPE_PAYMENT_LINK?.trim() || '',
  guaranteeDays: 30
} as const

export function formatPrice(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(value)
}

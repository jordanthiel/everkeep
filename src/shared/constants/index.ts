export const APP_NAME = 'Everkeep'
export const GITHUB_OWNER = 'jordanthiel'
export const GITHUB_REPO = 'everkeep'
export const RELEASES_LATEST_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`
export const VAULT_EXTENSION = '.everkeep'
export const VAULT_FILE_FILTER: { name: string; extensions: string[] } = {
  name: 'Everkeep Vault',
  extensions: ['everkeep']
}

export const SCHEMA_VERSION = 1

export const DEFAULT_VAULT_DIR_NAME = 'Everkeep'

export const AUTOSAVE_DEBOUNCE_MS = 500

export const NAV_SECTIONS = [
  { id: 'home', label: 'Home', path: '/' },
  { id: 'people', label: 'Contacts', path: '/people' },
  { id: 'dependents', label: 'Children, Dependents & Pets', path: '/dependents' },
  { id: 'debts', label: 'Bills & Debts', path: '/debts' },
  { id: 'identity', label: 'Identity', path: '/identity' },
  { id: 'legal', label: 'Legal & Estate', path: '/legal' },
  { id: 'financial', label: 'Financial', path: '/financial' },
  { id: 'insurance', label: 'Insurance', path: '/insurance' },
  { id: 'property', label: 'Property', path: '/property' },
  { id: 'income', label: 'Income & Employment', path: '/income' },
  { id: 'taxes', label: 'Taxes', path: '/taxes' },
  { id: 'healthcare', label: 'Healthcare', path: '/healthcare' },
  { id: 'digital', label: 'Digital Life', path: '/digital' },
  { id: 'household', label: 'Household', path: '/household' },
  { id: 'personal-property', label: 'Personal Property', path: '/personal-property' },
  { id: 'final-wishes', label: 'Final Wishes', path: '/final-wishes' },
  { id: 'letters', label: 'Letters & Instructions', path: '/letters' },
  { id: 'documents', label: 'Documents', path: '/documents' }
] as const

export const NAV_FOOTER = [
  { id: 'review', label: 'Review', path: '/review' },
  { id: 'export', label: 'Export', path: '/export' },
  { id: 'settings', label: 'Settings', path: '/settings' }
] as const

export const LEGAL_DISCLAIMER =
  'Everkeep helps you organize and communicate information. It does not create a will, trust, power of attorney, beneficiary designation, or other legally binding estate-planning document and does not provide legal, tax, or financial advice.'

/** Freemium caps for unpaid installs. */
export const FREE_ENTRY_CAP = 15
export const FREE_ATTACHMENT_CAP = 5

/** One-time Lifetime price shown in-app (actual charge is set on the Stripe Payment Link). */
export const LIFETIME_PRICE_USD = 79

/**
 * Stripe Payment Link for Everkeep Lifetime.
 * Override with STRIPE_PAYMENT_LINK_URL at build/runtime for production.
 */
export const STRIPE_PAYMENT_LINK_URL =
  (typeof process !== 'undefined' && process.env?.STRIPE_PAYMENT_LINK_URL?.trim()) ||
  'https://buy.stripe.com/test_everkeep_lifetime'

export const LICENSE_FILENAME = 'license.ekey'

/**
 * Ed25519 public key (base64url) used to verify license.ekey offline.
 * Default is the committed development keypair; set LICENSE_PUBLIC_KEY for production.
 */
export const LICENSE_PUBLIC_KEY =
  (typeof process !== 'undefined' && process.env?.LICENSE_PUBLIC_KEY?.trim()) ||
  'AUngg7JkqeUea4pBQ8-KWHo8f_LQepmGibMSHaF2jkc'

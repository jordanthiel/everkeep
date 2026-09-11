export const LICENSE_PRODUCT_ID = 'everkeep-household'

export interface LicensePayload {
  v: 1
  product: typeof LICENSE_PRODUCT_ID
  /** Purchaser email the key was issued to. */
  email: string
  /** Issued-at, unix seconds. */
  iat: number
}

export type LicenseState =
  | { state: 'trial' }
  | { state: 'licensed'; email: string; activatedAt: string }

export interface ActivateLicenseInput {
  key: string
}

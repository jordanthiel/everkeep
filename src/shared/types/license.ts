export type LicenseProduct = 'lifetime' | 'family'

export type LicenseEntitlement = 'free' | 'lifetime' | 'family'

export interface LicenseClaims {
  v: 1
  email: string
  product: LicenseProduct
  seats: number
  issuedAt: string
  orderId: string
}

export interface LicenseStatus {
  entitlement: LicenseEntitlement
  activated: boolean
  email: string | null
  seats: number | null
  issuedAt: string | null
  orderId: string | null
  entryCap: number | null
  attachmentCap: number | null
  lifetimePriceUsd: number
}

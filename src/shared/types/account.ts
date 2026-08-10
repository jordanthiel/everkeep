import type { BaseEntity } from './base'

export type AccountType =
  | 'checking'
  | 'savings'
  | 'money_market'
  | 'cd'
  | 'brokerage'
  | 'ira'
  | 'roth_ira'
  | '401k'
  | '403b'
  | 'pension'
  | 'hsa'
  | '529'
  | 'annuity'
  | 'treasury'
  | 'crypto'
  | 'other'

export type BeneficiaryDesignationType = 'primary' | 'contingent'

export interface BeneficiaryDesignation {
  id: string
  accountId: string
  personId: string
  personName?: string
  designationType: BeneficiaryDesignationType
  percentage: number
  perStirpes: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface Account extends BaseEntity {
  institution: string
  accountName: string | null
  accountType: AccountType
  lastFour: string | null
  fullAccountNumber: string | null
  approximateValue: number | null
  transferOnDeath: boolean
  contactInfo: string | null
  website: string | null
  ownerPersonIds: string[]
  beneficiaries: BeneficiaryDesignation[]
}

export interface CreateAccountInput {
  institution: string
  accountName?: string | null
  accountType: AccountType
  lastFour?: string | null
  fullAccountNumber?: string | null
  approximateValue?: number | null
  transferOnDeath?: boolean
  contactInfo?: string | null
  website?: string | null
  notes?: string | null
  ownerPersonIds?: string[]
  beneficiaries?: Array<{
    personId: string
    designationType: BeneficiaryDesignationType
    percentage: number
    perStirpes?: boolean
    notes?: string | null
  }>
}

export interface UpdateAccountInput {
  id: string
  institution?: string
  accountName?: string | null
  accountType?: AccountType
  lastFour?: string | null
  fullAccountNumber?: string | null
  approximateValue?: number | null
  transferOnDeath?: boolean
  contactInfo?: string | null
  website?: string | null
  notes?: string | null
  lastReviewedAt?: string | null
  ownerPersonIds?: string[]
  beneficiaries?: Array<{
    personId: string
    designationType: BeneficiaryDesignationType
    percentage: number
    perStirpes?: boolean
    notes?: string | null
  }>
}

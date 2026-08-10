import type { BaseEntity } from './base'

export type DigitalCategory =
  | 'password_manager'
  | 'email'
  | 'apple_google_microsoft'
  | 'social'
  | 'domain'
  | 'cloud'
  | 'crypto'
  | 'other'

export interface DigitalAccount extends BaseEntity {
  category: DigitalCategory
  provider: string | null
  accountIdentifier: string | null
  url: string | null
  instructions: string | null
  preference: string | null
}

export interface CreateDigitalAccountInput {
  category: DigitalCategory
  provider?: string | null
  accountIdentifier?: string | null
  url?: string | null
  instructions?: string | null
  preference?: string | null
  notes?: string | null
}

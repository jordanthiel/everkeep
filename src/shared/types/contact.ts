import type { BaseEntity } from './base'

export type ContactRole =
  | 'estate_attorney'
  | 'cpa'
  | 'financial_advisor'
  | 'insurance_agent'
  | 'banker'
  | 'employer_hr'
  | 'doctor'
  | 'funeral_home'
  | 'property_manager'
  | 'business_partner'
  | 'clergy'
  | 'other'

export interface Contact extends BaseEntity {
  name: string
  company: string | null
  role: ContactRole | null
  phone: string | null
  email: string | null
  address: string | null
  website: string | null
}

export interface CreateContactInput {
  name: string
  company?: string | null
  role?: ContactRole | null
  phone?: string | null
  email?: string | null
  address?: string | null
  website?: string | null
  notes?: string | null
}

export interface UpdateContactInput {
  id: string
  name?: string
  company?: string | null
  role?: ContactRole | null
  phone?: string | null
  email?: string | null
  address?: string | null
  website?: string | null
  notes?: string | null
  lastReviewedAt?: string | null
}

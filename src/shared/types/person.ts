import type { BaseEntity } from './base'

export type PersonRelationship =
  | 'self'
  | 'spouse'
  | 'partner'
  | 'child'
  | 'parent'
  | 'sibling'
  | 'friend'
  | 'other'

export const PERSON_RELATIONSHIP_OPTIONS: Array<{ value: PersonRelationship; label: string }> = [
  { value: 'self', label: 'Self' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'partner', label: 'Partner' },
  { value: 'child', label: 'Child' },
  { value: 'parent', label: 'Parent' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'friend', label: 'Friend' },
  { value: 'other', label: 'Other' }
]

export type PersonRole =
  | 'executor'
  | 'trustee'
  | 'beneficiary'
  | 'attorney'
  | 'advisor'
  | 'healthcare_proxy'
  | 'power_of_attorney'
  | 'emergency_contact'
  | 'guardian'
  | 'cpa'
  | 'insurance_agent'
  | 'banker'
  | 'employer_hr'
  | 'doctor'
  | 'funeral_home'
  | 'property_manager'
  | 'business_partner'
  | 'clergy'
  | 'other'

export const PERSON_ROLE_OPTIONS: Array<{ value: PersonRole; label: string }> = [
  { value: 'executor', label: 'Executor' },
  { value: 'trustee', label: 'Trustee' },
  { value: 'beneficiary', label: 'Beneficiary' },
  { value: 'attorney', label: 'Attorney' },
  { value: 'advisor', label: 'Advisor' },
  { value: 'healthcare_proxy', label: 'Healthcare proxy' },
  { value: 'power_of_attorney', label: 'Power of attorney' },
  { value: 'emergency_contact', label: 'Emergency contact' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'cpa', label: 'CPA' },
  { value: 'insurance_agent', label: 'Insurance agent' },
  { value: 'banker', label: 'Banker' },
  { value: 'employer_hr', label: 'Employer HR' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'funeral_home', label: 'Funeral home' },
  { value: 'property_manager', label: 'Property manager' },
  { value: 'business_partner', label: 'Business partner' },
  { value: 'clergy', label: 'Clergy' },
  { value: 'other', label: 'Other' }
]

export interface Person extends BaseEntity {
  fullName: string
  relationship: PersonRelationship | null
  dateOfBirth: string | null
  phone: string | null
  email: string | null
  address: string | null
  company: string | null
  website: string | null
  roles: PersonRole[]
}

export interface CreatePersonInput {
  fullName: string
  relationship?: PersonRelationship | null
  dateOfBirth?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  company?: string | null
  website?: string | null
  notes?: string | null
  roles?: PersonRole[]
}

export interface UpdatePersonInput {
  id: string
  fullName?: string
  relationship?: PersonRelationship | null
  dateOfBirth?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  company?: string | null
  website?: string | null
  notes?: string | null
  roles?: PersonRole[]
  lastReviewedAt?: string | null
}

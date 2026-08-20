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
  | 'other'

export interface Person extends BaseEntity {
  fullName: string
  relationship: PersonRelationship | null
  dateOfBirth: string | null
  phone: string | null
  email: string | null
  address: string | null
  roles: PersonRole[]
}

export interface CreatePersonInput {
  fullName: string
  relationship?: PersonRelationship | null
  dateOfBirth?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
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
  notes?: string | null
  roles?: PersonRole[]
  lastReviewedAt?: string | null
}

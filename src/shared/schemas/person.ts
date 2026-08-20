import { z } from 'zod'

export const PersonRelationshipSchema = z.enum([
  'self',
  'spouse',
  'partner',
  'child',
  'parent',
  'sibling',
  'friend',
  'other'
])

export const PersonRoleSchema = z.enum([
  'executor',
  'trustee',
  'beneficiary',
  'attorney',
  'advisor',
  'healthcare_proxy',
  'power_of_attorney',
  'emergency_contact',
  'guardian',
  'other'
])

export const CreatePersonSchema = z.object({
  fullName: z.string().min(1).max(200),
  relationship: PersonRelationshipSchema.nullable().optional(),
  dateOfBirth: z.string().max(32).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().max(200).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  notes: z.string().max(10000).nullable().optional(),
  roles: z.array(PersonRoleSchema).optional()
})

export const UpdatePersonSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().min(1).max(200).optional(),
  relationship: PersonRelationshipSchema.nullable().optional(),
  dateOfBirth: z.string().max(32).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().max(200).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  notes: z.string().max(10000).nullable().optional(),
  roles: z.array(PersonRoleSchema).optional(),
  lastReviewedAt: z.string().nullable().optional()
})

export const PersonIdSchema = z.object({
  id: z.string().uuid()
})

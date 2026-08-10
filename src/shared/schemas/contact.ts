import { z } from 'zod'

export const ContactRoleSchema = z.enum([
  'estate_attorney',
  'cpa',
  'financial_advisor',
  'insurance_agent',
  'banker',
  'employer_hr',
  'doctor',
  'funeral_home',
  'property_manager',
  'business_partner',
  'clergy',
  'other'
])

export const CreateContactSchema = z.object({
  name: z.string().min(1).max(200),
  company: z.string().max(200).nullable().optional(),
  role: ContactRoleSchema.nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().max(200).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  website: z.string().max(300).nullable().optional(),
  notes: z.string().max(10000).nullable().optional()
})

export const UpdateContactSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  company: z.string().max(200).nullable().optional(),
  role: ContactRoleSchema.nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().max(200).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  website: z.string().max(300).nullable().optional(),
  notes: z.string().max(10000).nullable().optional(),
  lastReviewedAt: z.string().nullable().optional()
})

export const ContactIdSchema = z.object({
  id: z.string().uuid()
})

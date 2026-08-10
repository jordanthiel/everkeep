import { z } from 'zod'

export const AccountTypeSchema = z.enum([
  'checking',
  'savings',
  'money_market',
  'cd',
  'brokerage',
  'ira',
  'roth_ira',
  '401k',
  '403b',
  'pension',
  'hsa',
  '529',
  'annuity',
  'treasury',
  'crypto',
  'other'
])

export const BeneficiaryDesignationTypeSchema = z.enum(['primary', 'contingent'])

const BeneficiaryInputSchema = z.object({
  personId: z.string().uuid(),
  designationType: BeneficiaryDesignationTypeSchema,
  percentage: z.number().min(0).max(100),
  perStirpes: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional()
})

export const CreateAccountSchema = z.object({
  institution: z.string().min(1).max(200),
  accountName: z.string().max(200).nullable().optional(),
  accountType: AccountTypeSchema,
  lastFour: z.string().max(4).nullable().optional(),
  fullAccountNumber: z.string().max(64).nullable().optional(),
  approximateValue: z.number().nonnegative().nullable().optional(),
  transferOnDeath: z.boolean().optional(),
  contactInfo: z.string().max(500).nullable().optional(),
  website: z.string().max(300).nullable().optional(),
  notes: z.string().max(10000).nullable().optional(),
  ownerPersonIds: z.array(z.string().uuid()).optional(),
  beneficiaries: z.array(BeneficiaryInputSchema).optional()
})

export const UpdateAccountSchema = z.object({
  id: z.string().uuid(),
  institution: z.string().min(1).max(200).optional(),
  accountName: z.string().max(200).nullable().optional(),
  accountType: AccountTypeSchema.optional(),
  lastFour: z.string().max(4).nullable().optional(),
  fullAccountNumber: z.string().max(64).nullable().optional(),
  approximateValue: z.number().nonnegative().nullable().optional(),
  transferOnDeath: z.boolean().optional(),
  contactInfo: z.string().max(500).nullable().optional(),
  website: z.string().max(300).nullable().optional(),
  notes: z.string().max(10000).nullable().optional(),
  lastReviewedAt: z.string().nullable().optional(),
  ownerPersonIds: z.array(z.string().uuid()).optional(),
  beneficiaries: z.array(BeneficiaryInputSchema).optional()
})

export const AccountIdSchema = z.object({
  id: z.string().uuid()
})

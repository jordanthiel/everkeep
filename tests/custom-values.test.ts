import { describe, expect, it } from 'vitest'
import { CreateAccountSchema, UpdateAccountSchema } from '../src/shared/schemas/account'
import { CreatePersonSchema, UpdatePersonSchema } from '../src/shared/schemas/person'
import { CreateVaultEntrySchema } from '../src/shared/schemas/entry'
import { getSectionDefinition, getVisibleFields, kindLabelFor } from '../src/shared/sections/definitions'

const id = '00000000-0000-4000-8000-000000000001'

describe('custom section values', () => {
  it('accepts custom account types, relationships, and assignments on create and update', () => {
    const account = { institution: 'Local bank', accountType: 'Employee share plan' }
    expect(CreateAccountSchema.parse(account).accountType).toBe(account.accountType)
    expect(UpdateAccountSchema.parse({ id, ...account }).accountType).toBe(account.accountType)
    const person = { fullName: 'Alex', relationship: 'Cousin', roles: ['Family coordinator'] }
    expect(CreatePersonSchema.parse(person)).toMatchObject(person)
    expect(UpdatePersonSchema.parse({ id, ...person })).toMatchObject(person)
    expect(CreatePersonSchema.safeParse({ ...person, relationship: ' ' }).success).toBe(false)
  })

  it('keeps the Other document fields and custom type label when reopening a record', () => {
    const def = getSectionDefinition('identity')
    const entry = CreateVaultEntrySchema.parse({ section: 'identity', kind: 'Residency permit', title: 'Alex’s permit', fields: { issuingAuthority: 'County office' } })
    expect(kindLabelFor(def, entry.kind)).toBe('Residency permit')
    expect(getVisibleFields(def, entry.kind!)).toEqual(getVisibleFields(def, 'other'))
  })
})

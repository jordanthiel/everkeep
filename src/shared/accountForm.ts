import type { RecordLoginInput } from './types/recordLogin'
import type { Account, AccountType, BeneficiaryDesignationType } from '@shared/types/account'
export interface BeneficiaryForm { personId: string; designationType: BeneficiaryDesignationType; percentage: number; perStirpes: boolean; notes: string }
export function emptyAccountForm() {
  return { login: null as RecordLoginInput | null, institution: '', accountName: '', accountType: 'checking' as AccountType, lastFour: '', fullAccountNumber: '', ownerPersonIds: [] as string[], beneficiaries: [] as BeneficiaryForm[], notes: '' }
}
export function accountToForm(account: Account): ReturnType<typeof emptyAccountForm> {
  return { login: account.login ?? null, institution: account.institution, accountName: account.accountName ?? '', accountType: account.accountType, lastFour: account.lastFour ?? '', fullAccountNumber: account.fullAccountNumber ?? '', ownerPersonIds: [...account.ownerPersonIds], notes: account.notes ?? '', beneficiaries: account.beneficiaries.map((b) => ({ personId: b.personId, designationType: b.designationType, percentage: b.percentage, perStirpes: b.perStirpes, notes: b.notes ?? '' })) }
}

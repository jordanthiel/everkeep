export interface FamilyHandoff {
  welcomeMessage: string
  welcomeSignature: string
  featuredLetterId: string
  primaryContactId: string
  alternateContactId: string
  careInstructions: string
  incapacityInstructions: string
  deathInstructions: string
  documentsLocation: string
  vaultLocation: string
  backupLocation: string
  passwordInstructions: string
  sharedWith: string
  handoffTestedAt: string
  lastBackupAt: string
  lastBackupVerifiedAt: string
  verifiedBackupPath: string
}
export const EMPTY_HANDOFF: FamilyHandoff = {
  welcomeMessage: '', welcomeSignature: '', featuredLetterId: '',
  primaryContactId: '', alternateContactId: '', careInstructions: '', incapacityInstructions: '',
  deathInstructions: '', documentsLocation: '', vaultLocation: '', backupLocation: '', passwordInstructions: '',
  sharedWith: '', handoffTestedAt: '', lastBackupAt: '', lastBackupVerifiedAt: '', verifiedBackupPath: ''
}
export type HandoffInput = Omit<FamilyHandoff, 'lastBackupAt' | 'lastBackupVerifiedAt' | 'verifiedBackupPath'>
export interface BackupCheck { vaultName: string; attachmentCount: number; checkedAt: string; matchesCurrentVault: boolean }

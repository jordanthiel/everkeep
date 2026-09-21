import type { ExportSelection } from './entry'
import type { PacketPreset } from '../sections/exportPresets'

export interface PacketIntroduction {
  careInstructions: string
  incapacityInstructions: string
  deathInstructions: string
  documentsLocation: string
  vaultLocation: string
  backupLocation: string
  passwordInstructions: string
  helpers: Array<{ personId: string; help: string }>
}
export interface PacketDraft {
  version: 1
  step: number
  preset: PacketPreset
  recipientMode: 'contact' | 'named' | 'general'
  recipientContactId: string
  recipientName: string
  scenario: 'incapacity' | 'death' | 'both'
  selection: ExportSelection
  includeStartHere: boolean
  includeAccessPlan: boolean
  includePrivateLetters: boolean
  includeSensitive: boolean
  introduction: PacketIntroduction
  latestExport: { path: string; savedAt: string; recipient: string; signature: string; deliveredAt: string } | null
}

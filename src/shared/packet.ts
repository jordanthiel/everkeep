import type { PacketDraft } from './types/packet'
import type { FamilyHandoff } from './types/handoff'
import type { ExportCatalog, ExportOptions } from './types/entry'
import type { Person } from './types/person'
import { presetSelection, type PacketPreset } from './sections/exportPresets'

export function createPacketDraft(plan: FamilyHandoff, catalog: ExportCatalog, preset: PacketPreset = 'start', scenario: PacketDraft['scenario'] = 'both'): PacketDraft {
  return {
    version: 1, step: 0, preset, scenario, recipientMode: 'contact', recipientContactId: '', recipientName: '',
    selection: presetSelection(catalog, preset), includeStartHere: true, includeAccessPlan: false,
    includePrivateLetters: false, includeSensitive: false, latestExport: null,
    introduction: {
      careInstructions: plan.careInstructions, incapacityInstructions: plan.incapacityInstructions, deathInstructions: plan.deathInstructions,
      documentsLocation: plan.documentsLocation, vaultLocation: plan.vaultLocation, backupLocation: plan.backupLocation, passwordInstructions: plan.passwordInstructions,
      helpers: [...new Set([plan.primaryContactId, plan.alternateContactId].filter(Boolean))].map(personId => ({ personId, help: '' }))
    }
  }
}
export function packetRecipient(draft: PacketDraft, people: Person[]): string {
  if (draft.recipientMode === 'general') return 'General copy'
  if (draft.recipientMode === 'named') return draft.recipientName.trim()
  return people.find(person => person.id === draft.recipientContactId)?.fullName ?? ''
}
export function packetOptions(draft: PacketDraft, people: Person[], paid: boolean): ExportOptions {
  return {
    selection: draft.selection, recipient: packetRecipient(draft, people),
    recipientContactId: draft.recipientMode === 'contact' ? draft.recipientContactId || undefined : undefined,
    scenario: draft.scenario, introduction: draft.introduction,
    includeStartHere: draft.includeStartHere, includeAccessPlan: draft.includeStartHere && draft.includeAccessPlan,
    includePrivateLetters: draft.includePrivateLetters, includeSensitive: paid && draft.includeSensitive
  }
}
export function reconcilePacket(draft: PacketDraft, catalog: ExportCatalog): { draft: PacketDraft; removed: number } {
  let removed = 0
  const selection = { ...draft.selection }
  for (const group of ['people', 'accounts', 'entries'] as const) {
    const allowed = new Set(catalog[group].filter(item => !item.private || draft.includePrivateLetters).map(item => item.id))
    selection[group] = selection[group].filter(id => { if (allowed.has(id)) return true; removed++; return false })
  }
  return { draft: removed ? { ...draft, selection } : draft, removed }
}
export function packetHasContent(options: ExportOptions, people: Person[]): boolean {
  if (options.selection && Object.values(options.selection).some(ids => ids.length)) return true
  if (!options.includeStartHere || !options.introduction) return false
  const intro = options.introduction
  return Boolean(intro.careInstructions.trim() || intro.documentsLocation.trim() ||
    (options.scenario !== 'death' && intro.incapacityInstructions.trim()) ||
    (options.scenario !== 'incapacity' && intro.deathInstructions.trim()) ||
    intro.helpers.some(helper => helper.personId !== options.recipientContactId && people.some(person => person.id === helper.personId)) ||
    (options.includeAccessPlan && [intro.vaultLocation, intro.backupLocation, intro.passwordInstructions].some(value => value.trim())))
}

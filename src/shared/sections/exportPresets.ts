import type { ExportCatalog, ExportSelection } from '../types/entry'
export type PacketPreset = 'start' | 'caregiver' | 'executor' | 'spouse' | 'custom'
export function presetSelection(catalog: ExportCatalog, preset: PacketPreset): ExportSelection {
  const sections = preset === 'caregiver' ? ['healthcare', 'dependents'] : preset === 'executor' ? ['legal', 'debts', 'insurance', 'property', 'income', 'taxes', 'digital', 'household', 'personal-property', 'final-wishes', 'documents'] : []
  return {
    people: ['executor', 'spouse'].includes(preset) ? catalog.people.map((p) => p.id) : [],
    accounts: ['executor', 'spouse'].includes(preset) ? catalog.accounts.map((a) => a.id) : [],
    entries: catalog.entries.filter((e) => !e.private && (preset === 'spouse' || sections.includes(e.section))).map((e) => e.id)
  }
}

import { packetHasContent } from '../../shared/packet'
import { writeFileSync } from 'fs'
import type { VaultDatabase } from '../database/connection'
import type { EncryptionService } from '../security/EncryptionService'
import { EntryRepository } from '../repositories/EntryRepository'
import { PersonRepository } from '../repositories/PersonRepository'
import { AccountRepository } from '../repositories/AccountRepository'
import { HandoffRepository } from '../repositories/HandoffRepository'
import { SECTION_DEFINITIONS } from '../../shared/sections/definitions'
import { resolvePersonNames } from '../../shared/people'
import type { VaultMetadata } from '../../shared/types/vault'
import type { ExportCatalog, ExportOptions, ExportReportInput } from '../../shared/types/entry'

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
function field(label: string, value: unknown): string {
  return value ? `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>` : ''
}

export class ExportService {
  constructor(private readonly db: VaultDatabase, private readonly encryption: EncryptionService | null, private readonly key: Buffer | null) {}

  catalog(): ExportCatalog {
    return {
      people: new PersonRepository(this.db).list().map((p) => ({ id: p.id, title: p.fullName, section: 'Contacts', private: false })),
      accounts: new AccountRepository(this.db, this.encryption, this.key).list().map((a) => ({ id: a.id, title: a.accountName || a.institution, section: 'Financial', private: false })),
      entries: new EntryRepository(this.db, this.encryption, this.key).listAll().map((e) => ({ id: e.id, title: e.title, section: e.section, private: e.section === 'letters' && e.fields.privateFlag !== 'no' }))
    }
  }

  writeReport(metadata: VaultMetadata, input: ExportReportInput, options: { watermark?: boolean } = {}): { path: string } {
    writeFileSync(input.destinationPath, this.buildHtml(metadata, input, Boolean(options.watermark)), { encoding: 'utf8', mode: 0o600 })
    return { path: input.destinationPath }
  }

  buildHtml(metadata: VaultMetadata, input: ExportOptions, watermark = false): string {
    const allPeople = new PersonRepository(this.db).list()
    const people = allPeople.filter((p) => !input.selection || input.selection.people.includes(p.id))
    const accounts = new AccountRepository(this.db, this.encryption, this.key).list().filter((a) => !input.selection || input.selection.accounts.includes(a.id))
    const entries = new EntryRepository(this.db, this.encryption, this.key).listAll().filter((e) =>
      (!input.selection || input.selection.entries.includes(e.id)) &&
      (!input.sections || input.sections.includes(e.section)) &&
      (e.section !== 'letters' || e.fields.privateFlag === 'no' || (input.includePrivateLetters && Boolean(input.selection?.entries.includes(e.id))))
    )
    const includeSensitive = Boolean(input.includeSensitive) && !watermark
    const parts = [`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Everkeep — ${escapeHtml(metadata.name)}</title>
      <style>body{font-family:system-ui,sans-serif;color:#242823;max-width:820px;margin:32px auto;padding:0 24px;line-height:1.6}h1{font-size:28px}h2{font-size:21px;border-bottom:1px solid #ddd;padding-bottom:6px;margin-top:30px}h3{margin:0 0 8px}.meta,dt{color:#62685e;font-size:13px}.card{border:1px solid #ddd;padding:16px;margin:12px 0;border-radius:8px;break-inside:avoid}dd{margin:0 0 10px;white-space:pre-wrap;overflow-wrap:anywhere}.warn{padding:12px;background:#f5f2e9;border:1px solid #ddd}@media print{body{margin:0;max-width:none}h2,h3{break-after:avoid}.warn{background:none}}</style></head><body>
      <h1>${escapeHtml(metadata.name)}</h1><p class="meta">Prepared ${escapeHtml(new Date().toLocaleString())}${input.recipient ? ` · For ${escapeHtml(input.recipient)}` : ''}</p>
      <p class="warn">This report is an unencrypted copy. Give it only to the intended recipient and store it securely. Attached files are not included; use an Everkeep backup for a complete vault copy.</p>`]
    if (watermark) parts.push('<p class="meta">Created with Everkeep Free</p>')
    if (input.introduction) {
      if (input.recipientContactId && !allPeople.some(person => person.id === input.recipientContactId)) throw new Error('The recipient is no longer available. Choose a recipient again.')
      if (input.includeStartHere && input.introduction.helpers.some(helper => !allPeople.some(person => person.id === helper.personId))) throw new Error('A supporting contact is no longer available. Update the introduction.')
      const effective = { ...input, selection: { people: people.map(p => p.id), accounts: accounts.map(a => a.id), entries: entries.map(e => e.id) } }
      if (!packetHasContent(effective, allPeople)) throw new Error('Add some information before previewing this packet.')
    }
    if (input.includeStartHere) {
      const plan = new HandoffRepository(this.db).get()
      const intro = input.introduction ?? { ...plan, helpers: [...new Set([plan.primaryContactId, plan.alternateContactId].filter(Boolean))].map(personId => ({ personId, help: '' })) }
      const blocks: string[] = []
      function section(title: string, value: string) {
        if (value.trim()) blocks.push(`<h3>${escapeHtml(title)}</h3><p style="white-space:pre-wrap">${escapeHtml(value)}</p>`)
      }
      section('Immediate priorities', intro.careInstructions)
      if (input.scenario !== 'death') section('If I cannot help', intro.incapacityInstructions)
      if (input.scenario === 'death' || input.scenario === 'both') section('After my death', intro.deathInstructions)
      const helpers = intro.helpers.filter(helper => helper.personId !== input.recipientContactId).flatMap(helper => {
        const person = allPeople.find(person => person.id === helper.personId)
        return person ? [`<div class="card"><h3>${escapeHtml(person.fullName)}</h3><dl>${field('Phone', person.phone)}${field('Email', person.email)}${field('How they can help', helper.help)}</dl></div>`] : []
      })
      if (helpers.length) blocks.push('<h3>Other people who can help</h3>', ...helpers)
      section('Original documents', intro.documentsLocation)
      if (input.includeAccessPlan) {
        section('Find the vault', intro.vaultLocation)
        section('Find the backup', intro.backupLocation)
        section('How an authorized person can obtain access', intro.passwordInstructions)
      }
      if (blocks.length) parts.push(`<h2>Start here — ${input.scenario === 'both' ? 'if I cannot help or after my death' : input.scenario === 'death' ? 'after my death' : 'if I cannot help right now'}</h2>`, ...blocks)
    }
    if (people.length || !input.selection) {
      parts.push('<h2>Contacts</h2>')
      for (const person of people) parts.push(`<div class="card"><h3>${escapeHtml(person.fullName)}</h3><dl>${field('Relationship', person.relationship)}${field('Assignments', person.roles.join(', ').replace(/_/g, ' '))}${field('Company', person.company)}${field('Phone', person.phone)}${field('Email', person.email)}${field('Address', person.address)}${field('Notes', person.notes)}</dl></div>`)
    }
    if (accounts.length || !input.selection) {
      parts.push('<h2>Financial</h2>')
      for (const account of accounts) {
        parts.push(`<div class="card"><h3>${escapeHtml(account.accountName || account.institution)}</h3><dl>${field('Institution', account.institution)}${field('Account type', account.accountType)}${field('Last four digits', account.lastFour)}${field('Owners', resolvePersonNames(account.ownerPersonIds.join(','), allPeople))}${field('Transfer on death recorded', account.transferOnDeath ? 'Yes' : '')}${field('Institution contact', account.contactInfo)}${field('Website', account.website)}${field('Notes', account.notes)}`)
        for (const beneficiary of account.beneficiaries) parts.push(field(`${beneficiary.designationType === 'primary' ? 'Primary' : 'Contingent'} beneficiary`, `${beneficiary.personName ?? resolvePersonNames(beneficiary.personId, allPeople) ?? 'Contact unavailable'} — ${beneficiary.percentage}%${beneficiary.perStirpes ? ' · per stirpes recorded' : ''}${beneficiary.notes ? ` · ${beneficiary.notes}` : ''}`))
        if (includeSensitive) parts.push(field('Full account number', account.fullAccountNumber))
        parts.push('</dl><p class="meta">Recorded information only. Confirm current ownership and designations with the institution.</p></div>')
      }
    }
    for (const def of SECTION_DEFINITIONS) {
      const selected = entries.filter((e) => e.section === def.id)
      if (!selected.length) continue
      parts.push(`<h2>${escapeHtml(def.title)}</h2>`)
      for (const entry of selected) {
        parts.push(`<div class="card"><h3>${escapeHtml(entry.title)}</h3><dl>`)
        for (const [key, value] of Object.entries(entry.fields)) {
          if (key === 'privateFlag') continue
          const definition = def.fields.find((f) => f.key === key)
          const display = definition?.type === 'person' ? resolvePersonNames(value, allPeople) ?? value : definition?.options?.find((o) => o.value === value)?.label ?? value
          parts.push(field(definition?.label ?? key, display))
        }
        if (includeSensitive) for (const [key, value] of Object.entries(entry.sensitiveFields)) parts.push(field(def.fields.find((f) => f.key === key)?.label ?? key, value))
        parts.push(field('Location', entry.locationText), field('Notes', entry.notes), '</dl></div>')
      }
    }
    parts.push('<p class="meta">Everkeep records information and preferences. It does not create legal authority or replace signed legal documents. Consult the relevant professional about decisions and obligations.</p></body></html>')
    return parts.join('\n')
  }
}

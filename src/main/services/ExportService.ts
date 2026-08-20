import { writeFileSync } from 'fs'
import type { VaultDatabase } from '../database/connection'
import { EntryRepository } from '../repositories/EntryRepository'
import type { EncryptionService } from '../security/EncryptionService'
import { SECTION_DEFINITIONS } from '../../shared/sections/definitions'
import { PERSON_RELATIONSHIP_OPTIONS } from '../../shared/types/person'
import type { ExportReportInput, VaultSectionId } from '../../shared/types/entry'
import type { VaultMetadata } from '../../shared/types/vault'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export class ExportService {
  constructor(
    private readonly db: VaultDatabase,
    private readonly encryption: EncryptionService | null,
    private readonly key: Buffer | null
  ) {}

  writeReport(metadata: VaultMetadata, input: ExportReportInput): { path: string } {
    const includeSensitive = Boolean(input.includeSensitive)
    const sectionIds = input.sections ?? SECTION_DEFINITIONS.map((s) => s.id)
    const html = this.buildHtml(metadata, sectionIds, includeSensitive)
    writeFileSync(input.destinationPath, html, 'utf8')
    return { path: input.destinationPath }
  }

  private buildHtml(
    metadata: VaultMetadata,
    sectionIds: VaultSectionId[],
    includeSensitive: boolean
  ): string {
    const people = this.db
      .prepare(
        `SELECT id, full_name, relationship, phone, email, notes
         FROM people WHERE archived_at IS NULL ORDER BY full_name COLLATE NOCASE`
      )
      .all() as Array<{
      id: string
      full_name: string
      relationship: string | null
      phone: string | null
      email: string | null
      notes: string | null
    }>
    const peopleById = new Map(people.map((person) => [person.id, person.full_name]))

    const contacts = this.db
      .prepare(
        `SELECT name, company, role, phone, email
         FROM contacts WHERE archived_at IS NULL ORDER BY name COLLATE NOCASE`
      )
      .all() as Array<{
      name: string
      company: string | null
      role: string | null
      phone: string | null
      email: string | null
    }>

    const accounts = this.db
      .prepare(
        `SELECT institution, account_name, account_type, last_four, notes
         FROM accounts WHERE archived_at IS NULL ORDER BY institution COLLATE NOCASE`
      )
      .all() as Array<{
      institution: string
      account_name: string | null
      account_type: string
      last_four: string | null
      notes: string | null
    }>

    const entries = new EntryRepository(this.db, this.encryption, this.key).listAll()

    const parts: string[] = []
    parts.push(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Everkeep Report — ${escapeHtml(metadata.name)}</title>
  <style>
    body { font-family: Georgia, serif; color: #1c1a18; max-width: 820px; margin: 40px auto; padding: 0 24px; line-height: 1.5; }
    h1 { font-size: 28px; margin-bottom: 4px; }
    h2 { margin-top: 36px; border-bottom: 1px solid #d4ccc0; padding-bottom: 6px; }
    .meta { color: #7a7268; font-size: 14px; }
    .card { border: 1px solid #e5ddd2; border-radius: 8px; padding: 14px 16px; margin: 12px 0; }
    .label { color: #7a7268; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
    .warn { background: #f8f1e4; border: 1px solid #e5d3b3; padding: 12px 14px; border-radius: 8px; font-size: 14px; }
    dt { color: #7a7268; } dd { margin: 0 0 8px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(metadata.name)}</h1>
  <p class="meta">Everkeep Report · Generated ${escapeHtml(new Date().toLocaleString())}</p>
  <div class="warn">This report may contain extremely sensitive information. Store and share it carefully.</div>
`)

    parts.push(`<h2>People</h2>`)
    if (people.length === 0) parts.push('<p class="meta">None recorded.</p>')
    for (const person of people) {
      const relationship =
        PERSON_RELATIONSHIP_OPTIONS.find((item) => item.value === person.relationship)?.label ??
        person.relationship ??
        'No relationship'
      parts.push(`<div class="card"><strong>${escapeHtml(person.full_name)}</strong>
        <div class="meta">${escapeHtml(relationship)}</div>
        <div>${escapeHtml([person.phone, person.email].filter(Boolean).join(' · ') || 'No contact info')}</div>
      </div>`)
    }

    parts.push(`<h2>Important Contacts</h2>`)
    if (contacts.length === 0) parts.push('<p class="meta">None recorded.</p>')
    for (const contact of contacts) {
      parts.push(`<div class="card"><strong>${escapeHtml(contact.name)}</strong>
        <div class="meta">${escapeHtml([contact.role, contact.company].filter(Boolean).join(' · ') || 'Contact')}</div>
        <div>${escapeHtml([contact.phone, contact.email].filter(Boolean).join(' · ') || '')}</div>
      </div>`)
    }

    parts.push(`<h2>Financial</h2>`)
    if (accounts.length === 0) parts.push('<p class="meta">None recorded.</p>')
    for (const account of accounts) {
      parts.push(`<div class="card"><strong>${escapeHtml(account.account_name || account.institution)}</strong>
        <div class="meta">${escapeHtml(account.account_type)} · ${escapeHtml(account.institution)}${
          account.last_four ? ` · ****${escapeHtml(account.last_four)}` : ''
        }</div>
      </div>`)
    }

    for (const sectionId of sectionIds) {
      const def = SECTION_DEFINITIONS.find((s) => s.id === sectionId)
      if (!def) continue
      const sectionEntries = entries.filter((e) => e.section === sectionId)
      parts.push(`<h2>${escapeHtml(def.title)}</h2>`)
      if (sectionEntries.length === 0) {
        parts.push('<p class="meta">None recorded.</p>')
        continue
      }
      for (const entry of sectionEntries) {
        parts.push(`<div class="card"><strong>${escapeHtml(entry.title)}</strong>`)
        if (entry.kind) {
          const kindLabel = def.kinds?.find((item) => item.value === entry.kind)?.label ?? entry.kind
          parts.push(`<div class="meta">${escapeHtml(kindLabel)}</div>`)
        }
        parts.push('<dl>')
        for (const [key, value] of Object.entries(entry.fields)) {
          if (!value) continue
          const field = def.fields.find((f) => f.key === key)
          const label = field?.label ?? key
          const display =
            field?.type === 'person' ? (peopleById.get(value) ?? value) : value
          parts.push(`<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(display)}</dd>`)
        }
        if (includeSensitive) {
          for (const [key, value] of Object.entries(entry.sensitiveFields)) {
            if (!value) continue
            const label = def.fields.find((f) => f.key === key)?.label ?? key
            parts.push(`<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`)
          }
        }
        if (entry.locationText) {
          parts.push(`<dt>Location</dt><dd>${escapeHtml(entry.locationText)}</dd>`)
        }
        if (entry.notes) {
          parts.push(`<dt>Notes</dt><dd>${escapeHtml(entry.notes)}</dd>`)
        }
        parts.push('</dl></div>')
      }
    }

    parts.push(`<p class="meta" style="margin-top:48px">Everkeep helps you organize information. It does not create legally binding documents or provide legal advice.</p>`)
    parts.push('</body></html>')
    return parts.join('\n')
  }
}

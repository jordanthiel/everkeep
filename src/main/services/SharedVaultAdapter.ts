import { readFileSync } from 'fs'
import { createHash } from 'crypto'
import { withTransaction, type VaultDatabase } from '../database/connection'
import { PersonRepository } from '../repositories/PersonRepository'
import { AccountRepository } from '../repositories/AccountRepository'
import { EntryRepository } from '../repositories/EntryRepository'
import { HandoffRepository } from '../repositories/HandoffRepository'
import { VaultRepository } from '../repositories/VaultRepository'
import { AttachmentRepository } from '../repositories/AttachmentRepository'
import type { EncryptionService } from '../security/EncryptionService'
import { getSectionDefinition } from '../../shared/sections/definitions'
import { PERSON_RELATIONSHIP_OPTIONS, PERSON_ROLE_OPTIONS } from '../../shared/types/person'
import { UpdatePersonSchema, UpdateAccountSchema, UpdateVaultEntrySchema, AccountTypeSchema, HandoffSchema } from '../../shared/schemas'
import { recordContent, type SharedField, type SharedRecord, type SharedSnapshot } from '../../shared/sharing'

const field = (label: string, value: unknown, editable = true, maxLength = 20000): SharedField => ({ label, value: value == null ? '' : String(value), editable, maxLength })
export class SharedVaultAdapter {
  constructor(private readonly db: VaultDatabase, private readonly encryption: EncryptionService, private readonly key: Buffer | null) {}
  readAttachment(id: string): Buffer {
    const attachment = new AttachmentRepository(this.db).getById(id)
    if (!attachment) throw new Error('Attachment is no longer available.')
    const row = this.db.prepare('SELECT content FROM attachment_contents WHERE attachment_id=?').get(id) as { content: Buffer } | undefined
    return row?.content ?? readFileSync(attachment.storagePath)
  }
  snapshot(): SharedSnapshot {
    const metadata = new VaultRepository(this.db).getMetadata()!
    const people = new PersonRepository(this.db).list()
    const personName = (id: string) => people.find(person => person.id === id)?.fullName ?? 'Contact unavailable'
    const records: SharedRecord[] = people.map(person => ({
      id: person.id, kind: 'people', section: 'Contacts', title: person.fullName, version: 1, attachments: [],
      fields: {
        fullName: { ...field('Full name', person.fullName, true, 200), required: true }, relationship: { ...field('Relationship', person.relationship || 'other', true, 50), options: [...PERSON_RELATIONSHIP_OPTIONS] },
        dateOfBirth: field('Date of birth', person.dateOfBirth, true, 32), phone: field('Phone', person.phone, true, 50), email: field('Email', person.email, true, 200),
        address: field('Address', person.address, true, 500), company: field('Company', person.company, true, 200), website: field('Website', person.website, true, 300),
        roles: field('Responsibilities', person.roles.map(role => PERSON_ROLE_OPTIONS.find(option => option.value === role)?.label ?? role).join(', '), false), notes: field('Notes', person.notes, true, 10000)
      }
    }))
    for (const account of new AccountRepository(this.db, this.encryption, this.key).list()) {
      records.push({ id: account.id, kind: 'accounts', section: 'Financial', title: account.accountName || account.institution, version: 1, attachments: [], fields: {
        institution: { ...field('Institution', account.institution, true, 200), required: true }, accountName: field('Account name', account.accountName, true, 200),
        accountType: { ...field('Account type', account.accountType, true, 50), options: AccountTypeSchema.options.map(value => ({ value, label: value.replaceAll('_', ' ') })) },
        lastFour: field('Last four digits', account.lastFour, true, 4), fullAccountNumber: { ...field('Account number', account.fullAccountNumber, true, 64), sensitive: true },
        approximateValue: field('Approximate value', account.approximateValue, false), owners: field('Owners', account.ownerPersonIds.map(personName).join(', '), false),
        beneficiaries: field('Beneficiaries', account.beneficiaries.map(item => `${personName(item.personId)} · ${item.designationType} · ${item.percentage}%${item.perStirpes ? ' · per stirpes' : ''}${item.notes ? ` · ${item.notes}` : ''}`).join('\n'), false),
        transferOnDeath: field('Transfer on death recorded', account.transferOnDeath ? 'Yes' : 'No', false), contactInfo: field('Institution contact', account.contactInfo, true, 500), website: field('Website', account.website, true, 300), notes: field('Notes', account.notes, true, 10000)
      } })
    }
    for (const entry of new EntryRepository(this.db, this.encryption, this.key).listAll()) {
      const def = getSectionDefinition(entry.section)
      const fields: Record<string, SharedField> = { _title: { ...field('Record name', entry.title, true, 300), required: true } }
      for (const definition of def.fields) {
        const value = (definition.sensitive ? entry.sensitiveFields : entry.fields)[definition.key] ?? ''
        // Relationships are readable, but managed in the original structured editor.
        fields[definition.key] = { ...field(definition.label, definition.type === 'person' ? value.split(',').filter(Boolean).map(personName).join(', ') : value, definition.type !== 'person'), sensitive: definition.sensitive, ...(definition.options ? { options: [{ value: '', label: 'Not specified' }, ...definition.options] } : {}) }
      }
      for (const [key, value] of Object.entries(entry.fields)) if (!fields[key] && key !== 'privateFlag') fields[key] = field(key, value, false)
      fields._notes = field('Notes', entry.notes)
      fields._location = field('Location', entry.locationText, true, 1000)
      const attachments = new AttachmentRepository(this.db).listForEntry(entry.id).map(item => {
        const row = this.db.prepare('SELECT checksum FROM attachments WHERE id=?').get(item.id) as { checksum: string | null }
        return { id: item.id, name: item.filename, size: item.sizeBytes ?? 0, checksum: row.checksum ?? createHash('sha256').update(this.readAttachment(item.id)).digest('hex') }
      })
      records.push({ id: entry.id, kind: 'entries', section: def.title, title: entry.title, fields, version: 1, attachments })
    }
    const plan = new HandoffRepository(this.db).get()
    records.push({ id: metadata.id, kind: 'handoff', section: 'Instructions', title: 'Starting information and access instructions', version: 1, attachments: [], fields: {
      welcomeMessage: field('Welcome message', plan.welcomeMessage, false),
      welcomeSignature: field('Signature', plan.welcomeSignature, false, 200),
      featuredLetterId: field('Opening letter', plan.featuredLetterId, false, 36),
      primaryContactRef: field('Supporting contact reference', plan.primaryContactId, false, 36),
      alternateContactRef: field('Another supporting contact reference', plan.alternateContactId, false, 36),
      careInstructions: field('Immediate priorities', plan.careInstructions), incapacityInstructions: field('If I cannot help', plan.incapacityInstructions), deathInstructions: field('After my death', plan.deathInstructions), documentsLocation: field('Original documents', plan.documentsLocation),
      primaryContactId: field('Supporting contact', plan.primaryContactId ? personName(plan.primaryContactId) : '', false), alternateContactId: field('Another supporting contact', plan.alternateContactId ? personName(plan.alternateContactId) : '', false),
      vaultLocation: field('Where to find the original vault', plan.vaultLocation), backupLocation: field('Where to find a separate copy', plan.backupLocation), passwordInstructions: { ...field('Access instructions', plan.passwordInstructions), sensitive: true }
    } })
    return { name: metadata.name, records: records.sort((a, b) => a.id.localeCompare(b.id)) }
  }
  apply(snapshot: SharedSnapshot) {
    const current = this.snapshot()
    withTransaction(this.db, () => {
      for (const record of snapshot.records) {
        let original = current.records.find(item => item.id === record.id)
        if (!original && record.kind !== 'handoff') {
          const table = { people: 'people', accounts: 'accounts', entries: 'vault_entries' }[record.kind]
          const archived = this.db.prepare(`SELECT id FROM ${table} WHERE id=? AND archived_at IS NOT NULL`).get(record.id)
          if (archived) {
            this.db.prepare(`UPDATE ${table} SET archived_at=NULL WHERE id=?`).run(record.id)
            original = this.snapshot().records.find(item => item.id === record.id)
          }
        }
        if (!original) throw new Error('This shared record is missing from the local file. Open the original source file before syncing; the online version has been preserved.')
        if (recordContent(original) === recordContent(record)) continue
        if (original.kind !== record.kind) throw new Error('Record type cannot be changed by a collaborator.')
        const changes: Record<string, string | null> = {}
        for (const [key, incoming] of Object.entries(record.fields)) {
          const existing = original.fields[key]
          if (!existing || incoming.value === existing.value) continue
          if (!existing.editable) continue // Derived relationship labels are recalculated locally.
          changes[key] = incoming.value || null
        }
        if (record.kind === 'people') new PersonRepository(this.db).update(UpdatePersonSchema.parse({ id: record.id, ...changes }))
        if (record.kind === 'accounts') new AccountRepository(this.db, this.encryption, this.key).update(UpdateAccountSchema.parse({ id: record.id, ...changes }))
        if (record.kind === 'handoff') new HandoffRepository(this.db).update(HandoffSchema.parse({ ...new HandoffRepository(this.db).get(), ...Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, value ?? ''])) }))
        if (record.kind === 'entries') {
          const repo = new EntryRepository(this.db, this.encryption, this.key), entry = repo.listAll().find(item => item.id === record.id)!
          const fields = { ...entry.fields }, sensitiveFields = { ...entry.sensitiveFields }
          for (const [key, value] of Object.entries(changes)) if (!['_title', '_notes', '_location'].includes(key)) (original.fields[key].sensitive ? sensitiveFields : fields)[key] = value ?? ''
          repo.update(UpdateVaultEntrySchema.parse({ id: record.id, fields, sensitiveFields, ...(changes._title !== undefined ? { title: changes._title } : {}), ...(changes._notes !== undefined ? { notes: changes._notes } : {}), ...(changes._location !== undefined ? { locationText: changes._location } : {}) }))
        }
      }
      for (const original of current.records) if (!snapshot.records.some(record => record.id === original.id)) {
        if (original.kind === 'people') new PersonRepository(this.db).archive(original.id)
        if (original.kind === 'accounts') new AccountRepository(this.db, this.encryption, this.key).archive(original.id)
        if (original.kind === 'entries') new EntryRepository(this.db, this.encryption, this.key).archive(original.id)
      }
      if (snapshot.name !== current.name) new VaultRepository(this.db).updateMetadata({ name: snapshot.name })
    })
  }
}

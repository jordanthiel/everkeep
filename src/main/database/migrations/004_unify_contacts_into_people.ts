import { v4 as uuidv4 } from 'uuid'
import type { Migration } from './types'

const CONTACT_ROLE_TO_PERSON_ROLE: Record<string, string> = {
  estate_attorney: 'attorney',
  cpa: 'cpa',
  financial_advisor: 'advisor',
  insurance_agent: 'insurance_agent',
  banker: 'banker',
  employer_hr: 'employer_hr',
  doctor: 'doctor',
  funeral_home: 'funeral_home',
  property_manager: 'property_manager',
  business_partner: 'business_partner',
  clergy: 'clergy',
  other: 'other'
}

interface LegacyContactRow {
  id: string
  name: string
  company: string | null
  role: string | null
  phone: string | null
  email: string | null
  address: string | null
  website: string | null
  notes: string | null
  created_at: string
  updated_at: string
  last_reviewed_at: string | null
}

interface PersonNameRow {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  address: string | null
  company: string | null
  website: string | null
}

export const migration004: Migration = {
  id: '004_unify_contacts_into_people',
  version: 4,
  up(db) {
    const peopleColumns = db.prepare('PRAGMA table_info(people)').all() as Array<{ name: string }>
    const columnNames = new Set(peopleColumns.map((column) => column.name))
    if (!columnNames.has('company')) {
      db.exec('ALTER TABLE people ADD COLUMN company TEXT')
    }
    if (!columnNames.has('website')) {
      db.exec('ALTER TABLE people ADD COLUMN website TEXT')
    }

    const contacts = db
      .prepare(
        `SELECT id, name, company, role, phone, email, address, website, notes,
                created_at, updated_at, last_reviewed_at
         FROM contacts WHERE archived_at IS NULL`
      )
      .all() as LegacyContactRow[]

    const people = db
      .prepare(
        `SELECT id, full_name, phone, email, address, company, website
         FROM people WHERE archived_at IS NULL`
      )
      .all() as PersonNameRow[]

    const insertPerson = db.prepare(
      `INSERT INTO people (
        id, full_name, relationship, date_of_birth, phone, email, address, notes,
        company, website, created_at, updated_at, last_reviewed_at, archived_at
      ) VALUES (?, ?, 'other', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
    )
    const updatePerson = db.prepare(
      `UPDATE people SET
        phone = COALESCE(NULLIF(phone, ''), ?),
        email = COALESCE(NULLIF(email, ''), ?),
        address = COALESCE(NULLIF(address, ''), ?),
        company = COALESCE(NULLIF(company, ''), ?),
        website = COALESCE(NULLIF(website, ''), ?),
        notes = COALESCE(NULLIF(notes, ''), ?),
        updated_at = ?
      WHERE id = ?`
    )
    const insertRole = db.prepare(
      `INSERT OR IGNORE INTO person_roles (id, person_id, role, created_at) VALUES (?, ?, ?, ?)`
    )
    const archiveContact = db.prepare(
      `UPDATE contacts SET archived_at = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL`
    )

    const now = new Date().toISOString()

    for (const contact of contacts) {
      const existing = people.find(
        (person) => person.full_name.trim().toLowerCase() === contact.name.trim().toLowerCase()
      )
      const personId = existing?.id ?? uuidv4()
      if (!existing) {
        insertPerson.run(
          personId,
          contact.name.trim(),
          contact.phone,
          contact.email,
          contact.address,
          contact.notes,
          contact.company,
          contact.website,
          contact.created_at,
          contact.updated_at,
          contact.last_reviewed_at ?? now
        )
        people.push({
          id: personId,
          full_name: contact.name.trim(),
          phone: contact.phone,
          email: contact.email,
          address: contact.address,
          company: contact.company,
          website: contact.website
        })
      } else {
        updatePerson.run(
          contact.phone,
          contact.email,
          contact.address,
          contact.company,
          contact.website,
          contact.notes,
          now,
          personId
        )
      }

      if (contact.role) {
        const mapped = CONTACT_ROLE_TO_PERSON_ROLE[contact.role] ?? 'other'
        insertRole.run(uuidv4(), personId, mapped, now)
      }
      archiveContact.run(now, now, contact.id)
    }
  }
}

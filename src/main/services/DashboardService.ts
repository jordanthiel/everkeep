import type { VaultDatabase } from '../database/connection'
import type { DashboardAction, DashboardSummary } from '../../shared/types/dashboard'

export class DashboardService {
  constructor(private readonly db: VaultDatabase) {}

  getSummary(): DashboardSummary {
    const peopleCount = this.count('people')
    const contactsCount = this.count('contacts')
    const accountsCount = this.count('accounts')
    const hasExecutor = this.hasRole('executor')
    const hasAttorney = this.hasContactRole('estate_attorney')
    const hasPasswordManagerHint =
      this.hasDigitalCategory('password_manager') || this.hasEntryKind('digital', 'password_manager')
    const hasWill = this.hasEntryKind('legal', 'will')
    const hasInsurance = this.hasEntrySection('insurance')
    const hasProperty = this.hasEntrySection('property')

    const checklist: Array<Omit<DashboardAction, 'done'>> = [
      {
        id: 'add-people',
        title: 'Add the people who matter',
        description: 'Yourself, spouse/partner, children, and anyone who would handle affairs.',
        path: '/people',
        cta: 'Add people',
        priority: 1
      },
      {
        id: 'name-executor',
        title: 'Name an executor',
        description: 'Mark someone with the Executor role so they are easy to find later.',
        path: '/people',
        cta: 'Choose executor',
        priority: 2
      },
      {
        id: 'add-attorney',
        title: 'Add your estate attorney',
        description: 'A trusted professional contact your family can call quickly.',
        path: '/contacts',
        cta: 'Add contact',
        priority: 3
      },
      {
        id: 'add-will',
        title: 'Record where your will is kept',
        description: 'Note whether a will exists and the location of the original.',
        path: '/legal',
        cta: 'Add legal record',
        priority: 4
      },
      {
        id: 'add-accounts',
        title: 'List key financial accounts',
        description: 'Checking, retirement, and brokerage accounts — discovery first, not net worth.',
        path: '/financial',
        cta: 'Add account',
        priority: 5
      },
      {
        id: 'password-manager',
        title: 'Document password manager access',
        description: 'Record how an authorized person can reach your password manager — not every password.',
        path: '/digital',
        cta: 'Open Digital Life',
        priority: 6
      },
      {
        id: 'add-insurance',
        title: 'Add insurance policies',
        description: 'Life and property coverage your family would need to find quickly.',
        path: '/insurance',
        cta: 'Add policy',
        priority: 7
      },
      {
        id: 'add-property',
        title: 'List homes and vehicles',
        description: 'Addresses, titles, keys, and access instructions.',
        path: '/property',
        cta: 'Add property',
        priority: 8
      }
    ]

    const actions: DashboardAction[] = checklist.map((item) => {
      let done = false
      if (item.id === 'add-people') done = peopleCount > 0
      if (item.id === 'name-executor') done = hasExecutor
      if (item.id === 'add-attorney') done = hasAttorney
      if (item.id === 'add-will') done = hasWill
      if (item.id === 'add-accounts') done = accountsCount > 0
      if (item.id === 'password-manager') done = hasPasswordManagerHint
      if (item.id === 'add-insurance') done = hasInsurance
      if (item.id === 'add-property') done = hasProperty
      return { ...item, done }
    })

    const completed = actions.filter((a) => a.done).length
    const overallPercent = Math.round((completed / actions.length) * 100)

    const importantPeople = [
      { role: 'Spouse / Partner', name: this.personNameByRelationship('spouse') },
      { role: 'Executor', name: this.personNameByRole('executor') },
      { role: 'Trustee', name: this.personNameByRole('trustee') },
      { role: 'Power of Attorney', name: this.personNameByRole('power_of_attorney') },
      { role: 'Attorney', name: this.contactNameByRole('estate_attorney') },
      { role: 'Financial Advisor', name: this.contactNameByRole('financial_advisor') }
    ]

    const recentlyUpdated = this.recentUpdates()

    return {
      overallPercent,
      peopleCount,
      contactsCount,
      accountsCount,
      hasExecutor,
      hasPasswordManagerHint,
      actions: actions.sort((a, b) => Number(a.done) - Number(b.done) || a.priority - b.priority),
      importantPeople,
      recentlyUpdated
    }
  }

  private count(table: 'people' | 'contacts' | 'accounts'): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE archived_at IS NULL`)
      .get() as { count: number }
    return row.count
  }

  private hasRole(role: string): boolean {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM person_roles r
         JOIN people p ON p.id = r.person_id
         WHERE r.role = ? AND p.archived_at IS NULL`
      )
      .get(role) as { count: number }
    return row.count > 0
  }

  private hasContactRole(role: string): boolean {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS count FROM contacts WHERE role = ? AND archived_at IS NULL`
      )
      .get(role) as { count: number }
    return row.count > 0
  }

  private hasDigitalCategory(category: string): boolean {
    try {
      const row = this.db
        .prepare(
          `SELECT COUNT(*) AS count FROM digital_accounts
           WHERE category = ? AND archived_at IS NULL`
        )
        .get(category) as { count: number }
      return row.count > 0
    } catch {
      return false
    }
  }

  private hasEntryKind(section: string, kind: string): boolean {
    try {
      const row = this.db
        .prepare(
          `SELECT COUNT(*) AS count FROM vault_entries
           WHERE section = ? AND kind = ? AND archived_at IS NULL`
        )
        .get(section, kind) as { count: number }
      return row.count > 0
    } catch {
      return false
    }
  }

  private hasEntrySection(section: string): boolean {
    try {
      const row = this.db
        .prepare(
          `SELECT COUNT(*) AS count FROM vault_entries
           WHERE section = ? AND archived_at IS NULL`
        )
        .get(section) as { count: number }
      return row.count > 0
    } catch {
      return false
    }
  }

  private personNameByRelationship(relationship: string): string | null {
    const row = this.db
      .prepare(
        `SELECT full_name FROM people
         WHERE relationship = ? AND archived_at IS NULL
         ORDER BY updated_at DESC LIMIT 1`
      )
      .get(relationship) as { full_name: string } | undefined
    return row?.full_name ?? null
  }

  private personNameByRole(role: string): string | null {
    const row = this.db
      .prepare(
        `SELECT p.full_name AS full_name
         FROM people p
         JOIN person_roles r ON r.person_id = p.id
         WHERE r.role = ? AND p.archived_at IS NULL
         ORDER BY p.updated_at DESC LIMIT 1`
      )
      .get(role) as { full_name: string } | undefined
    return row?.full_name ?? null
  }

  private contactNameByRole(role: string): string | null {
    const row = this.db
      .prepare(
        `SELECT name FROM contacts
         WHERE role = ? AND archived_at IS NULL
         ORDER BY updated_at DESC LIMIT 1`
      )
      .get(role) as { name: string } | undefined
    return row?.name ?? null
  }

  private recentUpdates(): DashboardSummary['recentlyUpdated'] {
    const people = this.db
      .prepare(
        `SELECT full_name AS title, updated_at AS updatedAt
         FROM people WHERE archived_at IS NULL
         ORDER BY updated_at DESC LIMIT 3`
      )
      .all() as Array<{ title: string; updatedAt: string }>

    const accounts = this.db
      .prepare(
        `SELECT COALESCE(account_name, institution) AS title, updated_at AS updatedAt
         FROM accounts WHERE archived_at IS NULL
         ORDER BY updated_at DESC LIMIT 3`
      )
      .all() as Array<{ title: string; updatedAt: string }>

    const contacts = this.db
      .prepare(
        `SELECT name AS title, updated_at AS updatedAt
         FROM contacts WHERE archived_at IS NULL
         ORDER BY updated_at DESC LIMIT 3`
      )
      .all() as Array<{ title: string; updatedAt: string }>

    let entries: Array<{ title: string; updatedAt: string; section: string }> = []
    try {
      entries = this.db
        .prepare(
          `SELECT title, updated_at AS updatedAt, section
           FROM vault_entries WHERE archived_at IS NULL
           ORDER BY updated_at DESC LIMIT 5`
        )
        .all() as Array<{ title: string; updatedAt: string; section: string }>
    } catch {
      entries = []
    }

    return [
      ...people.map((p) => ({ entity: 'People', title: p.title, updatedAt: p.updatedAt, path: '/people' })),
      ...accounts.map((a) => ({
        entity: 'Financial',
        title: a.title,
        updatedAt: a.updatedAt,
        path: '/financial'
      })),
      ...contacts.map((c) => ({
        entity: 'Contacts',
        title: c.title,
        updatedAt: c.updatedAt,
        path: '/contacts'
      })),
      ...entries.map((e) => ({
        entity: e.section,
        title: e.title,
        updatedAt: e.updatedAt,
        path: `/${e.section}`
      }))
    ]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 8)
  }
}

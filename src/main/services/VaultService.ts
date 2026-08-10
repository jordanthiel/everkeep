import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs'
import { basename, join } from 'path'
import {
  closeDatabase,
  createDatabase,
  openDatabase,
  verifyIntegrity,
  type VaultDatabase
} from '../database/connection'
import { runMigrations } from '../database/migrator'
import { ensureParentDirectory, ensureVaultExtension } from '../files/paths'
import { AccountRepository } from '../repositories/AccountRepository'
import { ContactRepository } from '../repositories/ContactRepository'
import { DigitalAccountRepository } from '../repositories/DigitalAccountRepository'
import { PersonRepository } from '../repositories/PersonRepository'
import { RecentVaultsStore } from '../repositories/RecentVaultsStore'
import { VaultRepository } from '../repositories/VaultRepository'
import {
  DEFAULT_ARGON2_PARAMS,
  EncryptionService,
  type Argon2Params
} from '../security/EncryptionService'
import { DashboardService } from './DashboardService'
import type {
  BackupVaultInput,
  CreateVaultInput,
  OpenVaultInput,
  RecentVault,
  SaveAsVaultInput,
  VaultSession,
  VaultStatus
} from '../../shared/types/vault'
import type {
  CreatePersonInput,
  Person,
  UpdatePersonInput
} from '../../shared/types/person'
import type {
  Contact,
  CreateContactInput,
  UpdateContactInput
} from '../../shared/types/contact'
import type {
  Account,
  CreateAccountInput,
  UpdateAccountInput
} from '../../shared/types/account'
import type { DashboardSummary } from '../../shared/types/dashboard'
import type {
  CreateDigitalAccountInput,
  DigitalAccount
} from '../../shared/types/digital'

export class VaultServiceError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message)
    this.name = 'VaultServiceError'
  }
}

export interface VaultServiceOptions {
  recentStore?: RecentVaultsStore
  recoveryDirectory?: string
  maxRecoveryCopies?: number
  encryption?: EncryptionService
  argon2Params?: Argon2Params
}

export class VaultService {
  private db: VaultDatabase | null = null
  private filePath: string | null = null
  private isLocked = false
  private encryptionKey: Buffer | null = null
  private readonly recentStore: RecentVaultsStore
  private readonly recoveryDirectory: string | null
  private readonly maxRecoveryCopies: number
  private readonly encryption: EncryptionService
  private readonly argon2Params: Argon2Params

  constructor(options: VaultServiceOptions = {}) {
    if (!options.recentStore) {
      throw new Error('VaultService requires a RecentVaultsStore')
    }
    this.recentStore = options.recentStore
    this.recoveryDirectory = options.recoveryDirectory ?? null
    this.maxRecoveryCopies = options.maxRecoveryCopies ?? 5
    this.encryption = options.encryption ?? new EncryptionService()
    this.argon2Params = options.argon2Params ?? DEFAULT_ARGON2_PARAMS
  }

  getStatus(): VaultStatus {
    if (!this.db || !this.filePath) {
      return { isOpen: false, session: null }
    }

    const metadata = new VaultRepository(this.db).getMetadata()
    if (!metadata) {
      return { isOpen: false, session: null }
    }

    return {
      isOpen: true,
      session: {
        filePath: this.filePath,
        metadata,
        isLocked: this.isLocked
      }
    }
  }

  getRecent(): RecentVault[] {
    return this.recentStore.list().filter((item) => existsSync(item.filePath))
  }

  createVault(input: CreateVaultInput): VaultSession {
    const filePath = ensureVaultExtension(input.filePath)
    ensureParentDirectory(filePath)

    if (existsSync(filePath)) {
      throw new VaultServiceError('A vault already exists at this location.', 'VAULT_EXISTS')
    }

    if (this.db) {
      this.closeVault()
    }

    let db: VaultDatabase | null = null
    try {
      db = createDatabase(filePath)
      runMigrations(db, filePath)

      const repo = new VaultRepository(db)
      let passwordVerifier: string | null = null
      let encryptionSalt: string | null = null
      let encryptionParams: string | null = null
      let key: Buffer | null = null

      if (input.password) {
        const material = this.encryption.createPasswordProtection(input.password, this.argon2Params)
        passwordVerifier = material.verifier
        encryptionSalt = material.salt
        encryptionParams = this.encryption.serializeParams(material.params)
        key = material.key
      }

      const metadata = repo.createMetadata({
        name: input.name,
        householdName: input.householdName,
        ownerFirstName: input.ownerFirstName,
        ownerMiddleName: input.ownerMiddleName,
        ownerLastName: input.ownerLastName,
        ownerPreferredName: input.ownerPreferredName,
        ownerDateOfBirth: input.ownerDateOfBirth,
        spousePartnerName: input.spousePartnerName,
        isPasswordProtected: Boolean(input.password),
        passwordVerifier,
        encryptionSalt,
        encryptionParams
      })

      this.db = db
      this.filePath = filePath
      this.isLocked = false
      this.encryptionKey = key

      // Seed owner + spouse as people for a smoother first-run experience.
      const people = new PersonRepository(db)
      if (input.ownerFirstName || input.ownerLastName) {
        const ownerName = [input.ownerPreferredName || input.ownerFirstName, input.ownerLastName]
          .filter(Boolean)
          .join(' ')
        if (ownerName.trim()) {
          people.create({
            fullName: ownerName.trim(),
            relationship: 'other',
            dateOfBirth: input.ownerDateOfBirth ?? null,
            notes: 'Vault owner'
          })
        }
      }
      if (input.spousePartnerName?.trim()) {
        people.create({
          fullName: input.spousePartnerName.trim(),
          relationship: 'spouse'
        })
      }

      this.recentStore.touch({
        filePath,
        name: metadata.name,
        householdName: metadata.householdName
      })

      this.createRecoveryCopy()

      return {
        filePath,
        metadata,
        isLocked: false
      }
    } catch (error) {
      if (db) {
        closeDatabase(db)
      }
      if (existsSync(filePath)) {
        try {
          unlinkSync(filePath)
          const wal = `${filePath}-wal`
          const shm = `${filePath}-shm`
          if (existsSync(wal)) unlinkSync(wal)
          if (existsSync(shm)) unlinkSync(shm)
        } catch {
          // Best-effort cleanup
        }
      }
      throw error
    }
  }

  openVault(input: OpenVaultInput): VaultSession {
    const filePath = ensureVaultExtension(input.filePath)

    if (!existsSync(filePath)) {
      throw new VaultServiceError('Vault file not found.', 'VAULT_NOT_FOUND')
    }

    if (this.db) {
      this.closeVault()
    }

    const db = openDatabase(filePath)
    const integrity = verifyIntegrity(db)
    if (!integrity.ok) {
      closeDatabase(db)
      throw new VaultServiceError(
        'This vault failed an integrity check and may be corrupted. Restore from a backup.',
        'VAULT_CORRUPT'
      )
    }

    runMigrations(db, filePath)

    const repo = new VaultRepository(db)
    const metadata = repo.getMetadata()
    if (!metadata) {
      closeDatabase(db)
      throw new VaultServiceError('Vault metadata is missing.', 'VAULT_INVALID')
    }

    let key: Buffer | null = null
    if (metadata.isPasswordProtected) {
      if (!input.password) {
        closeDatabase(db)
        throw new VaultServiceError('This vault is password protected.', 'PASSWORD_REQUIRED')
      }

      const material = repo.getEncryptionMaterial()
      if (!material?.passwordVerifier || !material.encryptionSalt || !material.encryptionParams) {
        closeDatabase(db)
        throw new VaultServiceError(
          'This vault is missing encryption metadata and cannot be unlocked.',
          'VAULT_INVALID'
        )
      }

      key = this.encryption.verifyPassword(
        input.password,
        material.encryptionSalt,
        material.encryptionParams,
        material.passwordVerifier
      )

      if (!key) {
        closeDatabase(db)
        throw new VaultServiceError('Incorrect password.', 'PASSWORD_INCORRECT')
      }
    }

    this.db = db
    this.filePath = filePath
    this.isLocked = false
    this.encryptionKey = key

    this.recentStore.touch({
      filePath,
      name: metadata.name,
      householdName: metadata.householdName
    })

    return {
      filePath,
      metadata,
      isLocked: false
    }
  }

  lockVault(): VaultSession {
    const status = this.getStatus()
    if (!status.session) {
      throw new VaultServiceError('No vault is currently open.', 'VAULT_NOT_OPEN')
    }
    if (!status.session.metadata.isPasswordProtected) {
      throw new VaultServiceError('This vault is not password protected.', 'NOT_PROTECTED')
    }

    this.encryption.clearKey(this.encryptionKey)
    this.encryptionKey = null
    this.isLocked = true

    return {
      ...status.session,
      isLocked: true
    }
  }

  unlockVault(password: string): VaultSession {
    if (!this.db || !this.filePath) {
      throw new VaultServiceError('No vault is currently open.', 'VAULT_NOT_OPEN')
    }

    const repo = new VaultRepository(this.db)
    const metadata = repo.getMetadata()
    if (!metadata) {
      throw new VaultServiceError('Vault metadata is missing.', 'VAULT_INVALID')
    }
    if (!metadata.isPasswordProtected) {
      this.isLocked = false
      return { filePath: this.filePath, metadata, isLocked: false }
    }

    const material = repo.getEncryptionMaterial()
    if (!material?.passwordVerifier || !material.encryptionSalt || !material.encryptionParams) {
      throw new VaultServiceError(
        'This vault is missing encryption metadata and cannot be unlocked.',
        'VAULT_INVALID'
      )
    }

    const key = this.encryption.verifyPassword(
      password,
      material.encryptionSalt,
      material.encryptionParams,
      material.passwordVerifier
    )
    if (!key) {
      throw new VaultServiceError('Incorrect password.', 'PASSWORD_INCORRECT')
    }

    this.encryption.clearKey(this.encryptionKey)
    this.encryptionKey = key
    this.isLocked = false

    return {
      filePath: this.filePath,
      metadata,
      isLocked: false
    }
  }

  rotatePassword(currentPassword: string, newPassword: string): VaultSession {
    this.requireOpenDb()
    const repo = new VaultRepository(this.db!)
    const material = repo.getEncryptionMaterial()
    const metadata = repo.getMetadata()
    if (!metadata) throw new VaultServiceError('Vault metadata is missing.', 'VAULT_INVALID')

    if (metadata.isPasswordProtected) {
      if (!material?.passwordVerifier || !material.encryptionSalt || !material.encryptionParams) {
        throw new VaultServiceError('Vault encryption metadata is incomplete.', 'VAULT_INVALID')
      }
      const currentKey = this.encryption.verifyPassword(
        currentPassword,
        material.encryptionSalt,
        material.encryptionParams,
        material.passwordVerifier
      )
      if (!currentKey) {
        throw new VaultServiceError('Incorrect password.', 'PASSWORD_INCORRECT')
      }
      this.encryption.clearKey(currentKey)
    }

    // Re-encrypt sensitive account numbers when enabling/changing protection.
    const accounts = new AccountRepository(this.db!, this.encryption, this.encryptionKey).list()
    const next = this.encryption.createPasswordProtection(newPassword, this.argon2Params)

    repo.setPasswordProtection({
      isPasswordProtected: true,
      passwordVerifier: next.verifier,
      encryptionSalt: next.salt,
      encryptionParams: this.encryption.serializeParams(next.params)
    })

    this.encryption.clearKey(this.encryptionKey)
    this.encryptionKey = next.key
    this.isLocked = false

    const accountRepo = new AccountRepository(this.db!, this.encryption, this.encryptionKey)
    for (const account of accounts) {
      if (account.fullAccountNumber) {
        accountRepo.update({
          id: account.id,
          fullAccountNumber: account.fullAccountNumber
        })
      }
    }

    const updated = repo.getMetadata()
    if (!updated || !this.filePath) {
      throw new VaultServiceError('Failed to rotate password.', 'INTERNAL_ERROR')
    }

    return {
      filePath: this.filePath,
      metadata: updated,
      isLocked: false
    }
  }

  closeVault(): { closed: boolean } {
    if (this.db) {
      this.createRecoveryCopy()
      closeDatabase(this.db)
    }
    this.encryption.clearKey(this.encryptionKey)
    this.encryptionKey = null
    this.db = null
    this.filePath = null
    this.isLocked = false
    return { closed: true }
  }

  saveAs(input: SaveAsVaultInput): VaultSession {
    this.requireOpenDb()
    const destination = ensureVaultExtension(input.destinationPath)
    ensureParentDirectory(destination)

    if (existsSync(destination)) {
      throw new VaultServiceError('A file already exists at the destination.', 'VAULT_EXISTS')
    }

    this.db!.pragma('wal_checkpoint(TRUNCATE)')
    copyFileSync(this.filePath!, destination)

    const passwordProtected = this.getStatus().session?.metadata.isPasswordProtected
    // Re-open requires password if protected — keep current session on original file.
    if (passwordProtected) {
      throw new VaultServiceError(
        'Save As for password-protected vaults is available as Backup for now.',
        'SAVE_AS_PROTECTED'
      )
    }

    return this.openVault({ filePath: destination })
  }

  backup(input: BackupVaultInput): { backupPath: string } {
    this.requireOpenDb()
    const destination = ensureVaultExtension(input.destinationPath)
    ensureParentDirectory(destination)

    this.db!.pragma('wal_checkpoint(TRUNCATE)')
    copyFileSync(this.filePath!, destination)

    return { backupPath: destination }
  }

  getDashboard(): DashboardSummary {
    return new DashboardService(this.requireOpenDb()).getSummary()
  }

  listPeople(): Person[] {
    return this.personRepo().list()
  }

  getPerson(id: string): Person | null {
    return this.personRepo().getById(id)
  }

  createPerson(input: CreatePersonInput): Person {
    return this.personRepo().create(input)
  }

  updatePerson(input: UpdatePersonInput): Person {
    return this.personRepo().update(input)
  }

  archivePerson(id: string): { archived: boolean } {
    return { archived: this.personRepo().archive(id) }
  }

  markPersonReviewed(id: string): Person {
    return this.personRepo().markReviewed(id)
  }

  listContacts(): Contact[] {
    return this.contactRepo().list()
  }

  createContact(input: CreateContactInput): Contact {
    return this.contactRepo().create(input)
  }

  updateContact(input: UpdateContactInput): Contact {
    return this.contactRepo().update(input)
  }

  archiveContact(id: string): { archived: boolean } {
    return { archived: this.contactRepo().archive(id) }
  }

  markContactReviewed(id: string): Contact {
    return this.contactRepo().markReviewed(id)
  }

  listAccounts(): Account[] {
    return this.accountRepo().list()
  }

  createAccount(input: CreateAccountInput): Account {
    return this.accountRepo().create(input)
  }

  updateAccount(input: UpdateAccountInput): Account {
    return this.accountRepo().update(input)
  }

  archiveAccount(id: string): { archived: boolean } {
    return { archived: this.accountRepo().archive(id) }
  }

  markAccountReviewed(id: string): Account {
    return this.accountRepo().markReviewed(id)
  }

  listDigitalAccounts(): DigitalAccount[] {
    return this.digitalRepo().list()
  }

  createDigitalAccount(input: CreateDigitalAccountInput): DigitalAccount {
    return this.digitalRepo().create(input)
  }

  archiveDigitalAccount(id: string): { archived: boolean } {
    return { archived: this.digitalRepo().archive(id) }
  }

  getDatabaseForTests(): VaultDatabase | null {
    return this.db
  }

  getEncryptionKeyForTests(): Buffer | null {
    return this.encryptionKey
  }

  private personRepo(): PersonRepository {
    return new PersonRepository(this.requireOpenDb())
  }

  private contactRepo(): ContactRepository {
    return new ContactRepository(this.requireOpenDb())
  }

  private accountRepo(): AccountRepository {
    this.requireOpenDb()
    return new AccountRepository(this.db!, this.encryption, this.encryptionKey)
  }

  private digitalRepo(): DigitalAccountRepository {
    return new DigitalAccountRepository(this.requireOpenDb())
  }

  private requireOpenDb(): VaultDatabase {
    if (!this.db || !this.filePath) {
      throw new VaultServiceError('No vault is currently open.', 'VAULT_NOT_OPEN')
    }
    if (this.isLocked) {
      throw new VaultServiceError('This vault is locked.', 'VAULT_LOCKED')
    }
    return this.db
  }

  private createRecoveryCopy(): void {
    if (!this.db || !this.filePath || !this.recoveryDirectory) return

    try {
      this.db.pragma('wal_checkpoint(TRUNCATE)')
      mkdirSync(this.recoveryDirectory, { recursive: true })
      const stamp = new Date().toISOString().slice(0, 10)
      const base = basename(this.filePath, '.everkeep')
      const dest = join(this.recoveryDirectory, `${base}-${stamp}.everkeep`)
      copyFileSync(this.filePath, dest)

      const related = readdirSync(this.recoveryDirectory)
        .filter((name) => name.startsWith(`${base}-`) && name.endsWith('.everkeep'))
        .map((name) => {
          const full = join(this.recoveryDirectory!, name)
          return { full, mtime: statSync(full).mtimeMs }
        })
        .sort((a, b) => b.mtime - a.mtime)

      for (const stale of related.slice(this.maxRecoveryCopies)) {
        try {
          unlinkSync(stale.full)
        } catch {
          // ignore
        }
      }
    } catch {
      // Recovery copies are best-effort and must not break primary flows
    }
  }
}

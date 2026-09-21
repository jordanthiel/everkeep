import { RecordLoginRepository } from '../repositories/RecordLoginRepository'
import { RecordLoginSchema } from '../../shared/schemas/recordLogin'
import type { RecordLoginInput } from '../../shared/types/recordLogin'
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, readFileSync, writeFileSync } from 'fs'
import JSZip from 'jszip'
import { HandoffRepository } from '../repositories/HandoffRepository'
import type { HandoffInput, BackupCheck } from '../../shared/types/handoff'
import type { ExportOptions } from '../../shared/types/entry'
import { createHash, randomUUID } from 'crypto'
import { atomicWrite, decodeProtectedFile, encodeProtectedFile, isProtectedFile } from '../security/ProtectedVaultFile'
import { basename, join, resolve, sep } from 'path'
import {
  withTransaction,
  closeDatabase,
  openMemoryDatabase,
  setDatabasePersistence,
  createDatabase,
  openDatabase,
  verifyIntegrity,
  type VaultDatabase
} from '../database/connection'
import { runMigrations } from '../database/migrator'
import { ensureParentDirectory, ensureVaultExtension } from '../files/paths'
import { AccountRepository } from '../repositories/AccountRepository'
import { AttachmentRepository } from '../repositories/AttachmentRepository'
import { ContactRepository } from '../repositories/ContactRepository'
import { DigitalAccountRepository } from '../repositories/DigitalAccountRepository'
import { EntryRepository } from '../repositories/EntryRepository'
import { PersonRepository } from '../repositories/PersonRepository'
import { RecentVaultsStore } from '../repositories/RecentVaultsStore'
import { VaultRepository } from '../repositories/VaultRepository'
import {
  DEFAULT_ARGON2_PARAMS,
  EncryptionService,
  type Argon2Params
} from '../security/EncryptionService'
import { getAttachmentsDirectory } from '../files/paths'
import { AttachmentService, AttachmentServiceError, clearOpenedAttachments } from './AttachmentService'
import { DashboardService } from './DashboardService'
import { ExportService } from './ExportService'
import type { LicenseService } from './LicenseService'
import { ReviewService } from './ReviewService'
import {
  FREE_ATTACHMENT_CAP,
  FREE_ENTRY_CAP
} from '../../shared/constants'
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
import type {
  CreateVaultEntryInput,
  ExportReportInput,
  ReviewItem,
  UpdateVaultEntryInput,
  VaultEntry,
  VaultSectionId
} from '../../shared/types/entry'
import type { Attachment } from '../../shared/types/attachment'

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
  /** Override attachments root (tests). Defaults to app userData/attachments/{vaultId}. */
  attachmentsRootFactory?: (vaultId: string) => string
  /** License entitlement checks for freemium caps. Defaults to free (caps enforced). */
  licenseService?: LicenseService
}

export class VaultService {
  private db: VaultDatabase | null = null
  private lockedSession: VaultSession | null = null
  private savedDigest: string | null = null
  private reportPreview: { html: string; token: string } | null = null
  private filePath: string | null = null
  private isLocked = false
  private encryptionKey: Buffer | null = null
  private readonly recentStore: RecentVaultsStore
  private readonly recoveryDirectory: string | null
  private readonly maxRecoveryCopies: number
  private readonly encryption: EncryptionService
  private readonly argon2Params: Argon2Params
  private readonly attachmentsRootFactory: (vaultId: string) => string
  private readonly licenseService: LicenseService | null

  constructor(options: VaultServiceOptions = {}) {
    if (!options.recentStore) {
      throw new Error('VaultService requires a RecentVaultsStore')
    }
    this.recentStore = options.recentStore
    this.recoveryDirectory = options.recoveryDirectory ?? null
    this.maxRecoveryCopies = options.maxRecoveryCopies ?? 5
    this.encryption = options.encryption ?? new EncryptionService()
    this.argon2Params = options.argon2Params ?? DEFAULT_ARGON2_PARAMS
    this.attachmentsRootFactory =
      options.attachmentsRootFactory ?? ((vaultId) => getAttachmentsDirectory(vaultId))
    this.licenseService = options.licenseService ?? null
  }

  getStatus(): VaultStatus {
    if (this.lockedSession) return { isOpen: true, session: this.lockedSession }
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

    if (this.db || this.lockedSession) {
      this.closeVault()
    }

    let db: VaultDatabase | null = null
    try {
      db = input.password ? openMemoryDatabase() : createDatabase(filePath)
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
            relationship: 'self',
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

      this.installPersistence()
      this.persistProtectedVault()
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
      this.db = null
      this.filePath = null
      this.encryption.clearKey(this.encryptionKey)
      this.encryptionKey = null
      throw error
    }
  }

  openVault(input: OpenVaultInput): VaultSession {
    const filePath = ensureVaultExtension(input.filePath)
    if (!existsSync(filePath)) throw new VaultServiceError('Vault file not found.', 'VAULT_NOT_FOUND')
    // Validate the incoming vault before closing the current one.
    let db: VaultDatabase | null = null
    let key: Buffer | null = null
    let encrypted = false
    try {
      const bytes = readFileSync(filePath)
      encrypted = isProtectedFile(bytes)
      if (encrypted) {
        const decoded = decodeProtectedFile(bytes, input.password)
        key = decoded.key
        try { db = openMemoryDatabase(decoded.bytes) } finally { decoded.bytes.fill(0) }
      } else {
        db = openDatabase(filePath)
        const repo = new VaultRepository(db)
        const material = repo.getEncryptionMaterial()
        if (material?.isPasswordProtected && material.passwordVerifier && material.encryptionSalt && material.encryptionParams) {
          if (!input.password) throw new VaultServiceError('This vault is password protected.', 'PASSWORD_REQUIRED')
          key = this.encryption.verifyPassword(input.password, material.encryptionSalt, material.encryptionParams, material.passwordVerifier)
          if (!key) throw new VaultServiceError('Incorrect password.', 'PASSWORD_INCORRECT')
          const memory = openMemoryDatabase(db.serialize())
          closeDatabase(db)
          db = memory
        }
      }
      if (!verifyIntegrity(db).ok) throw new VaultServiceError('This vault failed an integrity check. Restore a backup.', 'VAULT_CORRUPT')
      runMigrations(db, encrypted || !key ? filePath : undefined)
      const repo = new VaultRepository(db)
      if (!repo.getMetadata()) throw new VaultServiceError('Vault metadata is missing.', 'VAULT_INVALID')
      if (!key && repo.getMetadata()?.isPasswordProtected) repo.setPasswordProtection({ isPasswordProtected: false, passwordVerifier: null, encryptionSalt: null, encryptionParams: null })
      const metadata = repo.getMetadata()!
      const obsoletePaths = key && new AttachmentRepository(db).countActive() > 0 ? new AttachmentService(db, metadata.id, this.attachmentsRootFactory(metadata.id), true).importLocalAttachments() : []
      if (this.db || this.lockedSession) this.closeVault()
      this.db = db
      this.filePath = filePath
      this.encryptionKey = key
      this.isLocked = false
      this.lockedSession = null
      this.savedDigest = this.fileDigest()
      this.installPersistence()
      this.persistProtectedVault()
      this.removeMigratedAttachments(obsoletePaths, metadata.id)
      try { this.recentStore.touch({ filePath, name: metadata.name, householdName: metadata.householdName }) } catch { /* Recent-list failure must not obscure a successful open. */ }
      return { filePath, metadata, isLocked: false }
    } catch (error) {
      if (db === this.db) {
        if (db?.open) closeDatabase(db)
        this.db = null
        this.filePath = null
        this.savedDigest = null
        this.encryptionKey = null
      } else if (db?.open) closeDatabase(db)
      if (key !== this.encryptionKey) this.encryption.clearKey(key)
      if (error && typeof error === 'object' && 'code' in error && error instanceof Error) throw new VaultServiceError(error.message, String(error.code))
      throw error
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

    this.persistProtectedVault()
    this.reportPreview = null
    clearOpenedAttachments()
    if (this.db) closeDatabase(this.db)
    this.db = null
    this.encryption.clearKey(this.encryptionKey)
    this.encryptionKey = null
    this.isLocked = true
    this.lockedSession = { ...status.session, isLocked: true }
    return this.lockedSession
  }

  unlockVault(password: string): VaultSession {
    if (!this.lockedSession) {
      const session = this.getStatus().session
      if (session) return session
      throw new VaultServiceError('No vault is currently open.', 'VAULT_NOT_OPEN')
    }
    return this.openVault({ filePath: this.lockedSession.filePath, password })
  }

  rotatePassword(currentPassword: string, newPassword: string): VaultSession {
    this.requireOpenDb()
    const repo = new VaultRepository(this.db!)
    const material = repo.getEncryptionMaterial()
    const metadata = repo.getMetadata()
    if (!metadata) throw new VaultServiceError('Vault metadata is missing.', 'VAULT_INVALID')

    if (metadata.isPasswordProtected) {
      if (!material?.passwordVerifier || !material.encryptionSalt || !material.encryptionParams) {
        // Legacy unprotected-but-flagged vault: allow setting a real password.
      } else {
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
    }

    if (this.encryptionKey && this.savedDigest && this.fileDigest() !== this.savedDigest) throw new VaultServiceError('The vault file changed outside this session. Reopen it before changing protection.', 'VAULT_CHANGED')

    // Stage every change in a separate in-memory database. A failed conversion
    // leaves the old file, attachments, and session usable with the old password.
    const staged = openMemoryDatabase(this.db!.serialize())
    const stagedRepo = new VaultRepository(staged)
    const next = this.encryption.createPasswordProtection(newPassword, this.argon2Params)
    try {
      for (const [table, column] of [['accounts', 'full_account_number_encrypted'], ['vault_entries', 'sensitive_json_encrypted']]) {
        const rows = staged.prepare(`SELECT id, ${column} AS value FROM ${table} WHERE ${column} IS NOT NULL`).all() as Array<{ id: string; value: string }>
        for (const row of rows) {
          const blob = JSON.parse(row.value) as { v: number; plain?: string }
          const plain = blob.v === 0 ? blob.plain! : this.encryption.decrypt(row.value, this.encryptionKey!)
          staged.prepare(`UPDATE ${table} SET ${column} = ? WHERE id = ?`).run(this.encryption.encrypt(plain, next.key), row.id)
        }
      }
      stagedRepo.setPasswordProtection({ isPasswordProtected: true, passwordVerifier: next.verifier, encryptionSalt: next.salt, encryptionParams: this.encryption.serializeParams(next.params) })
      const obsolete = new AttachmentRepository(staged).countActive() > 0 ? new AttachmentService(staged, metadata.id, this.attachmentsRootFactory(metadata.id), true).importLocalAttachments() : []
      const content = encodeProtectedFile(staged.serialize(), next.key, stagedRepo.getEncryptionMaterial()!)
      const previous = this.db!
      // Close disk SQLite before replacing it; remove its now-checkpointed WAL.
      const previousBytes = previous.memory ? previous.serialize() : null
      closeDatabase(previous)
      try { atomicWrite(this.filePath!, content) } catch (error) {
        this.db = previousBytes ? openMemoryDatabase(previousBytes) : openDatabase(this.filePath!)
        this.installPersistence()
        throw error
      }
      this.db = staged
      this.encryption.clearKey(this.encryptionKey)
      this.encryptionKey = next.key
      this.savedDigest = this.fileDigest()
      this.installPersistence()
      this.removeMigratedAttachments(obsolete, metadata.id)
      return { filePath: this.filePath!, metadata: stagedRepo.getMetadata()!, isLocked: false }
    } catch (error) {
      if (staged !== this.db) { closeDatabase(staged); this.encryption.clearKey(next.key) }
      throw error
    }
  }

  closeVault(): { closed: boolean } {
    if (this.db) {
      this.persistProtectedVault()
      this.createRecoveryCopy()
      closeDatabase(this.db)
    }
    this.encryption.clearKey(this.encryptionKey)
    this.encryptionKey = null
    this.db = null
    this.filePath = null
    this.lockedSession = null
    this.savedDigest = null
    this.isLocked = false
    this.reportPreview = null
    clearOpenedAttachments()
    return { closed: true }
  }

  saveAs(input: SaveAsVaultInput): VaultSession {
    this.requireOpenDb()
    const destination = ensureVaultExtension(input.destinationPath)
    ensureParentDirectory(destination)

    if (existsSync(destination)) {
      throw new VaultServiceError('A file already exists at the destination.', 'VAULT_EXISTS')
    }

    if (this.encryptionKey) throw new VaultServiceError('Use Backup to copy a protected vault with its attachments.', 'SAVE_AS_PROTECTED')
    this.db!.pragma('wal_checkpoint(TRUNCATE)')
    copyFileSync(this.filePath!, destination)

    return this.openVault({ filePath: destination })
  }

  async backup(input: BackupVaultInput): Promise<{ backupPath: string }> {
    const currentDb = this.requireOpenDb()
    ensureParentDirectory(input.destinationPath)
    this.persistProtectedVault()
    this.db!.pragma('wal_checkpoint(TRUNCATE)')

    const destination = input.destinationPath.endsWith('.everkeep-backup')
      ? input.destinationPath
      : input.destinationPath.endsWith('.everkeep')
        ? input.destinationPath.replace(/\.everkeep$/i, '.everkeep-backup')
        : `${input.destinationPath}.everkeep-backup`

    const backupPath = await this.attachmentService().writeBackupArchive(
      this.filePath!,
      destination
    )
    if (currentDb === this.db && !this.isLocked) new HandoffRepository(currentDb).update({ lastBackupAt: new Date().toISOString(), backupLocation: backupPath, handoffTestedAt: '', lastBackupVerifiedAt: '', verifiedBackupPath: '' })
    return { backupPath }
  }

  async restoreBackup(input: {
    backupPath: string
    destinationPath: string
    password?: string
  }): Promise<VaultSession> {
    const destination = ensureVaultExtension(input.destinationPath)
    if (existsSync(destination)) {
      throw new VaultServiceError('A vault already exists at the destination.', 'VAULT_EXISTS')
    }

    const zip = await JSZip.loadAsync(readFileSync(input.backupPath))
    const file = zip.file('vault.everkeep')
    if (!file) throw new VaultServiceError('This backup does not contain a vault.', 'INVALID_BACKUP')
    let bytes = await file.async('nodebuffer')
    let key: Buffer | null = null
    let staged: VaultDatabase | null = null
    try {
      if (isProtectedFile(bytes)) { const decoded = decodeProtectedFile(bytes, input.password); bytes = decoded.bytes; key = decoded.key }
      staged = openMemoryDatabase(bytes)
      if (!verifyIntegrity(staged).ok) throw new Error('Backup failed its database integrity check.')
      runMigrations(staged)
      const material = new VaultRepository(staged).getEncryptionMaterial()
      if (!key && material?.isPasswordProtected && material.encryptionSalt && material.encryptionParams && material.passwordVerifier) {
        key = this.encryption.verifyPassword(input.password ?? '', material.encryptionSalt, material.encryptionParams, material.passwordVerifier)
        if (!key) throw new VaultServiceError('Incorrect backup password.', 'PASSWORD_INCORRECT')
      }
      for (const attachment of new AttachmentRepository(staged).listAllActive()) {
        const embedded = staged.prepare('SELECT content FROM attachment_contents WHERE attachment_id = ?').get(attachment.id) as { content: Buffer } | undefined
        const entry = zip.file(`attachments/${attachment.id}/${attachment.filename}`)
        const content = embedded?.content ?? (entry ? await entry.async('nodebuffer') : null)
        if (!content) throw new Error(`Backup is missing ${attachment.filename}. Nothing has been restored.`)
        if (attachment.checksum && createHash('sha256').update(content).digest('hex') !== attachment.checksum) throw new Error(`Backup attachment failed verification: ${attachment.filename}.`)
        staged.prepare('INSERT OR REPLACE INTO attachment_contents (attachment_id, content) VALUES (?, ?)').run(attachment.id, content)
        staged.prepare('UPDATE attachments SET storage_path = ? WHERE id = ?').run(`vault:${attachment.id}`, attachment.id)
      }
      ensureParentDirectory(destination)
      if (existsSync(destination)) throw new VaultServiceError('A file already exists at the destination.', 'VAULT_EXISTS')
      atomicWrite(destination, key ? encodeProtectedFile(staged.serialize(), key, material!) : staged.serialize())
    } finally {
      if (staged) closeDatabase(staged)
      bytes.fill(0)
      this.encryption.clearKey(key)
    }
    return this.openVault({ filePath: destination, password: input.password })
  }

  getHandoff() { return new HandoffRepository(this.requireOpenDb()).get() }
  updateHandoff(input: HandoffInput) { return new HandoffRepository(this.requireOpenDb()).update(input) }

  async verifyBackup(input: { backupPath: string; password?: string }): Promise<BackupCheck> {
    this.requireOpenDb()
    const zip = await JSZip.loadAsync(readFileSync(input.backupPath))
    const file = zip.file('vault.everkeep')
    if (!file) throw new VaultServiceError('This is not an Everkeep backup.', 'INVALID_BACKUP')
    let bytes = await file.async('nodebuffer')
    let key: Buffer | null = null
    let db: VaultDatabase | null = null
    try {
      if (isProtectedFile(bytes)) {
        const decoded = decodeProtectedFile(bytes, input.password)
        bytes = decoded.bytes
        key = decoded.key
      }
      db = openMemoryDatabase(bytes)
      if (!verifyIntegrity(db).ok) throw new Error('The backup failed its database integrity check.')
      runMigrations(db)
      const metadata = new VaultRepository(db).getMetadata()
      if (!metadata) throw new Error('The backup has no vault metadata.')
      const material = new VaultRepository(db).getEncryptionMaterial()
      if (!key && material?.isPasswordProtected && material.encryptionSalt && material.encryptionParams && material.passwordVerifier) {
        key = this.encryption.verifyPassword(input.password ?? '', material.encryptionSalt, material.encryptionParams, material.passwordVerifier)
        if (!key) throw new Error('Enter the password used when this backup was made.')
      }
      const attachments = new AttachmentRepository(db).listAllActive()
      for (const attachment of attachments) {
        const embedded = db.prepare('SELECT content FROM attachment_contents WHERE attachment_id = ?').get(attachment.id) as { content: Buffer } | undefined
        const archived = zip.file(`attachments/${attachment.id}/${attachment.filename}`)
        const content = embedded?.content ?? (archived ? await archived.async('nodebuffer') : null)
        if (!content) throw new Error(`Backup is missing ${attachment.filename}.`)
        if (attachment.checksum && createHash('sha256').update(content).digest('hex') !== attachment.checksum) throw new Error(`Backup attachment failed verification: ${attachment.filename}.`)
      }
      const result = { vaultName: metadata.name, attachmentCount: attachments.length, checkedAt: new Date().toISOString(), matchesCurrentVault: metadata.id === this.getStatus().session?.metadata.id }
      if (result.matchesCurrentVault) new HandoffRepository(this.requireOpenDb()).update({ lastBackupVerifiedAt: result.checkedAt, verifiedBackupPath: input.backupPath })
      return result
    } finally {
      if (db) closeDatabase(db)
      bytes.fill(0)
      this.encryption.clearKey(key)
    }
  }

  getExportCatalog() { return new ExportService(this.requireOpenDb(), this.encryption, this.encryptionKey).catalog() }
  previewReport(input: ExportOptions): { html: string; token: string } {
    this.reportPreview = { token: randomUUID(), html: new ExportService(this.requireOpenDb(), this.encryption, this.encryptionKey).buildHtml(this.getStatus().session!.metadata, { ...input, includeSensitive: this.isPaid() && input.includeSensitive }, !this.isPaid()) }
    return this.reportPreview
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
    return this.accountRepo().list().map(account => ({...account, login:this.recordLogins().get('account',account.id)}))
  }

  createAccount(input: CreateAccountInput): Account {
    return withTransaction(this.requireOpenDb(), () => {
      this.validateLogin(input.login)
      const account = this.accountRepo().create(input)
      this.recordLogins().save('account',account.id,input.login,() => this.assertCanCreateEntry())
      return {...account,login:this.recordLogins().get('account',account.id)}
    })
  }

  updateAccount(input: UpdateAccountInput): Account {
    return withTransaction(this.requireOpenDb(), () => {
      this.validateLogin(input.login)
      const account = this.accountRepo().update(input)
      this.recordLogins().save('account',account.id,input.login,() => this.assertCanCreateEntry())
      return {...account,login:this.recordLogins().get('account',account.id)}
    })
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

  private recordLogins() { return new RecordLoginRepository(this.requireOpenDb(),this.entryRepo()) }
  private withLogin(entry: VaultEntry): VaultEntry {
    return entry.section === 'digital' ? {...entry,linkedRecords:this.recordLogins().references(entry.id)} : {...entry,login:this.recordLogins().get('entry',entry.id)}
  }
  private validateLogin(login: RecordLoginInput | null | undefined) {
    if (!login) return
    RecordLoginSchema.parse(login)
    if (login.password && !this.encryptionKey) throw new VaultServiceError('Enable vault password protection in Settings before storing a login password.', 'PASSWORD_PROTECTION_REQUIRED')
  }
  private validateEntryLogin(section: VaultSectionId, login: RecordLoginInput | null | undefined, sensitive?: Record<string,string>) {
    if (section === 'digital' && login) throw new Error('A digital account cannot have another login attached to it.')
    this.validateLogin(login)
    if (section === 'digital' && sensitive?.password && !this.encryptionKey) throw new VaultServiceError('Enable vault password protection in Settings before storing a login password.', 'PASSWORD_PROTECTION_REQUIRED')
  }

  listEntries(section: VaultSectionId): VaultEntry[] {
    return this.entryRepo().list(section).map(entry => this.withLogin(entry))
  }

  createEntry(input: CreateVaultEntryInput): VaultEntry {
    return withTransaction(this.requireOpenDb(), () => {
      this.validateEntryLogin(input.section,input.login,input.sensitiveFields)
      this.assertCanCreateEntry()
      const entry = this.entryRepo().create(input)
      this.recordLogins().save('entry',entry.id,input.login,() => this.assertCanCreateEntry())
      return this.withLogin(entry)
    })
  }

  updateEntry(input: UpdateVaultEntryInput): VaultEntry {
    return withTransaction(this.requireOpenDb(), () => {
      const current = this.entryRepo().getById(input.id)
      if (!current) throw new Error('Entry not found')
      this.validateEntryLogin(current.section,input.login,input.sensitiveFields)
      const entry = this.entryRepo().update(input)
      this.recordLogins().save('entry',entry.id,input.login,() => this.assertCanCreateEntry())
      return this.withLogin(entry)
    })
  }

  archiveEntry(id: string): { archived: boolean } {
    return { archived: this.entryRepo().archive(id) }
  }

  markEntryReviewed(id: string): VaultEntry {
    return this.entryRepo().markReviewed(id)
  }

  listAttachments(entryId: string): Attachment[] {
    return this.attachmentService().listForEntry(entryId)
  }

  attachFile(entryId: string, sourcePath: string): Attachment {
    this.assertCanAttachFile()
    try {
      return this.attachmentService().attachFromPath(entryId, sourcePath)
    } catch (error) {
      if (error instanceof AttachmentServiceError) {
        throw new VaultServiceError(error.message, error.code)
      }
      throw error
    }
  }

  async openAttachment(id: string): Promise<{ opened: boolean }> {
    try {
      return await this.attachmentService().open(id)
    } catch (error) {
      if (error instanceof AttachmentServiceError) {
        throw new VaultServiceError(error.message, error.code)
      }
      throw error
    }
  }

  revealAttachment(id: string): { revealed: boolean } {
    try {
      return this.attachmentService().revealInFolder(id)
    } catch (error) {
      if (error instanceof AttachmentServiceError) {
        throw new VaultServiceError(error.message, error.code)
      }
      throw error
    }
  }

  removeAttachment(id: string): { removed: boolean } {
    return this.attachmentService().remove(id)
  }

  listReviewItems(): ReviewItem[] {
    return new ReviewService(this.requireOpenDb()).listStaleItems()
  }

  exportReport(input: ExportReportInput): { path: string } {
    const status = this.getStatus()
    if (!status.session) {
      throw new VaultServiceError('No vault is currently open.', 'VAULT_NOT_OPEN')
    }
    this.requireOpenDb()
    if (input.previewToken) {
      if (input.previewToken !== this.reportPreview?.token) throw new VaultServiceError('This preview has expired. Preview the packet again.', 'PREVIEW_EXPIRED')
      writeFileSync(input.destinationPath, this.reportPreview.html, { encoding: 'utf8', mode: 0o600 })
      return { path: input.destinationPath }
    }
    const paid = this.isPaid()
    return new ExportService(this.requireOpenDb(), this.encryption, this.encryptionKey).writeReport(
      status.session.metadata,
      {
        ...input,
        includeSensitive: paid ? input.includeSensitive : false
      },
      { watermark: !paid }
    )
  }

  enablePassword(password: string): VaultSession {
    return this.rotatePassword('', password)
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

  private entryRepo(): EntryRepository {
    this.requireOpenDb()
    return new EntryRepository(this.db!, this.encryption, this.encryptionKey)
  }

  private attachmentService(): AttachmentService {
    const metadata = new VaultRepository(this.requireOpenDb()).getMetadata()
    if (!metadata) {
      throw new VaultServiceError('Vault metadata is missing.', 'VAULT_INVALID')
    }
    return new AttachmentService(
      this.db!,
      metadata.id,
      this.attachmentsRootFactory(metadata.id),
      Boolean(this.encryptionKey)
    )
  }

  private isPaid(): boolean {
    return this.licenseService?.isPaid() ?? false
  }

  private assertCanCreateEntry(): void {
    if (this.isPaid()) return
    const count = this.entryRepo().countActive()
    if (count >= FREE_ENTRY_CAP) {
      throw new VaultServiceError(
        `Free Everkeep includes up to ${FREE_ENTRY_CAP} entries. Upgrade to Lifetime to add more — your vault stays open and readable forever.`,
        'FREEMIUM_LIMIT'
      )
    }
  }

  private assertCanAttachFile(): void {
    if (this.isPaid()) return
    const count = new AttachmentRepository(this.requireOpenDb()).countActive()
    if (count >= FREE_ATTACHMENT_CAP) {
      throw new VaultServiceError(
        `Free Everkeep includes up to ${FREE_ATTACHMENT_CAP} attachments. Upgrade to Lifetime to add more — your vault stays open and readable forever.`,
        'FREEMIUM_LIMIT'
      )
    }
  }

  private requireOpenDb(): VaultDatabase {
    if (this.isLocked) throw new VaultServiceError('This vault is locked.', 'VAULT_LOCKED')
    if (!this.db || !this.filePath) {
      throw new VaultServiceError('No vault is currently open.', 'VAULT_NOT_OPEN')
    }
    if (this.isLocked) {
      throw new VaultServiceError('This vault is locked.', 'VAULT_LOCKED')
    }
    return this.db
  }

  private fileDigest(): string | null {
    return this.filePath && existsSync(this.filePath) ? createHash('sha256').update(readFileSync(this.filePath)).digest('hex') : null
  }

  private installPersistence(): void {
    if (this.db && this.encryptionKey) setDatabasePersistence(this.db, () => this.persistProtectedVault())
  }

  private persistProtectedVault(): void {
    if (!this.db || !this.encryptionKey || !this.filePath) return
    if (this.savedDigest && this.fileDigest() !== this.savedDigest) throw new VaultServiceError('The vault file changed outside this session. Reopen it before making more changes.', 'VAULT_CHANGED')
    const material = new VaultRepository(this.db).getEncryptionMaterial()!
    atomicWrite(this.filePath, encodeProtectedFile(this.db.serialize(), this.encryptionKey, material))
    this.savedDigest = this.fileDigest()
  }

  private removeMigratedAttachments(paths: string[], vaultId: string): void {
    if (!paths.length) return
    const root = resolve(this.attachmentsRootFactory(vaultId)) + sep
    for (const path of paths) {
      if (resolve(path).startsWith(root) && existsSync(path)) unlinkSync(path)
    }
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

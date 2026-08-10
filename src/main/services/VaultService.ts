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
import { PersonRepository } from '../repositories/PersonRepository'
import { RecentVaultsStore } from '../repositories/RecentVaultsStore'
import { VaultRepository } from '../repositories/VaultRepository'
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
}

export class VaultService {
  private db: VaultDatabase | null = null
  private filePath: string | null = null
  private isLocked = false
  private readonly recentStore: RecentVaultsStore
  private readonly recoveryDirectory: string | null
  private readonly maxRecoveryCopies: number

  constructor(options: VaultServiceOptions = {}) {
    if (!options.recentStore) {
      throw new Error('VaultService requires a RecentVaultsStore')
    }
    this.recentStore = options.recentStore
    this.recoveryDirectory = options.recoveryDirectory ?? null
    this.maxRecoveryCopies = options.maxRecoveryCopies ?? 5
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
      const metadata = repo.createMetadata({
        name: input.name,
        householdName: input.householdName,
        ownerFirstName: input.ownerFirstName,
        ownerMiddleName: input.ownerMiddleName,
        ownerLastName: input.ownerLastName,
        ownerPreferredName: input.ownerPreferredName,
        ownerDateOfBirth: input.ownerDateOfBirth,
        spousePartnerName: input.spousePartnerName,
        // Password encryption lands in Step 4; store flag for UI/flow continuity.
        isPasswordProtected: Boolean(input.password),
        passwordVerifier: null,
        encryptionSalt: null,
        encryptionParams: null
      })

      this.db = db
      this.filePath = filePath
      this.isLocked = false

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

    const metadata = new VaultRepository(db).getMetadata()
    if (!metadata) {
      closeDatabase(db)
      throw new VaultServiceError('Vault metadata is missing.', 'VAULT_INVALID')
    }

    // Full password verification arrives in Step 4.
    if (metadata.isPasswordProtected && !input.password) {
      closeDatabase(db)
      throw new VaultServiceError('This vault is password protected.', 'PASSWORD_REQUIRED')
    }

    this.db = db
    this.filePath = filePath
    this.isLocked = false

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

  closeVault(): { closed: boolean } {
    if (this.db) {
      this.createRecoveryCopy()
      closeDatabase(this.db)
    }
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

  getDatabaseForTests(): VaultDatabase | null {
    return this.db
  }

  private personRepo(): PersonRepository {
    return new PersonRepository(this.requireOpenDb())
  }

  private requireOpenDb(): VaultDatabase {
    if (!this.db || !this.filePath || this.isLocked) {
      throw new VaultServiceError('No vault is currently open.', 'VAULT_NOT_OPEN')
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

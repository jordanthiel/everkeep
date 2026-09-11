import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { LicenseState } from '../../shared/types/license'
import { LicenseVerificationError, verifyLicenseKey } from '../license'

const LICENSE_FILE_NAME = 'license.json'

interface StoredLicense {
  key: string
  email: string
  activatedAt: string
}

export class LicenseError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'LicenseError'
  }
}

/**
 * Machine-level license store. The license is per computer (per household),
 * not per vault: it lives next to the app's userData, never inside a vault.
 */
export class LicenseService {
  private readonly filePath: string

  constructor(userDataDir: string) {
    mkdirSync(userDataDir, { recursive: true })
    this.filePath = join(userDataDir, LICENSE_FILE_NAME)
  }

  getStatus(): LicenseState {
    const stored = this.readStored()
    if (!stored) return { state: 'trial' }
    // Re-verify on every read so a tampered file falls back to trial.
    try {
      verifyLicenseKey(stored.key)
    } catch {
      return { state: 'trial' }
    }
    return { state: 'licensed', email: stored.email, activatedAt: stored.activatedAt }
  }

  isLicensed(): boolean {
    return this.getStatus().state === 'licensed'
  }

  activate(rawKey: string): LicenseState {
    const key = rawKey.trim()
    if (!key) {
      throw new LicenseError('EMPTY_KEY', 'Enter a license key to activate Everkeep.')
    }
    let payload
    try {
      payload = verifyLicenseKey(key)
    } catch (error) {
      const message =
        error instanceof LicenseVerificationError
          ? error.message
          : 'That license key could not be verified.'
      throw new LicenseError('INVALID_KEY', message)
    }
    const stored: StoredLicense = {
      key,
      email: payload.email,
      activatedAt: new Date().toISOString()
    }
    writeFileSync(this.filePath, JSON.stringify(stored, null, 2), 'utf8')
    return { state: 'licensed', email: stored.email, activatedAt: stored.activatedAt }
  }

  deactivate(): void {
    if (existsSync(this.filePath)) {
      unlinkSync(this.filePath)
    }
  }

  private readStored(): StoredLicense | null {
    if (!existsSync(this.filePath)) return null
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<StoredLicense>
      if (typeof parsed.key !== 'string' || typeof parsed.email !== 'string') return null
      return {
        key: parsed.key,
        email: parsed.email,
        activatedAt: typeof parsed.activatedAt === 'string' ? parsed.activatedAt : new Date(0).toISOString()
      }
    } catch {
      return null
    }
  }
}

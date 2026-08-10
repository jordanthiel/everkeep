import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { RecentVaultsStore } from '../src/main/repositories/RecentVaultsStore'
import {
  EncryptionService,
  TEST_ARGON2_PARAMS
} from '../src/main/security/EncryptionService'
import { VaultService, VaultServiceError } from '../src/main/services/VaultService'

describe('EncryptionService', () => {
  const crypto = new EncryptionService()

  it('encrypts and decrypts with AES-256-GCM', () => {
    const material = crypto.createPasswordProtection('test-password-123', TEST_ARGON2_PARAMS)
    const payload = crypto.encrypt('4111111111111111', material.key)
    expect(payload).not.toContain('4111111111111111')
    expect(crypto.decrypt(payload, material.key)).toBe('4111111111111111')
    crypto.clearKey(material.key)
  })

  it('verifyPassword accepts the correct password and rejects the wrong one', () => {
    const material = crypto.createPasswordProtection('correct horse battery', TEST_ARGON2_PARAMS)
    const params = crypto.serializeParams(material.params)

    const good = crypto.verifyPassword(
      'correct horse battery',
      material.salt,
      params,
      material.verifier
    )
    expect(good).not.toBeNull()
    crypto.clearKey(good)

    const bad = crypto.verifyPassword('wrong-password', material.salt, params, material.verifier)
    expect(bad).toBeNull()
    crypto.clearKey(material.key)
  })
})

describe('Vault encryption workflow', () => {
  const dirs: string[] = []

  function tempDir(prefix: string): string {
    const dir = mkdtempSync(join(tmpdir(), prefix))
    dirs.push(dir)
    return dir
  }

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  function makeService(root: string): VaultService {
    return new VaultService({
      recentStore: new RecentVaultsStore(join(root, 'recent.json')),
      recoveryDirectory: join(root, 'recovery'),
      argon2Params: TEST_ARGON2_PARAMS
    })
  }

  it('requires password, rejects incorrect password, and decrypts sensitive fields when unlocked', () => {
    const root = tempDir('everkeep-enc-')
    const vaultPath = join(root, 'Secure.everkeep')
    const service = makeService(root)

    service.createVault({
      name: 'Secure',
      filePath: vaultPath,
      ownerFirstName: 'Alex',
      ownerLastName: 'Morgan',
      password: 'super-secret-pass'
    })

    const person = service.listPeople()[0]
    expect(person).toBeTruthy()

    service.createAccount({
      institution: 'Fidelity',
      accountName: 'Roth IRA',
      accountType: 'roth_ira',
      lastFour: '2941',
      fullAccountNumber: '998877665544',
      beneficiaries: person
        ? [
            {
              personId: person.id,
              designationType: 'primary',
              percentage: 100
            }
          ]
        : []
    })

    const beforeClose = service.listAccounts()[0]
    expect(beforeClose?.fullAccountNumber).toBe('998877665544')

    service.closeVault()
    expect(service.getEncryptionKeyForTests()).toBeNull()

    expect(() => service.openVault({ filePath: vaultPath })).toThrow(VaultServiceError)
    expect(() =>
      service.openVault({ filePath: vaultPath, password: 'wrong-password' })
    ).toThrow(/incorrect password/i)

    service.openVault({ filePath: vaultPath, password: 'super-secret-pass' })
    const account = service.listAccounts()[0]
    expect(account?.fullAccountNumber).toBe('998877665544')
    expect(account?.lastFour).toBe('2941')

    const locked = service.lockVault()
    expect(locked.isLocked).toBe(true)
    expect(service.getEncryptionKeyForTests()).toBeNull()
    expect(() => service.listAccounts()).toThrow(/locked/i)

    service.unlockVault('super-secret-pass')
    expect(service.listAccounts()[0]?.fullAccountNumber).toBe('998877665544')
    service.closeVault()
  })

  it('keeps unprotected vaults usable without a password', () => {
    const root = tempDir('everkeep-plain-')
    const vaultPath = join(root, 'Open.everkeep')
    const service = makeService(root)

    service.createVault({
      name: 'Open',
      filePath: vaultPath,
      ownerFirstName: 'Sam',
      ownerLastName: 'Morgan'
    })
    service.createAccount({
      institution: 'Chase',
      accountType: 'checking',
      fullAccountNumber: '123456789'
    })
    service.closeVault()

    service.openVault({ filePath: vaultPath })
    expect(service.listAccounts()[0]?.fullAccountNumber).toBe('123456789')
    service.closeVault()
  })
})

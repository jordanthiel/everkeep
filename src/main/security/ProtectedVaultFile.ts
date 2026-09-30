import { z } from 'zod'
import type { OwnerProtection } from '../../shared/types/vault'
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { EncryptionService } from './EncryptionService'

export interface VaultEnvelope {
  format: 'everkeep-encrypted' | 'everkeep-owner-encrypted'
  version: 1
  owner?: OwnerProtection
  salt: string
  params: string
  verifier: string
  payload: string
}

export function isProtectedFile(data: Buffer): boolean {
  return data.subarray(0, 16).toString() !== 'SQLite format 3\u0000'
}

const OwnerSchema = z.object({ vaultId: z.string().uuid(), ownerId: z.string().uuid(), email: z.string().email() }).strict()
export function ownerProtection(data: Buffer): OwnerProtection | null {
  if (!isProtectedFile(data)) return null
  const envelope = JSON.parse(data.toString('utf8')) as VaultEnvelope
  return envelope.format === 'everkeep-owner-encrypted' ? OwnerSchema.parse(envelope.owner) : null
}

export function decodeProtectedFile(data: Buffer, password?: string, authorizedOwner?: OwnerProtection): { bytes: Buffer; key: Buffer } {
  const envelope = JSON.parse(data.toString('utf8')) as VaultEnvelope
  if (!['everkeep-encrypted', 'everkeep-owner-encrypted'].includes(envelope.format) || envelope.version !== 1) throw new Error('Unsupported vault file format.')
  if (envelope.format === 'everkeep-owner-encrypted') {
    const owner = ownerProtection(data)!
    if (!authorizedOwner || owner.vaultId !== authorizedOwner.vaultId || owner.ownerId !== authorizedOwner.ownerId) {
      throw Object.assign(new Error('Verify the owner email online to open this vault.'), { code: 'EMAIL_REQUIRED' })
    }
  }
  const params = JSON.parse(envelope.params)
  if (![params.t, params.m, params.p, params.dkLen].every(Number.isInteger) || params.t < 1 || params.t > 10 || params.m < 8 || params.m > 262144 || params.p < 1 || params.p > 8 || params.dkLen !== 32) {
    throw new Error('Unsupported password protection parameters.')
  }
  if (!password) throw Object.assign(new Error('This vault is password protected.'), { code: 'PASSWORD_REQUIRED' })
  const crypto = new EncryptionService()
  const key = crypto.verifyPassword(password, envelope.salt, envelope.params, envelope.verifier)
  if (!key) throw Object.assign(new Error('Incorrect password.'), { code: 'PASSWORD_INCORRECT' })
  try {
    return { bytes: Buffer.from(crypto.decrypt(envelope.payload, key), 'base64'), key }
  } catch {
    crypto.clearKey(key)
    throw new Error('The protected vault failed authentication. Restore a known-good backup.')
  }
}

/** Replace only after the new file has been fully written and flushed. */
export function atomicWrite(path: string, content: string | Buffer): void {
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    const fd = openSync(temporary, 'wx', 0o600)
    try { writeFileSync(fd, content); fsyncSync(fd) } finally { closeSync(fd) }
    renameSync(temporary, path)
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary)
  }
}

export function encodeProtectedFile(bytes: Buffer, key: Buffer, material: { encryptionSalt: string | null; encryptionParams: string | null; passwordVerifier: string | null }, owner?: OwnerProtection | null): string {
  if (!material.encryptionSalt || !material.encryptionParams || !material.passwordVerifier) throw new Error('Missing vault protection metadata.')
  const envelope: VaultEnvelope = {
    format: owner ? 'everkeep-owner-encrypted' : 'everkeep-encrypted', version: 1,
    ...(owner ? { owner } : {}),
    salt: material.encryptionSalt, params: material.encryptionParams, verifier: material.passwordVerifier,
    payload: new EncryptionService().encrypt(bytes.toString('base64'), key)
  }
  return JSON.stringify(envelope)
}

export function readProtectedFile(path: string, password?: string) {
  return decodeProtectedFile(readFileSync(path), password)
}

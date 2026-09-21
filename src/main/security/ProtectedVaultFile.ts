import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { EncryptionService } from './EncryptionService'

export interface VaultEnvelope {
  format: 'everkeep-encrypted'
  version: 1
  salt: string
  params: string
  verifier: string
  payload: string
}

export function isProtectedFile(data: Buffer): boolean {
  return data.subarray(0, 16).toString() !== 'SQLite format 3\u0000'
}

export function decodeProtectedFile(data: Buffer, password?: string): { bytes: Buffer; key: Buffer } {
  const envelope = JSON.parse(data.toString('utf8')) as VaultEnvelope
  if (envelope.format !== 'everkeep-encrypted' || envelope.version !== 1) throw new Error('Unsupported vault file format.')
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

export function encodeProtectedFile(bytes: Buffer, key: Buffer, material: { encryptionSalt: string | null; encryptionParams: string | null; passwordVerifier: string | null }): string {
  if (!material.encryptionSalt || !material.encryptionParams || !material.passwordVerifier) throw new Error('Missing vault protection metadata.')
  const envelope: VaultEnvelope = {
    format: 'everkeep-encrypted', version: 1,
    salt: material.encryptionSalt, params: material.encryptionParams, verifier: material.passwordVerifier,
    payload: new EncryptionService().encrypt(bytes.toString('base64'), key)
  }
  return JSON.stringify(envelope)
}

export function readProtectedFile(path: string, password?: string) {
  return decodeProtectedFile(readFileSync(path), password)
}

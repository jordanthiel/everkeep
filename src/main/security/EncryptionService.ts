import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'crypto'
import { argon2id } from '@noble/hashes/argon2.js'

export interface Argon2Params {
  t: number
  m: number
  p: number
  dkLen: number
}

/** OWASP-recommended baseline for interactive Argon2id. */
export const DEFAULT_ARGON2_PARAMS: Argon2Params = {
  t: 2,
  m: 19456,
  p: 1,
  dkLen: 32
}

/** Faster params for automated tests only. */
export const TEST_ARGON2_PARAMS: Argon2Params = {
  t: 1,
  m: 8,
  p: 1,
  dkLen: 32
}

const VERIFIER_PLAINTEXT = 'everkeep-vault-ok-v1'
const PAYLOAD_VERSION = 1 as const

export interface EncryptedBlob {
  v: typeof PAYLOAD_VERSION
  iv: string
  ct: string
  tag: string
}

export interface PasswordProtectionMaterial {
  salt: string
  params: Argon2Params
  verifier: string
  key: Buffer
}

function toUint8(input: string | Buffer | Uint8Array): Uint8Array {
  if (typeof input === 'string') {
    return new TextEncoder().encode(input)
  }
  if (Buffer.isBuffer(input)) {
    return new Uint8Array(input)
  }
  return input
}

function bufferFromUint8(data: Uint8Array): Buffer {
  return Buffer.from(data)
}

export class EncryptionService {
  deriveKey(
    password: string,
    salt: Buffer | string,
    params: Argon2Params = DEFAULT_ARGON2_PARAMS
  ): Buffer {
    const saltBytes = typeof salt === 'string' ? Buffer.from(salt, 'base64') : salt
    const derived = argon2id(toUint8(password), toUint8(saltBytes), {
      t: params.t,
      m: params.m,
      p: params.p,
      dkLen: params.dkLen
    })
    return bufferFromUint8(derived)
  }

  encrypt(plaintext: string, key: Buffer): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    const blob: EncryptedBlob = {
      v: PAYLOAD_VERSION,
      iv: iv.toString('base64'),
      ct: encrypted.toString('base64'),
      tag: tag.toString('base64')
    }
    return JSON.stringify(blob)
  }

  decrypt(payload: string, key: Buffer): string {
    let blob: EncryptedBlob
    try {
      blob = JSON.parse(payload) as EncryptedBlob
    } catch {
      throw new Error('Invalid encrypted payload')
    }

    if (blob.v !== PAYLOAD_VERSION || !blob.iv || !blob.ct || !blob.tag) {
      throw new Error('Unsupported encrypted payload version')
    }

    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(blob.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(blob.tag, 'base64'))
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(blob.ct, 'base64')),
      decipher.final()
    ])
    return decrypted.toString('utf8')
  }

  createPasswordProtection(
    password: string,
    params: Argon2Params = DEFAULT_ARGON2_PARAMS
  ): PasswordProtectionMaterial {
    const salt = randomBytes(16)
    const key = this.deriveKey(password, salt, params)
    const verifier = this.encrypt(VERIFIER_PLAINTEXT, key)
    return {
      salt: salt.toString('base64'),
      params,
      verifier,
      key
    }
  }

  verifyPassword(
    password: string,
    salt: string,
    paramsJson: string,
    verifier: string
  ): Buffer | null {
    let params: Argon2Params
    try {
      params = JSON.parse(paramsJson) as Argon2Params
    } catch {
      return null
    }

    try {
      const key = this.deriveKey(password, salt, params)
      const plaintext = this.decrypt(verifier, key)
      if (plaintext !== VERIFIER_PLAINTEXT) {
        this.clearKey(key)
        return null
      }
      return key
    } catch {
      return null
    }
  }

  /**
   * Constant-time-ish rejection helper for wrong passwords when a key was derived
   * but verification failed elsewhere.
   */
  keysEqual(a: Buffer, b: Buffer): boolean {
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  }

  clearKey(key: Buffer | null | undefined): void {
    if (!key) return
    key.fill(0)
  }

  serializeParams(params: Argon2Params): string {
    return JSON.stringify(params)
  }
}

export const encryptionService = new EncryptionService()

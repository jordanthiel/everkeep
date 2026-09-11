import { createPublicKey, generateKeyPairSync, sign, verify } from 'crypto'
import type { LicensePayload } from '../shared/types/license'
import { LICENSE_PRODUCT_ID } from '../shared/types/license'

/**
 * Ed25519 public key (base64 SPKI) that license keys are verified against.
 *
 * Generated with `node scripts/mint-license.mjs --init` — the private half
 * stays on the machine that mints keys and is NEVER committed.
 *
 * This is a placeholder: replace with the real key before shipping a build
 * that enforces licensing, otherwise no minted key will verify.
 */
export const EVERKEEP_LICENSE_PUBLIC_KEY_B64 =
  'REPLACE_WITH_REAL_PUBLIC_KEY_FROM_mint-license.mjs_--init'

export const LICENSE_KEY_PREFIX = 'EK1'

const b64urlEncode = (buf: Buffer): string =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const b64urlDecode = (s: string): Buffer => {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(padded, 'base64')
}

export class LicenseVerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LicenseVerificationError'
  }
}

/** Verify a license key string. Returns the payload on success, throws otherwise. */
export function verifyLicenseKey(key: string, publicKeyB64 = EVERKEEP_LICENSE_PUBLIC_KEY_B64): LicensePayload {
  const trimmed = key.trim()
  const parts = trimmed.split('.')
  if (parts.length !== 3 || parts[0] !== LICENSE_KEY_PREFIX) {
    throw new LicenseVerificationError('That does not look like an Everkeep license key.')
  }
  const [, payloadB64, signatureB64] = parts
  let payload: LicensePayload
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8')) as LicensePayload
  } catch {
    throw new LicenseVerificationError('That license key is malformed.')
  }
  if (payload.v !== 1 || payload.product !== LICENSE_PRODUCT_ID || typeof payload.email !== 'string') {
    throw new LicenseVerificationError('That license key is not valid for this product.')
  }
  let publicKey: ReturnType<typeof createPublicKey>
  try {
    publicKey = createPublicKey({
      key: Buffer.from(publicKeyB64, 'base64'),
      format: 'der',
      type: 'spki'
    })
  } catch {
    throw new LicenseVerificationError('License verification is not configured in this build.')
  }
  // Ed25519 signs the message directly: algorithm must be null.
  const valid = verify(null, Buffer.from(payloadB64, 'utf8'), publicKey, b64urlDecode(signatureB64))
  if (!valid) {
    throw new LicenseVerificationError('That license key is invalid. Check for typos and try again.')
  }
  return payload
}

/** Mint a license key. Used by scripts/mint-license.mjs (private key never ships). */
export function mintLicenseKey(payload: LicensePayload, privateKeyPem: string): string {
  const payloadB64 = b64urlEncode(Buffer.from(JSON.stringify(payload), 'utf8'))
  // Ed25519 signs the message directly: algorithm must be null.
  const signature = sign(null, Buffer.from(payloadB64, 'utf8'), privateKeyPem)
  return `${LICENSE_KEY_PREFIX}.${payloadB64}.${b64urlEncode(signature)}`
}

/** Generate a fresh Ed25519 keypair for license minting. */
export function generateLicenseKeypair(): { publicKeyB64: string; privateKeyPem: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const publicDer = publicKey.export({ format: 'der', type: 'spki' })
  const privatePem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString()
  return { publicKeyB64: publicDer.toString('base64'), privateKeyPem: privatePem }
}

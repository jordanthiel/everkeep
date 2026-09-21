import * as ed from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha2.js'
import type { LicenseClaims, LicenseProduct } from '../types/license'

ed.etc.sha512Sync = (...messages: Uint8Array[]) => sha512(ed.etc.concatBytes(...messages))

const LICENSE_PREFIX = 'ek1'
const TEXT_ENCODER = new TextEncoder()
const TEXT_DECODER = new TextDecoder()

export class LicenseCryptoError extends Error {
  constructor(
    message: string,
    readonly code: 'INVALID_FORMAT' | 'INVALID_SIGNATURE' | 'INVALID_PAYLOAD'
  ) {
    super(message)
    this.name = 'LicenseCryptoError'
  }
}

function toBase64Url(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64url')
  }
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64url'))
  }
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

function parsePublicKey(publicKeyBase64Url: string): Uint8Array {
  const key = fromBase64Url(publicKeyBase64Url)
  if (key.length !== 32) {
    throw new LicenseCryptoError('License publisher key is invalid.', 'INVALID_PAYLOAD')
  }
  return key
}

function parsePrivateKey(privateKeyBase64Url: string): Uint8Array {
  const key = fromBase64Url(privateKeyBase64Url)
  if (key.length !== 32) {
    throw new LicenseCryptoError('License signing key is invalid.', 'INVALID_PAYLOAD')
  }
  return key
}

function assertClaims(value: unknown): LicenseClaims {
  if (!value || typeof value !== 'object') {
    throw new LicenseCryptoError("That file doesn't match Everkeep's publisher key.", 'INVALID_PAYLOAD')
  }
  const record = value as Record<string, unknown>
  const product = record.product
  if (product !== 'lifetime' && product !== 'family') {
    throw new LicenseCryptoError("That file doesn't match Everkeep's publisher key.", 'INVALID_PAYLOAD')
  }
  if (typeof record.v !== 'number' || record.v !== 1) {
    throw new LicenseCryptoError("That file doesn't match Everkeep's publisher key.", 'INVALID_PAYLOAD')
  }
  if (typeof record.email !== 'string' || !record.email.trim()) {
    throw new LicenseCryptoError("That file doesn't match Everkeep's publisher key.", 'INVALID_PAYLOAD')
  }
  if (typeof record.seats !== 'number' || !Number.isInteger(record.seats) || record.seats < 1) {
    throw new LicenseCryptoError("That file doesn't match Everkeep's publisher key.", 'INVALID_PAYLOAD')
  }
  if (typeof record.issuedAt !== 'string' || Number.isNaN(Date.parse(record.issuedAt))) {
    throw new LicenseCryptoError("That file doesn't match Everkeep's publisher key.", 'INVALID_PAYLOAD')
  }
  if (typeof record.orderId !== 'string' || !record.orderId.trim()) {
    throw new LicenseCryptoError("That file doesn't match Everkeep's publisher key.", 'INVALID_PAYLOAD')
  }

  return {
    v: 1,
    email: record.email.trim(),
    product: product as LicenseProduct,
    seats: record.seats,
    issuedAt: record.issuedAt,
    orderId: record.orderId.trim()
  }
}

/** Canonical payload bytes used for signing/verification. */
export function encodeLicensePayload(claims: LicenseClaims): Uint8Array {
  const canonical = {
    v: claims.v,
    email: claims.email,
    product: claims.product,
    seats: claims.seats,
    issuedAt: claims.issuedAt,
    orderId: claims.orderId
  }
  return TEXT_ENCODER.encode(JSON.stringify(canonical))
}

export function signLicense(claims: LicenseClaims, privateKeyBase64Url: string): string {
  const privateKey = parsePrivateKey(privateKeyBase64Url)
  const payload = encodeLicensePayload(claims)
  const signature = ed.sign(payload, privateKey)
  return `${LICENSE_PREFIX}.${toBase64Url(payload)}.${toBase64Url(signature)}`
}

export function verifyLicense(licenseKey: string, publicKeyBase64Url: string): LicenseClaims {
  const trimmed = licenseKey.trim()
  const parts = trimmed.split('.')
  if (parts.length !== 3 || parts[0] !== LICENSE_PREFIX || !parts[1] || !parts[2]) {
    throw new LicenseCryptoError(
      "That file doesn't match Everkeep's publisher key.",
      'INVALID_FORMAT'
    )
  }

  const payloadBytes = fromBase64Url(parts[1])
  const signature = fromBase64Url(parts[2])
  const publicKey = parsePublicKey(publicKeyBase64Url)

  const valid = ed.verify(signature, payloadBytes, publicKey)
  if (!valid) {
    throw new LicenseCryptoError(
      "That file doesn't match Everkeep's publisher key.",
      'INVALID_SIGNATURE'
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(TEXT_DECODER.decode(payloadBytes))
  } catch {
    throw new LicenseCryptoError(
      "That file doesn't match Everkeep's publisher key.",
      'INVALID_PAYLOAD'
    )
  }

  return assertClaims(parsed)
}

export function publicKeyFromPrivate(privateKeyBase64Url: string): string {
  const privateKey = parsePrivateKey(privateKeyBase64Url)
  return toBase64Url(ed.getPublicKey(privateKey))
}

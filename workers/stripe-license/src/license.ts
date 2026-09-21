import * as ed from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha2.js'

ed.etc.sha512Sync = (...messages: Uint8Array[]) => sha512(ed.etc.concatBytes(...messages))

export interface LicenseClaims {
  v: 1
  email: string
  product: 'lifetime' | 'family'
  seats: number
  issuedAt: string
  orderId: string
}

const TEXT_ENCODER = new TextEncoder()

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

export function mintLicense(claims: LicenseClaims, privateKeyBase64Url: string): string {
  const privateKey = fromBase64Url(privateKeyBase64Url)
  if (privateKey.length !== 32) {
    throw new Error('LICENSE_PRIVATE_KEY must be a 32-byte Ed25519 seed (base64url).')
  }
  const payload = TEXT_ENCODER.encode(
    JSON.stringify({
      v: claims.v,
      email: claims.email,
      product: claims.product,
      seats: claims.seats,
      issuedAt: claims.issuedAt,
      orderId: claims.orderId
    })
  )
  const signature = ed.sign(payload, privateKey)
  return `ek1.${toBase64Url(payload)}.${toBase64Url(signature)}`
}

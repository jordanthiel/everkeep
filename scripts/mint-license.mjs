#!/usr/bin/env node
/**
 * Mint Everkeep license keys (Ed25519-signed, verified offline in the app).
 *
 *   node scripts/mint-license.mjs --init
 *     Generates a signing keypair. The private key is saved to
 *     ~/.everkeep-licensing/license-signing-key.pem (mode 0600, never committed).
 *     Prints the public-key constant to paste into src/main/license.ts.
 *
 *   node scripts/mint-license.mjs --email customer@example.com
 *     Mints and prints a license key for that email. Send it to the customer;
 *     they paste it into Settings → License.
 *
 * Flow: customer pays via the Stripe Payment Link on the website → you run this
 * script → you email them the key. Automate later when volume justifies it.
 */
import { generateKeyPairSync, sign } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const KEY_DIR = join(homedir(), '.everkeep-licensing')
const PRIVATE_KEY_PATH = join(KEY_DIR, 'license-signing-key.pem')
const PRODUCT_ID = 'everkeep-household'
const KEY_PREFIX = 'EK1'

const b64urlEncode = (buf) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function init() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const publicB64 = publicKey.export({ format: 'der', type: 'spki' }).toString('base64')
  const privatePem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString()
  mkdirSync(KEY_DIR, { recursive: true, mode: 0o700 })
  writeFileSync(PRIVATE_KEY_PATH, privatePem, { mode: 0o600 })
  console.log(`Private key saved to ${PRIVATE_KEY_PATH} (keep it secret, keep it backed up).\n`)
  console.log('Paste this into src/main/license.ts as EVERKEEP_LICENSE_PUBLIC_KEY_B64:\n')
  console.log(`  '${publicB64}'`)
}

function mint(email) {
  if (!existsSync(PRIVATE_KEY_PATH)) {
    console.error(`No signing key found. Run: node scripts/mint-license.mjs --init`)
    process.exit(1)
  }
  const privatePem = readFileSync(PRIVATE_KEY_PATH, 'utf8')
  const payload = { v: 1, product: PRODUCT_ID, email, iat: Math.floor(Date.now() / 1000) }
  const payloadB64 = b64urlEncode(Buffer.from(JSON.stringify(payload), 'utf8'))
  // Ed25519 signs the message directly: algorithm must be null.
  const signature = sign(null, Buffer.from(payloadB64, 'utf8'), privatePem)
  console.log(`${KEY_PREFIX}.${payloadB64}.${b64urlEncode(signature)}`)
}

const args = process.argv.slice(2)
if (args.includes('--init')) {
  init()
} else {
  const emailIdx = args.indexOf('--email')
  const email = emailIdx >= 0 ? args[emailIdx + 1] : null
  if (!email || !email.includes('@')) {
    console.error('Usage: node scripts/mint-license.mjs --email customer@example.com')
    process.exit(1)
  }
  mint(email)
}

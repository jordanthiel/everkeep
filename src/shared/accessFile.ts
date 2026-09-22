import { z } from 'zod'
import { SharedRecordSchema, type SharedRecord, type FileAccess, type SharedSnapshot, type SharingAccount } from './sharing'

export const AccessFileSchema = z.object({
  format: z.literal('everkeep-access'), version: z.literal(1), vaultId: z.string().uuid(), packageId: z.string().uuid(),
  owner: z.object({ id: z.string().uuid(), email: z.string().email() }), name: z.string().min(1).max(200),
  records: z.array(z.object({ id: z.string().uuid(), payload: z.string().max(100 * 1024 * 1024) })).max(10000)
}).strict().superRefine((file, context) => {
  if (new Set(file.records.map(record => record.id)).size !== file.records.length) context.addIssue({ code: 'custom', message: 'Duplicate encrypted records.' })
})
export type AccessFile = z.infer<typeof AccessFileSchema>
export const MAX_ACCESS_FILE_BYTES = 200 * 1024 * 1024
export const toBase64 = (bytes: Uint8Array): string => { let text = ''; for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(text) }
export const fromBase64 = (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0))
const encoder = new TextEncoder()
const context = (file: Pick<AccessFile, 'vaultId' | 'packageId' | 'owner'>, recordId: string) => encoder.encode(`everkeep-access:1:${file.vaultId}:${file.packageId}:${file.owner.id}:${recordId}`)
async function key(value: string) { const bytes = fromBase64(value); if (bytes.length !== 32) throw new Error('Invalid record key.'); return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']) }
export async function sealRecord(file: Pick<AccessFile, 'vaultId' | 'packageId' | 'owner'>, record: SharedRecord, attachments: Record<string, string>, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: context(file, record.id) }, await key(secret), encoder.encode(JSON.stringify({ record, attachments }))))
  const bytes = new Uint8Array(iv.length + ciphertext.length); bytes.set(iv); bytes.set(ciphertext, iv.length)
  return { id: record.id, payload: toBase64(bytes) }
}
export async function openRecord(file: AccessFile, recordId: string, access: FileAccess) {
  if (access.owner.id !== file.owner.id) throw new Error('The file owner does not match its registered owner.')
  const secret = access.keys[recordId], item = file.records.find(record => record.id === recordId)
  if (!secret || !item) throw new Error('This record is not available to your account.')
  const bytes = fromBase64(item.payload)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12), additionalData: context(file, recordId) }, await key(secret), bytes.slice(12))
  const value = z.object({ record: SharedRecordSchema, attachments: z.record(z.string()) }).parse(JSON.parse(new TextDecoder().decode(plain)))
  if (value.record.id !== recordId) throw new Error('The encrypted record identity is invalid.')
  return value
}
export async function createAccessFile(snapshot: SharedSnapshot, vaultId: string, packageId: string, owner: SharingAccount, keys: Record<string, string>, attachment: (id: string) => Promise<Uint8Array>): Promise<AccessFile> {
  const file: AccessFile = { format: 'everkeep-access', version: 1, vaultId, packageId, owner, name: snapshot.name, records: [] }
  let size = 0
  for (const record of snapshot.records) {
    const attachments: Record<string, string> = {}
    for (const item of record.attachments) { const bytes = await attachment(item.id); size += bytes.length * 1.4; if (size > MAX_ACCESS_FILE_BYTES) throw new Error('Shared files are limited to 200 MB.'); attachments[item.id] = toBase64(bytes) }
    const sealed = await sealRecord(file, record, attachments, keys[record.id]); file.records.push(sealed)
  }
  if (encoder.encode(JSON.stringify(file)).length > MAX_ACCESS_FILE_BYTES) throw new Error('Shared files are limited to 200 MB.')
  return file
}

import { closeSync, openSync, readSync, readFileSync, statSync } from 'fs'
import { AccessFileSchema, MAX_ACCESS_FILE_BYTES } from '../../shared/accessFile'
let pending: string | null = null
/** Only paths explicitly opened by the user are queued; never take a service URL from a file. */
export function queueAccessFile(path: string): string | null {
  if (!path.toLowerCase().endsWith('.everkeep')) return null
  const descriptor = openSync(path, 'r'), header = Buffer.alloc(512)
  try { readSync(descriptor, header, 0, header.length, 0) } finally { closeSync(descriptor) }
  if (!/"format"\s*:\s*"everkeep-access"/.test(header.toString('utf8'))) return null
  if (statSync(path).size > MAX_ACCESS_FILE_BYTES) throw new Error('Shared files are limited to 200 MB.')
  const text = readFileSync(path, 'utf8'), file = AccessFileSchema.parse(JSON.parse(text))
  pending = text
  return file.vaultId
}
export function takeAccessFile(): string | null { const value = pending; pending = null; return value }

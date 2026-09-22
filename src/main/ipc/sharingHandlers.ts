import { takeAccessFile } from '../files/AccessFileRequests'
import { dialog, ipcMain, shell } from 'electron'
import { writeFileSync } from 'fs'
import { basename } from 'path'
import { z } from 'zod'
import { GrantSchema, InvitationSchema } from '../../shared/sharing'
import { SharingService } from '../services/SharingService'
import type { VaultService } from '../services/VaultService'

export function registerSharingHandlers(vault: () => VaultService) {
  let instance: SharingService | null = null
  const service = () => { if (!instance) { instance = new SharingService(vault()); instance.start() } return instance }
  const idSchema = z.string().uuid()
  const emailSchema = z.string().trim().email().max(200)
  ipcMain.handle('sharing:status', async () => { await service().loadConfiguration().catch(() => {}); return service().status() })
  ipcMain.handle('sharing:requestCode', (_event, email) => service().requestCode(emailSchema.parse(email)))
  ipcMain.handle('sharing:verifyCode', (_event, value) => { const input = z.object({ challengeId: idSchema, email: emailSchema, code: z.string().regex(/^\d{6}$/) }).parse(value); return service().verifyCode(input.challengeId, input.email, input.code) })
  ipcMain.handle('sharing:logout', () => service().logout())
  ipcMain.handle('sharing:list', () => service().request('/vaults'))
  for (const [action, suffix, method] of [['get', '', 'GET'], ['members', '/members', 'GET'], ['accept', '/accept', 'POST']] as const) {
    ipcMain.handle(`sharing:${action}`, (_event, id) => service().request(`/vaults/${idSchema.parse(id)}${suffix}`, method, method === 'POST' ? {} : undefined))
  }
  ipcMain.handle('sharing:edit', (_event, value) => {
    const input = z.object({ id: idSchema, recordId: idSchema, input: z.object({ baseVersion: z.number().int().positive(), values: z.record(z.string().max(20000)) }) }).parse(value)
    return service().request(`/vaults/${input.id}/records/${input.recordId}`, 'PATCH', input.input)
  })
  ipcMain.handle('sharing:invite', async (_event, value) => {
    const { id, input } = z.object({ id: idSchema, input: InvitationSchema }).parse(value)
    if (input.password) {
      if (vault().getSharingLink()?.remoteId !== id) throw new Error('Open the original vault to include its password.')
      vault().verifySharingPassword(input.password)
    }
    if (vault().getStatus().session && !vault().getStatus().session?.isLocked && vault().getSharingLink()?.remoteId === id) await service().sync()
    return service().request(`/vaults/${id}/invite`, 'POST', input)
  })
  ipcMain.handle('sharing:grant', (_event, value) => { const { id, input } = z.object({ id: idSchema, input: GrantSchema }).parse(value); return service().request(`/vaults/${id}/grant`, 'PATCH', input) })
  ipcMain.handle('sharing:revoke', (_event, value) => { const { id, email } = z.object({ id: idSchema, email: emailSchema }).parse(value); return service().request(`/vaults/${id}/revoke`, 'POST', { email }) })
  ipcMain.handle('sharing:takeOpenFile', () => takeAccessFile())
  ipcMain.handle('sharing:registerFile', () => service().registerFile())
  ipcMain.handle('sharing:fileAccess', (_event, value) => { const { id, packageId } = z.object({ id: idSchema, packageId: idSchema }).parse(value); return service().request(`/vaults/${id}/file-packages/${packageId}`) })
  ipcMain.handle('sharing:saveSharedFile', async () => {
    const result = await dialog.showSaveDialog({ title: 'Save an access-controlled Everkeep file', defaultPath: 'shared vault.everkeep', filters: [{ name: 'Everkeep vault', extensions: ['everkeep'] }] })
    if (result.canceled || !result.filePath) return null
    const file = await service().createSharedFile()
    const destination = result.filePath.toLowerCase().endsWith('.everkeep') ? result.filePath : `${result.filePath}.everkeep`
    // Never replace the original or another existing file.
    writeFileSync(destination, file, { mode: 0o600, flag: 'wx' })
    return destination
  })
  ipcMain.handle('sharing:publish', () => service().publish())
  ipcMain.handle('sharing:snapshot', () => vault().getSharingSnapshot())
  ipcMain.handle('sharing:sync', (_event, value) => service().sync(value === undefined ? undefined : z.object({ revision: z.number().int().positive(), fingerprint: z.string().regex(/^[a-f0-9]{64}$/), choices: z.record(z.enum(['local', 'shared'])) }).parse(value)))
  ipcMain.handle('sharing:conflicts', () => service().getConflicts())
  ipcMain.handle('sharing:setEditing', (_event, value) => service().setEditing(z.boolean().parse(value)))
  ipcMain.handle('sharing:reveal', () => { const session = vault().getStatus().session; if (session) shell.showItemInFolder(session.filePath) })
  ipcMain.handle('sharing:saveCopy', async () => {
    const session = vault().getStatus().session
    if (!session || session.isLocked) throw new Error('Open your vault before saving a copy.')
    const result = await dialog.showSaveDialog({ title: 'Save an Everkeep file', defaultPath: basename(session.filePath).replace(/\.everkeep$/, ' copy.everkeep'), filters: [{ name: 'Everkeep vault', extensions: ['everkeep'] }] })
    if (result.canceled || !result.filePath) return null
    if (vault().getStatus().session?.filePath !== session.filePath || vault().getStatus().session?.isLocked) throw new Error('The active vault changed.')
    return (await vault().savePortableCopy(result.filePath)).path
  })
  ipcMain.handle('sharing:attachment', async (_event, value) => {
    const input = z.object({ id: idSchema, recordId: idSchema, attachmentId: idSchema }).parse(value)
    const file = await service().download(input.id, input.recordId, input.attachmentId)
    const result = await dialog.showSaveDialog({ title: 'Save shared attachment', defaultPath: basename(file.name) })
    if (!result.canceled && result.filePath) writeFileSync(result.filePath, file.bytes, { mode: 0o600 })
  })
  return () => { instance?.stop(); instance = null }
}

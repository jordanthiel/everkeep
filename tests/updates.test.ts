import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  execFile: vi.fn(),
  app: { isPackaged: true, getVersion: () => '0.4.3' }
}))
vi.mock('node:child_process', () => ({ execFile: mocks.execFile }))
vi.mock('electron', () => ({
  app: mocks.app,
  autoUpdater: new EventEmitter(),
  BrowserWindow: { getAllWindows: () => [] },
  shell: { openExternal: vi.fn() }
}))
vi.mock('electron-updater', () => ({
  autoUpdater: Object.assign(new EventEmitter(), {
    setFeedURL: vi.fn(), checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(), quitAndInstall: vi.fn()
  })
}))

import { autoUpdater as nativeUpdater } from 'electron'
import { autoUpdater } from 'electron-updater'
import { UpdateService } from '../src/main/services/UpdateService'

const downloadedUpdate = {
  version: '0.4.4', downloadedFile: '/tmp/update.zip', files: [],
  path: 'update.zip', sha512: 'test-checksum', releaseDate: '2026-09-24T00:00:00Z'
}

describe('update installation handoff', () => {
  let service: UpdateService
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('process', { ...process, platform: 'darwin', getuid: () => 501 })
    vi.clearAllMocks()
    mocks.app.isPackaged = true
    mocks.execFile.mockImplementation((_file, _args, _options, callback) => callback(null, '', ''))
    service = new UpdateService()
    service.start()
  })
  afterEach(() => {
    autoUpdater.removeAllListeners()
    nativeUpdater.removeAllListeners()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
  function stageUpdate() {
    autoUpdater.emit('update-downloaded', downloadedUpdate)
    nativeUpdater.emit('update-downloaded')
  }

  it('waits for native staging before allowing restart on macOS', async () => {
    autoUpdater.emit('update-downloaded', downloadedUpdate)
    expect(service.getStatus()).toMatchObject({ state: 'downloading', canInstall: false })
    await expect(service.install()).rejects.toThrow('not ready')
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled()
    nativeUpdater.emit('update-downloaded')
    expect(service.getStatus()).toMatchObject({ state: 'ready', canInstall: true, availableVersion: '0.4.4' })
  })

  it('starts the registered helper before quitting without killing an existing helper', async () => {
    stageUpdate()
    let complete!: (error: Error | null, stdout: string, stderr: string) => void
    mocks.execFile.mockImplementation((_file, _args, _options, callback) => { complete = callback })
    const install = service.install()
    expect(mocks.execFile).toHaveBeenCalledWith('/bin/launchctl',
      ['kickstart', 'gui/501/com.everkeep.app.ShipIt'], { timeout: 10_000 }, expect.any(Function))
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled()
    complete(null, '', '')
    await install
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledWith(true, true)
  })

  it('keeps the app open and permits retry if the installer cannot start', async () => {
    stageUpdate()
    mocks.execFile.mockImplementation((_file, _args, _options, callback) => callback(new Error('failed')))
    await expect(service.install()).rejects.toThrow('Everkeep will stay open')
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled()
    expect(service.getStatus()).toMatchObject({ state: 'ready', canInstall: true })
  })

  it('preserves a staged update across periodic checks and duplicate downloads', async () => {
    stageUpdate()
    await service.check({ userInitiated: false })
    await service.download()
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
    expect(autoUpdater.downloadUpdate).not.toHaveBeenCalled()
    expect(service.getStatus().canInstall).toBe(true)
  })

  it('uses the normal installer directly on Windows', async () => {
    vi.stubGlobal('process', { ...process, platform: 'win32' })
    autoUpdater.emit('update-downloaded', downloadedUpdate)
    await service.install()
    expect(mocks.execFile).not.toHaveBeenCalled()
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledWith(true, true)
  })

  it('does not enable restart when native verification fails', async () => {
    autoUpdater.emit('update-downloaded', downloadedUpdate)
    // electron-updater forwards native updater errors onto its own emitter.
    autoUpdater.emit('error', new Error('Signature verification failed'))
    expect(service.getStatus()).toMatchObject({ canInstall: false, message: 'Signature verification failed' })
    await expect(service.install()).rejects.toThrow('not ready')
    expect(mocks.execFile).not.toHaveBeenCalled()
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled()
  })
})

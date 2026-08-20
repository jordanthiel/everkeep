import { app, BrowserWindow, shell } from 'electron'
import { autoUpdater, type UpdateInfo } from 'electron-updater'
import { GITHUB_OWNER, GITHUB_REPO, RELEASES_LATEST_URL } from '../../shared/constants'
import { IpcChannels } from '../../shared/types/ipc'
import type { AppUpdateStatus } from '../../shared/types/appUpdate'

const STARTUP_CHECK_DELAY_MS = 4_000
const PERIODIC_CHECK_MS = 24 * 60 * 60 * 1000

function releaseNotes(info: UpdateInfo): string | undefined {
  const notes = info.releaseNotes
  if (!notes) return undefined
  if (typeof notes === 'string') {
    const trimmed = notes.replace(/<[^>]+>/g, '').trim()
    return trimmed ? trimmed.slice(0, 400) : undefined
  }
  const joined = notes
    .map((item) => item.note)
    .filter(Boolean)
    .join('\n')
    .replace(/<[^>]+>/g, '')
    .trim()
  return joined ? joined.slice(0, 400) : undefined
}

export class UpdateService {
  private status: AppUpdateStatus
  private started = false
  private lastDownloadPercent = -1

  constructor() {
    this.status = {
      state: app.isPackaged ? 'idle' : 'unsupported',
      currentVersion: app.getVersion(),
      releaseUrl: RELEASES_LATEST_URL,
      canInstall: false,
      message: app.isPackaged
        ? undefined
        : 'Update checks run in the installed app, not during development.'
    }
  }

  getStatus(): AppUpdateStatus {
    return this.status
  }

  start(): void {
    if (this.started) return
    this.started = true

    if (!app.isPackaged) {
      this.broadcast()
      return
    }

    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = false
    autoUpdater.logger = {
      info: (message) => console.log('[updater]', message),
      warn: (message) => console.warn('[updater]', message),
      error: (message) => console.error('[updater]', message),
      debug: (message) => console.debug('[updater]', message)
    }
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO
    })

    this.bindEvents()
    setTimeout(() => {
      void this.check({ userInitiated: false })
    }, STARTUP_CHECK_DELAY_MS)
    setInterval(() => {
      void this.check({ userInitiated: false })
    }, PERIODIC_CHECK_MS)
  }

  async check(options: { userInitiated: boolean }): Promise<AppUpdateStatus> {
    if (!app.isPackaged) {
      return this.set({
        state: 'unsupported',
        message: 'Update checks run in the installed app, not during development.'
      })
    }

    this.set({ state: 'checking', message: undefined, canInstall: false })
    try {
      await autoUpdater.checkForUpdates()
      return this.status
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to check for updates.'
      if (options.userInitiated) {
        return this.set({
          state: 'error',
          message: this.friendlyError(message),
          canInstall: false
        })
      }
      return this.set({ state: 'idle', message: undefined, canInstall: false })
    }
  }

  async download(): Promise<AppUpdateStatus> {
    if (!app.isPackaged) return this.status
    this.lastDownloadPercent = -1
    this.set({
      state: 'downloading',
      downloadPercent: 0,
      message: undefined,
      canInstall: false
    })
    try {
      await autoUpdater.downloadUpdate()
      return this.status
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to download the update.'
      return this.set({
        state: 'available',
        canInstall: false,
        message: `${this.friendlyError(message)} You can download it from the releases page instead.`
      })
    }
  }

  install(): void {
    autoUpdater.quitAndInstall(true, true)
  }

  async openReleasePage(): Promise<{ opened: boolean }> {
    await shell.openExternal(this.status.releaseUrl)
    return { opened: true }
  }

  private bindEvents(): void {
    autoUpdater.on('checking-for-update', () => {
      this.set({ state: 'checking', message: undefined })
    })

    autoUpdater.on('update-available', (info) => {
      this.set({
        state: 'available',
        availableVersion: info.version,
        canInstall: false,
        message: releaseNotes(info)
      })
    })

    autoUpdater.on('update-not-available', () => {
      this.set({
        state: 'upToDate',
        availableVersion: undefined,
        downloadPercent: undefined,
        canInstall: false,
        message: 'You have the latest version.'
      })
    })

    autoUpdater.on('download-progress', (progress) => {
      const percent = Math.round(progress.percent)
      if (percent === this.lastDownloadPercent) return
      this.lastDownloadPercent = percent
      this.set({
        state: 'downloading',
        downloadPercent: percent,
        canInstall: false,
        message: undefined
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      this.set({
        state: 'ready',
        availableVersion: info.version,
        downloadPercent: 100,
        canInstall: true,
        message: 'Restart Everkeep to install the update. Your vault file is not affected.'
      })
    })

    autoUpdater.on('error', (error) => {
      if (this.status.state === 'checking') return
      this.set({
        state: this.status.availableVersion ? 'available' : 'error',
        canInstall: false,
        message: this.friendlyError(error.message)
      })
    })
  }

  private friendlyError(message: string): string {
    const lower = message.toLowerCase()
    if (lower.includes('404') || lower.includes('cannot find channel') || lower.includes('latest.yml')) {
      return 'No published update was found yet. New versions appear here after a GitHub release that includes the updater files.'
    }
    if (lower.includes('net') || lower.includes('enotfound') || lower.includes('offline')) {
      return 'Could not reach the update server. Check your internet connection and try again.'
    }
    return message
  }

  private set(patch: Partial<AppUpdateStatus>): AppUpdateStatus {
    this.status = {
      ...this.status,
      currentVersion: app.getVersion(),
      releaseUrl: RELEASES_LATEST_URL,
      ...patch
    }
    this.broadcast()
    return this.status
  }

  private broadcast(): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue
      win.webContents.send(IpcChannels.app.updateStatus, this.status)
    }
  }
}

let updateService: UpdateService | null = null

export function getUpdateService(): UpdateService {
  if (!updateService) {
    updateService = new UpdateService()
  }
  return updateService
}

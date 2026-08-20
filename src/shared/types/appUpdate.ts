export type AppUpdateState =
  | 'idle'
  | 'checking'
  | 'upToDate'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'error'
  | 'unsupported'

export interface AppUpdateStatus {
  state: AppUpdateState
  currentVersion: string
  availableVersion?: string
  downloadPercent?: number
  message?: string
  releaseUrl: string
  canInstall: boolean
}

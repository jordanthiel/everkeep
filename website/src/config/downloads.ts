/**
 * Point these at published release artifacts.
 * Override via .env:
 *   VITE_DOWNLOAD_MAC=https://...
 *   VITE_DOWNLOAD_WIN=https://...
 *   VITE_RELEASES_URL=https://github.com/org/everkeep/releases
 */
export const downloads = {
  mac:
    import.meta.env.VITE_DOWNLOAD_MAC?.trim() ||
    'https://github.com/everkeep/everkeep/releases/latest/download/Everkeep-mac.dmg',
  win:
    import.meta.env.VITE_DOWNLOAD_WIN?.trim() ||
    'https://github.com/everkeep/everkeep/releases/latest/download/Everkeep-win-x64.exe',
  releases:
    import.meta.env.VITE_RELEASES_URL?.trim() ||
    'https://github.com/everkeep/everkeep/releases/latest',
  version: import.meta.env.VITE_APP_VERSION?.trim() || '0.1.0'
} as const

export type PlatformId = 'mac' | 'win'

export function detectPreferredPlatform(): PlatformId {
  if (typeof navigator === 'undefined') return 'mac'
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('win')) return 'win'
  return 'mac'
}

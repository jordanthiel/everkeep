const repository = 'https://github.com/jordanthiel/everkeep'
export const releaseApiUrl = 'https://api.github.com/repos/jordanthiel/everkeep/releases/latest'

export interface Downloads {
  mac: string
  macIntel: string
  win: string
  releases: string
  version: string | null
}

// Always offer a working release page, even if GitHub's API is unavailable.
export const downloads: Downloads = {
  mac: `${repository}/releases/latest`,
  macIntel: `${repository}/releases/latest`,
  win: `${repository}/releases/latest`,
  releases: `${repository}/releases`,
  version: null
}

export function downloadsFromRelease(value: unknown): Downloads {
  if (!value || typeof value !== 'object') throw new Error('Invalid release')
  const release = value as Record<string, unknown>
  if (release.draft !== false || release.prerelease !== false ||
      typeof release.tag_name !== 'string' || !/^v?\d+\.\d+\.\d+$/.test(release.tag_name) ||
      !Array.isArray(release.assets)) throw new Error('Invalid stable release')
  const assets = release.assets
  const version = release.tag_name.replace(/^v/, '')
  const prefix = `${repository}/releases/download/${encodeURIComponent(release.tag_name)}/`
  const assetUrl = (name: string): string => {
    const asset = assets.find((item: unknown) => {
      if (!item || typeof item !== 'object') return false
      const candidate = item as Record<string, unknown>
      return candidate.name === name && candidate.state === 'uploaded' &&
        candidate.browser_download_url === `${prefix}${encodeURIComponent(name)}`
    })
    // Do not invent URLs for artifacts that have not finished uploading.
    return asset ? asset.browser_download_url : downloads.mac
  }
  return {
    ...downloads,
    version,
    mac: assetUrl(`Everkeep-${version}-arm64.dmg`),
    macIntel: assetUrl(`Everkeep-${version}.dmg`),
    win: assetUrl('Everkeep-win-x64.exe')
  }
}

export type PlatformId = 'mac' | 'win'

export function detectPreferredPlatform(): PlatformId {
  if (typeof navigator === 'undefined') return 'mac'
  return navigator.userAgent.toLowerCase().includes('win') ? 'win' : 'mac'
}

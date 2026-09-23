import { useEffect, useState } from 'react'
import { downloads, downloadsFromRelease, releaseApiUrl } from '../config/downloads'

export function useDownloads() {
  const [current, setCurrent] = useState(downloads)
  useEffect(() => {
    const controller = new AbortController()
    const refresh = async () => {
      try {
        const response = await fetch(releaseApiUrl, {
          headers: { Accept: 'application/vnd.github+json' },
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)])
        })
        if (!response.ok) return
        const release = downloadsFromRelease(await response.json())
        if (!controller.signal.aborted) setCurrent(release)
      } catch {
        // Keep the last successful result, or the latest-release page fallback.
      }
    }
    void refresh()
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void refresh()
    }, 5 * 60 * 1000)
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [])
  return current
}

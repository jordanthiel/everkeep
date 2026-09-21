import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { PacketDraft } from '@shared/types/packet'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'

export function usePacketDraft(initial: PacketDraft, persisted: PacketDraft | null, vaultId: string) {
  const [draft, setDraft] = useState(initial)
  const current = useRef(initial)
  const saved = useRef(persisted ? JSON.stringify(persisted) : '')
  const [savedSignature, setSavedSignature] = useState(saved.current)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef<Promise<void> | null>(null)
  const mounted = useRef(true)
  const client = useQueryClient()
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const update = useCallback((change: (previous: PacketDraft) => PacketDraft) => {
    current.current = change(current.current)
    setDraft(current.current)
    setError('')
  }, [])
  const flush = useCallback(async (): Promise<void> => {
    if (inFlight.current) return inFlight.current
    const work = async () => {
      setSaving(true); setError('')
      try {
        while (mounted.current && saved.current !== JSON.stringify(current.current)) {
          const snapshot = current.current
          const result = await unwrap(getEverkeepApi().vault.savePacketDraft(snapshot, vaultId))
          saved.current = JSON.stringify(snapshot)
          if (mounted.current) {
            setSavedSignature(saved.current)
            client.setQueryData(['packet-draft', vaultId], result)
          }
        }
      } catch (err) {
        if (mounted.current) setError(err instanceof Error ? err.message : 'Unable to save the draft.')
        throw err
      } finally { if (mounted.current) setSaving(false) }
    }
    inFlight.current = work()
    try { await inFlight.current } finally { inFlight.current = null }
  }, [client, vaultId])
  const dirty = JSON.stringify(draft) !== savedSignature
  useEffect(() => {
    if (!dirty || error) return
    const timer = window.setTimeout(() => { void flush().catch(() => {}) }, 500)
    return () => window.clearTimeout(timer)
  }, [draft, dirty, error, flush])
  return { draft, update, flush, dirty, saving, error }
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getEverkeepApi } from '@renderer/lib/api'
import { backupRestorePath } from '@shared/backupFiles'
import { Button } from '../ui/Button'

export function BackupOpenNotice() {
  const [path, setPath] = useState<string | null>(null)
  const navigate = useNavigate()
  useEffect(() => {
    let active = true
    const files = getEverkeepApi().files
    const receive = () => void files.getBackupOpenRequest().then(value => {
      if (active && value) setPath(value)
    }).catch(() => { /* A future file-open event retries delivery. */ })
    const unsubscribe = files.onBackupOpenRequest(receive)
    receive()
    return () => { active = false; unsubscribe() }
  }, [])
  function dismiss() {
    if (path) void getEverkeepApi().files.dismissBackupOpenRequest(path).catch(() => {})
    setPath(null)
  }
  if (!path) return null
  return <aside role="status" className="relative z-40 flex flex-wrap items-center gap-3 border-b border-warm-300 bg-ivory-50 px-6 py-4">
    <div className="min-w-0 flex-1"><p className="font-medium">Open this backup in Everkeep</p><p className="break-all text-sm text-warm-500">{path}</p><p className="text-xs text-warm-500">Restore into a new vault. Your existing vault will not be overwritten.</p></div>
    <Button onClick={() => { navigate(backupRestorePath(path)); dismiss() }}>Restore backup</Button>
    <Button variant="ghost" onClick={dismiss}>Dismiss</Button>
  </aside>
}

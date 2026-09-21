import { useCallback, useEffect, useState } from 'react'
import { Link, useBlocker, useSearchParams } from 'react-router-dom'
import { SharedVaultApp } from '../../sharing/SharedVaultApp'
import { getEverkeepApi } from '@renderer/lib/api'
export function SharedVaultsPage() {
  const [params] = useSearchParams()
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false)
  const changed = useCallback((dirty: boolean, busy: boolean) => { setDirty(dirty); setBusy(busy) }, [])
  const blocker = useBlocker(dirty || busy)
  useEffect(() => { if (blocker.state === 'blocked') { if (!busy && window.confirm('Discard your unsaved changes and leave this shared vault?')) blocker.proceed(); else blocker.reset() } }, [blocker, busy])
  return <div style={{ height: '100vh', background: '#f7f5ed', overflow: 'auto' }}><div className="ek-sharing" style={{ paddingBottom: 0 }}><Link to="/">Back to my local vault</Link></div><SharedVaultApp client={getEverkeepApi().sharing} initialVaultId={params.get('vault') || undefined} desktop onEditingChange={changed} /></div>
}

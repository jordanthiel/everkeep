import { useState } from 'react'
import type { SharingAccount as Account } from '@shared/sharing'
import { SharingAccount } from '../../sharing/SharingAccount'
import { getEverkeepApi } from '@renderer/lib/api'
import { Button } from './ui/Button'
import '../../sharing/sharing.css'

export function OwnerVerification({ onContinue, busy = false }: { onContinue: () => void; busy?: boolean }) {
  const [account, setAccount] = useState<Account | null>(null)
  return <div className="ek-sharing" style={{ padding: 0 }}>
    <SharingAccount client={getEverkeepApi().sharing} onChange={setAccount} ownerVault />
    <Button disabled={busy || !account} onClick={onContinue}>{busy ? 'Checking access…' : 'Verify access and continue'}</Button>
  </div>
}

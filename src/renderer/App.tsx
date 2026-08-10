import { useEffect, useState } from 'react'
import { getEverkeepApi, unwrap } from '@renderer/lib/api'

export default function App() {
  const [status, setStatus] = useState('Connecting…')

  useEffect(() => {
    void (async () => {
      try {
        const result = await unwrap(getEverkeepApi().ping())
        setStatus(`IPC ready (${result.message})`)
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'IPC unavailable')
      }
    })()
  }, [])

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h1 className="font-display text-4xl text-charcoal-900">Everkeep</h1>
        <p className="mt-3 text-warm-500">{status}</p>
      </div>
    </div>
  )
}

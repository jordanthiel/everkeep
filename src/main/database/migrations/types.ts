import type { VaultDatabase } from '../connection'

export interface Migration {
  id: string
  version: number
  up: (db: VaultDatabase) => void
}

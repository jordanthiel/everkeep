import { create } from 'zustand'
import type { VaultSession } from '@shared/types/vault'

interface VaultUiState {
  session: VaultSession | null
  setSession: (session: VaultSession | null) => void
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  setSaveStatus: (status: 'idle' | 'saving' | 'saved' | 'error') => void
}

export const useVaultStore = create<VaultUiState>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
  saveStatus: 'idle',
  setSaveStatus: (saveStatus) => set({ saveStatus })
}))

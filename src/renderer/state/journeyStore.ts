import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { StepStatus } from '@shared/sections/journey'

interface JourneyState {
  vaults: Record<string, Record<string, StepStatus>>
  include: (vaultId: string, stepId: string) => void
  mark: (vaultId: string, stepId: string, status: StepStatus) => void
}

// Only walkthrough choices are stored here; vault records stay in the vault.
export const useJourneyStore = create<JourneyState>()(persist((set) => ({
  vaults: {},
  include: (vaultId, stepId) => set((state) => {
    const statuses = { ...state.vaults[vaultId] }
    delete statuses[stepId]
    return { vaults: { ...state.vaults, [vaultId]: statuses } }
  }),
  mark: (vaultId, stepId, status) => set((state) => ({
    vaults: { ...state.vaults, [vaultId]: { ...state.vaults[vaultId], [stepId]: status } }
  }))
}), { name: 'everkeep-walkthrough-v1' }))

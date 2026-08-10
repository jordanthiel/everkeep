import type { EverkeepApi } from '../shared/types/ipc'

declare global {
  interface Window {
    everkeep: EverkeepApi
  }
}

export {}

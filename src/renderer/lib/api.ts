import type { IpcResult } from '@shared/types/ipc'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function unwrap<T>(promise: Promise<IpcResult<T>>): Promise<T> {
  const result = await promise
  if (!result.ok) {
    throw new ApiError(result.error.message, result.error.code)
  }
  return result.data
}

export function getEverkeepApi() {
  if (typeof window === 'undefined' || !window.everkeep) {
    throw new Error('Everkeep API is not available. Are you running inside Electron?')
  }
  return window.everkeep
}

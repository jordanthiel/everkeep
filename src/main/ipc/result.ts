import type { IpcResult } from '../../shared/types/ipc'
import { VaultServiceError } from '../services/VaultService'

export function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data }
}

export function fail(code: string, message: string): IpcResult<never> {
  return { ok: false, error: { code, message } }
}

export function fromError(error: unknown): IpcResult<never> {
  if (error instanceof VaultServiceError) {
    return fail(error.code, error.message)
  }

  if (error instanceof Error) {
    return fail('INTERNAL_ERROR', error.message)
  }

  return fail('INTERNAL_ERROR', 'An unexpected error occurred.')
}

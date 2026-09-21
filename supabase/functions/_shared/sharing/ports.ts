import type { SharingAccount } from './schema.ts'
export interface Statement { bind(...values: unknown[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }>; run(): Promise<{ meta: { changes: number } }> }
export interface Database { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<unknown[]> }
export interface Bucket { put(key: string, value: ArrayBuffer | Uint8Array | string): Promise<unknown>; get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>; delete(key: string): Promise<void> }
export interface AuthSession { token: string; refreshToken: string; expiresAt: number; account: SharingAccount }
export interface SharingAuth { requestCode(email: string): Promise<void>; verifyCode(email: string, code: string): Promise<AuthSession>; refresh(refreshToken: string): Promise<AuthSession>; user(token: string): Promise<SharingAccount | null>; logout(token: string): Promise<void> }
export class AuthError extends Error { constructor(readonly status: number, message: string) { super(message) } }
export interface SharingEnv { DB: Database; FILES: Bucket; AUTH: SharingAuth; ASSETS?: { fetch(request: Request): Promise<Response> }; PUBLIC_URL: string; FROM_EMAIL: string; RESEND_API_KEY: string; DATA_KEY: string; AUTH_SECRET: string }

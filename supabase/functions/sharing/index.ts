import postgres from 'postgres'
import { createSharingHandler } from '../_shared/sharing/handler.ts'
import { createPostgresDatabase, type TransactionalSql } from '../_shared/sharing/postgres.ts'
import { createSupabaseAuth, createSupabaseBucket } from '../_shared/sharing/supabase.ts'
const required = (name: string) => { const value = Deno.env.get(name); if (!value) throw new Error(`Missing ${name}`); return value }
const url = required('SUPABASE_URL')
const sql = postgres(Deno.env.get('SHARING_DATABASE_URL') || required('SUPABASE_DB_URL'), { prepare: false, max: 1 })
const handler = createSharingHandler({
  DB: createPostgresDatabase(sql as unknown as TransactionalSql),
  FILES: createSupabaseBucket(url, required('SUPABASE_SERVICE_ROLE_KEY')),
  AUTH: createSupabaseAuth(url, required('SUPABASE_ANON_KEY')),
  PUBLIC_URL: required('SHARING_PUBLIC_URL'), FROM_EMAIL: required('SHARING_FROM_EMAIL'),
  RESEND_API_KEY: required('RESEND_API_KEY'), DATA_KEY: required('SHARING_DATA_KEY'), AUTH_SECRET: required('SHARING_AUTH_SECRET')
})
Deno.serve(request => {
  const url = new URL(request.url)
  // Supabase forwards /functions/v1/sharing/... (local runtime can use /sharing/...).
  url.pathname = url.pathname.replace(/^\/(?:functions\/v1\/)?sharing(?=\/|$)/, '') || '/'
  return handler(new Request(url, request))
})

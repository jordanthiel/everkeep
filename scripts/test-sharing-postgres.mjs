import { build } from 'esbuild'
import { mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
mkdirSync('.everkeep-temp', { recursive: true })
const file = '.everkeep-temp/sharing-postgres.mjs'
try {
  await build({ entryPoints: ['scripts/postgres-sharing-smoke.ts'], outfile: file, bundle: true, platform: 'node', format: 'esm', packages: 'external' })
  const result = spawnSync(process.execPath, [file], { stdio: 'inherit', timeout: 180000 })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Postgres sharing tests failed (${result.status})`)
} finally { rmSync(file, { force: true }) }

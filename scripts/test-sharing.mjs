import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { resolve, join } from 'node:path'

const require = createRequire(import.meta.url)
const scratch = resolve('.everkeep-temp')
mkdirSync(scratch, { recursive: true })
const directory = mkdtempSync(join(scratch, 'sharing-smoke-'))
try {
  const entry = join(directory, 'main.cjs')
  await build({ entryPoints: ['scripts/electron-sharing-smoke.ts'], outfile: entry, bundle: true, platform: 'node', format: 'cjs', packages: 'external' })
  const env = { ...process.env }
  // RUN_AS_NODE bypasses the Electron V8 sandbox and would miss this regression.
  delete env.ELECTRON_RUN_AS_NODE
  const result = spawnSync(require('electron'), [entry], { env, stdio: 'inherit', timeout: 120000 })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Electron sharing smoke test failed (${result.signal ?? result.status})`)
} finally {
  rmSync(directory, { recursive: true, force: true })
}

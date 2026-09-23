import { readFileSync } from 'node:fs'

const value = process.env.EVERKEEP_SHARING_URL?.trim()
if (!value) throw new Error('Set the EVERKEEP_SHARING_URL GitHub Actions repository variable before building releases.')
const url = new URL(value)
if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
    !url.hostname.endsWith('.supabase.co') || url.pathname !== '/functions/v1/sharing') {
  throw new Error('EVERKEEP_SHARING_URL must be the production Supabase HTTPS sharing function URL, without credentials or query parameters.')
}

if (process.argv.includes('--built')) {
  const bundle = readFileSync('out/main/index.js', 'utf8')
  if (!bundle.includes(JSON.stringify(value))) throw new Error('The desktop bundle is missing its sharing service URL.')
  console.log('Verified sharing service URL is embedded in the desktop bundle.')
} else {
  const response = await fetch(`${value}/api/config`, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`Sharing service configuration returned HTTP ${response.status}.`)
  const config = await response.json()
  const portal = new URL(config.portalUrl)
  if (portal.protocol !== 'https:' || portal.username || portal.password) throw new Error('Sharing service must provide an HTTPS portal URL.')
  console.log('Verified production sharing service configuration.')
}

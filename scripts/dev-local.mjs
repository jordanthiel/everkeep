import { readFileSync, writeFileSync } from 'node:fs'
import { spawn, execFileSync } from 'node:child_process'

// Keep secrets in ignored local files and subprocess environments, never argv.
const envPath = new URL('../supabase/.env.local', import.meta.url)
const parse = text => Object.fromEntries(text.split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => {
  const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]
}))
const env = parse(readFileSync(envPath, 'utf8'))
if (!env.STRIPE_SECRET_KEY?.startsWith('sk_test_') || env.STRIPE_LIVEMODE !== 'false') throw new Error('Local development requires Stripe test credentials in supabase/.env.local.')
if (env.SHARING_DATABASE_URL) throw new Error('Remove SHARING_DATABASE_URL: local functions must use the local runtime database.')
if (new URL(env.SHARING_PUBLIC_URL).hostname !== 'localhost') throw new Error('SHARING_PUBLIC_URL must use localhost for local development.')
const endpoint = 'http://127.0.0.1:56421/functions/v1/sharing'
const stripeEnv = { ...process.env, STRIPE_API_KEY: env.STRIPE_SECRET_KEY }
const headers = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` }
const hooksResponse = await fetch('https://api.stripe.com/v1/webhook_endpoints?limit=100', { headers })
if (!hooksResponse.ok) throw new Error('Unable to check sandbox webhook isolation.')
const hooks = await hooksResponse.json()
if (hooks.has_more || hooks.data.some(hook => hook.status === 'enabled')) throw new Error('Disable hosted webhook endpoints in this Stripe sandbox first: Stripe delivers events to every enabled endpoint, even during local testing.')
const linkResponse = await fetch('https://api.stripe.com/v1/payment_links?limit=100', { headers })
if (!linkResponse.ok) throw new Error('Unable to verify local checkout.')
const links = await linkResponse.json()
const link = links.data.find(link => link.url === env.STRIPE_PAYMENT_LINK_URL)
if (!link?.active || link.livemode || link.after_completion?.redirect?.url !== 'http://localhost:5173/buy/success') throw new Error('Configure an active test Payment Link that redirects to http://localhost:5173/buy/success.')
console.log('Starting local Supabase…')
execFileSync('supabase', ['start'], { stdio: ['ignore', 'pipe', 'pipe'] })
execFileSync('supabase', ['migration', 'up', '--local'], { stdio: 'inherit' })
const secret = execFileSync('stripe', ['listen', '--print-secret'], { env: stripeEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
if (!/^whsec_[A-Za-z0-9]+$/.test(secret)) throw new Error('Unable to obtain the local Stripe listener signing secret.')
env.STRIPE_WEBHOOK_SECRET = secret
writeFileSync(envPath, Object.entries(env).map(([k, v]) => `${k}=${v}\n`).join(''), { mode: 0o600 })
const children = []
let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill('SIGTERM')
  process.exitCode = code
}
function start(command, args, childEnv = process.env) {
  const child = spawn(command, args, { env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] })
  children.push(child)
  // Stripe prints its signing secret on startup. Redact complete lines before logging.
  for (const stream of [child.stdout, child.stderr]) {
    let pending = ''
    stream.on('data', chunk => {
      pending += chunk.toString()
      const lines = pending.split('\n'); pending = lines.pop()
      for (const line of lines) console.log(line.replace(/(?:whsec_|sk_test_)[A-Za-z0-9]+/g, '[redacted]'))
    })
  }
  child.on('error', error => { console.error(error.message); stop(1) })
  child.on('exit', code => { if (!stopping) stop(code || 1) })
}
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
start('supabase', ['functions', 'serve', 'sharing', '--env-file', 'supabase/.env.local'])
for (let attempt = 0; ; attempt++) {
  if (stopping) process.exit(1)
  const response = await fetch(endpoint + '/api/config').catch(() => null)
  if (response?.ok && (await response.json()).capabilities?.includes('email-billing-v1')) break
  if (attempt >= 40) { stop(1); throw new Error('Local billing function did not become ready.') }
  await new Promise(resolve => setTimeout(resolve, 500))
}
start('stripe', ['listen', '--events', 'checkout.session.completed,checkout.session.async_payment_succeeded,charge.refunded,charge.dispute.created', '--forward-to', endpoint + '/api/billing/webhook'], stripeEnv)
start('npm', ['--prefix', 'website', 'run', 'dev', '--', '--host', 'localhost', '--port', '5173', '--strictPort'], { ...process.env, VITE_SHARING_ENDPOINT: endpoint, VITE_STRIPE_PAYMENT_LINK: env.STRIPE_PAYMENT_LINK_URL })
console.log('Local website: http://localhost:5173 | Email codes: http://127.0.0.1:56424 | Database: http://127.0.0.1:56423')

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const endpoint = (process.env.VITE_SHARING_ENDPOINT || env.VITE_SHARING_ENDPOINT || process.env.VITE_SHARING_API_URL || env.VITE_SHARING_API_URL || '').trim()
  const developing = command === 'serve'
  const paymentLink = (process.env.VITE_STRIPE_PAYMENT_LINK || env.VITE_STRIPE_PAYMENT_LINK || '').trim()
  if (paymentLink) {
    const checkout = new URL(paymentLink)
    if (checkout.protocol !== 'https:' || checkout.hostname !== 'buy.stripe.com' || checkout.username || checkout.password) throw new Error('VITE_STRIPE_PAYMENT_LINK must be a Stripe payment link.')
    const sandbox = checkout.pathname.startsWith('/test_')
    if (developing && !sandbox) throw new Error('Local website development requires a Stripe sandbox payment link.')
    if (!developing && mode === 'production' && sandbox) throw new Error('Production website builds require a live Stripe payment link.')
  } else if (!developing && mode === 'production') {
    throw new Error('Production website builds require VITE_STRIPE_PAYMENT_LINK.')
  }
  if (developing && !endpoint) throw new Error('Local development requires a local Supabase endpoint. Run npm run dev:local from the repository root.')
  if (endpoint) {
    const parsed = new URL(endpoint)
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
    if (developing && !loopback) throw new Error('Local website development must use local Supabase, not a hosted database. Run npm run dev:local.')
    if (!(parsed.protocol === 'https:' || (developing && loopback && parsed.protocol === 'http:')) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname.replace(/\/$/, '') !== '/functions/v1/sharing') throw new Error('VITE_SHARING_ENDPOINT must be an HTTPS sharing function URL (loopback HTTP is allowed in local development).')
  }
  return {
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom'] },
  build: {
    rolldownOptions: {
      input: {
        website: fileURLToPath(new URL('./index.html', import.meta.url)),
        share: fileURLToPath(new URL('./share/index.html', import.meta.url))
      }
    }
  }
}
})

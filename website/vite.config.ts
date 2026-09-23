import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ mode }) => {
  const endpoint = (process.env.VITE_SHARING_ENDPOINT || loadEnv(mode, process.cwd(), '').VITE_SHARING_ENDPOINT || process.env.VITE_SHARING_API_URL || loadEnv(mode, process.cwd(), '').VITE_SHARING_API_URL || '').trim()
  if (endpoint) {
    const parsed = new URL(endpoint)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname.replace(/\/$/, '') !== '/functions/v1/sharing') throw new Error('VITE_SHARING_ENDPOINT must contain only the HTTPS sharing function URL.')
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

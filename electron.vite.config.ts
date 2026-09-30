import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => {
  const developing = command === 'serve'
  const sharingUrl = process.env.EVERKEEP_SHARING_URL || (developing ? 'http://127.0.0.1:56421/functions/v1/sharing' : '')
  if (developing && !['localhost', '127.0.0.1', '[::1]'].includes(new URL(sharingUrl).hostname)) {
    throw new Error('Desktop development must use local Supabase to keep test data out of the hosted database.')
  }
  return {
  main: {
    define: { 'process.env.EVERKEEP_SHARING_BUILD_URL': JSON.stringify(sharingUrl) },
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    server: { port: 5174, strictPort: true },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()]
  }
  }
})

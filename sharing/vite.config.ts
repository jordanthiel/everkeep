import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
export default defineConfig({ root: resolve(__dirname), base: process.env.SHARING_PORTAL_BASE || '/', plugins: [react()], build: { outDir: 'dist', emptyOutDir: true } })

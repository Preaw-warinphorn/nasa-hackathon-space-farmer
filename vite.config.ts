import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Public hostname(s) that reverse-proxy to this app (Vite rejects unknown Host headers).
const allowedHosts = ['crimson-size.bnr.la']

export default defineConfig({
  // Served from the domain root by default. GitHub Pages serves a project site from
  // /<repo>/, so the deploy workflow sets BASE_PATH=/nasa-hackathon-space-farmer/.
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  server: { allowedHosts },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true, allowedHosts },
})

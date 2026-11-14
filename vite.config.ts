import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Public hostname(s) that reverse-proxy to this app (Vite rejects unknown Host headers).
const allowedHosts = ['crimson-size.bnr.la']

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { allowedHosts },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true, allowedHosts },
})

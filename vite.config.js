import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: true,
    allowedHosts: true // すべてのホスト（ngrokのドメイン含む）を許可
  }
})
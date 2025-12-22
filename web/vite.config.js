import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/healthz': 'http://localhost:8080',
      '/devices': 'http://localhost:8080',
      '/alerts': 'http://localhost:8080',
      '/discovery': 'http://localhost:8080',
      '/macs': 'http://localhost:8080',
      '/metrics': 'http://localhost:8080',
    }
  }
})

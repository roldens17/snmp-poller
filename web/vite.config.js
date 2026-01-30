import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/healthz': {
        target: 'http://localhost:8080',
        bypass: (req) => (req.headers.accept || '').includes('text/html') ? '/index.html' : undefined,
      },
      '/devices': {
        target: 'http://localhost:8080',
        bypass: (req) => (req.headers.accept || '').includes('text/html') ? '/index.html' : undefined,
      },
      '/alerts': {
        target: 'http://localhost:8080',
        bypass: (req) => (req.headers.accept || '').includes('text/html') ? '/index.html' : undefined,
      },
      '/discovery': {
        target: 'http://localhost:8080',
        bypass: (req) => (req.headers.accept || '').includes('text/html') ? '/index.html' : undefined,
      },
      '/macs': {
        target: 'http://localhost:8080',
        bypass: (req) => (req.headers.accept || '').includes('text/html') ? '/index.html' : undefined,
      },
      '/metrics': {
        target: 'http://localhost:8080',
        bypass: (req) => (req.headers.accept || '').includes('text/html') ? '/index.html' : undefined,
      },
    }
  }
})

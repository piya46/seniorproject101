import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'https://sci-request-system-466086429766.asia-southeast3.run.app',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})

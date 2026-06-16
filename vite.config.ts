import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  define: {
    'process.env.OPENCLAW_GATEWAY_TOKEN': JSON.stringify(process.env.OPENCLAW_GATEWAY_TOKEN ?? ''),
  },
  server: {
    proxy: {
      '/v1': {
        target: 'http://localhost:18789',
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)', '**/test_*.?(c|m)[jt]s?(x)'],
  },
})

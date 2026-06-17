import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// 从 openclaw.json 读取 Gateway token
function getGatewayToken(): string {
  // 优先使用环境变量
  if (process.env.OPENCLAW_GATEWAY_TOKEN) {
    return process.env.OPENCLAW_GATEWAY_TOKEN;
  }
  // 回退到 openclaw.json
  try {
    const configPath = resolve(process.env.HOME || '~', '.openclaw/openclaw.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    return config?.gateway?.auth?.token ?? '';
  } catch {
    return '';
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    'process.env.OPENCLAW_GATEWAY_TOKEN': JSON.stringify(getGatewayToken()),
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

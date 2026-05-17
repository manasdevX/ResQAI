import { defineConfig, createLogger } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

const logger = createLogger()
const _info  = logger.info.bind(logger)
logger.info  = (msg, opts) => {
  if (msg.includes('--host') || msg.includes('press h')) return
  _info(msg, opts)
}

function resqaiBanner() {
  return {
    name: 'resqai-banner',
    configureServer(server) {
      const original = server.printUrls.bind(server)
      server.printUrls = () => {
        original()
        console.log(`  ✓ API        http://localhost:5000/api`)
        console.log(`  ✓ Socket.IO  ws://localhost:5000\n`)
      }
    },
  }
}

export default defineConfig({
  customLogger: logger,
  plugins: [react(), resqaiBanner()],
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})

import { defineConfig, createLogger } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

const cyan = (s) => `\x1b[36m${s}\x1b[0m`

const logger = createLogger()
const _info  = logger.info.bind(logger)
logger.info  = (msg, opts) => {
  // Suppress Vite's own banner, URL lines, and dep-optimisation noise
  if (
    msg.includes('--host')        ||
    msg.includes('press h')       ||
    msg.includes('ready in')      ||
    msg.includes('Local:')        ||
    msg.includes('Network:')      ||
    msg.includes('Re-optimizing')
  ) return
  _info(msg, opts)
}

function resqaiBanner() {
  return {
    name: 'resqai-banner',
    configureServer(server) {
      server.printUrls = () => {
        console.log(`\n  ResQAI Client`)
        console.log(`  ✓ Running    ${cyan('http://localhost:5173/')}`)
        console.log(`  ✓ Backend    ${cyan('http://localhost:5000')}\n`)
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

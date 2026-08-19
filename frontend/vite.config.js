import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Deployed backend — from DEPLOY_GUIDE.md
const PROD_API = 'http://team8.105app.site'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Override with VITE_API_BASE=http://localhost:8000 in .env.local for local backend
  const apiTarget = env.VITE_API_BASE || PROD_API

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/v1': {
          target: apiTarget,
          changeOrigin: true,
          // Log proxy target on startup so it's obvious which backend is in use
          configure: (proxy) => {
            proxy.on('proxyReq', (_, req) => {
              if (req.url === '/v1/health') {
                console.log(`[ChaiToke proxy] → ${apiTarget}${req.url}`)
              }
            })
          },
        },
      },
    },
    // Expose base URL to React so components can display it
    define: {
      __API_BASE__: JSON.stringify(apiTarget),
    },
  }
})

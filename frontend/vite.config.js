import http from 'node:http'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

function djangoProxy() {
  const target = { hostname: '127.0.0.1', port: 8000 }
  return {
    name: 'django-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api') && !req.url?.startsWith('/media')) {
          next()
          return
        }
        const proxyReq = http.request(
          {
            ...target,
            path: req.url,
            method: req.method,
            headers: { ...req.headers },
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers)
            proxyRes.pipe(res)
          },
        )
        proxyReq.on('error', (error) => {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ detail: `API proxy failed: ${error.message}` }))
        })
        req.pipe(proxyReq)
      })
    },
  }
}

export default defineConfig({
  plugins: [djangoProxy(), react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})

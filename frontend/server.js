#!/usr/bin/env node
/**
 * Simple static file server with API proxy for ShrimpAtlas.
 * Serves frontend on port 3000 and proxies /api/* to FastAPI on port 8000.
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PORT = 3000
const API_TARGET = 'http://localhost:8000'
const DIST_DIR = path.join(__dirname, 'dist')

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

const server = http.createServer((req, res) => {
  const url = req.url || ''

  // Proxy API requests to FastAPI backend
  if (url.startsWith('/api/')) {
    const options = {
      hostname: 'localhost',
      port: 8000,
      path: url,
      method: req.method,
      headers: { ...req.headers, host: 'localhost:8000' },
    }

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers)
      proxyRes.pipe(res, { end: true })
    })

    req.pipe(proxyReq, { end: true })
    proxyReq.on('error', (err) => {
      res.writeHead(502)
      res.end('API proxy error: ' + err.message)
    })
    return
  }

  // Serve static files from dist/
  let filePath = path.join(DIST_DIR, url.split('?')[0])
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html')
  }

  const ext = path.extname(filePath)
  const contentType = MIME_TYPES[ext] || 'application/octet-stream'

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404)
      res.end('Not found: ' + url)
      return
    }
    res.writeHead(200, { 'Content-Type': contentType })
    res.end(data)
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`ShrimpAtlas running at http://localhost:${PORT}`)
  console.log(`API proxied to ${API_TARGET}`)
})

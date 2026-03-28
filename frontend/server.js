import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3000
const API_TARGET = 'http://localhost:8000'
const DIST_DIR = path.join(__dirname, 'dist')
const PUBLIC_DIR = path.join(__dirname, 'public')

const NO_CACHE = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.glsl': 'text/plain',
  '.ktx2': 'application/octet-stream',
  '.data': 'application/octet-stream',
  '.topojson': 'application/json',
  '.geojson': 'application/json',
}

const server = http.createServer((req, res) => {
  const url = req.url || ''

  // Proxy API and map requests
  if (url.startsWith('/api/') || url.startsWith('/map/')) {
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
    proxyReq.on('error', () => {
      res.writeHead(502)
      res.end('API proxy error')
    })
    return
  }

  // Serve local species images from /species-images/*
  if (url.startsWith('/species-images/')) {
    const relativePath = url.replace('/species-images/', '')
    const filePath = path.join(PUBLIC_DIR, 'species-images', relativePath)
    const ext = path.extname(filePath)
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' })
      res.end(fs.readFileSync(filePath))
    } else {
      res.writeHead(404)
      res.end('Image not found')
    }
    return
  }

  // Serve Cesium static assets from node_modules
  if (url.startsWith('/cesium/')) {
    const cesiumBase = path.join(__dirname, 'node_modules', 'cesium', 'Build', 'Cesium')
    const cesiumPath = url.replace('/cesium/', '')
    const filePath = path.join(cesiumBase, cesiumPath)

    if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
      const ext = path.extname(filePath)
      const contentType = MIME_TYPES[ext] || 'application/octet-stream'
      const headers = {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      }
      res.writeHead(200, headers)
      res.end(fs.readFileSync(filePath))
    } else {
      res.writeHead(404)
      res.end(`Cesium asset not found: ${url}`)
    }
    return
  }

  // Serve static files
  let filePath = path.join(DIST_DIR, url.split('?')[0])
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html')
  }

  const ext = path.extname(filePath)
  const contentType = MIME_TYPES[ext] || 'application/octet-stream'
  const headers = { 'Content-Type': contentType }

  // No cache for dev
  if (ext === '.html' || ext === '.js' || ext === '.css') {
    Object.assign(headers, NO_CACHE)
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404)
      res.end('Not found: ' + url)
      return
    }
    res.writeHead(200, headers)
    res.end(data)
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`ShrimpAtlas running at http://localhost:${PORT}`)
})

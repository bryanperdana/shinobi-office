// Minimal static server for the self-hosted web demo: node scripts/serve.mjs [dir] [port]
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const dir = path.resolve(process.argv[2] || 'web'), port = Number(process.argv[3] || process.env.PORT || 8080)
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' }
http.createServer((req, res) => {
  let p = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (!p.startsWith(dir)) { res.writeHead(403); return res.end() }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html')
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end('not found') }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res)
}).listen(port, '127.0.0.1', () => console.log(`Shinobi Office demo → http://127.0.0.1:${port}/`))

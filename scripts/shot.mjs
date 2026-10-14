// README screenshots of the web demo (sample data). Usage: npm run screenshots [-- name,name] → docs/screenshots/*.png
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import http from 'node:http'
import fs from 'node:fs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const srv = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (!p.startsWith(root) || !fs.existsSync(p)) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : 'text/html' }); fs.createReadStream(p).pipe(res)
}).listen(0)
const exe = process.env.PW_EXE || fs.globSync(process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac-arm64/chrome-headless-shell').sort().pop()
fs.mkdirSync(path.join(root, 'docs/screenshots'), { recursive: true })
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errors = []
const only = process.argv[2]?.split(',')
const SHOTS = [
  ['hq', o => o.setView('overview')],
  ['village-day', o => o.setView('country')],
  ['village-night', o => { o.setNight(true); o.setView('country') }],
  ['kage-floor2', o => o.setView('floor2')],
  ['laptop-screen', o => { o.setView('overview'); o.focusScreen('kaito'); o.advance(1.2) }],
  ['spar', o => { o.force('hana', 'spar', 'ren'); o.advance(9.5); o.setView('ring') }],
  ['outside', o => { for (const id of ['hana', 'ren', 'tama']) o.setStatus(id, 'idle'); o.brain.force('hana', 'torii'); o.brain.force('ren', 'paddy'); o.brain.force('tama', 'river'); o.advance(70, 1 / 15); o.lookAt([24, 14, 62], [9, 1, 40]) }],
]
for (const [name, fn] of SHOTS) {
  if (only && !only.includes(name)) continue
  const page = await browser.newPage({ viewport: { width: 1480, height: 900 } })
  page.on('pageerror', e => errors.push(name + ': ' + String(e)))
  await page.goto(`http://127.0.0.1:${srv.address().port}/web/index.html?qa`)
  await page.waitForFunction(() => window.office)
  const info = await page.evaluate(src => {
    const o = window.office
    o.advance(0.3)
    ;(0, eval)('(' + src + ')')(o)
    o.advance(0.1)
    const where = o.brain.agents.map(a => `${a.id}:${o.locationOf(a.id).id}${a.stair ? '(stair ' + a.stair.u.toFixed(2) + ')' : ''}`)
    return { view: o.view, q: o.quality, where, stats: o.stats?.(), v: o.village.stats() }
  }, fn.toString())
  await page.screenshot({ path: path.join(root, `docs/screenshots/${name}.png`) })
  console.log(name, JSON.stringify(info))
  await page.close()
}
console.log('errors', errors.length ? errors : 'none')
await browser.close(); srv.close()

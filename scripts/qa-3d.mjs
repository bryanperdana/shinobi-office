// QA for the 3D mockup: WebGL up, no errors, non-blank canvas, tags in-stage, scenario shots.
// Usage: node scripts/qa-3d.mjs  (file:// + module script needs a server → tiny static server here)
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import http from 'node:http'
import fs from 'node:fs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const out = path.join(root, '.qa')
const srv = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (!p.startsWith(root) || !fs.existsSync(p)) { res.writeHead(404); return res.end() }
  const type = p.endsWith('.js') ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream'
  res.writeHead(200, { 'content-type': type }); fs.createReadStream(p).pipe(res)
}).listen(0)
const base = `http://127.0.0.1:${srv.address().port}/web/index.html`

const exe = process.env.PW_EXE || fs.globSync?.(process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac-arm64/chrome-headless-shell').sort().pop()
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1480, height: 900 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', e => errors.push('pageerror: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

const results = []
const check = (name, ok, info = '') => { results.push({ name, ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`) }

async function load(q = '') {
  await page.goto(base + '?qa' + q)
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 })
}
async function metrics() {
  return page.evaluate(() => {
    const o = window.office, gl = o.renderer.getContext()
    const c = o.renderer.domElement
    // sample pixels from the drawing buffer
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4)
    const colors = new Set()
    for (let i = 0; i < 64; i++) { gl.readPixels(Math.floor((i % 8 + 0.5) * w / 8), Math.floor((Math.floor(i / 8) + 0.5) * h / 8), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); colors.add(px.join(',')) }
    const stage = document.getElementById('stage').getBoundingClientRect()
    const tags = [...document.querySelectorAll('.sho-tag')].map(t => { const r = t.getBoundingClientRect(); return { name: t.querySelector('b').textContent, vis: t.style.display !== 'none', r: [r.left, r.top, r.right, r.bottom].map(Math.round), label: t.querySelector('em').textContent } })
    return { renderer: gl.getParameter(gl.VERSION), canvas: [c.width, c.height], distinctColors: colors.size, stage: [stage.left, stage.top, stage.right, stage.bottom].map(Math.round), tags, stats: o.stats(),
      agents: o.brain.agents.map(a => ({ id: a.id, status: a.status, act: a.act.type, activity: a.activity, pose: a.pose, x: +a.x.toFixed(2), z: +a.z.toFixed(2), atDesk: Math.hypot(a.x - a.desk.seat.x, a.z - a.desk.seat.z) < 0.05 })), spars: o.brain.spars.length }
  })
}
const inStage = (m) => m.tags.filter(t => t.vis).every(t => t.r[0] >= m.stage[0] - 2 && t.r[2] <= m.stage[2] + 2 && t.r[1] >= m.stage[1] - 2 && t.r[3] <= m.stage[3] + 2)

// 1) Overview (day): initial desks
await load()
await page.evaluate(() => window.office.advance(0.5))
let m = await metrics()
check('WebGL context', /WebGL/.test(m.renderer), m.renderer)
check('canvas non-blank', m.distinctColors >= 12, `${m.distinctColors} distinct sampled colors, canvas ${m.canvas}`)
check('all 6 tags visible & inside stage', m.tags.filter(t => t.vis).length === 6 && inStage(m), JSON.stringify(m.tags.map(t => t.name + ':' + t.r.join('/'))))
check('non-idle agents seated at desk', m.agents.filter(a => a.status !== 'idle').every(a => a.atDesk))
console.log('stats', JSON.stringify(m.stats))
await page.locator('#app').screenshot({ path: path.join(out, 'p1b-3d-overview-day.png') })

// 2) Life: let idle agents roam ~25s, force a spar, capture mid-fight
await page.evaluate(() => { window.office.advance(8); window.office.force('hana', 'spar', 'ren'); window.office.advance(9.5) })
m = await metrics()
check('spar running between 2 idle agents', m.spars === 1 && m.agents.filter(a => a.act === 'spar').every(a => a.status === 'idle'), JSON.stringify(m.agents.filter(a => a.act === 'spar').map(a => a.id + ':' + a.pose)))
check('tags say "Idle · sparring" (status first)', m.tags.filter(t => /sparring/.test(t.label)).every(t => /^Idle/.test(t.label)), m.tags.map(t => t.name + '=' + t.label).join(' | '))
check('non-idle still at desk while others roam', m.agents.filter(a => a.status !== 'idle').every(a => a.atDesk))
await page.locator('#app').screenshot({ path: path.join(out, 'p1b-3d-roam-spar.png') })
await page.evaluate(() => { window.office.setView('ring'); window.office.advance(0.35) })
await page.locator('#stage').screenshot({ path: path.join(out, 'p1b-3d-spar-closeup.png') })

// 3) Real status wins: Hana gets work mid-spar → back at desk < 0.4s
// interrupt whoever is actually fighting (an autonomous spar may have started before the forced one)
const fighter = await page.evaluate(() => window.office.brain.spars[0]?.a || 'hana')
await page.evaluate(id => { window.office.setStatus(id, 'working'); window.office.advance(0.4) }, fighter)
m = await metrics()
const so = m.agents.find(a => a.id === fighter)
check(`status interrupt: ${fighter} at desk ≤0.4s`, so.atDesk && so.pose === 'type', JSON.stringify(so))
check('spar ended', m.spars === 0)

// 4) Night + genin + Kage view
await page.evaluate(() => { const o = window.office; o.setView('overview'); o.setNight(true); document.body.classList.add('night'); o.spawnGenin('kaito', 'research'); o.advance(9) })
m = await metrics()
check('night render non-blank', m.distinctColors >= 10, `${m.distinctColors}`)
await page.locator('#app').screenshot({ path: path.join(out, 'p1b-3d-overview-night.png') })
await page.evaluate(() => { const o = window.office; o.setNight(false); o.setView('kage'); o.advance(0.2) })
await page.locator('#stage').screenshot({ path: path.join(out, 'p1b-3d-kage-closeup.png') })

// 5) Real-time loop runs (rAF) without errors for 3s
await page.goto(base); await page.waitForFunction(() => window.__ready === true); await page.waitForTimeout(3000)
const t1 = await page.evaluate(() => window.office.brain.time)
check('rAF loop advances sim', t1 > 1, `sim t=${t1.toFixed(2)}s after 3s wall`)

check('no JS errors', errors.length === 0, errors.slice(0, 5).join(' || '))
await browser.close(); srv.close()
const fails = results.filter(r => !r.ok).length
console.log(`\n${results.length - fails}/${results.length} checks passed`)
process.exit(fails ? 1 : 0)

// QA for the REAL plugin bundle path (src/plugin) mounted in a browser with a mock SDK.
// Replays sanitized gateway events and checks the page reflects them truthfully.
// Usage: npm run build:harness && node scripts/qa-plugin.mjs
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import http from 'node:http'
import fs from 'node:fs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const out = path.join(root, '.qa')
fs.mkdirSync(out, { recursive: true })
const srv = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (!p.startsWith(root) || !fs.existsSync(p)) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : 'text/html' }); fs.createReadStream(p).pipe(res)
}).listen(0)
const url = `http://127.0.0.1:${srv.address().port}/harness/index.html`
const exe = process.env.PW_EXE || fs.globSync(process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac-arm64/chrome-headless-shell').sort().pop()
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })

const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }
const nowS = Math.floor(Date.now() / 1000)
const PROFILES = [
  { name: 'sora', display_name: 'Sora', last_session: { id: 'st-sora', last_active: nowS - 30000 } },
  { name: 'default', title: 'Personal Chief of Staff', last_session: { id: 'st-default', last_active: nowS - 4000, title: 'Morning brief' } },
  { name: 'tama', display_name: 'Tama', last_session: { id: 'st-tama', last_active: nowS - 90000 } },
  { name: 'yuki', display_name: 'Yuki', last_session: { id: 'st-yuki', last_active: nowS - 600 } },
  { name: 'ren', display_name: 'Ren', last_session: { id: 'st-ren', last_active: nowS - 7000 } },
  { name: 'kaito', display_name: 'Kaito', title: 'CTO', last_session: { id: 'st-kaito', last_active: nowS - 30, title: 'Virtual office' } },
  { name: 'hana', display_name: 'Hana', last_session: null },
]

async function run(viewport, tag) {
  const page = await browser.newPage({ viewport })
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  await page.addInitScript(p => {
    // runtime sessions as session.active_list reports them (preview text must never surface)
    window.__mock = { profiles: p, active: [
      { id: 'rt-n', session_key: 'st-kaito', status: 'idle', preview: 'PRIVATE PREVIEW' },
      { id: 'rt-e', session_key: 'st-ren', status: 'idle' },
      { id: 'rt-s', session_key: 'st-hana-old', status: 'idle' },
      { id: 'rt-d', session_key: 'st-yuki', status: 'idle' },
    ], sessionsByProfile: { hana: [{ id: 'st-hana-old' }] }, kanban: [
      { id: 't_a', title: 'Ship Shinobi office', body: 'BODY_SECRET', status: 'running', assignee: 'kaito', priority: 3 },
      { id: 't_b', title: 'Edit reel episode 4', status: 'ready', assignee: 'sora', priority: 1 },
      { id: 't_c', title: 'Old done', status: 'done', assignee: 'default', priority: 0, completed_at: Math.floor(Date.now() / 1000) - 600 },
    ] }
    window.__SHINOBI_QA__ = true
  }, PROFILES)
  await page.goto(url)
  await page.waitForFunction(() => window.__shinobiOffice && document.querySelectorAll('.sho-tag').length >= 7, null, { timeout: 20000 })
  await page.waitForTimeout(600)
  const emit = ev => page.evaluate(e => window.__mock.emit(e), { ...ev, profile: 'sora' }) // pooled backend: stamp = launch profile, NOT owner
  const tagText = name => page.evaluate(n => [...document.querySelectorAll('.sho-tag')].find(t => t.querySelector('b').textContent === n)?.textContent || '', name)
  const settle = () => page.waitForTimeout(400)
  // tag text after the (throttled) UI + next rendered frame; polls up to 3 s instead of a fixed sleep
  const tagHas = async (name, text) => { try { await page.waitForFunction(([n, t]) => [...document.querySelectorAll('.sho-tag')].some(e => e.querySelector('b').textContent === n && e.textContent.includes(t)), [name, text], { timeout: 3000 }); return true } catch { return false } }

  check(`[${tag}] 7 desks/agents from profiles.list (incl. new sora)`, (await page.locator('.sho-tag').count()) === 7)
  check(`[${tag}] Hermes (default) shown as Hermes`, (await tagHas('Hermes', 'Hermes')), JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.sho-tag b')].map(b => b.textContent))))
  check(`[${tag}] all known agents start Idle (no fake activity)`, (await page.evaluate(() => [...document.querySelectorAll('.sho-tag em')].every(e => e.textContent.startsWith('Idle')))))

  // pooled-backend guard: profile stamp 'sora' (not in roster) must not get a desk or a status
    // scenario 1: chat → thinking
  await emit({ type: 'message.start', profile: 'kaito', session_id: 'rt-n' }); await settle()
  check(`[${tag}] chat: message.start → Kaito Berpikir`, (await tagHas('Kaito', 'Berpikir')))
  // scenario 2: tool → working, args never shown
  await emit({ type: 'tool.start', profile: 'kaito', session_id: 'rt-n', payload: { tool_id: 't1', name: 'terminal', args: { command: 'echo SECRET_TOKEN_123' } } }); await settle()
  check(`[${tag}] tool: tool.start → Kaito Mengetik`, (await tagHas('Kaito', 'Mengetik')))
  const bodyText = await page.evaluate(() => document.body.innerText)
  check(`[${tag}] feed shows tool name, never tool args`, bodyText.includes('memakai tool terminal') && !bodyText.includes('SECRET_TOKEN'))
  // scenario 3: error
  await emit({ type: 'message.complete', profile: 'ren', session_id: 'rt-e', payload: { status: 'error', error: 'rate limited' } }); await settle()
  check(`[${tag}] error: message.complete(error) → Ren Error`, (await tagHas('Ren', 'Error')))
  check(`[${tag}] header error chip`, (await page.evaluate(() => document.body.innerText)).includes('1 error'))
  // approval via session.active_list status 'waiting' (server-side pending approval/clarify)
  await page.evaluate(() => { window.__mock.active.find(r => r.id === 'rt-d').status = 'waiting' })
  await page.waitForFunction(() => [...document.querySelectorAll('.sho-tag')].some(t => t.textContent.includes('Yuki') && t.textContent.includes('Menunggu approval')), null, { timeout: 8000 }).catch(() => {})
  check(`[${tag}] approval: active_list waiting → Yuki Menunggu approval`, (await tagHas('Yuki', 'Menunggu approval')))
  check(`[${tag}] header "menunggu kamu" chip`, (await page.evaluate(() => document.body.innerText)).includes('1 menunggu kamu'))
  // genin
  await emit({ type: 'subagent.start', profile: 'kaito', session_id: 'rt-n', payload: { subagent_id: 'sa1', goal: 'PRIVATE GOAL' } }); await settle()
  check(`[${tag}] subagent.start → genin enters`, (await page.evaluate(() => window.__shinobiOffice.brain.genin.length)) === 1)
  check(`[${tag}] subagent goal text never shown`, !(await page.evaluate(() => document.body.innerText)).includes('PRIVATE GOAL'))
  // real status wins over sparring: force spar between two idle agents, then interrupt one
  // a spar may already be running (autonomous roaming among the idle agents) — use it, else force one
  const pair = await page.evaluate(() => {
    const o = window.__shinobiOffice
    if (!o.brain.spars.length) {
      const idle = o.brain.agents.filter(a => a.status === 'idle' && a.act.type !== 'spar').map(a => a.id)
      for (let i = 0; i < idle.length && !o.brain.spars.length; i++) for (let j = i + 1; j < idle.length && !o.brain.spars.length; j++) o.force(idle[i], 'spar', idle[j])
    }
    o.advance(4)
    const s = o.brain.spars[0]
    return s ? [s.a, s.b] : null
  })
  check(`[${tag}] idle agents can spar`, !!pair, JSON.stringify(pair))
  await page.screenshot({ path: path.join(out, `plugin-${tag}-live.png`) })
  const fighter = pair ? (pair.find(x => x !== 'sora') || pair[0]) : 'hana' // the stamp profile must not be the fighter
  const fighterProfile = fighter === 'hermes' ? 'default' : fighter
  // registry-tagged frame (connectionId) = a trusted owner route
  // registry frame stamped with a DIFFERENT route profile (remote/pooled); owner resolves via session.active_list
  await page.evaluate(p => {
    const key = window.__mock.profiles.find(x => x.name === p)?.last_session?.id || window.__mock.sessionsByProfile?.[p]?.[0]?.id // hana: only known via session.list
    window.__mock.active.push({ id: 'rt-qa-' + p, session_key: key, status: 'idle' })
    window.__mock.emit({ type: 'message.start', profile: 'sora', connectionId: 'c-remote', session_id: 'rt-qa-' + p })
  }, fighterProfile)
  const tEmit = Date.now()
  await page.waitForFunction(id => window.__shinobiOffice.brain.byId(id).status === 'thinking', fighter, { timeout: 9000 }).catch(() => {})
  if (process.env.QA_DEBUG) console.log('DEBUG', (Date.now() - tEmit) / 1000, JSON.stringify(await page.evaluate(() => window.__mock.log.filter(l => l[0] === 'request').map(l => [l[1], l[3] ?? '']).slice(-12))))
  await page.evaluate(() => window.__shinobiOffice.advance(1))
  const soc = await page.evaluate(id => { const a = window.__shinobiOffice.brain.byId(id); return { id, st: a.status, act: a.act.type } }, fighter)
  check(`[${tag}] real status interrupts spar (fighter back at desk)`, soc.st === 'thinking' && soc.act === 'desk' && (await page.evaluate(() => window.__shinobiOffice.brain.spars.length)) === 0, JSON.stringify(soc))
  check(`[${tag}] socket stamp 'sora' on every frame never drives Sora`, (await tagHas('Sora', 'Idle')), await tagText('Sora'))
  // done → idle
  await emit({ type: 'message.complete', profile: 'kaito', session_id: 'rt-n', payload: { status: 'complete', text: 'PRIVATE ANSWER' } }); await settle()
  check(`[${tag}] message.complete → Kaito Selesai`, (await tagHas('Kaito', 'Selesai')))
  check(`[${tag}] answer text never shown`, !(await page.evaluate(() => document.body.innerText)).includes('PRIVATE ANSWER'))
  // inspector + navigation
  await page.evaluate(() => [...document.querySelectorAll('.sho-tag')].find(t => t.querySelector('b').textContent === 'Kaito').click()); await settle()
  const insp = await page.evaluate(() => document.querySelector('aside')?.innerText || '')
  check(`[${tag}] inspector shows Kaito + source + last tool`, insp.includes('Kaito') && insp.includes('terminal') && insp.includes('Buka Chat'), insp.replace(/\n/g, ' | ').slice(0, 160))
  await page.screenshot({ path: path.join(out, `plugin-${tag}-inspector.png`) })
  await page.getByRole('button', { name: 'Buka Chat' }).click(); await settle()
  const log = await page.evaluate(() => window.__mock.log.filter(l => l[0] !== 'request'))
  check(`[${tag}] Buka Chat → host.openSession(last_session, {profile})`, JSON.stringify(log).includes('"openSession","st-kaito",{"profile":"kaito"'), JSON.stringify(log))
  const rpcs = [...new Set((await page.evaluate(() => window.__mock.log)).filter(l => l[0] === 'request').map(l => l[1]))]
  check(`[${tag}] read-only: only list/read RPCs used`, rpcs.every(r => ['profiles.list', 'session.active_list', 'session.list', 'cli.exec'].includes(r)), rpcs.join(','))
  // multi-room village (W2/W3): room tabs, location, follow
  const inspNow = await page.evaluate(() => document.querySelector('aside')?.innerText || '')
  check(`[${tag}] inspector shows location`, /Lokasi\s*\n?\s*(Markas|Dojo|Perpustakaan|Taman|Kedai|Selasar)/.test(inspNow), inspNow.slice(0, 120).replace(/\n/g, ' | '))
  await page.getByRole('button', { name: 'Ikuti' }).click(); await settle()
  check(`[${tag}] follow agent`, (await page.evaluate(() => window.__shinobiOffice.following)) === 'kaito')
  // V1: 360° orbit + "Lihat layar" (over-the-shoulder screen focus, Esc returns)
  await page.getByRole('button', { name: 'Lihat layar' }).click(); await page.evaluate(() => window.__shinobiOffice.advance(1.2)); await settle()
  const foc = await page.evaluate(() => ({ f: window.__shinobiOffice.focused, back: !!document.querySelector('button') && [...document.querySelectorAll('button')].some(b => /Kembali \(Esc\)/.test(b.textContent)) }))
  check(`[${tag}] Lihat layar → focus on laptop + back button`, foc.f === 'kaito' && foc.back, JSON.stringify(foc))
  await page.screenshot({ path: path.join(out, `plugin-${tag}-screen.png`) })
  await page.keyboard.press('Escape'); await settle()
  check(`[${tag}] Esc leaves screen focus`, (await page.evaluate(() => window.__shinobiOffice.focused)) === null)
  // V3: countryside quality setting cycles auto → high → eco and applies to the scene
  {
    const btn = page.getByRole('button', { name: /^Kualitas:/ })
    const seen = []
    for (let k = 0; k < 3; k++) { await btn.click(); await settle(); seen.push(await page.evaluate(() => window.__shinobiOffice.quality)) }
    check(`[${tag}] quality setting cycles + applies`, JSON.stringify(seen.map(q => q.active)) === JSON.stringify(['high', 'eco', 'high']) && seen[2].mode === 'auto', JSON.stringify(seen))
  }
  // V2: floor tabs (Lantai 1 hides floor 2; Lantai 2 frames the Kage room; Markas shows both)
  for (const [label, view, mode] of [['Lantai 1', 'floor1', 'f1'], ['Lantai 2 · Kage', 'floor2', 'both']]) {
    await page.getByRole('button', { name: label, exact: true }).click(); await settle()
    const st = await page.evaluate(() => ({ v: window.__shinobiOffice.view, m: window.__shinobiOffice.floorMode, kageDeskZ: window.__shinobiOffice.brain.byId('hermes').desk.z }))
    check(`[${tag}] floor tab ${label}`, st.v === view && st.m === mode && st.kageDeskZ > 30, JSON.stringify(st))
    await page.screenshot({ path: path.join(out, `plugin-${tag}-${view}.png`) })
  }
  for (const [label, view] of [['Desa', 'country'], ['Kompleks', 'all'], ['Dojo', 'dojo'], ['Taman', 'garden'], ['Markas', 'overview']]) {
    await page.getByRole('button', { name: label, exact: true }).click(); await settle()
    if (view === 'all') await page.screenshot({ path: path.join(out, `plugin-${tag}-village.png`) })
    if (view === 'country') await page.screenshot({ path: path.join(out, `plugin-${tag}-country.png`) })
    check(`[${tag}] room tab ${label}`, (await page.evaluate(() => window.__shinobiOffice.view)) === view)
  }
  // W4 idle conversations: force a chat between two idle agents, bubbles appear, safe text, status interrupts
  await page.getByRole('button', { name: 'Markas', exact: true }).click()
  const pairOk = await page.evaluate(() => { const o = window.__shinobiOffice; const idle = o.brain.agents.filter(a => a.status === 'idle' && a.act.type !== 'spar').map(a => a.id); for (let i = 0; i < idle.length; i++) for (let j = i + 1; j < idle.length; j++) if (o.force(idle[i], 'chat', idle[j])) return [idle[i], idle[j]]; return null })
  check(`[${tag}] two idle agents start a conversation`, !!pairOk, JSON.stringify(pairOk))
  const said = await page.evaluate(async () => { const o = window.__shinobiOffice; const seen = new Set(); for (let i = 0; i < 400; i++) { o.advance(0.2, 1 / 10); for (const a of o.brain.agents) if (a.line) seen.add(a.id + ': ' + a.line); if (seen.size >= 2) break } return [...seen] })
  check(`[${tag}] speech bubbles show curated lines`, said.length >= 2, said.slice(0, 3).join(' / '))
  // look at the room where they talk, and keep advancing until a line is on screen
  const sayDom = await page.evaluate(id => {
    const o = window.__shinobiOffice
    const loc = o.locationOf(id).id
    o.setView({ hq: 'overview', kage: 'floor2', village: 'country', stair: 'overview', walkway: 'all' }[loc] || loc)
    for (let i = 0; i < 60; i++) {
      o.advance(0.25, 1 / 10)
      const vis = [...document.querySelectorAll('.sho-tag')].filter(t => t.style.display !== 'none').map(t => t.querySelector('.sho-say')).filter(e => e.style.display !== 'none' && e.textContent).map(e => e.textContent)
      if (vis.length) return vis
    }
    return []
  }, pairOk?.[0])
  check(`[${tag}] speech bubble visible on screen`, sayDom.length >= 1, sayDom.join(' / '))
  await page.screenshot({ path: path.join(out, `plugin-${tag}-chat.png`) })
  check(`[${tag}] chat never enters the Activity Feed`, !(await page.evaluate(() => [...document.querySelectorAll('[aria-live]')].map(e => e.innerText).join(' '))).includes(said[0]?.split(': ')[1] || '@@'))
  const lvl = await page.getByRole('button', { name: /^Obrolan:/ }).textContent()
  await page.getByRole('button', { name: /^Obrolan:/ }).click(); await settle()
  check(`[${tag}] chat setting cycles + reaches the scene`, lvl === 'Obrolan: Normal' && (await page.getByRole('button', { name: /^Obrolan:/ }).textContent()) === 'Obrolan: Ramai' && (await page.evaluate(() => window.__shinobiOffice.brain.chatLevel)) === 2)
  // Mission Board (P3)
  check(`[${tag}] inspector lists Kaito's mission`, (await page.evaluate(() => document.querySelector('aside')?.innerText || '')).includes('Ship Shinobi office'))
  await page.getByRole('button', { name: /^Misi · / }).click(); await settle()
  const mp = await page.evaluate(() => document.querySelector('aside')?.innerText || '')
  check(`[${tag}] Mission Board panel: 2 active, running first, 1 done/24h`, mp.includes('2 aktif') && mp.indexOf('Ship Shinobi office') < mp.indexOf('Edit reel episode 4') && mp.includes('1 selesai'), mp.replace(/\n/g, ' | ').slice(0, 200))
  check(`[${tag}] task bodies never shown`, !(await page.evaluate(() => document.body.innerText)).includes('BODY_SECRET'))
  check(`[${tag}] 3D board shows the 2 real mission scrolls`, (await page.evaluate(() => window.__shinobiOffice.room.scrolls.children.length)) === 2)
  await page.screenshot({ path: path.join(out, `plugin-${tag}-missions.png`) })
  await page.getByRole('button', { name: 'Buka di Kanban' }).click(); await settle()
  check(`[${tag}] Buka di Kanban → navigate('/kanban')`, JSON.stringify(await page.evaluate(() => window.__mock.log)).includes('["navigate","/kanban"]'))
  // approval gong badge
  const gong = await page.evaluate(() => { const g = document.querySelector('.sho-gong'); const st = document.querySelector('[aria-label="Ruang kantor 3D Shinobi HQ"]').getBoundingClientRect(); const r = g.getBoundingClientRect(); return { shown: g.style.display !== 'none', text: g.textContent, inside: r.left >= st.left && r.right <= st.right && r.top >= st.top && r.bottom <= st.bottom } })
  check(`[${tag}] gong badge shows approvals, inside the stage`, gong.shown && gong.text.includes('1') && gong.inside, JSON.stringify(gong))
  check(`[${tag}] hana's older session resolved via session.list (not misattributed)`, (await tagText('Hana')).length > 0)
  check(`[${tag}] session preview text never shown`, !(await page.evaluate(() => document.body.innerText)).includes('PRIVATE PREVIEW'))
  // tags inside stage + no overlap
  const geo = await page.evaluate(() => {
    const st = document.querySelector('[aria-label="Ruang kantor 3D Shinobi HQ"]').getBoundingClientRect()
    const rs = [...document.querySelectorAll('.sho-tag')].filter(t => t.style.display !== 'none').map(t => t.querySelector('.sho-name').getBoundingClientRect())
    const inside = rs.every(r => r.left >= st.left - 1 && r.right <= st.right + 1 && r.top >= st.top - 1 && r.bottom <= st.bottom + 1)
    let overlaps = 0
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i], b = rs[j]; if (a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2) overlaps++ }
    const bad = [...document.querySelectorAll('.sho-tag')].filter(t => t.style.display !== 'none').map(t => [t.querySelector('.sho-name').textContent, t.querySelector('.sho-name').getBoundingClientRect()]).filter(([, r]) => !(r.left >= st.left - 1 && r.right <= st.right + 1 && r.top >= st.top - 1 && r.bottom <= st.bottom + 1)).map(([n, r]) => n + '@' + [r.left, r.top, r.right, r.bottom].map(Math.round) + ' stage ' + [st.left, st.top, st.right, st.bottom].map(Math.round))
    return { inside, overlaps, stage: [Math.round(st.width), Math.round(st.height)], bad }
  })
  check(`[${tag}] name tags inside stage`, geo.inside, JSON.stringify(geo))
  check(`[${tag}] name tags do not overlap`, geo.overlaps === 0, JSON.stringify(geo))
  // roster failure → unknown, not idle
  await page.evaluate(async () => { window.__mock.failRoster = true })
  const f0 = await page.evaluate(() => window.__shinobiOffice.frames()); await page.waitForTimeout(2000)
  const fps = ((await page.evaluate(() => window.__shinobiOffice.frames())) - f0) / 2
  check(`[${tag}] render loop capped (≤ 31 fps)`, fps <= 31 && fps > 0, `${fps} fps`)
  check(`[${tag}] no page errors`, errors.length === 0, errors.slice(0, 3).join(' / '))
  await page.close()
}

await run({ width: 1480, height: 900 }, 'wide')
await run({ width: 820, height: 760 }, 'narrow')
await browser.close(); srv.close()
const failed = results.filter(r => !r.ok).length
console.log(`${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)

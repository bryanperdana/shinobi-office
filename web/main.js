// Standalone web demo (self-hostable static page): sample data only. Bundled by esbuild → web/app.js
import { createOffice } from '../src/scene3d/office.js'

export const AGENTS = [
  { id: 'hermes', voice: 'kage', name: 'Hermes', role: 'Kage · Chief of Staff', hair: '#E8E6F0', jacket: '#F4F1EA', trim: '#D6334C', style: 'kage', props: ['kage'], cushion: '#D6334C' },
  { id: 'kaito', voice: 'coder', name: 'Kaito', role: 'CTO · Dev Lab', hair: '#2A2438', jacket: '#E2557A', trim: '#2A2438', tips: '#F78FB3', style: 'spiky', props: ['dual'], cushion: '#E2557A' },
  { id: 'hana', voice: 'artist', name: 'Hana', role: 'Style Studio', hair: '#7C3AED', jacket: '#0EA5A4', trim: '#FDE68A', style: 'long', props: ['palette'], cushion: '#0EA5A4' },
  { id: 'ren', voice: 'herald', name: 'Ren', role: 'Broadcast Arena', hair: '#1F2937', jacket: '#334155', trim: '#FB923C', style: 'messy', props: ['megaphone'], cushion: '#FB923C' },
  { id: 'tama', voice: 'cat', name: 'Tama', role: 'Treasury · Kucing Ninja', species: 'cat', fur: '#F2A65A', stripe: '#8A4B1F', muzzle: '#FFF1DC', hair: '#F2A65A', jacket: '#16A34A', trim: '#FDE047', style: 'cat', props: ['abacus'], cushion: '#F59E0B', scale: 0.92 },
  { id: 'yuki', voice: 'messenger', name: 'Yuki', role: 'Messenger Post', hair: '#EA7A1A', jacket: '#2563EB', trim: '#BFDBFE', style: 'spiky', props: ['bird'], cushion: '#2563EB' },
]

const params = new URLSearchParams(location.search)
const qa = params.has('qa')
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

// sample real-status scenario (Hermes thinking, Kaito working, Yuki approval; others idle → roam)
const START = { hermes: 'thinking', kaito: 'working', hana: 'idle', ren: 'idle', tama: 'idle', yuki: 'approval' }

const stage = document.getElementById('stage')
const office = createOffice(stage, {
  agents: AGENTS.map(a => ({ ...a, status: START[a.id] })), seed: 7,
  night: params.get('night') === '1', reducedMotion: false,
  qa: true,
  quality: params.get('q') || 'auto',
  screenInfo: id => ({ kaito: { tool: 'terminal', since: 12, missions: ['Build Shinobi HQ'], genin: 1 }, hermes: { since: 40, missions: ['Rekap mingguan'] }, yuki: { since: 95 } }[id] || { missions: [] }),
  onSelect: (snap, tick) => renderInspector(snap, tick),
})
window.office = office
// demo only: sample scrolls (the plugin feeds real Kanban tasks)
office.setMissions([{ rank: 'S', color: '#E11D48', title: 'Build Shinobi HQ' }, { rank: 'A', color: '#F59E0B', title: 'Hardening failover' }, { rank: 'B', color: '#3B82F6', title: 'Rekap mingguan' }, { rank: 'C', color: '#22C55E', title: 'Draft thread X' }])

const feed = document.getElementById('feed-rows')
function log(icon, html) {
  const t = new Date().toLocaleTimeString('id-ID', { hour12: false })
  const row = document.createElement('div'); row.className = 'row'
  row.innerHTML = `<span class="t">${t}</span>${icon} ${html}`
  feed.prepend(row)
  while (feed.children.length > 5) feed.lastChild.remove()
}

// Inspector
const byId = Object.fromEntries(AGENTS.map(a => [a.id, a]))
let lastInsp = ''
function renderInspector(snap, tick) {
  const el = document.getElementById('insp-body')
  if (!snap) { if (!tick) { el.innerHTML = '<p class="muted">Klik karakter atau papan nama untuk melihat detail agent.</p>'; lastInsp = '' } return }
  const a = byId[snap.id]
  const key = snap.id + snap.label
  if (key === lastInsp) return
  lastInsp = key
  el.innerHTML = `
    <div class="hd"><div class="av" style="border-color:${a.jacket}"><span style="background:${a.hair}"></span></div>
    <div><h2>${a.name}</h2><div class="role">${a.role} · profile <code>${snap.id === 'yuki' ? 'yuki' : snap.id === 'hermes' ? 'default' : snap.id}</code></div></div></div>
    <div><span class="pill" style="background:${snap.color}22;color:${snap.color}">● ${snap.label}</span></div>
    <div class="kv"><span>Status real</span><span>${snap.statusLabel}</span><span>Aktivitas</span><span>${snap.activity ? 'visual saja (idle)' : 'di meja'}</span><span>Sumber</span><span><code>contoh</code></span></div>
    <div class="ro">Aktivitas jalan-jalan/sparring hanya dekorasi saat status real = Idle. Begitu ada sinyal kerja, agent langsung kembali ke meja.</div>
    <div style="display:flex;gap:8px"><button class="btn pri" style="flex:1">💬 Buka Chat</button><button class="btn" style="flex:1">📜 Lihat Misi</button></div>`
}
renderInspector(null)

// Demo controls (mockup only — in the plugin these come from real Hermes signals)
const STATUSES = ['idle', 'thinking', 'working', 'approval', 'error', 'done', 'sleep', 'offline']
const ctl = document.getElementById('ctl')
ctl.innerHTML = AGENTS.map(a => `<label>${a.name}<select data-id="${a.id}">${STATUSES.map(s => `<option ${s === START[a.id] ? 'selected' : ''}>${s}</option>`).join('')}</select></label>`).join('')
ctl.addEventListener('change', e => {
  const id = e.target.dataset.id
  office.setStatus(id, e.target.value)
  log('🔁', `<b>${byId[id].name}</b> → status <code>${e.target.value}</code>`)
})
document.getElementById('btn-spar').onclick = () => {
  const idle = office.brain.agents.filter(a => a.status === 'idle' && !office.brain.spars.length)
  if (idle.length < 2) return log('⚠️', 'Butuh minimal 2 agent idle untuk sparring')
  if (office.force(idle[0].id, 'spar', idle[1].id)) log('🥋', `<b>${byId[idle[0].id].name}</b> vs <b>${byId[idle[1].id].name}</b> — sparring di arena`)
}
document.getElementById('btn-genin').onclick = () => { const id = office.spawnGenin('kaito', 'research'); log('🥷', 'Genin keluar dari Academy → meja <b>Kaito</b>'); setTimeout(() => office.completeGenin(id), 14000) }
document.getElementById('btn-night').onclick = () => { document.body.classList.toggle('night'); office.setNight(document.body.classList.contains('night')) }
document.getElementById('btn-view').onclick = (() => { const vs = ['ring', 'kage', 'overview']; let i = 0; return () => office.setView(vs[i++ % vs.length]) })()

if (!qa) {
  office.start()
  log('🟢', '<b>Kaito</b> menjalankan tool <code>terminal</code>')
  log('🔔', '<b>Yuki</b> menunggu approval')
  setTimeout(() => { if (office.force('hana', 'spar', 'ren')) log('🥋', '<b>Hana</b> vs <b>Ren</b> — sparring di arena') }, 2500)
  if (reduced) office.stop()
}
window.__ready = true

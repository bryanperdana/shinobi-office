// The /office page: 3D Shinobi HQ + inspector + activity feed. Read-only + navigation.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { host, Button, SessionStatusDot, useValue } from '@hermes/plugin-sdk'
import { createOffice } from '../scene3d/office.js'
import { STATUS_LABEL } from '../scene3d/brain.js'
import { STATUS_COLOR } from '../scene3d/room.js'
import { appearanceFor, orderProfiles } from './appearance.js'
import { CONFIG } from '../config.js'
import { activeMissions, doneRecently, boardScrolls, rankFor, STATUS_LABEL_ID } from '../live/missions.js'

const MAX_DESKS = 13 // HQ desk slots: 10 original + 3 extra (arena moved to the Dojo, Kage moved upstairs)
const ACTIVE = new Set(['thinking', 'working'])

function ago(ms) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (s < 60) return `${s} dtk lalu`
  if (s < 3600) return `${Math.round(s / 60)} mnt lalu`
  return `${Math.round(s / 3600)} jam lalu`
}

function wibHour() {
  try { return Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: CONFIG.timeZone || 'Asia/Jakarta' }).format(new Date())) % 24 } catch { return new Date().getHours() }
}
const isNightNow = () => { const h = wibHour(); return h >= 18 || h < 6 }

const S = {
  root: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: 8, padding: 10, boxSizing: 'border-box', color: 'var(--ui-text-primary)' },
  head: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minHeight: 32 },
  title: { fontWeight: 700, fontSize: 14, marginRight: 4 },
  sub: { fontSize: 11, color: 'var(--ui-text-tertiary)' },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '2px 8px', borderRadius: 999, border: '1px solid var(--ui-stroke-secondary)', color: 'var(--ui-text-secondary)', whiteSpace: 'nowrap' },
  dot: c => ({ width: 8, height: 8, borderRadius: 99, background: c, display: 'inline-block', flex: 'none' }),
  spacer: { flex: 1 },
  body: { display: 'flex', flex: 1, minHeight: 0, gap: 8, position: 'relative' },
  stage: { flex: 1, minWidth: 0, minHeight: 240, position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--ui-stroke-secondary)' },
  aside: { width: 290, flex: 'none', display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 10, border: '1px solid var(--ui-stroke-secondary)', overflow: 'auto', fontSize: 12, background: 'var(--ui-bg-elevated, transparent)' },
  asideOverlay: { position: 'absolute', right: 8, top: 8, bottom: 8, zIndex: 5, boxShadow: '0 8px 30px rgba(0,0,0,.35)', background: 'var(--ui-bg-elevated, var(--background, Canvas))' },
  row: { display: 'flex', gap: 8, alignItems: 'baseline' },
  k: { width: 78, flex: 'none', color: 'var(--ui-text-tertiary)', fontSize: 11 },
  feed: { display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: 'var(--ui-text-secondary)', maxHeight: 92, overflow: 'hidden' },
  muted: { color: 'var(--ui-text-tertiary)', fontSize: 11 },
  center: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', color: 'var(--ui-text-secondary)', fontSize: 12 },
  hidden: { position: 'absolute', width: 0, height: 0, overflow: 'hidden', visibility: 'hidden', pointerEvents: 'none' },
}

// Reads core's own per-session state (the same dot the sidebar shows) for each agent's stored
// sessions: 'needs-input' (approval/clarify waiting on the user) or 'working'. Read-only.
function DotProbe({ entries, onDots }) {
  const ref = useRef(null)
  const key = entries.map(e => e.profile + ':' + e.ids.join(',')).join('|')
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => {
      const out = {}
      for (const grp of el.querySelectorAll('[data-p]')) {
        let st = 'idle'
        for (const s of grp.querySelectorAll('span')) {
          const c = typeof s.className === 'string' ? s.className : ''
          if (c.includes('bg-amber-500')) { st = 'needs-input'; break }
          if (c.includes('bg-(--ui-accent)')) st = 'working'
        }
        out[grp.dataset.p] = st
      }
      onDots(out)
    }
    read()
    const mo = new MutationObserver(read)
    mo.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] })
    return () => mo.disconnect()
  }, [key])
  if (!SessionStatusDot) return null
  return jsx('div', {
    ref, 'aria-hidden': true, style: S.hidden,
    children: entries.map(e => jsx('span', { 'data-p': e.profile, children: e.ids.map(id => jsx(SessionStatusDot, { storedSessionId: id }, id)) }, e.profile)),
  })
}

function Inspector({ agent, rec, profile, onClose, overlay, missions, location, onFollow, following, onScreen, screenOn }) {
  if (!agent) {
    return jsx('aside', { style: S.aside, children: jsxs('div', { children: [
      jsx('div', { style: { fontWeight: 700, marginBottom: 6 }, children: 'Inspector' }),
      jsx('div', { style: S.muted, children: 'Klik karakter atau papan nama untuk melihat detail agent.' }),
      jsx('div', { style: { ...S.muted, marginTop: 12, lineHeight: 1.5 }, children: 'Status berasal dari sinyal asli Hermes (event gateway, sesi berjalan, status sesi, riwayat sesi). Jalan-jalan & sparring hanya dilakukan agent yang idle — status asli selalu menang.' }),
    ] }) })
  }
  const status = rec?.status || 'unknown'
  const last = profile?.last_session
  const open = async () => {
    try {
      if (last?.id) await host.openSession(last.id, { profile: profile.name, intent: 'tab' })
      else await host.newChat(profile.name)
    } catch (e) { host.notifyError?.(e, 'Gagal membuka chat') }
  }
  const fresh = async () => { try { await host.newChat(profile.name) } catch (e) { host.notifyError?.(e, 'Gagal membuat chat baru') } }
  const kv = (k, v) => jsxs('div', { style: S.row, children: [jsx('span', { style: S.k, children: k }), jsx('span', { style: { minWidth: 0, overflowWrap: 'anywhere' }, children: v })] })
  return jsxs('aside', { style: overlay ? { ...S.aside, ...S.asideOverlay } : S.aside, children: [
    jsxs('div', { style: { display: 'flex', alignItems: 'center', gap: 10 }, children: [
      jsx('div', { style: { width: 34, height: 34, borderRadius: 99, background: agent.jacket, border: `3px solid ${agent.hair}`, flex: 'none' } }),
      jsxs('div', { style: { minWidth: 0, flex: 1 }, children: [
        jsx('div', { style: { fontWeight: 700, fontSize: 14 }, children: agent.name }),
        jsxs('div', { style: S.muted, children: [agent.role, ' · ', jsx('code', { children: profile?.name })] }),
      ] }),
      jsx(Button, { variant: 'ghost', size: 'xs', onClick: onClose, 'aria-label': 'Tutup inspector', children: '✕' }),
    ] }),
    jsxs('div', { style: { ...S.chip, alignSelf: 'flex-start', color: STATUS_COLOR[status], borderColor: STATUS_COLOR[status] }, children: [jsx('i', { style: S.dot(STATUS_COLOR[status]) }), STATUS_LABEL[status] || status] }),
    kv('Lokasi', location || '—'),
    kv('Sumber', rec?.source || '—'),
    kv('Sejak', rec ? ago(rec.since) : '—'),
    kv('Tool terakhir', rec?.lastTool || '—'),
    kv('Genin aktif', String(rec?.geninActive || 0)),
    kv('Misi', missions && missions.length ? missions.map(t => `${rankFor(t.priority).rank} · ${t.title} (${STATUS_LABEL_ID[t.status] || t.status})`).join(' / ') : '—'),
    rec?.lastError ? kv('Error terakhir', `${rec.lastError.text} · ${ago(rec.lastError.at)}`) : null,
    kv('Sesi terakhir', last?.last_active ? `${(last.title || 'tanpa judul').slice(0, 60)} · ${ago(last.last_active * 1000)}` : '—'),
    jsxs('div', { style: { display: 'flex', gap: 6, marginTop: 4 }, children: [
      jsx(Button, { size: 'sm', onClick: open, children: last?.id ? 'Buka Chat' : 'Chat Baru' }),
      last?.id ? jsx(Button, { size: 'sm', variant: 'outline', onClick: fresh, children: 'Chat Baru' }) : null,
      jsx(Button, { size: 'sm', variant: following ? 'secondary' : 'ghost', onClick: onFollow, children: following ? 'Berhenti ikuti' : 'Ikuti' }),
      jsx(Button, { size: 'sm', variant: screenOn ? 'secondary' : 'ghost', onClick: onScreen, children: screenOn ? 'Kembali' : 'Lihat layar' }),
    ] }),
    jsx('div', { style: S.muted, children: 'Office bersifat read-only: tidak bisa steer, interrupt, atau approve dari sini.' }),
  ] })
}

function MissionPanel({ missions, nameOf, onClose, overlay }) {
  const act = activeMissions(missions.tasks)
  const done = doneRecently(missions.tasks)
  const body = missions.ok === false && !missions.tasks.length
    ? jsx('div', { style: S.muted, children: `Kanban tidak terbaca: ${missions.error || 'tidak diketahui'}` })
    : missions.ok === null
      ? jsx('div', { style: S.muted, children: 'Memuat misi…' })
      : act.length
        ? act.map(t => { const r = rankFor(t.priority); return jsxs('div', { style: { display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid var(--ui-stroke-secondary)' }, children: [
            jsx('span', { style: { width: 22, height: 22, flex: 'none', borderRadius: 99, background: r.color, color: '#fff', fontWeight: 800, display: 'grid', placeItems: 'center', fontSize: 12 }, title: `Prioritas ${t.priority}`, children: r.rank }),
            jsxs('div', { style: { minWidth: 0 }, children: [
              jsx('div', { style: { fontWeight: 600, overflowWrap: 'anywhere' }, children: t.title }),
              jsx('div', { style: S.muted, children: `${STATUS_LABEL_ID[t.status] || t.status} · ${t.assignee ? nameOf(t.assignee) : 'belum ditugaskan'}` }),
            ] }),
          ] }, t.id) })
        : jsx('div', { style: S.muted, children: 'Tidak ada misi aktif di papan Kanban.' })
  return jsxs('aside', { style: overlay ? { ...S.aside, ...S.asideOverlay } : S.aside, children: [
    jsxs('div', { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [
      jsx('div', { style: { fontWeight: 700, fontSize: 14, flex: 1 }, children: `Mission Board · ${act.length} aktif` }),
      jsx(Button, { variant: 'ghost', size: 'xs', onClick: onClose, 'aria-label': 'Tutup Mission Board', children: '✕' }),
    ] }),
    jsx('div', { style: S.muted, children: `${done.length} selesai dalam 24 jam terakhir${missions.at ? ' · diperbarui ' + ago(missions.at) : ''}${missions.ok === false && missions.tasks.length ? ' · gagal refresh terakhir' : ''}` }),
    jsx('div', { children: body }),
    jsx('div', { style: { display: 'flex', gap: 6 }, children: jsx(Button, { size: 'sm', variant: 'outline', onClick: () => host.navigate('/kanban'), children: 'Buka di Kanban' }) }),
    jsx('div', { style: S.muted, children: 'Read-only: misi dikelola di halaman Kanban.' }),
  ] })
}

export function OfficePage({ live }) {
  useSyncExternalStore(live.subscribeUi, () => live.uiVersion)
  const gateway = useValue ? useValue(host.state.gateway) : 'open'
  const roster = live.roster
  const model = live.model
  const ordered = useMemo(() => orderProfiles(roster.profiles), [roster.profiles])
  const shown = ordered.slice(0, MAX_DESKS)
  const agents = useMemo(() => shown.map(p => appearanceFor(p)), [shown.map(p => p.name + (p.display_name || '') + (p.title || '')).join('|')])
  const rosterKey = agents.map(a => a.profile + a.name + a.jacket).join('|')
  const byAppId = Object.fromEntries(agents.map(a => [a.id, a]))
  const profileByName = Object.fromEntries(roster.profiles.map(p => [p.name, p]))

  const stageRef = useRef(null), officeRef = useRef(null), geninMap = useRef(new Map()), rootRef = useRef(null)
  const [selected, setSelected] = useState(null)
  const [err, setErr] = useState(null)
  const [nightMode, setNightMode] = useState('auto') // auto | day | night
  const [narrow, setNarrow] = useState(false)
  const [panel, setPanel] = useState(null) // null | 'missions'
  const [, setTick] = useState(0)
  const [focused, setFocused] = useState(null)
  const [chatLevel, setChatLevel] = useState(1)
  const [quality, setQuality] = useState('auto') // countryside detail: auto · high · eco
  const [autoEco, setAutoEco] = useState(false)
  useEffect(() => { live.getSetting('quality', 'auto').then(v => setQuality(['auto', 'high', 'eco'].includes(v) ? v : 'auto')) }, [])
  useEffect(() => { officeRef.current?.setQuality(quality); setAutoEco(false) }, [quality])
  useEffect(() => { live.getSetting('chatLevel', 1).then(v => setChatLevel(Number(v) >= 0 ? Number(v) : 1)) }, [])
  useEffect(() => { officeRef.current?.setChatLevel(chatLevel) }, [chatLevel])
  const missions = live.missions

  useEffect(() => { live.setPageMounted(true); return () => live.setPageMounted(false) }, [])

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setNarrow(el.clientWidth < 900)); ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // (re)build the 3D office when the roster changes
  useEffect(() => {
    if (!stageRef.current || !agents.length) return
    let office
    try {
      const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
      office = createOffice(stageRef.current, {
        agents: agents.map(a => ({ ...a, status: model.statusOf(a.profile) })), seed: 7,
        night: nightMode === 'night' || (nightMode === 'auto' && isNightNow()), reducedMotion: reduced,
        onSelect: (snap, tick) => { if (!tick) { setSelected(snap ? snap.id : null); if (snap) setPanel(null) } },
        onBoard: () => { setPanel('missions'); setSelected(null) },
        qa: Boolean(globalThis.__SHINOBI_QA__),
        chatLevel,
        owner: CONFIG.ownerName || 'Boss',
        timeZone: CONFIG.timeZone || 'Asia/Jakarta',
        quality,
        onQuality: () => setAutoEco(true),
        // laptop screens: safe fields only (status/tool NAME/age/mission titles/genin)
        screenInfo: id => {
          const ag = agents.find(a => a.id === id); if (!ag) return null
          const r = model.snapshot().find(x => x.profile === ag.profile)
          return {
            tool: r?.lastTool || null,
            since: r ? (Date.now() - r.since) / 1000 : null,
            missions: live.missions.ok ? activeMissions(live.missions.tasks).filter(t => t.assignee === ag.profile).map(t => t.title) : null,
            genin: r?.geninActive || 0,
          }
        },
        onFocusChange: id => setFocused(id),
        // safe aggregate facts for idle conversations (counts + agent names only)
        facts: () => {
          const st = agents.map(a => model.statusOf(a.profile))
          const done = model.feed().find(f => f.kind === 'done' && Date.now() - f.at < 10 * 60_000)
          return {
            missions: live.missions.ok ? activeMissions(live.missions.tasks).length : null,
            approvals: st.filter(x => x === 'approval').length,
            genin: model.genin().filter(g => !g.done).length,
            lastDone: done ? (done.profile === 'default' ? 'hermes' : done.profile) : null,
          }
        },
      })
      if (globalThis.__SHINOBI_QA__) globalThis.__shinobiOffice = office
      officeRef.current = office; geninMap.current = new Map(); setErr(null)
      office.start()
    } catch (e) {
      setErr(String(e?.message || e)); officeRef.current = null
    }
    return () => { office?.dispose(); if (officeRef.current === office) officeRef.current = null }
  }, [rosterKey])

  // push real statuses + genin into the scene after every (throttled) render; brain ignores unchanged statuses
  useEffect(() => {
  const o = officeRef.current
  if (o && missions.ok) o.setMissions(boardScrolls(missions.tasks))
  if (o) {
    for (const a of agents) o.setStatus(a.id, model.statusOf(a.profile))
    const live_ = model.genin()
    const seen = new Set()
    for (const g of live_) {
      seen.add(g.id)
      const parent = agents.find(a => a.profile === g.parent)
      if (!g.done && parent && !geninMap.current.has(g.id)) { const bid = o.spawnGenin(parent.id, 'genin'); if (bid) geninMap.current.set(g.id, bid) }
      if (g.done && geninMap.current.has(g.id)) { o.completeGenin(geninMap.current.get(g.id)); geninMap.current.set(g.id, null) }
    }
    for (const [mid, bid] of geninMap.current) if (!seen.has(mid)) { if (bid) o.completeGenin(bid); geninMap.current.delete(mid) }
  }
  })

  useEffect(() => {
    const apply = () => officeRef.current?.setNight(nightMode === 'night' || (nightMode === 'auto' && isNightNow()))
    apply()
    const t = setInterval(apply, 60_000)
    return () => clearInterval(t)
  }, [nightMode, rosterKey])

  const statuses = agents.map(a => model.statusOf(a.profile))
  const count = s => statuses.filter(x => (typeof s === 'function' ? s(x) : x === s)).length
  const sel = selected ? byAppId[selected] : null
  const selRec = sel ? model.snapshot().find(r => r.profile === sel.profile) : null
  const feed = model.feed().slice(0, 5)
  const nameOf = p => byAppId[p === 'default' ? 'hermes' : p]?.name || p
  const dotEntries = shown.map(p => ({ profile: p.name, ids: [...new Set([p.last_session?.id, p.canonical_session?.id].filter(x => typeof x === 'string' && x))] })).filter(e => e.ids.length)

  const chip = (color, text, title) => jsxs('span', { style: S.chip, title, children: [jsx('i', { style: S.dot(color) }), text] })
  const viewBtn = (name, label) => jsx(Button, { size: 'xs', variant: 'ghost', onClick: () => officeRef.current?.setView(name), children: label }, name)

  let stageChildren = null
  if (err) stageChildren = jsx('div', { style: S.center, children: `3D tidak bisa dimulai (WebGL): ${err}` })
  else if (roster.ok === false && !agents.length) stageChildren = jsx('div', { style: S.center, children: `Gagal membaca daftar profile: ${roster.error || 'tidak diketahui'}` })
  else if (!agents.length) stageChildren = jsx('div', { style: S.center, children: 'Memuat daftar agent…' })

  return jsxs('div', { ref: rootRef, style: S.root, children: [
    jsxs('div', { style: S.head, children: [
      jsx('span', { style: S.title, children: 'Virtual Office · Shinobi HQ' }),
      chip(gateway === 'open' ? '#22C55E' : '#F59E0B', gateway === 'open' ? 'Live' : `Gateway: ${gateway}`, 'Status koneksi gateway'),
      chip(STATUS_COLOR.working, `${count(x => ACTIVE.has(x))} bekerja`),
      count('approval') ? chip(STATUS_COLOR.approval, `${count('approval')} menunggu kamu`) : null,
      count('error') ? chip(STATUS_COLOR.error, `${count('error')} error`) : null,
      chip(STATUS_COLOR.idle, `${count('idle')} idle`),
      ordered.length > MAX_DESKS ? chip(STATUS_COLOR.unknown, `+${ordered.length - MAX_DESKS} tanpa meja`) : null,
      jsx('span', { style: S.spacer }),
      jsx(Button, { size: 'xs', variant: panel === 'missions' ? 'secondary' : 'ghost', onClick: () => setPanel(p => (p === 'missions' ? null : 'missions')), children: `Misi · ${missions.ok === false && !missions.tasks.length ? '?' : activeMissions(missions.tasks).length}` }),
      viewBtn('country', 'Desa'), viewBtn('all', 'Kompleks'), viewBtn('overview', 'Markas'), viewBtn('floor1', 'Lantai 1'), viewBtn('floor2', 'Lantai 2 · Kage'), viewBtn('dojo', 'Dojo'), viewBtn('library', 'Perpustakaan'), viewBtn('garden', 'Taman'), viewBtn('teahouse', 'Kedai Teh'),
      jsx(Button, { size: 'xs', variant: 'outline', title: 'Detail pedesaan. Auto turun ke Hemat bila frame rate rendah (mis. laptop dengan GPU terintegrasi).', onClick: () => { const order = ['auto', 'high', 'eco']; const next = order[(order.indexOf(quality) + 1) % order.length]; setQuality(next); live.setSetting('quality', next) }, children: `Kualitas: ${({ auto: autoEco ? 'Auto (Hemat)' : 'Auto', high: 'Tinggi', eco: 'Hemat' })[quality]}` }),
      jsx(Button, { size: 'xs', variant: 'outline', title: 'Obrolan agent saat idle (dekorasi, bukan aktivitas kerja)', onClick: () => { const order = [0, 0.5, 1, 2]; const next = order[(order.indexOf(chatLevel) + 1) % order.length]; setChatLevel(next); live.setSetting('chatLevel', next) }, children: `Obrolan: ${({ 0: 'Mati', 0.5: 'Jarang', 1: 'Normal', 2: 'Ramai' })[chatLevel] || 'Normal'}` }),
      jsx(Button, { size: 'xs', variant: 'outline', onClick: () => setNightMode(m => (m === 'auto' ? 'day' : m === 'day' ? 'night' : 'auto')), children: nightMode === 'auto' ? 'Waktu: Auto' : nightMode === 'day' ? 'Waktu: Siang' : 'Waktu: Malam' }),
    ] }),
    jsxs('div', { style: S.body, children: [
      jsxs('div', { style: { ...S.stage, border: 0, overflow: 'visible' }, children: [
        jsx('div', { ref: stageRef, style: { ...S.stage, position: 'absolute', inset: 0 }, 'aria-label': 'Ruang kantor 3D Shinobi HQ', children: stageChildren }),
        focused ? jsx('div', { style: { position: 'absolute', left: 10, top: 10, zIndex: 4 }, children: jsx(Button, { size: 'sm', onClick: () => officeRef.current?.exitFocus(), children: '← Kembali (Esc)' }) }) : null,
        jsx('div', { style: { position: 'absolute', right: 10, bottom: 8, zIndex: 3, fontSize: 10, color: 'var(--ui-text-tertiary)', pointerEvents: 'none' }, children: 'Seret untuk memutar 360° · scroll untuk zoom · klik laptop untuk lihat layar' }),
      ] }),
      panel === 'missions'
        ? jsx(MissionPanel, { missions, nameOf, overlay: narrow, onClose: () => setPanel(null) })
        : (!narrow || sel) ? jsx(Inspector, { agent: sel, rec: selRec, profile: sel ? profileByName[sel.profile] : null, missions: sel ? activeMissions(missions.tasks).filter(t => t.assignee === sel.profile) : [], location: sel ? officeRef.current?.locationOf(sel.id)?.name : null, following: !!sel && officeRef.current?.following === sel.id, screenOn: !!sel && focused === sel.id, onScreen: () => { const o = officeRef.current; if (!o || !sel) return; focused === sel.id ? o.exitFocus() : o.focusScreen(sel.id) }, onFollow: () => { const o = officeRef.current; if (!o || !sel) return; o.follow(o.following === sel.id ? null : sel.id); setTick(x => x + 1) }, overlay: narrow, onClose: () => { setSelected(null); officeRef.current?.select(null) } }) : null,
    ] }),
    jsx('div', { style: S.feed, 'aria-live': 'polite', children: feed.length
      ? feed.map((f, i) => jsxs('div', { children: [jsx('span', { style: { ...S.muted, marginRight: 8 }, children: new Date(f.at).toLocaleTimeString('id-ID', { hour12: false }) }), jsx('b', { children: nameOf(f.profile) }), ' ', f.text, f.n > 1 ? ` ×${f.n}` : ''] }, i))
      : jsx('span', { style: S.muted, children: 'Belum ada aktivitas sejak office dibuka. Feed hanya menampilkan jenis aktivitas & nama tool — tanpa isi pesan atau argumen.' }) }),
    jsx(DotProbe, { entries: dotEntries, onDots: d => live.model.setDots(d) }),
  ] })
}

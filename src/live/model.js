// Live status model — pure, no SDK / DOM. Turns REAL Hermes signals into one
// status per agent (profile). Principles (docs/02-plan.md §3):
//   * real signals only; unclear → 'unknown', silence after work → 'stale' (never a fake idle)
//   * never keep prompt text, tool arguments or outputs — tool NAME only
//   * priority: approval > error > working/thinking > done > stale > idle
// Signals:
//   ev   = host.onEvent('*') frames ({ type, session_id, payload, replayed, profile?, connectionId? })
//          OWNER of an event = the profile owning its runtime session. NOT ev.profile: on a pooled
//          backend the renderer stamps every frame with the socket's (launch) profile, so ev.profile
//          is trusted only on registry frames (connectionId present) — same rule as core
//          (store/session-states.ts recordSessionEventScope). Owners come from setOwner()
//          (session.active_list session_key ↔ profile sessions) and session.info.profile_name.
//          Events of a not-yet-resolved session are parked and replayed once the owner is known.
//   live = session.active_list rows (runtime id → 'working' | 'waiting' | 'idle'), via setLive()
//   busy = host.state.busyBySession (runtime session id → mid-turn)
//   dots = core SessionStatusDot state of each profile's stored sessions ('needs-input' | 'working' | …)
//   roster = profiles.list (last_session.last_active watermark, unix seconds)

export const TTL = {
  active: 45_000, // thinking/working without any new signal → stale
  stale: 5 * 60_000, // stale → idle
  done: 10_000, // done ✓ → idle
  error: 2 * 60_000, // error × → idle (lastError kept for the inspector)
  soft: 45_000, // working inferred from the session-history watermark only → idle
  recent: 120, // seconds: a last_active this fresh counts as activity
}

const ACTIVE = new Set(['thinking', 'working'])
const RELEVANT = new Set(['message.start', 'thinking.delta', 'reasoning.delta', 'reasoning.available', 'tool.generating', 'tool.start',
  'tool.complete', 'message.delta', 'message.interim', 'subagent.progress', 'subagent.tool', 'subagent.thinking', 'message.complete',
  'error', 'approval.cancelled', 'subagent.start', 'subagent.spawn_requested', 'subagent.complete'])

export function displayIdFor(profile) {
  return profile === 'default' ? 'hermes' : profile
}

export function createLiveModel({ now = () => Date.now() } = {}) {
  const agents = new Map() // profile → record
  const sessionOwner = new Map() // runtime session id → profile
  const parked = new Map() // runtime session id → last few events while the owner is unknown
  const genin = new Map() // subagent id → { id, parent, startedAt }
  const feed = [] // newest first, sanitized
  let geninSeq = 0
  let listeners = new Set()
  let version = 0

  function rec(profile) {
    let a = agents.get(profile)
    if (!a) {
      a = {
        profile, status: 'idle', since: now(), source: 'belum ada sinyal sejak office dibuka',
        lastSignalAt: 0, lastTool: null, lastError: null, attention: false, dotWorking: false,
        liveWaiting: false, liveWorking: false,
        busy: false, soft: false, watermark: 0, known: false, geninActive: 0,
      }
      agents.set(profile, a)
    }
    return a
  }

  function changed() { version++; for (const fn of listeners) fn(version) }

  function pushFeed(profile, kind, text) {
    const top = feed.find(f => f.profile === profile)
    if (top && top.text === text && now() - top.at < 15_000) { top.at = now(); top.n = (top.n || 1) + 1; return }
    feed.unshift({ at: now(), profile, kind, text })
    if (feed.length > 40) feed.length = 40
  }

  function set(a, status, source, { feedText, kind } = {}) {
    const t = now()
    a.lastSignalAt = t
    if (!ACTIVE.has(status)) a.wasHeld = false
    if (a.status !== status) {
      a.status = status; a.since = t
      if (feedText) pushFeed(a.profile, kind || status, feedText)
    }
    a.source = source
  }

  // --- event ingestion -----------------------------------------------------
  function ingest(ev) {
    if (!ev || typeof ev.type !== 'string' || ev.replayed) return false
    const type = ev.type
    const p = ev.payload || {}
    const sid = typeof ev.session_id === 'string' && ev.session_id ? ev.session_id : null
    if (type === 'session.info' && sid && typeof p.profile_name === 'string' && p.profile_name) {
      setOwner(sid, p.profile_name)
      return true
    }
    if (!RELEVANT.has(type)) return false
    let profile = sid ? sessionOwner.get(sid) : null
    // Registry stamp (connectionId + profile) is only a HINT when the frame has a session: on a remote /
    // pooled backend it names the socket's route, not necessarily the session owner. Session-less frames
    // have nothing better, so the hint is used directly there.
    const hint = ev.connectionId && typeof ev.profile === 'string' && ev.profile ? ev.profile : null
    if (!profile && !sid && hint) profile = hint
    if (!profile) {
      if (sid) {
        const q = parked.get(sid) || []
        if (!q.length) q.since = now()
        if (hint) q.hint = hint
        q.push(ev); if (q.length > 6) q.shift(); parked.set(sid, q)
        if (parked.size > 50) parked.delete(parked.keys().next().value)
      }
      return false
    }
    if (sid && !sessionOwner.has(sid)) sessionOwner.set(sid, profile)
    const a = rec(profile)
    a.soft = false
    switch (type) {
      case 'message.start':
        set(a, 'thinking', 'message.start', { feedText: 'mulai memproses pesan' }); break
      case 'thinking.delta': case 'reasoning.delta': case 'reasoning.available':
        if (a.status !== 'working' || now() - a.lastSignalAt > 3000) set(a, 'thinking', type)
        else a.lastSignalAt = now()
        break
      case 'tool.generating': case 'tool.start': {
        const name = typeof p.name === 'string' ? p.name.slice(0, 48) : null
        if (name) a.lastTool = name
        set(a, 'working', name ? `tool: ${name}` : type)
        if (type === 'tool.start' && name) pushFeed(profile, 'tool', `memakai tool ${name}`)
        break
      }
      case 'tool.complete':
      case 'message.delta': case 'message.interim': case 'subagent.progress': case 'subagent.tool': case 'subagent.thinking':
        set(a, 'working', type === 'message.delta' ? 'menulis jawaban' : type); break
      case 'message.complete': {
        const st = p.status
        if (st === 'error' || (p.error && st !== 'complete')) {
          a.lastError = { at: now(), text: 'giliran berakhir dengan error' }
          set(a, 'error', 'message.complete: error', { feedText: 'giliran berakhir dengan error', kind: 'error' })
        } else if (st === 'interrupted') {
          set(a, 'idle', 'dihentikan (interrupted)', { feedText: 'giliran dihentikan', kind: 'idle' })
        } else {
          a.wasHeld = false
          set(a, 'done', 'message.complete', { feedText: 'selesai menjawab', kind: 'done' })
        }
        break
      }
      case 'error':
        a.lastError = { at: now(), text: 'error dari gateway' }
        set(a, 'error', 'event error', { feedText: 'mengalami error', kind: 'error' }); break
      case 'approval.cancelled':
        a.attention = false; break
      case 'subagent.start': case 'subagent.spawn_requested': {
        const id = String(p.subagent_id || p.child_session_id || `g${++geninSeq}`)
        if (!genin.has(id)) {
          genin.set(id, { id, parent: profile, startedAt: now(), done: false })
          a.geninActive++
          pushFeed(profile, 'genin', 'memanggil genin (subagent)')
        }
        set(a, 'working', 'mendelegasikan ke subagent')
        break
      }
      case 'subagent.complete': {
        const id = String(p.subagent_id || p.child_session_id || '')
        const g = genin.get(id)
        if (g && !g.done) { g.done = true; g.doneAt = now(); a.geninActive = Math.max(0, a.geninActive - 1); pushFeed(profile, 'genin', 'genin selesai') }
        break
      }
      default:
        return false
    }
    changed()
    return true
  }

  // --- secondary signals ----------------------------------------------------
  function setOwner(sid, profile) {
    if (!sid || !profile || sessionOwner.get(sid) === profile) return
    sessionOwner.set(sid, profile)
    rec(profile)
    const q = parked.get(sid)
    if (q) { parked.delete(sid); for (const ev of q) ingest(ev) }
    if (lastBusy) setBusy(lastBusy)
  }
  const unresolved = () => [...parked.keys()]
  /** After an ownership refresh: sessions still unresolved for ≥ minAgeMs fall back to their registry hint. */
  function applyHints(minAgeMs = 6000) {
    for (const [sid, q] of [...parked]) if (q.hint && now() - (q.since || 0) >= minAgeMs) setOwner(sid, q.hint)
  }

  // rows: [{ sid, profile|null, status: 'working'|'waiting'|'starting'|'idle' }] from session.active_list
  function setLive(rows) {
    const working = new Set(), waiting = new Set()
    for (const r of rows || []) {
      if (r.profile && r.sid) setOwner(r.sid, r.profile)
      const prof = r.profile || (r.sid && sessionOwner.get(r.sid))
      if (!prof) continue
      if (r.status === 'working' || r.status === 'starting') working.add(prof)
      if (r.status === 'waiting') waiting.add(prof)
    }
    let dirty = false
    for (const a of agents.values()) {
      const wk = working.has(a.profile), wt = waiting.has(a.profile)
      if (wt && !a.liveWaiting) pushFeed(a.profile, 'approval', 'menunggu jawaban/approval kamu')
      if (wk !== a.liveWorking || wt !== a.liveWaiting) { a.liveWorking = wk; a.liveWaiting = wt; dirty = true }
    }
    if (dirty) { tick(); changed() }
  }

  let lastBusy = null
  function setBusy(map) {
    lastBusy = map
    const busyProfiles = new Set()
    for (const [sid, on] of Object.entries(map || {})) if (on && sessionOwner.has(sid)) busyProfiles.add(sessionOwner.get(sid))
    let dirty = false
    for (const a of agents.values()) {
      const b = busyProfiles.has(a.profile)
      if (a.busy !== b) { a.busy = b; dirty = true }
    }
    if (dirty) changed()
  }

  // dots: profile → 'needs-input' | 'working' | 'stalled' | … (from core's SessionStatusDot)
  function setDots(byProfile) {
    let dirty = false
    for (const [profile, state] of Object.entries(byProfile || {})) {
      const a = rec(profile)
      const att = state === 'needs-input'
      const wk = state === 'working'
      if (att !== a.attention) {
        a.attention = att; dirty = true
        if (att) pushFeed(profile, 'approval', 'menunggu jawaban/approval kamu')
      }
      if (wk !== a.dotWorking) { a.dotWorking = wk; dirty = true }
    }
    if (dirty) changed()
  }

  function setRoster(profiles, { ok = true } = {}) {
    if (!ok) { for (const a of agents.values()) a.known = false; changed(); return }
    const t = now()
    const seen = new Set()
    for (const pr of profiles || []) {
      if (!pr || typeof pr.name !== 'string') continue
      seen.add(pr.name)
      const a = rec(pr.name)
      a.known = true
      // newest of: last conversation, the Bot Mode canonical "Bot Chat" (hidden from last_session!), worker/kanban runs
      const la = Math.max(Number(pr.last_session?.last_active || 0), Number(pr.canonical_session?.last_active || 0), Number(pr.worker_session?.last_active || 0))
      // watermark advanced recently and nothing live explains it → soft working
      if (a.watermark && la > a.watermark && t / 1000 - la < TTL.recent && !ACTIVE.has(a.status) && a.status !== 'error' && t - a.lastSignalAt > 20_000) {
        a.soft = true
        set(a, 'working', 'aktivitas sesi terbaru (polling riwayat)', { feedText: 'aktif (terdeteksi dari riwayat sesi)', kind: 'working' })
      }
      a.watermark = Math.max(a.watermark, la)
    }
    for (const a of agents.values()) if (!seen.has(a.profile)) a.known = false
    changed()
  }

  // --- time ---------------------------------------------------------------
  function tick() {
    const t = now()
    let dirty = false
    for (const a of agents.values()) {
      const age = t - a.lastSignalAt
      const held = a.busy || a.dotWorking || a.liveWorking
      if (ACTIVE.has(a.status)) {
        if (held) { a.wasHeld = true; continue }
        if (a.wasHeld) { // the session itself says it stopped running → finished, not "silent"
          a.wasHeld = false; a.status = 'done'; a.since = t; a.lastSignalAt = t; a.source = 'sesi tidak lagi berjalan'; dirty = true
          continue
        }
        if (a.soft && age > TTL.soft) { a.soft = false; a.status = 'idle'; a.since = t; a.source = 'tidak ada aktivitas baru'; dirty = true }
        else if (!a.soft && age > TTL.active) { a.status = 'stale'; a.since = t; a.source = `tidak ada sinyal ${Math.round(age / 1000)} dtk`; dirty = true }
      } else if (a.status === 'stale' && (held ? false : age > TTL.stale)) {
        a.status = 'idle'; a.since = t; a.source = 'sunyi > 5 menit'; dirty = true
      } else if (a.status === 'done' && age > TTL.done) {
        a.status = 'idle'; a.since = t; a.source = 'selesai'; dirty = true
      } else if (a.status === 'error' && age > TTL.error) {
        a.status = 'idle'; a.since = t; a.source = 'error terakhir sudah lewat 2 menit'; dirty = true
      }
      if (held && (a.status === 'idle' || a.status === 'stale' || a.status === 'done')) {
        a.status = 'working'; a.since = t; a.source = a.liveWorking ? 'sesi sedang berjalan (session.active_list)' : a.busy ? 'sesi sedang berjalan (busy)' : 'sesi berjalan (status sesi)'; a.lastSignalAt = t; dirty = true
      }
    }
    for (const [id, g] of genin) if (g.done && t - g.doneAt > 15_000) { genin.delete(id); dirty = true }
    if (dirty) changed()
    return dirty
  }

  // effective status = stored status + overrides (approval wins)
  function statusOf(profile) {
    const a = agents.get(profile)
    if (!a) return 'unknown'
    if (a.attention || a.liveWaiting) return 'approval'
    if (!a.known && a.status === 'idle') return 'unknown'
    return a.status
  }

  function snapshot() {
    return [...agents.values()].map(a => ({
      profile: a.profile, id: displayIdFor(a.profile), status: statusOf(a.profile), rawStatus: a.status,
      since: a.since, source: a.attention || a.liveWaiting ? 'sesi menunggu input kamu (approval/klarifikasi)' : a.source,
      lastTool: a.lastTool, lastError: a.lastError, geninActive: a.geninActive, busy: a.busy, known: a.known,
    }))
  }

  return {
    ingest, setBusy, setDots, setRoster, setOwner, setLive, unresolved, applyHints, tick, statusOf, snapshot,
    ownerOf: sid => sessionOwner.get(sid) || null,
    get(profile) { return agents.get(profile) },
    genin: () => [...genin.values()],
    feed: () => feed.slice(),
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    get version() { return version },
    _sessionOwner: sessionOwner,
  }
}

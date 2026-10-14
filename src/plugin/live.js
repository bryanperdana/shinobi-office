// SDK glue: real Hermes signals → live model. Read-only: only profiles.list
// (polled) + gateway events + busy atom. No steer / interrupt / approve.
import { host } from '@hermes/plugin-sdk'
import { createLiveModel } from '../live/model.js'
import { parseKanbanOutput } from '../live/missions.js'

export const VERSION = '0.8.1'

export function createLive(ctx) {
  const safe = fn => { try { return fn() } catch { return null } }
  const model = createLiveModel()
  const offs = []
  const ui = new Set()
  let uiVersion = 0, uiTimer = 0
  let roster = { ok: null, profiles: [], error: null, at: 0 }
  let pageMounted = false
  const counts = {}

  // UI notifications throttled to ≤4/s — message.delta can fire dozens of times a second
  const bump = () => { if (uiTimer) return; uiTimer = setTimeout(() => { uiTimer = 0; uiVersion++; for (const fn of ui) fn() }, 250) }
  offs.push(model.subscribe(bump))

  const onEv = ev => {
    if (ev && typeof ev.type === 'string') counts[ev.type] = (counts[ev.type] || 0) + 1
    const used = model.ingest(ev)
    if (!used && ev?.session_id && model.unresolved().includes(ev.session_id)) onUnresolved()
  }
  offs.push(typeof ctx.onEvent === 'function' ? ctx.onEvent('*', onEv) : host.onEvent('*', onEv))

  const busyAtom = safe(() => host.state.busyBySession)
  if (busyAtom?.subscribe) offs.push(busyAtom.subscribe(v => model.setBusy(v)))

  // ---- session ownership: runtime session (event session_id) → profile -----------------
  // session.active_list gives runtime id + stored session_key + status; the stored key is matched
  // to a profile via profiles.list (last/canonical session) or, lazily, session.list per profile.
  const keyOwner = new Map() // stored session key → profile
  let lastKeyScan = 0
  function ownerForKey(key) {
    if (!key) return null
    if (keyOwner.has(key)) return keyOwner.get(key)
    for (const p of roster.profiles) {
      const ids = [p.last_session?.id, p.canonical_session?.id, p.canonical_session?.resolved_id]
      if (ids.includes(key)) { keyOwner.set(key, p.name); return p.name }
    }
    return null
  }
  async function scanKeys(keys) {
    if (!keys.length || Date.now() - lastKeyScan < 60_000 || !roster.profiles.length) return
    lastKeyScan = Date.now()
    const want = new Set(keys)
    for (const p of roster.profiles) {
      if (!want.size) break
      try {
        const r = await host.request('session.list', { profile: p.name, limit: 50, include_hidden: true })
        for (const row of r?.sessions || []) {
          const id = row?.id || row?.session_id
          if (typeof id === 'string' && want.has(id)) { keyOwner.set(id, p.name); want.delete(id) }
        }
      } catch {}
    }
  }
  let activeInflight = false, activeStatus = { ok: null, n: 0, unmatched: 0, error: null }
  async function refreshActive() {
    if (activeInflight) return
    activeInflight = true
    try {
      const r = await host.request('session.active_list', {})
      const rows = Array.isArray(r?.sessions) ? r.sessions : []
      // keep only id / session_key / status — never the preview text
      const slim = rows.map(x => ({ sid: String(x?.id || ''), key: String(x?.session_key || ''), status: String(x?.status || '') })).filter(x => x.sid)
      const unmatched = slim.filter(x => !ownerForKey(x.key)).map(x => x.key).filter(Boolean)
      if (unmatched.length) await scanKeys(unmatched)
      model.setLive(slim.map(x => ({ sid: x.sid, profile: ownerForKey(x.key), status: x.status })))
      model.applyHints(6000)
      activeStatus = { ok: true, n: slim.length, unmatched: slim.filter(x => !ownerForKey(x.key)).length, error: null }
    } catch (e) {
      model.applyHints(6000) // active_list unavailable (older/remote gateway) → fall back to registry hints
      activeStatus = { ok: false, n: 0, unmatched: 0, error: String(e?.message || e).slice(0, 120) }
    } finally { activeInflight = false }
  }
  let unresolvedTimer = 0, lastUnresolvedRun = 0
  const onUnresolved = () => {
    if (unresolvedTimer) return
    const wait = Math.max(800, 5_000 - (Date.now() - lastUnresolvedRun)) // ≤ 1 extra active_list per 5 s
    unresolvedTimer = setTimeout(() => { unresolvedTimer = 0; lastUnresolvedRun = Date.now(); refreshActive() }, wait)
  }

  // ---- kanban (Mission Board): fixed read-only argv via cli.exec, bodies dropped in parse ----
  let missions = { ok: null, tasks: [], error: null, at: 0 }
  let kInflight = false
  async function refreshMissions() {
    if (kInflight) return
    kInflight = true
    try {
      const r = await host.request('cli.exec', { argv: ['kanban', 'list', '--json'], timeout: 30 })
      if (r?.blocked) throw new Error('cli.exec diblokir')
      missions = { ok: true, tasks: parseKanbanOutput(r?.output), error: null, at: Date.now() }
    } catch (e) {
      missions = { ...missions, ok: false, error: String(e?.message || e).slice(0, 120), at: Date.now() }
    } finally { kInflight = false; bump() }
  }

  let inflight = false
  async function refreshRoster() {
    if (inflight) return
    inflight = true
    try {
      const r = await host.request('profiles.list', {})
      const list = Array.isArray(r?.profiles) ? r.profiles.filter(p => p && typeof p.name === 'string') : null
      if (!list) throw new Error('profiles.list: unexpected shape')
      roster = { ok: true, profiles: list, error: null, at: Date.now() }
      model.setRoster(list)
    } catch (e) {
      roster = { ...roster, ok: false, error: String(e?.message || e).slice(0, 120), at: Date.now() }
      model.setRoster(null, { ok: false })
    } finally { inflight = false; bump() }
  }

  let pollTimer = 0, activeTimer = 0
  const schedulePoll = () => {
    clearTimeout(pollTimer)
    pollTimer = setTimeout(async () => { await refreshRoster(); schedulePoll() }, pageMounted ? 10_000 : 30_000)
  }
  const scheduleActive = () => {
    clearTimeout(activeTimer)
    activeTimer = setTimeout(async () => { await refreshActive(); scheduleActive() }, pageMounted ? 4_000 : 15_000)
  }
  let missionTimer = 0
  const scheduleMissions = () => {
    clearTimeout(missionTimer)
    missionTimer = setTimeout(async () => { await refreshMissions(); scheduleMissions() }, missions.ok === false ? 15_000 : pageMounted ? 30_000 : 120_000) // quick retry after a transient failure (e.g. remote reconnect)
  }
  refreshRoster().then(() => { schedulePoll(); return refreshActive() }).then(scheduleActive)
  refreshMissions().then(scheduleMissions)

  const tickTimer = setInterval(() => model.tick(), 2000)

  // compact, sanitized self-report (statuses/types/counts only) so the build can be verified
  // without screen capture: ctx.storage key hermes.plugin.shinobi-office.debug
  const debugTimer = setInterval(() => {
    try {
      const snap = {
        v: VERSION, at: Date.now(), page: pageMounted,
        roster: { ok: roster.ok, n: roster.profiles.length, error: roster.error },
        active: activeStatus, unresolved: model.unresolved().length,
        missions: { ok: missions.ok, n: missions.tasks.length, active: missions.tasks.filter(t => !['done', 'archived'].includes(t.status)).length, error: missions.error },
        agents: model.snapshot().map(a => ({ p: a.profile, s: a.status, src: a.source, tool: a.lastTool, g: a.geninActive, busy: a.busy })),
        genin: model.genin().length,
        feed: model.feed().slice(0, 6).map(f => ({ p: f.profile, k: f.kind, t: f.text })),
        events: counts,
      }
      ctx.storage?.set?.('debug', 'SO_JSON' + JSON.stringify(snap) + 'SO_END')
    } catch {}
  }, 15_000)

  return {
    model,
    get roster() { return roster },
    // plugin-local settings (ctx.storage; get may be sync or async depending on the host)
    async getSetting(key, fallback) { try { const v = await ctx.storage?.get?.('setting.' + key); return v ?? fallback } catch { return fallback } },
    setSetting(key, value) { try { return Promise.resolve(ctx.storage?.set?.('setting.' + key, value)).catch(() => {}) } catch {} },
    get missions() { return missions },
    refreshMissions,
    get uiVersion() { return uiVersion },
    subscribeUi(fn) { ui.add(fn); return () => ui.delete(fn) },
    refreshRoster,
    setPageMounted(on) { pageMounted = on; if (on) { refreshRoster(); refreshActive(); refreshMissions() } schedulePoll(); scheduleActive(); scheduleMissions() },
    dispose() {
      offs.forEach(off => safe(off)); clearTimeout(pollTimer); clearTimeout(activeTimer); clearTimeout(missionTimer); clearTimeout(unresolvedTimer); clearTimeout(uiTimer)
      clearInterval(tickTimer); clearInterval(debugTimer); ui.clear()
    },
  }
}

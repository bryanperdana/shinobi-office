// Activity brain for Shinobi HQ — pure logic, no three.js, deterministic with a seed.
//
// Golden rule: REAL status always wins. Only agents whose real status is `idle`
// may roam (tea, scrolls, mission board, training, sparring). Any other status
// recalls the agent to its desk; urgent statuses (thinking/working/approval/error,
// offline/unknown) use a ninja "shunshin" body-flicker so the desk reflects the
// real state within ~0.3 s instead of waiting for a walk.

import { DESK_SLOTS, EXTRA_DESK_SLOTS, deskGeom, POIS, RING, DOOR, WANDER_AREAS, NAV, NAV_AREAS, NAV_PORTALS, STAIR, isFloor2, worldObstacles, roomAt, TARGET, CHAT_SPOTS, SEATED_SPOT } from './world.js'
import { exitLine } from './talk.js'

export const ALL_DESK_SLOTS = [...DESK_SLOTS, ...EXTRA_DESK_SLOTS]
import { createNavGrid } from './grid.js'

export const STATUSES = ['idle', 'sleep', 'thinking', 'working', 'approval', 'error', 'done', 'stale', 'offline', 'unknown']
export const URGENT = new Set(['thinking', 'working', 'approval', 'error', 'offline', 'unknown'])
export const canRoam = s => s === 'idle'

export const STATUS_LABEL = {
  idle: 'Idle', sleep: 'Tidur', thinking: 'Berpikir', working: 'Mengetik', approval: 'Menunggu approval',
  error: 'Error', done: 'Selesai', stale: 'Stale', offline: 'Offline', unknown: 'Unknown',
}
export const ACTIVITY_LABEL = {
  tea: 'minum teh', ramen: 'makan ramen', read: 'baca gulungan', browse: 'cari gulungan', shelf: 'cek rak', board: 'lihat papan misi',
  window: 'lihat desa', train: 'latihan', throw: 'latihan shuriken', meditate: 'meditasi', koi: 'lihat ikan koi', sakura: 'lihat sakura',
  nap: 'tidur siang', wander: 'jalan-jalan', spar: 'sparring', chat: 'ngobrol', rest: 'istirahat', walk: 'jalan',
}
const DESK_POSE = {
  idle: 'sit', sleep: 'sleep', thinking: 'think', working: 'type', approval: 'raise',
  error: 'dizzy', done: 'thumbs', stale: 'sit', offline: 'offline', unknown: 'offline',
}
const POI_POSE = {
  balcony: 'look', torii: 'look', paddy: 'sitfloor', river: 'look',
  tea: 'sitfloor', ramen: 'sitfloor', read: 'read', browse: 'read', shelf: 'read', board: 'point', window: 'look', sakura: 'look',
  train: 'punch', throw: 'throw', meditate: 'meditate', koi: 'crouch', nap: 'nap', wander: 'stand', rest: 'stand',
}
/** Base appetite per idle activity; multiplied by the agent's `likes` (affinity) from its look preset. */
const BASE_WEIGHT = { balcony: 0.9, torii: 0.5, paddy: 0.5, river: 0.45, tea: 2, ramen: 1.2, board: 0.9, window: 0.7, shelf: 0.6, train: 1.1, throw: 1, meditate: 0.9, browse: 1, read: 1.1, koi: 1.3, sakura: 0.8, nap: 0 }

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const lerp = (a, b, t) => a + (b - a) * t
const ease = t => t * t * (3 - 2 * t)
function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
  return a + d * t
}
const faceTo = (dx, dz) => Math.atan2(dx, dz)

const WALK = 2.4, RUN = 4.4, GENIN_SPEED = 2.9
// fighters line up across the default camera's view direction → readable side profiles
const SPAR_THETA = -0.6

export function createBrain({ agents, seed = 1, calm = false, chatScript = null, chatLevel = 1, owner = 'Boss' }) {
  // chatScript(aId, bId, rnd) → [{ who, text }] (talk.js); chatLevel 0 off · 0.5 jarang · 1 normal · 2 ramai
  // calm = prefers-reduced-motion: no autonomous roaming/sparring, agents stay at their desks
  const rnd = mulberry32(seed)
  const desks = agents.map((_, i) => deskGeom(ALL_DESK_SLOTS[i % ALL_DESK_SLOTS.length]))
  const grid = createNavGrid({ ...NAV, areas: NAV_AREAS, portals: NAV_PORTALS, obstacles: worldObstacles(desks) })
  const reserved = new Map() // poiKey -> agentId
  const fx = []
  const spars = []
  const genin = []
  let time = 0
  let sparSeq = 0, geninSeq = 0

  const A = agents.map((def, i) => ({
    id: def.id, index: i, desk: desks[i], status: def.status || 'unknown', likes: def.likes || {}, cat: def.species === 'cat',
    x: desks[i].seat.x, z: desks[i].seat.z, y: 0, face: 0,
    act: { type: 'desk' }, pose: DESK_POSE[def.status || 'unknown'], poseT: 0,
    cooldown: 1.5 + rnd() * 4, sparCd: 0, chatCd: 8 + rnd() * 25, line: null, lineT: 0, bubble: null, bubbleT: 0, activity: null, visible: true,
  }))
  const byId = id => A.find(a => a.id === id)

  let fxSeq = 0
  function emit(type, x, y, z, extra = {}) { fx.push({ id: ++fxSeq, type, x, y, z, t: time, ...extra }) }
  function setPose(a, p) { if (a.pose !== p) { a.pose = p; a.poseT = 0 } }
  function say(a, glyph, secs = 1.6) { a.bubble = glyph; a.bubbleT = secs }

  function release(a) {
    for (const [k, v] of reserved) if (v === a.id) reserved.delete(k)
  }

  function leaveStair(a) { // a new plan mid-climb: finish on the nearer landing
    if (!a.stair) return
    const P = NAV_PORTALS[0], top = a.stair.up ? a.stair.u >= 0.5 : a.stair.u < 0.5
    a.x = top ? P.bx : P.ax; a.z = top ? P.bz : P.az; a.stair = null
  }
  function walkTo(a, x, z, then, run = false) {
    leaveStair(a)
    const path = grid.findPath(a.x, a.z, x, z)
    if (!path) { // unreachable → flicker there
      a.act = { type: 'shunshin', timer: 0.3, moved: false, tx: x, tz: z, then }
      emit('puff', a.x, 1, a.z)
      return
    }
    a.act = { type: 'walk', path, i: 1, run, then }
  }

  function shunshinTo(a, x, z, then) {
    emit('puff', a.x, 1, a.z)
    a.act = { type: 'shunshin', timer: 0.28, moved: false, tx: x, tz: z, then }
    a.activity = null
  }

  function goDesk(a, urgent) {
    const s = a.desk.seat
    const then = { type: 'desk' }
    if (urgent) shunshinTo(a, s.x, s.z, then)
    else { a.activity = 'walk'; walkTo(a, s.x, s.z, then) }
  }

  function headingToDesk(a) {
    return a.act.type === 'desk' || ((a.act.type === 'walk' || a.act.type === 'shunshin') && a.act.then?.type === 'desk')
  }

  function begin(a, then) {
    if (then.type === 'desk') {
      a.act = { type: 'desk' }; a.face = 0; a.activity = null
      a.cooldown = 3 + rnd() * 6
    } else if (then.type === 'poi') {
      a.act = { ...then }
      if (then.face != null) a.face = then.face
      a.activity = then.kind
    } else if (then.type === 'spar') {
      a.act = { ...then }
      a.activity = 'spar'
    } else if (then.type === 'chat') {
      a.act = { ...then }
      if (then.face != null) a.face = then.face
      a.activity = 'chat'
      const c = chats.find(c => c.id === then.cid)
      if (c) c.arrived++
      else { a.act = { type: 'poi', kind: 'rest', timer: 1, face: a.face }; a.activity = 'rest' }
    }
  }

  // ---------------------------------------------------------------- spar
  function sparPartners(a) {
    if (spars.length) return [] // one ring
    return A.filter(b => b !== a && canRoam(b.status) && b.sparCd <= 0 &&
      (b.act.type === 'desk' || (b.act.type === 'poi' && b.act.kind !== 'tea')))
  }

  function startSpar(a, b) {
    release(a); release(b)
    const s = { id: ++sparSeq, a: a.id, b: b.id, phase: 'approach', t: 0, theta: SPAR_THETA, dist: 3.0, beats: null, bi: 0, bt: 0 }
    spars.push(s)
    const ux = Math.cos(SPAR_THETA), uz = Math.sin(SPAR_THETA)
    const spot = side => ({ x: RING.x + side * 1.5 * ux, z: RING.z + side * 1.5 * uz, face: side < 0 ? faceTo(ux, uz) : faceTo(-ux, -uz) })
    for (const [f, side] of [[a, -1], [b, 1]]) {
      const p = spot(side)
      say(f, '!', 1.0)
      f.activity = 'spar'
      walkTo(f, p.x, p.z, { type: 'spar', sid: s.id, side, face: p.face }, true)
    }
    return s
  }

  function genBeats(dur) {
    const beats = []
    let total = 0
    const kinds = ['circle', 'attack', 'attack', 'clash', 'jump', 'throw', 'kick']
    let last = ''
    while (total < dur) {
      let k = kinds[Math.floor(rnd() * kinds.length)]
      if (k === last) k = 'circle'
      const by = rnd() < 0.5 ? 'a' : 'b'
      const d = { circle: 1.5, attack: 1.0, clash: 1.0, jump: 1.3, throw: 1.2, kick: 1.0 }[k]
      beats.push({ k, by, d, dir: rnd() < 0.5 ? -1 : 1, fired: false })
      total += d; last = k
    }
    return beats
  }

  function endSpar(s, interrupterId) {
    const i = spars.indexOf(s)
    if (i >= 0) spars.splice(i, 1)
    for (const id of [s.a, s.b]) {
      const f = byId(id)
      if (!f) continue
      f.y = 0
      if (id === interrupterId) continue
      f.sparCd = interrupterId ? 20 : 45
      if (f.act.type === 'spar' || (f.act.type === 'walk' && f.act.then?.type === 'spar')) {
        f.act = { type: 'poi', kind: 'rest', timer: interrupterId ? 2.2 : 1.6, face: f.face }
        f.activity = 'rest'
        if (interrupterId) say(f, '?', 1.8)
        else say(f, '★', 1.6)
      }
    }
  }

  function updateSpar(s, dt) {
    const fa = byId(s.a), fb = byId(s.b)
    if (!fa || !fb) return endSpar(s)
    if (s.phase === 'approach') {
      s.t += dt
      if (fa.act.type === 'spar' && fb.act.type === 'spar') { s.phase = 'bow'; s.t = 0; s.dist = 3.2 }
      else if (s.t > 14) endSpar(s) // could not meet
      return
    }
    s.t += dt
    const C = RING
    let jumpY = 0
    let poseA = 'guard', poseB = 'guard'
    if (s.phase === 'bow') {
      poseA = poseB = 'bow'
      if (s.t > 1.4) { s.phase = 'fight'; s.t = 0; s.beats = genBeats(13 + rnd() * 7); s.bi = 0; s.bt = 0 }
    } else if (s.phase === 'fight') {
      const beat = s.beats[s.bi]
      s.bt += dt
      const p = Math.min(1, s.bt / beat.d)
      const atk = beat.by === 'a' ? 'A' : 'B'
      const setAtk = (pa, pd) => { if (atk === 'A') { poseA = pa; poseB = pd } else { poseA = pd; poseB = pa } }
      const base = 2.7
      if (beat.k === 'circle') {
        s.theta += dt * 0.9 * beat.dir
        // keep the fight axis roughly side-on to the camera (mod π: side swaps are fine)
        const dev = ((s.theta - SPAR_THETA) % Math.PI + Math.PI * 1.5) % Math.PI - Math.PI / 2
        if (Math.abs(dev) > 0.45) { beat.dir = -Math.sign(dev); s.theta -= dev - Math.sign(dev) * 0.45 }
        s.dist = lerp(s.dist, base, 0.1)
        poseA = poseB = 'guard'
      } else if (beat.k === 'attack' || beat.k === 'kick') {
        s.dist = base - Math.sin(Math.PI * Math.min(1, p * 1.25)) * 0.95
        setAtk(beat.k === 'kick' ? 'kick' : 'punch', 'block')
        if (!beat.fired && p > 0.42) {
          beat.fired = true
          emit('spark', C.x, 1.3, C.z, { size: 1 })
        }
      } else if (beat.k === 'clash') {
        s.dist = base - Math.sin(Math.PI * p) * 1.05
        poseA = poseB = 'punch'
        if (!beat.fired && p > 0.48) { beat.fired = true; emit('spark', C.x, 1.4, C.z, { size: 1.7 }) }
      } else if (beat.k === 'jump') {
        jumpY = Math.sin(Math.PI * p) * 1.9
        s.theta += (Math.PI / beat.d) * dt
        poseA = poseB = 'jump'
      } else if (beat.k === 'throw') {
        setAtk('throw', p > 0.35 && p < 0.75 ? 'dodge' : 'guard')
        if (!beat.fired && p > 0.3) {
          beat.fired = true
          const from = atk === 'A' ? fa : fb, to = atk === 'A' ? fb : fa
          emit('shuriken', from.x, 1.35, from.z, { tx: to.x, tz: to.z, dur: 0.45 })
        }
      }
      if (s.bt >= beat.d) { s.bi++; s.bt = 0; if (s.bi >= s.beats.length) { s.phase = 'bow2'; s.t = 0 } }
    } else if (s.phase === 'bow2') {
      s.dist = lerp(s.dist, 3.2, 0.08)
      poseA = poseB = 'bow'
      if (s.t > 1.5) return endSpar(s)
    }
    const ux = Math.cos(s.theta), uz = Math.sin(s.theta)
    const half = s.dist / 2
    fa.x = C.x - ux * half; fa.z = C.z - uz * half
    fb.x = C.x + ux * half; fb.z = C.z + uz * half
    fa.face = faceTo(ux, uz); fb.face = faceTo(-ux, -uz)
    const dodge = p => (p === 'dodge' ? 0.45 : 0)
    fa.y = Math.max(jumpY, dodge(poseA)); fb.y = Math.max(jumpY, dodge(poseB))
    setPose(fa, poseA); setPose(fb, poseB)
    s.posA = { x: fa.x, z: fa.z }; s.posB = { x: fb.x, z: fb.z }
  }

  // ---------------------------------------------------------------- conversations
  const chats = []
  let chatSeq = 0
  const LINE_SECS = 3.6
  function chatPartners(a) {
    return A.filter(b => b !== a && canRoam(b.status) && b.chatCd <= 0 &&
      (b.act.type === 'desk' || (b.act.type === 'poi' && b.act.kind !== 'nap')))
  }
  function freeChatSpot() {
    const free = CHAT_SPOTS.filter(sp => sp.keys.every(k => !reserved.has(k)))
    return free.length ? free[Math.floor(rnd() * free.length)] : null
  }
  function startChat(a, b) {
    const sp = freeChatSpot()
    if (!sp) return false
    release(a); release(b)
    const c = { id: ++chatSeq, a: a.id, b: b.id, keys: sp.keys, seated: SEATED_SPOT(sp.keys[0]), arrived: 0, t: 0, lines: null, li: 0, lt: 0 }
    chats.push(c)
    sp.keys.forEach((k, i) => reserved.set(k, i ? b.id : a.id))
    for (const [f, i] of [[a, 0], [b, 1]]) {
      f.activity = 'chat'
      walkTo(f, sp.pts[i].x, sp.pts[i].z, { type: 'chat', cid: c.id, face: sp.pts[i].face })
    }
    return true
  }
  function endChat(c, leaverId) {
    const i = chats.indexOf(c)
    if (i >= 0) chats.splice(i, 1)
    for (const k of c.keys) reserved.delete(k)
    for (const id of [c.a, c.b]) {
      const f = byId(id)
      if (!f) continue
      f.chatCd = 45 + rnd() * 60
      if (id === leaverId) { f.line = exitLine(rnd, owner); f.lineT = 1.8; continue }
      const inChat = f.act.type === 'chat' || (f.act.type === 'walk' && f.act.then?.type === 'chat')
      if (inChat) { f.act = { type: 'poi', kind: 'rest', timer: leaverId ? 1.8 : 0.6, face: f.face }; f.activity = 'rest' }
    }
  }
  function updateChat(c, dt) {
    c.t += dt
    const fa = byId(c.a), fb = byId(c.b)
    if (!fa || !fb) return endChat(c)
    if (c.arrived < 2) { if (c.t > 45) endChat(c); return }
    if (!c.lines) {
      c.lines = (chatScript ? chatScript(c.a, c.b, rnd) : []).slice(0, 6)
      // face each other
      fa.face = Math.atan2(fb.x - fa.x, fb.z - fa.z); fb.face = Math.atan2(fa.x - fb.x, fa.z - fb.z)
    }
    const cur = c.lines[c.li]
    if (!cur) return endChat(c)
    const speaker = byId(cur.who) || fa
    if (c.lt === 0) { speaker.line = cur.text; speaker.lineT = LINE_SECS - 0.2 }
    for (const f of [fa, fb]) setPose(f, c.seated ? 'sitfloor' : f === speaker ? 'talk' : 'stand')
    c.lt += dt
    if (c.lt >= LINE_SECS) { c.li++; c.lt = 0 }
  }
  function setChatLevel(v) { chatLevel = Math.max(0, Number(v) || 0) }

  // ---------------------------------------------------------------- activities
  function freePoi(kind) {
    const list = POIS[kind] || []
    const free = list.map((p, i) => ({ p, key: `${kind}:${i}` })).filter(o => !reserved.has(o.key))
    return free.length ? free[Math.floor(rnd() * free.length)] : null
  }

  function wanderPoint() {
    const total = WANDER_AREAS.reduce((t, w) => t + w.w, 0)
    for (let k = 0; k < 40; k++) {
      let r = rnd() * total, A0 = WANDER_AREAS[0]
      for (const w of WANDER_AREAS) { if ((r -= w.w) <= 0) { A0 = w; break } }
      const x = lerp(A0.x0, A0.x1, rnd())
      const z = lerp(A0.z0, A0.z1, rnd())
      if (Math.hypot(x - RING.x, z - RING.z) < RING.r + 0.6) continue
      if (grid.isFree(x, z)) return { x, z }
    }
    return null
  }

  function chooseActivity(a) {
    if (calm) return false
    const opts = []
    const partners = sparPartners(a)
    if (partners.length && a.sparCd <= 0) opts.push(['spar', 3])
    const like = k => (a.likes[k] ?? 1)
    const talkers = chatScript && chatLevel > 0 && a.chatCd <= 0 ? chatPartners(a) : []
    if (talkers.length && freeChatSpot()) opts.push(['chat', 2.4 * chatLevel * like('chat')])
    if (opts.length) opts[0][1] *= like('spar')
    for (const k of Object.keys(POIS)) {
      const base = k === 'nap' ? (a.cat ? 2.5 : 0) : BASE_WEIGHT[k] ?? 1
      const w = base * like(k)
      if (w > 0 && freePoi(k)) opts.push([k, w])
    }
    opts.push(['wander', 1.6 * like('wander')], ['stay', 1])
    const total = opts.reduce((s, o) => s + o[1], 0)
    let r = rnd() * total, pick = 'stay'
    for (const [k, w] of opts) { if ((r -= w) <= 0) { pick = k; break } }
    return startActivity(a, pick, partners)
  }

  function startActivity(a, kind, partners) {
    if (kind === 'spar') {
      const ps = partners || sparPartners(a)
      if (!ps.length) return false
      startSpar(a, ps[Math.floor(rnd() * ps.length)])
      return true
    }
    if (kind === 'chat') {
      const ps = chatPartners(a)
      if (!ps.length) return false
      return startChat(a, ps[Math.floor(rnd() * ps.length)])
    }
    if (kind === 'stay') { a.cooldown = 4 + rnd() * 8; return true }
    if (kind === 'wander') {
      const p = wanderPoint()
      if (!p) return false
      a.activity = 'wander'
      walkTo(a, p.x, p.z, { type: 'poi', kind: 'wander', timer: 1.5 + rnd() * 3 })
      return true
    }
    const o = freePoi(kind)
    if (!o) return false
    reserved.set(o.key, a.id)
    a.activity = kind
    walkTo(a, o.p.x, o.p.z, { type: 'poi', kind, timer: (kind === 'nap' ? 20 : 9) + rnd() * 14, face: o.p.face })
    return true
  }

  function afterPoi(a) {
    release(a)
    if (rnd() < 0.55) { if (chooseActivity(a)) return }
    goDesk(a, false)
  }

  // ---------------------------------------------------------------- movement
  /** Advance e along path from e.i by `budget` metres. A waypoint flagged `stair` is a portal: the entity
   *  climbs (or descends) the stair over STAIR.len metres (e.stair = { up, u }); renderer maps it to 3D. */
  function moveAlong(e, path, budget, dt) {
    while (budget > 0 && e.i < path.length) {
      const t = path[e.i]
      if (t.stair) {
        if (!e.stair) e.stair = { up: isFloor2(t.z), u: 0 }
        e.stair.u += budget / STAIR.len; budget = 0
        e.face = lerpAngle(e.face, e.stair.up ? Math.PI : 0, Math.min(1, dt * 12))
        if (e.stair.u >= 1) { e.stair = null; e.x = t.x; e.z = t.z; e.i++ }
        continue
      }
      const dx = t.x - e.x, dz = t.z - e.z
      const d = Math.hypot(dx, dz)
      if (d > 1e-4) e.face = lerpAngle(e.face, faceTo(dx, dz), Math.min(1, dt * 12))
      if (d <= budget) { e.x = t.x; e.z = t.z; budget -= d; e.i++ }
      else { e.x += (dx / d) * budget; e.z += (dz / d) * budget; budget = 0 }
    }
  }
  function followPath(a, dt) {
    const act = a.act
    const speed = act.run ? RUN : WALK
    a.i = act.i; moveAlong(a, act.path, speed * dt, dt); act.i = a.i
    setPose(a, act.run ? 'run' : 'walk')
    if (act.i >= act.path.length) {
      const then = act.then
      if (then.face != null) a.face = then.face
      begin(a, then)
    }
  }

  // ---------------------------------------------------------------- genin
  function spawnGenin(parentId, label = 'genin') {
    const p = byId(parentId)
    if (!p) return null
    const n = genin.filter(g => g.parent === parentId && g.state !== 'poof').length
    const side = p.desk.side
    const tx = side.x + (n % 2) * 0.75, tz = side.z + Math.floor(n / 2) * 0.8 + (n % 2) * 0.35
    const g = { id: `g${++geninSeq}`, parent: parentId, label, x: DOOR.x + 0.9, z: DOOR.z, y: 0, face: Math.PI / 2, state: 'walk', t: 0, pose: 'walk', poseT: 0 }
    g.path = grid.findPath(g.x, g.z, tx, tz) || [{ x: g.x, z: g.z }, { x: tx, z: tz }]
    g.i = 1
    emit('puff', DOOR.x + 0.9, 1, DOOR.z, { small: true })
    genin.push(g)
    return g.id
  }
  function completeGenin(id) {
    const g = genin.find(x => x.id === id)
    if (g && g.state !== 'poof') { g.state = 'poof'; g.t = 0; emit('puff', g.x, 0.8, g.z, { small: true }) }
  }
  function updateGenin(g, dt) {
    g.t += dt; g.poseT += dt
    if (g.state === 'walk') {
      moveAlong(g, g.path, GENIN_SPEED * dt, dt)
      if (g.i >= g.path.length) { g.state = 'help'; g.pose = 'help'; g.poseT = 0; g.face = -Math.PI / 2 }
    }
  }

  // ---------------------------------------------------------------- tick
  function step(dt) {
    time += dt
    for (const a of A) {
      a.poseT += dt
      a.sparCd = Math.max(0, a.sparCd - dt)
      a.chatCd = Math.max(0, a.chatCd - dt)
      if (a.lineT > 0) { a.lineT -= dt; if (a.lineT <= 0) a.line = null }
      if (a.bubbleT > 0) { a.bubbleT -= dt; if (a.bubbleT <= 0) a.bubble = null }
      // real work wins: an urgent status also upgrades a slow walk-back (e.g. down from floor 2) to shunshin
      if (!canRoam(a.status) && (!headingToDesk(a) || (URGENT.has(a.status) && a.act.type === 'walk'))) {
        const s = spars.find(s => s.a === a.id || s.b === a.id)
        if (s) endSpar(s, a.id)
        const c = chats.find(c => c.a === a.id || c.b === a.id)
        if (c) endChat(c, a.id)
        release(a)
        a.y = 0
        goDesk(a, URGENT.has(a.status))
      }
    }
    for (const s of [...spars]) updateSpar(s, dt)
    for (const c of [...chats]) updateChat(c, dt)
    for (const a of A) {
      const act = a.act
      if (act.type === 'desk') {
        setPose(a, DESK_POSE[a.status] || 'sit')
        a.x = a.desk.seat.x; a.z = a.desk.seat.z; a.face = 0; a.stair = null
        if (canRoam(a.status)) { a.cooldown -= dt; if (a.cooldown <= 0) { if (!chooseActivity(a)) a.cooldown = 3 } }
      } else if (act.type === 'walk') {
        followPath(a, dt)
      } else if (act.type === 'shunshin') {
        act.timer -= dt
        if (!act.moved && act.timer <= 0.14) {
          act.moved = true; a.x = act.tx; a.z = act.tz; a.y = 0; a.stair = null
          emit('puff', a.x, 1, a.z)
        }
        a.visible = act.moved ? act.timer < 0.1 : act.timer > 0.2
        setPose(a, 'stand')
        if (act.timer <= 0) { a.visible = true; begin(a, act.then) }
      } else if (act.type === 'chat') {
        if (!chats.find(c => c.id === act.cid)) { a.act = { type: 'poi', kind: 'rest', timer: 0.5, face: a.face }; a.activity = 'rest' }
      } else if (act.type === 'poi') {
        act.timer -= dt
        setPose(a, POI_POSE[act.kind] || 'stand')
        if (act.kind === 'throw' && a.poseT > 1.6) { // loop the throw + a shuriken into the target board
          a.poseT = 0
          emit('shuriken', a.x, 1.35, a.z, { tx: TARGET.x + (rnd() - 0.5) * 1.2, tz: TARGET.z + 0.2, dur: 0.45 })
        }
        if (act.timer <= 0) afterPoi(a)
      }
    }
    for (const g of genin) updateGenin(g, dt)
    for (let i = genin.length - 1; i >= 0; i--) if (genin[i].state === 'poof' && genin[i].t > 0.5) genin.splice(i, 1)
    while (fx.length && time - fx[0].t > 3) fx.shift()
  }

  function setStatus(id, status) {
    const a = byId(id)
    if (a && STATUSES.includes(status) && a.status !== status) { a.status = status; if (canRoam(status)) a.cooldown = Math.min(a.cooldown, 2 + rnd() * 2) }
  }

  /** Force an idle activity (demo / QA). */
  function force(id, kind, partnerId) {
    const a = byId(id)
    if (!a || !canRoam(a.status)) return false
    if (kind === 'spar') {
      const b = byId(partnerId)
      if (!b || !canRoam(b.status) || spars.length) return false
      const sa = spars.find(s => s.a === a.id || s.b === a.id)
      if (sa) return false
      release(a); release(b)
      startSpar(a, b)
      return true
    }
    if (kind === 'chat') {
      const b = byId(partnerId)
      if (!b || !canRoam(b.status) || chats.some(c => [c.a, c.b].includes(a.id) || [c.a, c.b].includes(b.id))) return false
      return startChat(a, b)
    }
    release(a)
    return startActivity(a, kind)
  }

  function locationOf(a) { return a.stair ? { id: 'stair', name: 'Tangga' } : roomAt(a.x, a.z) }

  function labelFor(a) {
    const st = STATUS_LABEL[a.status] || a.status
    if (a.act.type === 'desk' || headingToDesk(a)) return st
    return `${st} · ${ACTIVITY_LABEL[a.activity] || 'jalan'}`
  }

  return {
    agents: A, desks, genin, spars, chats, fx, grid, setChatLevel, get chatLevel() { return chatLevel },
    get time() { return time },
    step, setStatus, force, spawnGenin, completeGenin, labelFor, locationOf, byId,
  }
}

// Room, furniture, desks + laptops for Shinobi HQ. Original procedural art.
import * as THREE from 'three'
import { laptopScreen, toon, toonUnique, basic, mesh, shojiTexture, plasterTexture, tatamiTexture, woodTexture, windowTexture, kanjiScroll, missionScroll, signTexture, codeScreen, glowSprite } from './toon.js'
import { ROOM, DOOR, TEA_TABLE, SHELF } from './layout.js'

const B = (w, h, d) => new THREE.BoxGeometry(w, h, d)
const C = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s)
const S = (r, ws = 16, hs = 12) => new THREE.SphereGeometry(r, ws, hs)
const tex = (t, rx = 1, ry = 1) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t }
const texMat = (t, opts = {}) => { const m = new THREE.MeshToonMaterial({ map: t, ...opts }); m.userData.outlineParameters = { visible: false }; return m }

export const STATUS_COLOR = {
  idle: '#94A3B8', sleep: '#94A3B8', thinking: '#3B82F6', working: '#14B8A6', approval: '#F59E0B',
  error: '#EF4444', done: '#22C55E', stale: '#A78BFA', offline: '#4B5563', unknown: '#6B7280',
}

export function buildRoom(scene) {
  const root = new THREE.Group(); scene.add(root)
  const W = ROOM.maxX - ROOM.minX, D = ROOM.maxZ - ROOM.minZ, H = ROOM.wallH
  const lanterns = []
  const nightOnly = []

  // floor: wooden border + tatami field
  const floor = mesh(new THREE.PlaneGeometry(W, D), texMat(tex(woodTexture('#C7884B'), 6, 4)), { rx: -Math.PI / 2, shadow: false })
  root.add(floor)
  const tat = tatamiTexture()
  for (let ix = 0; ix < 12; ix++) for (let iz = 0; iz < 2; iz++) {
    root.add(mesh(new THREE.PlaneGeometry(1.98, 3.98), texMat(tat), { rx: -Math.PI / 2, x: -11 + ix * 2, y: 0.01, z: 2.3 + iz * 4, shadow: false }))
  }
  // back + left wall (plaster + wood frame), low front skirting
  const plaster = texMat(tex(plasterTexture(), 4, 1))
  const back = mesh(new THREE.PlaneGeometry(W, H), plaster, { y: H / 2, z: ROOM.minZ, shadow: false }); root.add(back)
  const left = mesh(new THREE.PlaneGeometry(D, H), plaster.clone(), { x: ROOM.minX, y: H / 2, ry: Math.PI / 2, shadow: false }); root.add(left)
  const beam = toon('#8A5530')
  root.add(mesh(B(W, 0.35, 0.35), beam, { y: H - 0.18, z: ROOM.minZ + 0.18 }))
  root.add(mesh(B(W, 0.3, 0.3), beam, { y: 0.15, z: ROOM.minZ + 0.15 }))
  root.add(mesh(B(0.35, 0.35, D), beam, { y: H - 0.18, x: ROOM.minX + 0.18 }))
  root.add(mesh(B(0.3, 0.3, D), beam, { y: 0.15, x: ROOM.minX + 0.15 }))
  for (let x = ROOM.minX + 0.2; x <= ROOM.maxX; x += 7) root.add(mesh(B(0.4, H, 0.4), beam, { x, y: H / 2, z: ROOM.minZ + 0.2 }))
  for (const z of [-2.8 - 2, 0.2, 6.2]) root.add(mesh(B(0.4, H, 0.4), beam, { x: ROOM.minX + 0.2, y: H / 2, z }))
  // shoji panels on back wall (right part)
  const shoji = texMat(shojiTexture())
  for (const x of [3.8, 5.6]) root.add(mesh(B(1.8, 3.6, 0.08), shoji, { x, y: 2.0, z: ROOM.minZ + 0.06 }))

  // round window on back wall with village view
  const winDay = windowTexture(false), winNight = windowTexture(true)
  const winMat = basic('#ffffff', { map: winDay })
  const win = mesh(new THREE.CircleGeometry(1.45, 40), winMat, { x: -10.5, y: 3.4, z: ROOM.minZ + 0.05, shadow: false }); root.add(win)
  root.add(mesh(new THREE.TorusGeometry(1.5, 0.16, 10, 44), toon('#6B3F22'), { x: -10.5, y: 3.4, z: ROOM.minZ + 0.1 }))
  // kanji scroll
  root.add(mesh(new THREE.PlaneGeometry(1.0, 2.6), basic('#ffffff', { map: kanjiScroll('忍道') }), { x: 9.2 - 1.6, y: 3.2, z: ROOM.minZ + 0.06, shadow: false }))
  root.add(mesh(C(0.07, 0.07, 1.2, 10), beam, { x: 7.6, y: 4.55, z: ROOM.minZ + 0.1, rz: Math.PI / 2 }))
  // sign above
  root.add(mesh(new THREE.PlaneGeometry(4.2, 0.9), basic('#ffffff', { map: signTexture('SHINOBI HQ') }), { x: 0, y: 5.05, z: ROOM.minZ + 0.06, shadow: false }))

  // mission board (back wall, left of Kage)
  const board = new THREE.Group(); board.position.set(-3.5, 6.2, ROOM.minZ + 0.12); root.add(board) // floor 2 (FLOOR2.y)
  board.add(mesh(B(3.4, 2.2, 0.12), toon('#9C6136'), { y: 2.9 }))
  board.add(mesh(B(3.6, 0.18, 0.2), beam, { y: 4.05 }))
  board.add(mesh(new THREE.PlaneGeometry(2.6, 0.4), basic('#fff', { map: signTexture('MISI', '#6B3F22') }), { y: 4.35, z: 0.02, shadow: false }))
  // scrolls are DATA: setMissions() from real kanban tasks (empty board when there are none)
  const scrolls = new THREE.Group(); board.add(scrolls)
  const scrollGeo = new THREE.PlaneGeometry(0.68, 0.86)
  let missionKey = ''
  function setMissions(items = []) {
    const shown = items.slice(0, 4)
    const key = shown.map(m => m.rank + m.color + m.title).join('|') + '#' + items.length
    if (key === missionKey) return
    missionKey = key
    for (const m of [...scrolls.children]) { scrolls.remove(m); m.material.map?.dispose(); m.material.dispose() }
    shown.forEach((m, i) => scrolls.add(mesh(scrollGeo, basic('#fff', { map: missionScroll(m.rank, m.color, m.title) }), { x: -1.2 + i * 0.8, y: 2.85, z: 0.08, rz: (i % 2 ? 1 : -1) * 0.04, shadow: false })))
    if (items.length > 4) scrolls.add(mesh(new THREE.PlaneGeometry(0.9, 0.3), basic('#fff', { map: signTexture(`+${items.length - 4}`, '#6B3F22') }), { x: 1.15, y: 2.05, z: 0.09, shadow: false }))
    if (!items.length) scrolls.add(mesh(new THREE.PlaneGeometry(1.8, 0.45), basic('#fff', { map: signTexture('KOSONG', '#9C6136', '#FFF8EA') }), { y: 2.9, z: 0.08, shadow: false }))
  }

  // gong (approval)
  const gong = new THREE.Group(); gong.position.set(11, 6.2, ROOM.minZ + 0.55); root.add(gong) // floor 2
  gong.add(mesh(B(0.18, 3.2, 0.18), beam, { x: -1.3, y: 1.6 })); gong.add(mesh(B(0.18, 3.2, 0.18), beam, { x: 1.3, y: 1.6 }))
  gong.add(mesh(B(2.9, 0.2, 0.22), beam, { y: 3.2 }))
  const disc = new THREE.Group(); disc.position.y = 3.1; gong.add(disc)
  disc.add(mesh(C(0.95, 0.95, 0.12, 36), toon('#D9A53A'), { rx: Math.PI / 2, y: -1.15 }))
  disc.add(mesh(C(0.35, 0.35, 0.14, 24), toon('#B7852A'), { rx: Math.PI / 2, y: -1.15, z: 0.02 }))
  disc.add(mesh(C(0.02, 0.02, 0.2, 6), toon('#2B1B12'), { y: -0.1 }))

  // scroll shelf (skills) on left wall
  const shelf = new THREE.Group(); shelf.position.set(ROOM.minX + 0.45, 0, SHELF.z); root.add(shelf)
  shelf.add(mesh(B(0.8, 3.2, 3.0), toon('#7A4526'), { y: 1.6 }))
  for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) {
    const col = ['#E2557A', '#3B82F6', '#22C55E', '#F59E0B', '#A78BFA', '#FFF8EA'][(i + r) % 6]
    shelf.add(mesh(C(0.11, 0.11, 0.7, 10), toon(col), { x: 0.35, y: 0.45 + r * 0.75, z: -1.2 + i * 0.48, rz: Math.PI / 2, ry: Math.PI / 2 }))
  }
  // Academy door on left wall
  const door = new THREE.Group(); door.position.set(ROOM.minX + 0.07, 0, DOOR.z); root.add(door)
  door.add(mesh(B(0.14, 3.4, 2.6), beam, { y: 1.7 }))
  door.add(mesh(B(0.16, 3.0, 1.1), shoji, { y: 1.6, z: -0.6 }))
  door.add(mesh(B(0.16, 3.0, 1.1), shoji, { y: 1.6, z: 0.65 }))
  door.add(mesh(new THREE.PlaneGeometry(2.2, 0.5), basic('#fff', { map: signTexture('ACADEMY', '#D6334C') }), { x: 0.12, y: 3.75, ry: Math.PI / 2, shadow: false }))

  // lanterns
  const glow = glowSprite('#FFB547')
  for (const [x, y, z] of [[-7, 4.6, ROOM.minZ + 0.5], [4.8, 4.6, ROOM.minZ + 0.5], [ROOM.minX + 0.5, 4.4, 4.8], [ROOM.minX + 0.5, 4.4, -6]]) {
    const L = new THREE.Group(); L.position.set(x, y, z); root.add(L)
    const body = toonUnique('#E8452E', { emissive: '#000000' })
    L.add(mesh(C(0.32, 0.32, 0.65, 18), body, { sx: 1, sy: 1 }))
    L.add(mesh(C(0.2, 0.2, 0.08, 14), toon('#2B1B12'), { y: 0.36 })); L.add(mesh(C(0.2, 0.2, 0.08, 14), toon('#2B1B12'), { y: -0.36 }))
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, opacity: 0, depthWrite: false })); sp.scale.setScalar(2.6); L.add(sp)
    lanterns.push({ body, sp }); nightOnly.push(sp)
  }

  // tea corner
  const tea = new THREE.Group(); tea.position.set(TEA_TABLE.x, 0, TEA_TABLE.z); root.add(tea)
  tea.add(mesh(B(1.4, 0.12, 1.2), toon('#7A4526'), { y: 0.42 }))
  for (const [x, z] of [[-0.6, -0.5], [0.6, -0.5], [-0.6, 0.5], [0.6, 0.5]]) tea.add(mesh(B(0.1, 0.38, 0.1), beam, { x, y: 0.19, z }))
  tea.add(mesh(S(0.18), toon('#4E7F5A'), { y: 0.62, sy: 0.85 }))
  tea.add(mesh(C(0.03, 0.03, 0.2, 6), toon('#4E7F5A'), { y: 0.62, x: 0.2, rz: -1.0 }))
  for (const x of [-1.45, 1.45]) tea.add(mesh(B(0.8, 0.12, 0.8), toon('#5B6FB0'), { x, y: 0.06 }))

  // bonsai
  for (const [x, z] of [[12.8, -8.0], [-12.8, 7.9]]) {
    const b = new THREE.Group(); b.position.set(x, 0, z); root.add(b)
    b.add(mesh(C(0.45, 0.35, 0.45, 14), toon('#5B6FB0'), { y: 0.22 }))
    b.add(mesh(C(0.06, 0.1, 0.8, 8), toon('#6B3F22'), { y: 0.8, rz: 0.2 }))
    for (const [ox, oy, s] of [[0, 1.3, 0.5], [-0.35, 1.1, 0.35], [0.35, 1.2, 0.38]]) b.add(mesh(S(s), toon('#4E9A5A'), { x: ox, y: oy, sy: 0.65 }))
  }

  function setNight(on) {
    winMat.map = on ? winNight : winDay; winMat.needsUpdate = true
    for (const l of lanterns) { l.body.emissive.set(on ? '#FF7A3A' : '#000000'); l.sp.material.opacity = on ? 0.85 : 0 }
  }

  return { root, setNight, gongDisc: disc, missionBoard: board, gong, setMissions, scrolls }
}

// ---------------------------------------------------------------- desks
export function buildDesk(desk, def, scene) {
  const g = new THREE.Group(); g.position.set(desk.x, 0, desk.z); scene.add(g)
  const beam = toon('#8A5530')
  const top = toon(desk.big ? '#A8662F' : '#C98B4F')
  const H = 0.66
  g.add(mesh(B(desk.w, 0.12, desk.d), top, { y: H }))
  g.add(mesh(B(desk.w - 0.1, 0.5, 0.06), beam, { y: H - 0.3, z: desk.d / 2 - 0.05 })) // front modesty panel
  for (const sx of [-1, 1]) g.add(mesh(B(0.1, H, desk.d - 0.1), beam, { x: sx * (desk.w / 2 - 0.08), y: H / 2 }))
  // nameplate on the desk front
  const plate = mesh(new THREE.PlaneGeometry(1.6, 0.36), basic('#fff', { map: signTexture(def.name, '#FFF8EA', '#2B1B12') }), { y: H - 0.24, z: desk.d / 2 + 0.01, shadow: false })
  g.add(plate)
  // cushion behind
  g.add(mesh(B(0.95, 0.14, 0.9), toon(def.cushion || '#5B6FB0'), { y: 0.07, z: -1.0 }))
  // laptop (screen faces −z, toward the seated agent; we see its back + glowing emblem)
  const lap = new THREE.Group(); lap.position.set(0, H + 0.06, -0.12); g.add(lap)
  lap.add(mesh(B(0.85, 0.04, 0.55), toon('#3A4152'), {}))
  const lid = new THREE.Group(); lid.position.set(0, 0.02, 0.26); lid.rotation.x = 0.25; lap.add(lid)
  lid.add(mesh(B(0.85, 0.55, 0.04), toon('#3A4152'), { y: 0.27 }))
  const emblemMat = basic(STATUS_COLOR.unknown)
  lid.add(mesh(new THREE.CircleGeometry(0.1, 20), emblemMat, { y: 0.3, z: 0.025, shadow: false }))
  const screen = laptopScreen()
  const screenMat = basic('#ffffff', { map: screen.tex })
  const scr = mesh(new THREE.PlaneGeometry(0.76, 0.46), screenMat, { y: 0.28, z: -0.025, ry: Math.PI, shadow: false }); lid.add(scr)
  lap.traverse(o => { o.userData.screenOf = def.id })
  lap.userData.screenOf = def.id
  // screen glow on the agent's face (light pool)
  const glowMat = new THREE.SpriteMaterial({ map: glowSprite('#ffffff'), color: STATUS_COLOR.unknown, transparent: true, opacity: 0.0, depthWrite: false })
  const glowSp = new THREE.Sprite(glowMat); glowSp.scale.set(1.6, 1.2, 1); glowSp.position.set(0, H + 0.55, -0.45); g.add(glowSp)

  // role props
  const P = def.props || []
  if (P.includes('dual')) { g.add(mesh(B(0.7, 0.45, 0.05), toon('#3A4152'), { x: -0.95, y: H + 0.45, z: 0.25, ry: 0.35 })); g.add(mesh(B(0.06, 0.22, 0.06), toon('#3A4152'), { x: -0.95, y: H + 0.17, z: 0.25 })) }
  if (P.includes('abacus')) { g.add(mesh(B(0.6, 0.06, 0.32), toon('#7A4526'), { x: -0.85, y: H + 0.1, z: 0.2 })); for (let i = 0; i < 5; i++) g.add(mesh(S(0.05, 8, 6), toon('#D6334C'), { x: -1.05 + i * 0.1, y: H + 0.16, z: 0.2 })) ; for (let i = 0; i < 3; i++) g.add(mesh(C(0.11, 0.11, 0.04, 16), toon('#F2C94C'), { x: 0.85, y: H + 0.08 + i * 0.045, z: 0.25 })) }
  if (P.includes('bird')) { const bd = new THREE.Group(); bd.position.set(0.95, H + 0.2, 0.2); bd.add(mesh(S(0.16), toon('#F4F1EA'), { sx: 1.3 })); bd.add(mesh(S(0.1), toon('#F4F1EA'), { x: 0.16, y: 0.12 })); bd.add(mesh(new THREE.ConeGeometry(0.04, 0.1, 8), toon('#F59E0B'), { x: 0.28, y: 0.12, rz: -Math.PI / 2 })); g.add(bd) }
  if (P.includes('megaphone')) g.add(mesh(new THREE.ConeGeometry(0.2, 0.55, 18, 1, true), toon('#FB923C'), { x: 0.95, y: H + 0.25, z: 0.2, rz: Math.PI / 2 }))
  if (P.includes('palette')) { g.add(mesh(C(0.28, 0.28, 0.04, 20), toon('#F4E3C1'), { x: -0.9, y: H + 0.08, z: 0.2 })); ['#E11D48', '#3B82F6', '#22C55E', '#F59E0B'].forEach((c, i) => g.add(mesh(S(0.05, 8, 6), toon(c), { x: -1.0 + i * 0.08, y: H + 0.12, z: 0.12 + (i % 2) * 0.1 }))); g.add(mesh(B(0.3, 0.2, 0.18), toon('#2B3550'), { x: 0.95, y: H + 0.16, z: 0.2 })); g.add(mesh(C(0.07, 0.07, 0.1, 14), toon('#111827'), { x: 0.95, y: H + 0.16, z: 0.32, rx: Math.PI / 2 })) }
  if (P.includes('clapper')) { // video editor: clapperboard + film reel
    g.add(mesh(B(0.5, 0.34, 0.05), toon('#1F2937'), { x: -0.95, y: H + 0.2, z: 0.2, ry: 0.3 }))
    g.add(mesh(B(0.52, 0.08, 0.06), toon('#F4F1EA'), { x: -0.95, y: H + 0.42, z: 0.2, ry: 0.3, rz: 0.18 }))
    g.add(mesh(C(0.2, 0.2, 0.06, 20), toon('#374151'), { x: 0.95, y: H + 0.06, z: 0.22 }))
    g.add(mesh(C(0.06, 0.06, 0.07, 12), toon('#9CA3AF'), { x: 0.95, y: H + 0.07, z: 0.22 }))
  }
  if (P.includes('kage')) { for (let i = 0; i < 4; i++) g.add(mesh(B(0.5, 0.06, 0.35), toon('#FFF8EA'), { x: -1.3, y: H + 0.09 + i * 0.065, z: 0.15, ry: i * 0.12 })); g.add(mesh(C(0.1, 0.1, 0.22, 12), toon('#D6334C'), { x: 1.3, y: H + 0.17, z: 0.2 })) }

  let lastStatus = null
  function setStatus(status, t) {
    const c = STATUS_COLOR[status] || STATUS_COLOR.unknown
    if (status !== lastStatus) {
      emblemMat.color.set(c)
      glowMat.color.set(c)
      screenMat.color.set(status === 'offline' ? '#2a2f3a' : '#ffffff')
      lid.rotation.x = status === 'offline' || status === 'unknown' ? 1.45 : 0.25
      lastStatus = status
    }
    const live = !['offline', 'unknown', 'sleep', 'idle'].includes(status)
    const pulse = status === 'approval' || status === 'error' ? 0.5 + 0.5 * Math.sin(t * 6) : status === 'thinking' ? 0.6 + 0.4 * Math.sin(t * 3) : 1
    glowMat.opacity = live ? 0.55 * pulse : 0
  }
  /** info: { name, status, label, color, tool, since, missions, genin, clock } — safe fields only */
  const setScreen = info => screen.draw(info)
  /** world-space point at the screen centre + its facing normal (−z of the desk) */
  function screenAnchor() {
    const v = new THREE.Vector3(), n = new THREE.Vector3(0, 0, 1)
    scr.updateWorldMatrix(true, false); scr.getWorldPosition(v)
    n.transformDirection(scr.matrixWorld) // plane front = local +z
    return { p: v, n }
  }
  return { group: g, setStatus, setScreen, screenAnchor, laptop: lap, H }
}

// Shinobi Village: the rooms around HQ (Dojo, Library, Garden, Teahouse) + walkways and rails.
// Original procedural art; reads world.js anchors so brain obstacles and visuals stay in sync.
import * as THREE from 'three'
import { toon, toonUnique, basic, mesh, woodTexture, tatamiTexture, plasterTexture, kanjiScroll, signTexture, glowSprite } from './toon.js'
import { buildRoom } from './room.js'
import {
  ROOMS, WORLD, GATE, railSegments, RING, DUMMIES, TARGET, MATS, SHELVES, STACKS, READ_TABLES, POND, SAKURA, ROCKS,
  STONE_LANTERN, TEA_TABLES, COUNTER, KOTATSU,
} from './world.js'

const B = (w, h, d) => new THREE.BoxGeometry(w, h, d)
const C = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s)
const S = (r, ws = 16, hs = 12) => new THREE.SphereGeometry(r, ws, hs)
const tex = (t, rx = 1, ry = 1) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t }
const flat = (t, opts = {}) => { const m = new THREE.MeshToonMaterial({ map: t, ...opts }); m.userData.outlineParameters = { visible: false }; return m }
const plain = color => { const m = toonUnique(color); m.userData.outlineParameters = { visible: false }; return m }
const floorAt = (root, r, mat, y = 0.005) => root.add(mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), mat, { rx: -Math.PI / 2, x: (r.x0 + r.x1) / 2, y, z: (r.z0 + r.z1) / 2, shadow: false }))

export function buildWorld(scene) {
  const hq = buildRoom(scene)
  const root = new THREE.Group(); scene.add(root)
  const beam = toon('#8A5530')
  const lanterns = []
  const glow = glowSprite('#FFB547')
  const anim = []

  function lantern(x, y, z, color = '#E8452E') {
    const L = new THREE.Group(); L.position.set(x, y, z); root.add(L)
    const body = toonUnique(color, { emissive: '#000000' })
    L.add(mesh(C(0.3, 0.3, 0.6, 16), body))
    L.add(mesh(C(0.19, 0.19, 0.08, 12), toon('#2B1B12'), { y: 0.34 })); L.add(mesh(C(0.19, 0.19, 0.08, 12), toon('#2B1B12'), { y: -0.34 }))
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, opacity: 0, depthWrite: false })); sp.scale.setScalar(2.4); L.add(sp)
    lanterns.push({ body, sp })
  }
  function roomSign(r, text, bg = '#6B3F22') { // sign on two posts at the room's back rail, facing the camera
    const x = r.x0 + 3.2, z = r.z0 + 0.25
    root.add(mesh(B(0.14, 2.6, 0.14), beam, { x: x - 1.5, y: 1.3, z })); root.add(mesh(B(0.14, 2.6, 0.14), beam, { x: x + 1.5, y: 1.3, z }))
    root.add(mesh(new THREE.PlaneGeometry(3.1, 0.62), basic('#fff', { map: signTexture(text, bg) }), { x, y: 2.35, z: z + 0.09, shadow: false }))
  }

  // ---- ground, walkways (engawa), rails
  root.add(mesh(new THREE.PlaneGeometry(WORLD.maxX - WORLD.minX + 120, WORLD.maxZ - WORLD.minZ + 120), plain('#6E8F55'), { rx: -Math.PI / 2, x: (WORLD.minX + WORLD.maxX) / 2, y: -0.02, z: (WORLD.minZ + WORLD.maxZ) / 2, shadow: false }))
  const plank = flat(tex(woodTexture('#B9814A'), 2, 8))
  for (const r of [{ x0: 14, x1: 16, z0: -9, z1: 9 }, { x0: -14, x1: 32, z0: 9, z1: 11 }, { x0: 0, x1: 2, z0: 11, z1: 25 }, { x0: 16, x1: 18, z0: 11, z1: 25 }]) floorAt(root, r, plank)
  const railMat = toon('#7A4526'), capMat = toon('#9C6136')
  const railAt = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, ry = Math.atan2(x1 - x0, z1 - z0)
    root.add(mesh(B(0.12, 0.08, len), capMat, { x: cx, y: 0.86, z: cz, ry }))
    root.add(mesh(B(0.08, 0.06, len), railMat, { x: cx, y: 0.45, z: cz, ry }))
    const n = Math.max(1, Math.round(len / 2))
    for (let i = 0; i <= n; i++) { const k = i / n; root.add(mesh(B(0.14, 0.9, 0.14), railMat, { x: x0 + (x1 - x0) * k, y: 0.45, z: z0 + (z1 - z0) * k })) }
  }
  for (const s of railSegments()) s.axis === 'x' ? railAt(s.x, s.a, s.x, s.b) : railAt(s.a, s.z, s.b, s.z)
  // outer fence on the camera-facing edges (right + front) keeps the compound readable
  railAt(32, -9, 32, 25); railAt(-14, 25, GATE.x - GATE.w / 2, 25); railAt(GATE.x + GATE.w / 2, 25, 32, 25)
  // gate to the countryside path (V3)
  for (const sx of [-1, 1]) root.add(mesh(B(0.26, 2.4, 0.26), railMat, { x: GATE.x + sx * (GATE.w / 2 + 0.1), y: 1.2, z: 25 }))
  root.add(mesh(B(GATE.w + 0.9, 0.22, 0.4), capMat, { x: GATE.x, y: 2.45, z: 25 }))

  // ---- DOJO (x 16..32, z -9..9): wooden floor, tall back wall, arena, dummies, target, mats, rack
  const dj = ROOMS.dojo
  floorAt(root, dj, flat(tex(woodTexture('#D9A066'), 4, 4)))
  const plaster = flat(tex(plasterTexture(), 3, 1))
  root.add(mesh(new THREE.PlaneGeometry(dj.x1 - dj.x0, 6), plaster, { x: (dj.x0 + dj.x1) / 2, y: 3, z: dj.z0, shadow: false }))
  root.add(mesh(B(dj.x1 - dj.x0, 0.35, 0.35), beam, { x: (dj.x0 + dj.x1) / 2, y: 5.82, z: dj.z0 + 0.18 }))
  for (let x = dj.x0 + 0.2; x <= dj.x1; x += 5.2) root.add(mesh(B(0.4, 6, 0.4), beam, { x, y: 3, z: dj.z0 + 0.2 }))
  root.add(mesh(new THREE.PlaneGeometry(3.6, 0.8), basic('#fff', { map: signTexture('DOJO') }), { x: 24, y: 5.0, z: dj.z0 + 0.06, shadow: false }))
  root.add(mesh(new THREE.PlaneGeometry(1.0, 2.6), basic('#fff', { map: kanjiScroll('道') }), { x: 18.6, y: 3.2, z: dj.z0 + 0.06, shadow: false }))
  root.add(mesh(new THREE.PlaneGeometry(1.0, 2.6), basic('#fff', { map: kanjiScroll('心') }), { x: 29.4, y: 3.2, z: dj.z0 + 0.06, shadow: false }))
  // target board
  const tg = new THREE.Group(); tg.position.set(TARGET.x, 1.6, dj.z0 + 0.3); root.add(tg)
  ;[[0.95, '#F4F1EA'], [0.72, '#D6334C'], [0.5, '#F4F1EA'], [0.28, '#D6334C']].forEach(([r, c], i) => tg.add(mesh(C(r, r, 0.08, 32), toon(c), { rx: Math.PI / 2, z: i * 0.02 })))
  // arena (moved from HQ)
  const ring = new THREE.Group(); ring.position.set(RING.x, 0, RING.z); root.add(ring)
  ring.add(mesh(C(RING.r, RING.r, 0.08, 48), toon('#E9D9A6'), { y: 0.04 }))
  ring.add(mesh(new THREE.TorusGeometry(RING.r - 0.1, 0.07, 8, 60), toon('#D6334C'), { rx: Math.PI / 2, y: 0.09 }))
  ring.add(mesh(new THREE.TorusGeometry(0.55, 0.035, 8, 40), toon('#D6334C'), { rx: Math.PI / 2, y: 0.09 }))
  for (const a of [0.785, 2.356, 3.927, 5.498]) {
    const x = Math.cos(a) * (RING.r + 0.35), z = Math.sin(a) * (RING.r + 0.35)
    ring.add(mesh(C(0.1, 0.12, 1.3, 10), beam, { x, y: 0.65, z })); ring.add(mesh(S(0.14), toon('#D6334C'), { x, y: 1.35, z }))
  }
  for (const d of DUMMIES) {
    const g = new THREE.Group(); g.position.set(d.x, 0, d.z); root.add(g)
    g.add(mesh(C(0.3, 0.38, 0.3, 14), toon('#7A4526'), { y: 0.15 })); g.add(mesh(C(0.2, 0.22, 1.5, 14), toon('#C98B4F'), { y: 1.0 }))
    g.add(mesh(B(1.1, 0.14, 0.14), toon('#C98B4F'), { y: 1.35 })); g.add(mesh(S(0.26), toon('#E9D9A6'), { y: 1.95 }))
    g.add(mesh(new THREE.TorusGeometry(0.22, 0.05, 6, 20), toon('#D6334C'), { y: 1.0, rx: Math.PI / 2 }))
  }
  for (const m of MATS) root.add(mesh(B(1.4, 0.06, 1.0), toon('#4F6FAF'), { x: m.x, y: 0.03, z: m.z }))
  const rack = new THREE.Group(); rack.position.set(31.3, 0, -5); root.add(rack)
  rack.add(mesh(B(0.5, 0.12, 5.6), beam, { y: 0.9 })); rack.add(mesh(B(0.5, 0.12, 5.6), beam, { y: 2.2 }))
  for (let i = 0; i < 6; i++) rack.add(mesh(C(0.05, 0.05, 2.6, 8), toon(i % 2 ? '#6B3F22' : '#C9D2DC'), { z: -2.3 + i * 0.92, y: 1.5, rz: 0.12 }))
  lantern(19, 4.4, dj.z0 + 0.5); lantern(29, 4.4, dj.z0 + 0.5)

  // ---- LIBRARY (x -14..0, z 11..25): tall left wall of shelves, scroll stacks, reading tables
  const lb = ROOMS.library
  floorAt(root, lb, flat(tex(woodTexture('#A86F3D'), 3, 3)))
  root.add(mesh(new THREE.PlaneGeometry(lb.z1 - lb.z0, 5), plaster.clone(), { x: lb.x0, y: 2.5, z: (lb.z0 + lb.z1) / 2, ry: Math.PI / 2, shadow: false }))
  const scrollColors = ['#E9D3A6', '#C98B4F', '#D6334C', '#3B82F6', '#22C55E', '#F59E0B']
  const shelfUnit = (x, z, w, h, rotY) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; root.add(g)
    g.add(mesh(B(w, h, 0.7), toon('#6B3F22'), { y: h / 2 }))
    const rows = Math.floor(h / 0.55)
    for (let r = 0; r < rows; r++) for (let c = 0; c < Math.floor(w / 0.32); c++) {
      g.add(mesh(C(0.1, 0.1, 0.12, 8), toon(scrollColors[(r * 7 + c * 3) % scrollColors.length]), { x: -w / 2 + 0.2 + c * 0.32, y: 0.35 + r * 0.55, z: 0.33, rx: Math.PI / 2 }))
    }
  }
  for (const s of SHELVES) shelfUnit(s.x + 0.1, s.z, 2.6, 3.2, Math.PI / 2)
  for (const s of STACKS) shelfUnit(s.x, s.z, 2.4, 1.5, 0)
  for (const t of READ_TABLES) {
    root.add(mesh(B(2.0, 0.12, 0.9), toon('#7A4526'), { x: t.x, y: 0.42, z: t.z }))
    for (const [dx, dz] of [[-0.85, -0.35], [0.85, -0.35], [-0.85, 0.35], [0.85, 0.35]]) root.add(mesh(B(0.1, 0.38, 0.1), beam, { x: t.x + dx, y: 0.19, z: t.z + dz }))
    root.add(mesh(new THREE.PlaneGeometry(0.5, 0.36), basic('#FFF8EA'), { x: t.x - 0.3, y: 0.49, z: t.z, rx: -Math.PI / 2, shadow: false }))
    for (const dz of [-1.0, 1.0]) root.add(mesh(B(0.8, 0.12, 0.8), toon('#5B6FB0'), { x: t.x, y: 0.06, z: t.z + dz }))
  }
  roomSign(lb, 'PERPUSTAKAAN')
  lantern(-13.4, 3.9, 12.6, '#F2C94C'); lantern(-13.4, 3.9, 23.4, '#F2C94C')

  // ---- GARDEN (x 2..16, z 11..25): grass, pond with koi, sakura, rocks, stone lantern, bamboo
  const gd = ROOMS.garden
  floorAt(root, gd, plain('#86C06C'))
  for (let i = 0; i < 9; i++) root.add(mesh(C(0.42, 0.45, 0.08, 10), toon('#B8B2A6'), { x: 3.4 + i * 1.2, y: 0.04, z: 18 + Math.sin(i * 0.9) * 0.5 }))
  root.add(mesh(new THREE.TorusGeometry(POND.r, 0.22, 8, 40), toon('#9A948A'), { x: POND.x, y: 0.08, z: POND.z, rx: Math.PI / 2 }))
  const water = new THREE.MeshToonMaterial({ color: '#5DB8E6', transparent: true, opacity: 0.88 }); water.userData.outlineParameters = { visible: false }
  root.add(mesh(new THREE.CircleGeometry(POND.r, 40), water, { x: POND.x, y: 0.06, z: POND.z, rx: -Math.PI / 2, shadow: false }))
  const koiGeo = new THREE.CapsuleGeometry(0.1, 0.32, 4, 8)
  const kois = ['#F97316', '#F4F1EA', '#EF4444'].map((c, i) => { const k = mesh(koiGeo, toon(c), { y: 0.1, rz: Math.PI / 2, shadow: false }); k.userData.dynamic = true; root.add(k); return { k, r: POND.r * (0.45 + i * 0.15), sp: 0.5 + i * 0.17, ph: i * 2.1 } })
  anim.push(t => { for (const o of kois) { const a = o.ph + t * o.sp; o.k.position.set(POND.x + Math.cos(a) * o.r, 0.1, POND.z + Math.sin(a) * o.r); o.k.rotation.set(0, -a, Math.PI / 2) } })
  const sak = new THREE.Group(); sak.position.set(SAKURA.x, 0, SAKURA.z); root.add(sak)
  sak.add(mesh(C(0.22, 0.34, 2.6, 10), toon('#6B3F22'), { y: 1.3, rz: 0.08 }))
  for (const [x, y, z, r] of [[0, 3.1, 0, 1.2], [-0.9, 2.7, 0.3, 0.85], [0.9, 2.8, -0.2, 0.9], [0.2, 3.6, -0.5, 0.8], [-0.3, 2.6, -0.8, 0.7]]) sak.add(mesh(S(r, 14, 10), toon('#F7B6CC'), { x, y, z }))
  for (const r of ROCKS) root.add(mesh(new THREE.DodecahedronGeometry(0.6), toon('#9CA3AF'), { x: r.x, y: 0.32, z: r.z, sy: 0.6 }))
  const sl = new THREE.Group(); sl.position.set(STONE_LANTERN.x, 0, STONE_LANTERN.z); root.add(sl)
  sl.add(mesh(B(0.7, 0.2, 0.7), toon('#A8A29E'), { y: 0.1 })); sl.add(mesh(C(0.12, 0.14, 0.8, 8), toon('#A8A29E'), { y: 0.6 }))
  sl.add(mesh(B(0.6, 0.45, 0.6), toon('#C9C3B8'), { y: 1.2 })); sl.add(mesh(new THREE.ConeGeometry(0.55, 0.35, 4), toon('#A8A29E'), { y: 1.6, ry: Math.PI / 4 }))
  for (let i = 0; i < 7; i++) root.add(mesh(C(0.07, 0.07, 3 + (i % 3) * 0.6, 8), toon('#5E9E4A'), { x: 15 - (i % 3) * 0.35, y: 1.6, z: 11.8 + i * 0.3 }))
  roomSign(gd, 'TAMAN ZEN', '#3F6B3A')

  // ---- TEAHOUSE (x 18..32, z 11..25): tatami, tea tables, ramen counter, kotatsu
  const th = ROOMS.teahouse
  floorAt(root, th, flat(tex(woodTexture('#C7884B'), 3, 3)))
  const tat = tatamiTexture()
  for (let ix = 0; ix < 5; ix++) for (let iz = 0; iz < 3; iz++) root.add(mesh(new THREE.PlaneGeometry(1.98, 3.98), flat(tat), { rx: -Math.PI / 2, x: 19.6 + ix * 2, y: 0.012, z: 13.4 + iz * 4, shadow: false }))
  for (const t of TEA_TABLES) {
    root.add(mesh(B(1.4, 0.12, 1.2), toon('#7A4526'), { x: t.x, y: 0.42, z: t.z }))
    for (const [dx, dz] of [[-0.6, -0.5], [0.6, -0.5], [-0.6, 0.5], [0.6, 0.5]]) root.add(mesh(B(0.1, 0.38, 0.1), beam, { x: t.x + dx, y: 0.19, z: t.z + dz }))
    root.add(mesh(S(0.18), toon('#4E7F5A'), { x: t.x, y: 0.62, z: t.z, sy: 0.85 }))
    for (const dx of [-1.45, 1.45]) root.add(mesh(B(0.8, 0.12, 0.8), toon('#D6334C'), { x: t.x + dx, y: 0.06, z: t.z }))
  }
  const ct = new THREE.Group(); ct.position.set(COUNTER.x, 0, COUNTER.z); root.add(ct)
  ct.add(mesh(B(COUNTER.w, 1.0, COUNTER.d), toon('#8A5530'), { y: 0.5 })); ct.add(mesh(B(COUNTER.w + 0.2, 0.1, COUNTER.d + 0.2), toon('#C98B4F'), { y: 1.04 }))
  for (const dz of [-1.6, 0, 1.6]) { ct.add(mesh(C(0.2, 0.14, 0.14, 14), toon('#F4F1EA'), { y: 1.16, z: dz })); ct.add(mesh(C(0.17, 0.17, 0.02, 14), toon('#F2C94C'), { y: 1.23, z: dz })) }
  ct.add(mesh(C(0.35, 0.35, 0.5, 16), toon('#4B5563'), { x: 0.9, y: 1.35, z: -2.2 }))
  for (const dz of [-2, 0, 2]) ct.add(mesh(new THREE.PlaneGeometry(1.8, 1.1), basic('#fff', { map: signTexture(dz === 0 ? 'RAMEN' : '', '#B91C1C') , side: THREE.DoubleSide }), { x: 0.2, y: 3.0, z: dz, ry: Math.PI / 2, shadow: false }))
  ct.add(mesh(B(0.12, 3.6, 0.12), beam, { x: 0.3, y: 1.8, z: -3 })); ct.add(mesh(B(0.12, 3.6, 0.12), beam, { x: 0.3, y: 1.8, z: 3 })); ct.add(mesh(B(0.12, 0.12, 6.2), beam, { x: 0.3, y: 3.6 }))
  const kt = new THREE.Group(); kt.position.set(KOTATSU.x, 0, KOTATSU.z); root.add(kt)
  kt.add(mesh(B(1.6, 0.36, 1.4), toon('#E8913A'), { y: 0.18 })); kt.add(mesh(B(1.2, 0.08, 1.0), toon('#7A4526'), { y: 0.42 }))
  kt.add(mesh(S(0.12), toon('#F59E0B'), { x: 0.3, y: 0.52 })); kt.add(mesh(S(0.12), toon('#F59E0B'), { x: 0.05, y: 0.52, z: 0.2 }))
  roomSign(th, 'KEDAI TEH', '#9F1239')
  lantern(20, 3.8, 12, '#E8452E'); lantern(27, 3.8, 12, '#E8452E'); lantern(31.4, 3.8, 24, '#E8452E')

  function setNight(on) {
    hq.setNight(on)
    for (const l of lanterns) { l.body.emissive.set(on ? '#FF7A3A' : '#000000'); l.sp.material.opacity = on ? 0.85 : 0 }
  }
  function update(t) { for (const f of anim) f(t) }
  return { ...hq, setNight, update, worldRoot: root }
}

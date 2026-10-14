// Shinobi Village HQ — multi-room world layout (pure data; brain + renderer share it).
// x → right, z → towards the camera. HQ keeps its original coordinates.
//
//  z -9..9  : [ HQ  x -14..14 ]        [ DOJO x 16..32 ]
//  z 11..25 : [ LIBRARY x -14..0 ] [ GARDEN x 2..16 ] [ TEAHOUSE x 18..32 ]
//  2 m wooden walkways (engawa) between rooms; low rails with door gaps between rooms.

import { ROOM as HQ_BOUNDS, F2DZ, DESK_SLOTS, deskGeom, DOOR, TEA_TABLE, SHELF } from './layout.js'

export { DESK_SLOTS, deskGeom, DOOR, TEA_TABLE, SHELF }

export const WORLD = { minX: -14, maxX: 32, minZ: -9, maxZ: 25 }

// ---- Two-storey HQ. Floor 2 ("Ruang Strategi Kage") covers the back half of the HQ at y = FLOOR2.y.
// The brain/navgrid stay 2D: floor 2 lives in NAV SPACE at z + FLOOR2.dz (a separate region that no
// straight line can reach), joined to floor 1 by a portal = the stair. toWorld() maps nav → 3D.
export const FLOOR2 = { y: 6.2, dz: F2DZ, x0: -14, x1: 14, z0: -9, z1: 1, balconyX1: 8, balconyZ1: 3.2 }
export const STAIR = { x: 12.75, w: 1.6, footZ: 8.25, topZ: 0.25, stepFootZ: 7.5, stepTopZ: 1.2, len: 10 }
export const NAV = { minX: -14, maxX: 32, minZ: -9, maxZ: F2DZ + 3.5 }
// ---- countryside (V3): a gate in the compound's front fence leads down a stone path → torii → river bank
export const GATE = { x: 9, z: 25, w: 2.4 }
export const TORII = { x: 9, z: 33 }
export const VILLAGE_PATH = { minX: 7.6, maxX: 10.4, minZ: 24, maxZ: 56 }
export const NAV_AREAS = [
  WORLD,
  VILLAGE_PATH,
  { minX: FLOOR2.x0, maxX: FLOOR2.x1, minZ: FLOOR2.z0 + FLOOR2.dz, maxZ: FLOOR2.z1 + FLOOR2.dz },
  { minX: FLOOR2.x0, maxX: FLOOR2.balconyX1, minZ: FLOOR2.z1 + FLOOR2.dz - 1, maxZ: FLOOR2.balconyZ1 + FLOOR2.dz }, // balcony (overlaps 1 m so the inflated edges join)
]
export const NAV_PORTALS = [{ ax: STAIR.x, az: STAIR.footZ, bx: STAIR.x, bz: STAIR.topZ + FLOOR2.dz, len: STAIR.len }]
export const isFloor2 = z => z > F2DZ - 20
/** nav (x, z) → 3D { x, y, z, floor } */
export function toWorld(x, z) {
  return isFloor2(z) ? { x, y: FLOOR2.y, z: z - FLOOR2.dz, floor: 2 } : { x, y: 0, z, floor: 1 }
}
/** 3D position on the stair. u: 0 = foot (floor 1) … 1 = top (floor 2). */
export function stairPoint(u) {
  const z = STAIR.footZ + (STAIR.topZ - STAIR.footZ) * u
  const k = Math.min(1, Math.max(0, (STAIR.stepFootZ - z) / (STAIR.stepFootZ - STAIR.stepTopZ)))
  return { x: STAIR.x, y: FLOOR2.y * k, z, floor: u < 0.5 ? 1 : 2 }
}

export const ROOMS = {
  hq: { id: 'hq', name: 'Markas', x0: HQ_BOUNDS.minX, x1: HQ_BOUNDS.maxX, z0: HQ_BOUNDS.minZ, z1: HQ_BOUNDS.maxZ },
  dojo: { id: 'dojo', name: 'Dojo Latihan', x0: 16, x1: 32, z0: -9, z1: 9 },
  library: { id: 'library', name: 'Perpustakaan Gulungan', x0: -14, x1: 0, z0: 11, z1: 25 },
  garden: { id: 'garden', name: 'Taman Zen', x0: 2, x1: 16, z0: 11, z1: 25 },
  teahouse: { id: 'teahouse', name: 'Kedai Teh & Ramen', x0: 18, x1: 32, z0: 11, z1: 25 },
  village: { id: 'village', name: 'Desa (luar kompleks)', x0: -80, x1: 90, z0: 25.02, z1: 75 },
  kage: { id: 'kage', name: 'Ruang Strategi Kage (Lt. 2)', x0: -14, x1: 14, z0: F2DZ - 9, z1: F2DZ + 3.5 },
}

export function roomAt(x, z) {
  for (const r of Object.values(ROOMS)) if (x >= r.x0 - 0.01 && x <= r.x1 + 0.01 && z >= r.z0 - 0.01 && z <= r.z1 + 0.01) return r
  return { id: 'walkway', name: 'Selasar' }
}

// Doors: gaps in the rails between rooms. side: which edge of which room.
const DOOR_W = 2.4
export const DOORS = [
  { x: 14, z: 4, axis: 'x' }, { x: 16, z: 4, axis: 'x' }, // HQ ↔ walkway ↔ Dojo
  { x: -7, z: 9, axis: 'z' }, { x: 9, z: 9, axis: 'z' }, // HQ → front walkway
  { x: 25, z: 9, axis: 'z' }, // Dojo → front walkway
  { x: -7, z: 11, axis: 'z' }, { x: 9, z: 11, axis: 'z' }, { x: 25, z: 11, axis: 'z' }, // walkway → library / garden / teahouse
  { x: 0, z: 18, axis: 'x' }, { x: 2, z: 18, axis: 'x' }, // library ↔ garden
  { x: 16, z: 18, axis: 'x' }, { x: 18, z: 18, axis: 'x' }, // garden ↔ teahouse
]

/** Rails between rooms as thin rects, with door gaps cut out. Outer world edges are bounded by the grid. */
export function railSegments() {
  const segs = []
  const addX = (x, z0, z1) => { // rail along z at constant x
    const gaps = DOORS.filter(d => d.axis === 'x' && Math.abs(d.x - x) < 0.01 && d.z > z0 && d.z < z1).map(d => [d.z - DOOR_W / 2, d.z + DOOR_W / 2]).sort((a, b) => a[0] - b[0])
    let s = z0
    for (const [g0, g1] of gaps) { if (g0 > s) segs.push({ axis: 'x', x, a: s, b: g0 }); s = g1 }
    if (s < z1) segs.push({ axis: 'x', x, a: s, b: z1 })
  }
  const addZ = (z, x0, x1) => {
    const gaps = DOORS.filter(d => d.axis === 'z' && Math.abs(d.z - z) < 0.01 && d.x > x0 && d.x < x1).map(d => [d.x - DOOR_W / 2, d.x + DOOR_W / 2]).sort((a, b) => a[0] - b[0])
    let s = x0
    for (const [g0, g1] of gaps) { if (g0 > s) segs.push({ axis: 'z', z, a: s, b: g0 }); s = g1 }
    if (s < x1) segs.push({ axis: 'z', z, a: s, b: x1 })
  }
  addX(14, -9, 9); addX(16, -9, 9) // HQ right, Dojo left
  addZ(9, -14, 14); addZ(9, 16, 32) // HQ front, Dojo front
  addZ(11, -14, 0); addZ(11, 2, 16); addZ(11, 18, 32) // front row tops
  addX(0, 11, 25); addX(2, 11, 25); addX(16, 11, 25); addX(18, 11, 25) // front row sides
  return segs
}

// ---------------------------------------------------------------- room furniture anchors
export const RING = { x: 24, z: 3.2, r: 2.6 } // Dojo arena (moved out of HQ)
export const DUMMIES = [{ x: 19.2, z: -4.6 }, { x: 29.0, z: -4.6 }]
export const TARGET = { x: 24, z: -8.6 } // shuriken target board on the Dojo back wall
export const MATS = [{ x: 19.4, z: 6.6 }, { x: 28.6, z: 6.6 }] // meditation mats
export const SHELVES = [{ x: -13.5, z: 14 }, { x: -13.5, z: 18 }, { x: -13.5, z: 22 }] // library wall shelves (tall wall)
export const STACKS = [{ x: -8, z: 15.2 }, { x: -4, z: 15.2 }] // free-standing scroll stacks (rows)
export const READ_TABLES = [{ x: -8, z: 20.5 }, { x: -3.5, z: 20.5 }]
export const POND = { x: 10, z: 19.5, r: 2.4 }
export const SAKURA = { x: 4.6, z: 14 }
export const ROCKS = [{ x: 13.6, z: 14.2 }, { x: 5.2, z: 22.6 }]
export const STONE_LANTERN = { x: 14.2, z: 23.2 }
export const TEA_TABLES = [{ x: 22, z: 17.5 }, { x: 22, z: 22 }]
export const COUNTER = { x: 29.6, z: 18, w: 1.0, d: 6 } // ramen counter along the right wall
export const KOTATSU = { x: 26, z: 23 }

const PI = Math.PI
/** Points of interest: face = rotation.y (0 → facing +z). room for labels. sit → floor pose. */
export const POIS = {
  // HQ
  board: [{ x: -4.5, z: -7.75 + F2DZ, face: PI }, { x: -2.5, z: -7.75 + F2DZ, face: PI }], // floor 2
  balcony: [{ x: -9.2, z: F2DZ + 2.45, face: 0 }, { x: -6.8, z: F2DZ + 2.45, face: 0 }, { x: 2.5, z: F2DZ + 2.45, face: 0 }], // floor 2, overlooking the team room
  window: [{ x: -10.5, z: -7.85, face: PI }],
  shelf: [{ x: -12.45, z: -3.5, face: -PI / 2 }, { x: -12.45, z: -2.1, face: -PI / 2 }],
  tea: [ // HQ tea corner + Kedai Teh
    { x: -9.45, z: 5.6, face: PI / 2 }, { x: -6.55, z: 5.6, face: -PI / 2 },
    ...TEA_TABLES.flatMap(t => [{ x: t.x - 1.45, z: t.z, face: PI / 2 }, { x: t.x + 1.45, z: t.z, face: -PI / 2 }]),
  ],
  ramen: [{ x: COUNTER.x - 1.15, z: COUNTER.z - 1.6, face: PI / 2 }, { x: COUNTER.x - 1.15, z: COUNTER.z, face: PI / 2 }, { x: COUNTER.x - 1.15, z: COUNTER.z + 1.6, face: PI / 2 }],
  // Dojo
  train: DUMMIES.map(d => ({ x: d.x, z: d.z + 1.25, face: PI })),
  throw: [{ x: 22.6, z: -3.6, face: PI }, { x: 25.4, z: -3.6, face: PI }],
  meditate: [...MATS.map(m => ({ x: m.x, z: m.z, face: PI })), ...ROCKS.map(r => ({ x: r.x, z: r.z + 1.0, face: PI }))],
  // Library
  browse: [...SHELVES.map(s => ({ x: s.x + 1.05, z: s.z, face: -PI / 2 })), ...STACKS.map(s => ({ x: s.x, z: s.z + 0.95, face: PI }))],
  read: READ_TABLES.flatMap(t => [{ x: t.x, z: t.z - 1.0, face: 0 }, { x: t.x, z: t.z + 1.0, face: PI }]),
  // Garden
  koi: [{ x: POND.x - POND.r - 0.6, z: POND.z, face: PI / 2 }, { x: POND.x + POND.r + 0.6, z: POND.z, face: -PI / 2 }, { x: POND.x, z: POND.z + POND.r + 0.6, face: PI }],
  sakura: [{ x: SAKURA.x + 1.6, z: SAKURA.z + 1.2, face: -2.2 }],
  // countryside (outside the compound)
  torii: [{ x: 8.6, z: 30.8, face: 0 }],
  paddy: [{ x: 8.25, z: 41, face: -PI / 2 }, { x: 9.75, z: 47.5, face: PI / 2 }],
  river: [{ x: 8.6, z: 55.2, face: 0 }, { x: 9.7, z: 55.2, face: 0 }],
  // cats only
  nap: [{ x: KOTATSU.x, z: KOTATSU.z - 1.2, face: 0 }, { x: 8.4, z: 12.4, face: 0.6 }],
}

export const ACTIVITY_ROOM = {
  board: 'kage', balcony: 'kage', torii: 'village', paddy: 'village', river: 'village', window: 'hq', shelf: 'hq', ramen: 'teahouse', train: 'dojo', throw: 'dojo',
  browse: 'library', read: 'library', koi: 'garden', sakura: 'garden', nap: 'teahouse', spar: 'dojo',
}

/** Free areas for "wander"/"stroll" targets (outside furniture). */
export const WANDER_AREAS = [
  { x0: -11.5, x1: 12, z0: 2.4, z1: 8, w: 1 }, // HQ front (ring moved out)
  { x0: 3, x1: 15, z0: 12, z1: 24, w: 2 }, // garden
  { x0: 17, x1: 31, z0: -1, z1: 7.5, w: 1 }, // dojo floor
  { x0: -13, x1: 31, z0: 9.3, z1: 10.7, w: 1 }, // front walkway
  { x0: -11, x1: 7, z0: F2DZ - 1.5, z1: F2DZ + 0.6, w: 0.6 }, // floor 2, in front of the Kage desk
]

/** Extra HQ desk slots, free now that the ring left HQ. */
export const EXTRA_DESK_SLOTS = [{ x: 0, z: -5.6 }, { x: -3.8, z: 5.4 }, { x: 3.8, z: 5.4 }] // (0,-5.6) freed when the Kage moved upstairs

/** All static obstacles of the world (desks passed in). Rects x0..x1/z0..z1 or circles x,z,r. */
export function worldObstacles(desks) {
  const o = desks.map(d => ({ x0: d.x - d.w / 2, x1: d.x + d.w / 2, z0: d.z - d.d / 2, z1: d.z + d.d / 2 }))
  // HQ fixed furniture
  o.push(
    { x0: TEA_TABLE.x - 0.7, x1: TEA_TABLE.x + 0.7, z0: TEA_TABLE.z - 0.6, z1: TEA_TABLE.z + 0.6 },
    { x0: -14, x1: -13.1, z0: SHELF.z - 1.5, z1: SHELF.z + 1.5 },
    { x: 12.8, z: -8.0, r: 0.6 }, { x: -12.8, z: 7.9, r: 0.6 }, // bonsai
    // floor 1: the stair + posts holding the floor-2 slab edge
    { x0: STAIR.x - STAIR.w / 2, x1: STAIR.x + STAIR.w / 2, z0: STAIR.stepTopZ - 0.2, z1: STAIR.stepFootZ + 0.1 },
    ...[-7, 0, 7].map(x => ({ x, z: FLOOR2.z1 - 0.2, r: 0.22 })),
    // floor 2 (nav z + F2DZ): gong frame, scroll shelves on the left wall
    { x0: 9.4, x1: 12.6, z0: -9 + F2DZ, z1: -8.2 + F2DZ },
    { x0: -14, x1: -13.0, z0: -7.7 + F2DZ, z1: 0.3 + F2DZ },
  )
  // rails
  for (const s of railSegments()) {
    if (s.axis === 'x') o.push({ x0: s.x - 0.08, x1: s.x + 0.08, z0: s.a, z1: s.b })
    else o.push({ x0: s.a, x1: s.b, z0: s.z - 0.08, z1: s.z + 0.08 })
  }
  // Dojo
  for (const d of DUMMIES) o.push({ x: d.x, z: d.z, r: 0.45 })
  o.push({ x0: TARGET.x - 1.2, x1: TARGET.x + 1.2, z0: -9, z1: -8.3 })
  o.push({ x0: 30.8, x1: 32, z0: -8, z1: -2 }) // weapon rack
  for (const a of [0.785, 2.356, 3.927, 5.498]) o.push({ x: RING.x + Math.cos(a) * (RING.r + 0.35), z: RING.z + Math.sin(a) * (RING.r + 0.35), r: 0.15 })
  // Library
  for (const s of SHELVES) o.push({ x0: -14, x1: s.x + 0.45, z0: s.z - 1.4, z1: s.z + 1.4 })
  for (const s of STACKS) o.push({ x0: s.x - 1.3, x1: s.x + 1.3, z0: s.z - 0.35, z1: s.z + 0.35 })
  for (const t of READ_TABLES) o.push({ x0: t.x - 1.0, x1: t.x + 1.0, z0: t.z - 0.45, z1: t.z + 0.45 })
  // Garden
  o.push({ x: POND.x, z: POND.z, r: POND.r }, { x: SAKURA.x, z: SAKURA.z, r: 0.5 }, { x: STONE_LANTERN.x, z: STONE_LANTERN.z, r: 0.45 })
  for (const r of ROCKS) o.push({ x: r.x, z: r.z, r: 0.55 })
  // Teahouse
  for (const t of TEA_TABLES) o.push({ x0: t.x - 0.75, x1: t.x + 0.75, z0: t.z - 0.6, z1: t.z + 0.6 })
  o.push({ x0: COUNTER.x - COUNTER.w / 2, x1: 32, z0: COUNTER.z - COUNTER.d / 2, z1: COUNTER.z + COUNTER.d / 2 })
  o.push({ x0: KOTATSU.x - 0.7, x1: KOTATSU.x + 0.7, z0: KOTATSU.z - 0.6, z1: KOTATSU.z + 0.6 })
  return o
}

/** Camera framing per view: target + rect to fit (renderer computes distance from aspect). */
export const VIEWS = {
  all: { ...WORLD },
  hq: { minX: -14, maxX: 14, minZ: -9, maxZ: 9 },
  dojo: { minX: 16, maxX: 32, minZ: -9, maxZ: 9 },
  library: { minX: -14, maxX: 0, minZ: 11, maxZ: 25 },
  garden: { minX: 2, maxX: 16, minZ: 11, maxZ: 25 },
  teahouse: { minX: 18, maxX: 32, minZ: 11, maxZ: 25 },
  floor1: { minX: -14, maxX: 14, minZ: -9, maxZ: 9 },
  floor2: { minX: -14, maxX: 14, minZ: -9, maxZ: 3.2, y: FLOOR2.y },
  country: { minX: -40, maxX: 60, minZ: -20, maxZ: 64 },
}

/** Conversation spots: pairs facing each other. `keys` reserve the underlying POIs (shared seats). */
export const CHAT_SPOTS = [
  { room: 'hq', pts: [POIS.tea[0], POIS.tea[1]], keys: ['tea:0', 'tea:1'] },
  { room: 'teahouse', pts: [POIS.tea[2], POIS.tea[3]], keys: ['tea:2', 'tea:3'] },
  { room: 'teahouse', pts: [POIS.tea[4], POIS.tea[5]], keys: ['tea:4', 'tea:5'] },
  { room: 'library', pts: [POIS.read[0], POIS.read[1]], keys: ['read:0', 'read:1'] },
  { room: 'garden', pts: [{ x: 7, z: 23.4, face: PI / 2 }, { x: 9.2, z: 23.4, face: -PI / 2 }], keys: ['chat:garden:0', 'chat:garden:1'] },
  { room: 'dojo', pts: [{ x: 22.6, z: 7.6, face: PI / 2 }, { x: 24.8, z: 7.6, face: -PI / 2 }], keys: ['chat:dojo:0', 'chat:dojo:1'] },
  { room: 'village', pts: [{ x: 8.3, z: 34.4, face: PI / 2 }, { x: 9.7, z: 34.4, face: -PI / 2 }], keys: ['chat:village:0', 'chat:village:1'] },
  { room: 'kage', pts: [{ x: -2.2, z: F2DZ + 2.3, face: PI / 2 }, { x: 0, z: F2DZ + 2.3, face: -PI / 2 }], keys: ['chat:kage:0', 'chat:kage:1'] },
]
export const SEATED_SPOT = key => key.startsWith('tea:')

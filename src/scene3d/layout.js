// World layout for Shinobi HQ (units ≈ meters, character ≈ 2.1 tall).
// Camera looks from the front-right; walls are on the back (−z) and left (−x).
// Pure data — shared by the activity brain (no three.js) and the renderer.

export const ROOM = { minX: -14, maxX: 14, minZ: -9, maxZ: 9, wallH: 6 }
/** Floor 2 lives in nav space at z + F2DZ (beyond the countryside paths; see world.js FLOOR2). */
export const F2DZ = 100

/** Desk slots in fill order. Slot 0 = Kage desk (Hermes / default profile) — on FLOOR 2 (nav z + F2DZ, see world.js FLOOR2). */
export const DESK_SLOTS = [
  { x: 0, z: -5.6 + F2DZ, big: true },
  { x: -7, z: -5.6 }, { x: 7, z: -5.6 },
  { x: -3.8, z: -1.4 }, { x: 3.8, z: -1.4 }, { x: 10.6, z: -1.4 },
  { x: -10.4, z: -1.4 }, { x: 11, z: -5.6 },
  { x: -3.8, z: 1.9 }, { x: 10.6, z: 1.9 },
]

export function deskGeom(slot) {
  const w = slot.big ? 3.6 : 2.6
  const d = 1.2
  return {
    x: slot.x, z: slot.z, w, d, big: !!slot.big,
    // agent sits BEHIND the desk facing +z (towards the camera)
    seat: { x: slot.x, z: slot.z - 1.0, face: 0 },
    // where genin stand while helping (right of the desk, slightly behind)
    side: { x: slot.x + w / 2 + 0.55, z: slot.z - 0.7, face: -Math.PI / 2 },
  }
}

export const RING = { x: 3.2, z: 5.4, r: 2.6 }
export const DOOR = { x: -13.2, z: 3.2 }
export const TEA_TABLE = { x: -8, z: 5.6 }
export const DUMMY = { x: 10.6, z: 5.6 }
export const SHELF = { z: -2.8 }

/** Points of interest for idle activities. face = rotation.y (0 → facing +z). */
export const POIS = {
  tea: [
    { x: -9.45, z: 5.6, face: Math.PI / 2, sit: true },
    { x: -6.55, z: 5.6, face: -Math.PI / 2, sit: true },
  ],
  shelf: [
    { x: -12.45, z: -3.5, face: -Math.PI / 2 },
    { x: -12.45, z: -2.1, face: -Math.PI / 2 },
  ],
  board: [
    { x: -4.5, z: -7.75, face: Math.PI },
    { x: -2.5, z: -7.75, face: Math.PI },
  ],
  window: [{ x: -10.5, z: -7.85, face: Math.PI }],
  dummy: [{ x: DUMMY.x, z: DUMMY.z - 1.25, face: 0 }],
}

/** Static obstacles (rects x0..x1 / z0..z1, or circles x,z,r). */
export function obstaclesFor(desks) {
  const o = desks.map(d => ({ x0: d.x - d.w / 2, x1: d.x + d.w / 2, z0: d.z - d.d / 2, z1: d.z + d.d / 2 }))
  o.push(
    { x0: TEA_TABLE.x - 0.7, x1: TEA_TABLE.x + 0.7, z0: TEA_TABLE.z - 0.6, z1: TEA_TABLE.z + 0.6 },
    { x0: -14, x1: -13.1, z0: SHELF.z - 1.5, z1: SHELF.z + 1.5 },
    { x: DUMMY.x, z: DUMMY.z, r: 0.45 },
    { x0: 9.4, x1: 12.6, z0: -9, z1: -8.2 }, // gong frame
    { x: 12.8, z: -8.0, r: 0.6 }, { x: -12.8, z: 7.9, r: 0.6 }, // bonsai
  )
  for (const a of [0.785, 2.356, 3.927, 5.498]) {
    o.push({ x: RING.x + Math.cos(a) * (RING.r + 0.35), z: RING.z + Math.sin(a) * (RING.r + 0.35), r: 0.15 })
  }
  return o
}

/** Free area for "wander" targets (front of the room, outside the ring). */
export const WANDER_AREA = { x0: -11.5, x1: 12, z0: 1.2, z1: 8 }

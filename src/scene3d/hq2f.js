// Two-storey HQ (V2). Floor 2 = "Ruang Strategi Kage" over the back half of the team room:
// slab + beams + posts, upper plaster walls, scroll shelves, balcony, railing, inner stair (right),
// optional curved tiled roof (far views). The Kage desk, Mission Board and gong are placed by room.js/office.js.
import * as THREE from 'three'
import { toon, basic, mesh, signTexture, kanjiScroll, missionScroll, plasterTexture } from './toon.js'
import { ROOM } from './layout.js'
import { FLOOR2 as F, STAIR } from './world.js'

const B = (w, h, d) => new THREE.BoxGeometry(w, h, d)
const C = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s)

export function buildHq2f(scene) {
  const root = new THREE.Group(); scene.add(root)
  const beam = toon('#8A5530'), dark = toon('#6B3F22'), Y = F.y
  const W = F.x1 - F.x0, D = F.z1 - F.z0, cz = (F.z0 + F.z1) / 2
  const floor2 = new THREE.Group(); root.add(floor2)
  const slabMat = toon('#B9814A').clone(); slabMat.userData = { outlineParameters: {} }
  const slab = mesh(B(W, 0.35, D), slabMat, { y: Y - 0.18, z: cz }); floor2.add(slab)
  const fadeable = [slab]
  for (let x = F.x0 + 0.2; x <= F.x1; x += 7) { const m = mesh(B(0.4, 0.5, D), beam.clone(), { x, y: Y - 0.5, z: cz }); m.material.userData = { outlineParameters: {} }; floor2.add(m); fadeable.push(m) }
  // posts under the slab edge (floor 1 obstacles in world.js)
  for (const x of [-7, 0, 7]) root.add(mesh(B(0.4, Y - 0.35, 0.4), beam, { x, y: (Y - 0.35) / 2, z: F.z1 - 0.2 }))
  // upper walls (back + left)
  const pl = new THREE.MeshToonMaterial({ map: plasterTexture() }); pl.userData.outlineParameters = { visible: false }
  floor2.add(mesh(new THREE.PlaneGeometry(W, 4.6), pl, { y: Y + 2.3, z: F.z0 + 0.01, shadow: false }))
  floor2.add(mesh(new THREE.PlaneGeometry(D + 2.2, 4.6), pl, { x: F.x0 + 0.01, y: Y + 2.3, z: cz + 1.1, ry: Math.PI / 2, shadow: false }))
  floor2.add(mesh(B(W, 0.3, 0.3), beam, { y: Y + 4.5, z: F.z0 + 0.15 }))
  floor2.add(mesh(B(0.3, 0.3, D + 2.2), beam, { x: F.x0 + 0.15, y: Y + 4.5, z: cz + 1.1 }))
  // balcony + railings (front edge, balcony edge; gap for the stair)
  const bw = F.balconyX1 - F.x0, bd = F.balconyZ1 - F.z1
  floor2.add(mesh(B(bw, 0.25, bd), toon('#B9814A'), { x: F.x0 + bw / 2, y: Y - 0.12, z: F.z1 + bd / 2 }))
  const rail = (x0, x1, z) => {
    for (let x = x0; x <= x1 + 1e-6; x += 1.15) floor2.add(mesh(B(0.1, 0.9, 0.1), dark, { x, y: Y + 0.45, z }))
    floor2.add(mesh(B(x1 - x0, 0.1, 0.14), dark, { x: (x0 + x1) / 2, y: Y + 0.92, z }))
  }
  rail(F.x0 + 0.4, F.balconyX1, F.balconyZ1 - 0.1)
  rail(F.balconyX1, STAIR.x - STAIR.w / 2 - 0.1, F.z1 - 0.07)
  for (let z = F.z1; z <= F.balconyZ1; z += 1.1) floor2.add(mesh(B(0.1, 0.9, 0.1), dark, { x: F.balconyX1, y: Y + 0.45, z }))
  floor2.add(mesh(B(0.14, 0.1, bd), dark, { x: F.balconyX1, y: Y + 0.92, z: F.z1 + bd / 2 }))
  // furniture: scroll shelves (left wall), strategy kanji, sign, balcony tea mat + cushions
  for (let i = 0; i < 3; i++) floor2.add(mesh(B(0.7, 2.6, 2.4), dark, { x: F.x0 + 0.5, y: Y + 1.3, z: -6.5 + i * 2.8 }))
  for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) floor2.add(mesh(C(0.09, 0.09, 0.5, 8), toon(['#F5E6C8', '#E8D2A6', '#D6334C'][k]), { x: F.x0 + 0.85, y: Y + 0.6 + k * 0.8, z: -7.1 + i * 2.8 + k * 0.4, rx: Math.PI / 2, shadow: false }))
  floor2.add(mesh(new THREE.PlaneGeometry(1.0, 2.6), basic('#fff', { map: kanjiScroll('策') }), { x: 7.4, y: Y + 2.4, z: F.z0 + 0.06, shadow: false }))
  floor2.add(mesh(new THREE.PlaneGeometry(4.8, 0.8), basic('#fff', { map: signTexture('STRATEGI') }), { x: 2.6, y: Y + 3.95, z: F.z0 + 0.06, shadow: false }))
  floor2.add(mesh(B(3.0, 0.06, 1.0), toon('#4F6FAF'), { x: -8, y: Y + 0.03, z: F.z1 + 1.35 }))
  // inner stair along the right wall + stringers + handrail
  const stair = new THREE.Group(); root.add(stair)
  const run = STAIR.stepFootZ - STAIR.stepTopZ, steps = 14
  for (let i = 0; i < steps; i++) { const t = (i + 1) / steps; stair.add(mesh(B(STAIR.w, 0.16, 0.5), toon('#B9814A'), { x: STAIR.x, y: t * Y - 0.08, z: STAIR.stepFootZ - t * run })) }
  const L = Math.hypot(run, Y), ang = Math.atan2(Y, run), midZ = (STAIR.stepFootZ + STAIR.stepTopZ) / 2
  for (const sx of [-1, 1]) stair.add(mesh(B(0.14, 0.45, L), dark, { x: STAIR.x + sx * (STAIR.w / 2 + 0.07), y: Y / 2 - 0.1, z: midZ, rx: ang }))
  stair.add(mesh(B(0.08, 0.08, L), dark, { x: STAIR.x - STAIR.w / 2 - 0.07, y: Y / 2 + 0.85, z: midZ, rx: ang }))
  // roof (far views only) — curved-eave hip roof
  const roof = new THREE.Group(); roof.visible = false; root.add(roof)
  const RY = Y + 4.8
  const hip = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 1, 1, 4, 1), toon('#3F4A5A'))
  hip.rotation.y = Math.PI / 4; hip.scale.set((ROOM.maxX - ROOM.minX) * 0.78, 4.2, (ROOM.maxZ - ROOM.minZ) * 0.78); hip.position.set(0, RY + 2.1, 0)
  roof.add(hip); roof.add(mesh(B(ROOM.maxX - ROOM.minX + 2.4, 0.35, ROOM.maxZ - ROOM.minZ + 2.4), toon('#2E3644'), { y: RY }))
  roof.add(mesh(B(3.2, 0.5, 0.5), toon('#C9A43A'), { y: RY + 4.3 }))
  let faded = false
  return {
    root, floor2, stair, roof,
    setFloor2Visible(on) { floor2.visible = on },
    /** see-through slab when looking steeply down (so floor-1 desks under it stay visible) */
    setSlabFade(on) {
      if (on === faded) return; faded = on
      for (const m of fadeable) { m.material.transparent = on; m.material.opacity = on ? 0.28 : 1; m.material.depthWrite = !on; m.material.userData.outlineParameters.visible = !on; m.material.needsUpdate = true }
    },
  }
}

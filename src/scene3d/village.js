// V3 — Japanese countryside around the compound. Procedural + original.
// Draw-call budget: static props are merged per material (bake), mass vegetation is instanced and
// outline-free, distant mountains are flat silhouettes softened by fog. Quality 'eco' thins instances.
import * as THREE from 'three'
import { bakeStatic } from './bake.js'
import { toon, toonUnique, basic, mesh, signTexture, glowSprite } from './toon.js'
import { WORLD, TORII, VILLAGE_PATH } from './world.js'

const B = (w, h, d) => new THREE.BoxGeometry(w, h, d)
const C = (rt, rb, h, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s)
const flatToon = c => { const m = toonUnique(c); m.userData.outlineParameters = { visible: false }; return m }
function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 } }

function instanced(geo, mat, n, place) {
  const im = new THREE.InstancedMesh(geo, mat, n)
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler()
  for (let i = 0; i < n; i++) { const o = place(i); p.set(o.x, o.y || 0, o.z); e.set(o.rx || 0, o.ry || 0, o.rz || 0); q.setFromEuler(e); s.setScalar(o.s || 1); if (o.sy) s.y *= o.sy; im.setMatrixAt(i, m4.compose(p, q, s)) }
  im.instanceMatrix.needsUpdate = true
  im.userData.full = n
  return im
}

export function buildVillage(scene, { quality = 'high' } = {}) {
  const root = new THREE.Group(); root.name = 'village'; scene.add(root)
  const src = new THREE.Group() // static props, baked at the end
  const r = rng(42)
  const cx = (WORLD.minX + WORLD.maxX) / 2
  const inst = [] // thinned in 'eco'
  const P = VILLAGE_PATH, px = (P.minX + P.maxX) / 2

  // ---- wide ground + gentle hills behind the compound
  root.add(mesh(new THREE.PlaneGeometry(700, 700), flatToon('#6E8F55'), { rx: -Math.PI / 2, x: cx, y: -0.05, z: 0, shadow: false }))
  for (let i = 0; i < 9; i++) src.add(mesh(new THREE.SphereGeometry(1, 14, 8), flatToon(i % 2 ? '#5E8A4A' : '#668F50'), { x: cx - 160 + i * 40 + r() * 10, y: -6, z: -60 - r() * 20, sx: 26 + r() * 10, sy: 14 + r() * 6, sz: 18, shadow: false }))

  // ---- distant layered mountains + snowy peak
  for (const [col, z, k] of [['#7C9AB3', -95, 1.0], ['#6B879F', -120, 1.35], ['#5A7590', -150, 1.7]]) {
    const mat = flatToon(col)
    for (let i = 0; i < 7; i++) {
      const h = (22 + r() * 18) * k, w = (30 + r() * 20) * k
      src.add(mesh(new THREE.ConeGeometry(w, h, 6), mat, { x: cx - 120 + i * 40 + r() * 15, y: h / 2 - 2, z: z - r() * 10, ry: r() * 3, shadow: false }))
    }
  }
  src.add(mesh(new THREE.ConeGeometry(70, 60, 24), flatToon('#5F7C99'), { x: cx + 10, y: 28, z: -175, shadow: false }))
  src.add(mesh(new THREE.ConeGeometry(22, 19, 24), flatToon('#F8FAFC'), { x: cx + 10, y: 48.6, z: -175, shadow: false }))

  // ---- terraced rice paddies (stepping up away from the compound), water + instanced rice
  const water = flatToon('#8FCDE8'), bund = flatToon('#9A7B4F'), rice = flatToon('#7DBE4F')
  const terraces = []
  for (let row = 0; row < 3; row++) for (const x0 of [-26, -9.4, 12, 29]) {
    if (x0 === 12 && row === 0) continue
    terraces.push({ x0, z0: 30 + row * 9, w: x0 === -9.4 ? 15.8 : 15, d: 7.4, y: 0.15 + row * 0.38 })
  }
  for (const t of terraces) {
    src.add(mesh(B(t.w + 0.8, t.y + 0.1, t.d + 0.8), bund, { x: t.x0 + t.w / 2, y: (t.y + 0.1) / 2 - 0.02, z: t.z0 + t.d / 2, shadow: false }))
    src.add(mesh(new THREE.PlaneGeometry(t.w, t.d), water, { rx: -Math.PI / 2, x: t.x0 + t.w / 2, y: t.y + 0.11, z: t.z0 + t.d / 2, shadow: false }))
  }
  const perT = 110
  const riceIm = instanced(new THREE.ConeGeometry(0.13, 0.55, 4), rice, terraces.length * perT, i => { const t = terraces[Math.floor(i / perT)], k = i % perT; return { x: t.x0 + 0.6 + (k % 11) * (t.w - 1.2) / 10, y: t.y + 0.35, z: t.z0 + 0.5 + Math.floor(k / 11) * (t.d - 1) / 9, s: 0.8 + r() * 0.4 } })
  root.add(riceIm); inst.push(riceIm)

  // ---- stone path from the gate + torii + stone lanterns (lit at night)
  const stone = toon('#B8B2A6')
  for (let i = 0; i < 19; i++) src.add(mesh(C(0.55, 0.6, 0.1, 8), stone, { x: px + Math.sin(i * 0.6) * 0.25, y: 0.03, z: 26.4 + i * 1.6, shadow: false }))
  const red = toon('#D63A2F')
  for (const sx of [-2.1, 2.1]) src.add(mesh(C(0.24, 0.3, 5.2, 14), red, { x: TORII.x + sx, y: 2.6, z: TORII.z }))
  src.add(mesh(B(6.4, 0.42, 0.55), toon('#2B1B12'), { x: TORII.x, y: 5.35, z: TORII.z }))
  src.add(mesh(B(5.6, 0.28, 0.42), red, { x: TORII.x, y: 4.4, z: TORII.z }))
  src.add(mesh(B(0.5, 0.95, 0.12), basic('#fff', { map: signTexture('忍', '#2B1B12') }), { x: TORII.x, y: 4.9, z: TORII.z + 0.3 }))
  const glow = glowSprite('#FFB547'), lights = []
  const lampMat = toonUnique('#F6E7C1'), lampStone = toon('#A8A29E')
  for (const z of [29, 38, 46]) for (const sx of [-2.8, 2.8]) {
    const x = px + sx
    src.add(mesh(C(0.12, 0.15, 0.8, 8), lampStone, { x, y: 0.4, z }))
    src.add(mesh(new THREE.ConeGeometry(0.45, 0.3, 4), lampStone, { x, y: 1.35, z, ry: Math.PI / 4 }))
    src.add(mesh(B(0.5, 0.42, 0.5), lampMat, { x, y: 1.0, z }))
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, opacity: 0, depthWrite: false })); sp.position.set(x, 1.05, z); sp.scale.setScalar(2.2); root.add(sp); lights.push(sp)
  }

  // ---- river + banks, arched bridge on the path, water wheel (animated → not baked)
  src.add(mesh(new THREE.PlaneGeometry(260, 7), water, { rx: -Math.PI / 2, x: cx, y: 0.03, z: 60, shadow: false }))
  for (const z of [56.2, 63.8]) src.add(mesh(B(260, 0.4, 0.8), bund, { x: cx, y: 0.2, z, shadow: false }))
  const plank = toon('#9C6136')
  for (let i = 0; i < 9; i++) { const t = i / 8; src.add(mesh(B(2.6, 0.18, 1.0), plank, { x: px, y: 0.25 + Math.sin(t * Math.PI) * 1.2, z: 56 + i, rx: Math.cos(t * Math.PI) * -0.25 })) }
  for (const sx of [-1.3, 1.3]) for (let i = 0; i < 9; i++) { const t = i / 8; src.add(mesh(B(0.1, 0.8, 0.1), red, { x: px + sx, y: 0.7 + Math.sin(t * Math.PI) * 1.2, z: 56 + i })) }
  const wheel = new THREE.Group(); wheel.position.set(-18, 0.8, 57.6); wheel.rotation.y = Math.PI / 2; root.add(wheel)
  const rim = new THREE.Group(); wheel.add(rim)
  rim.add(mesh(new THREE.TorusGeometry(1.6, 0.12, 6, 24), toon('#7A4526')))
  for (let i = 0; i < 8; i++) rim.add(mesh(B(0.12, 3.2, 0.5), toon('#8A5530'), { rz: (i / 8) * Math.PI }))

  // ---- minka farmhouses (thatched roofs; windows glow at night)
  const thatch = toon('#B8955A'), wallM = toon('#F3E7CF'), wood = toon('#6B3F22')
  const winMat = toonUnique('#4B3A2A'); winMat.userData.outlineParameters = { visible: false }
  for (const [x, z, ry] of [[-34, 42, 0.3], [46, 36, -0.4], [56, 6, -1.2], [-40, 14, 1.4], [44, 52, 0.1], [-30, 54, -0.2]]) {
    const h = new THREE.Group(); h.position.set(x, 0, z); h.rotation.y = ry; src.add(h)
    h.add(mesh(B(7, 2.6, 5), wallM, { y: 1.3 }))
    for (const sx of [-3.4, -1.1, 1.1, 3.4]) h.add(mesh(B(0.22, 2.6, 0.22), wood, { x: sx, y: 1.3, z: 2.55 }))
    for (const sx of [-2.2, 2.2]) h.add(mesh(B(1.2, 0.8, 0.06), winMat, { x: sx, y: 1.6, z: 2.53, shadow: false }))
    h.add(mesh(new THREE.CylinderGeometry(0.01, 5.2, 3.6, 4, 1), thatch, { y: 4.2, ry: Math.PI / 4, sx: 1.25, sz: 0.9 }))
    h.add(mesh(B(1.2, 1.7, 0.08), wood, { y: 0.85, z: 2.55 }))
  }

  // ---- bamboo grove (far left, clear of the compound walls) + pines (right) + sakura by the river
  const bamboo = flatToon('#6FAE4A'), leaf = flatToon('#4E8F3A'), pine = flatToon('#2F6B47'), trunk = flatToon('#6B3F22'), sak = flatToon('#F7B6CC')
  const nB = 300, bam = Array.from({ length: nB }, () => ({ x: -26 - r() * 26, z: -16 + r() * 40 }))
  const bIm = instanced(new THREE.CylinderGeometry(0.09, 0.11, 7, 6), bamboo, nB, i => ({ x: bam[i].x, y: 3.3, z: bam[i].z, rz: (r() - 0.5) * 0.12, sy: 0.8 + r() * 0.6 }))
  const lIm = instanced(new THREE.SphereGeometry(1, 8, 6), leaf, 100, i => ({ x: bam[i * 3].x, y: 6.4 + r() * 1.5, z: bam[i * 3].z, s: 0.9 + r() * 0.7, sy: 0.5 }))
  const nP = 70, pines = Array.from({ length: nP }, () => ({ x: 40 + r() * 26, z: -18 + r() * 36, s: 0.8 + r() * 0.8 }))
  const pIm = instanced(new THREE.ConeGeometry(1.6, 4.8, 7), pine, nP, i => ({ x: pines[i].x, y: 3.6 * pines[i].s, z: pines[i].z, s: pines[i].s }))
  const tIm = instanced(C(0.18, 0.24, 1.6, 6), trunk, nP, i => ({ x: pines[i].x, y: 0.8 * pines[i].s, z: pines[i].z, s: pines[i].s }))
  const sx14 = i => -44 + i * 7.5 + (i >= 7 ? 3 : 0)
  const sIm = instanced(new THREE.SphereGeometry(1.4, 8, 6), sak, 14, i => ({ x: sx14(i), y: 2.6, z: 53.5, s: 0.9 + (i % 3) * 0.2, sy: 0.75 }))
  const stIm = instanced(C(0.15, 0.22, 2, 6), trunk, 14, i => ({ x: sx14(i), y: 1, z: 53.5 }))
  for (const im of [bIm, lIm, pIm, tIm, sIm, stIm]) { root.add(im); inst.push(im) }

  // ---- clouds (instanced puffs drifting slowly)
  const clouds = Array.from({ length: 8 }, (_, i) => ({ x: i * 40, y: 34 + r() * 10, z: -70 - r() * 50, v: 0.6 + r() * 0.6 }))
  const cIm = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), flatToon('#FFFFFF'), clouds.length * 3); root.add(cIm)
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pv = new THREE.Vector3(), sv = new THREE.Vector3()
  function placeClouds(t) {
    clouds.forEach((c, i) => {
      const x = ((c.x + t * c.v) % 320) - 160 + cx
      for (let k = 0; k < 3; k++) { pv.set(x + (k - 1) * 4.2, c.y + (k === 1 ? 1.2 : 0), c.z); sv.set(k === 1 ? 6 : 4.4, k === 1 ? 3.2 : 2.4, 3); cIm.setMatrixAt(i * 3 + k, m4.compose(pv, q, sv)) }
    })
    cIm.instanceMatrix.needsUpdate = true
  }
  placeClouds(0)

  // ---- fireflies over the paddies (night only)
  const ffN = 70, ff = new Float32Array(ffN * 3), ffSeed = Array.from({ length: ffN }, () => [r() * 70 - 28, 0.6 + r() * 1.4, 30 + r() * 26, r() * 6.28])
  const ffGeo = new THREE.BufferGeometry(); ffGeo.setAttribute('position', new THREE.BufferAttribute(ff, 3))
  const ffPts = new THREE.Points(ffGeo, new THREE.PointsMaterial({ color: '#FFF3A0', size: 0.28, transparent: true, opacity: 0.95, depthWrite: false })); ffPts.visible = false; root.add(ffPts)

  // bake static props → ~1 draw call per material
  const baked = bakeStatic(src, { parent: root })

  scene.fog = new THREE.Fog('#BFE3F5', 85, 260)
  let night = false, q8 = quality
  function setNight(on) {
    night = on
    scene.fog.color.set(on ? '#1B2140' : '#BFE3F5')
    for (const sp of lights) sp.material.opacity = on ? 0.9 : 0
    lampMat.emissive.set(on ? '#FF9A3A' : '#000000')
    winMat.color.set(on ? '#FFD27A' : '#4B3A2A'); winMat.emissive.set(on ? '#C9802A' : '#000000')
    ffPts.visible = on && q8 !== 'eco'
  }
  function setQuality(qq) {
    q8 = qq
    for (const im of inst) im.count = qq === 'eco' ? Math.ceil(im.userData.full * 0.45) : im.userData.full
    for (const m of baked) m.castShadow = qq !== 'eco' && m.userData.shadow0
    ffPts.visible = night && qq !== 'eco'
  }
  setQuality(quality)
  function update(t) {
    rim.rotation.z = t * 0.6
    placeClouds(t)
    if (ffPts.visible) {
      for (let i = 0; i < ffN; i++) { const s = ffSeed[i]; ff[i * 3] = s[0] + Math.sin(t * 0.4 + s[3]) * 1.2; ff[i * 3 + 1] = s[1] + Math.sin(t * 1.3 + s[3] * 2) * 0.35; ff[i * 3 + 2] = s[2] + Math.cos(t * 0.35 + s[3]) * 1.2 }
      ffGeo.attributes.position.needsUpdate = true
    }
  }
  return { root, setNight, setQuality, update, get quality() { return q8 }, stats: () => ({ baked: baked.length, instanced: inst.length }) }
}

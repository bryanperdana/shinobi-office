// Chibi ninja rig built from primitives (original art). Poses are procedural.
import * as THREE from 'three'
import { toonUnique, toon, mesh, faceAtlas, FACES, gradientMap, tabbyTexture, catFaceAtlas } from './toon.js'

const SKIN = '#FFD9B5'
let FACE_TEX = null
const CAT_FACE = new Map() // stripe colour → atlas
const G = {}
function geos() {
  if (G.head) return G
  G.head = new THREE.SphereGeometry(0.5, 28, 20)
  G.face = new THREE.SphereGeometry(0.506, 24, 16, Math.PI / 2 - 0.85, 1.7, Math.PI / 2 - 0.55, 1.1)
  G.hairCap = new THREE.SphereGeometry(0.54, 26, 14, 0, Math.PI * 2, 0, 1.2)
  G.hairBack = new THREE.SphereGeometry(0.53, 20, 14, Math.PI * 0.9, Math.PI * 1.2, 0.6, 1.6)
  G.spike = new THREE.ConeGeometry(0.17, 0.46, 8)
  G.torso = new THREE.CapsuleGeometry(0.24, 0.28, 6, 16)
  G.arm = new THREE.CapsuleGeometry(0.085, 0.24, 4, 10)
  G.leg = new THREE.CapsuleGeometry(0.1, 0.24, 4, 10)
  G.hand = new THREE.SphereGeometry(0.11, 12, 10)
  G.foot = new THREE.CapsuleGeometry(0.1, 0.12, 4, 10)
  G.band = new THREE.CylinderGeometry(0.522, 0.522, 0.12, 30, 1, true)
  G.plate = new THREE.BoxGeometry(0.3, 0.13, 0.05)
  G.belt = new THREE.CylinderGeometry(0.29, 0.29, 0.09, 20)
  G.tail = new THREE.BoxGeometry(0.08, 0.32, 0.03)
  G.scarf = new THREE.TorusGeometry(0.2, 0.075, 8, 22)
  G.cup = new THREE.CylinderGeometry(0.08, 0.065, 0.12, 14)
  G.scroll = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 12)
  G.paper = new THREE.PlaneGeometry(0.42, 0.34)
  G.hat = new THREE.ConeGeometry(0.82, 0.42, 28, 1, false)
  G.hatBand = new THREE.CylinderGeometry(0.6, 0.66, 0.1, 28, 1, true)
  G.mask = new THREE.SphereGeometry(0.508, 24, 10, Math.PI / 2 - 0.9, 1.8, Math.PI / 2 + 0.12, 0.55)
  G.ring = new THREE.TorusGeometry(0.62, 0.05, 8, 40)
  G.ribbon = new THREE.BoxGeometry(0.09, 0.42, 0.025)
  G.sword = new THREE.BoxGeometry(0.07, 0.95, 0.05)
  G.guardS = new THREE.BoxGeometry(0.2, 0.04, 0.12)
  G.wrap = new THREE.CylinderGeometry(0.108, 0.108, 0.1, 12, 1, true)
  G.scarfTail = new THREE.BoxGeometry(0.16, 0.5, 0.04)
  G.ear = new THREE.ConeGeometry(0.21, 0.4, 4)
  G.earIn = new THREE.ConeGeometry(0.12, 0.26, 4)
  G.tailSeg = new THREE.CapsuleGeometry(0.075, 0.16, 4, 10)
  G.bib = new THREE.SphereGeometry(0.2, 16, 12)
  G.kunai = new THREE.ConeGeometry(0.045, 0.26, 4)
  const s = new THREE.Shape()
  for (let i = 0; i < 8; i++) { const r = i % 2 ? 0.05 : 0.17; const a = (i / 8) * Math.PI * 2; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(r, 0) }
  G.star = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false })
  return G
}

const DEF_POSE = {
  hipsY: 0.62, torsoRX: 0, torsoRY: 0, torsoRZ: 0, headRX: 0, headRY: 0, headRZ: 0,
  aLx: 0, aLy: 0, aLz: 0.12, aRx: 0, aRy: 0, aRz: -0.12, lLx: 0, lLz: 0, lRx: 0, lRz: 0,
}
const SIT = { hipsY: 0.34, lLx: -1.45, lRx: -1.45, lLz: 0.08, lRz: -0.08 }

/** Pose name + time-in-pose → joint targets, face name, prop. */
export function poseTargets(pose, t) {
  const p = { ...DEF_POSE }
  let face = 'normal', prop = null
  const s = Math.sin
  switch (pose) {
    case 'walk': case 'run': {
      const run = pose === 'run'
      const ph = t * (run ? 15 : 9.5)
      const amp = run ? 0.95 : 0.6
      p.lLx = s(ph) * amp; p.lRx = -s(ph) * amp
      p.hipsY = 0.62 + Math.abs(s(ph)) * (run ? 0.07 : 0.035)
      if (run) { p.torsoRX = 0.32; p.aLx = 1.25; p.aRx = 1.25; p.aLz = 0.25; p.aRz = -0.25; p.headRX = -0.2; face = 'focus' }
      else { p.aLx = -s(ph) * 0.55; p.aRx = s(ph) * 0.55 }
      break
    }
    case 'sit': Object.assign(p, SIT, { aLx: -0.7, aRx: -0.7, aLz: 0.05, aRz: -0.05, headRX: 0.03 * s(t * 1.6) }); break
    case 'type': Object.assign(p, SIT, { aLx: -1.25 + s(t * 19) * 0.1, aRx: -1.25 - s(t * 19) * 0.1, aLz: -0.12, aRz: 0.12, headRX: 0.16, torsoRX: 0.08 }); face = 'focus'; break
    case 'think': Object.assign(p, SIT, { aLx: -0.8, aRx: -2.15, aRz: 0.35, headRZ: 0.12 + s(t * 1.5) * 0.04, headRY: 0.15, headRX: -0.1 }); break
    case 'raise': Object.assign(p, SIT, { aLx: -0.8, aRx: -3.0, aRz: -0.15 + s(t * 7) * 0.22, headRX: -0.08 }); face = 'wow'; break
    case 'dizzy': Object.assign(p, SIT, { aLx: -0.6, aRx: -0.6, headRZ: s(t * 4) * 0.25, torsoRZ: s(t * 4 + 1) * 0.08 }); face = 'dizzy'; break
    case 'thumbs': Object.assign(p, SIT, { aLx: -0.7, aRx: -1.75, aRz: -0.55, headRZ: 0.1 }); face = 'happy'; break
    case 'sleep': Object.assign(p, SIT, { aLx: -1.0, aRx: -1.0, aLz: -0.3, aRz: 0.3, torsoRX: 0.38, headRX: 0.45 + s(t * 1.2) * 0.04 }); face = 'closed'; break
    case 'offline': Object.assign(p, SIT, { aLx: -0.4, aRx: -0.4, torsoRX: 0.25, headRX: 0.35 }); face = 'closed'; break
    case 'sitfloor': {
      Object.assign(p, SIT, { hipsY: 0.3, lLx: -1.5, lRx: -1.5, lLz: 0.35, lRz: -0.35, aLx: -0.6 })
      const sip = (t % 5) < 1.6
      p.aRx = sip ? -2.05 : -1.05; p.aRz = sip ? 0.4 : 0.1; p.headRX = sip ? -0.15 : 0.05
      face = sip ? 'closed' : 'happy'; prop = 'cup'
      break
    }
    case 'read': Object.assign(p, { aLx: -1.25, aRx: -1.25, aLz: -0.3, aRz: 0.3, headRX: 0.3 + s(t * 0.8) * 0.04, headRY: s(t * 0.6) * 0.15 }); prop = 'scroll'; break
    case 'point': Object.assign(p, { aRx: -2.4, aRz: 0.1, aLx: 0.1, headRX: -0.3, headRY: s(t * 0.7) * 0.2 }); break
    case 'look': Object.assign(p, { aLx: 0.55, aRx: 0.55, aLz: -0.2, aRz: 0.2, headRX: -0.12, headRY: s(t * 0.5) * 0.3, torsoRY: s(t * 0.5) * 0.08 }); break
    case 'punch': {
      const ph = t * 6, left = s(ph) > 0
      const k = Math.abs(s(ph))
      Object.assign(p, { hipsY: 0.56, lLx: -0.4, lRx: 0.4, aLx: left ? -1.57 * k - 0.9 * (1 - k) : -1.1, aRx: !left ? -1.57 * k - 0.9 * (1 - k) : -1.1, aLz: -0.15, aRz: 0.15, torsoRY: left ? -0.2 * k : 0.2 * k })
      face = 'focus'
      break
    }
    case 'guard': Object.assign(p, { hipsY: 0.56 + s(t * 9) * 0.025, lLx: -0.45, lRx: 0.45, aLx: -1.35, aRx: -1.0, aLz: -0.35, aRz: 0.25, torsoRX: 0.1 }); face = 'focus'; break
    case 'block': Object.assign(p, { hipsY: 0.55, lLx: -0.3, lRx: 0.5, aLx: -1.55, aRx: -1.55, aLz: -0.55, aRz: 0.55, torsoRX: -0.18, headRX: 0.1 }); face = 'wow'; break
    case 'kick': Object.assign(p, { hipsY: 0.62, lRx: -1.55, lLx: 0.2, aLx: 0.6, aRx: -1.0, aLz: 0.6, aRz: -0.5, torsoRX: -0.25 }); face = 'focus'; break
    case 'throw': {
      const k = Math.min(1, t / 0.35)
      Object.assign(p, { hipsY: 0.56, lLx: -0.45, lRx: 0.45, aLx: -0.9, aRx: 1.3 + (-1.6 - 1.3) * k, aRz: -0.25, torsoRY: 0.3 - 0.6 * k })
      face = 'focus'; prop = t < 0.3 ? 'star' : null
      break
    }
    case 'dodge': Object.assign(p, { lLx: -0.9, lRx: -0.6, aLz: 1.1, aRz: -1.1, aLx: -0.3, aRx: -0.3, torsoRX: -0.25 }); face = 'wow'; break
    case 'jump': Object.assign(p, { lLx: -1.1, lRx: -0.8, aLx: -2.6, aRx: -2.6, aLz: 0.35, aRz: -0.35, torsoRX: 0.15 }); face = 'focus'; break
    case 'bow': Object.assign(p, { torsoRX: 0.55, headRX: 0.25, aLx: -1.05, aRx: -1.05, aLz: -0.55, aRz: 0.55 }); face = 'closed'; break
    case 'meditate': Object.assign(p, SIT, { hipsY: 0.3, lLx: -1.5, lRx: -1.5, aLx: -0.55, aRx: -0.55, aLz: 0.4, aRz: -0.4, headRX: 0.08 + s(t * 0.8) * 0.02 }); face = 'closed'; break
    case 'crouch': Object.assign(p, { hipsY: 0.42, lLx: -1.0, lRx: -1.0, torsoRX: 0.45, headRX: 0.35, aLx: -0.6, aRx: -0.9 + s(t * 2) * 0.15 }); face = 'happy'; break
    case 'nap': Object.assign(p, SIT, { hipsY: 0.24, lLx: -1.6, lRx: -1.6, torsoRX: 0.85, headRX: 0.45 + s(t * 1.1) * 0.03, aLx: -1.4, aRx: -1.4, aLz: -0.2, aRz: 0.2 }); face = 'closed'; break
    case 'talk': Object.assign(p, { aLx: -0.15, aRx: -0.95 + s(t * 5) * 0.25, aRz: -0.35 + s(t * 3) * 0.1, headRY: s(t * 1.7) * 0.12, headRX: -0.05 + s(t * 4.5) * 0.04 }); face = 'happy'; break
    case 'help': Object.assign(p, { aLx: -1.1 + s(t * 15) * 0.12, aRx: -1.1 - s(t * 15) * 0.12, aLz: -0.15, aRz: 0.15, headRX: 0.2 }); face = 'focus'; break
    default: p.headRX = s(t * 1.4) * 0.03; break
  }
  return { p, face, prop }
}

/**
 * def: { name, hair, jacket, trim, pants?, style: 'spiky'|'long'|'kage'|'bun'|'messy', tips?, mask?, scale? }
 */
export function createCharacter(def) {
  const g = geos()
  if (!FACE_TEX) FACE_TEX = faceAtlas()
  const cat = def.species === 'cat'
  let fur = null
  if (cat) {
    fur = new THREE.MeshToonMaterial({ color: '#FFFFFF', map: tabbyTexture(def.fur || '#F2A65A', def.stripe || '#8A4B1F'), gradientMap: gradientMap() })
    fur.userData.outlineParameters = { thickness: 0.0045, color: [0.17, 0.106, 0.07], alpha: 1, visible: true }
  }
  const mats = {
    skin: cat ? fur : toonUnique(SKIN), hair: cat ? fur : toonUnique(def.hair), jacket: toonUnique(def.jacket),
    trim: toonUnique(def.trim), pants: toonUnique(def.pants || '#2E3446'), metal: toonUnique('#C9D2DC'),
    tips: toonUnique(def.tips || def.hair),
  }
  const base = Object.fromEntries(Object.entries(mats).map(([k, m]) => [k, m.color.clone()]))

  const root = new THREE.Group()
  const body = new THREE.Group(); root.add(body)
  const hips = new THREE.Group(); hips.position.y = 0.62; body.add(hips)
  const torso = new THREE.Group(); hips.add(torso)
  const mk = (geo, mat, o) => { const m = mesh(geo, mat, o); m.userData.agentId = def.id; return m }

  // legs
  const legs = [0.15, -0.15].map(x => {
    const pv = new THREE.Group(); pv.position.set(x, 0, 0)
    pv.add(mk(g.leg, mats.pants, { y: -0.24 }))
    pv.add(mk(g.foot, cat ? mats.skin : toon('#3A2A22'), { y: -0.52, z: 0.06, rx: Math.PI / 2 }))
    pv.add(mk(g.wrap, toon('#F4F1EA'), { y: -0.36 }))
    hips.add(pv); return pv
  })
  // torso
  torso.add(mk(g.torso, mats.jacket, { y: 0.34 }))
  torso.add(mk(g.belt, mats.trim, { y: 0.12 }))
  const tail = mk(g.tail, mats.trim, { y: 0.0, z: -0.3, x: 0.08, rx: 0.3 }); torso.add(tail)
  torso.add(mk(g.scarf, mats.trim, { y: 0.62, rx: Math.PI / 2, sx: 1.05, sy: 1.05 }))
  const scarfPv = new THREE.Group(); scarfPv.position.set(-0.1, 0.62, -0.2); scarfPv.rotation.set(0.5, 0, 0.15); torso.add(scarfPv)
  scarfPv.add(mk(g.scarfTail, mats.trim, { y: -0.24 }))
  let catTail = null
  if (cat) {
    torso.add(mk(g.bib, toon(def.muzzle || '#FFF1DC'), { y: 0.42, z: 0.14, sx: 0.95, sy: 1.1, sz: 0.55 })) // cream chest
    // kunai on the belt instead of a sword
    torso.add(mk(g.kunai, mats.metal, { x: 0.24, y: 0.04, z: 0.2, rz: Math.PI, rx: 0.2 }))
    // long striped tail: chained segments from the lower back, animated in apply()
    catTail = []
    let parent = new THREE.Group(); parent.position.set(0, 0.06, -0.24); hips.add(parent)
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Group(); parent.add(seg)
      seg.add(mk(g.tailSeg, mats.skin, { y: 0.13, sx: 1 - i * 0.06, sz: 1 - i * 0.06 }))
      catTail.push(seg)
      const next = new THREE.Group(); next.position.y = 0.24; seg.add(next); parent = next
    }
  }
  if (!def.noSword && !cat) { // ninjato on the back
    const sw = new THREE.Group(); sw.position.set(0, 0.42, -0.27); sw.rotation.z = 0.75; torso.add(sw)
    sw.add(mk(g.sword, toon('#2B2230'), {}))
    sw.add(mk(g.guardS, toon('#C9A43A'), { y: 0.32 }))
    sw.add(mk(new THREE.BoxGeometry(0.06, 0.26, 0.05), toon('#B23A48'), { y: 0.5 }))
  }
  // arms
  const arms = [0.37, -0.37].map(x => {
    const pv = new THREE.Group(); pv.position.set(x, 0.56, 0)
    pv.add(mk(g.arm, mats.jacket, { y: -0.19 }))
    const hand = mk(g.hand, mats.skin, { y: -0.42 }); pv.add(hand)
    torso.add(pv); return pv
  })
  // props in right hand
  const propHolder = new THREE.Group(); propHolder.position.set(0, -0.46, 0.06); arms[1].add(propHolder)
  const props = {
    cup: mk(g.cup, toon('#5FA36B'), { y: 0.02 }),
    scroll: (() => { const s = new THREE.Group(); s.add(mesh(g.scroll, '#C98B4F', { rz: Math.PI / 2, x: 0.26, y: 0.05 })); s.add(mesh(g.paper, toon('#FFF8EA', { outline: false }), { x: 0.26, y: 0.05, z: 0.08, rx: -0.4 })); return s })(),
    star: mk(g.star, mats.metal, { rx: Math.PI / 2 }),
  }
  for (const k in props) { props[k].visible = false; propHolder.add(props[k]) }

  // head
  const head = new THREE.Group(); head.position.y = 0.72; torso.add(head)
  const skull = new THREE.Group(); skull.position.y = 0.5; skull.scale.setScalar(1.18); head.add(skull)
  skull.add(mk(g.head, mats.skin))
  let atlas = FACE_TEX
  if (cat) { const k = def.stripe || '#8A4B1F'; if (!CAT_FACE.has(k)) CAT_FACE.set(k, catFaceAtlas(k, def.muzzle)); atlas = CAT_FACE.get(k) }
  const faceTex = atlas.clone(); faceTex.repeat.set(1 / FACES.length, 1); faceTex.needsUpdate = true
  const faceMat = new THREE.MeshToonMaterial({ map: faceTex, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 })
  faceMat.userData.outlineParameters = { visible: false }
  const face = mesh(g.face, faceMat, { rx: 0.14, shadow: false }); face.userData.agentId = def.id; skull.add(face)
  if (def.mask) skull.add(mk(g.mask, toon(def.mask, { outline: false }), { rx: 0.05 }))
  // hair (humans) / ears (cat)
  const style = cat ? 'cat' : (def.style || 'spiky')
  if (cat) {
    for (const sx of [-1, 1]) {
      skull.add(mk(g.ear, mats.skin, { x: sx * 0.3, y: 0.56, z: -0.02, rz: -sx * 0.42, ry: Math.PI / 4 }))
      skull.add(mk(g.earIn, toon('#F6B1BE', { outline: false }), { x: sx * 0.29, y: 0.55, z: 0.07, rz: -sx * 0.42, ry: Math.PI / 4 }))
    }
  } else {
    skull.add(mk(g.hairCap, mats.hair, { rx: -0.35, y: 0.02, z: -0.02 }))
    skull.add(mk(g.hairBack, mats.hair, {}))
  }
  if (style === 'spiky' || style === 'messy') {
    const n = style === 'spiky' ? 7 : 5
    for (let i = 0; i < n; i++) {
      const a = -1.2 + (i / (n - 1)) * 2.4
      const sp = mk(g.spike, i % 2 ? mats.tips : mats.hair, { x: Math.sin(a) * 0.38, y: 0.32, z: -Math.cos(a) * 0.22 - 0.05, rz: -Math.sin(a) * 1.0, rx: -0.55, sy: style === 'messy' ? 0.8 : 1 })
      skull.add(sp)
    }
    skull.add(mk(g.spike, mats.tips, { y: 0.5, z: -0.05, rx: -0.3, sy: 1.1 }))
  } else if (style === 'long') {
    skull.add(mk(new THREE.CapsuleGeometry(0.42, 0.55, 6, 14), mats.hair, { y: -0.35, z: -0.2, sz: 0.55 }))
  } else if (style === 'bun') {
    skull.add(mk(new THREE.SphereGeometry(0.2, 14, 12), mats.hair, { y: 0.52, z: -0.18 }))
  }
  // forehead protector (generic plate, no village symbol)
  skull.add(mk(g.band, toon('#2B3550'), { y: 0.14, rx: -0.1 }))
  skull.add(mk(g.plate, mats.metal, { y: 0.15, z: 0.5, rx: -0.12 }))
  // headband knot tails (sway)
  const knot = new THREE.Group(); knot.position.set(0, 0.16, -0.5); skull.add(knot)
  const tails = [-1, 1].map(sx => { const pv = new THREE.Group(); pv.rotation.set(0.5, 0, sx * 0.35); pv.add(mk(g.ribbon, toon('#2B3550'), { y: -0.2 })); knot.add(pv); return pv })
  if (style === 'kage') {
    const hat = new THREE.Group(); hat.position.set(0, 0.5, 0); hat.rotation.x = -0.12
    hat.add(mk(g.hat, toon('#F4F1EA'), { y: 0.1 }))
    hat.add(mk(g.hatBand, mats.trim, { y: -0.04 }))
    skull.add(hat)
  }

  // selection ring
  const sel = mesh(g.ring, new THREE.MeshBasicMaterial({ color: '#FFD28A' }), { rx: Math.PI / 2, y: 0.03, shadow: false })
  sel.material.userData.outlineParameters = { visible: false }
  sel.visible = false; root.add(sel)

  const cur = { ...DEF_POSE }
  let curFace = -1, dim = 0, swayT = 0

  function setFace(name) {
    const i = Math.max(0, FACES.indexOf(name))
    if (i !== curFace) { faceTex.offset.x = i / FACES.length; curFace = i }
  }

  function apply(pose, poseT, dt, snap = false) {
    const { p, face: fname, prop } = poseTargets(pose, poseT)
    const k = snap ? 1 : 1 - Math.exp(-dt * 16)
    for (const key in p) cur[key] += (p[key] - cur[key]) * k
    hips.position.y = cur.hipsY
    torso.rotation.set(cur.torsoRX, cur.torsoRY, cur.torsoRZ)
    head.rotation.set(cur.headRX, cur.headRY, cur.headRZ)
    arms[0].rotation.set(cur.aLx, cur.aLy, cur.aLz)
    arms[1].rotation.set(cur.aRx, cur.aRy, cur.aRz)
    legs[0].rotation.set(cur.lLx, 0, cur.lLz)
    legs[1].rotation.set(cur.lRx, 0, cur.lRz)
    const sway = Math.sin(swayT += dt * (pose === 'run' || pose === 'walk' ? 9 : 3)) 
    const flow = pose === 'run' || pose === 'jump' || pose === 'dodge' ? 1.25 : pose === 'walk' ? 0.85 : 0.45
    tails[0].rotation.x = flow + sway * 0.12; tails[1].rotation.x = flow + Math.sin(swayT + 1.3) * 0.12
    scarfPv.rotation.x = flow * 0.9 + Math.sin(swayT + 0.6) * 0.1
    if (catTail) { // up-curved tail: sways idle, streams back when running, curls when seated, puffs in a fight
      const seated = ['sit', 'type', 'think', 'raise', 'dizzy', 'thumbs', 'sleep', 'offline', 'sitfloor', 'meditate', 'nap', 'crouch'].includes(pose)
      const fight = ['guard', 'block', 'punch', 'kick', 'throw', 'dodge', 'jump'].includes(pose)
      catTail.forEach((seg, i) => {
        const w = Math.sin(swayT * 0.9 - i * 0.7) * (fight ? 0.08 : 0.16)
        if (seated) seg.rotation.set(i === 0 ? -1.35 : -0.15, 0, (i === 0 ? 0.9 : 0.42) + w * 0.3)
        else if (pose === 'run') seg.rotation.set(i === 0 ? -1.15 : -0.12, 0, w)
        else seg.rotation.set(i === 0 ? -0.75 : 0.3 - i * 0.02, 0, w)
        seg.scale.setScalar(fight ? 1.18 : 1)
      })
    }
    setFace(fname)
    for (const kk in props) props[kk].visible = kk === prop
  }

  function setDim(target) { // 0 = full color, 1 = grey (offline / unknown)
    if (Math.abs(target - dim) < 0.01) return
    dim = target
    const grey = new THREE.Color('#8D939E')
    for (const k in mats) mats[k].color.copy(base[k]).lerp(grey, dim * 0.85)
  }

  if (def.scale) root.scale.setScalar(def.scale)
  root.userData.agentId = def.id
  return { root, apply, setDim, sel, def }
}

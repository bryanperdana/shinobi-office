// Shinobi HQ 3D scene: wires brain (logic) → three.js (render) + DOM overlay.
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js'
import { createBrain, STATUS_LABEL } from './brain.js'
import { conversation } from './talk.js'
import { createCharacter } from './character.js'
import { buildDesk, STATUS_COLOR } from './room.js'
import { buildWorld } from './rooms3d.js'
import { VIEWS, WORLD, RING, FLOOR2, toWorld, stairPoint } from './world.js'
import { buildHq2f } from './hq2f.js'
import { buildVillage } from './village.js'
import { bakeStatic } from './bake.js'
import { ROOM } from './layout.js'
const ROOM_MINZ = ROOM.minZ
import { toon, mesh } from './toon.js'

const BUBBLE = { thinking: '…', working: '</>', approval: '!', error: '×', done: '✓', stale: '?', sleep: 'zZ' }

const OVERLAY_CSS = `.sho-tag{position:absolute;left:0;top:0;pointer-events:auto;background:none;border:0;padding:0;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;font:inherit;will-change:transform}
.sho-name{display:inline-flex;align-items:center;gap:5px;background:#FFF8EAee;color:#2B1B12;border:2px solid #2B1B12;border-radius:999px;padding:2px 8px 2px 6px;font-size:11px;white-space:nowrap;box-shadow:0 2px 0 #2B1B12}
.sho-name b{font-weight:900}.sho-name em{font-style:normal;font-weight:700;color:#7A4A2A;font-size:10px}
.sho-dot{width:8px;height:8px;border-radius:50%;display:inline-block;border:1.5px solid #2B1B12}
.sho-bub{min-width:26px;height:24px;padding:0 6px;display:grid;place-items:center;background:#fff;color:var(--c);border:2px solid #2B1B12;border-radius:12px;font-weight:900;font-size:13px;box-shadow:0 2px 0 #2B1B12}
.sho-tag.on .sho-name{background:#FFD28A}
.sho-say{position:relative;max-width:220px;width:max-content;white-space:normal;text-align:left;background:#fff;color:#2B1B12;border:2px solid #2B1B12;border-radius:12px;padding:4px 9px;font:600 11px/1.35 inherit;box-shadow:0 2px 0 #2B1B12;margin-bottom:4px}
.sho-say::after{content:'';position:absolute;left:50%;bottom:-7px;margin-left:-6px;border:6px solid transparent;border-top-color:#2B1B12;border-bottom:0}
.sho-gong{position:absolute;left:0;top:0;pointer-events:auto;cursor:pointer;min-width:26px;height:26px;padding:0 7px;border-radius:13px;border:2px solid #2B1B12;background:#F59E0B;color:#2B1B12;font:900 13px/22px inherit;box-shadow:0 2px 0 #2B1B12}
.sho-mission{position:absolute;left:0;top:0;pointer-events:auto;cursor:pointer;padding:2px 9px;border-radius:999px;border:2px solid #2B1B12;background:#FFF8EAee;color:#2B1B12;font:800 11px/16px inherit;box-shadow:0 2px 0 #2B1B12}.sho-tag:focus-visible{outline:2px solid #FFD28A;outline-offset:3px;border-radius:12px}`

export function createOffice(container, { agents, seed = 7, night = false, reducedMotion = false, onSelect, onBoard, qa = false, maxFps = 30, blurFps = 8, facts = null, chatLevel = 1, screenInfo = null, onFocusChange = null, onScene = null, quality = 'auto', onQuality = null, owner = 'Boss', timeZone = 'Asia/Jakarta' } = {}) {
  const wibHour = () => { try { return Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone }).format(new Date())) % 24 } catch { return new Date().getHours() } }
  const nameOf = id => agents.find(a => a.id === id)?.name || id
  // conversation lines come from the curated bank (talk.js) + safe aggregate facts supplied by the page
  const chatScript = (a, b, rnd) => {
    const h = wibHour()
    const f = { hour: h, night: h >= 18 || h < 6, ...(facts ? facts() : {}) }
    if (f.lastDone) f.lastDone = nameOf(f.lastDone)
    return conversation(a, b, { ...f, owner }, rnd, voices)
  }
  const voices = Object.fromEntries(agents.map(a => [a.id, a.voice || (a.id === 'hermes' ? 'kage' : 'generic')]))
  const brain = createBrain({ agents, seed, calm: reducedMotion, chatScript, chatLevel, owner })
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: qa, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.domElement.style.display = 'block'
  container.style.position = container.style.position || 'relative'
  container.appendChild(renderer.domElement)
  const outline = new OutlineEffect(renderer, { defaultThickness: 0.0045, defaultColor: [0.17, 0.106, 0.07] })

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.3, 420)
  camera.position.set(8.8, 16.4, 23)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(-0.6, 0.6, -0.8)
  controls.enableDamping = true
  // full 360° orbit (walls between camera and room fade out — see cutaway below)
  controls.minDistance = 1.2; controls.maxDistance = 140
  controls.minPolarAngle = 0.12; controls.maxPolarAngle = 1.47
  controls.enablePan = true; controls.screenSpacePanning = false
  controls.update()

  const hemi = new THREE.HemisphereLight('#FFF4DE', '#8C6A4A', 1.4); scene.add(hemi)
  const sun = new THREE.DirectionalLight('#FFF1D0', 2.2)
  const WC = { x: (WORLD.minX + WORLD.maxX) / 2, z: (WORLD.minZ + WORLD.maxZ) / 2 }
  sun.position.set(WC.x + 10, 24, WC.z + 14); sun.target.position.set(WC.x, 0, WC.z); scene.add(sun.target); sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 26, bottom: -26, near: 1, far: 80 })
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03
  scene.add(sun)

  const room = buildWorld(scene)
  const hq2f = buildHq2f(scene)
  // countryside: 'auto' starts high and drops to 'eco' if the measured frame rate stays low
  let qualityMode = quality
  const village = buildVillage(scene, { quality: quality === 'eco' ? 'eco' : 'high' })
  const extras = onScene ? onScene(scene) || {} : {}
  const deskViews = brain.agents.map((a, i) => {
    const d = buildDesk(a.desk, agents[i], scene)
    const w = toWorld(a.desk.x, a.desk.z); d.group.position.set(w.x, w.y, w.z); d.floor = w.floor
    return d
  })
  /** nav-space entity (agent / genin) → 3D position incl. stair climbing + jump height */
  function wpos(e) {
    const p = e.stair ? stairPoint(e.stair.up ? e.stair.u : 1 - e.stair.u) : toWorld(e.x, e.z)
    return { x: p.x, y: p.y + (e.y || 0), z: p.z, floor: p.floor }
  }
  // floors: 'both' (default) · 'f1' (floor 2 hidden, look down into the team room)
  let floorMode = 'both'
  const floorHidden = f => floorMode === 'f1' && f === 2
  function applyFloorMode() {
    const on = floorMode !== 'f1'
    hq2f.setFloor2Visible(on); room.missionBoard.visible = on; room.gong.visible = on
    deskViews.forEach(d => { if (d.floor === 2) d.group.visible = on })
  }
  const chars = brain.agents.map((a, i) => { const c = createCharacter({ ...agents[i], id: a.id }); scene.add(c.root); return c })

  // overlay (nameplates/bubbles) — DOM for crisp text + a11y
  const overlay = document.createElement('div')
  overlay.className = 'sho-overlay'
  Object.assign(overlay.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden' })
  container.appendChild(overlay)
  const css = document.createElement('style'); css.textContent = OVERLAY_CSS; overlay.appendChild(css)
  const tags = brain.agents.map((a, i) => {
    const el = document.createElement('button')
    el.className = 'sho-tag'
    el.type = 'button'
    el.setAttribute('aria-label', `${agents[i].name}`)
    el.innerHTML = '<span class="sho-say" style="display:none"></span><span class="sho-bub"></span><span class="sho-name"><i class="sho-dot"></i><b></b><em></em></span>'
    el.querySelector('b').textContent = agents[i].name // profile-provided text: never innerHTML
    el.addEventListener('click', () => select(a.id))
    overlay.appendChild(el)
    return { el, say: el.querySelector('.sho-say'), bub: el.querySelector('.sho-bub'), dot: el.querySelector('.sho-dot'), em: el.querySelector('em'), last: '' }
  })

  const gongBadge = document.createElement('button')
  gongBadge.type = 'button'; gongBadge.className = 'sho-gong'; gongBadge.style.display = 'none'
  gongBadge.setAttribute('aria-label', 'Agent yang menunggu kamu')
  overlay.appendChild(gongBadge)
  gongBadge.addEventListener('click', () => { const a = brain.agents.find(x => x.status === 'approval'); if (a) select(a.id) })
  const missionTag = document.createElement('button')
  missionTag.type = 'button'; missionTag.className = 'sho-mission'; missionTag.textContent = 'Mission Board'
  overlay.appendChild(missionTag)
  missionTag.addEventListener('click', () => onBoard?.())

  // genin pool
  const geninViews = new Map()
  const GENIN_DEF = { name: 'genin', hair: '#3B3B4F', jacket: '#4B5563', trim: '#9CA3AF', style: 'messy', mask: '#374151', scale: 0.72 }

  // fx
  const fxViews = new Map()
  const sparkGeo = new THREE.IcosahedronGeometry(0.5, 0)
  const puffGeo = new THREE.SphereGeometry(0.5, 12, 10)
  const starGeo = (() => { const s = new THREE.Shape(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 0.06 : 0.2; const a = (i / 8) * Math.PI * 2; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(r, 0) } return new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false }) })()
  function makeFx(f) {
    let o
    if (f.type === 'puff') {
      o = new THREE.Group()
      for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(puffGeo, new THREE.MeshToonMaterial({ color: '#F3F4F6', transparent: true })); m.material.userData.outlineParameters = { thickness: 0.003, color: [0.4, 0.4, 0.45], alpha: 1 }; const a = (i / 6) * Math.PI * 2; m.userData.dir = new THREE.Vector3(Math.cos(a), (i % 3) * 0.3, Math.sin(a)); o.add(m) }
    } else if (f.type === 'spark') {
      o = new THREE.Group()
      for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: i % 2 ? '#FFE066' : '#FFFFFF', transparent: true })); m.material.userData.outlineParameters = { visible: false }; const a = (i / 7) * Math.PI * 2; m.userData.dir = new THREE.Vector3(Math.cos(a), Math.sin(a) * 0.8 + 0.3, Math.sin(a * 1.7) * 0.5); o.add(m) }
    } else if (f.type === 'shuriken') {
      o = new THREE.Mesh(starGeo, toon('#C9D2DC'))
    }
    { const w = toWorld(f.x, f.z); f.x = w.x; f.z = w.z; f.y += w.y; if (f.tz != null) { const tw = toWorld(f.tx, f.tz); f.tx = tw.x; f.tz = tw.z } }
    o.position.set(f.x, f.y, f.z); scene.add(o)
    return o
  }
  function updateFx(now) {
    const live = new Set()
    for (const f of brain.fx) {
      const age = now - f.t
      const life = f.type === 'shuriken' ? f.dur : f.type === 'spark' ? 0.45 : 0.6
      if (age > life) continue
      live.add(f.id)
      let o = fxViews.get(f.id)
      if (!o) { o = makeFx(f); fxViews.set(f.id, o) }
      const k = age / life
      if (f.type === 'puff') {
        const s = (f.small ? 0.35 : 0.55) * (0.6 + k)
        o.children.forEach(m => { m.position.copy(m.userData.dir).multiplyScalar(k * (f.small ? 0.5 : 0.8)); m.scale.setScalar(s); m.material.opacity = 1 - k })
      } else if (f.type === 'spark') {
        o.children.forEach(m => { m.position.copy(m.userData.dir).multiplyScalar(k * 0.9 * (f.size || 1)); m.scale.setScalar(0.18 * (1 - k) * (f.size || 1)); m.material.opacity = 1 - k })
      } else if (f.type === 'shuriken') {
        o.position.set(f.x + (f.tx - f.x) * k, f.y + Math.sin(k * Math.PI) * 0.3, f.z + (f.tz - f.z) * k)
        o.rotation.set(Math.PI / 2, 0, age * 30)
      }
    }
    for (const [id, o] of fxViews) if (!live.has(id)) { scene.remove(o); fxViews.delete(id) }
  }

  // selection
  let selected = null
  function select(id) {
    selected = id
    chars.forEach((c, i) => { c.sel.visible = brain.agents[i].id === id })
    tags.forEach((t, i) => t.el.classList.toggle('on', brain.agents[i].id === id))
    onSelect?.(id ? snapshotOf(id) : null)
  }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
  let downAt = null
  renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY] })
  renderer.domElement.addEventListener('pointerup', e => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return
    const r = renderer.domElement.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    const lapHit = ray.intersectObjects(deskViews.map(d => d.laptop), true)[0]
    const charHit = ray.intersectObjects(chars.map(c => c.root), true).find(h => h.object.userData.agentId)
    if (lapHit && (!charHit || lapHit.distance < charHit.distance)) { const id = lapHit.object.userData.screenOf; select(id); focusScreen(id); return }
    const hit = charHit
    if (!hit && onBoard && ray.intersectObject(room.missionBoard, true).length) { onBoard(); return }
    select(hit ? hit.object.userData.agentId : null)
  })

  function snapshotOf(id) {
    const a = brain.byId(id)
    if (!a) return null
    return { id, status: a.status, statusLabel: STATUS_LABEL[a.status], label: brain.labelFor(a), activity: a.activity, location: brain.locationOf(a).name, color: STATUS_COLOR[a.status] }
  }

  // resize
  function resize() {
    const w = container.clientWidth || 800, h = container.clientHeight || 450
    renderer.setSize(w, h, false)
    renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px'
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(resize); ro.observe(container); resize()

  // night/day
  function setNight(on) {
    night = on
    room.setNight(on); village.setNight(on)
    scene.background = new THREE.Color(on ? '#1B2140' : '#9ED3F2')
    hemi.intensity = on ? 0.55 : 1.4
    hemi.color.set(on ? '#9AA8FF' : '#FFF4DE')
    sun.intensity = on ? 0.45 : 2.2
    sun.color.set(on ? '#8FA2FF' : '#FFF1D0')
  }
  setNight(night)

  // per-frame sync
  const v = new THREE.Vector3()
  let simTime = 0, gongSwing = 0
  let lastScreenAt = -1
  const clockWIB = () => { try { return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(new Date()) } catch { return '' } }
  function updateScreen(i, a) {
    const extra = screenInfo ? (screenInfo(a.id) || {}) : {}
    deskViews[i].setScreen({ owner, name: agents[i].name, status: a.status, label: STATUS_LABEL[a.status] || a.status, color: STATUS_COLOR[a.status], clock: clockWIB(),
      tool: extra.tool ?? null, since: extra.since ?? null, missions: extra.missions ?? null, genin: extra.genin ?? 0 })
  }
  function sync(dt, snap = false) {
    brain.agents.forEach((a, i) => {
      const c = chars[i]
      const p = wpos(a)
      c.root.position.set(p.x, p.y, p.z)
      c.root.rotation.y = a.face
      c.root.visible = a.visible && !floorHidden(p.floor)
      c.apply(a.pose, reducedMotion ? 0.3 : a.poseT, dt, snap)
      c.setDim(a.status === 'offline' || a.status === 'unknown' ? 1 : 0)
      deskViews[i].setStatus(a.status, reducedMotion ? 0 : simTime)
      if (snap || simTime - lastScreenAt > 0.5) updateScreen(i, a)
    })
    for (const g of brain.genin) {
      let view = geninViews.get(g.id)
      if (!view) { view = createCharacter({ ...GENIN_DEF, id: g.id }); scene.add(view.root); geninViews.set(g.id, view) }
      const gp = wpos(g)
      view.root.position.set(gp.x, gp.y, gp.z); view.root.rotation.y = g.face
      view.apply(g.state === 'walk' ? 'walk' : 'help', g.poseT, dt, snap)
      view.root.visible = g.state !== 'poof' && !floorHidden(gp.floor)
    }
    for (const [id, view] of geninViews) if (!brain.genin.find(g => g.id === id)) { scene.remove(view.root); geninViews.delete(id) }
    const approvals = brain.agents.filter(a => a.status === 'approval').length
    gongSwing = approvals && !reducedMotion ? Math.sin(simTime * 5) * 0.08 : 0
    room.gongDisc.rotation.z = gongSwing
    updateFx(brain.time)
    if (snap || simTime - lastScreenAt > 0.5) lastScreenAt = simTime
    updateCutaway()
  }

  function positionOverlay() {
    const w = container.clientWidth, h = container.clientHeight
    const placed = []
    brain.agents.forEach((a, i) => {
      const t = tags[i]
      const sitting = a.act.type === 'desk'
      const ap = wpos(a)
      v.set(ap.x, ap.y + (sitting ? 2.3 : 2.75), ap.z).project(camera)
      let x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h
      const tw = t.el.offsetWidth || 120, th = t.el.offsetHeight || 26
      x = Math.max(tw / 2 + 4, Math.min(w - tw / 2 - 4, x))
      y = Math.max(th + 4, y)
      // de-overlap: first free slot among y, y-28, y+28, y-56, … that stays inside the stage
      const collides = yy => placed.some(p => Math.abs(p.x - x) < (p.w + tw) / 2 + 4 && Math.abs(p.y - yy) < Math.min(p.h, th) * 0.5 + 12)
      const y0 = y
      for (let k = 0; k <= 12; k++) {
        const yy = y0 + (k === 0 ? 0 : (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 28)
        if (yy < th + 4 || yy > h - 2) continue
        if (!collides(yy)) { y = yy; break }
      }
      placed.push({ x, y, w: tw, h: Math.min(th, 26) })
      t.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`
      // agents in another room (off-screen) get no tag — never pin it to the stage edge
      const onScreen = v.z < 1 && Math.abs(v.x) <= 1.04 && v.y >= -1.04 && v.y <= 1.25
      // floor-2 view: only floor-2 tags (floor-1 agents sit under the slab)
      t.el.style.display = onScreen && a.visible && !floorHidden(ap.floor) && !(viewName === 'floor2' && ap.floor === 1) ? '' : 'none'
      const glyph = a.bubble || (sitting || a.status !== 'idle' ? BUBBLE[a.status] : null) || ''
      const label = brain.labelFor(a)
      const line = a.line || ''
      const key = glyph + '|' + label + '|' + a.status + '|' + line
      if (key !== t.last) {
        t.last = key
        t.say.textContent = line
        t.say.style.display = line ? '' : 'none'
        t.bub.textContent = glyph
        t.bub.style.display = glyph ? '' : 'none'
        t.bub.style.setProperty('--c', STATUS_COLOR[a.status])
        t.dot.style.background = STATUS_COLOR[a.status]
        t.em.textContent = label
        t.el.setAttribute('aria-label', `${agents[i].name}: ${label}`)
      }
    })
    // gong badge (approval count) + mission board label, projected from world space
    const approvals = brain.agents.filter(a => a.status === 'approval').length
    v.set(11, 4.1 + FLOOR2.y, ROOM_MINZ + 0.6).project(camera)
    gongBadge.style.display = approvals && v.z < 1 ? '' : 'none' // stays visible in 'f1' too: approvals matter most
    gongBadge.textContent = `! ${approvals}`
    const clampX = (x, half) => Math.max(half + 6, Math.min(w - half - 6, x))
    const gx = clampX((v.x * 0.5 + 0.5) * w, (gongBadge.offsetWidth || 40) / 2), gy = Math.max((gongBadge.offsetHeight || 26) + 6, (-v.y * 0.5 + 0.5) * h)
    gongBadge.style.transform = `translate(${gx.toFixed(1)}px, ${gy.toFixed(1)}px) translate(-50%, -100%)`
    v.set(-3.5, 4.75 + FLOOR2.y, ROOM_MINZ + 0.3).project(camera)
    missionTag.style.display = onBoard && v.z < 1 && floorMode !== 'f1' && ['overview', 'hq', 'kage', 'floor2'].includes(viewName) ? '' : 'none'
    const mx = clampX((v.x * 0.5 + 0.5) * w, (missionTag.offsetWidth || 100) / 2), my = Math.max((missionTag.offsetHeight || 20) + 6, (-v.y * 0.5 + 0.5) * h)
    missionTag.style.transform = `translate(${mx.toFixed(1)}px, ${my.toFixed(1)}px) translate(-50%, -100%)`
    if (selected) onSelect?.(snapshotOf(selected), true)
  }

  function render() { outline.render(scene, camera) }

  // loop with pause when hidden/offscreen
  let raf = 0, last = 0, running = false, visible = true
  const io = new IntersectionObserver(es => { visible = es[0]?.isIntersecting ?? true; kick() })
  io.observe(container)
  const onVis = () => kick()
  document.addEventListener('visibilitychange', onVis)
  // frame budget: cap fps (30 default, 8 when the app window is in the background) — CPU/GPU idle budget
  let lastDraw = 0, frameCount = 0
  function frame(now) {
    raf = 0
    if (!running || document.hidden || !visible) { last = 0; return }
    const fps = typeof document.hasFocus === 'function' && !document.hasFocus() ? blurFps : maxFps
    if (lastDraw && now - lastDraw < 1000 / fps - 2) { raf = requestAnimationFrame(frame); return }
    lastDraw = now
    const dt = Math.min(0.25, last ? (now - last) / 1000 : 1 / 60)
    last = now
    simTime += dt; frameCount++
    for (let r = dt; r > 1e-6; r -= 0.05) brain.step(Math.min(0.05, r)) // sub-step: same sim speed at low fps
    room.update(simTime); village.update(simTime); updateFollow(dt); updateTween(dt)
    sync(dt)
    controls.update()
    positionOverlay()
    const t0 = performance.now()
    render()
    perfSample(now, performance.now() - t0, fps)
    raf = requestAnimationFrame(frame)
  }
  // auto quality: if the achieved frame rate stays < 60% of the cap for ~6 s (while focused + visible), go 'eco'
  let perfWin = { t0: 0, n: 0 }
  function perfSample(now, renderMs, fps) {
    if (qualityMode !== 'auto' || village.quality === 'eco' || fps !== maxFps) { perfWin = { t0: 0, n: 0 }; return }
    if (!perfWin.t0) { perfWin = { t0: now, n: 0 }; return }
    perfWin.n++
    const secs = (now - perfWin.t0) / 1000
    if (secs >= 6) {
      if (perfWin.n / secs < maxFps * 0.6) { village.setQuality('eco'); onQuality?.('eco', Math.round(perfWin.n / secs)) }
      perfWin = { t0: 0, n: 0 }
    }
  }
  function setQuality(mode) { qualityMode = mode; village.setQuality(mode === 'eco' ? 'eco' : 'high'); perfWin = { t0: 0, n: 0 } }
  function kick() { if (running && !raf && !document.hidden && visible) raf = requestAnimationFrame(frame) }
  function start() { running = true; kick() }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0 }

  /** Deterministic advance for QA/screenshots (no rAF). */
  function advance(secs, dt = 1 / 30) {
    for (let t = 0; t < secs; t += dt) { simTime += dt; brain.step(dt); sync(dt); updateFollow(dt); updateTween(dt) }
    room.update(simTime); village.update(simTime)
    sync(0, true); controls.update(); positionOverlay(); render()
  }

  // camera views: tuned HQ shots + fitted framing for every room / the whole village
  let viewName = 'overview', followId = null
  const VIEW_DIR = new THREE.Vector3(0.31, 0.52, 0.79).normalize()
  /** Frame a floor rect: numerically grow the distance until every corner (floor + 2.5 m) is on screen,
   *  then re-centre the target on the projected bounds. */
  function fit(rect) {
    const y0 = rect.y || 0
    const t = new THREE.Vector3((rect.minX + rect.maxX) / 2, y0 + 0.6, (rect.minZ + rect.maxZ) / 2)
    const pts = []
    for (const x of [rect.minX, rect.maxX]) for (const z of [rect.minZ, rect.maxZ]) for (const y of [y0, y0 + (rect.h || 2.5)]) pts.push(new THREE.Vector3(x, y, z))
    const cam = camera.clone(), p = new THREE.Vector3()
    const bounds = () => { cam.updateMatrixWorld(); let x0 = 9, x1 = -9, y0 = 9, y1 = -9; for (const q of pts) { p.copy(q).project(cam); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y) } return { x0, x1, y0, y1 } }
    let d = 8, b
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < 80; i++) {
        cam.position.copy(t).addScaledVector(VIEW_DIR, d); cam.lookAt(t)
        b = bounds()
        if (b.x0 > -0.94 && b.x1 < 0.94 && b.y0 > -0.92 && b.y1 < 0.9) break
        d *= 1.05
      }
      // re-centre: move the target by the projected bounds' centre offset (in world units along the floor)
      const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).setY(0).normalize()
      const fwd = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1).setY(0).normalize()
      const k = d * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
      t.addScaledVector(right, cx * k * cam.aspect).addScaledVector(fwd, cy * k * 1.4)
      d = Math.max(8, d * 0.9)
    }
    return [cam.position.toArray(), t.toArray()]
  }
  // ---- cutaway: wall-side meshes fade when the camera is behind that wall (360° orbit)
  const cut = [] // { mesh, mat, band }
  const BANDS = [
    { test: p => p.z < -8.2, behind: c => c.z < -8.6 }, // back walls (HQ + Dojo)
    { test: p => p.x < -13.0 && p.z < 9, behind: c => c.x < -13.6 }, // HQ left wall
    { test: p => p.x < -13.0 && p.z > 11, behind: c => c.x < -13.6 }, // Library left wall
  ]
  {
    const wp = new THREE.Vector3()
    scene.updateMatrixWorld(true)
    room.root.traverse(o => classify(o)); room.worldRoot?.traverse(o => classify(o)); hq2f.floor2.traverse(o => classify(o))
    function classify(o) {
      if (!o.isMesh || !o.material || Array.isArray(o.material)) return
      o.getWorldPosition(wp)
      if (wp.y < 0.25 && o.geometry?.type === 'PlaneGeometry') return // floors never fade
      const band = BANDS.findIndex(b => b.test(wp))
      if (band < 0) return
      const mat = o.material.clone(); mat.userData = { ...o.material.userData, outlineParameters: { ...(o.material.userData.outlineParameters || {}) } }
      o.material = mat
      cut.push({ mesh: o, mat, band, faded: false, outline: mat.userData.outlineParameters.visible !== false, tr0: mat.transparent, op0: mat.opacity })
    }
  }
  // bake everything static in the compound that the cutaway / board / gong don't need individually
  {
    const exclude = new Set([...cut.map(e => e.mesh), room.missionBoard, room.gong])
    bakeStatic(room.root, { exclude })
    if (room.worldRoot && room.worldRoot !== room.root) bakeStatic(room.worldRoot, { exclude })
    bakeStatic(hq2f.stair, {})
  }
  function updateCutaway() {
    hq2f.roof.visible = floorMode === 'both' && camera.position.distanceTo(controls.target) > 95 && camera.position.length() > 90
    hq2f.setSlabFade(floorMode === 'both' && controls.getPolarAngle() < 0.72) // steep look-down: see-through floor 2 slab
    const c = camera.position
    const behind = BANDS.map(b => b.behind(c))
    for (const e of cut) {
      const f = behind[e.band]
      if (f === e.faded) continue
      e.faded = f
      e.mat.transparent = f || e.tr0
      e.mat.opacity = f ? 0.12 * e.op0 : e.op0
      e.mat.depthWrite = !f
      e.mat.userData.outlineParameters.visible = f ? false : e.outline
      e.mat.needsUpdate = true
    }
  }

  // ---- focus on a laptop screen: over-the-shoulder camera, smooth transition, Esc/back restores
  let focus = null // { id, from: [pos, target] }
  let tween = null
  function flyTo(pos, target, secs = 0.7) {
    tween = { t: 0, secs, p0: camera.position.clone(), t0: controls.target.clone(), p1: new THREE.Vector3(...pos), t1: new THREE.Vector3(...target) }
  }
  function updateTween(dt) {
    if (!tween) return
    tween.t = Math.min(1, tween.t + dt / tween.secs)
    const k = tween.t * tween.t * (3 - 2 * tween.t)
    camera.position.lerpVectors(tween.p0, tween.p1, k); controls.target.lerpVectors(tween.t0, tween.t1, k)
    if (tween.t >= 1) tween = null
  }
  let ghosted = null // { i, saved: [[mesh, material]] }
  function ghost(i) {
    unghost()
    const saved = []
    chars[i].root.traverse(o => {
      if (!o.isMesh || !o.material || Array.isArray(o.material)) return
      const m = o.material.clone(); m.transparent = true; m.opacity = 0.22 * (o.material.opacity ?? 1); m.depthWrite = false
      m.userData = { ...o.material.userData, outlineParameters: { visible: false } }
      saved.push([o, o.material]); o.material = m
    })
    ghosted = { i, saved }
  }
  function unghost() {
    if (!ghosted) return
    for (const [o, m] of ghosted.saved) { o.material.dispose(); o.material = m }
    ghosted = null
  }
  function focusScreen(id) {
    const i = brain.agents.findIndex(a => a.id === id)
    if (i < 0) return false
    const a = brain.agents[i]; updateScreen(i, a)
    const { p: s, n } = deskViews[i].screenAnchor()
    if (!focus) focus = { id, from: [camera.position.toArray(), controls.target.toArray()] }
    else focus.id = id
    followId = null
    // over-the-shoulder: along the screen normal (towards the seated agent), offset sideways + above the head
    const side = new THREE.Vector3(-n.z, 0, n.x).normalize()
    const cam = s.clone().addScaledVector(n, 1.55).addScaledVector(side, 0.45).add(new THREE.Vector3(0, 0.5, 0))
    flyTo(cam.toArray(), [s.x, s.y - 0.03, s.z])
    ghost(i)
    focus.dbg = { s: s.toArray().map(v => +v.toFixed(2)), n: n.toArray().map(v => +v.toFixed(2)), agent: [+a.x.toFixed(2), +a.z.toFixed(2)] }
    onFocusChange?.(id)
    return true
  }
  function exitFocus() {
    if (!focus) return
    const f = focus.from; focus = null; unghost()
    flyTo(f[0], f[1], 0.6)
    onFocusChange?.(null)
  }
  const onKey = e => { if (e.key === 'Escape' && focus) exitFocus() }
  window.addEventListener('keydown', onKey)

  function setView(name) {
    const fixed = {
      // both floors: frame the HQ incl. floor-2 walls (y up to ~9)
      overview: fit({ minX: -14, maxX: 14, minZ: -9, maxZ: 9, h: 9 }),
      hq: fit({ minX: -14, maxX: 14, minZ: -9, maxZ: 9, h: 9 }),
      ring: [[RING.x + 7.3, 7.5, RING.z + 10.1], [RING.x, 1.0, RING.z - 0.4]],
      kage: [[3.5, 7.5 + FLOOR2.y, 6], [0, 1.2 + FLOOR2.y, -5.4]],
      country: [[62, 46, 92], [8, 2, 8]], // the countryside: paddies, torii, river, minka, mountains
    }
    const v = fixed[name] || (VIEWS[name] ? fit(VIEWS[name]) : fixed.overview)
    viewName = fixed[name] || VIEWS[name] ? name : 'overview'
    followId = null; focus = null; tween = null; unghost()
    floorMode = name === 'floor1' ? 'f1' : 'both'; applyFloorMode()
    camera.position.set(...v[0]); controls.target.set(...v[1]); controls.update()
  }
  /** Keep the camera on one agent (stops when the user drags or picks another view). */
  function follow(id) { followId = id && brain.byId(id) ? id : null }
  controls.addEventListener('start', () => { followId = null; tween = null })
  const followTmp = new THREE.Vector3()
  function updateFollow(dt) {
    if (!followId) return
    const a = brain.byId(followId); if (!a) { followId = null; return }
    const fp = wpos(a)
    followTmp.set(fp.x, fp.y + 0.9, fp.z).sub(controls.target).multiplyScalar(Math.min(1, dt * 4))
    controls.target.add(followTmp); camera.position.add(followTmp)
  }

  function dispose() {
    stop(); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('keydown', onKey)
    controls.dispose()
    scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(mm => { mm.map?.dispose?.(); mm.dispose?.() }) })
    renderer.dispose(); renderer.domElement.remove(); overlay.remove()
  }

  setTimeout(() => { sync(0, true); positionOverlay(); render() }, 0)

  return {
    brain, start, stop, advance, setNight, setView, select, dispose, render,
    setStatus: (id, s) => brain.setStatus(id, s),
    follow, get view() { return viewName }, get following() { return followId },
    lookAt(pos, target) { followId = null; tween = null; camera.position.set(...pos); controls.target.set(...target); controls.update(); sync(0, true); render() },
    extras, village, setQuality, get quality() { return { mode: qualityMode, active: village.quality } }, focusScreen, exitFocus, get floorMode() { return floorMode }, wpos: id => { const a = brain.byId(id); return a ? wpos(a) : null }, get focused() { return focus?.id || null }, get focusDebug() { return focus?.dbg || null }, cutawayCount: () => cut.filter(e => e.faded).length,
    setChatLevel: v => brain.setChatLevel(v),
    locationOf: id => { const a = brain.byId(id); return a ? brain.locationOf(a) : null },
    setMissions: items => room.setMissions(items),
    force: (...a) => brain.force(...a),
    spawnGenin: (p, l) => brain.spawnGenin(p, l),
    completeGenin: id => brain.completeGenin(id),
    frames: () => frameCount,
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }),
    camera, scene, renderer, room,
  }
}

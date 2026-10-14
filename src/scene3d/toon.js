// Toon materials + canvas textures. All art is procedural and original.
import * as THREE from 'three'

export const INK = '#2B1B12'

let _grad
export function gradientMap() {
  if (_grad) return _grad
  const data = new Uint8Array([110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255])
  _grad = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat)
  _grad.minFilter = _grad.magFilter = THREE.NearestFilter
  _grad.generateMipmaps = false
  _grad.needsUpdate = true
  return _grad
}

const cache = new Map()
/** Shared toon material per color (do NOT mutate — use toonUnique for per-instance tint). */
export function toon(color, opts = {}) {
  const key = color + JSON.stringify(opts)
  if (!cache.has(key)) cache.set(key, toonUnique(color, opts))
  return cache.get(key)
}
export function toonUnique(color, { emissive, outline = true, thickness } = {}) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap() })
  if (emissive) m.emissive = new THREE.Color(emissive)
  m.userData.outlineParameters = outline ? { thickness: thickness ?? 0.0045, color: [0.17, 0.106, 0.07], alpha: 1, visible: true } : { visible: false }
  return m
}
export function basic(color, opts = {}) {
  const m = new THREE.MeshBasicMaterial({ color, ...opts })
  m.userData.outlineParameters = { visible: false }
  return m
}

/** Mesh helper: geometry + color, casts/receives shadow. */
export function mesh(geo, mat, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, shadow = true } = {}) {
  const m = new THREE.Mesh(geo, typeof mat === 'string' ? toon(mat) : mat)
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz)
  m.castShadow = shadow; m.receiveShadow = true
  return m
}

function canvas(w, h, draw) {
  const c = typeof OffscreenCanvas !== 'undefined' && false ? new OffscreenCanvas(w, h) : document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d')
  draw(g, w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}
const FONT = 'ui-rounded, "SF Pro Rounded", "Avenir Next", system-ui, sans-serif'

// ---------------------------------------------------------------- faces
export const FACES = ['normal', 'closed', 'happy', 'focus', 'dizzy', 'wow']
export function faceAtlas() {
  const W = 256, H = 160
  return canvas(W * FACES.length, H, (g) => {
    g.lineCap = 'round'; g.lineJoin = 'round'
    FACES.forEach((f, i) => {
      const ox = i * W
      const L = ox + 80, R = ox + 176, ey = 66
      g.fillStyle = '#F4A3A3'; g.globalAlpha = 0.55
      g.beginPath(); g.ellipse(L - 26, ey + 34, 16, 9, 0, 0, 7); g.ellipse(R + 26, ey + 34, 16, 9, 0, 0, 7); g.fill()
      g.globalAlpha = 1
      g.strokeStyle = INK; g.fillStyle = INK; g.lineWidth = 11
      const openEye = (x) => {
        g.fillStyle = INK; g.beginPath(); g.ellipse(x, ey, 21, 30, 0, 0, 7); g.fill()
        g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 7, ey - 12, 9, 0, 7); g.fill()
        g.beginPath(); g.arc(x - 7, ey + 11, 4, 0, 7); g.fill()
      }
      if (f === 'normal' || f === 'focus' || f === 'wow') { openEye(L); openEye(R) }
      if (f === 'closed') { for (const x of [L, R]) { g.beginPath(); g.arc(x, ey - 4, 20, 0.2, Math.PI - 0.2); g.stroke() } }
      if (f === 'happy') { for (const x of [L, R]) { g.beginPath(); g.arc(x, ey + 10, 20, Math.PI + 0.25, -0.25); g.stroke() } }
      if (f === 'dizzy') {
        for (const x of [L, R]) { g.beginPath(); for (let a = 0; a < 14; a += 0.3) { const r = a * 1.4; g.lineTo(x + Math.cos(a) * r, ey + Math.sin(a) * r) } g.lineWidth = 5; g.stroke(); g.lineWidth = 9 }
      }
      if (f === 'focus') { // brows
        g.lineWidth = 8
        g.beginPath(); g.moveTo(L - 22, ey - 36); g.lineTo(L + 16, ey - 26); g.stroke()
        g.beginPath(); g.moveTo(R + 22, ey - 36); g.lineTo(R - 16, ey - 26); g.stroke()
      }
      // mouths
      g.lineWidth = 7
      const mx = ox + 128, my = ey + 50
      g.beginPath()
      if (f === 'happy' || f === 'normal') { g.arc(mx, my - 6, 12, 0.3, Math.PI - 0.3); g.stroke() }
      else if (f === 'closed') { g.moveTo(mx - 8, my); g.lineTo(mx + 8, my); g.stroke() }
      else if (f === 'focus') { g.moveTo(mx - 10, my + 2); g.lineTo(mx + 10, my - 1); g.stroke() }
      else if (f === 'dizzy') { g.moveTo(mx - 14, my); g.quadraticCurveTo(mx - 7, my - 8, mx, my); g.quadraticCurveTo(mx + 7, my + 8, mx + 14, my); g.stroke() }
      else if (f === 'wow') { g.fillStyle = INK; g.ellipse(mx, my, 8, 11, 0, 0, 7); g.fill() }
    })
  })
}

// ---------------------------------------------------------------- room textures
export function shojiTexture() {
  return canvas(256, 512, (g, w, h) => {
    g.fillStyle = '#FFF6E2'; g.fillRect(0, 0, w, h)
    g.fillStyle = 'rgba(230,205,160,.35)'; for (let y = 0; y < h; y += 6) g.fillRect(0, y, w, 1)
    g.strokeStyle = '#8A5530'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10)
    g.lineWidth = 5
    for (let x = 1; x < 4; x++) { g.beginPath(); g.moveTo((w / 4) * x, 0); g.lineTo((w / 4) * x, h); g.stroke() }
    for (let y = 1; y < 6; y++) { g.beginPath(); g.moveTo(0, (h / 6) * y); g.lineTo(w, (h / 6) * y); g.stroke() }
  })
}

export function plasterTexture() {
  return canvas(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h)
    gr.addColorStop(0, '#F8EBCB'); gr.addColorStop(1, '#EBD3A4')
    g.fillStyle = gr; g.fillRect(0, 0, w, h)
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(160,120,70,${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2) }
  })
}

export function tatamiTexture() {
  return canvas(256, 512, (g, w, h) => {
    g.fillStyle = '#DCD28F'; g.fillRect(0, 0, w, h)
    for (let x = 0; x < w; x += 4) { g.fillStyle = x % 8 ? 'rgba(150,140,60,.16)' : 'rgba(255,255,220,.18)'; g.fillRect(x, 0, 2, h) }
    g.fillStyle = '#3F5B3A'; g.fillRect(0, 0, 14, h); g.fillRect(w - 14, 0, 14, h)
    g.fillStyle = '#E8C66A'; g.fillRect(4, 0, 3, h); g.fillRect(w - 7, 0, 3, h)
  })
}

export function woodTexture(base = '#B9773F') {
  return canvas(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y += 32) { g.fillStyle = 'rgba(60,30,10,.25)'; g.fillRect(0, y, w, 2) }
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(90,45,15,${0.06 + Math.random() * 0.08})`; g.lineWidth = 1.5; const y = Math.random() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 6, w * 0.6, y - 6, w, y + 2); g.stroke() }
  })
}

export function windowTexture(night) {
  return canvas(512, 512, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h)
    if (night) { sky.addColorStop(0, '#1B2350'); sky.addColorStop(1, '#3B4C8C') } else { sky.addColorStop(0, '#6EC1F7'); sky.addColorStop(1, '#DDF1FF') }
    g.fillStyle = sky; g.fillRect(0, 0, w, h)
    if (night) {
      g.fillStyle = '#FFF4C2'; g.beginPath(); g.arc(360, 130, 44, 0, 7); g.fill()
      g.fillStyle = '#1B2350'; g.beginPath(); g.arc(380, 118, 40, 0, 7); g.fill()
      for (let i = 0; i < 40; i++) { g.fillStyle = '#fff'; g.fillRect(Math.random() * w, Math.random() * h * 0.5, 2, 2) }
    } else {
      g.fillStyle = '#fff'
      for (const [x, y, s] of [[120, 120, 1], [330, 90, 0.8], [420, 170, 0.6]]) { g.beginPath(); g.arc(x, y, 28 * s, 0, 7); g.arc(x + 30 * s, y - 10 * s, 34 * s, 0, 7); g.arc(x + 62 * s, y, 26 * s, 0, 7); g.fill() }
    }
    // mountains with a carved cliff (original, generic)
    g.fillStyle = night ? '#2C3A6B' : '#8FBF8A'
    g.beginPath(); g.moveTo(0, 330); g.lineTo(120, 230); g.lineTo(230, 300); g.lineTo(330, 210); g.lineTo(512, 310); g.lineTo(512, 512); g.lineTo(0, 512); g.fill()
    g.fillStyle = night ? '#24305A' : '#6FA36B'
    g.beginPath(); g.moveTo(0, 380); g.lineTo(160, 330); g.lineTo(300, 370); g.lineTo(512, 340); g.lineTo(512, 512); g.lineTo(0, 512); g.fill()
    // village roofs
    const roofs = [[60, 400], [150, 420], [260, 395], [360, 425], [450, 405]]
    for (const [x, y] of roofs) {
      g.fillStyle = night ? '#5A4A7A' : '#F2E6CF'; g.fillRect(x - 30, y, 60, 50)
      g.fillStyle = night ? '#7A3550' : '#D6334C'; g.beginPath(); g.moveTo(x - 42, y + 4); g.lineTo(x, y - 26); g.lineTo(x + 42, y + 4); g.fill()
      if (night) { g.fillStyle = '#FFD27A'; g.fillRect(x - 10, y + 18, 12, 12) }
    }
    g.fillStyle = night ? '#1D2747' : '#5E8F5A'; g.fillRect(0, 470, w, 42)
  })
}

export function kanjiScroll(text = '忍道') {
  return canvas(200, 520, (g, w, h) => {
    g.fillStyle = '#FFF8EA'; g.fillRect(0, 0, w, h)
    g.strokeStyle = '#C98B4F'; g.lineWidth = 8; g.strokeRect(14, 14, w - 28, h - 28)
    g.fillStyle = INK; g.font = `900 120px "Hiragino Mincho ProN", "Yu Mincho", serif`; g.textAlign = 'center'; g.textBaseline = 'middle'
    ;[...text].forEach((ch, i) => g.fillText(ch, w / 2, 150 + i * 190))
    g.fillStyle = '#D6334C'; g.fillRect(w / 2 - 16, h - 70, 32, 32)
  })
}

export function missionScroll(rank, color, title) {
  return canvas(256, 320, (g, w, h) => {
    g.fillStyle = '#FFF8EA'; g.fillRect(0, 0, w, h)
    g.fillStyle = '#E9D3A6'; g.fillRect(0, 0, w, 18); g.fillRect(0, h - 18, w, 18)
    g.fillStyle = color; g.beginPath(); g.arc(w / 2, 100, 62, 0, 7); g.fill()
    g.fillStyle = '#fff'; g.font = `900 92px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(rank, w / 2, 104)
    g.fillStyle = INK; g.font = `800 30px ${FONT}`
    const words = title.split(' '); let line = '', y = 210
    for (const wd of words) { if (g.measureText(line + wd).width > 220) { g.fillText(line.trim(), w / 2, y); line = ''; y += 34 } line += wd + ' ' }
    g.fillText(line.trim(), w / 2, y)
  })
}

export function signTexture(text, bg = '#2B1B12', fg = '#FFE7B0') {
  return canvas(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h)
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20)
    g.fillStyle = fg; g.font = `900 64px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4)
  })
}

export function codeScreen(color) {
  return canvas(256, 160, (g, w, h) => {
    g.fillStyle = '#0E1420'; g.fillRect(0, 0, w, h)
    for (let y = 16; y < h - 8; y += 16) {
      const ind = (Math.random() * 3 | 0) * 16
      g.fillStyle = color; g.globalAlpha = 0.9; g.fillRect(14 + ind, y, 30 + Math.random() * 120, 7)
      g.globalAlpha = 0.45; g.fillRect(160 + Math.random() * 20, y, 20 + Math.random() * 40, 7)
    }
    g.globalAlpha = 1
  })
}

export function glowSprite(color = '#FFB547') {
  return canvas(128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2)
    gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = gr; g.fillRect(0, 0, w, w)
  })
}

// ---------------------------------------------------------------- ninja cat
/** Tabby fur: warm base with darker wavy mackerel stripes. Horizontal bands wrap around
 *  capsules/spheres as rings (body, arms, tail) — reads as tabby from any angle. */
export function tabbyTexture(base = '#F2A65A', stripe = '#8A4B1F') {
  const t = canvas(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h)
    g.fillStyle = stripe
    for (let i = 0; i < 7; i++) {
      const y0 = 14 + i * 36
      g.beginPath()
      for (let x = 0; x <= w; x += 8) g.lineTo(x, y0 + Math.sin((x / w) * Math.PI * 4 + i) * 6)
      for (let x = w; x >= 0; x -= 8) g.lineTo(x, y0 + 11 + Math.sin((x / w) * Math.PI * 4 + i + 0.6) * 5)
      g.closePath(); g.fill()
    }
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** Cat face atlas — same FACES order/layout as faceAtlas(): slit-pupil eyes, pink nose,
 *  "ω" mouth, whiskers, cream muzzle and the tabby "M" on the forehead. */
export function catFaceAtlas(stripe = '#8A4B1F', muzzle = '#FFF1DC') {
  const W = 256, H = 160
  return canvas(W * FACES.length, H, (g) => {
    g.lineCap = 'round'; g.lineJoin = 'round'
    FACES.forEach((f, i) => {
      const ox = i * W
      const L = ox + 84, R = ox + 172, ey = 70, mx = ox + 128, my = ey + 44
      // forehead M
      g.strokeStyle = stripe; g.lineWidth = 9
      g.beginPath(); g.moveTo(mx - 30, 30); g.lineTo(mx - 15, 8); g.lineTo(mx, 26); g.lineTo(mx + 15, 8); g.lineTo(mx + 30, 30); g.stroke()
      // muzzle
      g.fillStyle = muzzle; g.beginPath(); g.ellipse(mx - 17, my + 4, 24, 18, 0, 0, 7); g.ellipse(mx + 17, my + 4, 24, 18, 0, 0, 7); g.fill()
      // blush
      g.fillStyle = '#F4A3A3'; g.globalAlpha = 0.5
      g.beginPath(); g.ellipse(L - 30, ey + 28, 14, 8, 0, 0, 7); g.ellipse(R + 30, ey + 28, 14, 8, 0, 0, 7); g.fill(); g.globalAlpha = 1
      g.strokeStyle = INK; g.fillStyle = INK; g.lineWidth = 10
      const catEye = x => {
        g.fillStyle = INK; g.beginPath(); g.ellipse(x, ey, 22, 28, 0, 0, 7); g.fill()
        g.fillStyle = '#9BD34A'; g.beginPath(); g.ellipse(x, ey, 17, 23, 0, 0, 7); g.fill()
        g.fillStyle = INK; g.beginPath(); g.ellipse(x, ey, f === 'wow' ? 9 : 4.5, 19, 0, 0, 7); g.fill()
        g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 7, ey - 11, 6, 0, 7); g.fill()
      }
      if (f === 'normal' || f === 'focus' || f === 'wow') { catEye(L); catEye(R) }
      if (f === 'closed') for (const x of [L, R]) { g.beginPath(); g.arc(x, ey - 4, 20, 0.2, Math.PI - 0.2); g.stroke() }
      if (f === 'happy') for (const x of [L, R]) { g.beginPath(); g.arc(x, ey + 10, 20, Math.PI + 0.25, -0.25); g.stroke() }
      if (f === 'dizzy') for (const x of [L, R]) { g.beginPath(); for (let a = 0; a < 14; a += 0.3) { const r = a * 1.4; g.lineTo(x + Math.cos(a) * r, ey + Math.sin(a) * r) } g.lineWidth = 5; g.stroke(); g.lineWidth = 10 }
      if (f === 'focus') { g.lineWidth = 7; g.beginPath(); g.moveTo(L - 22, ey - 38); g.lineTo(L + 14, ey - 30); g.stroke(); g.beginPath(); g.moveTo(R + 22, ey - 38); g.lineTo(R - 14, ey - 30); g.stroke() }
      // nose
      g.fillStyle = '#F28AA0'; g.beginPath(); g.moveTo(mx - 9, my - 10); g.lineTo(mx + 9, my - 10); g.lineTo(mx, my - 1); g.closePath(); g.fill()
      // mouth
      g.strokeStyle = INK; g.lineWidth = 5; g.beginPath()
      if (f === 'wow') { g.fillStyle = INK; g.ellipse(mx, my + 10, 7, 9, 0, 0, 7); g.fill() }
      else if (f === 'focus' || f === 'closed') { g.moveTo(mx - 9, my + 6); g.lineTo(mx + 9, my + 6); g.stroke() }
      else { g.arc(mx - 8, my + 2, 8, 0.1, Math.PI - 0.4); g.moveTo(mx + 16, my + 2); g.arc(mx + 8, my + 2, 8, 0.4, Math.PI - 0.1); g.stroke() } // ω
      // whiskers
      g.lineWidth = 3
      for (const sx of [-1, 1]) for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(mx + sx * 36, my + k * 7); g.lineTo(mx + sx * 92, my - 6 + k * 13); g.stroke() }
    })
  })
}

// ---------------------------------------------------------------- laptop status screen (honest + safe)
/** Live laptop screen. Shows ONLY what the office already displays: agent name, status, signal age,
 *  last tool NAME, the agent's Kanban mission titles, genin count, WIB clock. Never message text,
 *  prompts, tool arguments/results, task bodies or file contents. Redraws only when `key` changes. */
export function laptopScreen() {
  const W = 512, H = 320
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4
  let last = ''
  const clip = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s }
  const ago = s => (s == null ? '' : s < 60 ? `${Math.max(0, Math.round(s))} dtk` : s < 3600 ? `${Math.round(s / 60)} mnt` : `${Math.round(s / 3600)} jam`)
  function draw(i) {
    const key = JSON.stringify([i.owner, i.name, i.status, i.label, i.tool, i.since == null ? null : i.since < 60 ? Math.floor(i.since / 5) : Math.floor(i.since / 60), i.missions, i.genin, i.clock])
    if (key === last) return false
    last = key
    const col = i.color || '#6B7280'
    g.fillStyle = '#0E1420'; g.fillRect(0, 0, W, H)
    // title bar
    g.fillStyle = '#1B2333'; g.fillRect(0, 0, W, 46)
    g.fillStyle = col; g.beginPath(); g.arc(26, 23, 9, 0, 7); g.fill()
    g.fillStyle = '#F8FAFC'; g.font = `800 22px ${FONT}`; g.textBaseline = 'middle'; g.fillText(clip(i.name, 16), 44, 24)
    g.fillStyle = col; g.font = `700 18px ${FONT}`; g.textAlign = 'right'; g.fillText(clip(i.label, 20), W - 16, 24); g.textAlign = 'left'
    // body by status
    g.fillStyle = '#CBD5E1'; g.font = `700 20px ${FONT}`
    const s = i.status
    if (s === 'working') {
      g.fillText('Tool terakhir', 22, 82); g.fillStyle = '#5EEAD4'; g.font = `800 26px ui-monospace, Menlo, monospace`; g.fillText(clip(i.tool || '—', 24), 22, 116)
      g.fillStyle = '#94A3B8'; g.font = `600 16px ${FONT}`; g.fillText(i.since != null ? `sinyal terakhir ${ago(i.since)} lalu` : '', 22, 146)
    } else if (s === 'thinking') {
      g.fillText('Sedang berpikir…', 22, 92); g.fillStyle = '#94A3B8'; g.font = `600 16px ${FONT}`; g.fillText(i.since != null ? `sejak ${ago(i.since)}` : '', 22, 122)
    } else if (s === 'approval') {
      g.fillStyle = '#F59E0B'; g.font = `800 24px ${FONT}`; g.fillText(clip(`Menunggu jawaban ${i.owner || 'Boss'}`, 26), 22, 92)
      g.fillStyle = '#94A3B8'; g.font = `600 16px ${FONT}`; g.fillText('Buka chat agent ini untuk menjawab.', 22, 122)
    } else if (s === 'error') {
      g.fillStyle = '#EF4444'; g.font = `800 24px ${FONT}`; g.fillText('Terjadi error', 22, 92)
      g.fillStyle = '#94A3B8'; g.font = `600 16px ${FONT}`; g.fillText(i.since != null ? `${ago(i.since)} lalu · detail di chat` : 'detail di chat', 22, 122)
    } else if (s === 'done') {
      g.fillStyle = '#22C55E'; g.font = `800 24px ${FONT}`; g.fillText('✓ Selesai', 22, 92)
    } else { // idle / stale / unknown → ninja screensaver + WIB clock
      g.fillStyle = '#334155'; g.font = `900 64px ${FONT}`; g.fillText('忍', 22, 110)
      g.fillStyle = '#E2E8F0'; g.font = `800 40px ${FONT}`; g.fillText(i.clock || '', 110, 100)
      g.fillStyle = '#94A3B8'; g.font = `600 16px ${FONT}`; g.fillText(s === 'stale' ? 'tidak ada sinyal baru' : s === 'unknown' ? 'status belum diketahui' : 'siaga', 112, 132)
    }
    // missions + genin panel
    g.fillStyle = '#1B2333'; g.fillRect(14, 172, W - 28, 134)
    g.fillStyle = '#94A3B8'; g.font = `700 15px ${FONT}`; g.fillText('MISI KANBAN', 28, 194)
    g.textAlign = 'right'; g.fillText(`GENIN ${i.genin || 0}`, W - 28, 194); g.textAlign = 'left'
    const ms = (i.missions || []).slice(0, 3)
    g.font = `600 18px ${FONT}`
    if (!ms.length) { g.fillStyle = '#64748B'; g.fillText(i.missions == null ? 'tidak terbaca' : 'tidak ada misi', 28, 228) }
    ms.forEach((m, k) => { g.fillStyle = '#E2E8F0'; g.fillText('• ' + clip(m, 40), 28, 228 + k * 28) })
    tex.needsUpdate = true
    return true
  }
  return { tex, draw }
}

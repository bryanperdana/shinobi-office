// Tiny nav grid + A* (8-neighbour, no corner cutting) + line-of-sight smoothing.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)

export function createNavGrid({ minX, maxX, minZ, maxZ, cell = 0.5, inflate = 0.32, obstacles = [], areas = null, portals = [] }) {
  const cols = Math.round((maxX - minX) / cell)
  const rows = Math.round((maxZ - minZ) / cell)
  const blocked = new Uint8Array(cols * rows)
  const cx = c => minX + (c + 0.5) * cell
  const cz = r => minZ + (r + 0.5) * cell

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = cx(c), z = cz(r)
      let b = x < minX + inflate || x > maxX - inflate || z < minZ + inflate || z > maxZ - inflate
      if (!b && areas) b = !areas.some(a => x > a.minX + inflate && x < a.maxX - inflate && z > a.minZ + inflate && z < a.maxZ - inflate)
      if (!b) {
        for (const o of obstacles) {
          if (o.r != null) {
            if (Math.hypot(x - o.x, z - o.z) < o.r + inflate) { b = true; break }
          } else if (x > o.x0 - inflate && x < o.x1 + inflate && z > o.z0 - inflate && z < o.z1 + inflate) {
            b = true; break
          }
        }
      }
      blocked[r * cols + c] = b ? 1 : 0
    }
  }

  const toCell = (x, z) => [clamp(Math.floor((x - minX) / cell), 0, cols - 1), clamp(Math.floor((z - minZ) / cell), 0, rows - 1)]
  const freeCell = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows && !blocked[r * cols + c]
  const isFree = (x, z) => { const [c, r] = toCell(x, z); return freeCell(c, r) }

  function nearestFree(c, r) {
    if (freeCell(c, r)) return [c, r]
    for (let k = 1; k < 12; k++) {
      for (let dr = -k; dr <= k; dr++) for (let dc = -k; dc <= k; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== k) continue
        if (freeCell(c + dc, r + dr)) return [c + dc, r + dr]
      }
    }
    return [c, r]
  }

  function los(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az)
    const n = Math.max(1, Math.ceil(d / (cell * 0.3)))
    for (let i = 0; i <= n; i++) {
      const t = i / n
      if (!isFree(ax + (bx - ax) * t, az + (bz - az) * t)) return false
    }
    return true
  }

  // portals (stairs): a jump edge between two cells; cost = walking length along the stair
  const portalEdges = new Map() // cellIdx → [{ to, cost }]
  for (const p of portals) {
    const [ac, ar] = toCell(p.ax, p.az), [bc, br] = toCell(p.bx, p.bz)
    const ia = ar * cols + ac, ib = br * cols + bc, cost = (p.len ?? Math.hypot(p.bx - p.ax, p.bz - p.az)) / cell
    blocked[ia] = 0; blocked[ib] = 0
    if (!portalEdges.has(ia)) portalEdges.set(ia, []); if (!portalEdges.has(ib)) portalEdges.set(ib, [])
    portalEdges.get(ia).push({ to: ib, cost }); portalEdges.get(ib).push({ to: ia, cost })
  }
  function findPath(ax, az, bx, bz) {
    const [sc, sr] = nearestFree(...toCell(ax, az))
    const [gc, gr] = nearestFree(...toCell(bx, bz))
    const N = cols * rows
    const g = new Float32Array(N).fill(Infinity)
    const came = new Int32Array(N).fill(-1)
    const closed = new Uint8Array(N)
    const s = sr * cols + sc, goal = gr * cols + gc
    const h = (c, r) => { const dx = Math.abs(c - gc), dz = Math.abs(r - gr); return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz) }
    const heap = [] // [f, idx]
    const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p } }
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m } } return top }
    g[s] = 0; push(h(sc, sr), s)
    let found = s === goal
    while (heap.length && !found) {
      const [, i] = pop()
      if (closed[i]) continue
      closed[i] = 1
      if (i === goal) { found = true; break }
      const c = i % cols, r = (i / cols) | 0
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue
        const nc = c + dc, nr = r + dr
        if (!freeCell(nc, nr)) continue
        if (dr && dc && (!freeCell(c + dc, r) || !freeCell(c, r + dr))) continue
        const j = nr * cols + nc
        if (closed[j]) continue
        const ng = g[i] + (dr && dc ? Math.SQRT2 : 1)
        if (ng < g[j]) { g[j] = ng; came[j] = i; push(ng + h(nc, nr), j) }
      }
      for (const e of portalEdges.get(i) || []) {
        if (closed[e.to]) continue
        const ng = g[i] + e.cost
        if (ng < g[e.to]) { g[e.to] = ng; came[e.to] = i; push(ng + h(e.to % cols, (e.to / cols) | 0), e.to) }
      }
    }
    if (!found) return null
    const cells = []
    for (let i = goal; i !== -1; i = came[i]) { cells.push(i); if (i === s) break }
    cells.reverse()
    const isJump = (p, q) => (portalEdges.get(p) || []).some(e => e.to === q)
    // portal cells are kept exactly (cell centres) so the stair animation starts/ends on the stair
    const raw = cells.map((ci, k) => {
      const pt = { x: cx(ci % cols), z: cz((ci / cols) | 0) }
      if (k > 0 && isJump(cells[k - 1], ci)) pt.stair = true
      return pt
    })
    const portalCell = k => portalEdges.has(cells[k])
    if (!portalCell(0)) raw[0] = { x: ax, z: az }
    if (raw.length > 1 && !portalCell(raw.length - 1)) raw[raw.length - 1] = { ...raw[raw.length - 1], x: bx, z: bz }
    if (raw.length === 1) raw.push({ x: bx, z: bz })
    // string-pull smoothing (never across a stair: stop at the cell before it, then take the jump)
    const out = [raw[0]]
    let i = 0
    while (i < raw.length - 1) {
      let lim = raw.length - 1
      for (let k = i + 1; k < raw.length; k++) if (raw[k].stair) { lim = k === i + 1 ? k : k - 1; break }
      let j = lim
      if (!raw[j].stair) while (j > i + 1 && !los(raw[i].x, raw[i].z, raw[j].x, raw[j].z)) j--
      out.push(raw[j]); i = j
    }
    return out
  }

  return { cols, rows, cell, isFree, los, findPath }
}

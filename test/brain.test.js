import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBrain, canRoam } from '../src/scene3d/brain.js'
import { worldObstacles as obstaclesFor } from '../src/scene3d/world.js'

const IDS = ['hermes', 'kaito', 'hana', 'ren', 'tama', 'yuki']
const mk = (status = 'idle', seed = 7) => createBrain({ agents: IDS.map(id => ({ id, status })), seed })
const run = (b, secs, dt = 1 / 30, each) => { for (let t = 0; t < secs; t += dt) { b.step(dt); each?.(b) } }
const atDesk = a => a.act.type === 'desk' && Math.hypot(a.x - a.desk.seat.x, a.z - a.desk.seat.z) < 1e-6

test('non-idle agents never leave their desk', () => {
  const b = mk('working')
  run(b, 120, 1 / 30, b => { for (const a of b.agents) assert.ok(atDesk(a), `${a.id} left desk`) })
  assert.equal(b.spars.length, 0)
})

test('idle agents roam and spar happens, max one ring, only idle fighters', () => {
  const b = mk('idle', 3)
  let roamed = new Set(), sparSeen = 0, acts = new Set()
  run(b, 600, 1 / 30, b => {
    assert.ok(b.spars.length <= 1)
    for (const s of b.spars) {
      sparSeen++
      assert.notEqual(s.a, s.b)
      assert.ok(canRoam(b.byId(s.a).status) && canRoam(b.byId(s.b).status))
    }
    for (const a of b.agents) { if (!atDesk(a)) roamed.add(a.id); if (a.activity) acts.add(a.activity) }
  })
  assert.equal(roamed.size, IDS.length, 'every idle agent roams at least once')
  assert.ok(sparSeen > 0, 'a spar happened in 10 simulated minutes')
  for (const k of ['tea', 'spar']) assert.ok(acts.has(k), `activity ${k} seen; got ${[...acts]}`)
})

test('real status interrupts sparring: urgent agent is at desk within 0.4s, partner stops', () => {
  const b = mk('idle', 11)
  assert.ok(b.force('kaito', 'spar', 'ren'))
  // arena is in the Dojo now: fighters run there from HQ, then bow + fight
  for (let t = 0; t < 30 && b.spars[0]?.phase === 'approach'; t += 0.5) run(b, 0.5)
  run(b, 3)
  const s = b.spars[0]
  assert.ok(s && s.phase !== 'approach', `spar in progress, phase=${s?.phase}`)
  b.setStatus('kaito', 'working')
  run(b, 0.4)
  const n = b.byId('kaito'), e = b.byId('ren')
  assert.ok(atDesk(n), 'kaito flickered back to desk')
  assert.equal(n.pose, 'type')
  assert.equal(b.spars.length, 0, 'spar ended')
  assert.notEqual(e.activity, 'spar')
  assert.equal(e.y, 0)
})

test('non-urgent status (done) walks back and ends at desk', () => {
  const b = mk('idle', 5)
  b.force('tama', 'tea')
  run(b, 8)
  b.setStatus('tama', 'done')
  run(b, 20)
  const a = b.byId('tama')
  assert.ok(atDesk(a))
  assert.equal(a.pose, 'thumbs')
})

test('walkers never pass through furniture', () => {
  const b = mk('idle', 9)
  const obs = obstaclesFor(b.desks)
  const inside = (x, z) => obs.some(o => o.r != null ? Math.hypot(x - o.x, z - o.z) < o.r - 0.05
    : x > o.x0 + 0.05 && x < o.x1 - 0.05 && z > o.z0 + 0.05 && z < o.z1 - 0.05)
  let checked = 0
  run(b, 400, 1 / 30, b => {
    for (const a of b.agents) if (a.act.type === 'walk') { checked++; assert.ok(!inside(a.x, a.z), `${a.id} inside furniture at ${a.x.toFixed(2)},${a.z.toFixed(2)}`) }
    for (const g of b.genin) assert.ok(!inside(g.x, g.z))
  })
  assert.ok(checked > 500)
})

test('genin walk from the Academy door to the parent desk and poof', () => {
  const b = mk('working')
  const id = b.spawnGenin('kaito', 'research')
  run(b, 12)
  const g = b.genin.find(g => g.id === id)
  assert.equal(g.state, 'help')
  const side = b.byId('kaito').desk.side
  assert.ok(Math.hypot(g.x - side.x, g.z - side.z) < 1.2)
  b.completeGenin(id)
  run(b, 1)
  assert.ok(!b.genin.find(g => g.id === id))
})

test('deterministic for a given seed', () => {
  const a = mk('idle', 42), c = mk('idle', 42)
  run(a, 60); run(c, 60)
  assert.deepEqual(a.agents.map(x => [x.x.toFixed(4), x.z.toFixed(4), x.pose]), c.agents.map(x => [x.x.toFixed(4), x.z.toFixed(4), x.pose]))
})

test('calm mode (reduced motion): idle agents never leave their desk on their own', () => {
  const b = createBrain({ agents: ['a', 'b', 'c', 'd'].map(id => ({ id, status: 'idle' })), seed: 3, calm: true })
  for (let t = 0; t < 120; t += 1 / 20) b.step(1 / 20)
  for (const a of b.agents) assert.equal(a.act.type, 'desk', a.id + ' left desk in calm mode')
  assert.equal(b.spars.length, 0)
})


test('multi-room world: idle agents visit several rooms; nobody walks through rails/walls', async () => {
  const { roomAt, worldObstacles } = await import('../src/scene3d/world.js')
  const b = mk('idle', 5)
  const rooms = new Map(b.agents.map(a => [a.id, new Set()]))
  const obs = worldObstacles(b.desks)
  const inside = (x, z) => obs.some(o => o.r != null ? Math.hypot(x - o.x, z - o.z) < o.r - 0.05 : x > o.x0 + 0.05 && x < o.x1 - 0.05 && z > o.z0 + 0.05 && z < o.z1 - 0.05)
  let bad = 0
  for (let t = 0; t < 30 * 60; t += 0.05) {
    b.step(0.05)
    for (const a of b.agents) {
      if (a.act.type === 'walk') { if (inside(a.x, a.z)) bad++ }
      if (a.act.type === 'poi' || a.act.type === 'spar') rooms.get(a.id).add(roomAt(a.x, a.z).id)
    }
  }
  assert.equal(bad, 0, 'walker inside an obstacle')
  const visited = [...rooms.values()].map(s => s.size)
  assert.ok(visited.filter(n => n >= 3).length >= Math.ceil(b.agents.length / 2), 'most agents visit ≥3 rooms in 30 min: ' + visited.join(','))
  const all = new Set([...rooms.values()].flatMap(s => [...s]))
  for (const r of ['hq', 'dojo', 'library', 'garden', 'teahouse']) assert.ok(all.has(r), 'room used: ' + r + ' got ' + [...all])
})

test('urgent status from the farthest room → desk within 0.4 s (shunshin)', () => {
  const b = mk('idle', 9)
  const a = b.agents[1]
  for (let t = 0; t < 600 && !(a.act.type === 'poi' && a.z > 11); t += 0.25) b.step(0.25)
  assert.ok(a.z > 11, 'agent reached a front-row room')
  b.setStatus(a.id, 'error')
  run(b, 0.4)
  assert.ok(atDesk(a), 'back at desk')
})

// ---------------------------------------------------------------- V2: two-storey HQ
const w3 = async () => import('../src/scene3d/world.js')
const pos3 = (W, e) => e.stair ? W.stairPoint(e.stair.up ? e.stair.u : 1 - e.stair.u) : W.toWorld(e.x, e.z)

test('V2: Kage desk is on floor 2; a floor-1 agent climbs the stair to the Mission Board (continuous 3D path)', async () => {
  const W = await w3()
  const b = mk('working', 4)
  assert.equal(W.toWorld(b.byId('hermes').desk.seat.x, b.byId('hermes').desk.seat.z).floor, 2)
  assert.equal(W.toWorld(b.byId('kaito').desk.seat.x, b.byId('kaito').desk.seat.z).floor, 1)
  b.setStatus('kaito', 'idle')
  const a = b.byId('kaito')
  assert.ok(b.force('kaito', 'board'))
  let prev = pos3(W, a), maxJump = 0, sawStair = false, maxY = 0
  for (let t = 0; t < 40 && !(a.act.type === 'poi'); t += 1 / 30) {
    b.step(1 / 30)
    const p = pos3(W, a)
    maxJump = Math.max(maxJump, Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z)); prev = p
    if (a.stair) { sawStair = true; assert.equal(b.locationOf(a).id, 'stair') }
    maxY = Math.max(maxY, p.y)
  }
  assert.equal(a.act.type, 'poi', 'reached the board')
  assert.ok(sawStair, 'used the stair')
  assert.equal(b.locationOf(a).id, 'kage')
  assert.ok(Math.abs(maxY - W.FLOOR2.y) < 1e-6)
  assert.ok(maxJump < 0.25, 'no teleport while walking: max step ' + maxJump.toFixed(3))
})

test('V2: urgent status on floor 2 → own floor-1 desk within 0.4 s; walking back down uses the stair', async () => {
  const W = await w3()
  const b = mk('working', 4)
  b.setStatus('hana', 'idle'); b.setStatus('ren', 'idle')
  b.force('hana', 'balcony'); b.force('ren', 'balcony')
  run(b, 40)
  const s = b.byId('hana'), e = b.byId('ren')
  assert.equal(W.toWorld(s.x, s.z).floor, 2, 'hana on floor 2'); assert.equal(W.toWorld(e.x, e.z).floor, 2)
  b.setStatus('hana', 'working')
  run(b, 0.4)
  assert.ok(atDesk(s) && W.toWorld(s.x, s.z).floor === 1, 'hana shunshin to desk')
  b.setStatus('ren', 'done') // non-urgent → walks
  let sawStair = false
  for (let t = 0; t < 40 && !atDesk(e); t += 1 / 30) { b.step(1 / 30); if (e.stair) { sawStair = true; assert.equal(e.stair.up, false) } }
  assert.ok(atDesk(e) && sawStair, 'ren walked down the stair to the desk')
})

test('V2: genin of Hermes climb from the Academy door (floor 1) to the Kage desk (floor 2)', async () => {
  const W = await w3()
  const b = mk('working', 4)
  const id = b.spawnGenin('hermes')
  const g = b.genin.find(x => x.id === id)
  let sawStair = false
  for (let t = 0; t < 40 && g.state === 'walk'; t += 1 / 30) { b.step(1 / 30); if (g.stair) sawStair = true }
  assert.equal(g.state, 'help'); assert.ok(sawStair)
  assert.equal(W.toWorld(g.x, g.z).floor, 2)
})

test('V2: navgrid never links the floors except through the stair', async () => {
  const W = await w3()
  const b = mk('idle', 2)
  for (const [a, c] of [[[-10, 5], [0, 98]], [[25, 20], [-9, 102.4]], [[0, 98], [-8, 20]]]) {
    const p = b.grid.findPath(a[0], a[1], c[0], c[1])
    assert.ok(p, 'path exists')
    for (let i = 1; i < p.length; i++) {
      const f0 = W.toWorld(p[i - 1].x, p[i - 1].z).floor, f1 = W.toWorld(p[i].x, p[i].z).floor
      if (f0 !== f1) assert.ok(p[i].stair, 'floor change only via stair')
    }
    assert.equal(p.filter(q => q.stair).length, 1)
  }
})

// ---------------------------------------------------------------- V3: countryside
test('V3: idle agents walk out through the gate to the torii / paddies / river; urgent status → desk ≤0.4 s', async () => {
  const W = await w3()
  const b = mk('working', 6)
  for (const id of ['hana', 'ren', 'tama']) b.setStatus(id, 'idle')
  assert.ok(b.force('hana', 'torii')); assert.ok(b.force('ren', 'paddy')); assert.ok(b.force('tama', 'river'))
  const obs = W.worldObstacles(b.desks)
  const inside = (x, z) => obs.some(o => o.r != null ? Math.hypot(x - o.x, z - o.z) < o.r - 0.05 : x > o.x0 + 0.05 && x < o.x1 - 0.05 && z > o.z0 + 0.05 && z < o.z1 - 0.05)
  const crossed = new Set(), reached = new Set()
  for (let t = 0; t < 45; t += 1 / 20) {
    b.step(1 / 20)
    for (const a of b.agents) {
      if (a.act.type === 'poi' && ['torii', 'paddy', 'river'].includes(a.act.kind) && b.locationOf(a).id === 'village') reached.add(a.id)
      if (a.act.type === 'walk') assert.ok(!inside(a.x, a.z), a.id + ' in furniture')
      if (a.z > W.WORLD.maxZ && a.z < 80) { crossed.add(a.id); assert.ok(Math.abs(a.x - W.GATE.x) < 1.6, a.id + ' outside the stone path x=' + a.x.toFixed(2)) }
    }
  }
  assert.deepEqual([...reached].sort(), ['hana', 'ren', 'tama'], 'all three reached their countryside spot')
  assert.equal(crossed.size, 3)
  const far = b.agents.find(a => b.locationOf(a).id === 'village' && a.status === 'idle')
  assert.ok(far, 'someone still outside')
  b.setStatus(far.id, 'working'); run(b, 0.4)
  assert.ok(atDesk(far), far.id + ' back from the countryside in ≤0.4 s')
})

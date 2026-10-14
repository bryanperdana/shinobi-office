import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLiveModel, TTL } from '../src/live/model.js'

function clock() { let t = 1_000_000; return { now: () => t, add: ms => { t += ms } } }
const ROSTER = ['default', 'kaito', 'hana'].map(name => ({ name, last_session: { id: 's-' + name, last_active: 100 } }))

test('roster: known profiles are idle, unknown before roster', () => {
  const c = clock(); const m = createLiveModel({ now: c.now }); m.setOwner('r1', 'kaito')
  m.ingest({ type: 'message.start', profile: 'kaito', connectionId: 'c1', session_id: 'r1' })
  m.ingest({ type: 'message.complete', profile: 'kaito', connectionId: 'c1', session_id: 'r1', payload: { status: 'complete' } })
  c.add(TTL.done + 1); m.tick()
  assert.equal(m.statusOf('kaito'), 'unknown') // not confirmed by profiles.list yet
  m.setRoster(ROSTER)
  assert.equal(m.statusOf('kaito'), 'idle')
  assert.equal(m.statusOf('hana'), 'idle')
})

test('chat → thinking → tool → done → idle, tool NAME only, args never stored', () => {
  const c = clock(); const m = createLiveModel({ now: c.now }); m.setRoster(ROSTER); m.setOwner('r1', 'kaito')
  m.ingest({ type: 'message.start', profile: 'kaito', connectionId: 'c1', session_id: 'r1' })
  assert.equal(m.statusOf('kaito'), 'thinking')
  m.ingest({ type: 'tool.start', profile: 'kaito', connectionId: 'c1', session_id: 'r1', payload: { tool_id: 't', name: 'terminal', args: { command: 'cat ~/.env SECRET=abc' } } })
  assert.equal(m.statusOf('kaito'), 'working')
  assert.equal(m.get('kaito').lastTool, 'terminal')
  assert.ok(!JSON.stringify(m.snapshot()).includes('SECRET'))
  assert.ok(!JSON.stringify(m.feed()).includes('SECRET'))
  m.ingest({ type: 'message.complete', profile: 'kaito', connectionId: 'c1', session_id: 'r1', payload: { status: 'complete', text: 'private answer' } })
  assert.equal(m.statusOf('kaito'), 'done')
  assert.ok(!JSON.stringify(m.feed()).includes('private answer'))
  c.add(TTL.done + 1); m.tick()
  assert.equal(m.statusOf('kaito'), 'idle')
})

test('silence after work → stale (never silent idle), then idle after 5 min', () => {
  const c = clock(); const m = createLiveModel({ now: c.now }); m.setRoster(ROSTER)
  m.ingest({ type: 'tool.start', profile: 'hana', connectionId: 'c1', payload: { name: 'web_search' } })
  c.add(TTL.active + 1); m.tick()
  assert.equal(m.statusOf('hana'), 'stale')
  c.add(TTL.stale + 1); m.tick()
  assert.equal(m.statusOf('hana'), 'idle')
})

test('busy session keeps agent working (attributed via session id seen in events)', () => {
  const c = clock(); const m = createLiveModel({ now: c.now }); m.setRoster(ROSTER); m.setOwner('rs', 'hana')
  m.ingest({ type: 'message.start', profile: 'hana', connectionId: 'c1', session_id: 'rs' })
  m.setBusy({ rs: true, unknownSession: true })
  c.add(TTL.active * 3); m.tick()
  assert.equal(m.statusOf('hana'), 'thinking')
  assert.equal(m.statusOf('kaito'), 'idle') // unattributed busy session affects nobody
  m.setBusy({ rs: false }); m.tick()
  assert.equal(m.statusOf('hana'), 'done')
})

test('error turn → error, approval (needs-input dot) outranks everything, clears', () => {
  const c = clock(); const m = createLiveModel({ now: c.now }); m.setRoster(ROSTER)
  m.ingest({ type: 'message.complete', profile: 'default', connectionId: 'c1', payload: { status: 'error', error: 'boom' } })
  assert.equal(m.statusOf('default'), 'error')
  m.setDots({ default: 'needs-input' })
  assert.equal(m.statusOf('default'), 'approval')
  m.setDots({ default: 'idle' })
  assert.equal(m.statusOf('default'), 'error')
  c.add(TTL.error + 1); m.tick()
  assert.equal(m.statusOf('default'), 'idle')
  assert.ok(m.get('default').lastError)
})

test('replayed frames and events without a profile owner are ignored', () => {
  const c = clock(); const m = createLiveModel({ now: c.now }); m.setRoster(ROSTER)
  assert.equal(m.ingest({ type: 'message.start', profile: 'kaito', connectionId: 'c1', replayed: true }), false)
  assert.equal(m.ingest({ type: 'message.start' }), false)
  assert.equal(m.statusOf('kaito'), 'idle')
})

test('pooled backend: ev.profile (socket launch profile) is NOT the owner; event parked until owner resolved', () => {
  const c = clock(); const m = createLiveModel({ now: c.now }); m.setRoster([...ROSTER, { name: 'sora' }])
  // real incident: kaito's turn arrived stamped profile=sora (Desktop's active profile), no connectionId
  m.ingest({ type: 'tool.start', profile: 'sora', session_id: 'rt-n', payload: { name: 'terminal' } })
  assert.equal(m.statusOf('sora'), 'idle')
  assert.equal(m.statusOf('kaito'), 'idle')
  assert.deepEqual(m.unresolved(), ['rt-n'])
  m.setLive([{ sid: 'rt-n', profile: 'kaito', status: 'working' }]) // session.active_list ↔ kaito's stored session
  assert.equal(m.statusOf('kaito'), 'working')
  assert.equal(m.get('kaito').lastTool, 'terminal') // parked event replayed onto the right owner
  assert.equal(m.statusOf('sora'), 'idle')
  assert.deepEqual(m.unresolved(), [])
})

test('session.info profile_name resolves the owner', () => {
  const c = clock(); const m = createLiveModel({ now: c.now }); m.setRoster(ROSTER)
  m.ingest({ type: 'message.start', session_id: 'rt-x' })
  m.ingest({ type: 'session.info', session_id: 'rt-x', payload: { profile_name: 'hana' } })
  assert.equal(m.statusOf('hana'), 'thinking')
})

test('active_list waiting → approval; working holds against TTL', () => {
  const c = clock(); const m = createLiveModel({ now: c.now }); m.setRoster(ROSTER)
  m.setLive([{ sid: 'r1', profile: 'default', status: 'waiting' }, { sid: 'r2', profile: 'hana', status: 'working' }])
  assert.equal(m.statusOf('default'), 'approval')
  assert.equal(m.statusOf('hana'), 'working')
  c.add(TTL.active * 4); m.tick()
  assert.equal(m.statusOf('hana'), 'working')
  m.setLive([{ sid: 'r2', profile: 'hana', status: 'idle' }]); c.add(1); m.tick()
  assert.equal(m.statusOf('default'), 'idle')
  assert.equal(m.statusOf('hana'), 'done') // active_list says it stopped → finished, not silent
})

test('session-history watermark → soft working → idle (for profiles without a live socket)', () => {
  const c = clock(); const m = createLiveModel({ now: c.now }); m.setRoster(ROSTER)
  c.add(30_000)
  const nowS = c.now() / 1000
  m.setRoster([{ name: 'hana', last_session: { last_active: nowS - 5 } }, { name: 'default' }, { name: 'kaito' }])
  assert.equal(m.statusOf('hana'), 'working')
  c.add(TTL.soft + 1); m.tick()
  assert.equal(m.statusOf('hana'), 'idle')
})

test('subagents: genin spawn + complete, removed 15s after done', () => {
  const c = clock(); const m = createLiveModel({ now: c.now }); m.setRoster(ROSTER)
  m.ingest({ type: 'subagent.start', profile: 'kaito', connectionId: 'c1', payload: { subagent_id: 'sa1', goal: 'secret goal text' } })
  assert.equal(m.genin().length, 1)
  assert.equal(m.get('kaito').geninActive, 1)
  assert.ok(!JSON.stringify(m.feed()).includes('secret goal'))
  m.ingest({ type: 'subagent.complete', profile: 'kaito', connectionId: 'c1', payload: { subagent_id: 'sa1' } })
  assert.equal(m.get('kaito').geninActive, 0)
  c.add(15_001); m.tick()
  assert.equal(m.genin().length, 0)
})

test('profiles.list failure → unknown, not idle', () => {
  const c = clock(); const m = createLiveModel({ now: c.now }); m.setRoster(ROSTER)
  m.setRoster(null, { ok: false })
  assert.equal(m.statusOf('hana'), 'unknown')
})

test('remote/registry frame WITH a session: stamp is only a hint; real owner wins, hint used after timeout', () => {
  const c = clock(); const m = createLiveModel({ now: c.now }); m.setRoster([...ROSTER, { name: 'sora' }])
  // remote Desktop: frames carry connectionId + the socket route profile (sora), owner is kaito
  m.ingest({ type: 'tool.start', profile: 'sora', connectionId: 'remote-mini', session_id: 'rt-a', payload: { name: 'terminal' } })
  assert.equal(m.statusOf('sora'), 'idle')
  m.setLive([{ sid: 'rt-a', profile: 'kaito', status: 'working' }])
  assert.equal(m.statusOf('kaito'), 'working'); assert.equal(m.statusOf('sora'), 'idle')
  // a session nobody can resolve: after 6 s the registry hint is used
  m.ingest({ type: 'message.start', profile: 'hana', connectionId: 'remote-mini', session_id: 'rt-b' })
  m.applyHints(6000); assert.equal(m.statusOf('hana'), 'idle')
  c.add(6001); m.applyHints(6000); assert.equal(m.statusOf('hana'), 'thinking')
})

test('activity in the hidden Bot Chat (canonical_session) also counts (remote clients see no live events)', () => {
  const c = clock(); const m = createLiveModel({ now: c.now })
  m.setRoster([{ name: 'kaito', last_session: { last_active: 100 }, canonical_session: { id: 'bc', last_active: c.now() / 1000 - 600 } }])
  c.add(30_000)
  m.setRoster([{ name: 'kaito', last_session: { last_active: 100 }, canonical_session: { id: 'bc', last_active: c.now() / 1000 - 3 } }])
  assert.equal(m.statusOf('kaito'), 'working')
})

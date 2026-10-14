import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseKanbanOutput, activeMissions, doneRecently, boardScrolls, rankFor } from '../src/live/missions.js'

const RAW = 'Warning: something\n' + JSON.stringify([
  { id: 't_1', title: 'Fix data layer', body: 'token at ~/.config/example/token.json SECRET', status: 'done', assignee: 'default', priority: 0, completed_at: 1000 },
  { id: 't_2', title: 'Render reel  v2', body: 'x', status: 'ready', assignee: 'sora', priority: 1 },
  { id: 't_3', title: 'Ship office', status: 'running', assignee: 'kaito', priority: 3, started_at: 900 },
  { id: 't_4', title: 'Low prio', status: 'ready', assignee: null, priority: -1 },
  { id: 't_5', title: 'Old', status: 'archived' },
])

test('parse drops task bodies and other fields', () => {
  const t = parseKanbanOutput(RAW)
  assert.equal(t.length, 5)
  assert.ok(!JSON.stringify(t).includes('SECRET'))
  assert.ok(!JSON.stringify(t).includes('example/token'))
  assert.deepEqual(Object.keys(t[0]).sort(), ['assignee', 'completedAt', 'id', 'priority', 'startedAt', 'status', 'title'])
  assert.equal(t[1].title, 'Render reel v2')
})

test('active missions ordered running first, then priority; done/archived excluded', () => {
  const a = activeMissions(parseKanbanOutput(RAW)).map(t => t.id)
  assert.deepEqual(a, ['t_3', 't_2', 't_4'])
})

test('ranks + board scrolls + done in last 24h', () => {
  assert.equal(rankFor(5).rank, 'S'); assert.equal(rankFor(0).rank, 'C'); assert.equal(rankFor(-2).rank, 'D'); assert.equal(rankFor('x').rank, 'C')
  const t = parseKanbanOutput(RAW)
  assert.deepEqual(boardScrolls(t).map(s => s.rank), ['S', 'B', 'D'])
  assert.equal(doneRecently(t, 1000 + 3600).length, 1)
  assert.equal(doneRecently(t, 1000 + 90_000).length, 0)
})

test('bad output throws (caller shows unknown, not an empty board)', () => {
  assert.throws(() => parseKanbanOutput('kanban: error'))
})

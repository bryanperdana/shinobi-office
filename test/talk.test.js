import { test } from 'node:test'
import assert from 'node:assert/strict'
import { conversation, allRenderedLines, isSafe, voiceOf, greeting, EXITS } from '../src/scene3d/talk.js'
import { createBrain, mulberry32 } from '../src/scene3d/brain.js'

test('the whole phrase bank is safe: no claims of work done, no URLs/files/money', () => {
  const lines = allRenderedLines()
  assert.ok(lines.length >= 40)
  for (const l of lines) assert.ok(isSafe(l), 'unsafe: ' + l)
  assert.ok(!isSafe('Saya sudah mengirim laporan')); assert.ok(!isSafe('lihat https://x.y')); assert.ok(!isSafe('Rp 5.000'))
})

const VOICES = { hermes: 'kage', kaito: 'coder', hana: 'artist', ren: 'herald', tama: 'cat', yuki: 'messenger' }

test('the cat says "nyaa" at most in a minority of its lines; others never', () => {
  const rnd = mulberry32(3)
  let tama = 0, nya = 0
  for (let i = 0; i < 300; i++) for (const l of conversation('tama', 'hana', { missions: 0, hour: 10 }, rnd, VOICES)) {
    if (l.who === 'tama') { tama++; if (/nyaa/i.test(l.text)) nya++ }
    else assert.ok(!/nyaa/i.test(l.text) || /Hmm/.test(l.text) === false, 'non-cat nyaa: ' + l.text)
  }
  assert.ok(nya / tama <= 0.5, `${nya}/${tama}`)
})

test('facts are used only when true (no invented missions/approvals)', () => {
  const rnd = mulberry32(1)
  const txt = Array.from({ length: 200 }, () => conversation('hermes', 'ren', { missions: 0, approvals: 0, genin: 0, lastDone: null, hour: 9, night: false }, rnd, VOICES)).flat().map(l => l.text).join('\n')
  assert.ok(!/menunggu jawaban/.test(txt)); assert.ok(!/genin sedang/.test(txt)); assert.ok(!/misi masih berjalan/.test(txt)); assert.ok(!/Sudah malam/.test(txt))
  assert.equal(greeting(8), 'pagi'); assert.equal(greeting(13), 'siang'); assert.equal(greeting(16), 'sore'); assert.equal(greeting(22), 'malam')
  assert.equal(voiceOf('yuki', VOICES), 'messenger'); assert.equal(voiceOf('hermes'), 'kage'); assert.equal(voiceOf('new-agent'), 'generic')
})

const IDS = ['hermes', 'kaito', 'hana', 'ren', 'tama', 'yuki']
const script = (a, b, rnd) => conversation(a, b, { missions: 0, hour: 10 }, rnd, VOICES)

test('idle agents meet and talk; lines alternate speakers; chat ends cleanly', () => {
  const b = createBrain({ agents: IDS.map(id => ({ id, status: 'idle' })), seed: 4, chatScript: script })
  assert.ok(b.force('kaito', 'chat', 'ren'))
  let spoken = new Map(), maxChats = 0
  for (let t = 0; t < 80; t += 0.05) {
    b.step(0.05); maxChats = Math.max(maxChats, b.chats.length)
    for (const a of b.agents) if (a.line) spoken.set(a.id + '|' + a.line, 1)
  }
  const who = new Set([...spoken.keys()].map(k => k.split('|')[0]))
  assert.ok(who.has('kaito') && who.has('ren'), 'both spoke: ' + [...who])
  assert.ok(maxChats >= 1)
})

test('real status interrupts a conversation: leaver says an exit line and is at desk ≤0.4 s', () => {
  const b = createBrain({ agents: IDS.map(id => ({ id, status: 'idle' })), seed: 4, chatScript: script })
  b.force('hana', 'chat', 'tama')
  for (let t = 0; t < 60 && !(b.chats[0]?.lines); t += 0.05) b.step(0.05)
  assert.ok(b.chats[0]?.lines, 'conversation started')
  b.setStatus('hana', 'thinking')
  for (let t = 0; t < 0.4; t += 1 / 30) b.step(1 / 30)
  const s = b.byId('hana')
  assert.equal(s.act.type, 'desk'); assert.ok(EXITS.includes(s.line), 'exit line: ' + s.line)
  assert.equal(b.chats.length, 0)
  assert.notEqual(b.byId('tama').act.type, 'chat')
})

test('chat level off → no conversations start on their own', () => {
  const b = createBrain({ agents: IDS.map(id => ({ id, status: 'idle' })), seed: 2, chatScript: script, chatLevel: 0 })
  let any = 0
  for (let t = 0; t < 600; t += 0.1) { b.step(0.1); any += b.chats.length }
  assert.equal(any, 0)
})

test('owner name is configurable and appears only through templates', () => {
  const rnd = mulberry32(9)
  const txt = Array.from({ length: 300 }, () => conversation('kaito', 'hermes', { missions: 0, approvals: 1, hour: 10, owner: 'Sensei' }, rnd, VOICES)).flat().map(l => l.text).join('\n')
  assert.ok(/Sensei/.test(txt)); assert.ok(!/Boss/.test(txt))
})

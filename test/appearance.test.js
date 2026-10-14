import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appearanceFor, orderProfiles, ARCHETYPES } from '../src/plugin/appearance.js'
import { CONFIG } from '../src/config.js'

test('default profile is the Kage (Hermes) with the kage voice', () => {
  const a = appearanceFor({ name: 'default' })
  assert.equal(a.id, 'hermes'); assert.equal(a.name, 'Hermes'); assert.equal(a.style, 'kage'); assert.equal(a.voice, 'kage')
})

test('any NEW profile automatically gets a desk + a deterministic archetype look', () => {
  const a = appearanceFor({ name: 'new-agent-x', title: 'Researcher' })
  const b = appearanceFor({ name: 'new-agent-x', title: 'Researcher' })
  assert.deepEqual(a, b)
  assert.equal(a.role, 'Researcher')
  for (const k of ['hair', 'jacket', 'trim', 'style', 'voice']) assert.ok(a[k], k)
  // across many names every archetype (incl. the ninja cat) shows up
  const keys = new Set(Array.from({ length: 300 }, (_, i) => appearanceFor({ name: 'agent-' + i })).map(x => x.species === 'cat' ? 'cat' : x.voice))
  for (const v of ['coder', 'artist', 'herald', 'editor', 'messenger', 'cat']) assert.ok(keys.has(v), 'archetype ' + v)
  assert.equal(ARCHETYPES.length >= 6, true)
})

test('config presets override archetypes; archetypes can be disabled', () => {
  const cfg = { ...CONFIG, presets: { ...CONFIG.presets, tama: { name: 'Tama', role: 'Treasury', species: 'cat', style: 'cat', fur: '#F2A65A', stripe: '#8A4B1F', muzzle: '#FFF1DC', props: ['abacus'], voice: 'cat' } }, order: ['default', 'tama'], archetypes: false }
  const t = appearanceFor({ name: 'tama' }, cfg)
  assert.equal(t.name, 'Tama'); assert.equal(t.species, 'cat'); assert.deepEqual(t.props, ['abacus'])
  const plain = appearanceFor({ name: 'other' }, cfg)
  assert.equal(plain.voice, 'generic'); assert.ok(!plain.species)
  assert.deepEqual(orderProfiles(['zeta', 'tama', 'alpha', 'default'].map(name => ({ name })), cfg).map(p => p.name), ['default', 'tama', 'alpha', 'zeta'])
})

test('Hermes keeps the Kage desk; then new profiles alphabetically', () => {
  const names = orderProfiles(['zeta', 'sora', 'kaito', 'alpha', 'default'].map(name => ({ name }))).map(p => p.name)
  assert.deepEqual(names, ['default', 'alpha', 'kaito', 'sora', 'zeta'])
})

test('profile-provided display text is length-capped', () => {
  const a = appearanceFor({ name: 'x', display_name: 'y'.repeat(200), title: 'z'.repeat(200) })
  assert.ok(a.name.length <= 24 && a.role.length <= 48)
})

test('the published default config contains no personal team presets', () => {
  assert.deepEqual(Object.keys(CONFIG.presets), ['default'])
  assert.equal(CONFIG.ownerName, 'Boss')
})

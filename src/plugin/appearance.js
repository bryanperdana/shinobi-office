// Agent look per Hermes profile: presets from config (src/config.js / config.local.js) and a
// deterministic archetype for every other profile, so a NEW profile automatically gets a desk + ninja.
import { CONFIG } from '../config.js'

/** Archetypes for profiles without a preset: look + desk props + chat voice + activity likes. */
export const ARCHETYPES = [
  { key: 'coder', style: 'spiky', props: ['dual'], voice: 'coder', likes: { train: 1.8, throw: 1.6, spar: 1.6, browse: 1.3, ramen: 1.2 } },
  { key: 'artist', style: 'long', props: ['palette'], voice: 'artist', likes: { sakura: 2, koi: 1.6, tea: 1.3, wander: 1.4 } },
  { key: 'herald', style: 'messy', props: ['megaphone'], voice: 'herald', likes: { spar: 1.8, throw: 1.5, window: 1.6, board: 1.3 } },
  { key: 'editor', style: 'long', props: ['clapper'], voice: 'editor', likes: { sakura: 1.6, koi: 1.3, wander: 1.5, ramen: 1.2 } },
  { key: 'messenger', style: 'spiky', props: ['bird'], voice: 'messenger', likes: { browse: 1.5, read: 1.3, board: 1.4, tea: 1.2 } },
  { key: 'scholar', style: 'bun', props: [], voice: 'generic', likes: { read: 1.8, browse: 1.6, river: 1.3, tea: 1.2 } },
  { key: 'cat', style: 'cat', species: 'cat', props: ['abacus'], voice: 'cat', scale: 0.92, likes: { nap: 1.6, koi: 1.8, tea: 1.4, ramen: 1.4, spar: 0.7 } },
]
const FURS = [['#F2A65A', '#8A4B1F', '#FFF1DC'], ['#9CA3AF', '#4B5563', '#F3F4F6'], ['#3F3F46', '#18181B', '#E5E7EB']]
const HAIRS = ['#2A2438', '#7C4A1E', '#EA7A1A', '#1F2937', '#B45309', '#475569', '#9D174D']
const JACKETS = ['#E2557A', '#0EA5A4', '#334155', '#16A34A', '#2563EB', '#9333EA', '#D97706', '#DC2626']
const TRIMS = ['#FDE68A', '#FB923C', '#BFDBFE', '#F9A8D4', '#A7F3D0', '#FDE047']

function hash(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
const HEX = /^#[0-9a-f]{6}$/i

function archetypeLook(name, cfg) {
  const h = hash(name)
  const jacket = JACKETS[h % JACKETS.length]
  const look = { hair: HAIRS[(h >>> 3) % HAIRS.length], jacket, trim: TRIMS[(h >>> 7) % TRIMS.length], cushion: jacket }
  if (cfg.archetypes === false) return { ...look, style: ['spiky', 'long', 'messy', 'bun'][(h >>> 11) % 4], props: [], voice: 'generic', likes: {} }
  const a = ARCHETYPES[(h >>> 13) % ARCHETYPES.length]
  const out = { ...look, style: a.style, props: [...a.props], voice: a.voice, likes: { ...a.likes } }
  if (a.species === 'cat') { const [fur, stripe, muzzle] = FURS[(h >>> 17) % FURS.length]; Object.assign(out, { species: 'cat', fur, stripe, muzzle, hair: fur, scale: a.scale }) }
  return out
}

export function appearanceFor(profile, cfg = CONFIG) {
  const p = profile || {}
  const name = p.name || 'unknown'
  const preset = cfg.presets?.[name]
  const meta = p.ui_meta?.['hermes-bots'] || {}
  const base = preset ? { voice: 'generic', likes: {}, props: [], ...preset } : archetypeLook(name, cfg)
  const displayName = (typeof p.display_name === 'string' && p.display_name.trim()) || meta.title || preset?.name || name
  const role = (typeof p.title === 'string' && p.title.trim()) || preset?.role || 'Agent'
  const out = { ...base, id: name === 'default' ? 'hermes' : name, profile: name, name: displayName.slice(0, 24), role: role.slice(0, 48) }
  // Bot Mode colour override tints the jacket (not a preset's hand-picked look)
  if (!preset && typeof meta.color === 'string' && HEX.test(meta.color)) { out.jacket = meta.color; out.cushion = meta.color }
  return out
}

// The default profile always takes the Kage desk (slot 0); then config order; then alphabetical.
export function orderProfiles(list, cfg = CONFIG) {
  const ORDER = cfg.order?.length ? cfg.order : ['default']
  return [...list].sort((a, b) => {
    const rank = n => (n === 'default' ? -1 : ORDER.includes(n) ? ORDER.indexOf(n) : 99)
    const ia = rank(a.name), ib = rank(b.name)
    if (ia !== ib) return ia - ib
    return a.name.localeCompare(b.name)
  })
}

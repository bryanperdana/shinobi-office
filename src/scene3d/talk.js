// Idle ninja conversations — pure, deterministic with an injected rnd(). Lines are CURATED templates;
// the only dynamic slots are safe aggregate facts: active missions, approvals waiting, active genin,
// who just finished (agent name only), local hour / day-night, and the configured owner name.
// Never message text, task bodies, files, money, or claims of work done.

/** Voice per agent id: from the agent's preset/archetype (`voices` map), Hermes = kage, else generic. */
export const voiceOf = (id, voices = {}) => voices[id] || (id === 'hermes' || id === 'default' ? 'kage' : 'generic')

export function greeting(hour) {
  if (hour >= 4 && hour < 11) return 'pagi'
  if (hour >= 11 && hour < 15) return 'siang'
  if (hour >= 15 && hour < 18) return 'sore'
  return 'malam'
}

const OPENERS = {
  kage: [f => `Selamat ${greeting(f.hour)}, tim. Semua pos aman?`, f => `Ingat, prioritas kita tetap ${f.owner}.`],
  coder: [f => `Pos Dev Lab aman. Kunai sudah diasah, siap kalau ${f.owner} memanggil.`, () => 'Saya baru selesai pemanasan. Siap untuk misi berikutnya.'],
  artist: [() => 'Taman sedang cantik. Inspirasi konten datang dari sini.', () => 'Cahaya hari ini bagus untuk visual.'],
  herald: [() => 'Menara sinyal tenang. Saya pantau terus.', () => 'Siaga penuh. Tinggal tunggu aba-aba.'],
  cat: [() => 'Kas desa rapi, nyaa. Saya jaga sambil berjemur.', () => 'Catatan kas sudah rapi. Saya istirahat sebentar.'],
  editor: [f => `Edit Bay siap. Kalau ${f.owner} butuh potongan baru, tinggal panggil.`, () => 'Frame hari ini enak dilihat. Saya simpan idenya.'],
  messenger: [() => 'Merpati pengantar pesan sudah kembali ke sarang. Pos saya siaga.', () => 'Pos pesan aman. Saya siap antar kabar kapan saja.'],
  generic: [f => `Saya siap membantu ${f.owner}.`, () => 'Pos saya aman. Siaga terus.'],
}

/** Fact lines: return null when the fact does not apply (so we never invent a situation). */
const FACTS = [
  f => (f.missions === 0 ? 'Papan misi sedang kosong. Kita tetap siaga.' : f.missions > 0 ? `Papan misi berisi ${f.missions} misi aktif. Kita tetap siaga.` : null),
  f => (f.missions > 0 ? `${f.missions} misi masih berjalan. Saya siap bantu kalau ada yang butuh tambahan tangan.` : null),
  f => (f.approvals > 0 ? `Ada ${f.approvals} agent yang menunggu jawaban ${f.owner} di gong. Kita jangan berisik dulu.` : null),
  f => (f.lastDone ? `${f.lastDone} baru saja selesai satu giliran. Kerja bagus!` : null),
  f => (f.genin > 0 ? `${f.genin} genin sedang membantu di markas. Pastikan mereka pulang dengan selamat.` : null),
  f => (f.night ? 'Sudah malam. Lentera desa sudah menyala, pos tetap dijaga.' : null),
]
const CAT_FACTS = [f => `Sudah lewat jam ${String(f.hour).padStart(2, '0')}.00, nyaa. Waktunya teh hangat.`]

/** Scripted duets for specific pairs (either order). 0/1 = first/second listed voice. */
const DUETS = [
  { v: ['coder', 'herald'], lines: [[0, 'Latihan shuriken sebentar?'], [1, 'Boleh. Yang kalah traktir ramen.']] },
  { v: ['artist', 'editor'], lines: [[0, 'Warna sakura hari ini cocok untuk thumbnail?'], [1, 'Cocok. Cahaya sore paling sinematik.']] },
  { v: ['cat', 'coder'], lines: [[0, 'Siapa yang menghabiskan ramen di kedai?'], [1, 'Bukan saya. Mungkin genin.'], [0, 'Hmm, nyaa…']] },
  { v: ['messenger', 'kage'], lines: [[0, 'Kalian sudah baca gulungan baru di perpustakaan?'], [1, 'Sudah. Ilmu yang bagus.']] },
  { v: ['herald', 'artist'], lines: [[0, 'Sparring satu ronde?'], [1, 'Satu ronde saja, nanti saya lanjut ke taman.']] },
]
const REPLIES = ['Siap, saya juga.', 'Setuju. Kita tetap siaga.', 'Baik, dicatat.', f => `Mantap. Siap membantu ${f.owner}.`]
const CLOSERS = ['Baik, saya lanjut keliling desa.', 'Sampai nanti, kawan.', 'Saya kembali berlatih dulu.', 'Oke, tetap siaga ya.']
const EXIT_T = [f => `Ada panggilan dari ${f.owner}. Saya duluan!`, () => 'Misi masuk. Sampai nanti, kawan.', () => 'Gong berbunyi. Saya kembali ke pos.', () => 'Waktunya kerja. Shunshin!']
export const DEFAULT_OWNER = 'Boss'
export const exitLines = (owner = DEFAULT_OWNER) => EXIT_T.map(fn => fn({ owner }))
export const EXITS = exitLines()

const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length) % arr.length]
const text = (t, f) => (typeof t === 'function' ? t(f) : t)

/** Build a 2–4 line conversation between agent ids a and b. Returns [{ who, text }]. */
export function conversation(a, b, facts, rnd, voices = {}) {
  const f = { missions: null, approvals: 0, genin: 0, lastDone: null, hour: 12, night: false, owner: DEFAULT_OWNER, ...(facts || {}) }
  const va = voiceOf(a, voices), vb = voiceOf(b, voices)
  const duet = DUETS.find(d => (d.v[0] === va && d.v[1] === vb) || (d.v[0] === vb && d.v[1] === va))
  if (duet && rnd() < 0.5) {
    const first = duet.v[0] === va ? a : b, second = first === a ? b : a
    return duet.lines.map(([k, text]) => ({ who: k === 0 ? first : second, text }))
  }
  const lines = [{ who: a, text: pick(rnd, OPENERS[va] || OPENERS.generic)(f) }]
  const facts_ = [...FACTS, ...(vb === 'cat' ? CAT_FACTS : [])].map(fn => fn(f)).filter(Boolean)
  lines.push({ who: b, text: facts_.length && rnd() < 0.75 ? pick(rnd, facts_) : pick(rnd, OPENERS[vb] || OPENERS.generic)(f) })
  if (rnd() < 0.6) lines.push({ who: a, text: text(pick(rnd, REPLIES), f) })
  if (rnd() < 0.5) lines.push({ who: b, text: pick(rnd, CLOSERS) })
  return lines
}

export const exitLine = (rnd, owner = DEFAULT_OWNER) => pick(rnd, exitLines(owner))

// Safety net (unit-tested over the whole bank): never claim work that did not happen.
export const FORBIDDEN = [/sudah (mengirim|kirim|approve|membalas|balas|posting|post|transfer|bayar)/i, /https?:\/\//i, /\bRp\s?\d/i, /\.(md|js|py|json|csv)\b/i]
export const isSafe = text => !FORBIDDEN.some(re => re.test(text))

/** Every template in the bank rendered with a spread of facts (for tests / review). */
export function allRenderedLines() {
  const factSets = [
    { missions: 0, approvals: 0, genin: 0, lastDone: null, hour: 8, night: false, owner: DEFAULT_OWNER },
    { missions: 3, approvals: 2, genin: 1, lastDone: 'Kaito', hour: 21, night: true, owner: 'Sensei' },
  ]
  const out = []
  for (const f of factSets) {
    for (const v of Object.values(OPENERS)) for (const fn of v) out.push(fn(f))
    for (const fn of [...FACTS, ...CAT_FACTS]) { const t = fn(f); if (t) out.push(t) }
  }
  for (const d of DUETS) for (const [, t] of d.lines) out.push(t)
  return [...out, ...REPLIES.map(t => text(t, factSets[0])), ...CLOSERS, ...EXITS]
}

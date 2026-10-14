// Kanban → Mission Board. Pure helpers (tested in Node). Read-only.
// Only id / title / status / assignee / priority / timestamps survive: task bodies can hold
// paths, sheet ids or credentials hints, so they are dropped at parse time.

export const ACTIVE_STATUSES = ['running', 'review', 'blocked', 'ready', 'todo', 'scheduled', 'triage']
const STATUS_ORDER = Object.fromEntries(ACTIVE_STATUSES.map((s, i) => [s, i]))

export const STATUS_LABEL_ID = {
  running: 'Berjalan', review: 'Review', blocked: 'Terblokir', ready: 'Siap', todo: 'Antri',
  scheduled: 'Terjadwal', triage: 'Triage', done: 'Selesai', archived: 'Arsip',
}

const RANKS = [
  { min: 3, rank: 'S', color: '#E11D48' },
  { min: 2, rank: 'A', color: '#F59E0B' },
  { min: 1, rank: 'B', color: '#3B82F6' },
  { min: 0, rank: 'C', color: '#22C55E' },
  { min: -Infinity, rank: 'D', color: '#94A3B8' },
]
export function rankFor(priority) {
  const p = Number.isFinite(Number(priority)) ? Number(priority) : 0
  return RANKS.find(r => p >= r.min)
}

/** Parse `hermes kanban list --json` output (cli.exec) into slim mission records. Throws on bad output. */
export function parseKanbanOutput(output) {
  const text = String(output || '')
  const at = text.indexOf('[')
  if (at < 0) throw new Error('kanban: no JSON array in output')
  const arr = JSON.parse(text.slice(at, text.lastIndexOf(']') + 1))
  if (!Array.isArray(arr)) throw new Error('kanban: not an array')
  return arr.filter(t => t && typeof t.id === 'string').map(t => ({
    id: t.id.slice(0, 40),
    title: String(t.title || '(tanpa judul)').replace(/\s+/g, ' ').trim().slice(0, 90),
    status: String(t.status || 'unknown'),
    assignee: typeof t.assignee === 'string' && t.assignee ? t.assignee : null,
    priority: Number.isFinite(Number(t.priority)) ? Number(t.priority) : 0,
    startedAt: Number(t.started_at) || null,
    completedAt: Number(t.completed_at) || null,
  }))
}

/** Active missions, most urgent first: running → review → blocked → ready …, then priority desc. */
export function activeMissions(tasks) {
  return tasks
    .filter(t => t.status in STATUS_ORDER)
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.priority - a.priority || a.title.localeCompare(b.title))
}

export function doneRecently(tasks, nowSec = Date.now() / 1000, windowSec = 86_400) {
  return tasks.filter(t => t.status === 'done' && t.completedAt && nowSec - t.completedAt < windowSec)
}

/** Scroll data for the 3D board. */
export function boardScrolls(tasks) {
  return activeMissions(tasks).map(t => ({ ...rankFor(t.priority), title: t.title.slice(0, 22) }))
}

// Browser harness stand-in for @hermes/plugin-sdk. Only what the plugin uses.
// Driven by window.__mock (scripts/qa-plugin.mjs) to replay sanitized gateway events.
import { createElement, useSyncExternalStore } from 'react'

function atom(v) {
  let val = v
  const ls = new Set()
  return {
    get: () => val,
    set: x => { val = x; ls.forEach(f => f(val)) },
    subscribe: f => { ls.add(f); f(val); return () => ls.delete(f) },
    listen: f => { ls.add(f); return () => ls.delete(f) },
  }
}

const M = (window.__mock = window.__mock || {})
M.log = []
M.profiles = M.profiles || []
M.dots = atom({})
M.failRoster = false
const evL = new Set()
M.emit = ev => evL.forEach(f => f(ev))

export const useValue = a => useSyncExternalStore(f => a.listen(f), a.get)

export const host = {
  state: { profile: atom('kaito'), gateway: atom('open'), busyBySession: atom({}) },
  request: async (method, params) => {
    M.log.push(['request', method])
    if (method === 'profiles.list') { if (M.failRoster) throw new Error('mock failure'); return { profiles: M.profiles } }
    if (method === 'cli.exec') return { output: 'note\n' + JSON.stringify(M.kanban || []) }
    if (method === 'session.active_list') return { sessions: M.active || [] }
    if (method === 'session.list') return { sessions: (M.sessionsByProfile || {})[params?.profile] || [] }
    throw new Error('unexpected RPC ' + method)
  },
  onEvent: (type, fn) => { evL.add(fn); return () => evL.delete(fn) },
  navigate: p => M.log.push(['navigate', p]),
  openSession: async (id, opts) => M.log.push(['openSession', id, opts]),
  newChat: async p => M.log.push(['newChat', p]),
  notifyError: e => M.log.push(['notifyError', String(e)]),
}
M.host = host

export function Button({ variant, size, children, ...rest }) {
  return createElement('button', { ...rest, className: `btn btn-${variant || 'default'} btn-${size || 'default'}` }, children)
}

// mimics core's dot classes (session-status-dot.tsx DOT_VARIANTS)
export function SessionStatusDot({ storedSessionId }) {
  const dots = useValue(M.dots)
  const st = dots[storedSessionId]
  const cls = st === 'needs-input' ? 'size-1.5 rounded-full bg-amber-500' : st === 'working' ? 'size-1.5 rounded-full bg-(--ui-accent)' : 'size-1 rounded-full bg-(--ui-text-quaternary)'
  return createElement('span', { className: 'flex items-center gap-0.5' }, createElement('span', { className: cls }))
}

export const ROUTES_AREA = 'routes'
export const SIDEBAR_NAV_AREA = 'sidebar.nav'
export const PALETTE_AREA = 'palette'

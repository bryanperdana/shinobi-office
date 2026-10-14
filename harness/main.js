// Mounts the REAL plugin (src/plugin/index.js) against the mock SDK, like Desktop would.
import { createRoot } from 'react-dom/client'
import plugin from '../src/plugin/index.js'

const M = window.__mock
const items = []
const store = new Map()
const disposers = []
const ctx = {
  register: i => items.push(i),
  registerMany: is => items.push(...is),
  onDispose: fn => disposers.push(fn),
  onEvent: (t, fn) => M.host.onEvent(t, fn),
  storage: { get: k => store.get(k), set: (k, v) => store.set(k, v), remove: k => store.delete(k) },
}
M.items = items
M.storage = store
M.dispose = () => disposers.forEach(f => f())
plugin.register(ctx)
const route = items.find(i => i.area === 'routes' && i.data?.path === '/office')
createRoot(document.getElementById('root')).render(route.render())
M.ready = true

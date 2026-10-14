// Hermes Desktop plugin entry — "Virtual Office" (Shinobi HQ). Route /office.
// Read-only + navigation only (by design). Bundled by esbuild → dist/plugin.js.
import { jsx } from 'react/jsx-runtime'
import { host, ROUTES_AREA, SIDEBAR_NAV_AREA, PALETTE_AREA } from '@hermes/plugin-sdk'
import { createLive, VERSION } from './live.js'
import { OfficePage } from './page.js'

export default {
  id: 'shinobi-office',
  name: 'Virtual Office',
  version: VERSION,
  description: 'Shinobi HQ — kantor 3D tempat agent Hermes bekerja, jalan-jalan dan sparring (read-only).',
  register(ctx) {
    const live = createLive(ctx)
    ctx.onDispose?.(() => live.dispose())
    const items = [
      { id: 'page', area: ROUTES_AREA, data: { path: '/office' }, render: () => jsx(OfficePage, { live }) },
      { id: 'nav', area: SIDEBAR_NAV_AREA, data: { path: '/office', label: 'Virtual Office', codicon: 'organization' } },
      { id: 'open', area: PALETTE_AREA, data: { id: 'shinobi-office.open', label: 'Open Virtual Office', keywords: ['office', 'virtual', 'shinobi', 'agents', 'kantor'], run: () => host.navigate('/office') } },
    ]
    if (typeof ctx.registerMany === 'function') ctx.registerMany(items)
    else items.forEach(i => ctx.register(i))
  },
}

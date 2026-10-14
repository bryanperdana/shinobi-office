// Build targets. Uses src/config.local.js instead of src/config.js when it exists (personal presets
// stay out of git). Usage: node scripts/build.mjs [plugin|web|harness|harness-dist|all] [--generic]
import * as esbuild from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const generic = process.argv.includes('--generic') || process.env.SHINOBI_GENERIC === '1'
const local = path.join(root, 'src/config.local.js')
const useLocal = !generic && fs.existsSync(local)
const configPlugin = {
  name: 'shinobi-config',
  setup(b) {
    b.onResolve({ filter: /(^|\/)config\.js$/ }, args => {
      const p = path.resolve(args.resolveDir, args.path)
      if (useLocal && p === path.join(root, 'src/config.js') && args.importer !== local) return { path: local }
      return null
    })
  },
}
const common = { bundle: true, format: 'esm', target: 'es2022', logLevel: 'info', plugins: [configPlugin] }
const harnessAlias = { '@hermes/plugin-sdk': path.join(root, 'harness/mock-sdk.js') }
const TARGETS = {
  plugin: { ...common, entryPoints: ['src/plugin/index.js'], outfile: 'dist/plugin.js', minify: true, legalComments: 'none', external: ['@hermes/plugin-sdk', 'react', 'react/jsx-runtime'] },
  web: { ...common, entryPoints: ['web/main.js'], outfile: 'web/app.js', minify: true },
  harness: { ...common, entryPoints: ['harness/main.js'], outfile: 'harness/harness.js', alias: harnessAlias, define: { 'process.env.NODE_ENV': '"production"' } },
  'harness-dist': { ...common, entryPoints: ['harness/main-dist.js'], outfile: 'harness/harness.js', alias: harnessAlias, define: { 'process.env.NODE_ENV': '"production"' } },
}
const want = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'plugin'
const names = want === 'all' ? ['plugin', 'web'] : [want]
process.chdir(root)
for (const n of names) {
  if (!TARGETS[n]) { console.error('unknown target ' + n); process.exit(1) }
  await esbuild.build(TARGETS[n])
}
console.log(`config: ${useLocal ? 'src/config.local.js (private)' : 'src/config.js (default)'}`)

// Desktop plugin loader compatibility: the bundle may only import the host-provided specifiers.
import fs from 'node:fs'
const src = fs.readFileSync(process.argv[2] || 'dist/plugin.js', 'utf8')
const ALLOWED = new Set(['@hermes/plugin-sdk', 'react', 'react/jsx-runtime'])
const specs = new Set()
for (const m of src.matchAll(/(?:^|[;\s}])(?:import|export)\s*(?:[^'"`;]*?from\s*)?["']([^"']+)["']/g)) specs.add(m[1])
for (const m of src.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) specs.add(m[1])
const unsupported = [...specs].filter(s => !ALLOWED.has(s))
console.log('imports:', JSON.stringify([...specs]), 'unsupported:', JSON.stringify(unsupported), 'bytes:', src.length)
process.exit(unsupported.length ? 1 : 0)

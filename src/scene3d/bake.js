// Static-geometry baking: merge plain meshes per (material, shadow, attribute layout) into one mesh each.
// Cuts draw calls (×2 with OutlineEffect). Skips instanced meshes, sprites, anything under an `exclude`
// ancestor or flagged userData.dynamic. Originals are removed from their parents.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export function bakeStatic(root, { exclude = new Set(), parent = root } = {}) {
  root.updateMatrixWorld(true)
  const skip = o => { for (let p = o; p; p = p.parent) { if (exclude.has(p) || p.userData?.dynamic) return true; if (p === root) break } return false }
  const groups = new Map(), victims = []
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || !o.visible || skip(o)) return
    const g = o.geometry.clone()
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k)
    for (const k of Object.keys(g.morphAttributes)) delete g.morphAttributes[k]
    g.applyMatrix4(o.matrixWorld)
    const key = `${o.material.uuid}|${o.castShadow ? 1 : 0}|${o.receiveShadow ? 1 : 0}|${g.index ? 'i' : 'n'}|${Object.keys(g.attributes).sort().join(',')}`
    if (!groups.has(key)) groups.set(key, { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, geos: [] })
    groups.get(key).geos.push(g); victims.push(o)
  })
  const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert()
  const out = []
  for (const { mat, cast, recv, geos } of groups.values()) {
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false)
    if (geos.length > 1) geos.forEach(g => g.dispose())
    if (!merged) continue
    merged.applyMatrix4(inv)
    const m = new THREE.Mesh(merged, mat); m.castShadow = cast; m.receiveShadow = recv; m.userData.shadow0 = cast; m.userData.baked = true
    parent.add(m); out.push(m)
  }
  for (const o of victims) o.parent?.remove(o) // geometries may be shared with excluded meshes → not disposed
  return out
}

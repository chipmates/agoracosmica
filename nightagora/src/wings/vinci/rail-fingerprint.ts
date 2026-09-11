import { Mesh, Object3D, Vector3 } from 'three/webgpu'

/** Geometry identity only: materials, normals and shadow state do not change solids.
 * Every referenced position is transformed to world space and rounded to 1 µm.
 * Equal hashes therefore bound corresponding points within sqrt(3) µm; the
 * clearance authority reserves 2 µm from each offline geometric certificate.
 * No spatial index or triangle-distance calculation runs in the browser.
 */
function fingerprintInput(roots: readonly Object3D[], includeRecords = false) {
  const meshes: Mesh[] = [], seen = new Set<Object3D>()
  for (const root of roots) {
    root.updateWorldMatrix(true, true)
    root.traverse(object => {
      if (seen.has(object)) return
      seen.add(object)
      if (!(object instanceof Mesh) || !object.visible) return
      if ('isInstancedMesh' in object && object.isInstancedMesh) throw new Error(`Unexpanded rail solid: ${object.name}`)
      meshes.push(object)
    })
  }
  // Names are part of the identity. Duplicate names are rejected, not ordered
  // by scene insertion order or silently collapsed.
  meshes.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
  if (meshes.some((mesh, i) => !mesh.name || i > 0 && mesh.name === meshes[i - 1]!.name)) throw new Error('Rail solids need unique mesh names')
  const encoder = new TextEncoder(), chunks: Uint8Array[] = []
  const records: { name: string; manifestId: string; vertices: number; bytes: Uint8Array<ArrayBuffer> }[] = []
  const point = new Vector3()
  for (const mesh of meshes) {
    const position = mesh.geometry.getAttribute('position'), index = mesh.geometry.getIndex()
    if (!position) throw new Error(`Rail solid has no position: ${mesh.name}`)
    const count = index?.count ?? position.count
    const header = encoder.encode(`${mesh.name}\n${count}\n`)
    // Expand indices in their real triangle order. A changed index, winding,
    // transform or vertex therefore changes the hash; irrelevant unused
    // vertices and buffer interleaving do not.
    const bytes = new Uint8Array(count * 12), view = new DataView(bytes.buffer)
    for (let i = 0; i < count; i++) {
      point.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld)
      for (let axis = 0; axis < 3; axis++) {
        const value = Math.round(point.getComponent(axis) * 1e6)
        if (!Number.isSafeInteger(value) || value < -2147483648 || value > 2147483647) throw new Error(`Invalid rail solid coordinate: ${mesh.name}`)
        view.setInt32(i * 12 + axis * 4, value, true)
      }
    }
    chunks.push(header, bytes)
    if (includeRecords) {
      const recordBytes = new Uint8Array(header.length + bytes.length)
      recordBytes.set(header); recordBytes.set(bytes, header.length)
      records.push({ name: mesh.name, manifestId: String(mesh.userData['manifestId']), vertices: count, bytes: recordBytes })
    }
  }
  const bytes = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0))
  let at = 0
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length }
  return { bytes, records }
}
async function digest(bytes: Uint8Array<ArrayBuffer>) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}
export async function railGeometryFingerprint(roots: readonly Object3D[]) {
  return digest(fingerprintInput(roots).bytes)
}
/** Read-only explanation of a rejected mounted geometry identity. These
 * per-mesh hashes never grant clearance or modify the saved certificate.
 */
export async function railGeometryFingerprintBreakdown(roots: readonly Object3D[]) {
  const input = fingerprintInput(roots, true)
  return {
    sha256: await digest(input.bytes),
    meshes: await Promise.all(input.records.map(async record => ({
      name: record.name, manifestId: record.manifestId, vertices: record.vertices,
      sha256: await digest(record.bytes),
    }))),
  }
}

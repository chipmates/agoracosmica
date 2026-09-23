// A glTF 2.0 WRITER, as small as the export needs: one .gltf, one .bin, the
// images beside them. Every node carries its world matrix (the room is flat:
// no hierarchy is needed to place it), and a mesh used twice is one mesh.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const FLOAT = 5126, UINT = 5125
const ARRAY_BUFFER = 34962, ELEMENT_ARRAY_BUFFER = 34963

export class Gltf {
  constructor(generator) {
    this.json = {
      asset: { version: '2.0', generator },
      scene: 0, scenes: [{ name: 'room', nodes: [] }],
      nodes: [], meshes: [], materials: [], textures: [], images: [], accessors: [], bufferViews: [], buffers: [],
      samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
      extensionsUsed: [],
    }
    this.chunks = []
    this.length = 0
    this.images = new Map()
  }

  use(ext) { if (!this.json.extensionsUsed.includes(ext)) this.json.extensionsUsed.push(ext) }

  view(typed, target) {
    const pad = (4 - (this.length % 4)) % 4
    if (pad) { this.chunks.push(Buffer.alloc(pad)); this.length += pad }
    const buf = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength)
    this.chunks.push(Buffer.from(buf))
    this.json.bufferViews.push({ buffer: 0, byteOffset: this.length, byteLength: buf.length, ...(target ? { target } : {}) })
    this.length += buf.length
    return this.json.bufferViews.length - 1
  }

  accessor(typed, type, bounds = false) {
    const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[type]
    const isIndex = typed instanceof Uint32Array
    const acc = {
      bufferView: this.view(typed, isIndex ? ELEMENT_ARRAY_BUFFER : ARRAY_BUFFER),
      componentType: isIndex ? UINT : FLOAT, count: typed.length / comps, type,
    }
    if (bounds) {
      const min = new Array(comps).fill(Infinity), max = new Array(comps).fill(-Infinity)
      for (let i = 0; i < typed.length; i++) { const k = i % comps; if (typed[i] < min[k]) min[k] = typed[i]; if (typed[i] > max[k]) max[k] = typed[i] }
      acc.min = min; acc.max = max
    }
    this.json.accessors.push(acc)
    return this.json.accessors.length - 1
  }

  texture(file) {
    if (!this.images.has(file)) {
      this.json.images.push({ uri: `textures/${file}` })
      this.json.textures.push({ source: this.json.images.length - 1, sampler: 0 })
      this.images.set(file, this.json.textures.length - 1)
    }
    return this.images.get(file)
  }

  material(def) {
    this.json.materials.push(def)
    return this.json.materials.length - 1
  }

  /** primitives: [{ position, normal, uv?, colour?, index?, material }] as typed arrays */
  mesh(name, primitives) {
    const prims = primitives.map((p) => {
      const attributes = { POSITION: this.accessor(p.position, 'VEC3', true), NORMAL: this.accessor(p.normal, 'VEC3') }
      if (p.uv) attributes.TEXCOORD_0 = this.accessor(p.uv, 'VEC2')
      if (p.colour) attributes.COLOR_0 = this.accessor(p.colour, 'VEC3')
      const out = { attributes, material: p.material, mode: 4 }
      if (p.index) out.indices = this.accessor(p.index, 'SCALAR')
      return out
    })
    this.json.meshes.push({ name, primitives: prims })
    return this.json.meshes.length - 1
  }

  node(name, mesh, matrix, extras) {
    const n = { name, mesh }
    if (matrix && !isIdentity(matrix)) n.matrix = matrix
    if (extras) n.extras = extras
    this.json.nodes.push(n)
    this.json.scenes[0].nodes.push(this.json.nodes.length - 1)
    return this.json.nodes.length - 1
  }

  write(dir, base) {
    const bin = Buffer.concat(this.chunks)
    this.json.buffers = [{ uri: `${base}.bin`, byteLength: bin.length }]
    if (!this.json.extensionsUsed.length) delete this.json.extensionsUsed
    writeFileSync(join(dir, `${base}.bin`), bin)
    writeFileSync(join(dir, `${base}.gltf`), JSON.stringify(this.json, null, 1))
    return { bytes: bin.length, nodes: this.json.nodes.length, meshes: this.json.meshes.length, materials: this.json.materials.length, images: this.json.images.length }
  }
}

function isIdentity(m) {
  for (let i = 0; i < 16; i++) if (Math.abs(m[i] - (i % 5 === 0 ? 1 : 0)) > 1e-9) return false
  return true
}

/** a column-major 4x4 is a glTF node matrix only when it has no shear */
export function decomposable(m) {
  const cols = [[m[0], m[1], m[2]], [m[4], m[5], m[6]], [m[8], m[9], m[10]]]
  const len = cols.map((c) => Math.hypot(...c))
  if (len.some((l) => l < 1e-9)) return false
  const u = cols.map((c, i) => c.map((v) => v / len[i]))
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  return Math.abs(dot(u[0], u[1])) < 1e-5 && Math.abs(dot(u[0], u[2])) < 1e-5 && Math.abs(dot(u[1], u[2])) < 1e-5 &&
    Math.abs(m[3]) < 1e-9 && Math.abs(m[7]) < 1e-9 && Math.abs(m[11]) < 1e-9 && Math.abs(m[15] - 1) < 1e-9
}

/** positions and normals through a world matrix (normals by its inverse transpose) */
export function bake(position, normal, m) {
  const P = new Float32Array(position.length), N = new Float32Array(normal ? normal.length : position.length)
  const a = m[0], b = m[4], c = m[8], d = m[1], e = m[5], f = m[9], g = m[2], h = m[6], k = m[10]
  // the cofactor matrix is the inverse transpose times the determinant; its
  // sign is put back so a mirrored node keeps its normals pointing out
  const it = [e * k - f * h, -(d * k - f * g), d * h - e * g, -(b * k - c * h), a * k - c * g, -(a * h - b * g), b * f - c * e, -(a * f - c * d), a * e - b * d]
  const sign = Math.sign(a * it[0] + b * it[1] + c * it[2]) || 1
  for (let i = 0; i < position.length; i += 3) {
    const x = position[i], y = position[i + 1], z = position[i + 2]
    P[i] = m[0] * x + m[4] * y + m[8] * z + m[12]
    P[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]
    P[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14]
    if (normal) {
      const nx = normal[i], ny = normal[i + 1], nz = normal[i + 2]
      const X = it[0] * nx + it[1] * ny + it[2] * nz, Y = it[3] * nx + it[4] * ny + it[5] * nz, Z = it[6] * nx + it[7] * ny + it[8] * nz
      const l = (Math.hypot(X, Y, Z) || 1) * sign
      N[i] = X / l; N[i + 1] = Y / l; N[i + 2] = Z / l
    }
  }
  return { position: P, normal: N }
}

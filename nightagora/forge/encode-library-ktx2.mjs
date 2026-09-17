// THE LIBRARY IN GPU BLOCKS. A 2048 map decodes to 21 MB of RGBA8 with its
// mips whatever its JPEG weighs; the same map as Basis UASTC in a KTX2 file
// transcodes to BC7 or ASTC and holds 5.6 MB. This writes that encode beside
// each source map in the store, reads it back through the app's own
// transcoder and scores it against the source, and records it under the
// manifest law: a new record per file with its hash, its source's hash and
// the recipe that made it, and a pointer on the set the runtime reads.
//
//   node forge/encode-library-ktx2.mjs [set ...] [--go]
//
// Without `--go` it encodes into the scratch folder and prints the scores,
// and the store is not touched. The encoder is the store's own gltfpack
// (`internal/night-agora/tools/bin/gltfpack`), UASTC for every class, the
// rows flipped to match the decoded photograph the library uploads.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { APP_ROOT, STORE } from './vite-na-assets.mjs'

const require = createRequire(import.meta.url)
const args = process.argv.slice(2)
const GO = args.includes('--go')
const DEFAULT_SETS = ['limestone-pale', 'marble-lapis', 'stone-tuffeau', 'bronze-dark', 'earth-packed', 'grass-short',
  'iron-forged', 'linen', 'leather-worn', 'parchment-laid', 'oak-beams', 'rope']
const SETS = args.filter((a) => !a.startsWith('--')).length ? args.filter((a) => !a.startsWith('--')) : DEFAULT_SETS
const GLTFPACK = resolve(STORE, '..', 'tools', 'bin', 'gltfpack')
const RECIPE = ['-tc', '-tu', '-tfy', '-tj', '4']
const LIBRARY = join(STORE, 'library')
const WORK = join(process.env['NA_SCRATCH'] ?? tmpdir(), 'na-ktx2')
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')

/* the texture slot decides the class gltfpack encodes for: colour is sRGB,
   a normal keeps its vectors, anything else is linear data */
const SLOT = {
  albedo: (index) => ({ pbrMetallicRoughness: { baseColorTexture: { index } } }),
  normal: (index) => ({ normalTexture: { index } }),
  surface: (index) => ({ pbrMetallicRoughness: { metallicRoughnessTexture: { index } } }),
}

function quad(image, map) {
  const buffer = Buffer.concat([
    Buffer.from(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]).buffer),
    Buffer.from(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]).buffer),
    Buffer.from(new Uint16Array([0, 1, 2, 0, 2, 3]).buffer),
  ])
  return {
    asset: { version: '2.0' }, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 3, TEXCOORD_0: 1 }, indices: 2, material: 0 }] }],
    materials: [SLOT[map](0)], textures: [{ source: 0 }], images: [{ uri: image }],
    buffers: [{ byteLength: buffer.length + 48, uri: `data:application/octet-stream;base64,${Buffer.concat([buffer, Buffer.from(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]).buffer)]).toString('base64')}` }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 48 }, { buffer: 0, byteOffset: 48, byteLength: 32 },
      { buffer: 0, byteOffset: 80, byteLength: 12 }, { buffer: 0, byteOffset: 92, byteLength: 48 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 4, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
      { bufferView: 1, componentType: 5126, count: 4, type: 'VEC2' },
      { bufferView: 2, componentType: 5123, count: 6, type: 'SCALAR' },
      { bufferView: 3, componentType: 5126, count: 4, type: 'VEC3' },
    ],
  }
}

/** the app's own transcoder, run in node: level 0 back to RGBA */
async function transcoder() {
  const context = { module: {}, require, process, console, __filename: 'basis_transcoder.js', __dirname: '.', WebAssembly,
    TextDecoder, setTimeout, clearTimeout, performance, URL }
  vm.runInNewContext(`${readFileSync(join(APP_ROOT, 'public/basis/basis_transcoder.js'), 'utf8')};this.BASIS=BASIS`, context)
  const basis = await context.BASIS({ wasmBinary: readFileSync(join(APP_ROOT, 'public/basis/basis_transcoder.wasm')) })
  basis.initializeBasis()
  return (file) => {
    const k = new basis.KTX2File(new Uint8Array(readFileSync(file)))
    try {
      if (!k.isValid() || !k.startTranscoding()) throw new Error(`${file}: not a readable KTX2 file`)
      const out = new Uint8Array(k.getImageTranscodedSizeInBytes(0, 0, 0, 13))
      if (!k.transcodeImage(out, 0, 0, 0, 13, 0, -1, -1)) throw new Error(`${file}: transcode failed`)
      return { width: k.getWidth(), height: k.getHeight(), levels: k.getLevels(), uastc: k.isUASTC(), rgba: out }
    } finally {
      k.close()
      k.delete()
    }
  }
}

/** PSNR and the largest channel error of the decoded encode against the
    source's own pixels, rows flipped as the library uploads them */
function score(source, decoded) {
  const raw = execFileSync('magick', [source, '-flip', '-depth', '8', 'rgb:-'], { maxBuffer: 1 << 30 })
  let sum = 0, worst = 0
  for (let p = 0, q = 0; p < raw.length; p++, q++) {
    if ((q & 3) === 3) q++
    const d = raw[p] - decoded.rgba[q]
    sum += d * d
    if (Math.abs(d) > worst) worst = Math.abs(d)
  }
  const mse = sum / raw.length
  return { psnr: mse === 0 ? 99 : Math.round(10 * Math.log10((255 * 255) / mse) * 100) / 100, maxError: worst }
}

const decode = await transcoder()
const encoderSha = sha(GLTFPACK)
const made = []
mkdirSync(WORK, { recursive: true })
const manifestPath = join(LIBRARY, 'manifest.json')
const read = () => JSON.parse(readFileSync(manifestPath, 'utf8'))
for (const set of SETS) {
  const entry = read().assets.find((a) => a.id === `library/${set}`)
  if (!entry) throw new Error(`no library record for ${set}`)
  for (const map of entry.maps ?? []) {
    const ext = map === 'albedo' ? 'jpg' : 'png'
    const source = join(LIBRARY, entry.path, `${map}.${ext}`)
    const dir = join(WORK, set, map)
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    copyFileSync(source, join(dir, `${map}.${ext}`))
    writeFileSync(join(dir, 'quad.gltf'), JSON.stringify(quad(`${map}.${ext}`, map)))
    const began = Date.now()
    execFileSync(GLTFPACK, ['-i', 'quad.gltf', '-o', 'out.gltf', ...RECIPE], { cwd: dir, stdio: 'ignore' })
    const file = join(dir, `${map}.ktx2`)
    if (!existsSync(file)) throw new Error(`gltfpack wrote no ${map}.ktx2 for ${set}`)
    const back = decode(file)
    const reading = score(source, back)
    const row = { set, map, seconds: (Date.now() - began) / 1000, sourceBytes: statSync(source).size, bytes: statSync(file).size,
      width: back.width, height: back.height, levels: back.levels, uastc: back.uastc, ...reading }
    made.push(row)
    console.log(`${set.padEnd(16)}${map.padEnd(8)} ${String(row.sourceBytes).padStart(9)} -> ${String(row.bytes).padStart(8)} B  ` +
      `${row.width}x${row.height} ${row.levels} levels  PSNR ${row.psnr} dB  max ${row.maxError}  ${row.seconds} s`)
    if (!GO) continue
    const target = join(LIBRARY, entry.path, `${map}.ktx2`)
    copyFileSync(file, `${target}.part`)
    renameSync(`${target}.part`, target)
    // the manifest is read fresh before every write, and written whole
    const doc = read()
    const set_ = doc.assets.find((a) => a.id === `library/${set}`)
    const sourceRecord = doc.assets.find((a) => a.id === `library/${set}-${map}`)
    const id = `library/${set}-${map}-ktx2`
    const record = {
      id, path: `${entry.path}${map}.ktx2`, class: set_.class, licence: set_.licence, holder: set_.holder,
      source_url: set_.source_url, sha256: sha(target), bytes: statSync(target).size, pixels: row.width * row.height,
      wing: 'library', display: true,
      derived_from: sourceRecord?.id ?? `${entry.path}${map}.${ext}`, source_sha256: sha(source),
      recipe: `gltfpack 1.2 ${RECIPE.join(' ')} (one textured quad, ${map === 'albedo' ? 'baseColorTexture' : map === 'normal' ? 'normalTexture' : 'metallicRoughnessTexture'})`,
      recipe_sha256: encoderSha,
      measured: { psnr_db: row.psnr, max_error: row.maxError, levels: row.levels },
      note: `${map} map of ${set} as Basis UASTC in KTX2, rows flipped to the library's upload orientation`,
    }
    doc.assets = doc.assets.filter((a) => a.id !== id)
    const at = doc.assets.findIndex((a) => a.id === `library/${set}`)
    doc.assets.splice(at, 0, record)
    set_.ktx2 = { ...(set_.ktx2 ?? {}), [map]: { path: record.path, sha256: record.sha256, bytes: record.bytes,
      width: row.width, height: row.height, source_sha256: record.source_sha256 } }
    writeFileSync(`${manifestPath}.part`, `${JSON.stringify(doc, null, 2)}\n`)
    renameSync(`${manifestPath}.part`, manifestPath)
  }
}
const total = (key) => made.reduce((sum, row) => sum + row[key], 0)
console.log(`${made.length} maps, ${total('sourceBytes')} B of sources, ${total('bytes')} B of KTX2, ` +
  `worst PSNR ${Math.min(...made.map((row) => row.psnr))} dB, ${Math.round(total('seconds'))} s${GO ? ', written to the store' : ''}`)
writeFileSync(join(WORK, 'scores.json'), JSON.stringify(made, null, 1))

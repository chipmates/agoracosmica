// THE ROOM, EXPORTED FOR CYCLES.
//
//   FORGE_PORT=5437 node forge/blender/room/export-room.mjs --room=hall --out=<dir>
//   ... --stage=list          the inventory only: meshes, materials, lights
//
// Reads the live wing (a preview server of this checkout's build) at the
// room's stops and writes, into <dir>: the room as glTF (room.gltf, room.bin,
// textures/), every light as data (lights.json), the stops' certified cameras
// in both framings (poses.json), the sky the openings show (sky.hdr), the air
// (air.json), the print (print.json), the material recipes (materials.json)
// and a report of every translation (export.json). See README.md.
import { chromium } from 'playwright'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { APP_ROOT, assertServer, browserArgs, headHere, wingStanding } from '../../rig.mjs'
import { restingPending } from '../../prerender/pending.mjs'
import { STORE } from '../../vite-na-assets.mjs'
import { captureSky, geometryData, installSceneHook, machinesStanding, materialGraphs, scanRoom } from './page-scan.mjs'
import { ROOMS } from './rooms.mjs'
import { ROOM_ROLES, sourceHashes, translateMaterials } from './materials.mjs'
import { mapsFor } from './textures.mjs'
import { assemble } from './assemble.mjs'
import { Gltf } from './gltf.mjs'
import { translateLights } from './lights.mjs'
import { writeSky } from './sky.mjs'
import sharp from 'sharp'

const flags = new Map()
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue
  const at = a.indexOf('=')
  flags.set(at === -1 ? a.slice(2) : a.slice(2, at), at === -1 ? true : a.slice(at + 1))
}
const flag = (n, d) => flags.get(n) ?? d
const PORT = Number(flag('port', process.env['FORGE_PORT'] ?? 5437))
const BASE = `http://127.0.0.1:${PORT}`
const ROOM = String(flag('room', 'hall'))
const STAGE = String(flag('stage', 'export'))
const OUT = resolve(String(flag('out', 'room-export')))
/** `engine` lays each set with the maps the engine really sampled; `full`
 * gives every set all of its store maps (a what-if, reported as such) */
const MAPS = String(flag('maps', 'engine'))
/** the tier the room is read at: `max` is the film's (every machine set with
 * its whole maps), `hero` the live desktop's */
const TIER = String(flag('tier', 'hero'))
const room = ROOMS[ROOM]
if (!room) throw new Error(`no room called ${ROOM}; known: ${Object.keys(ROOMS).join(', ')}`)
const sha = (b) => createHash('sha256').update(b).digest('hex')
/** a number the room takes from the source, `{ file, constant }`, or as written */
function sourceConstant(v) {
  if (typeof v === 'number') return v
  const src = readFileSync(join(APP_ROOT, v.file), 'utf8')
  const m = new RegExp(`const ${v.constant} = ([\\d.]+)`).exec(src)
  if (!m) throw new Error(`no ${v.constant} in ${v.file}`)
  return Number(m[1])
}

async function openRoom(browser, stop) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  await ctx.addInitScript((f) => { try { sessionStorage.setItem(f, '1') } catch { /* seen */ } }, `${room.wing}-welcome`)
  await ctx.addInitScript(installSceneHook)
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`) })
  await page.goto(`${BASE}/w/${room.wing}?probe=1&tier=${TIER}&samples=4#s=${stop}`, { waitUntil: 'load' })
  const said = await page.evaluate(() => document.body.dataset.tier)
  if (said !== TIER) throw new Error(`the page stands at tier ${said}, not ${TIER}`)
  if (!(await wingStanding(page))) throw new Error('the wing never stood')
  await standAt(page, stop)
  const pending = await restingPending(page)
  return { ctx, page, errors, pending }
}

/** Stand at a stop and wait until the eye has stopped moving: the walk eases
 * in for seconds after the station is named. */
async function standAt(page, stop) {
  await page.evaluate((s) => window.__forge.station(s), stop)
  await page.waitForFunction((s) => window.__forge.state().stationId === s && !document.querySelector('[data-walking]'), stop, { timeout: 180000 })
  let last = '', same = 0
  for (let i = 0; i < 240 && same < 6; i++) {
    const cam = await page.evaluate(() => JSON.stringify(window.__forge.state().cam))
    same = cam === last ? same + 1 : 0
    last = cam
    await page.waitForTimeout(250)
  }
}

/** Every machine holding its parts and the library's count at rest (it can
 * rest above zero: an aborted set is neither ready nor missing). */
async function waitForMachines(page, ms = Number(flag('wait', 300000))) {
  const began = Date.now()
  let last = null, same = 0, read
  while (Date.now() - began < ms) {
    read = await page.evaluate(machinesStanding, room.machines)
    const all = Object.values(read.counts).every((n) => n > 0)
    const key = JSON.stringify(read)
    same = key === last ? same + 1 : 0
    last = key
    if (all && same >= 5) return { ...read, seconds: Math.round((Date.now() - began) / 1000) }
    await page.waitForTimeout(2000)
  }
  throw new Error(`the room's machines never stood: ${JSON.stringify(read)}`)
}

const decode = (b64, Kind) => {
  const buf = Buffer.from(b64, 'base64')
  return new Kind(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
}

/** THE CERTIFIED CAMERAS: each stop's rail endpoint for each framing's
 * viewport, on the stage the stills are drawn at (the authored aspect, so the
 * lens is the authored one). The live camera at rest is read back beside it. */
function certifiedPoses(liveCams) {
  const raw = readFileSync(join(APP_ROOT, 'src/wings/vinci/data/rail-clearance.json'))
  const cert = JSON.parse(raw)
  const poses = []
  for (const [framing, f] of Object.entries(room.framings)) {
    for (const stop of room.stops) {
      let pose = null
      for (const r of cert.routes) {
        if (r.viewport !== f.viewport) continue
        if (r.from === stop) pose = r.fromPose
        else if (r.to === stop) pose = r.toPose
        if (pose) break
      }
      if (!pose) throw new Error(`the certificate has no ${f.viewport} pose for ${stop}`)
      poses.push({ id: `${framing}/${stop}`, eye: pose.eye, at: pose.at, fov: pose.fov, fov_mode: 'authored', viewport: f.viewport,
        stage: { width: f.stage[0], height: f.stage[1] }, near: 0.25, far: 1100, kind: 'station' })
    }
  }
  const checks = []
  for (const stop of room.stops) {
    const live = liveCams[stop]
    const p = poses.find((x) => x.id === `wide/${stop}`)
    if (!live || !p) continue
    const [rx, ry] = live.r
    // three's Euler XYZ: the camera looks down the negative third column of
    // Rx Ry Rz, which is (sy, -sx cy, cx cy)
    const fwd = [-Math.sin(ry), Math.sin(rx) * Math.cos(ry), -Math.cos(rx) * Math.cos(ry)]
    const want = p.at.map((v, i) => v - p.eye[i]), l = Math.hypot(...want)
    const angle = Math.acos(Math.min(1, fwd.reduce((s, v, i) => s + (v * want[i]) / l, 0))) * 180 / Math.PI
    checks.push({ stop, framing: 'wide', eyeError_m: Math.hypot(...live.p.map((v, i) => v - p.eye[i])), aimError_deg: angle, liveFov: live.fov, certifiedFov: p.fov })
  }
  return {
    doc: { format: 'museum-poses-v1', coordinate_system: 'three-y-up-metres',
      provenance: { kind: 'certificate-endpoints', certificate: 'src/wings/vinci/data/rail-clearance.json', certificate_sha256: sha(raw),
        certificate_format: cert.format, geometrySha256: cert.geometrySha256, head: headHere(),
        note: 'Stills framings: wide = the desktop pose on a 2400x1350 stage (authored 1280:720), upright = the phone pose on 1170x2532 (authored 390:844); on both the fitted lens is the authored one.',
        liveCheck: checks },
      poses },
    checks,
  }
}

/** THE HALL FLOOR'S FINISH, as its source states it: the fabric's numbers and
 * the bake itself, run here from the same code the page runs, so the map and
 * the tile Cycles reads are the bytes the engine drew. */
async function hallFloor() {
  const { load } = await import('../../../src/wings/vinci/build-in-node.mjs')
  load('src/wings/vinci/collection.ts')
  const fabric = load('src/wings/vinci/collection/hall-fabric.ts')
  const floor = load('src/wings/vinci/collection/hall-floor.ts')
  const began = Date.now()
  const side = TIER === 'calm' ? 1024 : 2048
  const baked = floor.bakeHallFloor(floor.hallFloorPlan(), side)
  const tile = floor.bakeFloorTile(side)
  return {
    set: 'concrete-floor-polished', finish: { ...fabric.FLOOR_FINISH }, bay: { ...floor.HALL_FLOOR_BAY },
    map: { ...floor.HALL_FLOOR_MAP, side: baked.size }, tile: { metres: floor.HALL_FLOOR_TILE, side },
    bytes: { finish: baked.finish, tile }, bakeSeconds: (Date.now() - began) / 1000,
  }
}

/** The floor's map and tile as PNGs, their rows turned so an image's first
 * row is its north (Blender reads v up from an image's last row). */
async function writeFloorMaps(source, dir) {
  mkdirSync(dir, { recursive: true })
  const out = {}
  for (const [name, bytes, side] of [['finish', source.bytes.finish, source.map.side], ['tile', source.bytes.tile, source.tile.side]]) {
    const flipped = Buffer.alloc(bytes.length)
    for (let y = 0; y < side; y++) flipped.set(bytes.subarray((side - 1 - y) * side * 4, (side - y) * side * 4), y * side * 4)
    const file = `hall-floor-${name}.png`
    await sharp(flipped, { raw: { width: side, height: side, channels: 4 } }).png({ compressionLevel: 6 }).toFile(join(dir, file))
    out[name] = { file, sha256: sha(bytes) }
  }
  return out
}

async function main() {
  await assertServer(BASE)
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ args: browserArgs() })
  let scan, sky
  const geoms = {}, liveCams = {}, visibleAt = {}
  try {
    const { page, errors, pending } = await openRoom(browser, room.stops[0])
    const standing = await waitForMachines(page)
    const opts = { marker: room.marker, box: room.box, exclude: room.exclude }
    scan = await page.evaluate(scanRoom, opts)
    scan.standing = standing
    scan.pending = pending
    liveCams[room.stops[0]] = scan.state?.cam
    visibleAt[room.stops[0]] = scan.meshes.map((m) => m.uuid)
    // THE OTHER STOPS: what each one draws (a machine is drawn by distance)
    for (const stop of room.stops.slice(1)) {
      await standAt(page, stop)
      const there = await page.evaluate(scanRoom, opts)
      liveCams[stop] = there.state?.cam
      visibleAt[stop] = there.meshes.map((m) => m.uuid)
      const known = new Set(scan.meshes.map((m) => m.uuid))
      for (const m of there.meshes) if (!known.has(m.uuid)) scan.meshes.push(m)
      for (const [k, v] of Object.entries(there.geometries)) scan.geometries[k] ??= v
      for (const [k, v] of Object.entries(there.materials)) scan.materials[k] ??= v
    }
    scan.graphs = await page.evaluate(materialGraphs, Object.keys(scan.materials))
    scan.errors = errors
    writeFileSync(join(OUT, 'scan.json'), JSON.stringify(scan, null, 1))
    console.log(`meshes ${scan.meshes.length}, materials ${Object.keys(scan.materials).length}, geometries ${Object.keys(scan.geometries).length}, lights ${scan.lights.length}, pending ${pending}`)
    if (STAGE === 'list') return
    for (const uuid of Object.keys(scan.geometries)) {
      const d = await page.evaluate(geometryData, uuid)
      const g = {}
      for (const [name, a] of Object.entries(d.attributes)) g[name] = decode(a.data, Float32Array)
      if (d.index) g.index = decode(d.index, Uint32Array)
      geoms[uuid] = g
    }
    sky = await page.evaluate(captureSky, { marker: room.marker, sky: 'vinci/sky', eye: room.skyEye, size: Number(flag('sky-size', 256)) })
  } finally {
    await browser.close()
  }

  // THE STORE'S RECORDS, by set name (read, never written)
  const storeManifest = JSON.parse(readFileSync(join(STORE, 'library', 'manifest.json'), 'utf8'))
  const store = {}
  for (const e of storeManifest.assets ?? storeManifest) if (/^library\/[a-z-]+$/.test(e.id)) store[e.id.slice(8)] = e
  const floorSource = scan.materials && Object.values(scan.materials).some((m) => m.name === 'vinci/collection-hall-fabric/floor') ? await hallFloor() : null
  const recipes = translateMaterials(scan, store, APP_ROOT, MAPS, floorSource)
  const cache = new Map(), maps = {}
  for (const r of Object.values(recipes)) maps[r.uuid] = await mapsFor(r, STORE, join(OUT, 'textures'), cache)
  for (const r of Object.values(recipes)) if (r.floor) r.floor.files = await writeFloorMaps(floorSource, join(OUT, 'textures'))

  // THE glTF MATERIALS, one per recipe (and one per role of a split surface)
  const gltf = new Gltf(`nightagora forge/blender/room/export-room.mjs @ ${headHere().slice(0, 8)}`)
  const names = new Map(), defs = new Map(), sidecar = {}
  const materialDef = (recipe, key) => {
    const id = `${recipe.uuid}|${key ?? ''}`
    if (defs.has(id)) return defs.get(id)
    let base = names.get(recipe.uuid)
    if (!base) {
      const taken = [...names.values()].filter((n) => n === recipe.name || n.startsWith(`${recipe.name}~`)).length
      base = taken ? `${recipe.name}~${taken}` : recipe.name
      names.set(recipe.uuid, base)
    }
    const name = key ? `${base}#${key}` : base
    const m = maps[recipe.uuid]
    const r = { ...recipe }
    if (key && recipe.split === 'collectionRoomRole') {
      const role = key.replace(/-hall$/, '')
      const row = ROOM_ROLES.roles.find((x) => x[0] === role)
      r.rough = { mode: 'const', value: key.endsWith('-hall') ? ROOM_ROLES.hall.floorRough : row[1] }
      r.metal = row[2]
    }
    const pbr = { metallicFactor: r.metal ?? 0, roughnessFactor: r.rough?.mode === 'const' ? r.rough.value : 1 }
    const def = { name, pbrMetallicRoughness: pbr, doubleSided: Boolean(r.doubleSided) }
    const colour = r.base?.mode === 'flat' ? r.base.tint : m?.albedo?.factor ?? [1, 1, 1]
    pbr.baseColorFactor = [...(colour ?? [1, 1, 1]).slice(0, 3), 1]
    if (m?.albedo) pbr.baseColorTexture = { index: gltf.texture(m.albedo.file) }
    if (m?.orm && r.rough?.mode !== 'const') pbr.metallicRoughnessTexture = { index: gltf.texture(m.orm.file) }
    if (m?.normal && r.normalScale > 0) def.normalTexture = { index: gltf.texture(m.normal.file), scale: r.normalScale }
    if (r.kind === 'emission') {
      const c = r.emission.colour, peak = Math.max(...c)
      pbr.baseColorFactor = [0, 0, 0, 1]
      def.emissiveFactor = c.map((v) => v / peak)
      def.extensions = { KHR_materials_emissive_strength: { emissiveStrength: peak } }
      gltf.use('KHR_materials_emissive_strength')
    }
    if (r.kind === 'thin-glass') { pbr.baseColorFactor[3] = r.opacity; def.alphaMode = 'BLEND'; def.doubleSided = true }
    if (r.coat) {
      def.extensions = { ...(def.extensions ?? {}), KHR_materials_clearcoat: { clearcoatFactor: r.coat.weight, clearcoatRoughnessFactor: r.coat.roughness } }
      gltf.use('KHR_materials_clearcoat')
    }
    const lite = { family: r.family, kind: r.kind, variant: r.variant ?? null, set: r.set?.set ?? null, uv: r.uv ?? null, base: r.base ?? null,
      rough: r.rough ?? null, metal: r.metal ?? 0, normalScale: r.normalScale ?? 0, tone: r.tone ?? null, coat: r.coat ?? null, cloth: r.cloth ?? null,
      opacity: r.opacity ?? null, grazing: r.grazing ?? null, emission: r.emission ?? null, floor: r.floor ?? null,
      hideFromShadow: r.hideFromShadow ?? false, doubleSided: Boolean(r.doubleSided), vertexColour: r.base?.mode === 'vertex', vertexTone: Boolean(r.vertexTone),
      maps: m ? { albedo: m.albedo?.file ?? null, albedoFactor: m.albedo?.factor ?? null, orm: m.orm?.file ?? null, roughnessFactor: m.roughnessFactor, normal: m.normal?.file ?? null } : null }
    def.extras = { na: lite }
    sidecar[name] = { ...lite, engineName: r.name, uuid: r.uuid, translated: r.translated, lost: r.lost }
    const index = gltf.material(def)
    defs.set(id, index)
    return index
  }
  const { placed } = assemble(gltf, scan, geoms, recipes, materialDef)
  const written = gltf.write(OUT, 'room')

  // THE LIGHTS, THE CAMERAS, THE SKY, THE AIR, THE PRINT
  const { lights, elsewhere } = translateLights(scan, APP_ROOT)
  writeFileSync(join(OUT, 'lights.json'), JSON.stringify({ format: 'room-lights-v1', coordinate_system: 'three-y-up-metres', lights, elsewhere }, null, 1))
  const poses = certifiedPoses(liveCams)
  writeFileSync(join(OUT, 'poses.json'), JSON.stringify(poses.doc, null, 1))
  const skyInfo = writeSky(sky, join(OUT, 'sky.hdr'))
  const air = { ...room.air, density: sourceConstant(room.air.density) }
  writeFileSync(join(OUT, 'air.json'), JSON.stringify({
    ...air, densitySource: room.air.density, box: { min: [air.west + air.inset, air.floor + air.inset, -air.north + air.inset], max: [air.east - air.inset, air.top - air.inset, -air.south - air.inset] },
    scattering_per_m: 4 * Math.PI * 0.01 * air.density,
    law: 'engine: in-scatter per metre = 0.01 x density x profile x (the sum of the spots\' lit, shadowed irradiance), added over the room (additive: nothing behind it is dimmed). Cycles: an isotropic scattering medium of coefficient 4 pi x 0.01 x density x profile per metre, the same single-scattered light, extinguished as a real medium extinguishes it.',
    profile: 'density x ((1 - smoothstep(floor, top, y)) x 0.8 + 0.2) x (noise(p x 0.23) x 0.35 + 1)',
  }, null, 1))
  writeFileSync(join(OUT, 'print.json'), JSON.stringify({ ...room.print, law: 'stack/post.ts step 5-7: c = linear x exposure; c += lift x clamp(1 - lum c); c = pow(clamp(c, 0, 8), 1/gamma) x gain; c = mix(c, c x mix(cool, warm, clamp(lum x 1.6)), split); c = mix(lum, c, saturation); c = shoulder ? Khronos PBR Neutral(c) : c; c x= 1 - smoothstep(.34, .86, |uv - .5|) x vignette; sRGB' }, null, 1))
  writeFileSync(join(OUT, 'materials.json'), JSON.stringify(sidecar, null, 1))

  // THE REPORT
  const dirty = execFileSync('git', ['status', '--porcelain', '--', 'src'], { cwd: APP_ROOT }).toString().trim()
  const families = {}
  for (const p of placed) families[p.family] = (families[p.family] ?? 0) + 1
  const report = {
    room: ROOM, title: room.title, maps: MAPS, tier: TIER, head: headHere(), srcDirty: Boolean(dirty), server: BASE, madeAt: new Date().toISOString(),
    standing: scan.standing, texturesPendingAtRest: scan.pending, pageErrors: scan.errors,
    gltf: written, families, placed: placed.length,
    drawnAt: Object.fromEntries(Object.entries(visibleAt).map(([k, v]) => [k, v.length])),
    notDrawnAt: Object.fromEntries(Object.entries(visibleAt).map(([stop, v]) => [stop, scan.meshes.filter((m) => !v.includes(m.uuid)).map((m) => ({ uuid: m.uuid, name: `${m.stamp}/${m.name}` }))])),
    excluded: Object.fromEntries(Object.entries(scan.excluded ?? {}).map(([k, n]) => [k, { meshes: n, why: room.exclude[k] }])),
    skipped: scan.skipped,
    materials: Object.fromEntries(Object.entries(sidecar).map(([k, v]) => [k, { family: v.family, variant: v.variant, set: v.set, translated: v.translated, lost: v.lost }])),
    lights: lights.map((l) => ({ name: l.name, kind: l.kind, intensity: l.intensity, kelvin: l.kelvin, cycles: l.cycles })), lightsElsewhere: elsewhere,
    cameras: poses.checks, sky: skyInfo,
    engineOnly: {
      selectiveLights: 'material.lightsNode gives the hall\'s rig to the hall\'s surfaces only (a sampler ceiling, M50): translated to real lights that light everything; the clerestory is kept off the air by light linking, as the engine keeps it off',
      probe: { ...room.probe, translation: 'dropped: Cycles path-traces the bounce (the engine reads its probe at 1.35 of what it holds; Cycles at what the room holds)' },
      air: 'a ray-marched additive volume: translated to a Cycles scattering volume in the same box (air.json)',
      print: 'the post chain\'s print: the Khronos PBR Neutral view transform at the same exposure, with lift, saturation and vignette applied to the linear render exactly as stack/post.ts orders them (print.json)',
      shadowShell: 'the spots\' maps are drawn from a double of the hall\'s shell on layer 3: not exported, Cycles casts from the real surfaces',
      shadowBody: 'the wing\'s sun-only caster on layer 1: not exported',
      lampShadows: 'fixtures and lamp faces cast no shadow in the engine: kept out of shadow rays in Cycles',
    },
    sources: sourceHashes(APP_ROOT),
  }
  writeFileSync(join(OUT, 'export.json'), JSON.stringify(report, null, 1))
  console.log(`wrote ${OUT}: ${written.nodes} nodes, ${written.meshes} meshes, ${written.materials} materials, ${written.images} images, ${(written.bytes / 1e6).toFixed(1)} MB of buffers`)
  for (const c of poses.checks) console.log(`camera ${c.stop}: eye off by ${c.eyeError_m.toExponential(2)} m, aim off by ${c.aimError_deg.toFixed(4)} deg, fov live ${c.liveFov} certified ${c.certifiedFov}`)
}

main().catch((err) => { console.error(err); process.exit(1) })

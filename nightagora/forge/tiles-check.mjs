// THE TILE CHECK. A pyramid is a technical re-encoding of an admitted file:
// the whole source cut into pieces at its own pixels, no crop, no sharpen,
// no grade. This refuses any pyramid that is something else.
//
//   node forge/tiles-check.mjs [--json] [--quiet]
//
// Two families stand under the same rule: a hung face's plate
// (`painting-tiles`) and a manuscript leaf's scan (`leaf-tiles`). A leaf's
// record does not carry its pixels in its path, so the source file's own
// JPEG header is read and the pyramid measured against it.
//
// What it refuses:
//   · a pyramid whose source_sha256 is not a live admitted source record
//   · a pyramid whose folder is not the source hash's own folder
//   · a deepest level that is not the source's own pixels
//   · a file on disk the viewer will never ask for, or a file the viewer
//     will ask for and is not there
//   · a tree hash that misses the bytes, or a recipe hash that misses the
//     recipe
//   · a licence, holder or class line that is not the plate's own, verbatim
//
// THE URL RULE IS THE VIEWER'S, NOT OURS. The museum builds no tile URL: it
// hands the record to the deep viewer as an IIIF Image API 3 level-0
// service, and the viewer composes every request. So the expected file set
// below is that viewer's own composition rule (IIIFTileSource.getTileUrl,
// version 3, level 0), and this check is what proves the cutter and the
// viewer agree about every last tile of every level.
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { mergeManifests, STORE } from './vite-na-assets.mjs'

const JSON_OUT = process.argv.includes('--json')
const QUIET = process.argv.includes('--quiet') || JSON_OUT

export const TILES_ROLE = 'painting-tiles'
export const LEAF_ROLE = 'leaf-tiles'
const TILES_ID = /^vinci\/painting-tiles\/[a-z0-9-]+$/
const PLATE_ID = /^vinci\/painting-plate\/([a-z0-9-]+?)(?:__[1-9]\d*x[1-9]\d*)?$/
const TILES_PATH = /^paintings\/([a-z0-9-]+)\/tiles\/([a-f0-9]{12})\/$/
const PLATE_PIXELS = /__([1-9]\d*)x([1-9]\d*)\.jpg$/
const LEAF_ID = /^vinci\/leaf-tiles\/([a-z0-9_-]+)$/
const LEAF_PATH = /^msb\/tiles\/([a-f0-9]{12})\/$/
const LEAF_FILE = /^msb\/(?:near\/)?([a-z0-9_-]+?)(?:__[1-9]\d*x[1-9]\d*)?\.jpg$/
export const DEEP_ROLE = 'deep-tiles'
const DEEP_ID = /^vinci\/deep-tiles\/[a-z0-9-]+$/
const DEEP_PATH = /^paintings\/([a-z0-9-]+)\/deep\/([a-f0-9]{12})\/$/
const DEEP_SOURCE_ID = /^vinci\/painting-deep\/([a-z0-9-]+)$/

/** THE THREE FAMILIES, and the source role each is cut from. A hung face's
 * plate carries its pixels in its path and its name among the faces of its
 * work; a leaf carries neither, so its pyramid is named by the file the
 * edition gave it and measured against the scan's own header; a deep source
 * is a held file nobody downloads, so its pyramid ships where it does not. */
export const FAMILIES = {
  [TILES_ROLE]: { prefix: 'vinci/painting-tiles/', from: ['painting-plate'] },
  [LEAF_ROLE]: { prefix: 'vinci/leaf-tiles/', from: ['ms-page', 'ms-page-near'] },
  [DEEP_ROLE]: { prefix: 'vinci/deep-tiles/', from: ['painting-deep'] },
}

/** Which family a source record's pyramid belongs to, or nothing when no
 * pyramid may be cut from it at all. */
export function familyOfSource(record) {
  for (const [family, rule] of Object.entries(FAMILIES)) {
    if (rule.from.includes(record?.role ?? '')) return family
  }
  return null
}

/** The pixels a JPEG says it holds, read from its own frame header. The
 * store's leaf records carry an area and never a shape, and a pyramid that
 * claims the wrong shape would make the ceiling sentence false, so the file
 * itself is asked. */
export function jpegSize(file) {
  const bytes = readFileSync(file)
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let at = 2
  while (at + 3 < bytes.length) {
    if (bytes[at] !== 0xff) { at++; continue }
    const marker = bytes[at + 1]
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { at += 2; continue }
    const length = bytes.readUInt16BE(at + 2)
    // every start-of-frame but the four that carry no size
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: bytes.readUInt16BE(at + 7), height: bytes.readUInt16BE(at + 5) }
    }
    at += 2 + length
  }
  return null
}

/** WHAT A PLATE IS CALLED among the faces of its work, which is what names
 * its pyramid. A policy record carries the name in plate_id; a legacy record
 * carries it in its id, where the reverse is a face of its own and the
 * obverse is the work itself. Two faces share one path, so the path cannot
 * name a pyramid. */
export function plateIdentity(plate) {
  if (plate.plate_id) return plate.plate_id.replace(':', '-')
  const named = PLATE_ID.exec(plate.id ?? '')?.[1]
  if (!named || !plate.work_id) return null
  return named === `${plate.work_id}-reverse` ? named : plate.work_id
}

/** How many halvings the pyramid takes before one tile holds the whole
 * image: the last level is the first whose long edge fits a tile. */
export function scaleFactorsFor(width, height, tileSize) {
  const factors = [1]
  for (;;) {
    const scale = factors[factors.length - 1]
    if (Math.ceil(width / scale) <= tileSize && Math.ceil(height / scale) <= tileSize) return factors
    factors.push(scale * 2)
  }
}

/** Every file the deep viewer will ask this pyramid for, relative to its
 * folder. Level 0 is the coarsest, as the viewer counts them. */
export function expectedTileFiles(width, height, tileSize, scaleFactors) {
  const maxLevel = Math.round(Math.log(Math.max(...scaleFactors)) * Math.LOG2E)
  const files = []
  for (let level = 0; level <= maxLevel; level++) {
    const scale = Math.pow(0.5, maxLevel - level)
    const levelWidth = Math.ceil(width * scale), levelHeight = Math.ceil(height * scale)
    if (levelWidth < tileSize && levelHeight < tileSize) {
      const size = levelWidth === width && levelHeight === height ? 'max' : `${levelWidth},${levelHeight}`
      files.push(`full/${size}/0/default.jpg`)
      continue
    }
    const regionStep = Math.round(tileSize / scale)
    for (let y = 0; y * tileSize < levelHeight; y++) {
      for (let x = 0; x * tileSize < levelWidth; x++) {
        const regionX = x * regionStep, regionY = y * regionStep
        const regionW = Math.min(regionStep, width - regionX), regionH = Math.min(regionStep, height - regionY)
        const region = x === 0 && y === 0 && regionW === width && regionH === height
          ? 'full' : `${regionX},${regionY},${regionW},${regionH}`
        const sizeW = Math.min(tileSize, levelWidth - x * tileSize)
        const sizeH = Math.min(tileSize, levelHeight - y * tileSize)
        const size = sizeW === width && sizeH === height ? 'max' : `${sizeW},${sizeH}`
        files.push(`${region}/${size}/0/default.jpg`)
      }
    }
  }
  return files
}

/** The recipe every pyramid of the store is cut by, written out so the
 * record can carry the sentence and its hash. */
export function tileRecipe(sharpVersion, vipsVersion, tileSize) {
  return `sharp ${sharpVersion} / libvips ${vipsVersion} tile({layout:'iiif3',size:${tileSize},overlap:0}), `
    + 'JPEG q92 4:4:4, no resize, no sharpen, no grade'
}

const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex')

/** Every real file under a folder, relative to it, sorted. */
export function filesUnder(root) {
  const out = []
  const walk = (dir, prefix) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) walk(join(dir, entry.name), rel)
      else out.push(rel)
    }
  }
  walk(root, '')
  return out.sort()
}

/** One hash over every path and every byte of the pyramid, so a record can
 * say the whole tree and not one file. */
export function treeHash(root, files) {
  const digest = createHash('sha256')
  for (const rel of files) digest.update(`${rel} ${sha(join(root, rel))}\n`)
  return digest.digest('hex')
}

export function checkTiles() {
  const { assets, problems } = mergeManifests()
  const errors = problems.slice()
  const byId = new Map(assets.map(entry => [entry.id, entry]))
  const pyramids = assets.filter(entry => Object.values(FAMILIES).some(rule => entry.id.startsWith(rule.prefix)))
  const checked = []
  for (const record of pyramids) {
    const say = message => errors.push(`${record.id}: ${message}`)
    const leaf = record.id.startsWith(FAMILIES[LEAF_ROLE].prefix)
    const deep = record.id.startsWith(FAMILIES[DEEP_ROLE].prefix)
    const mine = leaf ? LEAF_ROLE : deep ? DEEP_ROLE : TILES_ROLE
    const path = (leaf ? LEAF_PATH : deep ? DEEP_PATH : TILES_PATH).exec(record.path ?? '')
    if (leaf) {
      if (!LEAF_ID.test(record.id)) { say('an id is vinci/leaf-tiles/<the scan\'s own file name>'); continue }
      if (!path) { say('a path is msb/tiles/<twelve of the source hash>/'); continue }
    } else if (deep) {
      if (!DEEP_ID.test(record.id)) { say('an id is vinci/deep-tiles/<the deep source\'s own name>'); continue }
      if (!path) { say('a path is paintings/<work>/deep/<twelve of the source hash>/'); continue }
    } else {
      if (!TILES_ID.test(record.id)) { say('an id is vinci/painting-tiles/<plate id>'); continue }
      if (!path) { say('a path is paintings/<work>/tiles/<twelve of the source hash>/'); continue }
    }
    const plate = byId.get(record.derived_from ?? '')
    if (!plate) { say(`derived_from names ${record.derived_from}, which no manifest holds`); continue }
    const family = familyOfSource(plate)
    if (family !== mine) say(`derived_from is a ${plate.role ?? 'record with no role'}, which this family is not cut from`)
    if (record.role !== mine) say(`a pyramid of this family carries role ${mine}`)
    if (deep) {
      const named = DEEP_SOURCE_ID.exec(plate.id ?? '')
      if (!named) say(`the source ${plate.id} is not a vinci/painting-deep record`)
      else if (record.id !== `vinci/deep-tiles/${named[1]}`) say(`the id does not name the deep source, which is ${named[1]}`)
      if (plate.work_id !== path[1]) say(`the folder says ${path[1]}, the source says ${plate.work_id}`)
      // A deep source is held on this machine and never downloaded, so it
      // is display: false and its pyramid is what the museum shows.
      if (plate.display !== false) say('a deep source stays on this machine: display is false')
    } else if (leaf) {
      const named = LEAF_FILE.exec(plate.path ?? '')
      if (!named) say(`the source ${plate.id} does not stand at msb/<file>.jpg`)
      else if (record.id !== `vinci/leaf-tiles/${named[1]}`) say(`the id does not name the scan's own file, which is ${named[1]}`)
      if ((record.page ?? null) !== (plate.page ?? null)) say('page is not the source\'s own page, verbatim')
    } else {
      if (plate.display !== true) say('derived_from is not a displayed plate record')
      if (plate.work_id !== path[1]) say(`the folder says ${path[1]}, the plate says ${plate.work_id}`)
      const identity = plateIdentity(plate)
      if (!identity || record.id !== `vinci/painting-tiles/${identity}`)
        say(`the id does not name the plate's own face, which is ${identity}`)
    }
    if (!/^[a-f0-9]{64}$/.test(record.source_sha256 ?? '') || record.source_sha256 !== plate.sha256)
      say('source_sha256 is not the admitted file\'s own hash')
    if (record.source_sha256?.slice(0, 12) !== path[leaf ? 1 : 2]) say('the folder is not the source hash\'s own folder')
    for (const key of ['class', 'licence', 'holder', 'source_url']) {
      if ((record[key] ?? null) !== (plate[key] ?? null)) say(`${key} is not the plate's own line, verbatim`)
    }
    if (record.display !== true) say('a pyramid the museum shows is display: true')
    // THE DEEPEST LEVEL IS THE SOURCE'S OWN PIXELS. A pyramid cut from a
    // resized copy would make the ceiling sentence false. A plate names its
    // pixels in its path; a leaf's scan is asked for its own frame header.
    if (leaf) {
      const file = join(STORE, 'wing-vinci', plate.path ?? '')
      const size = existsSync(file) ? jpegSize(file) : null
      if (!size) say(`the scan at wing-vinci/${plate.path} cannot be measured`)
      else if (record.width !== size.width || record.height !== size.height)
        say(`the pyramid is ${record.width}x${record.height}, the scan is ${size.width}x${size.height}`)
      if (plate.pixels !== undefined && plate.pixels !== record.width * record.height)
        say(`the source record holds ${plate.pixels} pixels, the pyramid ${record.width * record.height}`)
    } else {
      const pixels = PLATE_PIXELS.exec(plate.path ?? '')
      if (!pixels) say(`the plate ${plate.id} does not name its own pixels`)
      else if (record.width !== Number(pixels[1]) || record.height !== Number(pixels[2]))
        say(`the pyramid is ${record.width}x${record.height}, the source is ${pixels[1]}x${pixels[2]}`)
    }
    const tileSize = record.tile_size
    if (!Number.isSafeInteger(tileSize) || tileSize <= 0) { say('tile_size must be a positive integer'); continue }
    const factors = scaleFactorsFor(record.width, record.height, tileSize)
    if (JSON.stringify(factors) !== JSON.stringify(record.scale_factors ?? []))
      say(`scale factors ${JSON.stringify(record.scale_factors)} are not the pyramid's own ${JSON.stringify(factors)}`)
    if (record.levels !== factors.length) say(`levels says ${record.levels}, the pyramid has ${factors.length}`)
    const root = join(STORE, 'wing-vinci', record.path)
    if (!existsSync(root)) { say(`no pyramid at wing-vinci/${record.path}`); continue }
    const onDisk = filesUnder(root)
    const want = ['info.json', ...expectedTileFiles(record.width, record.height, tileSize, factors)].sort()
    const missing = want.filter(file => !onDisk.includes(file))
    const stray = onDisk.filter(file => !want.includes(file))
    if (missing.length) say(`${missing.length} file(s) the viewer will ask for are not cut: ${missing.slice(0, 3).join(', ')}`)
    if (stray.length) say(`${stray.length} file(s) no viewer will ask for: ${stray.slice(0, 3).join(', ')}`)
    const tiles = onDisk.filter(file => file.endsWith('/default.jpg')).length
    if (record.tiles !== tiles) say(`tiles says ${record.tiles}, the folder holds ${tiles}`)
    const bytes = onDisk.reduce((sum, file) => sum + statSync(join(root, file)).size, 0)
    if (record.bytes !== bytes) say(`bytes says ${record.bytes}, the folder is ${bytes}`)
    if (record.pixels !== record.width * record.height) say('pixels is the source\'s own area')
    const tree = treeHash(root, onDisk)
    if (record.tree_sha256 !== tree) say('tree_sha256 does not match the bytes on disk')
    if (!record.recipe?.trim()) say('a pyramid carries the recipe it was cut by')
    else if (record.recipe_sha256 !== createHash('sha256').update(record.recipe).digest('hex'))
      say('recipe_sha256 does not match the recipe')
    checked.push({ id: record.id, family: mine, work: leaf ? (plate.page ?? plate.path) : path[1],
      tiles, levels: factors.length, bytes, pixels: record.width * record.height, source: plate.id })
  }
  return { pyramids: pyramids.length, checked, errors }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = checkTiles()
  if (!QUIET) {
    for (const row of report.checked) {
      console.log(`${row.id}  ${row.tiles} tiles, ${row.levels} levels, ${(row.bytes / 1e6).toFixed(1)} MB, `
        + `${(row.pixels / 1e6).toFixed(1)} Mpx, from ${row.source}`)
    }
    const count = family => report.checked.filter(row => row.family === family).length
    console.log(`${report.pyramids} pyramid(s) checked: ${count(TILES_ROLE)} plate(s), `
      + `${count(LEAF_ROLE)} leaf/leaves, ${count(DEEP_ROLE)} deep`)
    if (report.errors.length) {
      console.log('TILES CHECK FAILED:')
      for (const error of report.errors) console.log(' ·', error)
    } else console.log('every pyramid cut from its own admitted source, whole, and named')
  }
  if (JSON_OUT) console.log(JSON.stringify({ ...report, ok: report.errors.length === 0 }, null, 2))
  process.exitCode = report.errors.length ? 1 : 0
}

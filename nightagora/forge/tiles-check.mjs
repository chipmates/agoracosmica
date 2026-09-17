// THE TILE CHECK. A pyramid is a technical re-encoding of an admitted file:
// the whole source cut into pieces at its own pixels, no crop, no sharpen,
// no grade. This refuses any pyramid that is something else.
//
//   node forge/tiles-check.mjs [--json] [--quiet]
//
// What it refuses:
//   · a pyramid whose source_sha256 is not a live admitted plate record
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
const TILES_ID = /^vinci\/painting-tiles\/[a-z0-9-]+$/
const PLATE_ID = /^vinci\/painting-plate\/([a-z0-9-]+?)(?:__[1-9]\d*x[1-9]\d*)?$/
const TILES_PATH = /^paintings\/([a-z0-9-]+)\/tiles\/([a-f0-9]{12})\/$/
const PLATE_PIXELS = /__([1-9]\d*)x([1-9]\d*)\.jpg$/

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
  const pyramids = assets.filter(entry => entry.id.startsWith('vinci/painting-tiles/'))
  const checked = []
  for (const record of pyramids) {
    const say = message => errors.push(`${record.id}: ${message}`)
    if (!TILES_ID.test(record.id)) { say('an id is vinci/painting-tiles/<plate id>'); continue }
    const path = TILES_PATH.exec(record.path ?? '')
    if (!path) { say('a path is paintings/<work>/tiles/<twelve of the source hash>/'); continue }
    const plate = byId.get(record.derived_from ?? '')
    if (!plate) { say(`derived_from names ${record.derived_from}, which no manifest holds`); continue }
    if (plate.role !== 'painting-plate' || plate.display !== true) say('derived_from is not a displayed plate record')
    if (plate.work_id !== path[1]) say(`the folder says ${path[1]}, the plate says ${plate.work_id}`)
    const identity = plateIdentity(plate)
    if (!identity || record.id !== `vinci/painting-tiles/${identity}`)
      say(`the id does not name the plate's own face, which is ${identity}`)
    if (!/^[a-f0-9]{64}$/.test(record.source_sha256 ?? '') || record.source_sha256 !== plate.sha256)
      say('source_sha256 is not the admitted file\'s own hash')
    if (record.source_sha256?.slice(0, 12) !== path[2]) say('the folder is not the source hash\'s own folder')
    for (const key of ['class', 'licence', 'holder', 'source_url']) {
      if ((record[key] ?? null) !== (plate[key] ?? null)) say(`${key} is not the plate's own line, verbatim`)
    }
    if (record.display !== true) say('a pyramid the museum shows is display: true')
    // THE DEEPEST LEVEL IS THE SOURCE'S OWN PIXELS. A pyramid cut from a
    // resized copy would make the ceiling sentence false.
    const pixels = PLATE_PIXELS.exec(plate.path ?? '')
    if (!pixels) say(`the plate ${plate.id} does not name its own pixels`)
    else if (record.width !== Number(pixels[1]) || record.height !== Number(pixels[2]))
      say(`the pyramid is ${record.width}x${record.height}, the source is ${pixels[1]}x${pixels[2]}`)
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
    checked.push({ id: record.id, work: path[1], tiles, levels: factors.length, bytes,
      pixels: record.width * record.height, source: plate.id })
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
    console.log(`${report.pyramids} pyramid(s) checked`)
    if (report.errors.length) {
      console.log('TILES CHECK FAILED:')
      for (const error of report.errors) console.log(' ·', error)
    } else console.log('every pyramid cut from its own admitted source, whole, and named')
  }
  if (JSON_OUT) console.log(JSON.stringify({ ...report, ok: report.errors.length === 0 }, null, 2))
  process.exitCode = report.errors.length ? 1 : 0
}

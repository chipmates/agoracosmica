// THE SETS' OWN HEIGHT, for Blender's displacement (tools.py). A library
// set's surface.png carries roughness, occlusion and displacement in red,
// green and blue (the manifest's `packed`); the engine reads only the first
// two. This writes each set's blue channel beside the export as a grey map,
// with its mean (the level the surface keeps), read from the store and never
// written to it.
//
//   node forge/blender/room/heights.mjs --export=<dir>
import sharp from 'sharp'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { STORE } from '../../vite-na-assets.mjs'

export async function writeHeights(exportDir, storeRoot = STORE) {
  const materials = JSON.parse(readFileSync(join(exportDir, 'materials.json'), 'utf8'))
  const manifest = JSON.parse(readFileSync(join(storeRoot, 'library', 'manifest.json'), 'utf8'))
  const records = Object.fromEntries((manifest.assets ?? manifest).map((e) => [e.id, e]))
  const sets = [...new Set(Object.values(materials).map((m) => m.set).filter(Boolean))].sort()
  const out = {}
  mkdirSync(join(exportDir, 'textures'), { recursive: true })
  for (const set of sets) {
    const packed = records[`library/${set}`]?.packed ?? []
    const channel = packed.indexOf('displacement')
    const src = join(storeRoot, 'library', set, 'surface.png')
    if (channel < 0 || !existsSync(src)) { out[set] = null; continue }
    const { data, info } = await sharp(src).extractChannel(channel).raw().toBuffer({ resolveWithObject: true })
    let sum = 0, lo = 255, hi = 0
    for (const v of data) { sum += v; if (v < lo) lo = v; if (v > hi) hi = v }
    const file = `${set}-height.png`
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 1 } }).png({ compressionLevel: 9 }).toFile(join(exportDir, 'textures', file))
    out[set] = { file, channel: 'rgb'[channel], mean: sum / data.length / 255, min: lo / 255, max: hi / 255, size: [info.width, info.height] }
  }
  writeFileSync(join(exportDir, 'heights.json'), JSON.stringify({ format: 'room-heights-v1', law: 'the set\'s displacement channel of surface.png as published, 0..1; the level a surface keeps is the map\'s mean', sets: out }, null, 1))
  return out
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const at = process.argv.find((a) => a.startsWith('--export='))
  if (!at) throw new Error('--export=<dir>')
  const heights = await writeHeights(resolve(at.slice(9)))
  for (const [set, h] of Object.entries(heights)) console.log(set, h ? `${h.file} mean ${h.mean.toFixed(3)} range ${h.min.toFixed(3)}..${h.max.toFixed(3)}` : 'no height')
}

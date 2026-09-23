// A FILMED CLIP'S CAMERA, FOR CYCLES: the frames of a film export's sidecar
// (forge/film/export.mjs, each frame's eye and turn at full precision) as the
// render rig's museum-poses-v1, so Cycles draws the same frames from the same
// eye. A crop box, when given, is written beside it for cycles_room.py --crops.
//
//   node forge/blender/room/film-poses.mjs --sidecar=<clip>.json --frames=1-24 \
//     --stage=2400x1350 --out=<poses.json> [--crop=left,top,width,height --crops-out=<crops.json>]
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const flags = new Map(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const i = a.indexOf('=')
  return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)]
}))
const need = (k) => { const v = flags.get(k); if (v === undefined) throw new Error(`--${k}`); return String(v) }
const sidecar = JSON.parse(readFileSync(resolve(need('sidecar')), 'utf8'))
const [a, b] = need('frames').split('-').map(Number)
const [width, height] = need('stage').split('x').map(Number)
const framing = String(flags.get('framing') ?? sidecar.framing ?? 'wide')
const viewport = framing === 'upright' ? 'phone' : 'desktop'

/** a vector turned by a unit quaternion [x, y, z, w] */
function turn([x, y, z, w], v) {
  const [vx, vy, vz] = v
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx)
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)]
}
const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]]
const unit = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l) }

const poses = [], crops = {}
let worstRoll = 0
for (const f of sidecar.perFrame) {
  if (f.i < a || f.i > b) continue
  if (!f.cam) throw new Error(`frame ${f.i} carries no camera: re-export with this tree's export.mjs`)
  const forward = turn(f.cam.q, [0, 0, -1]), up = turn(f.cam.q, [0, 1, 0])
  // the rig looks at its target with the world's up, as three's lookAt: the
  // camera's own up must agree, or the frame would turn about its axis
  const level = cross(unit(cross(forward, [0, 1, 0])), forward)
  worstRoll = Math.max(worstRoll, Math.acos(Math.min(1, Math.abs(up[0] * level[0] + up[1] * level[1] + up[2] * level[2]))))
  const id = `${framing}/m${String(f.i).padStart(2, '0')}`
  poses.push({ id, eye: f.cam.p, at: f.cam.p.map((c, k) => c + forward[k]), fov: f.cam.fov, fov_mode: 'authored', viewport,
    stage: { width, height }, near: 0.25, far: 1100, kind: 'film-frame', print: f.print })
  if (flags.has('crop')) crops[id] = [String(flags.get('crop')).split(',').map(Number)]
}
if (!poses.length) throw new Error('no frame in that range')
writeFileSync(resolve(need('out')), JSON.stringify({ format: 'museum-poses-v1', coordinate_system: 'three-y-up-metres',
  provenance: { kind: 'film-sidecar', clip: sidecar.clip, framing, frames: [a, b], renderer: sidecar.renderer, worstRollDeg: worstRoll * 180 / Math.PI }, poses }, null, 1))
if (flags.has('crops-out')) writeFileSync(resolve(String(flags.get('crops-out'))), JSON.stringify(crops, null, 1))
console.log(`${poses.length} poses from ${sidecar.clip} ${framing}, frames ${a} to ${b}; the camera's own roll at most ${(worstRoll * 180 / Math.PI).toFixed(4)} degrees`)

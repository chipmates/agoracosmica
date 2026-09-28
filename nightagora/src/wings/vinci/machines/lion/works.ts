/** THE LION'S WORKS, in its rest frame (metres, +z forward, +y up, +x the
 * lion's left): an oak frame inside the shell, a spring barrel with the great
 * wheel on it, two lantern pinions on the crank shafts, cranks and oak rods to
 * levers on the leg axles, a count wheel with its detent, the latch rod and
 * bolt, and the lily carriage on its rack. Every size is the museum's choice.
 */
import {
  BoxGeometry, BufferGeometry, CylinderGeometry, Euler, ExtrudeGeometry, Float32BufferAttribute, Matrix4, Path, Quaternion, Shape, SphereGeometry, Vector3,
} from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { K, ARBOR, LAP_CONE, LEG, PASTERN, SHOULDER_CAP, coneSlope } from './sdf'
import { PINION_STAVES, STEPS, WHEEL_TEETH } from './gait'

/** Where the moving parts turn, in the rest frame. */
export const W = {
  /** the oak side frames stand at +-FX */
  FX: 0.085,
  barrel: { y: ARBOR.y, z: ARBOR.z },
  /** the crank shafts, where each lantern's staves stand in the great wheel's
   * teeth (8 staves at the wheel's own tooth pitch, 16 mm, on a 2 cm circle) */
  fore: { y: ARBOR.y, z: ARBOR.z + 0.136 },
  hind: { y: ARBOR.y, z: ARBOR.z - 0.136 },
  /** the great wheel and its pinions stand outboard of the near side frame, the cranks inboard */
  wheelR: 0.12, wheelX: 0.12, pinionR: 0.02,
  crankR: 0.016, crankX: 0.06,
  /** the leg levers' arms and the rods run in this plane; on the near side
   * the cranks stand outboard of the pinions, so the window shows the rods */
  leverX: 0.07, rodX: 0.073,
  crankXNear: 0.135, rodXNear: 0.142,
  /** each leg lever's pin from its axle at rest (y, z): toward the middle,
   * so the pins stay inside the near flank's opening through the swing */
  leverPin: { fore: [0.08, -0.155], hind: [0.02, 0.19] } as { fore: readonly [number, number]; hind: readonly [number, number] },
  countX: 0.054, countR: 0.055,
  detent: { x: 0.056, y: 0.868, z: -0.118 },
  latch: { y: 0.775, z: 0.5 },
  board: { z: 0.35, y: 0.66375, w: 0.24, h: 0.1875, t: 0.014 },
} as const

type Geo = BufferGeometry
const M = new Matrix4(), Q = new Quaternion(), S = new Vector3(1, 1, 1), P = new Vector3()

/** Texture coordinates in metres, V along the member. */
function scaleUV(g: Geo, su: number, sv: number): Geo {
  const a = g.getAttribute('uv')
  for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * su, a.getY(i) * sv)
  return g
}
/** A box's six faces, each in metres; the long faces run V along local y. */
function metricBox(g: Geo, w: number, h: number, d: number): Geo {
  const a = g.getAttribute('uv')
  // BoxGeometry writes its faces in the order +x, -x, +y, -y, +z, -z, four vertices each
  const size: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k
    a.setXY(i, a.getX(i) * size[f]![0], a.getY(i) * size[f]![1])
  }
  return g
}
/** A geometry placed by position and a rotation about x, y, z (radians). */
function place(g: Geo, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): Geo {
  Q.setFromEuler(new Euler(rx, ry, rz, 'XYZ'))
  M.compose(P.set(x, y, z), Q, S)
  g.applyMatrix4(M)
  return g
}
/** A box between two points, its long axis along the segment. */
function bar(a: readonly number[], b: readonly number[], w: number, d: number): Geo {
  const A = new Vector3(a[0], a[1], a[2]), B = new Vector3(b[0], b[1], b[2])
  const len = A.distanceTo(B)
  const g = metricBox(new BoxGeometry(w, len, d), w, len, d)
  const dir = B.clone().sub(A).normalize()
  Q.setFromUnitVectors(new Vector3(0, 1, 0), dir)
  M.compose(A.clone().add(B).multiplyScalar(0.5), Q, S)
  g.applyMatrix4(M)
  return g
}
/** A cylinder along x. */
function axle(x0: number, x1: number, y: number, z: number, r: number, seg = 16): Geo {
  const g = new CylinderGeometry(r, r, Math.abs(x1 - x0), seg)
  scaleUV(g, 2 * Math.PI * r, Math.abs(x1 - x0))
  g.rotateZ(Math.PI / 2)
  g.translate((x0 + x1) / 2, y, z)
  return g
}
/** Bare position and normal only, so merged pieces agree on attributes. */
function bare(g: Geo): Geo {
  const out = g.index ? g.toNonIndexed() : g
  for (const name of Object.keys(out.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') out.deleteAttribute(name)
  if (!out.getAttribute('uv')) out.setAttribute('uv', new Float32BufferAttribute(new Float32Array(out.getAttribute('position').count * 2), 2))
  if (!out.getAttribute('normal')) out.computeVertexNormals()
  return out
}
export function merge(list: Geo[]): Geo {
  const g = mergeGeometries(list.map(bare), false)
  if (!g) throw new Error('lion works: merge failed')
  g.computeBoundingBox(); g.computeBoundingSphere()
  return g
}

/** A spur wheel in the yz plane (its axle along x), cut from a plate. */
function spur(teeth: number, R: number, rootR: number, width: number, spokes: number, hub: number, rim: number): Geo {
  const s = new Shape()
  for (let i = 0; i < teeth; i++) {
    const a = (k: number): number => ((i + k) / teeth) * Math.PI * 2
    const pt = (ang: number, r: number): [number, number] => [Math.cos(ang) * r, Math.sin(ang) * r]
    if (i === 0) s.moveTo(...pt(a(0), rootR)); else s.lineTo(...pt(a(0), rootR))
    s.lineTo(...pt(a(0.12), R * 0.985)); s.lineTo(...pt(a(0.22), R)); s.lineTo(...pt(a(0.38), R)); s.lineTo(...pt(a(0.48), R * 0.985)); s.lineTo(...pt(a(0.6), rootR))
  }
  s.lineTo(Math.cos(0) * rootR, 0)
  if (spokes > 0) {
    // the plate is crossed out between the spokes, leaving a rim and a hub
    const inner = rootR - rim
    const half = Math.PI / spokes * 0.5 * (1 - spokes * 0.035)
    for (let k = 0; k < spokes; k++) {
      const c = (k + 0.5) * Math.PI * 2 / spokes
      const h = new Path()
      const steps = 10
      for (let j = 0; j <= steps; j++) {
        const ang = c - half * 1.6 + (half * 3.2) * j / steps
        const [x, y] = [Math.cos(ang) * inner, Math.sin(ang) * inner]
        if (j === 0) h.moveTo(x, y); else h.lineTo(x, y)
      }
      for (let j = steps; j >= 0; j--) {
        const ang = c - half * 0.9 + (half * 1.8) * j / steps
        h.lineTo(Math.cos(ang) * hub, Math.sin(ang) * hub)
      }
      s.holes.push(h)
    }
  }
  const g = new ExtrudeGeometry(s, { depth: width, bevelEnabled: true, bevelThickness: width * 0.12, bevelSize: width * 0.12, bevelSegments: 1, curveSegments: 6 })
  g.translate(0, 0, -width / 2)
  g.rotateY(Math.PI / 2)
  return g
}
/** A lantern pinion along x: two discs and round staves, the discs no wider than the staves' reach. */
function lantern(staves: number, r: number, len: number, staveR: number): Geo {
  const parts: Geo[] = []
  for (const x of [-len / 2, len / 2]) parts.push(axle(x - 0.0025, x + 0.0025, 0, 0, r + staveR * 0.9, 20))
  for (let i = 0; i < staves; i++) {
    const a = (i / staves) * Math.PI * 2
    parts.push(axle(-len / 2, len / 2, Math.cos(a) * r, Math.sin(a) * r, staveR, 8))
  }
  return merge(parts)
}

/** The oak frame: two side frames of rails and posts, and the stretchers. */
export function frameGeometry(): Geo {
  const { FX } = W
  const out: Geo[] = []
  // (the top rail a finger under the back's dip behind the withers)
  const t = 0.034, top = 0.942
  // the bottom rails rise toward the rear as the belly tucks up before the stifle
  const bottom = (z: number): number => 0.625 + 0.055 * (0.24 - z) / 0.48
  for (const sx of [1, -1]) {
    const x = sx * FX
    out.push(bar([x, top, -0.36], [x, top, 0.3], t, 0.04))
    out.push(bar([x, bottom(-0.24), -0.24], [x, bottom(0.24), 0.24], t, 0.036))
    // posts at the arbors; on the near side none at the barrel's, where the great wheel turns
    for (const z of [W.hind.z, W.barrel.z, W.fore.z]) if (sx < 0 || z !== W.barrel.z) out.push(bar([x, bottom(z) - 0.018, z], [x, top + 0.02, z], t, 0.036))
    // the two braces that stiffen the far side frame; the near frame stays open to the window
    if (sx < 0) {
      out.push(bar([x, bottom(0.22), 0.22], [x, top, 0.3], t * 0.8, 0.026))
      out.push(bar([x, top, -0.34], [x, bottom(-0.22) + 0.05, -0.22], t * 0.8, 0.026))
    }
  }
  for (const [y, z] of [[top, 0.3], [top, -0.36], [bottom(0.24), 0.24], [bottom(-0.24), -0.24]] as const)
    out.push(bar([-FX - 0.017, y, z], [FX + 0.017, y, z], 0.036, 0.036))
  // the frame hangs from the shell on four oak cleats, each ending in the
  // shell's inner face; over the rump the body is lower and narrower
  for (const [z, reach, y0, y1] of [[0.28, 0.07, top + 0.02, top + 0.035], [-0.34, 0.058, top, top - 0.028]] as const)
    for (const sx of [1, -1]) out.push(bar([sx * FX, y0, z], [sx * (FX + reach), y1, z], 0.03, 0.03))
  return merge(out)
}
/** Iron fittings fixed to the frame: bearing plates at every arbor, pins. */
export function frameIronGeometry(): Geo {
  const out: Geo[] = []
  for (const sx of [1, -1]) {
    // the bearing plates on the rails' outer faces; the near ones thin, under the pinions
    const x = sx * (W.FX + (sx > 0 ? 0.0195 : 0.018)), h = sx > 0 ? 0.002 : 0.003
    for (const a of [W.hind, W.barrel, W.fore]) if (sx < 0 || a !== W.barrel) out.push(axle(x - h, x + h, a.y, a.z, 0.022, 20))
    // the barrel's near bearing: an iron cock hung from the top rail, between the frame and the wheel
    if (sx > 0) {
      const cx = W.FX + 0.0195
      out.push(bar([cx, 0.945, W.barrel.z], [cx, W.barrel.y, W.barrel.z], 0.004, 0.026))
      out.push(axle(cx - 0.0025, cx + 0.0025, W.barrel.y, W.barrel.z, 0.02, 20))
      out.push(bar([W.FX + 0.012, 0.95, W.barrel.z - 0.024], [W.FX + 0.012, 0.95, W.barrel.z + 0.024], 0.012, 0.012))
    }
    // the detent's stud on the near frame, and its bracket
    if (sx > 0) out.push(bar([W.FX, 0.93, W.detent.z], [W.detent.x, W.detent.y, W.detent.z], 0.01, 0.014))
  }
  out.push(axle(W.detent.x - 0.012, W.FX, W.detent.y, W.detent.z, 0.006, 10))
  return merge(out)
}

/** The spring barrel with its cover and teeth-free drum, turning on the arbor. */
export function barrelGeometry(): Geo {
  const { y, z } = W.barrel
  return merge([
    axle(-0.05, 0.028, y, z, 0.07, 32),
    axle(-0.055, -0.05, y, z, 0.074, 32),
    axle(0.028, 0.033, y, z, 0.074, 32),
    axle(0.033, W.wheelX, y, z, 0.016, 16),
  ])
}
/** The great wheel, fixed to the barrel. */
export function greatWheelGeometry(): Geo {
  const g = spur(WHEEL_TEETH, W.wheelR, W.wheelR - 0.012, 0.012, 4, 0.028, 0.02)
  // turned a fifth of a tooth, so at rest a gap faces each lantern's stave
  g.rotateX(0.2 * Math.PI * 2 / WHEEL_TEETH)
  g.translate(W.wheelX, W.barrel.y, W.barrel.z)
  return g
}
/** The count wheel, fixed to the barrel: a shallow notch for every step and
 * a deep one where the walk ends. */
export function countWheelGeometry(): Geo {
  const s = new Shape(), R = W.countR, n = 120
  // the detent stands at the top of the wheel; the wheel turns so that the
  // rim under it runs from the top backwards over the walk's half turn
  const notch = (ang: number): number => {
    let depth = 0
    for (let k = 1; k <= STEPS; k++) {
      const at = Math.PI / 2 + (k / STEPS) * Math.PI * (k === STEPS ? 1 : 1)
      const d = Math.abs(Math.atan2(Math.sin(ang - at), Math.cos(ang - at)))
      const width = k === STEPS ? 0.12 : 0.07
      const deep = k === STEPS ? 0.03 : 0.006
      if (d < width) depth = Math.max(depth, deep * (1 - (d / width) ** 4))
    }
    return depth
  }
  for (let i = 0; i <= n; i++) {
    const ang = (i / n) * Math.PI * 2
    const r = R - notch(ang)
    if (i === 0) s.moveTo(Math.cos(ang) * r, Math.sin(ang) * r); else s.lineTo(Math.cos(ang) * r, Math.sin(ang) * r)
  }
  const hole = new Path(); hole.absarc(0, 0, 0.012, 0, Math.PI * 2, true); s.holes.push(hole)
  const g = new ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: false, curveSegments: 4 })
  g.translate(0, 0, -0.003)
  // the wheel's own axis is x; the rest frame's +y maps to the shape's +y
  g.rotateY(Math.PI / 2)
  g.translate(W.countX, W.barrel.y, W.barrel.z)
  return g
}
/** The winding arbor, its ratchet and the key, which turn together. */
export function keyGeometry(): Geo {
  const { y, z } = W.barrel
  const out: Geo[] = [axle(-0.06, 0.17, y, z, 0.009, 12)]
  // the square the key fits, and the key's own shank and bow close outside the flank
  out.push(place(new BoxGeometry(0.05, 0.016, 0.016), 0.19, y, z))
  out.push(axle(0.212, 0.232, y, z, 0.011, 12))
  // the bow lies in a plane through the shank, where the fingers grip it
  const bow = new Shape()
  bow.absellipse(0, 0, 0.058, 0.044, 0, Math.PI * 2, false, 0)
  const eye = new Path(); eye.absellipse(0, 0, 0.038, 0.025, 0, Math.PI * 2, true, 0); bow.holes.push(eye)
  const bg = new ExtrudeGeometry(bow, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 16 })
  bg.translate(0.285, y, z - 0.004)
  out.push(bg)
  // the ratchet on the far side of the barrel
  out.push(spur(18, 0.045, 0.036, 0.006, 0, 0, 0).translate(-0.066, y, z))
  return merge(out)
}
/** The ratchet's click, fixed to the far frame. */
export function clickGeometry(): Geo {
  const { y, z } = W.barrel
  return merge([bar([-0.066, y + 0.075, z + 0.06], [-0.066, y + 0.043, z + 0.012], 0.006, 0.01), axle(-0.085, -0.062, y + 0.075, z + 0.06, 0.005, 8)])
}
/** A crank shaft: the lantern pinion, the shaft and its two cranks, 180
 * degrees apart, the left crank pin at angle zero pointing up. */
export function shaftGeometry(at: { y: number; z: number }): { iron: Geo; brass: Geo } {
  const { y, z } = at
  const iron: Geo[] = [axle(-W.FX - 0.022, W.crankXNear + 0.006, y, z, 0.008, 12)]
  for (const sx of [1, -1]) {
    const x = sx > 0 ? W.crankXNear : -W.crankX
    const pinY = y + sx * W.crankR
    iron.push(bar([x, y, z], [x, pinY, z], 0.008, 0.02))
    iron.push(axle(x - 0.002 * sx, x + 0.016 * sx, pinY, z, 0.0055, 10))
  }
  const brass = lantern(PINION_STAVES, W.pinionR, 0.02, 0.0045).translate(W.wheelX, y, z)
  return { iron: merge(iron), brass }
}
/** An oak rod of this length along +z from its own origin, with its iron
 * strap and the slot the crank pin rides in at the far end. */
export function rodGeometry(length: number): { oak: Geo; iron: Geo } {
  const oak = bar([0, 0, 0.01], [0, 0, length - 0.035], 0.016, 0.026)
  const iron = merge([
    bar([0, 0.017, length - 0.05], [0, 0.017, length + 0.03], 0.018, 0.006),
    bar([0, -0.017, length - 0.05], [0, -0.017, length + 0.03], 0.018, 0.006),
    bar([0, 0, length + 0.03], [0, 0, length + 0.036], 0.018, 0.04),
    axle(-0.012, 0.012, 0, 0, 0.007, 10),
  ])
  return { oak, iron }
}
/** An iron lever on a leg's axle, from the axle to its pin. */
export function leverGeometry(pivot: readonly number[], side: number, fore: boolean): Geo {
  const lx = side > 0 ? W.rodXNear : W.leverX, x = side * lx
  const [dy, dz] = fore ? W.leverPin.fore : W.leverPin.hind
  const py = pivot[1]! + dy, pz = pivot[2]! + dz
  return merge([
    axle(side * (lx - 0.02), side * 0.165, pivot[1]!, pivot[2]!, 0.014, 16),
    bar([x, pivot[1]!, pivot[2]!], [x, py, pz], 0.008, 0.022),
    axle(x - 0.012, x + 0.012, py, pz, 0.006, 10),
  ])
}
/** The detent: an arm that rides the count wheel, and the short upright arm
 * the latch rod hangs from. Built about its own pivot. */
export function detentGeometry(): Geo {
  const rimTop = W.barrel.y + W.countR
  const d = W.detent
  const tip: [number, number, number] = [W.countX, rimTop + 0.004, W.barrel.z + 0.008]
  return merge([
    bar([W.countX, d.y, d.z], tip, 0.006, 0.012),
    bar([W.countX, d.y, d.z], [W.countX, d.y + 0.05, d.z - 0.004], 0.006, 0.01),
    axle(W.countX - 0.006, W.countX + 0.006, d.y, d.z, 0.009, 12),
  ].map(g => g.translate(-W.countX, -d.y, -d.z)))
}
/** The latch rod, from the detent's upright arm to the chest's bell crank. */
export function latchRodGeometry(): Geo {
  const d = W.detent
  return bar([W.countX, d.y + 0.048, d.z - 0.004], [W.countX, W.latch.y + 0.03, W.latch.z - 0.02], 0.005, 0.005)
}
/** The latch bolt that holds both doors from inside, built about its own
 * top: a bar with its catch across the doors' meeting edges. Released, it
 * lifts clear into the shell above the opening. */
export function latchGeometry(): Geo {
  return merge([
    place(new BoxGeometry(0.016, 0.05, 0.01), 0, -0.025, 0),
    place(new BoxGeometry(0.07, 0.012, 0.012), 0, -0.044, 0),
  ])
}
/** The lily carriage: the blue board standing in an oak sill, its rack under
 * the sill, and the lily barrel and pinion that drive it. The rack runs along z. */
export function carriageGeometry(): { board: Geo; sill: Geo; rack: Geo } {
  const b = W.board
  const board = place(new BoxGeometry(b.w, b.h, b.t), 0, b.y, b.z)
  const sy = b.y - b.h / 2 - 0.007
  const sill = place(metricBox(new BoxGeometry(b.w + 0.012, 0.014, 0.034), b.w + 0.012, 0.014, 0.034), 0, sy, b.z)
  // the rack runs near the midline, so the pinion and barrel beside it stay inside the chest's narrow floor
  const rack: Geo[] = [place(new BoxGeometry(0.012, 0.012, 0.19), 0.017, 0.557, b.z - 0.03)]
  for (let i = 0; i < 16; i++) rack.push(place(new BoxGeometry(0.006, 0.01, 0.005), 0.026, 0.557, b.z - 0.12 + i * 0.012))
  return { board, sill, rack: merge(rack) }
}
export function lilyPinionGeometry(): Geo {
  const g = spur(8, 0.022, 0.016, 0.012, 0, 0, 0)
  g.rotateZ(Math.PI / 2)
  return merge([g, place(new CylinderGeometry(0.004, 0.004, 0.06, 8), 0, -0.02, 0)])
}
export const LILY_PINION_AT = { x: 0.05, y: 0.557, z: 0.36 }
/** The lily barrel behind the chest's back wall, its arbor through the wall
 * to the pinion under the carriage. */
export const LILY_BARREL_AT = { x: 0.05, y: 0.585, z: 0.228 }
export function lilyBarrelGeometry(): Geo {
  return merge([
    place(new CylinderGeometry(0.026, 0.026, 0.04, 20), LILY_BARREL_AT.x, LILY_BARREL_AT.y, LILY_BARREL_AT.z),
    bar([LILY_BARREL_AT.x, 0.557, LILY_BARREL_AT.z], [LILY_PINION_AT.x, 0.557, LILY_PINION_AT.z - 0.012], 0.006, 0.006),
    place(new CylinderGeometry(0.004, 0.004, 0.05, 8), LILY_BARREL_AT.x, 0.575, LILY_BARREL_AT.z),
  ])
}

/** The front three lilies, two over one as the royal arms of 1515 have them,
 * and four smaller ones behind: positions on the board, scale, lean. */
export const LILIES: readonly { x: number; y: number; z: number; s: number; back: boolean }[] = [
  { x: -0.054, y: 0.68, z: 0.012, s: 0.6, back: false },
  { x: 0.054, y: 0.68, z: 0.012, s: 0.6, back: false },
  { x: 0, y: 0.603, z: 0.012, s: 0.6, back: false },
  { x: -0.088, y: 0.698, z: 0.001, s: 0.34, back: true },
  { x: 0.088, y: 0.698, z: 0.001, s: 0.34, back: true },
  { x: -0.088, y: 0.594, z: 0.001, s: 0.34, back: true },
  { x: 0.088, y: 0.594, z: 0.001, s: 0.34, back: true },
]

/** A forged strap along a path in the xz plane at height y, lying on its
 * outer side: t thick, w wide (y) times the profile at each station's share of its length. */
function strapRibbon(path: readonly (readonly [number, number])[], y: number, w: number, t: number, prof: (u: number) => number): Geo {
  const n = path.length, pos: number[] = [], idx: number[] = []
  const len: number[] = [0]
  for (let i = 1; i < n; i++) len.push(len[i - 1]! + Math.hypot(path[i]![0] - path[i - 1]![0], path[i]![1] - path[i - 1]![1]))
  const L = len[n - 1]!
  // per station: the outward normal in xz (the path's tangent turned a quarter), the half width
  const st = path.map((p, i) => {
    const a = path[Math.max(i - 1, 0)]!, b = path[Math.min(i + 1, n - 1)]!
    const tx = b[0] - a[0], tz = b[1] - a[1], tl = Math.hypot(tx, tz) || 1
    const hw = (w / 2) * prof(len[i]! / L)
    return { x: p[0], z: p[1], nx: tz / tl, nz: -tx / tl, hw }
  })
  // four sides, each with its own vertices so the edges stay crisp: outer, top, inner, bottom
  const corner = (s: typeof st[number], o: number, u: number): [number, number, number] =>
    [s.x + s.nx * o * t / 2, y + u * s.hw, s.z + s.nz * o * t / 2]
  const sides: [number, number, number, number][] = [[1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1], [-1, -1, 1, -1]]
  for (const [o0, u0, o1, u1] of sides) {
    const base = pos.length / 3
    for (const s of st) pos.push(...corner(s, o0, u0), ...corner(s, o1, u1))
    for (let i = 0; i + 1 < n; i++) { const k = base + i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3) }
  }
  // the two ends
  for (const [i, flip] of [[0, true], [n - 1, false]] as const) {
    const s = st[i]!, base = pos.length / 3
    pos.push(...corner(s, 1, -1), ...corner(s, 1, 1), ...corner(s, -1, 1), ...corner(s, -1, -1))
    if (flip) idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
    else idx.push(base, base + 2, base + 1, base, base + 3, base + 2)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  const flat = g.toNonIndexed()
  flat.computeVertexNormals()
  return flat
}
/** The doors' strap hinges, on their outer faces: from each outer knuckle a
 * forged strap runs in across the breast, lying on the carving (surfZ: the
 * +x door's outer face at (x, y), rest frame), three nails along it. In the
 * rest frame, for the door on side. */
export function doorStrapGeometry(surfZ: (x: number, y: number) => number, side: number): Geo {
  const out: Geo[] = []
  const w = 0.016, t = 0.0032, reach = 0.088
  const [hx, hy, hz] = K.HINGE
  // drawn down from the knuckle, then a spade: a swelling and a blunt point
  const spade = (u: number): number => u < 0.78 ? 1 - 0.4 * u / 0.78
    : u < 0.88 ? 0.6 + 0.3 * Math.sin(Math.PI / 2 * (u - 0.78) / 0.1)
      : 0.9 - 0.72 * Math.pow((u - 0.88) / 0.12, 0.8)
  for (const dy of [-0.056, 0.056]) {
    const y = hy + dy
    // the face across the strap's width, its upper envelope smoothed so the strap
    // bends with the carving and not with the lookup's 4 mm cells
    const xs: number[] = []
    for (let x = hx - 0.008; x >= hx - reach - 1e-6; x -= 0.002) xs.push(x)
    const raw = xs.map(x => Math.max(surfZ(x, y - w / 2), surfZ(x, y), surfZ(x, y + w / 2)))
    const env = raw.map((_, i) => Math.max(...raw.slice(Math.max(i - 2, 0), i + 3)))
    const smooth = env.map((_, i) => { const win = env.slice(Math.max(i - 3, 0), i + 4); return win.reduce((a, b) => a + b, 0) / win.length })
    const path: [number, number][] = [[hx, hz]]
    xs.forEach((x, i) => path.push([x, Math.max(smooth[i]!, raw[i]!) + t / 2 + 0.0005]))
    const strap = strapRibbon(path, y, w, t, spade)
    out.push(strap)
    // nails, domed, standing on the strap's outer face, the last in the spade
    for (const k of [0.3, 0.56, 0.86]) {
      const i = Math.round(k * (path.length - 1)), p = path[i]!, q = path[Math.min(i + 1, path.length - 1)]!, o = path[Math.max(i - 1, 0)]!
      const tx = q[0] - o[0], tz = q[1] - o[1], tl = Math.hypot(tx, tz) || 1
      const nrm = new Vector3(tz / tl, 0, -tx / tl)
      const d = new SphereGeometry(0.0032, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2)
      d.scale(1, 0.6, 1)
      d.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), nrm))
      d.translate(p[0] + nrm.x * t / 2, y, p[1] + nrm.z * t / 2)
      out.push(d)
    }
  }
  const g = merge(out.map(x => x.index ? x.toNonIndexed() : x))
  return side > 0 ? g : mirrorX(g)
}
/** Iron hinge pins and knuckles for a door, about the hinge axis. */
export function hingeGeometry(): Geo {
  const out: Geo[] = [new CylinderGeometry(0.0075, 0.0075, 0.16, 12)]
  // the barrel in three knuckles round the pin, capped
  for (const y of [-0.056, 0, 0.056]) out.push(place(new CylinderGeometry(0.0145, 0.0145, 0.042, 16), 0, y, 0))
  return merge(out)
}

/* THE LEGS' IRON, cut and forged, not carved: at each knee and wrist a
 * two-leaf hinge (the upper piece's leaf ends in an eye round the pin, the
 * lower piece's leaf is cranked up over it), a domed pin head on top, nails
 * in the leaves; at the shoulder an iron bearing plate round the pin. Each
 * piece in the rest frame of the part it is nailed to, the +x side. */
const IRON_T = 0.0036
type YZ = readonly [number, number]
const unitYZ = (a: YZ, b: YZ): YZ => { const y = b[0] - a[0], z = b[1] - a[1], l = Math.hypot(y, z); return [y / l, z / l] }
/** A shape in its own plane mapped onto the leg's side: shape x along dir,
 * shape y across it, the extrusion out along +x from the back face x0. */
function onSide(g: Geo, at: YZ, dir: YZ, x0: number): Geo {
  const perp: YZ = [-dir[1], dir[0]]
  g.applyMatrix4(new Matrix4().set(
    0, 0, 1, x0,
    dir[0], perp[0], 0, at[0],
    dir[1], perp[1], 0, at[1],
    0, 0, 0, 1))
  return g
}
function extrude(s: Shape, t: number): Geo {
  const b = 0.0007
  const g = new ExtrudeGeometry(s, { depth: t - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 18 })
  g.translate(0, 0, b)
  return g
}
type LeafEnd = 'round' | 'spade' | 'disc' | 'point'
/** A leaf: an eye of radius re at the origin (or a straight start at from),
 * a strap to length len, w0 wide at the eye and w1 before its end; the end
 * forged round, as a spade, a disc or a blunt point. */
function leafShape(len: number, w0: number, w1: number, re: number, from = 0, end: LeafEnd = 'round'): Shape {
  const h0 = w0 / 2, h1 = w1 / 2
  const s = new Shape()
  const uA = Math.sqrt(Math.max(re * re - h0 * h0, 0))
  if (from <= 0) {
    const thA = Math.atan2(h0, uA)
    s.moveTo(uA, h0)
    s.absarc(0, 0, re, thA, 2 * Math.PI - thA, false)
  } else {
    s.moveTo(from, h0)
    s.lineTo(from, -h0)
  }
  // out along the lower edge, round the end, back along the upper
  if (end === 'disc') {
    const hd = h1 * 1.55, c = len - hd, a = Math.asin(h1 / hd)
    s.lineTo(c - hd * Math.cos(a), -h1)
    s.absarc(c, 0, hd, -Math.PI + a, Math.PI - a, false)
  } else if (end === 'spade') {
    const hs = h1 * 1.45, b = len - 0.03, m = len - 0.014
    s.lineTo(b, -h1)
    s.quadraticCurveTo(m - 0.006, -hs * 1.1, m, -hs)
    s.quadraticCurveTo(len - 0.004, -hs * 0.55, len - 0.0012, -0.0012)
    s.quadraticCurveTo(len, 0, len - 0.0012, 0.0012)
    s.quadraticCurveTo(len - 0.004, hs * 0.55, m, hs)
    s.quadraticCurveTo(m - 0.006, hs * 1.1, b, h1)
  } else if (end === 'point') {
    s.lineTo(len - 0.016, -h1)
    s.lineTo(len - 0.0016, -0.0014)
    s.quadraticCurveTo(len, 0, len - 0.0016, 0.0014)
    s.lineTo(len - 0.016, h1)
  } else {
    s.lineTo(len - h1, -h1)
    s.absarc(len - h1, 0, h1, -Math.PI / 2, Math.PI / 2, false)
  }
  s.lineTo(from <= 0 ? uA : from, h0)
  return s
}
/** Where a leaf of this end is nailed, as distances from its eye: the
 * forged ends carry a nail of their own. */
function leafNails(len: number, w1: number, end: LeafEnd): number[] {
  if (end === 'spade') return [len * 0.42, len * 0.64, len - 0.014]
  if (end === 'disc') return [len * 0.46, len * 0.68, len - w1 * 0.775]
  if (end === 'point') return [len * 0.5, len * 0.76]
  return [len * 0.56, len * 0.85]
}
/** A domed head (a pin's or a nail's) standing on x = x0 at (y, z). */
function dome(r: number, h: number, x0: number, at: YZ, seg = 16): Geo {
  const g = new SphereGeometry(r, seg, Math.max(4, seg >> 1), 0, Math.PI * 2, 0, Math.PI / 2)
  g.scale(1, h / r, 1)
  g.rotateZ(-Math.PI / 2)
  g.translate(x0, at[0], at[1])
  return g
}
/** A forged square boss w across and t thick, standing on x = x0 at (y, z), one side along dir. */
function boss(w: number, t: number, x0: number, at: YZ, dir: YZ): Geo {
  const h = w / 2, c = 0.004
  const s = new Shape()
  s.moveTo(-h + c, -h); s.lineTo(h - c, -h); s.quadraticCurveTo(h, -h, h, -h + c); s.lineTo(h, h - c)
  s.quadraticCurveTo(h, h, h - c, h); s.lineTo(-h + c, h); s.quadraticCurveTo(-h, h, -h, h - c); s.lineTo(-h, -h + c)
  s.quadraticCurveTo(-h, -h, -h + c, -h)
  const g = new ExtrudeGeometry(s, { depth: t - 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0025, bevelSegments: 3, curveSegments: 4 })
  g.translate(0, 0, 0.002)
  return onSide(g, at, dir, x0)
}
function disc(r: number, t: number, x0: number, at: YZ, seg = 28): Geo {
  const s = new Shape(); s.absarc(0, 0, r, 0, Math.PI * 2, false)
  const g = extrude(s, t)
  g.rotateY(Math.PI / 2)
  g.translate(x0, at[0], at[1])
  return g
}
/** Bend iron laid on x = xo onto the lap's cone about pin (sdf.ts LAP_CONE):
 * each point sinks by slope times its distance from the pin, to the cone's floor. */
function bendToCone(g: Geo, pin: YZ, slope: number): Geo {
  if (!slope) return g
  const a = g.getAttribute('position')
  for (let i = 0; i < a.count; i++) {
    const r = Math.hypot(a.getY(i) - pin[0], a.getZ(i) - pin[1])
    a.setX(i, a.getX(i) - Math.min(slope * r, LAP_CONE))
  }
  g.computeVertexNormals()
  return g
}
/** One hinge across a joint at pin (yz), the faces there at x = xo: the
 * upper leaf up along upDir, the lower leaf (cranked over the upper's eye)
 * down along downDir, bent to the faces' cone (slope), both leaves ending in
 * the joint's own forged end. Returns the upper piece's iron and the lower's. */
function hinge(pin: YZ, xo: number, upDir: YZ, upLen: number, downDir: YZ, downLen: number, w: number, slope = 0, end: LeafEnd = 'round'): { up: Geo[]; down: Geo[] } {
  const re = w * 0.78, crank = re + 0.008, w1 = w * 0.78
  const up = [onSide(extrude(leafShape(upLen, w, w1, re, 0, end), IRON_T), pin, upDir, xo)]
  const at = (d: YZ, u: number): YZ => [pin[0] + d[0] * u, pin[1] + d[1] * u]
  for (const u of leafNails(upLen, w1, end)) up.push(dome(0.0042, 0.0026, xo + IRON_T, at(upDir, u), 10))
  const down = [
    onSide(extrude(leafShape(crank, w, w, re), IRON_T), pin, downDir, xo + IRON_T),
    onSide(extrude(leafShape(downLen, w, w1, re, crank - 0.006, end), IRON_T), pin, downDir, xo),
    // the crank's ramp, a short wedge from the lower level to the upper
    onSide(extrude(leafShape(crank + 0.002, w * 0.96, w * 0.96, re, crank - 0.01), IRON_T * 1.6), pin, downDir, xo + IRON_T * 0.4),
    disc(0.0125, 0.002, xo + 2 * IRON_T, pin, 20),
    dome(0.0105, 0.0055, xo + 2 * IRON_T + 0.002, pin, 18),
  ]
  for (const u of leafNails(downLen, w1, end)) if (u > crank) down.push(dome(0.0042, 0.0026, xo + IRON_T, at(downDir, u), 10))
  return { up: up.map(g => bendToCone(g, pin, slope)), down: down.map(g => bendToCone(g, pin, slope)) }
}
/** A merged geometry mirrored through x = 0, its triangles turned back. */
function mirrorX(g: Geo): Geo {
  for (const name of ['position', 'normal']) {
    const a = g.getAttribute(name)
    if (a) for (let i = 0; i < a.count; i++) a.setX(i, -a.getX(i))
  }
  for (const a of Object.values(g.attributes)) {
    const arr = a.array, n = a.itemSize
    for (let t = 0; t + 2 < a.count; t += 3) for (let c = 0; c < n; c++) {
      const i1 = (t + 1) * n + c, i2 = (t + 2) * n + c
      const tmp = arr[i1]!; arr[i1] = arr[i2]!; arr[i2] = tmp
    }
  }
  return g
}
/** A leg's iron (the +x side): for the upper piece in the rest frame, the
 * lower piece in the rest frame, the paw in its own frame. The bearing
 * pin's head on the upper's plate, a hinge across each lap. */
export function legIron(fore: boolean): { upper: Geo; lower: Geo; paw: Geo } {
  const hip3 = fore ? K.SH : K.HP, knee3 = fore ? K.KF : K.KH, wrist3 = fore ? K.WF : K.WH
  const knee = fore ? LEG.fore.elbow : LEG.hind.stifle, wrist = fore ? LEG.fore.wrist : LEG.hind.hock
  const HIP: YZ = [hip3[1], hip3[2]], KN: YZ = [knee3[1], knee3[2]], WR: YZ = [wrist3[1], wrist3[2]]
  // only the pin's forged head shows on the carving: on the shoulder's cap a
  // low dome over a washer, flush under the mane's clearance; on the haunch a
  // square boss, set along the thigh
  const upper: Geo[] = fore
    ? [disc(0.022, IRON_T, SHOULDER_CAP.top + 0.0005 - IRON_T, HIP, 24), dome(0.016, 0.0035, SHOULDER_CAP.top + 0.0005, HIP, 20)]
    : [boss(0.03, 0.006, LEG.hind.plate.seat - 0.001, HIP, unitYZ(HIP, KN))]
  // each joint's hinge forged to its own end (the elbow's spade, the stifle's disc, the wrist's round, the hock's point)
  const k = hinge(KN, knee.xo, unitYZ(KN, HIP), fore ? 0.108 : 0.1, unitYZ(KN, WR), fore ? 0.1 : 0.095, fore ? 0.026 : 0.025, coneSlope(knee.R), fore ? 'spade' : 'disc')
  const past = unitYZ([0, 0], fore ? PASTERN.fore : PASTERN.hind)
  const wEnd: LeafEnd = fore ? 'round' : 'point'
  const w = hinge([0, 0], wrist.xo - wrist3[0], unitYZ(WR, KN), fore ? 0.085 : 0.078, past, fore ? 0.05 : 0.07, fore ? 0.023 : 0.021, coneSlope(wrist.R), wEnd)
  // the lower lap's upper leaf is on the middle piece, in the rest frame
  const wUp = w.up.map(g => g.translate(wrist3[0], WR[0], WR[1]))
  // the same hinge across the wrist's inner cheeks, which the far legs show
  const wi = hinge([0, 0], wrist3[0] - wrist.xi, unitYZ(WR, KN), fore ? 0.085 : 0.078, past, fore ? 0.05 : 0.07, fore ? 0.023 : 0.021, 0, wEnd)
  const wiUp = mirrorX(merge(wi.up)).translate(wrist3[0], WR[0], WR[1])
  return { upper: merge([...upper, ...k.up]), lower: merge([...k.down, ...wUp, wiUp]), paw: merge([...w.down, mirrorX(merge(wi.down))]) }
}

/** The shoulder and hip pins where each carved leg joint turns. */
export function jointPinGeometry(side: number, r: number, len: number, x: number): Geo {
  return axle(side * x - len / 2, side * x + len / 2, 0, 0, r, 14)
}

/** Constant attributes for a geometry the baker did not make, so the shared
 * painted material reads it as open, unoccluded, in one material. */
export function withAttributes(g: Geo, ao: [number, number, number] = [1, 0.9, 0], mat: [number, number, number, number] = [0, 0, 0, 0]): Geo {
  const n = g.getAttribute('position').count
  const a = new Float32Array(n * 4), m = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) { a[i * 4] = ao[0]; a[i * 4 + 1] = ao[1]; a[i * 4 + 2] = ao[2]; m.set(mat, i * 4) }
  g.setAttribute('aAttr', new Float32BufferAttribute(a, 4))
  g.setAttribute('aMat', new Float32BufferAttribute(m, 4))
  return g
}

/** The rest pivots of the leg joints, from the carved parts' own frame. */
export const PIVOTS = {
  fore: { hip: K.SH, knee: K.KF, wrist: K.WF },
  hind: { hip: K.HP, knee: K.KH, wrist: K.WH },
} as const

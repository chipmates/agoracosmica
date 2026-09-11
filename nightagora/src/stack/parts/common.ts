/* THE SHOP FLOOR — what every part in the kit is cut on.

   Four things live here and nothing else does.

   · UV IN METRES. Every geometry this file makes carries a uv measured in
     metres of the surface, not in a 0..1 box. That is the one decision the
     whole kit rests on: a brick set laid through a box's own 0..1 uv puts
     one tile on a jamb and one tile on a twelve metre wall, and both read
     as a photograph of bricks rather than as brick. With a metre uv the
     course is the course at every size, and the same set on a sill and on
     the wall beside it agrees.
   · ONE PROJECTION PER BODY OR PER WALL. A part reads its maps off its own
     geometry. A WALL reads them off a plane through the wall itself, so
     the courses run on through the pier beside a window instead of
     restarting at every panel.
   · A DETERMINISTIC HAND. Every wobble, every worn tread and every leaf is
     drawn from a seeded generator, so the same part shot twice is the same
     part. A rig that cannot reproduce a frame cannot judge one.
   · THE MATERIAL PATH IS THE STACK'S. A part never writes a shader. It
     asks the stack for a library set with the empty-plane helper already on
     it, which is what keeps a jamb from being the flat plane the rule
     forbids. */

import {
  Box3,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Euler,
  ExtrudeGeometry,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshStandardNodeMaterial,
  Object3D,
  PlaneGeometry,
  Shape,
  Vector2,
  Vector3,
  type Material,
} from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import * as TSL from 'three/tsl'
import type { Stack } from '../index'
import type { MaterialSet } from '../materials'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type N = any
const { positionWorld, uniform, uv, vec2, vec3 } = TSL as unknown as Record<string, N>

/* ── the hand ──────────────────────────────────────────────────────────── */

/** a seeded generator. Cheap, well distributed enough for a wobble, and the
    same sequence on every machine, which is what a shot part needs. */
export function hand(seed: number): () => number {
  let a = (seed >>> 0) + 0x6d2b79f5
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** a number in a band, from a hand */
export const between = (r: () => number, lo: number, hi: number): number => lo + r() * (hi - lo)

/* ── uv in metres ──────────────────────────────────────────────────────── */

/** rescale a face's uv from 0..1 into metres, face by face, in the order
    three lays a box out: +x, -x, +y, -y, +z, -z */
function scaleFaceUV(geometry: BufferGeometry, counts: number[], spans: Array<[number, number]>): void {
  const attr = geometry.getAttribute('uv') as BufferAttribute
  let at = 0
  for (let f = 0; f < counts.length; f++) {
    const n = counts[f] ?? 0
    const span = spans[f] ?? [1, 1]
    for (let i = 0; i < n; i++) {
      attr.setXY(at + i, attr.getX(at + i) * span[0], attr.getY(at + i) * span[1])
    }
    at += n
  }
  attr.needsUpdate = true
}

/** a box whose uv is measured in metres of its own surface */
export function metreBox(w: number, h: number, d: number, sw = 1, sh = 1, sd = 1): BufferGeometry {
  const geometry = new BoxGeometry(w, h, d, sw, sh, sd)
  const side = (sd + 1) * (sh + 1)
  const cap = (sw + 1) * (sd + 1)
  const face = (sw + 1) * (sh + 1)
  scaleFaceUV(
    geometry,
    [side, side, cap, cap, face, face],
    [
      [d, h],
      [d, h],
      [w, d],
      [w, d],
      [w, h],
      [w, h],
    ]
  )
  return geometry
}

/** a plane whose uv is measured in metres */
export function metrePlane(w: number, h: number, sw = 1, sh = 1): BufferGeometry {
  const geometry = new PlaneGeometry(w, h, sw, sh)
  const attr = geometry.getAttribute('uv') as BufferAttribute
  for (let i = 0; i < attr.count; i++) attr.setXY(i, attr.getX(i) * w, attr.getY(i) * h)
  attr.needsUpdate = true
  return geometry
}

/** a cylinder whose uv runs in metres: around its own circumference and up
    its own length, so a rope, a post and a pot all read at their true size */
export function metreCylinder(
  top: number,
  bottom: number,
  height: number,
  radial = 12,
  heightSeg = 1,
  open = false
): BufferGeometry {
  const geometry = new CylinderGeometry(top, bottom, height, radial, heightSeg, open)
  const attr = geometry.getAttribute('uv') as BufferAttribute
  const round = Math.PI * (top + bottom)
  const wall = (radial + 1) * (heightSeg + 1)
  for (let i = 0; i < attr.count; i++) {
    if (i < wall) attr.setXY(i, attr.getX(i) * round, attr.getY(i) * height)
    else attr.setXY(i, attr.getX(i) * top * 2, attr.getY(i) * top * 2)
  }
  attr.needsUpdate = true
  return geometry
}

/** an extruded profile. Three's own uv generator already works in the
    shape's own coordinates, which this kit writes in metres, so the front
    face arrives correct; the walls are rewritten to run along the profile. */
export function metreExtrude(shape: Shape, depth: number, curveSegments = 12): BufferGeometry {
  const geometry = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments,
    steps: 1,
  })
  geometry.computeVertexNormals()
  return geometry
}

/** a turned body: the profile in metres, and a uv that runs around it in
    metres rather than in turns */
export function metreLathe(points: Vector2[], segments = 24): BufferGeometry {
  const geometry = new LatheGeometry(points, segments)
  const attr = geometry.getAttribute('uv') as BufferAttribute
  const position = geometry.getAttribute('position') as BufferAttribute
  let run = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as Vector2
    const b = points[i] as Vector2
    run += a.distanceTo(b)
  }
  for (let i = 0; i < attr.count; i++) {
    const r = Math.hypot(position.getX(i), position.getZ(i))
    attr.setXY(i, attr.getX(i) * 2 * Math.PI * Math.max(r, 0.001), attr.getY(i) * run)
  }
  attr.needsUpdate = true
  return geometry
}

/** move a geometry's uv, in metres. Two panels of one wall that carry the
    same course line up only when their uv does. */
export function shiftUV(geometry: BufferGeometry, du: number, dv: number): BufferGeometry {
  const attr = geometry.getAttribute('uv') as BufferAttribute
  for (let i = 0; i < attr.count; i++) attr.setXY(i, attr.getX(i) + du, attr.getY(i) + dv)
  attr.needsUpdate = true
  return geometry
}

/** put a geometry where it belongs before it is merged into its neighbours */
export function at(
  geometry: BufferGeometry,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0]
): BufferGeometry {
  const m = new Matrix4().makeRotationFromEuler(new Euler(rotation[0], rotation[1], rotation[2]))
  m.setPosition(position[0], position[1], position[2])
  geometry.applyMatrix4(m)
  return geometry
}

/** THE THREE ATTRIBUTES EVERY PIECE OF THIS KIT CARRIES, and nothing else.
    A merge fails outright on a mismatch, so the list is fixed here rather
    than discovered from whichever piece happened to be first. */
const WELDED = ['position', 'normal', 'uv'] as const

/**
 * One body out of many pieces: one draw instead of a dozen.
 *
 * The pieces do not arrive alike. Three's box, cylinder and tube are INDEXED
 * and its extrusion is not, and `mergeGeometries` refuses a mixture outright
 * (it returns null and a builder that welded a box to an extrusion would
 * throw before its page ever drew). So a mixture is levelled to non-indexed
 * first, and any attribute the others do not carry is dropped.
 */
export function weld(pieces: BufferGeometry[]): BufferGeometry {
  const live = pieces.filter(
    (g) => (g.getAttribute('position') as BufferAttribute | undefined)?.count
  )
  if (!live.length) throw new Error('a part was welded out of nothing')
  const indexed = live.every((g) => g.index !== null)
  const ready = live.map((g) => {
    const out = indexed || g.index === null ? g : g.toNonIndexed()
    for (const name of Object.keys(out.attributes)) {
      if (!(WELDED as readonly string[]).includes(name)) out.deleteAttribute(name)
    }
    if (!out.getAttribute('normal')) out.computeVertexNormals()
    if (!out.getAttribute('uv')) {
      const count = (out.getAttribute('position') as BufferAttribute).count
      out.setAttribute('uv', new BufferAttribute(new Float32Array(count * 2), 2))
    }
    return out
  })
  if (ready.length === 1) return ready[0] as BufferGeometry
  const merged = mergeGeometries(ready, false)
  if (!merged) throw new Error('the pieces of this part could not be welded')
  return merged
}

/* ── the surfaces ──────────────────────────────────────────────────────── */

/** where a part reads its maps from */
export interface Projection {
  /** the part's own geometry uv, already in metres. The default. */
  kind: 'body'
  /** a plane through a whole wall, in metres, so a course runs on through
      every panel of it: the azimuth of the wall's face and the height its
      uv counts from */
  azimuth?: number
  base?: number
}

export interface SurfaceOptions {
  /** roughness under the set's own map, where a part is rougher than the
      photograph (a shutter left out in the weather) */
  roughFloor?: number
  /** the part's own colour under the set's albedo ratio */
  tint?: string
  /** a wall projection instead of the body's own uv */
  wall?: { azimuth: number; base?: number }
  /** how much of the library's photograph comes in, 0..1 */
  maps?: number
  /** darker or lighter than the set, as a multiplier around 1 */
  value?: number
  metalness?: number
  /** both sides, for a leaf card or a shutter louvre */
  twoSided?: boolean
  /** the geometry carries no uv the helper can use (an instanced scatter
      the kit lays out itself); read the maps off the world instead */
  world?: boolean
}

/** the shop's material bench. A part asks for a library set and gets a lit
    node material with the empty-plane helper already on it, cached, so
    forty slates and eight quarries are one shader and one upload. */
export class Bench {
  private readonly cache = new Map<string, MeshStandardNodeMaterial>()
  /* THE BASE COLOUR IS A UNIFORM, and it has to be. A set's own measured mean
     albedo arrives with the MANIFEST, which is a fetch; a part built in the
     same tick as the page compiles its shader before that fetch lands, and
     the helper writes the mean in as a constant. A slate roof then renders at
     the placeholder's mid grey with the slate photograph's own ratio on top,
     which is a pale roof, and nothing in the frame says why. So the mean is a
     uniform here and it is written again every frame until the library has
     landed. The library does the same thing with its own reciprocal mean, and
     for the same reason. */
  private readonly tinted: Array<{
    set: MaterialSet
    tint: N
    value: number
    hex: string | undefined
    /** lay the helper on again from the set as it now stands */
    rebuild: () => void
    /** whether that has already been done from a LANDED set */
    settled: boolean
  }> = []
  private watching = false

  constructor(private readonly stack: Stack) {}

  set(name: string): MaterialSet {
    return this.stack.materials.sync(name)
  }

  surface(name: string, o: SurfaceOptions = {}): MeshStandardNodeMaterial {
    const key = `${name}|${o.roughFloor ?? ''}|${o.tint ?? ''}|${o.maps ?? ''}|${o.value ?? ''}|${
      o.metalness ?? ''
    }|${o.twoSided ? 2 : 1}|${o.world ? 'w' : ''}|${o.wall ? `${o.wall.azimuth}:${o.wall.base ?? 0}` : ''}`
    const held = this.cache.get(key)
    if (held) return held
    const set = this.set(name)
    const material = new MeshStandardNodeMaterial()
    material.name = key
    if (o.twoSided) material.side = DoubleSide
    const tint = uniform(vec3(1, 1, 1))
    /* WHERE THE SAMPLE LANDS, and it is the whole difference between a wall
       and a photograph of one. `wall` projects onto a vertical plane through
       the wall's own face, so a pier, a spandrel and an apron carry one
       continuous course; everything else reads its own geometry's uv, which
       this file writes in metres. */
    const where = o.wall
      ? { uv: wallUV(o.wall.azimuth, o.wall.base ?? 0) }
      : o.world
        ? {}
        : { uv: uv() }
    const scales = { ...where, count: this.stack.tierConfig().detail }
    /* THE PHOTOGRAPH IS NOT READ UNTIL IT HAS ARRIVED, and that is not a
       nicety. A set's maps exist as one-texel stand-ins from the first frame
       and their pixels are filled in later; a material that samples one
       before the fill renders the stand-in's mid grey divided by the set's
       own mean, which on a warm stone is a cool grey at a fifth of its value
       and reads as polished slate. So the helper is laid on WITHOUT the
       library while the bytes are in flight, and laid on again with it the
       moment they land. The interim frame is the surface as it was authored,
       which is the library's own rule. */
    const rebuild = (): void => {
      const landed = Boolean(set.ready.value)
      material.color = new Color(o.tint ?? '#ffffff').multiplyScalar(o.value ?? 1)
      material.roughness = Math.max(set.roughness, o.roughFloor ?? 0)
      material.metalness = o.metalness ?? set.metalness
      material.colorNode = tint
      this.stack.detail(material, set, { ...scales, maps: landed ? (o.maps ?? 1) : 0 })
      material.needsUpdate = true
    }
    rebuild()
    this.tinted.push({
      set,
      tint,
      value: o.value ?? 1,
      hex: o.tint,
      rebuild,
      settled: Boolean(set.ready.value),
    })
    this.cache.set(key, material)
    this.refresh()
    this.watch()
    return material
  }

  /** write every base colour again from the set's own measured mean, and lay
      the helper on again for any set whose bytes have just landed */
  refresh(): void {
    for (const t of this.tinted) {
      /* THE HELPER READS THE SET AS CONSTANTS, and half of them arrive with
         the MANIFEST. A material compiled before that fetch lands carries the
         placeholder's tile size, its roughness and its neutral grey baked in,
         and no amount of writing the base colour afterwards can move them. So
         the graph is laid on again, once, the moment the set is whole. */
      if (!t.settled && t.set.ready.value) {
        t.settled = true
        t.rebuild()
      }
      const c = new Color(t.hex ?? '#ffffff')
      c.multiply(t.set.albedo).multiplyScalar(t.value)
      t.tint.value.set(c.r, c.g, c.b)
    }
  }

  /** keep writing them until the library has landed, then stop. A caller
      that builds nothing further pays nothing after that. */
  private watch(): void {
    if (this.watching) return
    this.watching = true
    let idle = 0
    let frames = 0
    const step = (): void => {
      this.refresh()
      frames++
      idle = this.tinted.every((t) => t.set.ready.value) ? idle + 1 : 0
      /* a floor of sixty frames on top of the idle count, because a set that
         reports itself ready one frame before its pixels are on the GPU
         would otherwise leave a part wearing the placeholder for good */
      if (idle > 12 && frames > 60) {
        this.watching = false
        return
      }
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  /** what every surface this bench built is holding: its set, whether that
      set's bytes have landed, and the base colour standing on it now. A wing
      that finds a part reading grey looks here first. */
  report(): Array<{ set: string; ready: boolean; base: [number, number, number] }> {
    return this.tinted.map((t) => ({
      set: t.set.name,
      ready: Boolean(t.set.ready.value),
      base: [t.tint.value.x, t.tint.value.y, t.tint.value.z],
    }))
  }

  /** the tier's own count of detail scales, which is what a part's own level
      of detail is chosen from */
  detail(): 1 | 2 | 3 {
    return this.stack.tierConfig().detail
  }
}

/** the plane a wall is read on: along its face in metres, up its height in
    metres, counted from the wall's own base */
function wallUV(azimuth: number, base: number): N {
  const a = (azimuth * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  return vec2(positionWorld.x.mul(c).add(positionWorld.z.mul(s)), positionWorld.y.sub(base))
}

/* ── the part itself ───────────────────────────────────────────────────── */

/** what every builder in the kit hands back: a body, and the numbers a
    bench or a cost gate needs about it without measuring the scene */
export interface Part extends Object3D {
  userData: {
    part: {
      name: string
      /** what a wing should call it in a label */
      says: string
      tris: number
      /** how many draw calls this part costs the frame */
      draws: number
      /** the body's own size in metres, measured off what was built */
      metres: [number, number, number]
      /** every library set this part put on a surface */
      sets: string[]
      /** every texture this part GENERATED at runtime rather than fetched,
          with the recipe line the record law asks of a generated asset */
      generated: string[]
    }
  }
}

/** count what a part costs, once, at the moment it is finished */
export function seal(
  body: Object3D,
  name: string,
  says: string,
  sets: string[]
): Part {
  let tris = 0
  let draws = 0
  body.traverse((child: Object3D) => {
    const mesh = child as Mesh & { count?: number; isInstancedMesh?: boolean }
    if (!mesh.isMesh) return
    const geometry = mesh.geometry as BufferGeometry
    const index = geometry.getIndex()
    const position = geometry.getAttribute('position') as BufferAttribute | undefined
    const per = Math.floor((index ? index.count : (position?.count ?? 0)) / 3)
    tris += per * (mesh.isInstancedMesh ? (mesh.count ?? 1) : 1)
    draws += 1
  })
  body.updateMatrixWorld(true)
  const box = new Vector3()
  const bounds = new Box3().setFromObject(body)
  if (bounds.isEmpty()) box.set(0, 0, 0)
  else bounds.getSize(box)
  const part = body as Part
  part.userData = {
    part: {
      name,
      says,
      tris,
      draws,
      metres: [round(box.x), round(box.y), round(box.z)],
      sets: [...new Set(sets)],
      generated: [],
    },
  }
  return part
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000
}

/** a mesh out of a welded body, with shadows both ways. Everything in this
    museum casts and receives: a part that does neither is the floating
    carriage two verdicts named. */
export function body(geometry: BufferGeometry, material: Material, name: string): Mesh {
  const mesh = new Mesh(geometry, material)
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/* ── profiles a mason would know ───────────────────────────────────────── */

/** a rectangle with one or more arrises taken off: the chamfer that turns a
    sawn edge into a moulded one, and the reason a jamb reads as dressed
    stone rather than as a board */
export function chamfered(w: number, h: number, cut: number, corners = [1, 1, 1, 1]): Shape {
  const c = Math.min(cut, w / 2, h / 2)
  const s = new Shape()
  const x0 = -w / 2
  const x1 = w / 2
  const y0 = -h / 2
  const y1 = h / 2
  s.moveTo(x0 + (corners[0] ? c : 0), y0)
  s.lineTo(x1 - (corners[1] ? c : 0), y0)
  if (corners[1]) s.lineTo(x1, y0 + c)
  s.lineTo(x1, y1 - (corners[2] ? c : 0))
  if (corners[2]) s.lineTo(x1 - c, y1)
  s.lineTo(x0 + (corners[3] ? c : 0), y1)
  if (corners[3]) s.lineTo(x0, y1 - c)
  s.lineTo(x0, y0 + (corners[0] ? c : 0))
  if (corners[0]) s.closePath()
  return s
}

/** a sill: a weathered top, a nose, and the throat under it that stops the
    rain running back into the wall. The throat is the whole point of a sill
    and it is what makes one read as a sill instead of as a shelf. */
export function sillProfile(depth: number, height: number, fall = 0.035): Shape {
  const s = new Shape()
  const throat = Math.min(0.02, depth * 0.12)
  s.moveTo(-depth / 2, -height / 2)
  s.lineTo(depth / 2 - throat * 2.2, -height / 2)
  s.lineTo(depth / 2 - throat * 2.2, -height / 2 + throat)
  s.lineTo(depth / 2 - throat * 1.1, -height / 2 + throat)
  s.lineTo(depth / 2 - throat * 1.1, -height / 2)
  s.lineTo(depth / 2, -height / 2)
  s.lineTo(depth / 2, height / 2 - fall)
  s.lineTo(-depth / 2, height / 2)
  s.closePath()
  return s
}

/* ── the curve a rope hangs on ─────────────────────────────────────────── */

/**
 * A catenary between two points, which is the shape a rope under its own
 * weight actually takes. `slack` is the length of the rope over the straight
 * distance between the ends: 1 is taut, 1.15 hangs.
 *
 * The parameter is found by bisection because the equation for it
 * (`sinh(x)/x = L/d`) has no closed form. Ten passes are inside a millimetre
 * over any span a museum has.
 */
export function catenary(
  a: [number, number, number],
  b: [number, number, number],
  slack = 1.06,
  steps = 24
): Vector3[] {
  const A = new Vector3(a[0], a[1], a[2])
  const B = new Vector3(b[0], b[1], b[2])
  const flat = Math.hypot(B.x - A.x, B.z - A.z)
  const rise = B.y - A.y
  const span = Math.hypot(flat, rise)
  const points: Vector3[] = []
  if (flat < 1e-4 || slack <= 1.0005) {
    for (let i = 0; i <= steps; i++) points.push(new Vector3().lerpVectors(A, B, i / steps))
    return points
  }
  const want = (span * slack) / flat
  let lo = 1e-4
  let hi = 40
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (Math.sinh(mid) / mid < want) lo = mid
    else hi = mid
  }
  const k = (lo + hi) / 2
  const c = flat / (2 * k)
  /* the lowest point is not the middle unless the ends are level, and a rope
     between a mast and a deck hangs off centre */
  const shift = c * Math.asinh(rise / (2 * c * Math.sinh(flat / (2 * c))))
  const y0 = c * Math.cosh(-flat / 2 / c - shift / c)
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = -flat / 2 + t * flat
    const y = c * Math.cosh((x - shift) / c) - y0
    points.push(new Vector3(A.x + (B.x - A.x) * t, A.y + y, A.z + (B.z - A.z) * t))
  }
  return points
}

/* ── numbers a builder keeps reaching for ──────────────────────────────── */

export const RAD = Math.PI / 180
export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))
export type Triple = [number, number, number]

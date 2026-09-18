/* THE DETAIL NODE'S OWN SPECIMENS — the five shapes the node has to answer
   for, each standing on the bench in two states.

   AFTER is the stack's `surfaceDetail`: three feature sizes given by the
   part in metres, every scale gated on the pixel that covers it, the course
   field under it where the surface is laid, and the projection blended on
   the world normal.

   BEFORE is what a room material does today, written out here rather than
   simulated: the room's own three scales (3.2 m, 0.13 m, 4.7 mm) on every
   part whatever its size, one isotropic pixel used for both axes of every
   joint, and the joints projected straight down. A pair of frames of the
   same geometry under the same sun then shows the change and nothing else.

   Bench only. Nothing in the museum imports this file. */

import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Mesh,
  MeshStandardNodeMaterial,
  Object3D,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import {
  anisotropicFootprint,
  reliefNormal,
  resolved,
  surfaceDetail,
  type CourseRecipe,
} from '../stack/detail'
import { seal, type Part } from '../stack/parts/common'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const {
  cameraViewMatrix,
  float,
  fract,
  mx_noise_float,
  normalWorldGeometry,
  positionWorld,
  smoothstep,
  vec3,
} = TSL as unknown as Record<string, N>

export type DetailMode = 'before' | 'after'

/** the scales a room material lays on every surface it owns, whatever that
    surface measures: this is the number a 0.10 m slab is dressed with */
const ROOM_SCALES: [number, number, number] = [3.2, 0.13, 0.0047]

/** where a specimen is read from, so a defect that lives at eight metres is
    not judged from two */
export interface Eye {
  from: [number, number, number]
  to: [number, number, number]
}

interface Dressed {
  colour: string
  /** the ladder this part asks for, macro to micro, in metres */
  scales: [number, number, number]
  /** the smallest extent of the FACE this surface is read across */
  extent: number
  roughness: number
  courses?: CourseRecipe
  figure?: [number, number, number]
  relief?: number
}

/** a floor of sawn slabs: the wander taken out of a coursed field */
const SLAB: CourseRecipe = {
  courseM: 1.65,
  courseWaveM: 4,
  courseSwing: 0,
  blockM: 1.6,
  blockSwing: 0,
  jointM: 0.008,
  wanderM: 0,
  faceSwing: 0.014,
  blockFaceSwing: 0.055,
  seed: 7.31,
}

/** and a wall laid by hand, which keeps only its beds level */
const LAID: CourseRecipe = {
  courseM: 0.29,
  courseWaveM: 1.75,
  courseSwing: 0.26,
  blockM: 0.66,
  blockSwing: 0.46,
  jointM: 0.013,
  wanderM: 0.0018,
  faceSwing: 0.045,
  seed: 3.17,
}

/** the node, as a room or a stand would call it */
function after(d: Dressed, count: 1 | 2 | 3): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({
    color: d.colour,
    roughness: d.roughness,
    metalness: 0.02,
  })
  const n = normalWorldGeometry
  const nodes = surfaceDetail({
    scales: d.scales,
    extent: d.extent,
    count,
    ...(d.courses ? { courses: d.courses } : {}),
    ...(d.figure ? { figure: d.figure } : {}),
    ...(d.relief === undefined ? {} : { relief: d.relief }),
  })
  const c = new Color(d.colour)
  m.colorNode = vec3(c.r, c.g, c.b).mul(nodes.tone)
  m.roughnessNode = float(d.roughness).add(nodes.rough).clamp(0.08, 0.98)
  m.normalNode = reliefNormal(n.transformDirection(cameraViewMatrix), nodes.heightM, 0.2)
  return m
}

/** and the same surface as the rooms write it today */
function before(d: Dressed): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({
    color: d.colour,
    roughness: d.roughness,
    metalness: 0.02,
  })
  const P = positionWorld
  const n = normalWorldGeometry
  const pixel = anisotropicFootprint(P).toVar()
  const at = (metres: number): N => resolved(metres, pixel)
  const macro = mx_noise_float(P.div(ROOM_SCALES[0])).mul(at(ROOM_SCALES[0])).toVar()
  const middle = mx_noise_float(P.div(ROOM_SCALES[1])).mul(at(ROOM_SCALES[1])).toVar()
  const grain = mx_noise_float(P.div(ROOM_SCALES[2])).mul(at(ROOM_SCALES[2])).toVar()
  // ONE PIXEL FOR BOTH AXES, which is the joint filter this round replaces.
  const line = (coordinate: N, spacing: number, width: number): N => {
    const f = fract(coordinate.div(spacing))
    const edge = f.min(float(1).sub(f)).mul(spacing)
    return float(1)
      .sub(
        smoothstep(
          float(width).sub(pixel.mul(0.5)).max(0),
          float(width).add(pixel.mul(0.5)),
          edge
        )
      )
      .mul(at(spacing))
  }
  const tone = float(1)
    .add(macro.mul(0.09))
    .add(middle.mul(0.06))
    .add(grain.mul(0.05))
  const c = new Color(d.colour)
  let colour: N = vec3(c.r, c.g, c.b).mul(tone)
  let height: N = macro.mul(0.002).add(middle.mul(0.0008)).add(grain.mul(0.0003))
  if (d.courses) {
    // projected straight down, so a face that stands up wears the floor's
    // own joints smeared up it
    const joint = line(P.x, d.courses.blockM, d.courses.jointM * 0.5).max(
      line(P.z, d.courses.courseM, d.courses.jointM * 0.5)
    )
    colour = colour.mul(float(1).sub(joint.mul(0.3)))
    height = height.add(joint.mul(-d.courses.jointM * 0.22))
  }
  m.colorNode = colour
  m.roughnessNode = float(d.roughness).add(grain.mul(0.05)).add(middle.mul(0.03)).clamp(0.08, 0.98)
  m.normalNode = reliefNormal(n.transformDirection(cameraViewMatrix), height, 0.2)
  return m
}

function dress(d: Dressed, mode: DetailMode, count: 1 | 2 | 3): MeshStandardNodeMaterial {
  return mode === 'before' ? before(d) : after(d, count)
}

function body(geometry: BoxGeometry | CylinderGeometry, material: MeshStandardNodeMaterial): Mesh {
  const mesh = new Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/* ── the five, in the sizes the rooms and the stands actually build ──────── */

/** the aisle floor: a 1.60 by 1.65 m sawn grid with 8 mm joints */
const FLOOR: Dressed = {
  colour: '#9d9a8e',
  scales: [0.42, 0.045, 0.002],
  extent: 1.6,
  roughness: 0.62,
  courses: SLAB,
  figure: [0.075, 0.05, 0.05],
}

/** a lined wall run, laid by hand */
const WALL: Dressed = {
  colour: '#b7b2a4',
  scales: [0.85, 0.06, 0.0025],
  extent: 3.6,
  roughness: 0.86,
  courses: LAID,
  figure: [0.08, 0.055, 0.045],
}

/** a plinth: one stone, read from a metre away */
const PLINTH: Dressed = {
  colour: '#8f8c82',
  scales: [0.55, 0.05, 0.0022],
  extent: 1.1,
  roughness: 0.74,
  figure: [0.085, 0.06, 0.05],
}

/** the black base slab, 0.10 m tall, which is where the guard bites */
const BASE: Dressed = {
  colour: '#3c423d',
  scales: [0.4, 0.04, 0.002],
  extent: 0.1,
  roughness: 0.78,
  figure: [0.12, 0.08, 0.06],
}

/** and a drum, because a curve is where a per-vertex plane pick moirés */
const DRUM: Dressed = {
  colour: '#a39d8e',
  scales: [0.5, 0.05, 0.0022],
  extent: 1,
  roughness: 0.8,
  courses: LAID,
  figure: [0.08, 0.055, 0.045],
}

function floorSlab(mode: DetailMode, count: 1 | 2 | 3): Object3D {
  return body(new BoxGeometry(7, 0.12, 7), dress(FLOOR, mode, count))
}

function wallRun(mode: DetailMode, count: 1 | 2 | 3): Object3D {
  return body(new BoxGeometry(12, 3.6, 0.62), dress(WALL, mode, count))
}

function plinth(mode: DetailMode, count: 1 | 2 | 3): Object3D {
  return body(new BoxGeometry(1.1, 1.15, 1.1), dress(PLINTH, mode, count))
}

function baseSlab(mode: DetailMode, count: 1 | 2 | 3): Object3D {
  return body(new BoxGeometry(2.2, 0.1, 1.2), dress(BASE, mode, count))
}

function drum(mode: DetailMode, count: 1 | 2 | 3): Object3D {
  return body(new CylinderGeometry(0.5, 0.5, 2.4, 96, 1), dress(DRUM, mode, count))
}

/** where each specimen is judged from, in world metres */
const EYES: Record<string, Record<string, Eye>> = {
  'detail-wall': {
    // along the wall's own length, which is the pixel the footprint fixes
    graze2: { from: [-6.2, 1.6, 1.5], to: [5.8, 1.5, 0.31] },
    graze8: { from: [-11.9, 1.65, 3.4], to: [5.8, 1.5, 0.31] },
    graze20: { from: [-23.2, 1.7, 6.2], to: [5.8, 1.5, 0.31] },
    face2: { from: [0, 1.7, 2.4], to: [0, 1.7, 0.31] },
  },
  'detail-floor': {
    // the two distances the floor joints were read as dashes at
    stand8: { from: [0, 1.66, 8.4], to: [0, 0.06, -1.2] },
    stand16: { from: [0, 1.66, 16.4], to: [0, 0.06, -1.2] },
  },
  'detail-drum': {
    stand2: { from: [1.5, 1.35, 1.5], to: [0, 1.2, 0] },
  },
  'detail-base': {
    stand1: { from: [0.9, 0.42, 1.5], to: [0, 0.05, 0] },
  },
}

export const DETAIL_SPECIMENS: Record<
  string,
  { build: (mode: DetailMode, count: 1 | 2 | 3) => Part; eyes: Record<string, Eye> }
> = {
  'detail-floor': {
    build: (mode, count) =>
      seal(
        floorSlab(mode, count),
        'floor slab',
        'A sawn floor on a 1.60 by 1.65 m grid with 8 mm joints, dressed at 0.42 m, 45 mm and 2 mm.',
        []
      ),
    eyes: EYES['detail-floor'] ?? {},
  },
  'detail-wall': {
    build: (mode, count) =>
      seal(
        wallRun(mode, count),
        'wall run',
        'Twelve metres of hand-laid wall, courses 0.29 m, blocks 0.66 m, joints 13 mm.',
        []
      ),
    eyes: EYES['detail-wall'] ?? {},
  },
  'detail-plinth': {
    build: (mode, count) =>
      seal(plinth(mode, count), 'plinth', 'A single stone plinth 1.10 by 1.15 m, dressed at 0.55 m.', []),
    eyes: {},
  },
  'detail-base': {
    build: (mode, count) =>
      seal(
        baseSlab(mode, count),
        'base slab',
        'The exhibition base slab, 0.10 m tall: the macro it asked for is refused and laid at 0.05 m.',
        []
      ),
    eyes: EYES['detail-base'] ?? {},
  },
  'detail-drum': {
    build: (mode, count) =>
      seal(drum(mode, count), 'drum', 'A turned drum 1.0 m across, coursed: the curve a plane pick moirés on.', []),
    eyes: EYES['detail-drum'] ?? {},
  },
  'detail-sheet': {
    build: (mode, count) => {
      const sheet = new Object3D()
      const floor = floorSlab(mode, count)
      floor.position.set(0, 0.06, 0)
      const wall = wallRun(mode, count)
      wall.position.set(0, 1.8, -3.2)
      const stand = plinth(mode, count)
      stand.position.set(-2.4, 0.575, 1.1)
      const base = baseSlab(mode, count)
      base.position.set(0.4, 0.05, 1.4)
      const column = drum(mode, count)
      column.position.set(2.6, 1.2, 0.4)
      sheet.add(floor, wall, stand, base, column)
      return seal(
        sheet,
        'detail sheet',
        'The five surfaces the node answers for: floor, wall, plinth, base slab, drum.',
        []
      )
    },
    eyes: {
      sheet: { from: [5.6, 3.4, 7.2], to: [-0.2, 0.9, -0.6] },
    },
  },
}

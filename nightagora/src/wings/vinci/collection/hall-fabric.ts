/** THE MECHANISM HALL'S FABRIC, FOR THE FILM: a sealed concrete floor cut into
 * bays, cast concrete walls with their formwork joints and tie holes, and the
 * same concrete overhead and on the beams. Laid as a finish over the hall's
 * certified construction, which stays exactly where and what it was: nothing
 * here is a rail solid, a caster for the sun, or any other room's surface.
 * The photographs are CC0 library sets; the bays, the joints, the tint and the
 * drift over them are the museum's own. No 1517 claim: a modern room.
 */
import {
  BufferGeometry, Float32BufferAttribute, FrontSide, Group, Mesh, MeshStandardNodeMaterial,
  PlaneGeometry, Vector3, type Material,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import type { Stack } from '../../../stack'
import type { MaterialSet } from '../../../stack/materials'
import { axisFootprint, lineCoverage } from '../../../stack/detail'
import { COLLECTION_PAVING_ORIGIN, FACE, FLOOR, OPENING, ROOMS } from './layout'
import { standBoxes } from './stands'

// The node overload boundary stays local to this file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any

export const HALL_FABRIC_PROVENANCE = {
  manifestId: 'vinci/collection-hall-fabric', assetClass: 'GENERATED', certainty: 'reconstructed',
} as const

/** The hall's roof falls south from its clerestory; its beams follow it. */
const hallSoffit = (north: number): number => 1.05 - .75 * (-42.5 - north) / 22.2
const BEAMS = [-46, -50, -54, -58, -62] as const
/** How far the finish stands in front of the lining, past its ribs and base. */
const PROUD = .045
/** The wall finish stops this far over the floor: a shadow gap, not a skirting. */
const GAP = .055
/** The floor is cut into bays of two museum stones each way. */
const BAY = { east: 3.2, north: 3.3 } as const

type P3 = [number, number, number]

/** Quads in the wing's frame (east, north, height), wound to face `facing`. */
class Skin {
  private p: number[] = []
  private n: number[] = []
  quad(a: P3, b: P3, c: P3, d: P3, facing: P3): void {
    const w = (q: P3): Vector3 => new Vector3(q[0], q[2], -q[1])
    const v = [w(a), w(b), w(c), w(d)]
    const normal = v[1]!.clone().sub(v[0]!).cross(v[2]!.clone().sub(v[0]!)).normalize()
    const want = w(facing).normalize()
    const flip = normal.dot(want) < 0
    if (flip) normal.negate()
    for (const i of flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]) {
      this.p.push(v[i]!.x, v[i]!.y, v[i]!.z)
      this.n.push(normal.x, normal.y, normal.z)
    }
  }
  /** a wall face running east to west at one north, from `low` to a top that
      may fall with the roof */
  eastWest(north: number, facing: 1 | -1, west: number, east: number, low: number, top: (e: number) => number): void {
    this.quad([west, north, low], [east, north, low], [east, north, top(east)], [west, north, top(west)], [0, facing, 0])
  }
  northSouth(east: number, facing: 1 | -1, south: number, north: number, low: number, top: (n: number) => number): void {
    this.quad([east, south, low], [east, north, low], [east, north, top(north)], [east, south, top(south)], [facing, 0, 0])
  }
  /** a box's faces, `skin` proud of it; the underside only where asked */
  box(east: number, north: number, height: number, width: number, depth: number, tall: number, skin: number, under: boolean): void {
    const w = east - width / 2 - skin, e = east + width / 2 + skin
    const s = north - depth / 2 - skin, n = north + depth / 2 + skin
    const lo = height - tall / 2 - (under ? skin : 0), hi = height + tall / 2 + skin
    this.quad([w, s, hi], [e, s, hi], [e, n, hi], [w, n, hi], [0, 0, 1])
    if (under) this.quad([w, s, lo], [e, s, lo], [e, n, lo], [w, n, lo], [0, 0, -1])
    this.eastWest(s, -1, w, e, lo, () => hi)
    this.eastWest(n, 1, w, e, lo, () => hi)
    this.northSouth(w, -1, s, n, lo, () => hi)
    this.northSouth(e, 1, s, n, lo, () => hi)
  }
  get empty(): boolean { return this.p.length === 0 }
  geometry(): BufferGeometry {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.p, 3))
    g.setAttribute('normal', new Float32BufferAttribute(this.n, 3))
    g.computeBoundingBox(); g.computeBoundingSphere()
    return g
  }
}

/** Runs of a span with gaps cut out of it. */
function runs(from: number, to: number, gaps: [number, number][]): [number, number][] {
  const out: [number, number][] = []
  let cursor = from
  for (const [a, b] of [...gaps].sort((x, y) => x[0] - y[0])) {
    if (a > cursor) out.push([cursor, a])
    cursor = Math.max(cursor, b)
  }
  if (cursor < to) out.push([cursor, to])
  return out
}

/** THE FOUR WALLS, THE SOFFIT AND THE BEAMS as skins: walls, overhead, floor,
 * and the plinths under the hall's machines. Doors are left open to their
 * reveals and lintels. */
function skins(): { walls: Skin; overhead: Skin; floor: Skin; plinths: Skin } {
  const H = ROOMS.hall, walls = new Skin(), overhead = new Skin(), floor = new Skin(), plinths = new Skin()
  for (const b of standBoxes()) {
    if (b.east < H.west || b.east > H.east || b.north < H.south || b.north > H.north) continue
    // the top slab stands over a shadow gap, so its underside is seen
    plinths.box(b.east, b.north, b.height, b.width, b.depth, b.tall, .005, b.role === 2)
  }
  const low = FLOOR + GAP
  const lintel = -2.5 + .26
  const roofAt = (north: number): number => hallSoffit(north) - .012
  // the west wall and the south wall run whole, up to the roof
  walls.northSouth(H.west + PROUD, 1, H.south, H.north, low, roofAt)
  walls.eastWest(H.south + PROUD, 1, H.west, H.east, low, () => roofAt(H.south))
  // the partition to the gallery, open at its two doors up to their lintels
  const east = H.east - PROUD
  const gallery: [number, number] = [OPENING.hallToGallery.north[0], OPENING.hallToGallery.north[1] - .1]
  const south: [number, number] = [OPENING.hallToSouth.north[0] + .1, OPENING.hallToSouth.north[1]]
  for (const [a, b] of runs(H.south, H.north, [gallery, south])) walls.northSouth(east, -1, a, b, low, roofAt)
  for (const [a, b] of [gallery, south]) walls.northSouth(east, -1, a, b, lintel, roofAt)
  // the hanging wall's back, open at the picture room's door, up to the shelf
  const north = H.north - PROUD, door: [number, number] = [OPENING.pictureToHall.east[0], OPENING.pictureToHall.east[1]]
  for (const [a, b] of runs(H.west, H.east, [door])) walls.eastWest(north, -1, a, b, low, () => -1.66)
  walls.eastWest(north, -1, door[0], door[1], lintel, () => -1.66)
  // the soffit between the clerestory and the south wall
  const glazing = -42.53
  overhead.quad([H.west, glazing, roofAt(glazing)], [H.east, glazing, roofAt(glazing)],
    [H.east, H.south, roofAt(H.south)], [H.west, H.south, roofAt(H.south)], [0, 0, -1])
  // each beam clad on its two faces and its underside, a centimetre proud
  for (const beam of BEAMS) {
    const top = hallSoffit(beam) - .05, foot = hallSoffit(beam) - .64
    const s = beam - .18, n = beam + .18
    overhead.quad([H.west, s, foot], [H.east, s, foot], [H.east, n, foot], [H.west, n, foot], [0, 0, -1])
    overhead.eastWest(s, -1, H.west, H.east, foot, () => top)
    overhead.eastWest(n, 1, H.west, H.east, foot, () => top)
  }
  // the light shelf's underside and its lip
  const shelfNorth = FACE.pictureWallSouth, shelfSouth = FACE.pictureWallSouth - 1.24
  overhead.quad([H.west + .25, shelfNorth, -1.665], [H.east - .25, shelfNorth, -1.665],
    [H.east - .25, shelfSouth - .01, -1.665], [H.west + .25, shelfSouth - .01, -1.665], [0, 0, -1])
  overhead.eastWest(shelfSouth - .055, -1, H.west + .25, H.east - .25, -1.64, () => -1.285)
  // the floor, a few millimetres over the construction's own
  floor.quad([H.west, H.south, FLOOR + .003], [H.east, H.south, FLOOR + .003],
    [H.east, H.north, FLOOR + .003], [H.west, H.north, FLOOR + .003], [0, 0, 1])
  return { walls, overhead, floor, plinths }
}

const { abs, cameraPosition, cameraViewMatrix, cross, dot, float, floor: floorOf, fract, mix, mx_noise_float, normalWorldGeometry,
  positionWorld, pow, select, smoothstep, vec2, vec3 } = TSL as unknown as Record<string, N>

/** the tangent frame a world-aligned face is photographed in: u runs along
    the face, v up it (a floor's v runs north) */
function faceFrame(n: N): { t: N; b: N } {
  const flat = abs(n.y).greaterThan(.5)
  const t = select(flat, vec3(1, 0, 0), cross(vec3(0, 1, 0), n).normalize())
  const b = select(flat, cross(n, vec3(1, 0, 0)), vec3(0, 1, 0))
  return { t, b }
}

const hash = (x: N, y: N, salt: number): N => fract(x.mul(12.9898).add(y.mul(78.233)).add(salt).sin().mul(43758.5453))

interface Look {
  /** metres of one tile of the photograph: stated here, because a set built
      before its manifest lands would otherwise lay it at one metre */
  metres: number
  /** a multiplier on the photograph's own linear colour */
  tint: [number, number, number]
  /** the photograph's roughness is remapped to this range */
  rough: [number, number]
  normal: number
  /** how much a bay or a face may differ in tone */
  cell: number
  /** the metre-scale drift over the whole room */
  drift: number
  /** what the light shelf throws up at a face that looks down, at the shelf */
  shelf?: number
}

function fabricMaterial(set: MaterialSet, look: Look, name: string, bays: boolean): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .7, metalness: 0, side: FrontSide })
  const P = positionWorld, n = normalWorldGeometry
  const { t, b } = faceFrame(n)
  const u = dot(P, t), v = dot(P, b)
  // THE FLOOR IS CUT INTO BAYS, and each bay is read from its own part of the
  // photograph, so no two bays repeat each other. A wall is read whole.
  const east = P.x.sub(COLLECTION_PAVING_ORIGIN.east), north = P.z.negate().sub(COLLECTION_PAVING_ORIGIN.north)
  const cellE = floorOf(east.div(BAY.east)), cellN = floorOf(north.div(BAY.north))
  const h1 = hash(cellE, cellN, 3.7), h2 = hash(cellE, cellN, 11.3)
  const face = bays ? vec2(h1, h2).mul(23.7) : vec2(0, 0)
  const sample = set.sample({ uv: vec2(u, v).add(face), metres: look.metres })
  const drift = mx_noise_float(P.mul(.11)).mul(look.drift).add(mx_noise_float(P.mul(.37)).mul(look.drift * .5))
  const tone = float(1).add(bays ? h1.sub(.5).mul(look.cell) : float(0)).add(drift)
  // the saw cuts between bays, filtered to the pixel they land in
  const { east: pe, north: pn } = axisFootprint(P)
  const cut = (c: N, period: number, pixel: N): N => {
    const f = fract(c.div(period)), edge = f.min(float(1).sub(f)).mul(period)
    return lineCoverage(edge, .003, period, pixel)
  }
  const joint = bays ? cut(east, BAY.east, pe).max(cut(north, BAY.north, pn)) : float(0)
  const colour = sample.colour.mul(vec3(...look.tint)).mul(tone).mul(float(1).sub(joint.mul(.55)))
  m.colorNode = colour
  m.roughnessNode = mix(float(look.rough[0]), float(look.rough[1]), sample.roughness).add(joint.mul(.3)).clamp(.05, 1)
  const tangent = sample.normal
  const bent = t.mul(tangent.x.mul(look.normal)).add(b.mul(tangent.y.mul(look.normal))).add(n.mul(tangent.z)).normalize()
  m.normalNode = bent.transformDirection(cameraViewMatrix)
  m.aoNode = sample.occlusion
  // THE CLERESTORY'S SKY, THROWN UP BY ITS SHELF: bright over the shelf,
  // falling away south, on the faces that look down. A gradient, not a pool.
  if (look.shelf) {
    const south = P.z.sub(42.6).max(0)
    const down = n.y.negate().clamp(0, 1).add(n.z.negate().clamp(0, 1).mul(.35))
    m.emissiveNode = colour.mul(vec3(.78, .86, 1)).mul(south.div(-5.5).exp().mul(look.shelf).add(look.shelf * .06)).mul(down)
  }
  m.name = `vinci/collection-hall-fabric/${name}`
  m.userData = { ...HALL_FABRIC_PROVENANCE, set: set.name }
  return m
}

export interface HallFabric {
  group: Group
  /** the photographs are on the GPU */
  ready: Promise<void>
  dispose(): void
}

/** The hall's finish, its materials and the floor's reflection, each surface
 * lit by the hall's own rig through `adopt`. */
export function mountHallFabric(stack: Stack, adopt: (material: Material) => void): HallFabric {
  const { walls, overhead, floor, plinths } = skins()
  const concrete = stack.materials.sync('concrete-wall-formed')
  const ground = stack.materials.sync('concrete-floor-polished')
  // The formwork photograph is a khaki concrete; the hall's is a warm grey,
  // so its blue is lifted back to the photograph's red.
  const wallLook: Look = { metres: 2.71, tint: [.92, .97, 1.25], rough: [.62, .95], normal: 1, cell: 0, drift: .06 }
  const overheadLook: Look = { metres: 2.71, tint: [.84, .88, 1.1], rough: [.7, .98], normal: .8, cell: 0, drift: .05, shelf: .36 }
  const floorLook: Look = { metres: 3, tint: [.82, .8, .77], rough: [.24, .6], normal: .6, cell: .1, drift: .05 }
  const wallMaterial = fabricMaterial(concrete, wallLook, 'walls', false)
  const overheadMaterial = fabricMaterial(concrete, overheadLook, 'overhead', false)
  const floorMaterial = fabricMaterial(ground, floorLook, 'floor', true)
  // A plinth is a dark honed stone, so the machine on it is the lighter thing.
  const plinthLook: Look = { metres: 1.5, tint: [.36, .35, .34], rough: [.32, .62], normal: .5, cell: 0, drift: .04 }
  const plinthMaterial = fabricMaterial(ground, plinthLook, 'plinths', false)
  for (const material of [wallMaterial, overheadMaterial, floorMaterial, plinthMaterial]) adopt(material)
  // THE FLOOR IS SEALED, and a sealed floor carries what stands on it: the
  // room drawn once more from under the plane, blurred by the floor's own
  // roughness and weighted by the angle it is seen at.
  const plane = new Mesh(new PlaneGeometry(1, 1))
  plane.rotation.x = -Math.PI / 2
  plane.position.set((ROOMS.hall.west + ROOMS.hall.east) / 2, FLOOR + .003, -(ROOMS.hall.south + ROOMS.hall.north) / 2)
  plane.updateMatrixWorld(true)
  const reflection = stack.reflector(plane, { resolutionScale: .5, generateMipmaps: true })
  {
    const P = positionWorld
    const view = cameraPosition.sub(P).normalize()
    const facing = view.y.clamp(0, 1)
    const fresnel = float(.04).add(float(.96).mul(pow(float(1).sub(facing), 5)))
    const blur = reflection.node.level(float(2.2))
    floorMaterial.emissiveNode = blur.rgb.mul(fresnel).mul(.35)
  }
  const make = (skin: Skin, material: MeshStandardNodeMaterial, name: string): Mesh => {
    const mesh = new Mesh(skin.geometry(), material)
    mesh.name = `vinci/collection-hall-fabric/${name}`
    mesh.castShadow = false; mesh.receiveShadow = true
    mesh.userData = { ...HALL_FABRIC_PROVENANCE }
    return mesh
  }
  const group = new Group()
  group.name = 'vinci/collection-hall-fabric'
  group.userData = { ...HALL_FABRIC_PROVENANCE }
  group.add(make(walls, wallMaterial, 'walls'), make(overhead, overheadMaterial, 'overhead'), make(floor, floorMaterial, 'floor'),
    make(plinths, plinthMaterial, 'plinths'))
  const ready = Promise.all([concrete, ground].map(set => stack.materials.load(set.name))).then(() => undefined)
  return {
    group,
    ready,
    dispose() {
      reflection.dispose()
      plane.geometry.dispose()
      group.traverse(o => { if (o instanceof Mesh) o.geometry.dispose() })
      for (const m of [wallMaterial, overheadMaterial, floorMaterial, plinthMaterial]) m.dispose()
    },
  }
}

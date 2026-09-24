/** THE SUPPER ROOM: the room the Last Supper's measured field stands at the
 * end of. The field's wall is its end wall, plastered white round a reveal;
 * a concrete roof on deep beams closes it over, a top light along its south
 * wall lets the sky in over the field's left, the way the painted room's own
 * light falls, and the north side stands open on the court's afternoon. The
 * floor is fine pale marble that sends the light back up onto the wall.
 *
 * ONLY THE ROOM'S SURFACES TAKE ITS LIGHTS (`lightsNode`), and the field's
 * reproduction takes the same lights through `supperMuralLight()`: the image
 * is multiplied by the light that falls on it and is never itself changed.
 * The room is no rail solid; `supper-room-check.mjs` proves its triangles
 * clear of the walk. A modern room; no building of Milan or of 1517 is claimed.
 */
import {
  BufferGeometry, Color, CubeCamera, CubeRenderTarget, Float32BufferAttribute, FrontSide, Group, HalfFloatType, Mesh,
  MeshBasicNodeMaterial, MeshStandardNodeMaterial, PMREMGenerator, RectAreaLight, RectAreaLightNode, type Light, type Material,
  type Object3D, type RenderTarget, type Scene,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { lights as lightsOf, pmremTexture } from 'three/tsl'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { RectAreaLightTexturesLib } from 'three/addons/lights/RectAreaLightTexturesLib.js'
import type { Stack } from '../../../stack'
import type { MaterialSet } from '../../../stack/materials'
import { kelvinToColour } from '../../../stack/light'
import { axisFootprint, lineCoverage } from '../../../stack/detail'
import {
  END_FACE, FIELD, FINS, NAVE_PROBE_AT, PROBE_AT, ROOM, SILL, SUPPER_LIGHTS, SUPPER_ROOM_PROVENANCE, TOP_LIGHT, v3,
  endWall, fins, floor as floorBody, frame, roof, sillDress, southWall, upperEndWall, type Body, type SupperLight,
} from './supper-room-plan'

// The node overload boundary stays local to this file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any

const {
  abs, acos, cameraViewMatrix, cross, dot, float, floor: floorOf, fract, length, max, min, mix, mx_noise_float,
  normalWorldGeometry, positionWorld, select, smoothstep, uniform, vec2, vec3,
} = TSL as unknown as Record<string, N>

/** The sets the room is made of, all CC0 and already in the store. */
const SETS = ['plaster-lime-aged', 'concrete-wall-formed', 'marble-white', 'limestone-pale'] as const

const hash = (x: N, y: N, salt: number): N => fract(x.mul(12.9898).add(y.mul(78.233)).add(salt).sin().mul(43758.5453))

/** the tangent frame a world-aligned face is photographed in */
function faceFrame(n: N): { t: N; b: N } {
  const flat = abs(n.y).greaterThan(.5)
  const t = select(flat, vec3(1, 0, 0), cross(vec3(0, 1, 0), n).normalize())
  const b = select(flat, cross(n, vec3(1, 0, 0)), vec3(0, 1, 0))
  return { t, b }
}
const bend = (t: N, b: N, n: N, tangent: N, strength: number | N): N =>
  t.mul(tangent.x.mul(strength)).add(b.mul(tangent.y.mul(strength))).add(n.mul(tangent.z)).normalize().transformDirection(cameraViewMatrix)

/** THE LOOK OF EACH SURFACE, as uniforms an instrument may lean on. */
function looks() {
  return {
    /** the plaster's white (AD-2's range), the photograph only its variation */
    plasterWhite: uniform(new Color(.66, .65, .62)),
    /** how much of the photograph's staining the new plaster keeps */
    plasterKeep: uniform(.28),
    plasterNormal: uniform(.6),
    /** board-formed concrete of warm limestone aggregate (AD-2, 0.33) */
    concreteBase: uniform(new Color(.36, .345, .315)),
    concreteKeep: uniform(.85),
    concreteNormal: uniform(.85),
    marbleTint: uniform(new Color(.47, .46, .45)),
    borderTone: uniform(.8),
    marbleTone: uniform(.1),
    marbleRough: uniform(.12),
    groutColour: uniform(new Color(.52, .5, .47)),
    stoneTint: uniform(new Color(.9, .9, .9)),
    /** the diffuser as the eye sees it, over the light it gives the room */
    diffuserGlow: uniform(.72),
    /** the probe read at the scene's own level; the lift is the room's */
    envGain: uniform(1),
    envLift: uniform(.45),
    /** the field's own light: the direct terms, the bounce, the plaster's relief */
    muralDirect: uniform(1),
    muralBounce: uniform(1),
    muralRelief: uniform(.45),
    /** Engine-only terms: a renderer that shadows the reveal itself sets 0 */
    engineTerms: uniform(1),
  }
}
type Looks = ReturnType<typeof looks>

/** WHITE COARSE PLASTER, the room's walls: the photograph's relief kept, its
 * staining laid back toward a clean white, a slow drift so no wall is flat. */
function plasterMaterial(set: MaterialSet, L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .92, metalness: 0, side: FrontSide })
  const P = positionWorld, n = normalWorldGeometry
  const { t, b } = faceFrame(n)
  const sample = set.sample({ uv: vec2(dot(P, t), dot(P, b)), metres: 1.6 })
  const kept = mix(float(1), sample.albedo, L.plasterKeep)
  const drift = mx_noise_float(P.mul(.21)).mul(.035).add(mx_noise_float(P.mul(.93)).mul(.02))
  m.colorNode = L.plasterWhite.mul(kept).mul(drift.add(1))
  m.roughnessNode = mix(float(.84), float(.97), sample.roughness)
  m.normalNode = bend(t, b, n, sample.normal, L.plasterNormal)
  m.aoNode = sample.occlusion
  m.name = 'vinci/collection-supper-room/plaster'
  m.userData = { ...SUPPER_ROOM_PROVENANCE, set: set.name }
  return m
}

/** BOARD-FORMED CONCRETE, the roof, its beams and piers: the hall's own
 * photograph poured paler and warmer, its boards along the room's length. */
function concreteMaterial(set: MaterialSet, L: Looks, name: string): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .8, metalness: 0, side: FrontSide })
  const P = positionWorld, n = normalWorldGeometry
  const flat = abs(n.y).greaterThan(.5)
  // the boards run east, toward the field, on the soffit and on every beam
  const t = select(flat, vec3(0, 0, -1), select(abs(n.x).greaterThan(.5), vec3(0, 0, -1), vec3(1, 0, 0)))
  const b = select(flat, vec3(1, 0, 0), vec3(0, 1, 0))
  const sample = set.sample({ uv: vec2(dot(P, t), dot(P, b)), metres: 2.71 })
  const drift = mx_noise_float(P.mul(.13)).mul(.05).add(mx_noise_float(P.mul(.41)).mul(.025))
  m.colorNode = L.concreteBase.mul(mix(float(1), sample.albedo, L.concreteKeep)).mul(drift.add(1))
  m.roughnessNode = mix(float(.66), float(.95), sample.roughness)
  m.normalNode = bend(t, b, n, sample.normal, L.concreteNormal)
  m.aoNode = sample.occlusion
  m.name = `vinci/collection-supper-room/${name}`
  m.userData = { ...SUPPER_ROOM_PROVENANCE, set: set.name }
  return m
}

/** THE FLOOR: two-centimetre tesserae of white marble, each cut from its own
 * piece of the stone, their corners eased, set in a pale grout; the joint is
 * drawn only where a pixel can hold it, and fades to the floor's own tone. */
const TESSERA = .02, JOINT = .0011
/** the border's width, and the lines it is laid to */
const BORDER = .32, FINS_FRONT = FINS.front, SILL_EAST = SILL.east
function marbleMaterial(set: MaterialSet, L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .34, metalness: 0, side: FrontSide })
  const P = positionWorld
  const east = P.x, north = P.z.negate()
  const i = floorOf(east.div(TESSERA)), j = floorOf(north.div(TESSERA))
  const h1 = hash(i, j, 5.3), h2 = hash(i, j, 9.1)
  // each tessera shows its own patch of the stone
  const sample = set.sample({ uv: vec2(east, north).add(vec2(h1, h2).mul(3.7)), metres: .6 })
  const coarse = set.sample({ uv: vec2(east, north).mul(.37).add(vec2(11.2, 4.4)), metres: 2.4 })
  const { east: pe, north: pn } = axisFootprint(P)
  const fe = fract(east.div(TESSERA)), fn = fract(north.div(TESSERA))
  const de = min(fe, float(1).sub(fe)).mul(TESSERA), dn = min(fn, float(1).sub(fn)).mul(TESSERA)
  const pixel = max(pe, pn)
  // eased corners: the joint widens a little where two joints meet
  const corner = smoothstep(.0032, 0, vec2(de, dn).length()).mul(.0009)
  const half = corner.add(JOINT)
  const joint = lineCoverage(de, half, TESSERA, pixel).max(lineCoverage(dn, half, TESSERA, pixel))
  const tone = float(1).add(h1.sub(.5).mul(L.marbleTone)).add(h2.sub(.5).mul(L.marbleTone.mul(.4)))
  const stone = sample.colour.mul(.55).add(coarse.colour.mul(.45)).mul(L.marbleTint).mul(tone)
  // A BORDER OF THE SAME MARBLE LAID LONG, a shade darker, round every edge
  // the floor meets, and across the step where the nave gives onto the bay
  const inBay = east.lessThan(ROOM.step)
  const toWall = min(
    select(inBay, north.sub(ROOM.baySouth), north.sub(FINS_FRONT)),
    select(inBay, float(ROOM.north).sub(north), float(ROOM.naveNorth).sub(north)))
  const toEnd = min(east.sub(SILL_EAST), abs(east.sub(ROOM.step)))
  const edge = min(toWall, toEnd)
  const band = smoothstep(BORDER + .004, BORDER - .004, edge)
  const seam = lineCoverage(edge.sub(BORDER), .0016, 1, pixel)
  const laid = mix(stone, stone.mul(L.borderTone), band)
  m.colorNode = mix(mix(laid, L.groutColour, joint.mul(.85).mul(float(1).sub(band))), L.groutColour, seam.mul(.9))
  m.roughnessNode = L.marbleRough.add(h2.sub(.5).mul(.08)).add(joint.mul(.4).mul(float(1).sub(band))).add(band.mul(.08)).clamp(.08, 1)
  m.name = 'vinci/collection-supper-room/marble'
  m.userData = { ...SUPPER_ROOM_PROVENANCE, set: set.name }
  return m
}

/** THE SILL IN PALE LIMESTONE, honed. */
function stoneMaterial(set: MaterialSet, L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .5, metalness: 0, side: FrontSide })
  const P = positionWorld, n = normalWorldGeometry
  const { t, b } = faceFrame(n)
  const sample = set.sample({ uv: vec2(dot(P, t), dot(P, b)), metres: 1.6 })
  m.colorNode = sample.colour.mul(L.stoneTint)
  m.roughnessNode = mix(float(.42), float(.66), sample.roughness)
  m.normalNode = bend(t, b, n, sample.normal, .5)
  m.name = 'vinci/collection-supper-room/limestone'
  m.userData = { ...SUPPER_ROOM_PROVENANCE, set: set.name }
  return m
}

/* ---- the field's own light ---------------------------------------------- */

/** One edge of Lambert's polygon integral, seen from P with normal n. */
function edgeTerm(P: N, n: N, a: N, b: N): N {
  const va = a.sub(P).normalize(), vb = b.sub(P).normalize()
  const c = cross(va, vb)
  return acos(dot(va, vb).clamp(-.99999, .99999)).mul(dot(n, c).div(length(c).max(1e-7)))
}
/** The form factor of a four-cornered emitter from P: the share of a
 * Lambertian surface's irradiance a unit-radiance emitter gives it. */
function formFactor(P: N, n: N, c: readonly [N, N, N, N]): N {
  return edgeTerm(P, n, c[0], c[1]).add(edgeTerm(P, n, c[1], c[2])).add(edgeTerm(P, n, c[2], c[3])).add(edgeTerm(P, n, c[3], c[0]))
    .abs().div(2 * Math.PI)
}

interface MuralLight {
  node: N
  /** each light's radiance, kept equal to the rig's own */
  radiance: Map<string, N>
}

let mural: MuralLight | undefined

/** THE LIGHT ON THE FIELD. The reproduction is drawn unlit and multiplied by
 * this: each of the room's openings as an exact polygon from every point of
 * the field, clipped where the reveal stands between them, the plaster's own
 * relief turning each a little, and the room's bounce from its probe, looked
 * up lower toward the floor and higher toward the soffit. */
function buildMuralLight(L: Looks, plasterSet: MaterialSet, bounce: N): MuralLight {
  const P = positionWorld
  const n = vec3(1, 0, 0)
  const d = END_FACE - FIELD.face
  const x0 = float(FIELD.face)
  const yP = P.y, nP = P.z.negate()
  const radiance = new Map<string, N>()
  for (const spec of SUPPER_LIGHTS) radiance.set(spec.name, uniform(kelvinToColour(spec.kelvin).multiplyScalar(spec.intensity)))
  // the plaster under the paint, in the set's own tangent space (u north, v
  // up) turned into the wall's frame; a slow wave so the wall is not a plane
  const s = plasterSet.sample({ uv: vec2(nP, yP), metres: 1.6 })
  const slow = mx_noise_float(vec3(nP.mul(.9), yP.mul(.9), 1.7)).mul(.06)
  const bumped = vec3(s.normal.z, s.normal.y.add(slow.mul(.6)), s.normal.x.add(slow).negate()).normalize()
  const turn = (dir: N): N => mix(float(1), dot(bumped, dir).div(dot(n, dir).max(.02)).clamp(.55, 1.6), L.muralRelief)
  // THE TOP LIGHT, a level rectangle over the south wall. The reveal's head
  // hides the part of it nearest the wall from a point high on the field, its
  // south jamb the part a point near the field's left edge looks past.
  const T = TOP_LIGHT
  const yD = float(T.diffuser)
  const reachTop = yD.sub(yP).mul(d).div(float(FIELD.top).sub(yP).max(.0015))
  const reachSouth = nP.sub(T.south).mul(d).div(nP.sub(FIELD.south).max(.0015))
  const near = max(float(T.west - FIELD.face), max(reachTop, reachSouth)).min(T.east - FIELD.face)
  const xa = x0.add(near)
  const top = formFactor(P, n, [vec3(xa, yD, -T.south), vec3(T.east, yD, -T.south), vec3(T.east, yD, -T.north), vec3(xa, yD, -T.north)])
  const keyDir = vec3(xa.add(T.east).mul(.5), yD, -(T.south + T.north) / 2).sub(P).normalize()
  let direct: N = radiance.get('top-light')!.mul(top).mul(turn(keyDir))
  // THE OPEN NORTH SIDE, two upright rectangles: the nave's face and the
  // bay's. The reveal's north jamb hides the bay's nearest part from a point
  // near the field's right edge.
  for (const spec of SUPPER_LIGHTS) {
    if (spec.name === 'top-light' || spec.receivers === 'nave') continue
    const opening = uprightOpening(spec)
    let west: N = float(Math.max(0, opening.west - FIELD.face))
    if (opening.north > FIELD.north) {
      const reach = float(opening.north).sub(nP).mul(d).div(float(FIELD.north).sub(nP).max(.0015))
      west = max(west, reach).min(opening.east - FIELD.face)
    }
    const xw = x0.add(west)
    const f = formFactor(P, n, [vec3(xw, opening.low, -opening.north), vec3(opening.east, opening.low, -opening.north),
      vec3(opening.east, opening.high, -opening.north), vec3(xw, opening.high, -opening.north)])
    const dir = vec3(xw.add(opening.east).mul(.5), (opening.low + opening.high) / 2, -opening.north).sub(P).normalize()
    direct = direct.add(radiance.get(spec.name)!.mul(f).mul(turn(dir)))
  }
  // THE BOUNCE: the reveal's rim sees less of the room than the field's middle
  const edgeIn = min(min(nP.sub(FIELD.south), float(FIELD.north).sub(nP)), min(yP.sub(FIELD.bottom), float(FIELD.top).sub(yP)))
  const rim = smoothstep(0, d * 2.4, edgeIn).mul(.28).add(.72)
  const ambient = bounce.mul(L.envLift).mul(L.muralBounce).mul(mix(float(1), rim, L.engineTerms))
  return { node: direct.mul(L.muralDirect).add(ambient), radiance }
}

/** An opening of the north side as an upright rectangle facing south. */
function uprightOpening(spec: SupperLight): { west: number; east: number; north: number; low: number; high: number } {
  const [e, n, h] = spec.at
  return { west: e - spec.width / 2, east: e + spec.width / 2, north: n, low: h - spec.height / 2, high: h + spec.height / 2 }
}

/** The field's reproduction takes this in place of the rooms' own tone: the
 * light of the supper room on it. Undefined until the room stands. */
export function supperMuralLight(): N | undefined {
  return mural?.node
}

export interface SupperRoom {
  group: Group
  ready: Promise<void>
  /** How many takes of the room's bounce are still owed. */
  tick(bodies: readonly Object3D[]): void
  dispose(): void
}

/** The calm tier takes no probe: the hero tier's bounce measured as a fill,
 * the bay's lit by its top light and the nave's by the bay and the court. */
const CALM_FILL = {
  bay: { up: [.3, .3, .3], down: [.34, .33, .31], side: [.32, .32, .33] },
  nave: { up: [.16, .16, .16], down: [.2, .19, .18], side: [.22, .21, .2] },
} as const

type Zone = 'bay' | 'nave' | 'out'

export function mountSupperRoom(stack: Stack): SupperRoom {
  const tier = stack.tierName(), calm = tier === 'calm'
  const L = looks()
  const group = new Group()
  group.name = 'vinci/collection-supper-room'
  group.userData = { ...SUPPER_ROOM_PROVENANCE }
  const owned: Mesh[] = [], materials: Material[] = []

  // THE LIGHTS, from the one table; each handed only to what it can see
  RectAreaLightNode.setLTC(RectAreaLightTexturesLib.init())
  const built: { light: RectAreaLight; spec: SupperLight }[] = []
  for (const spec of SUPPER_LIGHTS) {
    const area = new RectAreaLight(kelvinToColour(spec.kelvin), spec.intensity, spec.width, spec.height)
    area.position.copy(v3(...spec.at))
    area.lookAt(v3(...spec.aim))
    area.name = `vinci/collection-supper-room/${spec.name}`
    area.userData = { ...SUPPER_ROOM_PROVENANCE }
    // out of the scene's own list, which every other surface reads
    area.visible = false
    group.add(area)
    built.push({ light: area, spec })
  }
  const rigOf = (zone: 'bay' | 'nave'): Light[] => built.filter(({ spec }) => spec.receivers === zone || spec.receivers === 'both').map(({ light }) => light)

  // THE BOUNCE: a probe in each volume, turned by the scene's own
  // environment turn and re-taken into the same target
  let generator: PMREMGenerator | undefined
  type Probe = { camera: CubeCamera; target: CubeRenderTarget; pmrem: RenderTarget }
  const probes: Partial<Record<'bay' | 'nave', Probe>> = {}
  const env: Record<'bay' | 'nave', N> = { bay: null, nave: null }
  for (const zone of ['bay', 'nave'] as const) {
    if (!calm) {
      generator ??= new PMREMGenerator(stack.renderer)
      const target = new CubeRenderTarget(tier === 'hero' ? 256 : 128, { type: HalfFloatType })
      const camera = new CubeCamera(.05, 2400, target)
      camera.position.copy(v3(...(zone === 'bay' ? PROBE_AT : NAVE_PROBE_AT)))
      const probe = { camera, target, pmrem: generator.fromCubemap(target.texture) }
      probes[zone] = probe
      env[zone] = pmremTexture(probe.pmrem.texture).mul(L.envGain).mul(L.envLift)
    } else {
      const n = normalWorldGeometry, F = CALM_FILL[zone]
      env[zone] = mix(vec3(...F.down), vec3(...F.up), n.y.mul(.5).add(.5)).add(vec3(...F.side).mul(n.z.max(0))).mul(L.envGain).mul(L.envLift)
    }
  }
  const adopt = (material: Material, zone: 'bay' | 'nave'): void => {
    const lit = material as Material & { lightsNode?: unknown; envNode?: unknown }
    lit.lightsNode = lightsOf(rigOf(zone))
    lit.envNode = env[zone]
    material.needsUpdate = true
  }

  // THE SURFACES, one of each for the bay and for the nave
  const [plasterSet, concreteSet, marbleSet, stoneSet] = SETS.map(name => stack.materials.sync(name))
  const lit: Record<'plaster' | 'concrete' | 'marble', Record<'bay' | 'nave', MeshStandardNodeMaterial>> = {
    plaster: { bay: plasterMaterial(plasterSet!, L), nave: plasterMaterial(plasterSet!, L) },
    concrete: { bay: concreteMaterial(concreteSet!, L, 'concrete-bay'), nave: concreteMaterial(concreteSet!, L, 'concrete-nave') },
    marble: { bay: marbleMaterial(marbleSet!, L), nave: marbleMaterial(marbleSet!, L) },
  }
  for (const family of Object.values(lit)) for (const zone of ['bay', 'nave'] as const) {
    adopt(family[zone], zone)
    family[zone].name += `-${zone}`
    materials.push(family[zone])
  }
  const concreteOut = concreteMaterial(concreteSet!, L, 'concrete-out')
  const stone = stoneMaterial(stoneSet!, L)
  adopt(stone, 'bay')
  const skirt = new MeshStandardNodeMaterial({ color: '#2a2622', roughness: .45, metalness: .7 })
  skirt.name = 'vinci/collection-supper-room/diffuser-frame'
  adopt(skirt, 'bay')
  const top = SUPPER_LIGHTS[0]!
  const glowColour = kelvinToColour(top.kelvin).multiplyScalar(top.intensity)
  const diffuser = new MeshBasicNodeMaterial()
  {
    const P = positionWorld
    // a panel of etched glass: its joints every 1.2 m and the slot's own
    // falloff toward its ends, where the well shades it
    const along = P.x.sub(TOP_LIGHT.west).div(1.2)
    const seam = smoothstep(.012, 0, abs(fract(along).sub(.5)).mul(-1).add(.5).mul(1.2)).mul(.25)
    const ends = smoothstep(0, .9, P.x.sub(TOP_LIGHT.west)).mul(smoothstep(0, .9, float(TOP_LIGHT.east).sub(P.x)))
    diffuser.colorNode = vec3(glowColour.r, glowColour.g, glowColour.b).mul(L.diffuserGlow).mul(ends.mul(.25).add(.75)).mul(float(1).sub(seam))
  }
  diffuser.name = 'vinci/collection-supper-room/diffuser'
  const glass = new MeshStandardNodeMaterial({ color: '#1c2226', roughness: .08, metalness: .1 })
  glass.name = 'vinci/collection-supper-room/skylight'
  materials.push(concreteOut, stone, skirt, diffuser, glass)

  // WHICH VOLUME A FACE LOOKS INTO: a face whose outside lies in the bay's air
  // or the nave's takes that volume's light; every other face is lit by the day
  const zoneOf = (e: number, n: number, h: number): Zone => {
    if (h < ROOM.floor - .01 || n < ROOM.south - .001 || e < ROOM.west - .001) return 'out'
    if (e < ROOM.step && n < ROOM.baySouth - .001 && h < ROOM.baySoffit) return 'out'
    const inSlot = h < ROOM.bayTop + .05 && e > TOP_LIGHT.west - .001 && e < TOP_LIGHT.east + .001 && n > TOP_LIGHT.south - .001 && n < TOP_LIGHT.north + .001
    if (inSlot || (e < ROOM.step + .001 && n < ROOM.north + .001 && h < ROOM.baySoffit + .001)) return e < ROOM.step ? 'bay' : 'nave'
    if (e < ROOM.east + .001 && n < ROOM.naveNorth + .001 && h < ROOM.naveSoffit + .001) return 'nave'
    return 'out'
  }
  const sort = (body: Body): Record<Zone, BufferGeometry | null> => {
    const g = body.geometry(), p = g.getAttribute('position'), nr = g.getAttribute('normal'), uv = g.getAttribute('uv')
    const keep: Record<Zone, number[]> = { bay: [], nave: [], out: [] }
    for (let t = 0; t < p.count; t += 3) {
      const cx = (p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3, cy = (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3
      const cz = (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3
      keep[zoneOf(cx + nr.getX(t) * .05, -(cz + nr.getZ(t) * .05), cy + nr.getY(t) * .05)].push(t)
    }
    const pick = (list: number[]): BufferGeometry | null => {
      if (!list.length) return null
      const q: number[] = [], m: number[] = [], w: number[] = []
      for (const t of list) for (let k = 0; k < 3; k++) {
        q.push(p.getX(t + k), p.getY(t + k), p.getZ(t + k))
        m.push(nr.getX(t + k), nr.getY(t + k), nr.getZ(t + k))
        w.push(uv.getX(t + k), uv.getY(t + k))
      }
      const made = new BufferGeometry()
      made.setAttribute('position', new Float32BufferAttribute(q, 3))
      made.setAttribute('normal', new Float32BufferAttribute(m, 3))
      made.setAttribute('uv', new Float32BufferAttribute(w, 2))
      made.computeBoundingBox(); made.computeBoundingSphere()
      return made
    }
    const out = { bay: pick(keep.bay), nave: pick(keep.nave), out: pick(keep.out) }
    g.dispose()
    return out
  }
  const make = (geometry: BufferGeometry | null, material: Material, name: string, shadow: boolean): Mesh | null => {
    if (!geometry) return null
    const mesh = new Mesh(geometry, material)
    mesh.name = `vinci/collection-supper-room/${name}`
    mesh.castShadow = shadow; mesh.receiveShadow = true
    mesh.userData = { ...SUPPER_ROOM_PROVENANCE, asset: SUPPER_ROOM_PROVENANCE.manifestId }
    owned.push(mesh)
    group.add(mesh)
    return mesh
  }
  const merged = (parts: (BufferGeometry | null)[]): BufferGeometry | null => {
    const kept = parts.filter((part): part is BufferGeometry => part !== null)
    if (!kept.length) return null
    const g = mergeGeometries(kept)
    for (const part of kept) part.dispose()
    return g
  }

  const { plaster: wall, reveal } = endWall()
  const { slab, well, diffuser: panel, glass: pane } = roof()
  const parts = { wall: sort(wall), reveal: sort(reveal), south: sort(southWall()), upper: sort(upperEndWall()),
    slab: sort(slab), frame: sort(frame()), fins: sort(fins()), floor: sort(floorBody()) }
  for (const zone of ['bay', 'nave'] as const) {
    make(merged([parts.wall[zone], parts.reveal[zone], parts.south[zone], parts.frame[zone], parts.fins[zone]]), lit.plaster[zone], `plaster-${zone}`, false)
    make(merged([parts.slab[zone], parts.upper[zone]]), lit.concrete[zone], `concrete-${zone}`, false)
    make(parts.floor[zone], lit.marble[zone], `floor-${zone}`, false)
  }
  // the room's outside stands in the day and throws the day's shadow
  make(merged([parts.wall.out, parts.reveal.out, parts.south.out, parts.upper.out, parts.slab.out, parts.frame.out, parts.fins.out, parts.floor.out]),
    concreteOut, 'concrete-out', true)
  make(sillDress().geometry(), stone, 'sill', false)
  make(well.geometry(), skirt, 'diffuser-frame', false)
  const glow = make(panel.geometry(), diffuser, 'diffuser', false)
  if (glow) glow.receiveShadow = false
  make(pane.geometry(), glass, 'skylight', false)

  // THE FIELD'S OWN LIGHT, the bay's openings from the same table, and the
  // bounce the bay's walls take (the walls read the probe through the scene's
  // own environment level and divide it back out; the field reads it straight)
  const look = vec3(1, positionWorld.y.sub((FIELD.bottom + FIELD.top) / 2).mul(.22), 0).normalize()
  const bayProbe = probes.bay
  const bounce = bayProbe ? pmremTexture(bayProbe.pmrem.texture, look, float(1)) : vec3(...CALM_FILL.bay.side).add(.02)
  mural = buildMuralLight(L, plasterSet!, bounce)
  const syncRadiance = (): void => {
    for (const { light, spec } of built) mural?.radiance.get(spec.name)?.value.copy(light.color).multiplyScalar(light.intensity)
  }
  syncRadiance()

  // `?supperrig` hands an instrument the rig's levels and the looks
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('supperrig')) {
    ;(window as unknown as Record<string, unknown>)['__supperRig'] = {
      names: built.map(({ spec }) => spec.name),
      level(name: string, value: number) {
        for (const { light, spec } of built) if (spec.name.startsWith(name)) light.intensity = value
        syncRadiance()
      },
      kelvin(name: string, value: number) {
        for (const { light, spec } of built) if (spec.name.startsWith(name)) light.color.copy(kelvinToColour(value))
        syncRadiance()
      },
      looks: L,
      lights: Object.fromEntries(built.map(({ light, spec }) => [spec.name, light])),
      bake: () => { owed = 3 },
      /** the scene the room stands in, for an instrument that hides a body */
      root: () => { let o: Object3D = group; while (o.parent) o = o.parent; return o },
    }
  }

  let owed = 0, live = true
  // three takes, so the bounce carries two bounces of its own
  const ready = Promise.all(SETS.map(name => stack.materials.load(name))).then(() => { if (live) owed = 3 }, () => { if (live) owed = 3 })

  function take(bodies: readonly Object3D[]): void {
    if (!generator) return
    let scene: Object3D = group
    while (scene.parent) scene = scene.parent
    const root = scene as Scene
    if (!root.isScene) return
    L.envGain.value = 1 / Math.max(.01, root.environmentIntensity)
    const shown = bodies.map(body => body.visible)
    for (const body of bodies) body.visible = true
    try {
      for (const probe of Object.values(probes)) {
        probe.camera.rotation.copy(root.environmentRotation)
        probe.camera.updateMatrixWorld(true)
        probe.camera.update(stack.renderer, root)
        generator.fromCubemap(probe.target.texture, probe.pmrem)
      }
    } finally { bodies.forEach((body, i) => { body.visible = shown[i]! }) }
  }

  return {
    group,
    ready: ready.then(() => undefined),
    tick(bodies) {
      if (owed <= 0) return
      owed--
      take([group, ...bodies])
    },
    dispose() {
      live = false
      mural = undefined
      for (const mesh of owned) { mesh.removeFromParent(); mesh.geometry.dispose() }
      for (const m of materials) m.dispose()
      for (const { light } of built) { light.removeFromParent(); light.dispose() }
      for (const probe of Object.values(probes)) { probe.pmrem.dispose(); probe.target.dispose() }
      generator?.dispose()
      group.removeFromParent()
    },
  }
}

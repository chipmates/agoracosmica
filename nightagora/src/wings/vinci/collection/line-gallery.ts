/** THE GALLERY OF THE LIFE, FOR THE FILM: the long room where the dates are
 * cut into the floor. The line's field is honed limestone, each slab its own
 * piece of one CC0 photograph with its bedding laid along the walk and the
 * dates' bronze let into it; round the field lies the building's own sealed
 * concrete, the walls and the coffered soffit are its board-formed concrete,
 * and oiled oak benches stand at the glass. North-east daylight through the
 * glazed wall is the key; every date stands in a warm pool from a head on a
 * track over the line; a slot in the soffit washes the far wall warm.
 *
 * ONLY THE GALLERY'S SURFACES TAKE THESE LIGHTS (`lightsNode`): the wing's
 * other surfaces sample nothing new. The finish lies over the certified
 * construction and is no rail solid; the benches and fittings stand outside
 * the fingerprint and `line-gallery-check.mjs` proves them clear of the walk.
 * A modern room; no light or building of 1517 is claimed.
 */
import {
  Color, CubeCamera, CubeRenderTarget, CustomBlending, DirectionalLight, DoubleSide, FrontSide, Group, HalfFloatType, Mesh,
  MeshBasicNodeMaterial, MeshStandardNodeMaterial, Object3D, OneFactor, OneMinusSrcAlphaFactor, PMREMGenerator, RectAreaLight,
  RectAreaLightNode, SpotLight, type BufferGeometry, type Light, type Material, type RenderTarget, type Scene,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { lights as lightsOf, pmremTexture } from 'three/tsl'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { RectAreaLightTexturesLib } from 'three/addons/lights/RectAreaLightTexturesLib.js'
import type { Stack } from '../../../stack'
import type { MaterialSet } from '../../../stack/materials'
import { kelvinToColour } from '../../../stack/light'
import { anisotropicFootprint, axisFootprint, fractalField, lineCoverage, resolved } from '../../../stack/detail'
import type { LineMaterials } from '../line'
import { COLLECTION_PAVING_ORIGIN, LINE_ORIGIN, LINE_SLAB } from './layout'
import {
  benches, ceilingSkin, DATE_MIDDLE_EAST, fittings, floorSkins, GALLERY_LIGHTS, GALLERY_SHADOW_LAYER, GLAZING, glazingPanes,
  LINE_GALLERY_PROVENANCE, PROBE_AT, shadowCasters, Skin, v3, wallSkins, type GalleryLight, type Solid,
} from './line-gallery-plan'

// The node overload boundary stays local to this file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any

const {
  abs, attribute, cameraViewMatrix, cross, dot, float, floor: floorOf, fract, mix, mx_noise_float, normalView, normalWorldGeometry,
  positionViewDirection, positionWorld, select, smoothstep, uniform, vec2, vec3,
} = TSL as unknown as Record<string, N>

/** The sets the gallery is dressed from, all CC0 and already in the store. */
const SETS = ['concrete-wall-formed', 'concrete-floor-polished', 'oak-veneer-light', 'limestone-pale'] as const
/** The limestone photograph's own tile: one repeat is 1.2 m of stone. */
const STONE_TILE = 1.2
/** The building's floor bays: two museum stones each way, as in the hall. */
const BAY = { east: 3.2, north: 3.3 } as const

const hash = (x: N, y: N, salt: number): N => fract(x.mul(12.9898).add(y.mul(78.233)).add(salt).sin().mul(43758.5453))

/** the tangent frame a world-aligned face is photographed in: u runs along
    the face, v up it; a level face's u runs east and v north */
function faceFrame(n: N): { t: N; b: N } {
  const flat = abs(n.y).greaterThan(.5)
  const t = select(flat, vec3(1, 0, 0), cross(vec3(0, 1, 0), n).normalize())
  const b = select(flat, cross(n, vec3(1, 0, 0)), vec3(0, 1, 0))
  return { t, b }
}

/** a tangent-space normal from a set, bent into the world and handed over in view space */
const bend = (t: N, b: N, n: N, tangent: N, strength: number | N): N =>
  t.mul(tangent.x.mul(strength)).add(b.mul(tangent.y.mul(strength))).add(n.mul(tangent.z)).normalize().transformDirection(cameraViewMatrix)

/** THE LOOK OF EACH SURFACE, as uniforms: a live instrument may lean on them
 * and no shader is rebuilt. Values are the room's own, chosen in the look
 * rounds. */
function looks() {
  return {
    stoneTint: uniform(new Color(.84, .87, .94)),
    /** how much of the photograph's own banding the honed face keeps */
    stoneBand: uniform(.15),
    stoneRough: uniform(.46),
    /** how far the walk along the dates has polished its band */
    stoneWalk: uniform(.08),
    stoneTone: uniform(.28),
    stoneNormal: uniform(.22),
    /** the limestone's own body: its clouds, its grain and its shell */
    stoneCloud: uniform(.22),
    stoneGrain: uniform(.2),
    stoneFleck: uniform(.28),
    fleckTint: uniform(new Color(.93, .95, 1.02)),
    groutColour: uniform(new Color('#5f574c')),
    bronzeColour: uniform(new Color(.26, .2, .13)),
    bronzeRough: uniform(.26),
    /** the numerals' statuary finish: the same bronze under a dark waxed
     * patina, so a lamp overhead lays a sheen on a year and no mirror */
    yearColour: uniform(new Color(.26, .2, .13)),
    yearPatina: uniform(.3),
    yearRough: uniform(.62),
    yearMetal: uniform(.45),
    inkColour: uniform(new Color('#2a2724')),
    // the hall's photographs, poured paler here: a daylit room's concrete
    // stands near AD-2's 0.33, its sealed floor near 0.19
    wallTint: uniform(new Color(1.26, 1.33, 1.7)),
    soffitTint: uniform(new Color(1.15, 1.34, 1.95)),
    floorTint: uniform(new Color(2.4, 2.34, 2.22)),
    oakTint: uniform(new Color(.78, .74, .7)),
    darkTint: uniform(new Color(.55, .53, .51)),
    /** the film on the glass: how much of a pane it covers at its foot */
    glassFilm: uniform(.3),
    glassFilmColour: uniform(new Color(.5, .5, .47)),
    /** the probe read at the scene's own level; the lift is the room's */
    envGain: uniform(1),
    envLift: uniform(1.25),
    /** Engine-only terms (the dark of a joint the engine casts no shadow
     * into): a renderer that computes its own shadows sets this to zero. */
    engineTerms: uniform(1),
  }
}
type Looks = ReturnType<typeof looks>

/** THE BUILDING'S CONCRETE, walls and soffit in one: the formwork photograph
 * at the hall's own size and lean, the soffit a shade cooler than the walls. */
function concreteMaterial(set: MaterialSet, L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .8, metalness: 0, side: FrontSide })
  const P = positionWorld, n = normalWorldGeometry
  const { t, b } = faceFrame(n)
  const sample = set.sample({ uv: vec2(dot(P, t), dot(P, b)), metres: 2.71 })
  const down = n.y.lessThan(-.5)
  const drift = mx_noise_float(P.mul(.11)).mul(.06).add(mx_noise_float(P.mul(.37)).mul(.03))
  m.colorNode = sample.colour.mul(select(down, L.soffitTint, L.wallTint)).mul(drift.add(1))
  m.roughnessNode = mix(select(down, float(.7), float(.62)), select(down, float(.98), float(.95)), sample.roughness)
  m.normalNode = bend(t, b, n, sample.normal, select(down, float(.8), float(1)))
  m.aoNode = sample.occlusion
  m.name = 'vinci/collection-line-gallery/concrete'
  m.userData = { ...LINE_GALLERY_PROVENANCE, set: set.name }
  return m
}

/** THE BUILDING'S SEALED FLOOR round the line: bays of 3.2 by 3.3 m on the
 * paving datum the hall and the reading room lie on, each read from its own
 * part of the photograph, with saw cuts between them. */
function floorMaterial(set: MaterialSet, L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .6, metalness: 0, side: FrontSide })
  const P = positionWorld, n = normalWorldGeometry
  const east = P.x.sub(COLLECTION_PAVING_ORIGIN.east), north = P.z.negate().sub(COLLECTION_PAVING_ORIGIN.north)
  const cellE = floorOf(east.div(BAY.east)), cellN = floorOf(north.div(BAY.north))
  const h1 = hash(cellE, cellN, 3.7), h2 = hash(cellE, cellN, 11.3)
  const sample = set.sample({ uv: vec2(P.x, P.z.negate()).add(vec2(h1, h2).mul(23.7)), metres: 3 })
  const drift = mx_noise_float(P.mul(.11)).mul(.09).add(mx_noise_float(P.mul(.37)).mul(.045))
  const { east: pe, north: pn } = axisFootprint(P)
  const cut = (c: N, period: number, pixel: N): N => {
    const f = fract(c.div(period)), edge = f.min(float(1).sub(f)).mul(period)
    return lineCoverage(edge, .003, period, pixel)
  }
  const joint = cut(east, BAY.east, pe).max(cut(north, BAY.north, pn))
  m.colorNode = sample.colour.mul(L.floorTint).mul(float(1).add(h1.sub(.5).mul(.18)).add(drift)).mul(float(1).sub(joint.mul(.55)))
  m.roughnessNode = mix(float(.4), float(.72), sample.roughness).add(joint.mul(.3)).clamp(.05, 1)
  m.normalNode = bend(vec3(1, 0, 0), vec3(0, 0, -1), n, sample.normal, .6)
  m.aoNode = sample.occlusion
  m.name = 'vinci/collection-line-gallery/floor'
  m.userData = { ...LINE_GALLERY_PROVENANCE, set: set.name }
  return m
}

/** A DARK HONED STONE: the back of every shadow gap and the benches' bases. */
function darkMaterial(set: MaterialSet, L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .5, metalness: 0, side: FrontSide })
  const P = positionWorld, n = normalWorldGeometry
  const { t, b } = faceFrame(n)
  const sample = set.sample({ uv: vec2(dot(P, t), dot(P, b)), metres: 1.5 })
  m.colorNode = sample.colour.mul(L.darkTint)
  m.roughnessNode = mix(float(.32), float(.62), sample.roughness)
  m.normalNode = bend(t, b, n, sample.normal, .5)
  m.name = 'vinci/collection-line-gallery/dark-stone'
  m.userData = { ...LINE_GALLERY_PROVENANCE, set: set.name }
  return m
}

/** OILED OAK, its grain along each bench's own length on every long face
 * and up its end grain. */
function oakMaterial(set: MaterialSet, L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .55, metalness: 0, side: FrontSide })
  const P = positionWorld, n = normalWorldGeometry
  const east = attribute('grain', 'float').greaterThan(.5)
  const along = select(east, vec3(1, 0, 0), vec3(0, 0, -1))
  const grain = select(abs(dot(n, along)).greaterThan(.5), vec3(0, 1, 0), along)
  const t = cross(grain, n).normalize()
  const sample = set.sample({ uv: vec2(dot(P, t), dot(P, grain)), metres: 1.83 })
  m.colorNode = sample.colour.mul(L.oakTint)
  m.roughnessNode = mix(float(.4), float(.7), sample.roughness)
  m.normalNode = bend(t, grain, n, sample.normal, .7)
  m.aoNode = sample.occlusion
  m.name = 'vinci/collection-line-gallery/oak'
  m.userData = { ...LINE_GALLERY_PROVENANCE, set: set.name }
  return m
}

/** A PIECE OF SHELL IN THE STONE, one to a cell at most: `f` is the place in
 * the cell's own units, centred. Returns how much of the pixel the piece
 * covers, already faded to its own area mean where the pixel is wider than
 * the piece, so a floor of flecks settles on a tone instead of crawling. */
function fleck(f: N, id: N, salt: number, share: number, long: [number, number], slender: [number, number], cellM: number, fp: N): N {
  const h = (k: number): N => hash(id.x, id.y, salt + k * 1.37)
  const at = f.sub(vec2(h(1), h(2)).sub(.5).mul(.24))
  const turn = h(3).mul(Math.PI * 2), c = turn.cos(), s = turn.sin()
  const length = mix(float(long[0]), float(long[1]), h(4).mul(h(4))), width = length.mul(mix(float(slender[0]), float(slender[1]), h(5)))
  // a shard, not a grain of rice: bowed like the shell it broke from and
  // drawn to points, so the outline is a curve with two tips
  const along = at.x.mul(c).add(at.y.mul(s))
  const bow = h(7).sub(.5).mul(1.6).mul(along.mul(along)).div(length)
  const q = vec2(along, at.y.mul(c).sub(at.x.mul(s)).add(bow)).div(vec2(length, width)).abs()
  const reach = q.x.pow(1.35).add(q.y.pow(1.35)).pow(1 / 1.35)
  const edge = fp.div(cellM).div(width).add(.04)
  const drawn = smoothstep(float(1).add(edge), float(1).sub(edge), reach).mul(select(h(6).lessThan(share), float(1), float(0)))
  const mean = float(share * 3.1).mul(length).mul(width)
  return mix(mean, drawn, resolved(width.mul(cellM * 2), fp))
}

/** THE LINE'S LIMESTONE. Each slab of the field is read from its own piece
 * of the photograph at the photograph's own scale, turned end for end on
 * half of them, with its bedding laid along the walk and only a trace of its
 * banding kept; a slab carries its own tone, and the stone is honed, so it
 * takes the window's light as a soft sheen and never as a mirror. What makes
 * it limestone and not a veneer is procedural and fades under its own pixel:
 * soft clouds a hand across, a sand-fine grain, and the shell it was laid
 * down from, small fragments dark and pale and the odd larger section. */
function limestoneMaterial(set: MaterialSet, L: Looks, fine: boolean): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .46, metalness: 0 })
  const P = positionWorld, n = normalWorldGeometry
  const east = P.x, north = P.z.negate()
  const i = floorOf(east.sub(LINE_ORIGIN.east).div(LINE_SLAB.pitchEast).add(.5))
  const j = floorOf(north.sub(LINE_ORIGIN.north).div(LINE_SLAB.pitchNorth).add(.5))
  const h1 = hash(i, j, 3.1), h2 = hash(i, j, 7.7), h3 = hash(i, j, 13.3)
  const turn = select(h3.greaterThan(.5), float(1), float(-1))
  // the bedding runs north: the photograph's u along the walk, v across it
  const level = abs(n.y).greaterThan(.5)
  const across = select(abs(n.x).greaterThan(abs(n.z)), north, east)
  const uv = select(level, vec2(north, east.negate()), vec2(across, P.y)).mul(turn).add(vec2(h1, h2).mul(17.3))
  const sample = set.sample({ uv, metres: STONE_TILE })
  const tone = float(1).add(h1.sub(.5).mul(L.stoneTone)).add(h2.sub(.5).mul(L.stoneTone.mul(.5)))
  // the honed face keeps part of the bedding: the photograph's own ratio to
  // its mean is laid back toward that mean
  const calmed = float(1).sub(L.stoneBand).div(sample.albedo.max(.05)).add(L.stoneBand)
  // a slab's edge stands in its fifteen millimetre joint, where the engine
  // casts no shadow: the joint is read dark as the grout it opens onto
  const inJoint = select(level, float(0), float(.78)).mul(L.engineTerms)
  // WHERE THE DATES ARE READ THE STONE IS WALKED: a band along the line a
  // little finer in its polish, with the dust of the walk at its edges
  const fromLine = abs(east.sub(DATE_MIDDLE_EAST - .25)), band = smoothstep(1.35, .55, fromLine)
  const edge = smoothstep(.45, 1.1, fromLine).mul(smoothstep(1.7, 1.15, fromLine))
  const walked = float(1).sub(edge.mul(L.stoneWalk.mul(.35))).add(band.mul(L.stoneWalk.mul(.12)))
  let body: N = float(1), shell: N = float(0)
  if (fine) {
    // each slab its own stretch of the bed: the fields are read from the
    // slab's own offset so neighbours never share a cloud or a shell
    const at = vec2(east.sub(LINE_ORIGIN.east), north.sub(LINE_ORIGIN.north)).add(vec2(h2, h3).mul(23.1))
    const fp = anisotropicFootprint(P)
    const clouds = fractalField(vec3(at.x.div(.34), at.y.div(.52), h1.mul(5)), .34, fp, 3)
    const mottle = fractalField(vec3(at.x.div(.07), at.y.div(.09), 6.1), .07, fp, 2)
    const grain = fractalField(vec3(at.x.div(.004), at.y.div(.004), 2.7), .004, fp, 2)
    body = float(1).add(clouds.mul(L.stoneCloud)).add(mottle.mul(L.stoneCloud.mul(.5))).add(grain.mul(L.stoneGrain))
    // the shell: specks of a millimetre or two, fragments up to a centimetre
    // dark and pale, pieces up to two, and the odd section of a larger shell
    const layer = (cellM: number, offset: number, salt: number, share: number, long: [number, number], slender: [number, number]): N => {
      const u = at.div(cellM).add(offset)
      return fleck(fract(u).sub(.5), floorOf(u), salt, share, long, slender, cellM, fp)
    }
    const speck = layer(.012, 0, 1.1, .45, [.14, .34], [.5, .9])
    const dark = layer(.03, .5, 3.3, .34, [.1, .34], [.35, .7])
    const pale = layer(.03, 0, 5.3, .2, [.1, .3], [.4, .8])
    const piece = layer(.1, .75, 7.1, .22, [.08, .22], [.3, .65])
    const section = layer(.3, .25, 9.7, .07, [.1, .25], [.08, .16])
    shell = speck.mul(.8).add(dark).add(piece.mul(.9)).add(section.mul(.6)).mul(L.stoneFleck).sub(pale.mul(L.stoneFleck.mul(.5)))
  }
  const fossil = float(1).sub(shell)
  m.colorNode = sample.colour.mul(calmed).mul(L.stoneTint).mul(tone).mul(walked).mul(body).mul(fossil)
    .mul(mix(vec3(1, 1, 1), L.fleckTint, shell.clamp(0, 1).mul(2).min(1))).mul(float(1).sub(inJoint))
  // honed: the photograph's own veins a touch rougher than the ground, and a
  // shell fragment a touch glossier than the lime it sits in
  const vein = float(1).sub(sample.albedo.g).clamp(-.3, .3)
  m.roughnessNode = L.stoneRough.add(h2.sub(.5).mul(.06)).add(vein.mul(.12)).sub(band.mul(L.stoneWalk)).sub(shell.abs().mul(.25)).clamp(.2, .9)
  const t = vec3(0, 0, -1).mul(turn), b = vec3(-1, 0, 0).mul(turn)
  m.normalNode = select(level, bend(t, b, n, sample.normal, L.stoneNormal), n.transformDirection(cameraViewMatrix))
  m.name = 'vinci/collection-line-gallery/limestone'
  m.userData = { ...LINE_GALLERY_PROVENANCE, set: set.name, owned: false }
  return m
}

/** THE GLASS OF THE GLAZED WALL, from the room: the room's own bounce seen
 * in it, strongest where the eye meets the glass obliquely, and a film of
 * weather thickest at each pane's foot. Drawn over the envelope's panes: it
 * adds what it reflects and holds back what its film and reflection take. */
function glassMaterial(L: Looks): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: .05, metalness: 0, transparent: true, depthWrite: false, side: FrontSide })
  m.blending = CustomBlending
  m.blendSrc = OneFactor
  m.blendDst = OneMinusSrcAlphaFactor
  const P = positionWorld
  const up = P.y.sub(GLAZING.bottom).div(GLAZING.top - GLAZING.bottom).clamp(0, 1)
  const drift = mx_noise_float(vec3(P.z.mul(.7), P.y.mul(1.9), 3.3)).mul(.5).add(.5)
  const streak = mx_noise_float(vec3(P.z.mul(9), P.y.mul(.35), 8.1)).mul(.5).add(.5)
  const film = float(1).sub(up).pow(2.2).mul(drift.mul(.7).add(streak.mul(.3))).add(drift.mul(.25)).mul(L.glassFilm)
  const facing = normalView.dot(positionViewDirection).abs().clamp(0, 1)
  const fresnel = float(1).sub(facing).pow(5).mul(.96).add(.04)
  m.colorNode = L.glassFilmColour.mul(film)
  m.roughnessNode = float(.05).add(film.mul(2))
  m.opacityNode = film.add(fresnel).clamp(0, .9)
  m.name = 'vinci/collection-line-gallery/glass'
  m.userData = { ...LINE_GALLERY_PROVENANCE }
  return m
}

/** The line's other surfaces: the grout its slabs are bedded in, the bronze
 * of its fittings, the patinated bronze its years are cast in, the ink its
 * words are painted in. */
function lineSurfaces(L: Looks): {
  grout: MeshStandardNodeMaterial; bronze: MeshStandardNodeMaterial; year: MeshStandardNodeMaterial; ink: MeshStandardNodeMaterial
} {
  const P = positionWorld
  const grout = new MeshStandardNodeMaterial({ roughness: .9, metalness: 0 })
  grout.colorNode = L.groutColour.mul(mx_noise_float(P.mul(3.1)).mul(.08).add(1))
  grout.name = 'vinci/collection-line-gallery/grout'
  const bronze = new MeshStandardNodeMaterial({ roughness: .34, metalness: 1 })
  // walked bronze: a finer and brighter polish where the feet cross it
  const worn = mx_noise_float(P.mul(vec3(4.3, 1, 4.3))).mul(.5).add(.5)
  bronze.colorNode = L.bronzeColour.mul(worn.mul(.18).add(.91))
  bronze.roughnessNode = L.bronzeRough.add(worn.mul(.1).sub(.05))
  bronze.name = 'vinci/collection-line-gallery/bronze'
  // A YEAR IS READ, A FITTING IS SEEN: a polished numeral at the visitor's
  // feet mirrors its own head as a pale blot, so the years alone are patinated
  const year = new MeshStandardNodeMaterial({ roughness: .62, metalness: .45 })
  year.colorNode = L.yearColour.mul(L.yearPatina)
  year.roughnessNode = L.yearRough.add(mx_noise_float(P.mul(9.1)).mul(.05))
  year.metalnessNode = L.yearMetal
  year.name = 'vinci/collection-line-gallery/year'
  const ink = new MeshStandardNodeMaterial({ roughness: .86, metalness: 0 })
  ink.colorNode = L.inkColour
  ink.name = 'vinci/collection-line-gallery/ink'
  for (const m of [grout, bronze, year, ink]) m.userData = { ...LINE_GALLERY_PROVENANCE }
  return { grout, bronze, year, ink }
}

export interface LineGallery {
  /** the finish, the benches and the fittings, to ride with the rooms */
  group: Group
  /** what the line is cut from: its limestone, bronze, years, ink and grout */
  stones: LineMaterials
  /** light the line's own surfaces, the certainty discs among them */
  adoptLine(line: Object3D): void
  /** every set on the GPU */
  ready: Promise<void>
  /** How many takes of the room's bounce are still owed. A take is drawn in
   * a frame of its own, with the bodies it must see shown for its length. */
  tick(bodies: readonly Object3D[]): void
  /** hide the building's patch once the reading room lays its own floor */
  update(): void
  dispose(): void
}

/** The calm tier takes no probe: the hero tier's measured bounce as a fill,
 * warmer from the floor and cooler from the window side. */
const CALM_FILL = { up: [.36, .34, .31], down: [.21, .2, .2], window: [.3, .32, .35] } as const

export function mountLineGallery(stack: Stack): LineGallery {
  const tier = stack.tierName(), calm = tier === 'calm'
  const L = looks()
  const group = new Group()
  group.name = 'vinci/collection-line-gallery'
  group.userData = { ...LINE_GALLERY_PROVENANCE }
  const owned: Mesh[] = [], materials: Material[] = []

  // THE LIGHTS, from the one table that builds the fittings too
  RectAreaLightNode.setLTC(RectAreaLightTexturesLib.init())
  const solo = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('gallerysolo')
  const built: { light: Light; spec: GalleryLight }[] = [], targets: Object3D[] = []
  for (const spec of GALLERY_LIGHTS) {
    // the calm tier draws no map: a light that needs its shadows stays off
    if (calm && spec.shadow) continue
    const level = solo && !spec.name.startsWith(solo) ? 0 : spec.intensity
    let light: Light
    if (spec.kind === 'sky') {
      const sky = new DirectionalLight(kelvinToColour(spec.kelvin), level)
      sky.position.copy(v3(...spec.at))
      const target = new Object3D()
      target.position.copy(v3(...spec.aim))
      sky.target = target
      targets.push(target)
      group.add(target)
      light = sky
    } else if (spec.kind === 'area') {
      const area = new RectAreaLight(kelvinToColour(spec.kelvin), level, spec.width!, spec.height!)
      area.position.copy(v3(...spec.at))
      area.lookAt(v3(...spec.aim))
      light = area
    } else {
      const spot = new SpotLight(kelvinToColour(spec.kelvin), level, spec.reach, spec.angle, spec.penumbra, 2)
      spot.position.copy(v3(...spec.at))
      const target = new Object3D()
      target.position.copy(v3(...spec.aim))
      spot.target = target
      spot.castShadow = false
      targets.push(target)
      group.add(target)
      light = spot
    }
    if (spec.shadow) {
      const shadowed = light as SpotLight | DirectionalLight, map = spec.shadow
      const px = tier === 'hero' ? map.mapPx : Math.max(512, map.mapPx / 2)
      shadowed.castShadow = true
      shadowed.shadow.mapSize.set(px, px)
      const camera = shadowed.shadow.camera
      if ('left' in camera && map.span) {
        const [across, up] = map.span
        Object.assign(camera, { left: -across, right: across, top: up, bottom: -up, near: 1, far: 80 })
      } else Object.assign(camera, { near: .2, far: spec.reach ?? 10 })
      camera.updateProjectionMatrix()
      shadowed.shadow.bias = -.0003
      shadowed.shadow.normalBias = .02
      shadowed.shadow.radius = map.soft
      // the map is drawn from the gallery's own casters alone: the envelope's
      // glass and every other body of the wing stay out of it
      camera.layers.set(GALLERY_SHADOW_LAYER)
    }
    light.name = `vinci/collection-line-gallery/${spec.name}`
    light.userData = { ...LINE_GALLERY_PROVENANCE }
    // hidden from the scene's own list, which every other surface reads;
    // still in the graph, so its matrices follow
    light.visible = false
    group.add(light)
    built.push({ light, spec })
  }
  const roomLights = built.filter(({ spec }) => spec.receivers === 'room').map(({ light }) => light)
  const floorLights = built.filter(({ spec }) => spec.receivers !== 'line').map(({ light }) => light)
  const lineLights = built.map(({ light }) => light)

  // THE ROOM'S BOUNCE: a probe at the gallery's middle, taken turned by the
  // scene's own environment turn and re-taken into the same target, so no
  // surface that reads it is ever rebuilt
  let generator: PMREMGenerator | undefined, probe: { camera: CubeCamera; target: CubeRenderTarget; pmrem: RenderTarget } | undefined
  let env: N
  if (!calm) {
    generator = new PMREMGenerator(stack.renderer)
    const target = new CubeRenderTarget(tier === 'hero' ? 256 : 128, { type: HalfFloatType })
    const camera = new CubeCamera(.05, 2400, target)
    camera.position.copy(v3(...PROBE_AT))
    probe = { camera, target, pmrem: generator.fromCubemap(target.texture) }
    env = pmremTexture(probe.pmrem.texture).mul(L.envGain).mul(L.envLift)
  } else {
    const n = normalWorldGeometry
    const up = vec3(...CALM_FILL.up), down = vec3(...CALM_FILL.down), side = vec3(...CALM_FILL.window)
    env = mix(down, up, n.y.mul(.5).add(.5)).add(side.mul(n.x.max(0))).mul(L.envGain).mul(L.envLift)
  }
  const adopt = (material: Material, rig: readonly Light[]): void => {
    const lit = material as Material & { lightsNode?: unknown; envNode?: unknown; lights?: boolean; isNodeMaterial?: boolean }
    if (!lit.isNodeMaterial || lit.lights !== true) return
    lit.lightsNode = lightsOf([...rig])
    lit.envNode = env
    material.needsUpdate = true
  }

  // THE SURFACES
  const [wallSet, floorSet, oakSet, stoneSet] = SETS.map(name => stack.materials.sync(name))
  const concrete = concreteMaterial(wallSet!, L)
  const floor = floorMaterial(floorSet!, L)
  const dark = darkMaterial(floorSet!, L)
  const oak = oakMaterial(oakSet!, L)
  const limestone = limestoneMaterial(stoneSet!, L, !calm)
  const { grout, bronze, year, ink } = lineSurfaces(L)
  adopt(concrete, roomLights)
  for (const m of [floor, dark, oak]) adopt(m, floorLights)
  for (const m of [limestone, grout, bronze, year, ink]) adopt(m, lineLights)
  materials.push(concrete, floor, dark, oak, limestone, grout, bronze, year, ink)

  const make = (geometry: BufferGeometry, material: Material, name: string, occludes = false): Mesh => {
    geometry.computeBoundingBox(); geometry.computeBoundingSphere()
    const mesh = new Mesh(geometry, material)
    mesh.name = `vinci/collection-line-gallery/${name}`
    mesh.castShadow = false; mesh.receiveShadow = true
    mesh.userData = { ...LINE_GALLERY_PROVENANCE, asset: LINE_GALLERY_PROVENANCE.manifestId, labelOccluder: occludes }
    // a skin lies over the certified construction: a ray meets that first
    if (!occludes) mesh.raycast = () => {}
    owned.push(mesh)
    group.add(mesh)
    return mesh
  }
  const merged = (parts: BufferGeometry[]): BufferGeometry => {
    const g = mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p))
    for (const p of parts) p.dispose()
    return g
  }
  const skinParts = (skin: Skin): BufferGeometry => skin.geometry()
  const solidParts = (solid: Solid): BufferGeometry => merged(solid.parts)

  const { walls, backing } = wallSkins()
  make(merged([skinParts(walls), skinParts(ceilingSkin())]), concrete, 'concrete')
  const { floor: floorSkin, patch, edge } = floorSkins()
  make(skinParts(floorSkin), floor, 'floor')
  const patchMesh = make(skinParts(patch), floor, 'floor-patch')
  make(solidParts(edge), bronze, 'field-edge')
  const bench = benches()
  make(merged([skinParts(backing), ...bench.base.parts]), dark, 'dark-stone')
  make(solidParts(bench.oak), oak, 'benches', true)
  if (!calm) {
    const { metal, lenses } = fittings()
    const anodised = new MeshStandardNodeMaterial({ color: '#17181a', roughness: .38, metalness: .8 })
    anodised.name = 'vinci/collection-line-gallery/fixtures'
    const glow = new MeshBasicNodeMaterial({ color: new Color(kelvinToColour(3000)).multiplyScalar(9) })
    glow.name = 'vinci/collection-line-gallery/lamp-faces'
    adopt(anodised, roomLights)
    materials.push(anodised, glow)
    make(solidParts(metal), anodised, 'fixtures')
    make(solidParts(lenses), glow, 'lamp-faces')
  }

  if (!calm) {
    // THE CASTERS, seen only by the gallery's shadowed lights
    const hidden = new MeshBasicNodeMaterial({ colorWrite: false, depthWrite: false, side: DoubleSide })
    hidden.shadowSide = DoubleSide
    hidden.name = 'vinci/collection-line-gallery/shadow-double'
    materials.push(hidden)
    const casters = make(solidParts(shadowCasters()), hidden, 'shadow-double')
    casters.layers.set(GALLERY_SHADOW_LAYER)
    casters.castShadow = true; casters.receiveShadow = false
    // THE PANES, as glass seen from the room
    const panes = new Skin()
    for (const r of glazingPanes()) panes.northSouth(GLAZING.east, -1, r.south, r.north, GLAZING.bottom, GLAZING.top)
    const glass = glassMaterial(L)
    adopt(glass, roomLights)
    materials.push(glass)
    const pane = make(skinParts(panes), glass, 'glass')
    pane.receiveShadow = false
    pane.renderOrder = 1
  }

  // `?galleryrig` hands an instrument the rig's levels and the looks, to lean
  // on a standing frame instead of rebuilding the page for each value
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('galleryrig')) {
    const full = new Map(built.map(({ light, spec }) => [light, spec.intensity]))
    ;(window as unknown as Record<string, unknown>)['__galleryRig'] = {
      names: built.map(({ spec }) => spec.name),
      solo(name: string | null) {
        for (const { light, spec } of built) light.intensity = name === null || spec.name.startsWith(name) ? full.get(light)! : 0
      },
      level(name: string, value: number) {
        for (const { light, spec } of built) if (spec.name.startsWith(name)) { light.intensity = value; full.set(light, value) }
      },
      kelvin(name: string, value: number) {
        for (const { light, spec } of built) if (spec.name.startsWith(name)) light.color.copy(kelvinToColour(value))
      },
      looks: L,
      lights: Object.fromEntries(built.map(({ light, spec }) => [spec.name, light])),
      bake: () => { owed = 3 },
    }
  }

  let owed = 0, live = true
  // three takes, so the bounce carries two bounces of its own: a pale room
  // lit from one side is lit on its far side by what its floor sends back
  const ready = Promise.all(SETS.map(name => stack.materials.load(name))).then(() => { if (live) owed = 3 }, () => { if (live) owed = 3 })

  function take(bodies: readonly Object3D[]): void {
    if (!probe || !generator) return
    let scene: Object3D = group
    while (scene.parent) scene = scene.parent
    const root = scene as Scene
    if (!root.isScene) return
    probe.camera.rotation.copy(root.environmentRotation)
    probe.camera.updateMatrixWorld(true)
    L.envGain.value = 1 / Math.max(.01, root.environmentIntensity)
    const shown = bodies.map(body => body.visible)
    for (const body of bodies) body.visible = true
    try { probe.camera.update(stack.renderer, root) } finally { bodies.forEach((body, i) => { body.visible = shown[i]! }) }
    generator.fromCubemap(probe.target.texture, probe.pmrem)
  }

  let patchChecked = 0
  return {
    group,
    stones: { stone: limestone, bronze, ink, dark: grout, year },
    adoptLine(line) {
      line.traverse(child => {
        if (!(child instanceof Mesh)) return
        for (const surface of Array.isArray(child.material) ? child.material : [child.material]) {
          // the certainty discs are the line's own; their colours are facts
          if (surface.userData['owned'] === true) adopt(surface, lineLights)
        }
      })
    },
    ready: ready.then(() => undefined),
    tick(bodies) {
      if (owed <= 0) return
      owed--
      take([group, ...bodies])
    },
    update() {
      // once a second is enough to learn that the reading room stands: it
      // rides with the rooms, as this gallery does
      if (!patchMesh.visible || ++patchChecked % 60) return
      if (!group.parent?.getObjectByName('vinci/collection-reading-room')) return
      patchMesh.visible = false
      // the room it stands in is read again with that room in it
      owed = Math.max(owed, 2)
    },
    dispose() {
      live = false
      for (const mesh of owned) { mesh.removeFromParent(); mesh.geometry.dispose() }
      for (const m of materials) m.dispose()
      for (const { light } of built) { light.removeFromParent(); light.dispose() }
      for (const target of targets) target.removeFromParent()
      if (probe) { probe.pmrem.dispose(); probe.target.dispose() }
      generator?.dispose()
      group.removeFromParent()
    },
  }
}

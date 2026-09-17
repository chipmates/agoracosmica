/** The rooms' own surfaces, and the light that reaches them.
 *
 * A room inside this insertion sees no sun: the afternoon key stands at 232
 * degrees and every opening of the collection faces north or east, which is
 * why the picture room can hang pictures at all. So the daylight in here is
 * modelled the only honest way a single-key stack allows, as the share of
 * the sky each surface can still see through its OWN opening, applied to the
 * indirect term alone. The measured sun and its shadows are untouched.
 */
import { BackSide, Color, DoubleSide, MeshStandardNodeMaterial } from 'three/webgpu'
import * as TSL from 'three/tsl'
import type { Stack } from '../../../stack'
import type { GrainRecipe, MaterialClass, MaterialSet } from '../../../stack/materials'
import { applyDetail } from '../../../stack/detail'
import { anisotropicFootprint } from '../masonry-courses'
import { COLLECTION_PAVING_ORIGIN, FACE, LINE_SLAB } from './layout'

/** floor stone, wall plaster, dark stone, steel, ceiling, outdoor paving */
export type CollectionRole = 0 | 1 | 2 | 3 | 4 | 5

export const collectionRoomsProvenance = {
  manifestId: 'vinci/collection-rooms',
  assetClass: 'GENERATED',
  certainty: 'reconstructed',
  recipe:
    'Original welded room construction inside the existing pavilion envelope: floor finish on a 1.60 by 1.65 m stone grid with 8 mm joints, lined walls with a dark stone base, coffered soffits with a light cove, dressed door reveals, an outdoor court terrace with its parapet and a freestanding display wall. Three filtered procedural scales per surface, no texture asset and no reference image sampled. Interior indirect light is a per-opening sky-visibility term on the ambient channel only; no second light source, no emissive surface, no baked shadow.',
  date: '2026-09-11',
} as const

const PALETTE = {
  floor: '#9d9a8e', plaster: '#b7b2a4', dark: '#3c423d', steel: '#333b3c',
  ceiling: '#b0ab9e', paving: '#a6a393',
}

/** The sky each interior surface can still see, opening by opening. */
function interiorDaylight(P: TSLNode, n: TSLNode): TSLNode {
  const { exp, float, smoothstep } = TSL
  const facing = (value: TSLNode, floorShare: number) => value.max(0).mul(1 - floorShare).add(floorShare)
  // The north window wall, 40 m of it, is the picture room's whole light.
  const northDepth = P.z.sub(34.07).max(0)
  const northGate = smoothstep(42.7, 41.8, P.z)
  const north = exp(northDepth.div(-9)).mul(facing(n.z.negate(), .3)).mul(northGate)
  // The east elevation lights the long gallery from its end.
  const eastDepth = float(-22.07).sub(P.x).max(0)
  const eastGate = smoothstep(-39.2, -38.5, P.x).mul(smoothstep(41.8, 42.7, P.z))
  const east = exp(eastDepth.div(-7.5)).mul(facing(n.x, .3)).mul(eastGate).mul(.9)
  // The hall's clerestory stands above the low roofs and looks north.
  const hallDepth = P.z.sub(42.5).max(0)
  const hallGate = smoothstep(-38.5, -39.2, P.x).mul(smoothstep(41.8, 42.6, P.z))
  const hallFace = facing(n.z.negate().mul(.7).add(n.y.mul(.45)), .22)
  const hall = exp(hallDepth.div(-13)).mul(hallFace).mul(hallGate).mul(1.05)
  // Every room's floor is pale and takes the whole of its opening, so the
  // lower half of every wall stands in the floor's own bounce.
  const bounce = n.y.mul(.5).add(.5).oneMinus().mul(.085)
  return north.add(east).add(hall).add(bounce)
}

// The node overload boundary stays local to this file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TSLNode = any

/** What the rooms' own luminaires put on the surfaces they are aimed at. */
function fittingWash(P: TSLNode, n: TSLNode): TSLNode {
  const { float, smoothstep } = TSL
  const facing = (value: TSLNode) => value.max(0)
  const near = (value: TSLNode, full: number, gone: number) => smoothstep(gone, full, value.abs())
  // The picture room's cove, throwing the hanging wall from 0.3 m below the
  // soffit down over three metres, and the soffit above it.
  const pictureGate = smoothstep(42.8, 41.9, P.z).mul(smoothstep(33.6, 34.4, P.z))
  const coveWall = smoothstep(-5.55, -2.35, P.y).mul(near(P.z.sub(41.79), .18, .85)).mul(facing(n.z.negate())).mul(pictureGate)
  const coveSoffit = smoothstep(-2.55, -1.95, P.y).mul(smoothstep(4.2, 1.1, P.z.sub(41.79).abs())).mul(facing(n.y.negate())).mul(pictureGate)
  const coveFloor = smoothstep(-6.6, -6.2, P.y).mul(smoothstep(4.6, 1.4, P.z.sub(41.79).abs())).mul(facing(n.y)).mul(pictureGate)
  // The hall's beams carry uplights; the gallery's coffers carry a line.
  const hallGate = smoothstep(-38.5, -39.2, P.x).mul(smoothstep(41.9, 42.7, P.z))
  const hallUp = smoothstep(-2.4, .4, P.y).mul(facing(n.y.negate()).mul(.7).add(facing(n.y).mul(.15))).mul(hallGate)
  const hallFloor = smoothstep(-6.6, -6.2, P.y).mul(facing(n.y)).mul(hallGate).mul(.5)
  const galleryGate = smoothstep(-39.2, -38.5, P.x).mul(smoothstep(41.9, 42.7, P.z)).mul(smoothstep(64, 63, P.z))
  const gallery = smoothstep(-4.2, -1.95, P.y).mul(facing(n.y.negate()).mul(.55).add(float(.25))).mul(galleryGate)
  // The gallery's west wall is the one room surface no opening reaches: the
  // sheets hang on it, so the coffer line is turned on to it.
  const bodyWall = smoothstep(-6.1, -3.4, P.y).mul(smoothstep(-4.6, -3.4, P.y.negate().negate()).oneMinus().add(.55).clamp(0, 1))
    .mul(near(P.x.add(38.75), .3, 1.4)).mul(facing(n.x)).mul(galleryGate)
  const galleryFloor = smoothstep(-6.6, -6.2, P.y).mul(facing(n.y)).mul(galleryGate).mul(.55)
  // The reading alcove has a lamp on its table and a downlight over it; the
  // pool they make on the floor and the panelling is the room's, not the
  // table's, so the room carries it.
  const alcove = near(P.x.add(36.6), 1.4, 4.2).mul(near(P.z.sub(45.4), 1.6, 4.6))
    .mul(smoothstep(-6.6, -5.2, P.y)).mul(smoothstep(-2.4, -3.6, P.y).add(.35).clamp(0, 1)).mul(galleryGate)
  return coveWall.mul(.46).add(coveSoffit.mul(.30)).add(coveFloor.mul(.20))
    .add(hallUp.mul(.34)).add(hallFloor.mul(.16))
    .add(gallery.mul(.30)).add(galleryFloor.mul(.18)).add(bodyWall.mul(.40)).add(alcove.mul(.26))
    .clamp(0, .62)
}

/** Reproductions share the surrounding room's sky visibility and fitting
 * wash. The north apron is open to the sky; it carries no bench aperture.
 * This is the room's declared light on a source, not a change to its pixels. */
export function collectionPlateTone(): TSLNode {
  const { float, normalWorldGeometry, positionWorld } = TSL as unknown as Record<string, TSLNode>
  const P = positionWorld, n = normalWorldGeometry
  const room = interiorDaylight(P, n).mul(1.55).add(.10).clamp(.10, 1)
    .add(fittingWash(P, n)).clamp(.10, 1)
  return P.z.lessThan(-FACE.glazingNorth).select(float(1), room)
}

/** One material for every welded room surface. The role attribute decides
 * which stone it is; the three scales and the daylight are shared. */
export function collectionInteriorMaterial(): MeshStandardNodeMaterial {
  const {
    attribute, cameraViewMatrix, float, floor, fract, length, mix, mx_noise_float,
    normalWorldGeometry, positionView, positionWorld, smoothstep, vec2, vec3,
  } = TSL as unknown as Record<string, TSLNode>
  const m = new MeshStandardNodeMaterial({ roughness: .84, side: DoubleSide, shadowSide: BackSide })
  const P = positionWorld, n = normalWorldGeometry
  const role = attribute('collectionRoomRole', 'float')
  const isFloor = role.lessThan(.5), isPlaster = role.greaterThan(.5).and(role.lessThan(1.5))
  const isDark = role.greaterThan(1.5).and(role.lessThan(2.5))
  const isSteel = role.greaterThan(2.5).and(role.lessThan(3.5))
  const isCeiling = role.greaterThan(3.5).and(role.lessThan(4.5))
  const isOutdoor = role.greaterThan(4.5)
  const pixel = anisotropicFootprint(P)
  const resolved = (metres: number) => smoothstep(2, 4, float(metres).div(pixel))
  // ONE PIXEL PER AXIS. A joint at a fixed east is a line in P.x and a joint
  // at a fixed north a line in P.z, and a floor running away from the eye has
  // a pixel that is centimetres across those lines and metres along them. The
  // isotropic footprint above is the across figure, so the along axis kept a
  // line far thinner than its own pixel and it broke into dashes from about
  // eight metres. Each coordinate is now filtered on its own derivative.
  const dPx = P.dFdx().toVar(), dPy = P.dFdy().toVar()
  const footprintOf = (across: TSLNode) => across.length().max(.00001)
  const pixelEast = footprintOf(vec2(dPx.x, dPy.x))
  const pixelUp = footprintOf(vec2(dPx.y, dPy.y))
  const pixelNorth = footprintOf(vec2(dPx.z, dPy.z))
  // A joint is a groove, and a groove has to survive the pixel it lands in:
  // every line below fades to its own area mean instead of shimmering.
  const line = (coordinate: TSLNode, spacing: number, offset: number, width: number, axis: TSLNode) => {
    const f = fract(coordinate.sub(offset).div(spacing)), edge = f.min(float(1).sub(f)).mul(spacing)
    return float(1).sub(smoothstep(float(width).sub(axis.mul(.5)).max(0), float(width).add(axis.mul(.5)), edge))
      .mul(smoothstep(2, 4, float(spacing).div(axis)))
  }
  // Existing rooms keep their established paving grid. The date field has
  // its own half-metre offset to fit twelve courses; moving that exhibit
  // must not move the joints or stone tones in every room.
  const slabEast = line(P.x, LINE_SLAB.pitchEast, COLLECTION_PAVING_ORIGIN.east, .008, pixelEast)
  const slabNorth = line(P.z, LINE_SLAB.pitchNorth, -COLLECTION_PAVING_ORIGIN.north, .008, pixelNorth)
  const slabJoint = slabEast.max(slabNorth).mul(n.y.abs())
  const slabIndex = floor(P.x.sub(COLLECTION_PAVING_ORIGIN.east).div(LINE_SLAB.pitchEast)).add(floor(P.z.add(COLLECTION_PAVING_ORIGIN.north).div(LINE_SLAB.pitchNorth)).mul(7.31))
  const slabTone = fract(slabIndex.mul(13.17).sin().mul(4371.13)).sub(.5).mul(resolved(1.6))
  // Walls: a 1.2 by 2.4 m board rhythm on the lining, its shadow joints 6 mm.
  const boardV = line(P.y, 1.2, 0, .006, pixelUp), plasterDrift = mx_noise_float(P.mul(.42))
  const trowel = mx_noise_float(P.mul(vec3(5.4, 3.1, 5.4)))
  // The ceiling is coffered on the structure's own four-metre bay.
  const bayNorth = line(P.z, 4, 0, .02, pixelNorth), bayEast = line(P.x, 4, 2, .02, pixelEast)
  const macro = mx_noise_float(P.mul(.31)).mul(resolved(3.2)).toVar()
  const middle = mx_noise_float(P.mul(7.6)).mul(resolved(.13)).toVar()
  const grain = mx_noise_float(P.mul(215)).mul(resolved(.0047)).toVar()
  const brushed = mx_noise_float(P.mul(vec3(160, 12, 160))).mul(resolved(.006))
  const colourOf = (key: keyof typeof PALETTE) => { const c = new Color(PALETTE[key]); return vec3(c.r, c.g, c.b) }
  const base = isFloor.select(colourOf('floor'),
    isPlaster.select(colourOf('plaster'),
      isDark.select(colourOf('dark'),
        isSteel.select(colourOf('steel'),
          isCeiling.select(colourOf('ceiling'), colourOf('paving'))))))
  const figure = isFloor.select(slabTone.mul(.155).add(macro.mul(.085)).add(middle.mul(.05)).add(grain.mul(.06)),
    isPlaster.select(plasterDrift.mul(.125).add(trowel.mul(.105).mul(resolved(.2))).add(middle.mul(.04)).add(grain.mul(.05)),
      isDark.select(macro.mul(.145).add(middle.mul(.09)).add(grain.mul(.06)),
        isSteel.select(brushed.mul(.06).add(middle.mul(.03)),
          isCeiling.select(plasterDrift.mul(.11).add(trowel.mul(.105).mul(resolved(.2))).add(middle.mul(.05)).add(grain.mul(.04)), macro.mul(.11).add(middle.mul(.06)).add(grain.mul(.06)))))))
  const cut = isFloor.select(slabJoint.mul(.34),
    isPlaster.select(boardV.mul(.16),
      isCeiling.select(bayNorth.max(bayEast).mul(.16), isOutdoor.select(slabJoint.mul(.24), float(0)))))
  m.colorNode = base.mul(figure.add(1)).mul(float(1).sub(cut))
  m.roughnessNode = isSteel.select(float(.42).add(brushed.mul(.09)),
    isFloor.select(float(.62).add(grain.mul(.06)).add(slabJoint.mul(.15)),
      float(.88).add(grain.mul(.04)))).clamp(.30, .97)
  m.metalnessNode = isSteel.select(float(.72), float(.02))
  const height = isFloor.select(slabJoint.mul(-.0022).add(grain.mul(.0004)),
    isPlaster.select(trowel.mul(.0006).add(boardV.mul(-.0012)).add(grain.mul(.0003)),
      isCeiling.select(bayNorth.max(bayEast).mul(-.004), macro.mul(.0009).add(grain.mul(.0004))))).toVar()
  const viewNormal = n.transformDirection(cameraViewMatrix), sx = positionView.dFdx(), sy = positionView.dFdy()
  const rx = sy.cross(viewNormal), ry = viewNormal.cross(sx), det = sx.dot(rx)
  const gradient = rx.mul(height.dFdx()).add(ry.mul(height.dFdy())).mul(det.sign()).div(det.abs().max(1e-10)).toVar()
  m.normalNode = viewNormal.sub(gradient.div(length(gradient).div(.2).max(1))).normalize()
  const daylight = interiorDaylight(P, n)
  m.aoNode = isOutdoor.select(float(1), daylight.mul(1.55).add(.10).clamp(.10, 1))
  // THE ROOMS ARE LIT BY THEIR OWN FITTINGS. No room here sees the sun, and
  // a gallery lit by nothing but the share of sky its window lets in reads
  // as a cellar at this exposure, which is not what a modern museum looks
  // like at four in the afternoon. The cove over the hanging wall, the
  // uplights on the hall's beams and the line of light in the gallery's
  // coffers are modelled as the irradiance they put on the surfaces they
  // face. They add no second shadow-casting light, and they never touch the
  // measured sun.
  const wash = fittingWash(P, n).mul(isOutdoor.select(float(0), float(1)))
  m.emissiveNode = base.mul(wash)
  m.name = 'vinci/collection-rooms/surfaces'
  m.userData = {
    manifestId: collectionRoomsProvenance.manifestId, assetClass: 'GENERATED',
    certainty: 'reconstructed', recipe: collectionRoomsProvenance.recipe,
    filtering: 'Pixel-filtered 3.2 m drift, 0.13 m structure and 4.7 mm grain, with 8 mm floor joints on a 1.60 by 1.65 m grid, 6 mm lining joints and 20 mm soffit bay lines; all relief from bounded world and view derivatives, no normal map.',
  }
  return m
}

/** The heads of the new partitions are glazed, so a room that has no outside
 * wall still borrows the daylight of the one next door. */
export function collectionBorrowedLightMaterial(): MeshStandardNodeMaterial {
  const { float, mx_noise_float, positionWorld, smoothstep } = TSL as unknown as Record<string, TSLNode>
  const m = new MeshStandardNodeMaterial({ color: '#a8b2ad', roughness: .16, metalness: .1, transparent: true, opacity: .22, depthWrite: false, side: DoubleSide })
  m.envMapIntensity = 2.2
  m.forceSinglePass = true
  const P = positionWorld, pixel = anisotropicFootprint(P)
  const wave = mx_noise_float(P.mul(3.2)).mul(smoothstep(2, 4, float(.3).div(pixel)))
  m.roughnessNode = float(.16).add(wave.mul(.012))
  m.name = 'vinci/collection-rooms/borrowed-light'
  m.userData = { manifestId: collectionRoomsProvenance.manifestId, assetClass: 'GENERATED', certainty: 'reconstructed' }
  return m
}


/** The five surfaces the line, the corrections and the grave are built from.
 * They are the host's to supply, and here they are the rooms' own stones, so
 * an exhibit and the floor it stands on are cut from one quarry. Procedural
 * throughout: the library's budget for this page is already spent. */
export function collectionExhibitMaterials(): {
  stone: MeshStandardNodeMaterial; plaster: MeshStandardNodeMaterial
  bronze: MeshStandardNodeMaterial; ink: MeshStandardNodeMaterial; dark: MeshStandardNodeMaterial
} {
  const { cameraViewMatrix, float, length, mx_noise_float, normalWorldGeometry, positionView, positionWorld, smoothstep, vec3 } = TSL as unknown as Record<string, TSLNode>
  const make = (colour: string, roughness: number, metalness: number, scales: [number, number, number], depth: number) => {
    const m = new MeshStandardNodeMaterial({ color: colour, roughness, metalness })
    const P = positionWorld, n = normalWorldGeometry, pixel = anisotropicFootprint(P)
    const resolved = (metres: number) => smoothstep(2, 4, float(metres).div(pixel))
    const macro = mx_noise_float(P.mul(1 / scales[0])).mul(resolved(scales[0])).toVar()
    const middle = mx_noise_float(P.mul(1 / scales[1])).mul(resolved(scales[1])).toVar()
    const grain = mx_noise_float(P.mul(1 / scales[2])).mul(resolved(scales[2])).toVar()
    const c = new Color(colour)
    m.colorNode = vec3(c.r, c.g, c.b).mul(macro.mul(.09).add(middle.mul(.06)).add(grain.mul(.05)).add(1))
    m.roughnessNode = float(roughness).add(grain.mul(.05)).add(middle.mul(.03)).clamp(.08, .98)
    const height = macro.mul(depth).add(middle.mul(depth * .4)).add(grain.mul(depth * .15)).toVar()
    const viewNormal = n.transformDirection(cameraViewMatrix), sx = positionView.dFdx(), sy = positionView.dFdy()
    const rx = sy.cross(viewNormal), ry = viewNormal.cross(sx), det = sx.dot(rx)
    const gradient = rx.mul(height.dFdx()).add(ry.mul(height.dFdy())).mul(det.sign()).div(det.abs().max(1e-10)).toVar()
    m.normalNode = viewNormal.sub(gradient.div(length(gradient).div(.18).max(1))).normalize()
    m.userData = { manifestId: collectionRoomsProvenance.manifestId, assetClass: 'GENERATED', certainty: 'reconstructed' }
    return m
  }
  const stone = make(PALETTE.floor, .66, .02, [3.1, .14, .005], .0016)
  const plaster = make(PALETTE.plaster, .9, .01, [2.4, .19, .004], .0011)
  const bronze = make('#6d6350', .43, .72, [1.2, .085, .003], .0008)
  const ink = make('#2b2f2c', .93, .02, [.9, .06, .002], .0004)
  const dark = make(PALETTE.dark, .82, .04, [1.7, .11, .004], .0012)
  for (const [name, material] of Object.entries({ stone, plaster, bronze, ink, dark })) material.name = `vinci/collection-rooms/${name}`
  return { stone, plaster, bronze, ink, dark }
}

/* THE COURT'S EXHIBIT IS DRESSED FROM THIS MODULE'S OWN RECIPE.
 *
 * The page already holds the whole of its standard texture budget when this
 * ground is built, and the machine standing outside in the court asks the
 * shared library for four more photographed sets, which carries the page
 * past it. So that one exhibit is built against a stack whose library
 * answers out of a recipe instead of out of bytes: the same three filtered
 * scales and grain field the line, the corrections, the grave and every
 * surface in these rooms stand on. Its geometry, its welding and the
 * bench's own tints are untouched, and this module asks the library for
 * nothing at any tier.
 */
interface CourtRecipe {
  albedo: string; variation: string; roughness: number; metalness: number
  cls: MaterialClass; scales: [number, number, number]; normalStrength: number
  falloff: number; macroContrast: number; micro: number; grain: GrainRecipe | null
}

const COURT_STONE: CourtRecipe = {
  albedo: PALETTE.floor, variation: '#6f6c63', roughness: .72, metalness: 0, cls: 'stone',
  scales: [2.4, .42, .035], normalStrength: .45, falloff: 1, macroContrast: .3, micro: .5, grain: null,
}

const COURT_RECIPES: Record<string, CourtRecipe> = {
  // Sealed flax over the ribs. The bench tints the cloth itself, so what
  // this recipe carries is the drape, the tooth and how dull the flax is.
  // THE CLOTH IS DULL BECAUSE THE FRAME SAYS SO. This canopy is the one
  // surface on this ground that stands against the open sky, and the whole
  // walk sees it. A cloth roughness low enough to hold a lobe put a clipped
  // white ridge down it, which no resolve can anti-alias: an edge between a
  // saturated pixel and a dark one has no gradient left to sample.
  linen: {
    albedo: '#c4b89c', variation: '#9e9076', roughness: .93, metalness: 0, cls: 'cloth',
    scales: [1.5, 0, .008], normalStrength: .6, falloff: .7, macroContrast: .45, micro: .5,
    grain: { kind: 'ridges', pitch: .2, angle: 0, relief: .6, shade: .55, sheen: .06, fold: .46, tooth: .012 },
  },
  // The four ribs and the uprights under them.
  'oak-beams': {
    albedo: '#8a7a5e', variation: '#5e5138', roughness: .74, metalness: 0, cls: 'wood',
    scales: [1, 0, .02], normalStrength: .8, falloff: 1, macroContrast: .5, micro: .5,
    grain: { kind: 'wave', pitch: .26, angle: 0, relief: .34, shade: .4, sheen: .08, fold: .6, tooth: .016 },
  },
  // The suspension cords, whose twist is in the geometry and not in a map.
  rope: {
    albedo: '#b2a07c', variation: '#87764f', roughness: .86, metalness: 0, cls: 'fibre',
    scales: [.4, .09, .007], normalStrength: .9, falloff: .7, macroContrast: .4, micro: .6, grain: null,
  },
  // The harness.
  'leather-worn': {
    albedo: '#6b5844', variation: '#463829', roughness: .72, metalness: 0, cls: 'cloth',
    scales: [1, 0, .01], normalStrength: .5, falloff: .8, macroContrast: .95, micro: 1,
    grain: { kind: 'creases', pitch: .22, angle: 0, relief: .34, shade: .45, sheen: .34, fold: .52, tooth: .014 },
  },
}

/** A set the library never has to fetch: the recipe above, and maps that
 * read as the identity, so the helper's own scales are the whole surface. */
function courtSet(name: string): MaterialSet {
  const { float, positionWorld, uniform, vec3 } = TSL as unknown as Record<string, TSLNode>
  const r = COURT_RECIPES[name] ?? COURT_STONE
  const albedo = new Color(r.albedo), variation = new Color(r.variation)
  const flat = {
    albedo: vec3(1, 1, 1), colour: vec3(albedo.r, albedo.g, albedo.b),
    normal: vec3(0, 0, 1), roughness: float(r.roughness), occlusion: float(1),
  }
  const set: MaterialSet = {
    name, albedo, variation, roughness: r.roughness, metalness: r.metalness,
    scales: r.scales, normalStrength: r.normalStrength, falloff: r.falloff,
    metres: [1, 1], scale: [1, 1], cls: r.cls, grain: r.grain, detile: 0, maps: null,
    detail: { macro: r.scales[0], macroContrast: r.macroContrast, mid: r.scales[1], micro: r.micro },
    entry: {
      id: collectionRoomsProvenance.manifestId, path: 'procedural/collection-rooms/',
      class: 'GENERATED', wing: 'vinci', display: true, date: collectionRoomsProvenance.date,
      licence: 'Original procedural construction; source code under the museum repository licence.',
      model: 'Deterministic TypeScript and TSL procedural geometry',
      prompt: `Procedural surface standing in for the library set "${name}" on the court's own exhibit: three filtered scales and a grain field, at the metre sizes declared here. No texture asset, no reference image sampled.`,
    },
    // Nothing is in flight, so the set is displayable from the first frame.
    ready: uniform(1),
    place: (at = {}) => at.uv ?? (at.world ?? positionWorld).xz,
    sample: () => flat,
    material: () => {
      const m = new MeshStandardNodeMaterial({ color: albedo, roughness: r.roughness, metalness: r.metalness })
      applyDetail(m, set)
      m.name = `vinci/collection-rooms/court-${name}`
      return m
    },
  }
  return set
}

/** The stack the court's exhibit is built against. */
export function collectionProceduralStack(stack: Stack): Stack {
  const made = new Map<string, MaterialSet>()
  const of = (name: string): MaterialSet => {
    let set = made.get(name)
    if (!set) { set = courtSet(name); made.set(name, set) }
    return set
  }
  return {
    ...stack,
    materials: {
      ...stack.materials,
      load: (name: string) => Promise.resolve(of(name)),
      sync: of,
      // Nothing is ever in flight here, and the tier the rest of the page is
      // drawn at is never touched on this exhibit's behalf.
      pending: () => 0,
      setTier: () => undefined,
      dispose: () => undefined,
    },
  }
}

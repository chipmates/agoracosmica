import {
  Color, DoubleSide, FrontSide, Group, InstancedMesh, Matrix4, Mesh, MeshPhysicalNodeMaterial, MeshStandardNodeMaterial,
  type BufferGeometry,
} from 'three/webgpu'
import { attribute, cameraPosition, float, mix, normalGeometry, normalMap, normalWorld, positionGeometry, positionWorld, uv, vec2, vec3 } from 'three/tsl'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { MaterialSet, Stack } from '../../../stack'
import type { DetailNodes } from '../../../stack/detail'
import { createGlassSeatMaterial } from './glass-seat'
import { createFlywheelSpokeArms } from './flywheel-overlap'
import { createMutableSweep, geometryForPart, type MutableSweep } from './geometry'
import { benchKeyDirection } from './key'
import { wearFor, wornSurface } from './wear'
import type { Assembly, Dossier, PartSpec } from './types'
export type { Assembly } from './types'
/** An assembly with every library set its surfaces were built from. */
export interface DressedAssembly extends Assembly {
  readonly sets: ReadonlySet<MaterialSet>
}

type Surface = MeshStandardNodeMaterial | MeshPhysicalNodeMaterial
/** A turned ball has no pole, so its material cannot have one either. The
 * library is read through three local projections blended by the surface
 * normal: nothing converges, and the grain turns with the part. The three
 * procedural scales and the density gradient stay in world space, so the
 * fade the helper measures is still the real distance to the eye. */
function turnedDetail(
  stack: Stack, material: Surface, set: MaterialSet,
  opts: {count: 1 | 2 | 3; maps: number; fade: [number, number]},
): DetailNodes {
  const p = positionGeometry
  const raw = normalGeometry.abs().pow(4)
  const weight = raw.div(raw.x.add(raw.y).add(raw.z).add(.0001))
  // The three reads go through the stack's own helper, so a surface built
  // without a renderer is dressed by exactly the same code path.
  const faces = [vec2(p.z, p.y), vec2(p.x, p.z), vec2(p.x, p.y)]
    .map(projection => stack.detail({} as unknown as Surface, set, {...opts, uv: projection}))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blend = (pick: (nodes: DetailNodes) => any): any => pick(faces[0]!).mul(weight.x)
    .add(pick(faces[1]!).mul(weight.y)).add(pick(faces[2]!).mul(weight.z))
  const nodes: DetailNodes = {
    albedo: blend(n => n.albedo), normal: blend(n => n.normal),
    roughness: blend(n => n.roughness), occlusion: blend(n => n.occlusion),
    density: faces[1]!.density,
  }
  const base = material.colorNode === undefined || material.colorNode === null
    ? vec3(set.albedo.r, set.albedo.g, set.albedo.b) : material.colorNode
  material.colorNode = base.mul(nodes.albedo).mul(nodes.occlusion)
  material.roughnessNode = nodes.roughness
  material.normalNode = normalMap(nodes.normal.mul(.5).add(.5), vec2(1, 1))
  return nodes
}
/** THE KEY'S OWN EDGE. A forged bar eight millimetres thick is a line at a
 * visitor's distance, and a line with no edge on it is a scratch in the dark.
 * The key's direction is the bench's own hour; where a surface turns away
 * from the eye and still faces that hour, it takes the light a real edge
 * takes. Nothing is added where the key cannot reach. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function keyRim(strength: number): any {
  const key = benchKeyDirection()
  if (!key) return float(0)
  const toEye = cameraPosition.sub(positionWorld).normalize()
  const grazing = float(1).sub(normalWorld.dot(toEye).abs()).clamp(0, 1).pow(2.6)
  const lit = normalWorld.dot(vec3(key.x, key.y, key.z)).mul(.5).add(.5).pow(1.5)
  return grazing.mul(lit).mul(strength)
}

/** Sets a machine asks for at the tier's whole budget. The planed oak is the
 * hall's own soffit set, so a narrowed copy must never be cached ahead of it. */
const FULL_BUDGET = new Set(['linen', 'iron-forged', 'oak-veneer-light'])
/** The oak sets whose rectangular timbers each read their own part of the photograph. */
const PHASED_OAK = new Set(['oak-beams', 'oak-veneer-light'])

const materialLoads = new WeakMap<Stack, Map<string, Promise<MaterialSet>>>()
const materialQueues = new WeakMap<Stack, Promise<void>>()
/** Page loads one machine request has already stood back for in full. */
const outlived = new WeakMap<Stack, Set<string>>()
/** Why a set a machine asked for stands without its maps. */
const failures = new WeakMap<MaterialSet, string>()

/** How long one request stands back for the page's own loads. A courtesy to
 * their decodes, never a condition: the library takes the budget at the
 * moment of asking, so a request that goes ahead cannot resize their sets. */
const COURTESY_MS = 30_000

/** Which sets the shared library is still holding open, by name. A set whose
 * manifest entry is absent never resolves and never fails, so a stall has to
 * be able to name itself. */
function unsettled(stack: Stack): string[] {
  return stack.materials.manifest()
    .map(entry => entry.id.replace(/^library\//, ''))
    .filter(setName => !stack.materials.sync(setName).ready.value)
}

/** The page's loads still in flight that a machine request stands back for. */
function inFlight(stack: Stack): string[] {
  if (stack.materials.pending() === 0) return []
  const failed = new Set(stack.materials.missing().map(set => set.name))
  const skip = outlived.get(stack)
  return unsettled(stack).filter(setName => !failed.has(setName) && !skip?.has(setName))
}

function outlive(stack: Stack, names: readonly string[]): void {
  const skip = outlived.get(stack) ?? new Set<string>()
  for (const setName of names) skip.add(setName)
  outlived.set(stack, skip)
}

/** True once the set's own maps are on the surfaces that use it. */
export function materialDressed(set: MaterialSet): boolean {
  return Boolean(set.ready.value)
}

/** Why a machine set stands undressed, or null when it is dressed or still coming. */
export function materialFailure(set: MaterialSet): string | null {
  return failures.get(set) ?? null
}

/** Share one library request between machine parts and their bench supports.
 * Linen and forged iron retain the tier's complete map budget; other new
 * sets use the library's 1024px albedo budget plus three procedural scales,
 * except under the film's tier, where every set keeps the complete budget.
 * Existing cached sets retain their original maps. Requests are serial, so
 * machine decodes follow one another. The promise never rejects: a set the
 * library cannot dress is reported and handed over undressed, so every part
 * is built and the failure is read through `materialFailure`. The current
 * rendering tier is never changed.
 */
export function loadMachineMaterial(stack: Stack, name: string): Promise<MaterialSet> {
  let cache = materialLoads.get(stack)
  if (!cache) { cache = new Map(); materialLoads.set(stack, cache) }
  const existing = cache.get(name)
  if (existing) return existing
  const previous = materialQueues.get(stack) ?? Promise.resolve()
  const pending = previous.then(async () => {
    const until = Date.now() + COURTESY_MS
    for (let busy = inFlight(stack); busy.length > 0; busy = inFlight(stack)) {
      if (Date.now() >= until) {
        outlive(stack, busy)
        console.warn(`Machine set ${name} goes ahead of page loads still in flight: ${busy.join(', ')}`)
        break
      }
      await new Promise<void>(resolve => setTimeout(resolve, 25))
    }
    // The narrowed budget is held only across the request itself, so no
    // other caller's set can be asked for while it stands.
    const tier = stack.tierConfig()
    stack.materials.setTier(FULL_BUDGET.has(name) || stack.film ? tier : {...tier, detail: 1})
    let request: Promise<MaterialSet>
    try {
      request = stack.materials.load(name)
    } finally {
      stack.materials.setTier(stack.tierConfig())
    }
    let set: MaterialSet, reason: string | null = null
    try {
      set = await request
      if (!materialDressed(set)) reason = 'the library resolved it without displayable maps'
    } catch (error: unknown) {
      set = stack.materials.sync(name)
      reason = error instanceof Error ? error.message : String(error)
    }
    if (reason !== null) {
      failures.set(set, reason)
      outlive(stack, [name])
      console.error(`Machine material ${name} is not dressed, its parts stand without its maps: ${reason}`)
    }
    return set
  }).catch((error: unknown) => {
    if (cache.get(name) === pending) cache.delete(name)
    throw error
  })
  cache.set(name, pending)
  materialQueues.set(stack, pending.then(() => undefined, () => undefined))
  return pending
}

const libraryName = (material: string): string => {
  // new work in planed and hewn oak, not weathered timber
  if (/planed oak|hewn oak|oak peg|oak grip/.test(material)) return 'oak-veneer-light'
  // a cane's skin runs in fine straight fibres, as the veneer's grain does
  if (/cane/.test(material)) return 'oak-veneer-light'
  // a hide sealed with pitch, and the pitch the tube is bedded in
  if (/pitched/.test(material)) return 'leather-worn'
  if (/thread/.test(material)) return 'rope'
  if (/linen/.test(material)) return 'linen'
  if (/hemp|rope/.test(material)) return 'rope'
  if (/bronze/.test(material)) return 'bronze-dark'
  if (/iron|ink|lead/.test(material)) return 'iron-forged'
  if (/leather/.test(material)) return 'leather-worn'
  if (/paper/.test(material)) return 'parchment-laid'
  if (/stone/.test(material)) return 'limestone-pale'
  if (/water|glass/.test(material)) return 'linen'
  return 'oak-beams'
}

/** Rectangular timbers sample different places in the same library photograph.
 * Translation keeps the metre scale, grain direction and surface derivatives.
 * Only the temporary copies already needed for rigid welding are changed. */
function phaseTimber(geometry: BufferGeometry, identity: string): void {
  let hash = 2166136261
  for (let i = 0; i < identity.length; i++) hash = Math.imul(hash ^ identity.charCodeAt(i), 16777619)
  hash = Math.imul(hash ^ (hash >>> 16), 2246822507)
  hash = Math.imul(hash ^ (hash >>> 13), 3266489909)
  hash ^= hash >>> 16
  const offsetU = ((hash & 0xffff) / 65536 - 0.5) * 0.75
  const offsetV = ((hash >>> 16) / 65536 - 0.5) * 0.75
  const coordinates = geometry.getAttribute('uv')
  for (let i = 0; i < coordinates.count; i++) {
    coordinates.setXY(i, coordinates.getX(i) + offsetU, coordinates.getY(i) + offsetV)
  }
  // No two pieces of one tree are one tone: a timber that carries a colour
  // takes its own, a little lighter or darker, a little warmer or cooler.
  const colour = geometry.getAttribute('color')
  if (colour) {
    const value = 0.86 + ((hash >>> 5) & 0xff) / 255 * 0.24
    const warmth = (((hash >>> 13) & 0xff) / 255 - 0.5) * 0.1
    for (let i = 0; i < colour.count; i++) {
      colour.setXYZ(i, colour.getX(i) * value * (1 + warmth), colour.getY(i) * value, colour.getZ(i) * value * (1 - warmth))
    }
  }
}

/** The mill's two slotted posts are rectangular timbers encoded as profiles.
 * Circular plates, pulleys and other profiles keep the library's original UVs. */
const isTimber = (slug: string, part: PartSpec): boolean =>
  part.shape === 'box' || (slug === 'rolling-mill' && (part.id === 'left-post' || part.id === 'right-post'))
  || (typeof part.shape !== 'string' && part.shape.type !== 'mesh' && /planed oak/.test(part.material.class))

/** Construct only the admitted numerical parts. Library sets and shader grain
 * are GENERATED dressing over that metre geometry, never replica textures. */
export async function buildParts(stack: Stack, dossier: Dossier): Promise<DressedAssembly> {
  if (dossier.status !== 'complete') throw new Error(`${dossier.slug} has no admitted complete geometry`)
  const object = new Group()
  object.name = dossier.slug
  object.userData['assetClass'] = 'GENERATED'
  object.userData['dossier'] = dossier.slug
  const parts = new Map<string, Group>(), meshes = new Map<string, Mesh>()
  const materials = new Map<string, Surface>()
  const sidedMaterials = new Map<string, Surface>()
  const geometries = new Set<BufferGeometry>()
  const geometryCache = new Map<string, BufferGeometry>()
  const mutableSweeps = new Map<string, MutableSweep>()
  const signatures = new Map<string, string>()
  const dynamic = new Set(dossier.slug === 'revolving-crane' ? ['hoist-rope', 'drum-wrap'] : dossier.slug === 'lathe' ? ['bow', 'drive-rope'] : [])
  // The complete camera remains closed by default. Its explicitly labelled
  // section view toggles these original part groups without changing geometry.
  // A welded wall cannot be taken off, so every wall the section may lift
  // stays its own draw: the near corner and the back, which the close look
  // opens to show the aperture, the dark interior and the paper.
  const sectionParts = new Set(dossier.slug === 'camera-obscura'
    ? ['roof', 'right-wall', 'left-wall', 'front-left', 'back-wall'] : [])
  const names = [...new Set(dossier.parts.map(p => p.material.class))]
  const surfaceCache = new Map<string, Promise<Surface>>()
  const sets = new Set<MaterialSet>()
  const makeSurface = async (name: string, quietBank = false, quietWood = false, turned = false, burnished = false, geared = false): Promise<Surface> => {
    const set = await loadMachineMaterial(stack, libraryName(name))
    sets.add(set)
    const glass = /glass/.test(name), water = /water/.test(name)
    const material: Surface = glass || water
      ? new MeshPhysicalNodeMaterial({metalness: 0, roughness: glass ? 0.1 : 0.16, transparent: true, opacity: glass ? 0.18 : 0.52, depthWrite: false})
      : new MeshStandardNodeMaterial({metalness: set.metalness, roughness: set.roughness})
    material.name = `${dossier.slug}:${name}:${set.name}`
    // Beam UVs already put the member's long axis along V, in metres.
    // Cancel the library photograph's turn before it places both maps and
    // grain; this preserves their alignment, scale and motion with the part.
    const coordinates = uv()
    const turn = set.name === 'oak-beams' ? (set.entry.orientation ?? 0) * Math.PI / 180 : 0
    const ca = Math.cos(turn), sa = Math.sin(turn)
    const detailUV = turn === 0 ? coordinates : vec2(
      coordinates.x.mul(ca).add(coordinates.y.mul(sa)),
      coordinates.y.mul(ca).sub(coordinates.x.mul(sa)),
    )
    // The assumed glass bell gets its own subtle three-scale recipe, never
    // the borrowed set's cloth photograph or drape. The shared set is intact.
    const detailSet: MaterialSet = glass ? {
      ...set, maps: null, grain: null, detile: 0, metalness: 0,
      albedo: new Color('#fcfefd'), variation: new Color('#f7fbf9'),
      roughness: 0.03, normalStrength: 0.008, scale: [1, 1],
      scales: [0.5, 0.025, 0.0009],
      detail: {macro: 0.5, macroContrast: 0.08, mid: 0.025, micro: 0.06},
    } : /linen/.test(name) && !/thread/.test(name) ? {
      // The shaded face of a canopy is lit by the room, not by the sun, so
      // its folds have to be in the albedo as well as in the normal or the
      // whole face goes to one value.
      ...set, normalStrength: .3,
      grain: set.grain ? {...set.grain, pitch: .16, relief: .28, shade: .36, sheen: .025, fold: .9, tooth: .008} : null,
    } : quietBank || quietWood ? {
      ...set, normalStrength: quietBank ? .18 : .12,
      grain: set.grain ? {...set.grain, relief: .08, shade: .12, sheen: .04} : null,
    } : dossier.slug === 'proportional-compass' && /iron/.test(name) ? {
      // A mirror takes no invented relief, and the helper is right to refuse
      // it: but this object IS its two legs, and forged iron is hammered.
      // The dressing set declares a scattering surface so the pits reach the
      // normal; the material itself stays the metal it is.
      ...set, metalness: .38, roughness: .5, normalStrength: .24,
      scales: [.3, .06, .0016],
      detail: {...set.detail, macro: .25, macroContrast: .07, mid: .75, micro: .3},
    } : set.name === 'bronze-dark' ? {
      // A 150 mm roller inside a 900 mm macro cell takes one value and reads
      // as a painted tube. The bands are cut to the barrel: the cast's own
      // mottle across it, the turning marks on it.
      ...set, scale: [.12, .12], scales: [.07, .014, .0009], normalStrength: .22,
      detail: {...set.detail, macro: .07, macroContrast: .3, mid: .55, micro: .35},
    } : dossier.slug === 'flywheel' && set.name === 'limestone-pale' ? {
      // A 140 mm ball inside a 150 mm macro cell takes one value and reads as
      // putty, and one cut to the ball's own diameter is still one cell across
      // it. The bands are cut to a THIRD of the ball: mottle three times over
      // it, pits at the size a chisel leaves, and enough relief that the key
      // finds them. A dressed stone at arm's length is not a smooth sphere.
      ...set, scale: [.05, .05], scales: [.046, .013, .0016], normalStrength: .62,
      detail: {...set.detail, macro: .046, macroContrast: .55, mid: .8, micro: .55},
    } : /iron, forged/.test(name) ? {
      // Iron off the smith's hammer: a smooth dark skin with soft facets, not
      // the set's cast pits, which read as concrete on a crank's face.
      ...set, normalStrength: .3, scale: [.3, .3], scales: [.25, .045, .0012],
      detail: {...set.detail, macro: .25, macroContrast: .2, mid: .45, micro: .2},
    } : /cane/.test(name) ? {
      // a cane's skin: long fine fibres, almost no relief
      ...set, normalStrength: .12, scales: [.3, .03, .0008],
      grain: set.grain ? {...set.grain, relief: .06, shade: .1, sheen: .3} : null,
    } : /pitched/.test(name) ? {
      // A hide sewn into a hose and sealed with pitch: a close crinkle over a
      // smooth skin, not an upholstery's creases, which read as links.
      ...set, normalStrength: .1, scales: [.35, .04, .0011],
      grain: set.grain ? {...set.grain, pitch: .022, relief: .1, shade: .1, sheen: .28, fold: .3, tooth: .006} : null,
    } : /leather/.test(name) ? {
      // A hide wound round a shaft creases along the wrap; without that band
      // the coil is a smooth tube and reads as hose.
      ...set, normalStrength: .55, scales: [.4, .03, .0011],
      grain: set.grain ? {...set.grain, pitch: .085, relief: .5, shade: .3, sheen: .06} : null,
    } : set
    // Density falloff stays active on every scale, including the calm tier.
    const fade: [number, number] = (/linen/.test(name) && !/thread/.test(name)) || /iron/.test(name) || set.name === 'oak-beams' ? [12, 100] : [6, 35]
    const mapAmount = glass ? 0 : quietWood ? .85 : 1
    const detail = turned
      ? turnedDetail(stack, material, detailSet, {count: 3, maps: mapAmount, fade})
      : stack.detail(material, detailSet, {uv: detailUV, count: 3, maps: mapAmount, fade})
    if (quietBank || quietWood) {
      const oak = new Color(quietBank ? '#86755f' : '#847967')
      const fibres = detail.albedo.dot(vec3(.2126, .7152, .0722))
      material.colorNode = vec3(oak.r, oak.g, oak.b).mul(fibres.mul(quietBank ? .55 : .8).add(quietBank ? .45 : .2)).mul(detail.occlusion)
    }
    if (geared) {
      // A wheel of wooden teeth wears where it meshes and nowhere else. The
      // flanks run round the rim, the two faces look along the axle, and the
      // extrusion puts that axle on the part's own X: a flank is polished
      // darker by every turn, a face keeps the sawn grain it was cut with.
      const oak = new Color('#847967')
      const fibres = detail.albedo.dot(vec3(.2126, .7152, .0722))
      const flank = float(1).sub(normalGeometry.x.abs()).clamp(0, 1).pow(1.6)
      const edge = keyRim(.7).mul(flank)
      material.colorNode = vec3(oak.r, oak.g, oak.b)
        .mul(fibres.mul(.8).add(.2)).mul(detail.occlusion)
        .mul(float(1).sub(flank.mul(.16))).mul(edge.add(1))
      material.roughnessNode = detail.roughness.mul(float(1).sub(flank.mul(.34))).clamp(.28, .95)
    }
    if (/linen/.test(name) && !/thread/.test(name)) {
      material.side = DoubleSide
      // GENERATED unbleached flax tint over the CC0 weave's luminance.
      // Its photographed relief, roughness and occlusion remain unchanged.
      const flax = new Color('#c4b89c')
      const weave = detail.albedo.dot(vec3(0.2126, 0.7152, 0.0722))
      material.colorNode = vec3(flax.r, flax.g, flax.b).mul(weave).mul(detail.occlusion)
      // a sewn cloth carries its rows of stitches in the vertex colour
      if (/starched/.test(name)) material.colorNode = material.colorNode.mul(attribute('color', 'vec3'))
    }
    if (/cane/.test(name)) {
      // GENERATED straw tint over the CC0 veneer's fibres at a third of their
      // contrast: a cane's skin is hard and glassy, its nodes ride in the
      // vertex colour, and a rod this thin needs the key's edge to read.
      const straw = new Color('#b59c68')
      const fibres = detail.albedo.dot(vec3(.2126, .7152, .0722))
      const edge = keyRim(.7)
      material.colorNode = vec3(straw.r, straw.g, straw.b).mul(fibres.mul(.35).add(.72)).mul(detail.occlusion)
        .mul(attribute('color', 'vec3')).mul(edge.add(1))
      material.roughnessNode = detail.roughness.mul(.45).clamp(.26, .42)
    }
    if (glass || water) {
      material.side = glass ? FrontSide : DoubleSide
      if (glass && material instanceof MeshPhysicalNodeMaterial) {
        material.ior = 1.48
        material.transmission = .97
        material.thickness = .002
        material.opacity = 1
        material.transparent = false
        material.depthWrite = true
        material.attenuationColor.set('#e4f0e9')
        material.attenuationDistance = .8
        material.clearcoat = .35
        material.clearcoatRoughness = .05
        material.roughnessNode = float(.03)
      }
      if (water) {
        material.colorNode = vec3(0.025, 0.065, 0.06).mul(detail.albedo)
        material.roughnessNode = float(0.16)
      }
    }
    if (dossier.slug !== 'proportional-compass' && /iron/.test(name)) {
      // A strap, a collar, a pin: every one of these is a small dark body
      // beside a large pale one, and a mirror under a constant ambient takes
      // no modelling at all, so it flattens into the timber behind it. Part
      // of the diffuse term back, and the key rounds the fitting again.
      material.metalness = .45
      const iron = new Color('#787e80')
      const grain = detail.albedo.dot(vec3(.2126, .7152, .0722))
      const caps = dossier.slug === 'multi-barrel-gun' ? normalGeometry.y.abs().mul(.14).add(.86) : float(1)
      // Every axle, collar and pin in the set takes the same edge the compass
      // took: a shaft is a line at this distance, and a line the key cannot
      // find on is a scratch.
      const edge = keyRim(.8)
      material.colorNode = vec3(iron.r, iron.g, iron.b).mul(grain.mul(.6).add(.34)).mul(detail.occlusion).mul(caps).mul(edge.add(1))
      material.roughnessNode = detail.roughness.mul(.8).clamp(.38, .7).mul(float(1).sub(edge.mul(.3))).clamp(.2, .7)
    }
    // Thirty-three round bodies side by side separate only if the key can
    // model them, and a mirror under a constant ambient takes no modelling.
    if (dossier.slug === 'multi-barrel-gun' && /iron/.test(name)) {
      material.metalness = .42
      const barrel = new Color('#5d6265')
      const grain = detail.albedo.dot(vec3(.2126, .7152, .0722))
      const caps = normalGeometry.y.abs().mul(.14).add(.86)
      material.colorNode = vec3(barrel.r, barrel.g, barrel.b).mul(grain.mul(.6).add(.45)).mul(detail.occlusion).mul(caps)
      material.roughnessNode = detail.roughness.mul(.85).clamp(.38, .68)
    }
    // The one subject of this station is a hole. An aperture plate lighter
    // than the plank it is set into reads as a patch laid on the wall.
    if (dossier.slug === 'camera-obscura' && /iron/.test(name)) {
      const plate = new Color('#43474a')
      const grain = detail.albedo.dot(vec3(.2126, .7152, .0722))
      material.metalness = .5
      material.colorNode = vec3(plate.r, plate.g, plate.b).mul(grain.mul(.5).add(.5)).mul(detail.occlusion)
      material.roughnessNode = detail.roughness.clamp(.44, .74)
    }
    if (dossier.slug === 'proportional-compass' && /iron/.test(name)) {
      // Forged, not cast and polished: a darker specular tint and a rougher
      // finish so the legs hold the light instead of matching the floor.
      // A polished mirror under a constant ambient reads as concrete: with no
      // reflection to carry it, a metal's whole surface is what it reflects.
      // Wrought iron that has been forged, worked and oxidised scatters, so
      // this one is given back part of its diffuse term and the key models it.
      // A pivot and its screw are the two parts of this instrument that turn
      // against each other, and a bearing face is burnished by every turn it
      // has ever made. Forged iron beside machined iron is the difference a
      // visitor reads as a fitting rather than as more bar.
      material.metalness = burnished ? .55 : .38
      const ironTint = new Color(burnished ? '#4d545c' : '#3e434a')
      const density = detail.albedo.dot(vec3(.2126, .7152, .0722))
      const rim = keyRim(burnished ? 1.6 : 1.15)
      material.colorNode = vec3(ironTint.r, ironTint.g, ironTint.b)
        .mul(density.mul(burnished ? .3 : .5).add(burnished ? .78 : .5)).mul(detail.occlusion).mul(rim.add(1))
      // An arris is the one place a forged bar is polished, by every hand
      // that ever held it, so the edge takes a tighter reflection than the
      // face beside it.
      material.roughnessNode = burnished
        ? detail.roughness.mul(.5).clamp(.16, .3).mul(float(1).sub(rim.mul(.3)))
        : detail.roughness.mul(.85).clamp(.36, .66).mul(float(1).sub(rim.mul(.42))).clamp(.16, .66)
    }
    if (/bronze/.test(name)) {
      // Cast bronze is not brown timber. Turned true and polished by the sheet
      // that passes between them, a roller carries one bright line down its
      // length where the key bisects it; the rest of the barrel falls away.
      // Under this dark sky a mirror has nothing to reflect, so the metal
      // keeps part of its diffuse term and the key does the modelling.
      material.metalness = .62
      const bronze = new Color('#7e6540')
      const cast = detail.albedo.dot(vec3(.2126, .7152, .0722))
      const rim = keyRim(.9)
      material.colorNode = vec3(bronze.r, bronze.g, bronze.b)
        .mul(cast.mul(.62).add(.5)).mul(detail.occlusion).mul(rim.mul(.5).add(1))
      material.roughnessNode = detail.roughness.mul(.6).clamp(.17, .42)
    }
    if (set.name === 'limestone-pale') {
      // Stone was the first thing the eye found on these frames: four bright
      // balls on the flywheel, a pale counterweight on the crane. Stone sits
      // under the oak beside it, not above it. The balls still out-read their
      // own machine at .95 of the set, so the body of the stone is taken down
      // and its mottle given the room the value leaves.
      const stone = new Color('#7c7669')
      const body = detail.albedo.dot(vec3(.2126, .7152, .0722))
      material.colorNode = vec3(stone.r, stone.g, stone.b).mul(body.mul(1.05).add(.02)).mul(detail.occlusion)
      material.roughnessNode = detail.roughness.clamp(.62, .95)
    }
    if (/leather/.test(name) && !/pitched/.test(name)) {
      const hide = new Color('#5c4331')
      const fibres = detail.albedo.dot(vec3(.2126, .7152, .0722))
      material.colorNode = vec3(hide.r, hide.g, hide.b).mul(fibres.mul(.8).add(.3)).mul(detail.occlusion)
      material.roughnessNode = detail.roughness.clamp(.58, .92)
    }
    if (/pitched/.test(name)) {
      // GENERATED pitch-dark hide tint over the CC0 leather's own luminance,
      // its variation held to a third so the skin reads whole.
      const pitch = new Color(/bedding/.test(name) ? '#1d1713' : /lining/.test(name) ? '#33271e' : '#3a2b21')
      const lum = set.albedo.r * .2126 + set.albedo.g * .7152 + set.albedo.b * .0722
      const fibres = detail.albedo.dot(vec3(.2126, .7152, .0722)).div(Math.max(lum, .001))
      // dried pitch is a dull skin: a flat one with a sheen reads as standing water
      const spread = /bedding|lining/.test(name) ? .08 : .3
      // the hide's round takes the key's edge, so each turn stands off the core behind it
      const edge = /bedding|lining/.test(name) ? float(0) : keyRim(1.3)
      material.colorNode = vec3(pitch.r, pitch.g, pitch.b).mul(fibres.mul(spread).add(1 - spread).clamp(.5, 1.4)).mul(detail.occlusion).mul(edge.add(1))
      material.roughnessNode = /bedding|lining/.test(name) ? detail.roughness.mul(.3).add(.5).clamp(.52, .72) : detail.roughness.mul(.75).clamp(.46, .66)
      if (/bedding|lining/.test(name)) material.normalNode = null
    }
    if (/planed oak|hewn oak|oak peg|oak grip/.test(name)) {
      // GENERATED tint: new planed oak, paler and greyer than the museum's
      // oiled oak, over the CC0 veneer's own grain at half its colour and a
      // little over half its contrast; the grip is darkened by the hand.
      const oak = new Color(/grip/.test(name) ? '#5f4a37' : /hewn/.test(name) ? '#8f7c64' : '#897a66')
      const lum = detail.albedo.dot(vec3(.2126, .7152, .0722))
      // the hewn core is the largest face on the machine and shows its run of grain
      const grain = mix(vec3(lum, lum, lum), detail.albedo, .35).sub(1).mul(/hewn/.test(name) ? .9 : .62).add(1)
      // the piece's own tone and its darker end grain ride in the vertex colour
      material.colorNode = vec3(oak.r, oak.g, oak.b).mul(grain).mul(detail.occlusion).mul(attribute('color', 'vec3'))
      // a grip the hand has turned for years is polished by it
      material.roughnessNode = /grip/.test(name) ? detail.roughness.mul(.5).clamp(.2, .34) : detail.roughness.clamp(.5, .85)
    }
    if (/iron, forged/.test(name)) {
      // GENERATED tint: blacksmith's iron, dark off the hammer with a faint
      // warm scale, over the CC0 set's own mottle.
      // where the water runs over it every turn the scale is scoured off
      const scoured = /scoured/.test(name)
      // bright metal under a dark sky mirrors the dark: the scoured lip keeps a
      // diffuse share so it still reads pale at a phone's size
      material.metalness = scoured ? .35 : .5
      const scale = new Color(scoured ? '#857e74' : '#3f3a35')
      const mottle = detail.albedo.dot(vec3(.2126, .7152, .0722))
      material.colorNode = vec3(scale.r, scale.g, scale.b).mul(mottle.mul(.25).add(.8)).mul(detail.occlusion).mul(scoured ? keyRim(1.2).add(1) : float(1))
      material.roughnessNode = scoured ? detail.roughness.mul(.5).clamp(.3, .45) : detail.roughness.mul(.9).clamp(.5, .82)
    }
    if (dossier.slug === 'camera-obscura' && set.name === 'oak-beams') {
      // The one flat lid on the bench that the key strikes near square. A
      // sawn plank is a rough surface and its highlight is broad; at the
      // inherited floor the specular lobe came to a point and the lid blew to
      // white, taking its grain with it.
      material.roughnessNode = detail.roughness.clamp(.66, .96)
    }
    if (/ink/.test(name)) material.colorNode = vec3(0.009, 0.007, 0.005).mul(detail.albedo)
    if (/paper/.test(name)) material.colorNode = vec3(0.69, 0.65, 0.55).mul(detail.albedo)
    if (/lead/.test(name)) material.colorNode = vec3(0.16, 0.17, 0.18).mul(detail.albedo)
    if (['revolving-crane', 'lathe', 'parachute', 'aerial-screw'].includes(dossier.slug) && /rope|hemp/.test(name)) {
      // The exact 10 mm swept cord keeps its silhouette. Its three-lobed
      // geometry carries the twist; a coarse cloth-like normal buries it.
      const hemp = new Color(dossier.slug === 'revolving-crane' ? '#ad9367' : '#c5ae80')
      const fibres = detail.albedo.dot(vec3(.2126, .7152, .0722))
      material.colorNode = vec3(hemp.r, hemp.g, hemp.b).mul(fibres.mul(.45).add(.55)).mul(detail.occlusion)
      material.normalNode = null
      material.roughnessNode = float(.86)
    }
    return material
  }
  await Promise.all(names.map(async name => {
    const key = /ink|glass|water|lead|paper|oak peg|hewn oak|oak grip|bedding|lining|scoured|cane/.test(name) ? name : libraryName(name)
    let surface = surfaceCache.get(key)
    if (!surface) { surface = makeSurface(name); surfaceCache.set(key, surface) }
    materials.set(name, await surface)
  }))

  for (const part of dossier.parts) {
    const group = new Group()
    group.name = part.id
    group.position.fromArray(part.position_m)
    group.rotation.set(part.orientation_rad[0] ?? 0, part.orientation_rad[1] ?? 0, part.orientation_rad[2] ?? 0, 'XYZ')
    group.userData['certainty'] = part.certainty
    group.userData['source'] = part.source
    parts.set(part.id, group)
    const signature = JSON.stringify([part.shape, part.dimensions_m, /rope|hemp|thread/.test(part.material.class), /wood|oak|ash|cane/.test(part.material.class)])
    signatures.set(part.id, signature)
    let geometry = !dynamic.has(part.id) ? geometryCache.get(signature) : undefined
    if (!geometry) {
      if (dynamic.has(part.id)) {
        const shape = typeof part.shape === 'string' ? undefined : part.shape
        const points = shape?.centreline_m ?? part.dimensions_m.centreline
        const radius = shape?.radius_m ?? part.dimensions_m.radius
        if (!points || radius === undefined) throw new Error(`Missing moving sweep ${part.id}`)
        const sweep = createMutableSweep(points, radius, /rope|hemp|thread/.test(part.material.class), stack.tierName())
        mutableSweeps.set(part.id, sweep)
        geometry = sweep.geometry
      } else if (dossier.slug === 'flywheel' && part.id === 'spoke-z') {
        geometry = createFlywheelSpokeArms(part, dossier.parts.find(p => p.id === 'spoke-x')!)
      } else geometry = geometryForPart(part, stack.tierName(), dossier.slug)
      if (!dynamic.has(part.id)) geometryCache.set(signature, geometry)
      geometries.add(geometry)
    }
    let material = materials.get(part.material.class)!
    if (dossier.slug === 'multi-barrel-gun' && /^bank-[012]$/.test(part.id)) {
      let bank = materials.get('quiet-bank')
      if (!bank) { bank = await makeSurface(part.material.class, true); materials.set('quiet-bank', bank) }
      material = bank
    }
    const roundedWood = libraryName(part.material.class) === 'oak-beams' && (
      part.shape === 'cylinder' || part.shape === 'profile of revolution' || part.shape === 'sphere'
      || (dossier.slug === 'inclinometer' && part.id.startsWith('journal-post')))
    if (roundedWood) {
      let dressed = materials.get('quiet-rounded-wood')
      if (!dressed) { dressed = await makeSurface(part.material.class, false, true); materials.set('quiet-rounded-wood', dressed) }
      material = dressed
    }
    // A ball is turned, never planked: it takes the pole-free projection
    // whatever its class, and an oak one keeps the quieter rounded finish.
    if ((typeof part.shape === 'string' ? part.shape : part.shape.type) === 'sphere') {
      const key = `turned:${part.material.class}`
      let ball = materials.get(key)
      if (!ball) { ball = await makeSurface(part.material.class, false, roundedWood, true); materials.set(key, ball) }
      material = ball
    }
    if (dossier.slug === 'rolling-mill' && (part.id === 'driver' || part.id === 'driven')) {
      let gear = materials.get('worn-gear')
      if (!gear) { gear = await makeSurface(part.material.class, false, true, false, false, true); materials.set('worn-gear', gear) }
      material = gear
    }
    if (dossier.slug === 'proportional-compass' && (part.id === 'pivot' || part.id === 'screw-head')) {
      let fitting = materials.get('burnished-fitting')
      if (!fitting) { fitting = await makeSurface(part.material.class, false, false, false, true); materials.set('burnished-fitting', fitting) }
      material = fitting
    }
    if (dossier.slug === 'inclinometer' && part.id === 'deck') {
      material = createGlassSeatMaterial(material)
      materials.set('glass-foot-light', material)
    }
    if (typeof part.shape !== 'string' && part.shape.double_sided && !/glass/.test(part.material.class) && material.side !== DoubleSide) {
      const key = material.uuid
      let both = sidedMaterials.get(key)
      if (!both) {
        both = material.clone(); both.side = DoubleSide
        sidedMaterials.set(key, both)
      }
      material = both
    }
    const mesh = new Mesh(geometry, material)
    mesh.name = `${part.id}:surface`
    mesh.castShadow = !/glass|water/.test(part.material.class)
    mesh.receiveShadow = true
    mesh.userData['assetClass'] = 'GENERATED'
    mesh.userData['partId'] = part.id
    group.add(mesh)
    meshes.set(part.id, mesh)
  }
  for (const part of dossier.parts) {
    const parent = part.parent === 'world' ? object : parts.get(part.parent)
    if (!parent) throw new Error(`Dossier parent ${part.parent} missing for ${part.id}`)
    parent.add(parts.get(part.id)!)
  }
  object.updateMatrixWorld(true)

  // Wear is laid on each worn part's own copy of its surface, in the
  // machine's rest frame, before any copy is shared or welded.
  const wear = wearFor(dossier.slug)
  const worn = new Set<string>()
  if (wear.length) {
    const toMachine = new Matrix4(), root = object.matrixWorld.clone().invert()
    for (const part of dossier.parts) {
      const rules = wear.filter(rule => rule.parts(part.id))
      const mesh = meshes.get(part.id)
      if (!rules.length || !mesh || dynamic.has(part.id)) continue
      toMachine.multiplyMatrices(root, mesh.matrixWorld)
      mesh.geometry = wornSurface(mesh.geometry, toMachine, rules)
      geometries.add(mesh.geometry)
      worn.add(part.id)
    }
  }

  const instances: {mesh: InstancedMesh; parts: Group[]}[] = []
  // A joint explicitly locked at zero is a rigid connection. Its node stays
  // in the hierarchy for inspection, but it cannot split a static draw.
  const moving = new Set(dossier.joints.filter(j =>
    !['gear', 'belt', 'rope'].includes(j.type) && !(j.limits?.[0] === 0 && j.limits?.[1] === 0),
  ).map(j => j.child))
  const specById = new Map(dossier.parts.map(p => [p.id, p]))
  const rigidAncestor = (part: PartSpec): Group => {
    let ancestor: PartSpec | undefined = part
    while (ancestor && !moving.has(ancestor.id)) ancestor = specById.get(ancestor.parent)
    return ancestor ? parts.get(ancestor.id)! : object
  }
  const noweld = typeof location !== 'undefined' && new URLSearchParams(location.search).has('noweld')
  // The unbatched diagnostic evaluates the same policy, so its individual
  // timbers receive exactly the phases that a welded copy would receive.
  {
    // Identical balls, barrels and repeated fittings share a single draw.
    // Source groups remain exact joint nodes. Instance matrices are refreshed
    // from those nodes after motion, so spin and parent motion occur once.
    const repeats = new Map<string, PartSpec[]>()
    for (const part of dossier.parts) {
      if (dynamic.has(part.id) || sectionParts.has(part.id) || worn.has(part.id)) continue
      const key = `${(meshes.get(part.id)!.material as Surface).uuid}:${signatures.get(part.id)}`
      const list = repeats.get(key) ?? []
      list.push(part); repeats.set(key, list)
    }
    const instanced = new Set<string>()
    const bucket = (part: PartSpec): string =>
      `${rigidAncestor(part).uuid}:${(meshes.get(part.id)!.material as Surface).uuid}`
    const remaining = new Map<string, number>()
    for (const list of repeats.values()) {
      for (const part of list) remaining.set(bucket(part), (remaining.get(bucket(part)) ?? 0) + 1)
    }
    for (const list of repeats.values()) {
      // Eight balls or 33 barrels earn shared geometry. A smaller repeated
      // set earns instancing only when it eliminates two complete rigid
      // draws. Splitting two gate leaves into many paired beam instances
      // would add draws even though the members have different ancestors.
      const covered = new Map<string, number>()
      for (const part of list) covered.set(bucket(part), (covered.get(bucket(part)) ?? 0) + 1)
      const eliminated = [...covered].filter(([key, n]) => remaining.get(key) === n).length
      if (list.length < 8 && eliminated < 2) continue
      for (const [key, n] of covered) remaining.set(key, remaining.get(key)! - n)
      for (const part of list) instanced.add(part.id)
      if (noweld) continue
      const first = meshes.get(list[0]!.id)!
      const mesh = new InstancedMesh(first.geometry, first.material, list.length)
      mesh.name = `${dossier.slug}:repeated-${list[0]!.id}`
      mesh.castShadow = first.castShadow; mesh.receiveShadow = true
      mesh.frustumCulled = false
      object.add(mesh)
      instances.push({mesh, parts: list.map(part => parts.get(part.id)!)})
      for (const part of list) {
        meshes.get(part.id)!.removeFromParent()
      }
    }
    // Weld the geometry that stays rigid relative to a kinematic ancestor.
    // Each distinct material stays a draw, and moving nodes remain in place.
    const batches = new Map<string, {anchor: Group; sources: Mesh[]}>()
    for (const part of dossier.parts) {
      if (dynamic.has(part.id) || sectionParts.has(part.id) || instanced.has(part.id)) continue
      const anchor = rigidAncestor(part)
      const key = `${anchor.uuid}:${(meshes.get(part.id)!.material as Surface).uuid}`
      const batch = batches.get(key) ?? {anchor, sources: []}
      batch.sources.push(meshes.get(part.id)!); batches.set(key, batch)
    }
    for (const {anchor, sources} of batches.values()) {
      if (sources.length < 2) continue
      if (noweld) {
        for (const source of sources) {
          const part = specById.get(source.userData['partId'] as string)!
          if (!isTimber(dossier.slug, part) || !PHASED_OAK.has(libraryName(part.material.class))) continue
          const geometry = source.geometry.clone()
          phaseTimber(geometry, `${dossier.slug}:${part.id}`)
          geometries.add(geometry)
          source.geometry = geometry
        }
        continue
      }
      const inverse = anchor.matrixWorld.clone().invert()
      const pieces = sources.map(source => {
        let geometry = source.geometry.clone()
        const part = specById.get(source.userData['partId'] as string)!
        if (isTimber(dossier.slug, part) && PHASED_OAK.has(libraryName(part.material.class))) phaseTimber(geometry, `${dossier.slug}:${part.id}`)
        geometry.applyMatrix4(new Matrix4().multiplyMatrices(inverse, source.matrixWorld))
        // Extrusions are unindexed, procedural meshes indexed. A common
        // layout allows welding without altering any numerical surface.
        if (geometry.index) {
          const flat = geometry.toNonIndexed(); geometry.dispose(); geometry = flat
        }
        geometry.clearGroups()
        return geometry
      })
      const geometry = mergeGeometries(pieces, false)
      for (const piece of pieces) piece.dispose()
      if (!geometry) throw new Error(`Cannot weld numerical parts for ${dossier.slug}`)
      geometries.add(geometry)
      const mesh = new Mesh(geometry, sources[0]!.material)
      mesh.name = `${anchor.name}:rigid-surfaces`
      mesh.castShadow = sources[0]!.castShadow; mesh.receiveShadow = true
      anchor.add(mesh)
      for (const source of sources) source.removeFromParent()
    }
  }

  const inverseRoot = new Matrix4(), transform = new Matrix4()
  const sync = (): void => {
    object.updateMatrixWorld(true)
    inverseRoot.copy(object.matrixWorld).invert()
    for (const instance of instances) {
      instance.parts.forEach((part, i) => {
        transform.multiplyMatrices(inverseRoot, part.matrixWorld)
        instance.mesh.setMatrixAt(i, transform)
      })
      instance.mesh.instanceMatrix.needsUpdate = true
      // Box3.setFromObject caches instance bounds. Joint motion invalidates
      // those caches even though rendering itself disables frustum culling.
      instance.mesh.boundingBox = null
      instance.mesh.boundingSphere = null
    }
  }
  sync()
  return {
    object, parts, meshes, sync, sets,
    updateTube(id, points) {
      const sweep = mutableSweeps.get(id)
      if (!sweep) throw new Error(`Unknown moving tube ${id}`)
      sweep.update(points)
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose()
      for (const material of new Set(materials.values())) material.dispose()
      for (const material of sidedMaterials.values()) material.dispose()
      for (const instance of instances) instance.mesh.dispose()
      object.clear(); parts.clear(); meshes.clear(); mutableSweeps.clear()
    },
  }
}

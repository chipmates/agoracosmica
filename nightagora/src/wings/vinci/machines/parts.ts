import {
  Color, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshPhysicalNodeMaterial, MeshStandardNodeMaterial,
  type BufferGeometry,
} from 'three/webgpu'
import { float, uv, vec2, vec3 } from 'three/tsl'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { MaterialSet, Stack } from '../../../stack'
import { createMutableSweep, geometryForPart, type MutableSweep } from './geometry'
import type { Assembly, Dossier, PartSpec } from './types'
export type { Assembly } from './types'

type Surface = MeshStandardNodeMaterial | MeshPhysicalNodeMaterial
const materialLoads = new WeakMap<Stack, Map<string, Promise<MaterialSet>>>()
const materialQueues = new WeakMap<Stack, Promise<void>>()

/** Share one library request between machine parts and their bench supports.
 * Linen and forged iron retain the tier's complete map budget; other new
 * sets use the library's 1024px albedo budget plus three procedural scales.
 * Existing cached sets retain their original maps. All requests are serial
 * because the public library budget applies to every in-flight decode.
 * Measure tiers on fresh pages; live tier changes during decoding cannot be
 * isolated through this API. The current rendering tier is never changed.
 */
export function loadMachineMaterial(stack: Stack, name: string): Promise<MaterialSet> {
  let cache = materialLoads.get(stack)
  if (!cache) { cache = new Map(); materialLoads.set(stack, cache) }
  const existing = cache.get(name)
  if (existing) return existing
  const previous = materialQueues.get(stack) ?? Promise.resolve()
  const pending = previous.then(async () => {
    // The lobby may already be decoding shared stone and bronze. Wait before
    // touching its public budget, without invoking a duplicate load. A bad
    // inherited manifest must report failure rather than hold readiness forever.
    const deadline = Date.now() + 30_000
    while (stack.materials.pending() > 0) {
      if (Date.now() >= deadline) throw new Error(`Inherited material loads did not settle before ${name}`)
      await new Promise<void>(resolve => setTimeout(resolve, 25))
    }
    const tier = stack.tierConfig()
    stack.materials.setTier(name === 'linen' || name === 'iron-forged' ? tier : {...tier, detail: 1})
    try {
      const set = await stack.materials.load(name)
      if (!set.ready.value) throw new Error(`Material ${name} resolved without displayable maps`)
      return set
    } finally {
      stack.materials.setTier(stack.tierConfig())
    }
  }).catch((error: unknown) => {
    if (cache.get(name) === pending) cache.delete(name)
    throw error
  })
  cache.set(name, pending)
  materialQueues.set(stack, pending.then(() => undefined, () => undefined))
  return pending
}

const libraryName = (material: string): string => {
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
}

/** The mill's two slotted posts are rectangular timbers encoded as profiles.
 * Circular plates, pulleys and other profiles keep the library's original UVs. */
const isTimber = (slug: string, part: PartSpec): boolean =>
  part.shape === 'box' || (slug === 'rolling-mill' && (part.id === 'left-post' || part.id === 'right-post'))

/** Construct only the admitted numerical parts. Library sets and shader grain
 * are GENERATED dressing over that metre geometry, never replica textures. */
export async function buildParts(stack: Stack, dossier: Dossier): Promise<Assembly> {
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
  const sectionParts = new Set(dossier.slug === 'camera-obscura' ? ['roof', 'right-wall'] : [])
  const names = [...new Set(dossier.parts.map(p => p.material.class))]
  const surfaceCache = new Map<string, Promise<Surface>>()
  const makeSurface = async (name: string): Promise<Surface> => {
    const set = await loadMachineMaterial(stack, libraryName(name))
    const glass = /glass/.test(name), water = /water/.test(name)
    const material: Surface = glass || water
      ? new MeshPhysicalNodeMaterial({metalness: 0, roughness: glass ? 0.14 : 0.16, transparent: true, opacity: glass ? 0.06 : 0.52, depthWrite: false})
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
      albedo: new Color('#d8e4df'), variation: new Color('#cdd8d2'),
      roughness: 0.14, normalStrength: 0.025, scale: [1, 1],
      scales: [0.5, 0.025, 0.0009],
      detail: {macro: 0.5, macroContrast: 0.08, mid: 0.025, micro: 0.06},
    } : set
    // Density falloff stays active on every scale, including the calm tier.
    const detail = stack.detail(material, detailSet, {uv: detailUV, count: 3, maps: glass ? 0 : 1, fade: /linen/.test(name) && !/thread/.test(name) ? [12, 100] : [6, 35]})
    if (/linen/.test(name) && !/thread/.test(name)) {
      material.side = DoubleSide
      // GENERATED unbleached flax tint over the CC0 weave's luminance.
      // Its photographed relief, roughness and occlusion remain unchanged.
      const flax = new Color('#c4b89c')
      const weave = detail.albedo.dot(vec3(0.2126, 0.7152, 0.0722))
      material.colorNode = vec3(flax.r, flax.g, flax.b).mul(weave).mul(detail.occlusion)
    }
    if (glass || water) {
      material.side = DoubleSide
      if (water) {
        material.colorNode = vec3(0.025, 0.065, 0.06).mul(detail.albedo)
        material.roughnessNode = float(0.16)
      }
    }
    if (/ink/.test(name)) material.colorNode = vec3(0.009, 0.007, 0.005).mul(detail.albedo)
    if (/paper/.test(name)) material.colorNode = vec3(0.69, 0.65, 0.55).mul(detail.albedo)
    if (/lead/.test(name)) material.colorNode = vec3(0.16, 0.17, 0.18).mul(detail.albedo)
    return material
  }
  await Promise.all(names.map(async name => {
    const key = /ink|glass|water|lead|paper/.test(name) ? name : libraryName(name)
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
      } else geometry = geometryForPart(part, stack.tierName())
      if (!dynamic.has(part.id)) geometryCache.set(signature, geometry)
      geometries.add(geometry)
    }
    let material = materials.get(part.material.class)!
    if (typeof part.shape !== 'string' && part.shape.double_sided && material.side !== DoubleSide) {
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
      if (dynamic.has(part.id) || sectionParts.has(part.id)) continue
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
          if (!isTimber(dossier.slug, part) || libraryName(part.material.class) !== 'oak-beams') continue
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
        if (isTimber(dossier.slug, part) && libraryName(part.material.class) === 'oak-beams') phaseTimber(geometry, `${dossier.slug}:${part.id}`)
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
    object, parts, meshes, sync,
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

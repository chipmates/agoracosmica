/* THE CRANE OUT OF THE STORE.
 *
 * Thirteen of the fourteen machines on this bench are built here, part by part,
 * out of their dossier's own numbers. The revolving crane is not: it was built
 * by a script in the Blender kit, baked, packed at three tiers and recorded in
 * the wing's manifest, and a blind test scored that body against the procedural
 * one and preferred it. So this module stands the recorded body in its place.
 *
 * What does not change: the dossier is still the source. The body was built
 * from the same `data/revolving-crane.json`, it arrives at the same metres in
 * the same frame with its floor at the same height, and its moving assemblies
 * are named nodes whose origins are the dossier's own joints. The bench drives
 * them from the same schedule every other machine runs on, so the drum turns at
 * the rate the drive allows, the rope's fall shortens by exactly what the load
 * rises, and `window.__forge.machine()` reports the same joint values it always
 * did.
 *
 * No light is baked into the body: the export carries no emissive channel, and
 * the occlusion the bake measured off the geometry travels in the ORM texture,
 * where it reaches the ambient term alone. The key in the frame is the bench's.
 *
 * If the store cannot answer (no record, no bytes, a backend with no
 * transcoder), the procedural crane stands instead and says so once. A bench
 * whose machine is missing is a worse failure than a machine built twice.
 */

import {
  Box3, Color, Group, Mesh, MeshStandardNodeMaterial, Object3D, Vector3,
  type Material, type MeshStandardMaterial, type Texture,
} from 'three/webgpu'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import * as TSL from 'three/tsl'
import { loadManifest, type ManifestEntry } from '../../../manifest'
import { ASSET_BASE } from '../../../stack/materials'
import type { Stack, TierName } from '../../../stack'
import { machineCatalog } from './catalog'
import { jointValuesAt, type JointValues } from './motion'
import { makeMachine, type ReadyMachineBuild } from './runtime'

/** what the bake's own value is multiplied by to stand in the bench's light */
const BENCH_TIMBER_LIFT = 2.8

/** one manifest record per tier, as the store names them */
const RECORD: Record<TierName, string> = {
  hero: 'vinci/revolving-crane-opus-hero',
  standard: 'vinci/revolving-crane-opus-standard',
  calm: 'vinci/revolving-crane-opus-calm',
}

/* The packed body carries meshopt geometry and ETC1S maps inside KTX2, and a
   bare loader refuses both. The transcoder is FETCHED rather than imported, so
   the two files stand in `public/basis/` outside the bundle graph. Which GPU
   format they become is a fact about the machine and is read off the renderer,
   never assumed. */
let reader: GLTFLoader | null = null
function gltf(stack: Stack): GLTFLoader {
  if (reader) return reader
  const ktx2 = new KTX2Loader().setTranscoderPath(`${import.meta.env.BASE_URL}basis/`)
  ktx2.detectSupport(stack.renderer)
  reader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder)
  return reader
}

interface CraneJoints {
  turntable: Object3D
  drum: Object3D
  rear: Object3D
  tip: Object3D
  fall: Object3D
  load: Object3D
  /** the rope's own hanging length at rest, in metres */
  fallLength: number
  loadRest: number
  entry: ManifestEntry
  triangles: number
  meshes: number
}

/** the glTF's own material, put on the stack's own path. What comes out
    carries exactly what the bake put in, and it has slots this stack writes. */
function nodeMaterial(source: MeshStandardMaterial): MeshStandardNodeMaterial {
  const next = new MeshStandardNodeMaterial()
  next.name = `revolving-crane:${source.name}`
  next.color = (source.color ?? new Color(0xffffff)).clone()
  next.map = source.map
  next.normalMap = source.normalMap
  next.normalScale.copy(source.normalScale)
  next.roughness = source.roughness ?? 1
  next.roughnessMap = source.roughnessMap
  next.metalness = source.metalness ?? 0
  next.metalnessMap = source.metalnessMap
  next.aoMap = source.aoMap
  next.aoMapIntensity = source.aoMapIntensity ?? 1
  next.side = source.side
  next.vertexColors = source.vertexColors
  /* NO BAKED LIGHT CROSSES. Nothing emissive arrives and none is invented. */
  next.emissive = new Color(0, 0, 0)
  next.emissiveIntensity = 1
  /* A FLOOR UNDER THE MEASURED OCCLUSION. It reaches zero where the bake found
     a closed pocket, and zero ambient draws that pocket as a hole punched
     through the timber rather than as shade. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { materialAO, float, texture, vec3 } = TSL as unknown as Record<string, any>
  next.aoNode = materialAO.mul(0.84).add(float(0.16))
  /* THE TONAL FAMILY OF THE BENCH. The atlas holds the library photograph at
     its own value; the other thirteen machines read that same photograph
     through the bench's oak, which stands a stop above it. Measured on the
     cross beam under this key: 24 of 255 against 41. The body is lifted onto
     the bench's own timber rather than the bench being lit for one machine. */
  const base = vec3(next.color.r, next.color.g, next.color.b)
  next.colorNode = (next.map ? texture(next.map).rgb.mul(base) : base).mul(BENCH_TIMBER_LIFT)
  return next
}

function named(root: Object3D, name: string): Object3D {
  const node = root.getObjectByName(name)
  if (!node) throw new Error(`the crane in the store has no joint named ${name}`)
  return node
}

async function standFromStore(stack: Stack, host: Group): Promise<CraneJoints> {
  const index = await loadManifest()
  const id = RECORD[stack.tierName()]
  const entry = index.byId.get(id)
  if (!entry) throw new Error(`no manifest entry for ${id}`)
  if (!entry.display || entry.class === 'REFERENCE-ONLY') throw new Error(`${id} may not be displayed`)
  const file = entry.gltf?.file
  if (!file) throw new Error(`${id} names no document`)
  const document = await gltf(stack).loadAsync(`${ASSET_BASE}${entry.wing}/${entry.path}${file}`)
  const body = document.scene as unknown as Object3D
  const swapped = new Map<Material, MeshStandardNodeMaterial>()
  let triangles = 0, meshes = 0
  body.traverse((child: Object3D) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    meshes++
    const geometry = mesh.geometry
    const index2 = geometry.getIndex()
    triangles += Math.floor((index2 ? index2.count : (geometry.getAttribute('position')?.count ?? 0)) / 3)
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const built = list.map((m) => {
      const already = swapped.get(m)
      if (already) return already
      const next = nodeMaterial(m as MeshStandardMaterial)
      swapped.set(m, next)
      return next
    })
    mesh.material = (Array.isArray(mesh.material) ? built : built[0]) as never
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData['assetClass'] = 'GENERATED'
    mesh.userData['manifestId'] = id
  })
  host.add(body)
  const fall = named(body, 'rope-fall'), load = named(body, 'load')
  const measured = new Box3().setFromObject(fall as never)
  host.updateMatrixWorld(true)
  return {
    turntable: named(body, 'turntable'),
    drum: named(body, 'drum'),
    rear: named(body, 'rear-pulley'),
    tip: named(body, 'tip-pulley'),
    fall,
    load,
    // the rope hangs from the tip sheave's own height down to the stone: what
    // it pays out is what the stone rises, so the two are one number
    fallLength: Math.max(0.01, fall.getWorldPosition(new Vector3()).y - measured.min.y),
    loadRest: load.position.y,
    entry,
    triangles,
    meshes,
  }
}

function drive(joints: CraneJoints, values: JointValues): void {
  joints.turntable.rotation.y = values['slew'] ?? 0
  joints.drum.rotation.x = values['hoist'] ?? 0
  joints.rear.rotation.x = values['rear'] ?? 0
  joints.tip.rotation.x = values['tip'] ?? 0
  const lift = values['lift'] ?? 0
  joints.load.position.y = joints.loadRest + lift
  joints.fall.scale.y = Math.max(0.02, (joints.fallLength - lift) / joints.fallLength)
}

/** what the bench and the rig read off the standing body */
export interface StoreCraneReading {
  id: string
  tier: TierName
  triangles: number
  meshes: number
  entry: ManifestEntry | null
  standing: 'store' | 'procedural' | 'loading'
}

export interface StoreCrane extends ReadyMachineBuild {
  reading: () => StoreCraneReading
}

export function buildStoreCrane(stack: Stack): StoreCrane {
  const record = machineCatalog['revolving-crane']
  const object = new Group()
  object.name = 'vinci/revolving-crane'
  object.userData['assetClass'] = 'GENERATED'
  object.userData['manifestId'] = RECORD[stack.tierName()]
  object.userData['dossier'] = record.sourcePath
  object.userData['certainty'] = 'C'
  const scale = record.dossier.scale_m
  const floor = record.dossier.frame.ground_y_m ?? 0
  const min = new Vector3(-scale.x / 2, floor, -scale.z / 2)
  const bounds = new Box3(min, min.clone().add(new Vector3(scale.x, scale.y, scale.z)))

  let joints: CraneJoints | null = null
  let fallback: ReadyMachineBuild | null = null
  let disposed = false
  let time = 0
  let values = jointValuesAt('revolving-crane', 0)
  let held: Texture[] = []

  const ready = standFromStore(stack, object)
    .then((standing) => {
      if (disposed) return
      joints = standing
      object.userData['manifestId'] = standing.entry.id
      held = mapsOf(object)
      drive(standing, values)
      object.updateMatrixWorld(true)
    })
    .catch(async (error: unknown) => {
      if (disposed) return
      console.warn(`the crane in the store did not stand, the built one is here instead: ${(error as Error).message}`)
      fallback = makeMachine(stack, record)
      object.add(fallback.object)
      await fallback.ready
      fallback.animate(time, 0)
    })

  function mapsOf(root: Object3D): Texture[] {
    const found = new Set<Texture>()
    root.traverse((child: Object3D) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const standard = m as MeshStandardMaterial
        for (const map of [standard.map, standard.normalMap, standard.roughnessMap, standard.metalnessMap, standard.aoMap]) {
          if (map) found.add(map)
        }
      }
    })
    return [...found]
  }

  return {
    object,
    slug: 'revolving-crane',
    period: record.dossier.motion.period_s,
    bounds,
    label: { ...record.label },
    ready,
    animate(t, dt) {
      time = Math.max(0, Number.isFinite(t) ? t : 0)
      values = jointValuesAt('revolving-crane', time)
      if (joints) {
        drive(joints, values)
        object.updateMatrixWorld(true)
      }
      else fallback?.animate(time, dt)
    },
    joints: () => ({ ...values }),
    tightBounds() {
      object.updateMatrixWorld(true)
      return new Box3().setFromObject(object, true)
    },
    section() {},
    reading: () => ({
      id: RECORD[stack.tierName()],
      tier: stack.tierName(),
      triangles: joints?.triangles ?? 0,
      meshes: joints?.meshes ?? 0,
      entry: joints?.entry ?? null,
      standing: joints ? 'store' : fallback ? 'procedural' : 'loading',
    }),
    dispose() {
      if (disposed) return
      disposed = true
      fallback?.dispose()
      for (const map of held) map.dispose()
      held = []
      object.traverse((child: Object3D) => {
        const mesh = child as Mesh
        if (!mesh.isMesh) return
        mesh.geometry.dispose()
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) m.dispose()
      })
      object.clear()
      object.removeFromParent()
    },
  }
}

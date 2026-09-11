/* THE MODEL LIBRARY — the sibling of the material library, and the same law.

   A material answers what a surface is made of. A model answers what a thing
   IS: a window with a reveal, a sill, glazing bars and a shutter; a barrel
   with staves and hoops; a rope that is a rope. Two blind verdicts scored the
   da Vinci wing's geometry at 4 and 5, and their evidence was always the same
   kind of thing: windows painted on walls, a water screw of detached rings,
   rope drawn as a hairline. Those are not lighting failures and no material
   fixes them. They are the failures of a seat that had to build every object
   out of boxes in twenty rounds.

   So: sixty-odd CC0 glTF models at real scale, in the store, manifested like
   every other asset, and one loader.

     Stack.models.load(slug)              the prototype, once, cached
     Stack.models.place(slug, at)         a copy of it, standing where told
     Stack.models.scatter(slug, [at, ..]) many copies as one draw per mesh
     Stack.cost().models                  what the library is holding

   THREE THINGS THIS LOADER PROMISES.

   · REAL SCALE. Every model arrives in metres, and every number the manifest
     carries about it was measured off the delivered file, not off the
     catalogue's claim. `place()` snaps a body to the ground by its own
     lowest point, so a thing given a position stands on it rather than
     hovering over it or sinking into it.
   · ONE COPY OF THE BYTES. A slug loads once. Every later `place()` clones
     the prototype, which in three shares the geometry and the material, so a
     hundred stones cost one upload and a hundred draws; `scatter()` costs
     one upload and ONE draw.
   · THE MANIFEST LAW, UNCHANGED. A model resolves through the same manifest
     as a texture, carries the same verbatim licence line, and a
     REFERENCE-ONLY or undisplayable entry throws before it can reach a
     surface.
   · COMPRESSED OR NOT, ONE PATH. A model baked in Blender arrives as 4K PNG
     atlases and weighs ninety megabytes; run through gltfpack it is thirteen,
     with meshopt geometry and ETC1S maps in KTX2. The loader below accepts
     both extensions, and an uncompressed glb loads exactly as it did.

   AND THE HELPER, WHERE THE SOURCE'S OWN MAPS RUN OUT. A prop photographed
   at two thousand texels per metre needs nothing from this museum. A gate,
   a pier, a boulder spreads the same 2K map over several metres and delivers
   a few hundred texels per metre, which is a centimetre per texel: the macro
   band of the empty-plane rule is missing and the object reads as a smooth
   blur at room distance. The fetch tool MEASURES that density off the glTF's
   own uv against its own world area, and a model under the floor carries the
   name of a library set whose macro band is laid over it. The set's own
   photograph is not: the model keeps its own picture, and what it takes is
   the room-scale variation and the density gradient. */

import {
  Box3,
  Color,
  Euler,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardNodeMaterial,
  Object3D,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Material,
  type MeshStandardMaterial,
  type Texture,
  type WebGPURenderer,
} from 'three/webgpu'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import * as TSL from 'three/tsl'
import { detailNodes } from './detail'
import { loadManifest, type ManifestEntry } from '../manifest'
import { ASSET_BASE, textureBytes, type MaterialLibrary } from './materials'
import type { Tier } from './tier'

/** where a body is put, and how it meets the point it is given */
export interface ModelPlacement {
  /** metres, in the scene's own frame */
  position?: [number, number, number]
  /** radians. One number is a turn about the upright axis, which is what a
      wing asks for nine times in ten. */
  rotation?: number | [number, number, number]
  scale?: number | [number, number, number]
  /** `ground` puts the body's own lowest point at the position's height,
      which is what a thing standing on a floor does. `centre` puts its
      middle there, for something hung or floating. `origin` uses the file's
      own origin unchanged. */
  snap?: 'ground' | 'centre' | 'origin'
}

export interface ModelAsset {
  slug: string
  entry: ManifestEntry
  /** the loaded document's root. It is never added to a scene: a placement
      is a clone of it, so one slug is one upload however often it stands. */
  prototype: Object3D
  /** measured off the delivered file, at load */
  tris: number
  /** the body's own size in metres, and where its foot is in its own frame */
  size: Vector3
  floor: number
  /** what its textures hold on the GPU, in megabytes */
  textureMB: number
  /** what the source's own maps deliver, measured off its uv */
  texelsPerMetre: number
  category: string
  periodFit: string
}

export interface ModelLibrary {
  load: (slug: string) => Promise<ModelAsset>
  /** one body of that model, standing where it is told */
  place: (slug: string, at?: ModelPlacement) => Promise<Object3D>
  /** many bodies of it as one draw call per mesh. What a hundred stones,
      a hedge or a gravel scatter costs is then one upload and one draw. */
  scatter: (slug: string, at: ModelPlacement[]) => Promise<Object3D>
  /** every model this app has resolved, which is what the drawer prints */
  manifest: () => ManifestEntry[]
  loaded: () => ModelAsset[]
  /** the triangles the library is HOLDING (a scatter counts its copies) */
  tris: () => number
  textureMB: () => number
  /** every model that asked for its bytes and did not get them */
  missing: () => Array<{ slug: string; reason: string }>
  /** how many models are in flight; a frame drawn over this is a frame with
      a hole in it, so the rig waits on it exactly as it waits for a texture */
  pending: () => number
  setTier: (tier: Tier) => void
  dispose: () => void
}

/* WHAT A TIER MAY HOLD OF A MODEL. The calm tier halves the side of every
   map, the same way the material library does, because one file on disk
   serves every tier: `createImageBitmap` resizes on the decode thread and a
   phone never uploads the 2K it cannot afford. */
export function modelTextureSide(tier: Tier): number {
  return tier.detail >= 2 ? 2048 : 1024
}

/* THE ONE LOADER THE STORE USES, AND THE TWO EXTENSIONS A COMPRESSED EXPORT
   ARRIVES IN. `gltfpack -cc -tc -tq 8` packs the geometry with meshopt and
   the maps as ETC1S inside KTX2; a bare GLTFLoader refuses both and the
   whole document fails, not just its textures. The transcoder is two files
   the KTX2 worker FETCHES at load rather than imports, so they stand in
   `public/basis/` and not in the bundle graph: `basis_transcoder.js` and
   `basis_transcoder.wasm`, Apache License 2.0, from the Basis Universal
   project, delivered with three and copied from its own libs folder. */
const ktx2 = new KTX2Loader().setTranscoderPath(`${import.meta.env.BASE_URL}basis/`)
const loader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder)

/* WHICH GPU FORMAT THE TRANSCODER TARGETS IS A FACT ABOUT THE MACHINE, so it
   is read off the renderer rather than assumed: ETC1S is a container, not a
   format, and what it becomes is BC on this desktop and ETC2 or ASTC on a
   phone. One call covers both backends, because three's WebGPU renderer
   answers `hasFeature` through its WebGL fallback too, and it has to happen
   after `renderer.init()`, which is why the library takes the renderer. Where
   an adapter supports no compressed format at all the transcoder falls back
   to RGBA8 and the picture still arrives. */
export function detectCompressedSupport(renderer: WebGPURenderer): void {
  ktx2.detectSupport(renderer)
}

/* the density under which a source's own maps stop carrying the room-scale
   band. Measured, not chosen by eye: at 400 texels per metre one texel is
   2.5 mm, so a metre of surface holds four hundred samples and the eye at
   two hundred pixels per metre sees the map's own mip and nothing else. */
const COARSE = 400

export function createModelLibrary(
  tier: Tier,
  materials: MaterialLibrary,
  renderer: WebGPURenderer
): ModelLibrary {
  detectCompressedSupport(renderer)
  const held = new Map<string, ModelAsset>()
  const flight = new Map<string, Promise<ModelAsset>>()
  const failed = new Map<string, string>()
  const seen = new Map<string, ManifestEntry>()
  const placed = new Map<string, number>()
  const textures = new Set<Texture>()
  let side = modelTextureSide(tier)
  let count: 1 | 2 | 3 = tier.detail

  async function resolve(slug: string): Promise<ModelAsset> {
    const index = await loadManifest()
    /* a slug that names its own scope resolves as an id: the shared collection
       is `models/<slug>`, and a body built for one wing is recorded in that
       wing's scope, which is where the manifest law puts it */
    const entry = index.byId.get(slug.includes('/') ? slug : `models/${slug}`)
    if (!entry) throw new Error(`no manifest entry for the model "${slug}"`)
    if (!entry.display || entry.class === 'REFERENCE-ONLY') {
      throw new Error(`the model "${slug}" may not be displayed`)
    }
    seen.set(entry.id, entry)
    /* the document is named by the manifest and never guessed here: a
       default written into this file would be an asset reference the check
       cannot resolve, and a model whose record does not say what to open is
       a model with no record */
    const file = entry.gltf?.file
    if (!file) throw new Error(`the model "${slug}" names no document`)
    const gltf = await loader.loadAsync(`${ASSET_BASE}${entry.wing}/${entry.path}${file}`)
    const prototype = gltf.scene as unknown as Object3D
    const measured = dress(prototype, entry)
    const box = new Box3().setFromObject(prototype as never)
    const size = new Vector3()
    box.getSize(size)
    const asset: ModelAsset = {
      slug,
      entry,
      prototype,
      tris: measured.tris,
      size,
      floor: box.min.y,
      textureMB: measured.bytes / (1024 * 1024),
      texelsPerMetre: entry.gltf?.texels_per_m ?? 0,
      category: entry.category ?? 'model',
      periodFit: entry.period_fit ?? 'generic',
    }
    held.set(slug, asset)
    return asset
  }

  /** the document's own materials, put on the stack's own path: every one
      becomes a node material carrying exactly what the glTF gave it, and a
      model whose maps are coarse takes the empty-plane helper's macro band
      over its own picture. */
  function dress(root: Object3D, entry: ManifestEntry): { tris: number; bytes: number } {
    const coarse = (entry.gltf?.texels_per_m ?? Infinity) < COARSE
    const setName = entry.gltf?.detail_set
    const set = coarse && setName ? materials.sync(setName) : null
    const swapped = new Map<Material, MeshStandardNodeMaterial>()
    let tris = 0
    let bytes = 0
    root.traverse((child: Object3D) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      const geometry = mesh.geometry as BufferGeometry
      tris += trianglesOf(geometry)
      const source = mesh.material
      const list = Array.isArray(source) ? source : [source]
      const built = list.map((m) => {
        const already = swapped.get(m)
        if (already) return already
        const next = nodeMaterialFrom(m as MeshStandardMaterial, set, count)
        for (const t of mapsOf(m as MeshStandardMaterial)) {
          if (textures.has(t)) continue
          textures.add(t)
          bytes += mapBytes(t, side)
        }
        swapped.set(m, next)
        return next
      })
      mesh.material = (Array.isArray(source) ? built : built[0]) as never
      mesh.castShadow = true
      mesh.receiveShadow = true
    })
    return { tris, bytes }
  }

  async function get(slug: string): Promise<ModelAsset> {
    const there = held.get(slug)
    if (there) return there
    const inFlight = flight.get(slug)
    if (inFlight) return inFlight
    const pending = resolve(slug).catch((err: Error) => {
      failed.set(slug, err.message)
      flight.delete(slug)
      throw err
    })
    flight.set(slug, pending)
    const asset = await pending
    flight.delete(slug)
    return asset
  }

  return {
    load: get,

    async place(slug, at = {}) {
      const asset = await get(slug)
      const body = asset.prototype.clone(true)
      stand(body, asset, at)
      placed.set(slug, (placed.get(slug) ?? 0) + 1)
      return body
    },

    /* ONE DRAW FOR A HUNDRED. A cloned body is a draw call each, which is
       what a barrel or a bench should be; a gravel scatter, a hedge or a
       stand of grass is hundreds, and the tier's draw budget is sixty on a
       phone. So every mesh of the prototype becomes one InstancedMesh over
       the whole set of placements, and the transforms are baked in the
       prototype's own frame so a model built out of several nodes keeps its
       parts where they were. */
    async scatter(slug, list) {
      const asset = await get(slug)
      const group = new Object3D()
      group.name = `${slug} x${list.length}`
      const worlds = list.map((at) => {
        const holder = new Object3D()
        stand(holder, asset, at)
        holder.updateMatrix()
        return holder.matrix.clone()
      })
      asset.prototype.updateMatrixWorld(true)
      asset.prototype.traverse((child: Object3D) => {
        const mesh = child as Mesh
        if (!mesh.isMesh) return
        const material = mesh.material
        if (Array.isArray(material)) return
        const instanced = new InstancedMesh(mesh.geometry as never, material as never, list.length)
        instanced.castShadow = true
        instanced.receiveShadow = true
        const local = new Matrix4()
        for (let i = 0; i < worlds.length; i++) {
          local.multiplyMatrices(worlds[i] as Matrix4, mesh.matrixWorld)
          instanced.setMatrixAt(i, local)
        }
        instanced.instanceMatrix.needsUpdate = true
        group.add(instanced)
      })
      placed.set(slug, (placed.get(slug) ?? 0) + list.length)
      return group
    },

    manifest: () => [...seen.values()],
    loaded: () => [...held.values()],
    tris: () =>
      [...held.values()].reduce((sum, a) => sum + a.tris * (placed.get(a.slug) ?? 0), 0),
    textureMB: () => [...held.values()].reduce((sum, a) => sum + a.textureMB, 0),
    missing: () => [...failed].map(([slug, reason]) => ({ slug, reason })),
    pending: () => flight.size,

    setTier(next) {
      side = modelTextureSide(next)
      count = next.detail
    },

    dispose() {
      for (const t of textures) t.dispose()
      textures.clear()
      for (const asset of held.values()) {
        asset.prototype.traverse((child: Object3D) => {
          const mesh = child as Mesh
          if (mesh.isMesh) (mesh.geometry as BufferGeometry).dispose()
        })
      }
      held.clear()
      placed.clear()
    },
  }
}

/** put a body where it was told to stand, by its own foot or its own middle */
function stand(body: Object3D, asset: ModelAsset, at: ModelPlacement): void {
  const s = at.scale ?? 1
  if (typeof s === 'number') body.scale.setScalar(s)
  else body.scale.set(s[0], s[1], s[2])
  const r = at.rotation ?? 0
  if (typeof r === 'number') body.rotation.set(0, r, 0)
  else body.rotation.set(r[0], r[1], r[2])
  const p = at.position ?? [0, 0, 0]
  const snap = at.snap ?? 'ground'
  /* the lift is measured in the body's own frame and then scaled, because a
     model scaled to half its size has half as far to rise */
  const lift =
    snap === 'ground'
      ? -asset.floor * body.scale.y
      : snap === 'centre'
        ? -(asset.floor + asset.size.y / 2) * body.scale.y
        : 0
  body.position.set(p[0], p[1] + lift, p[2])
}

function trianglesOf(geometry: BufferGeometry): number {
  const index = geometry.getIndex()
  const position = geometry.getAttribute('position')
  return Math.floor((index ? index.count : (position?.count ?? 0)) / 3)
}

function mapsOf(m: MeshStandardMaterial): Texture[] {
  return [m.map, m.normalMap, m.roughnessMap, m.metalnessMap, m.aoMap, m.alphaMap, m.emissiveMap]
    .filter((t): t is Texture => Boolean(t))
    .filter((t, i, all) => all.indexOf(t) === i)
}

/* WHAT A MAP HOLDS ON THE GPU. An uncompressed one is uploaded as RGBA8 with
   its mip chain and the tier's own cap on its side, which is the library's
   formula. A transcoded KTX2 map is neither: it arrives as GPU blocks that
   cannot be resized, and it carries its own mips, so its cost is the bytes
   that are actually on it. Measured rather than estimated, because the two
   numbers a compressed model has are far apart: a 4K map that costs a
   megabyte and a half in the file holds twenty-one on the GPU, and what the
   drawer prints is what is held. */
function mapBytes(t: Texture, side: number): number {
  const mips = t.mipmaps as Array<{ data?: ArrayBufferView }> | undefined
  if (mips?.length) {
    let sum = 0
    for (const mip of mips) sum += mip?.data?.byteLength ?? 0
    if (sum) return sum
  }
  return textureBytes(Math.min(side, sideOf(t)))
}

function sideOf(t: Texture): number {
  const image = t.image as { width?: number; height?: number } | undefined
  return Math.max(image?.width ?? 1024, image?.height ?? 1024)
}

/* THE ONE PLACE THIS FILE TOUCHES A SHADER. three's renderer will convert a
   classic material to a node material by itself, but it does that inside the
   render and hands nobody the result, so a material converted that way can
   never take a term from this museum. The conversion is therefore done here,
   explicitly, field by field: what comes out carries exactly what the glTF
   put in, and it has slots this stack can write. */
function nodeMaterialFrom(
  source: MeshStandardMaterial,
  set: ReturnType<MaterialLibrary['sync']> | null,
  count: 1 | 2 | 3
): MeshStandardNodeMaterial {
  const next = new MeshStandardNodeMaterial()
  next.name = source.name
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
  next.emissive = (source.emissive ?? new Color(0x000000)).clone()
  next.emissiveMap = source.emissiveMap
  next.emissiveIntensity = source.emissiveIntensity ?? 1
  next.alphaMap = source.alphaMap
  next.transparent = source.transparent
  next.opacity = source.opacity
  next.alphaTest = source.alphaTest
  next.side = source.side
  next.flatShading = source.flatShading
  next.vertexColors = source.vertexColors
  next.depthWrite = source.depthWrite
  next.envMapIntensity = source.envMapIntensity ?? 1
  if (!set) return next
  /* THE HELPER'S MACRO BAND ONLY, AND THE REASON IS THE MODEL'S OWN TRUTH.
     A set's roughness and its relief are the numbers of a photographed
     surface, and writing them onto a model would throw away the maps the
     model came with, which are the better record of what it is. What the
     model lacks at room distance is the band its 2K map is too coarse to
     carry, and that band is a variation around one. So the albedo takes it
     and nothing else does. */
  const nodes = detailNodes(set, { count, maps: 0, space: 'world' })
  next.colorNode = materialAlbedo(next).mul(nodes.albedo)
  return next
}

/** the model's own albedo, as the node graph would have built it: its map
    where it has one, multiplied by its own colour */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function materialAlbedo(m: MeshStandardNodeMaterial): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { texture, vec3 } = TSL as unknown as Record<string, any>
  const base = vec3(m.color.r, m.color.g, m.color.b)
  return m.map ? texture(m.map).rgb.mul(base) : base
}

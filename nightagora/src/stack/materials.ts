/* THE MATERIAL LIBRARY — one loader, one manifest, one class per surface.

   Under the Manifest Law nothing is displayed that cannot say where it came
   from. So a material is never just a set of maps: it is a manifest entry
   with a class (CAPTURED, GENERATED, CC0, ...) and the verbatim licence line
   the museum shows in its evidence drawer, and the loader refuses anything
   marked REFERENCE-ONLY or not displayable.

   The library is CC0 and it is photographed, not authored. Three files per
   set, because a GPU spends four bytes on a texel whatever is in it:

     albedo.jpg    the colour, sRGB
     normal.png    tangent space, OpenGL convention (green points up)
     surface.png   roughness in red, occlusion in green, height in blue

   Every number a set carries was MEASURED off those maps and written into
   the manifest: the mean albedo in linear light, the mean of its darkest
   fifth, the mean roughness. Nothing here is authored, which is why a set
   can stand beside the source's own preview render and be compared.

   THE LAW THIS LOADER OBEYS: a set augments a scene's material and never
   replaces it. What it hands a hand-written shader is a RATIO, the sampled
   albedo over the set's own mean, so the picture arrives and the exposure
   does not move. A plane whose albedo ratio does not average to one is a
   plane the library brightened behind the scene's back. And until the bytes
   are on the GPU the whole term is held at exactly one by `ready`, so a
   scene that draws before its library has landed draws what it was
   authored as. */

import {
  Color,
  LinearSRGBColorSpace,
  MeshStandardNodeMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { applyDetail, type DetailScales } from './detail'
import { loadManifest, type ManifestEntry } from '../manifest'
import type { Tier } from './tier'

export type { AssetClass, ManifestEntry } from '../manifest/schema'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { float, mix, positionWorld, texture, uniform, vec2, vec3 } = TSL as unknown as Record<
  string,
  N
>

/** what one set holds on the GPU. The objects exist from the first frame;
    what arrives later is their pixels. */
export interface MaterialMaps {
  albedo: Texture
  normal: Texture
  surface: Texture
  /** the side of the square the maps were uploaded at */
  size: number
}

/** the set's maps read at one place, as nodes a material can compose */
export interface SampledMaps {
  /** the sampled albedo over the set's own mean: a ratio around 1 */
  albedo: N
  /** the sampled albedo as the source photographed it, linear */
  colour: N
  /** tangent space, unpacked, OpenGL convention */
  normal: N
  roughness: N
  /** 1 where nothing occludes */
  occlusion: N
}

/** where a sample is taken. A uv in metres for a plane; a world position for
    anything instanced through its own vertex path, where three can infer
    neither a uv nor a normal. */
export interface SampleAt {
  uv?: N
  world?: N
  /** metres per tile, one number for a square tile and two for the tiles
      that are not: a 1.8 by 0.9 m brick read as 1.8 square is a brick twice
      as tall as the wall it was photographed on */
  metres?: number | [number, number]
  /** rotate the projection, in radians, which is how a second sample of the
      same photograph stops looking like the same photograph */
  turn?: number
}

/** which family a set belongs to, which is what decides how much of the
    helper's own variation it can carry without losing its own scale */
export type MaterialClass = 'stone' | 'earth' | 'wood' | 'fibre' | 'cloth' | 'paper' | 'metal'

/** the helper's four numbers for one set, already resolved from the class
    default and the manifest's own word */
export interface DetailRecipe {
  /** metres of the macro variation */
  macro: number
  /** how much of the helper's authored swing the macro is worth, 0..1 */
  macroContrast: number
  /** metres of the mid band; 0 where the set carries none */
  mid: number
  /** how much of the micro roughness noise this set is worth, 0..1 */
  micro: number
}

export interface MaterialSet {
  name: string
  /** what a square metre of this reads as, measured off the albedo map */
  albedo: Color
  /** and what its darkest fifth reads as: the joint, the vein, the shadow */
  variation: Color
  roughness: number
  metalness: number
  /** metres of the macro, mid and micro features */
  scales: [number, number, number]
  normalStrength: number
  /** how strongly the density gradient thins the detail with distance */
  falloff: number
  /** the real-world size of one tile of the source photograph */
  metres: [number, number]
  /** the size the museum lays one tile at: `metres` unless the manifest
      declares a `scale_m` of its own */
  scale: [number, number]
  cls: MaterialClass
  detail: DetailRecipe
  entry: ManifestEntry
  /** the textures, from the first frame; null only for a set the manifest
      does not name */
  maps: MaterialMaps | null
  /** 0 until the pixels are on the GPU, then 1. Every term the library adds
      is gated on it. */
  ready: N
  /** the set's own maps at one place */
  sample: (at?: SampleAt) => SampledMaps
  /** the set as a lit material, with the empty-plane helper already on it */
  material: (opts?: DetailScales) => MeshStandardNodeMaterial
}

/* WHERE THE BYTES STAND. Production reads the media origin; a dev server and
   a preview server both serve the store themselves through the asset plugin.
   The preview check is on the HOSTNAME rather than on the build mode, because
   a production bundle previewed on localhost is exactly what the cost gate
   measures, and pointing it at a CDN that does not hold the library yet would
   make every texture reading in that gate a zero. A deployed bundle is never
   on localhost. */
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)
export const ASSET_BASE: string =
  (import.meta.env['VITE_NA_ASSET_BASE'] as string | undefined) ??
  (import.meta.env.DEV || LOCAL ? '/na-assets/' : 'https://media.agoracosmica.org/night/')

/* WHAT THE HELPER MAY LAY OVER A CLASS. The macro variation is invisible on
   quarried stone and it is the whole surface on a weave: a 7 to 10 cm mottle
   at full contrast reads as mould on linen, as camouflage on iron and as
   nothing at all on gravel. So its contrast and its scale come from the
   material's family, and a metal carries none of it: what varies across a
   sheet of gold is what the sheet reflects, not a noise field. */
const CLASS_DETAIL: Record<MaterialClass, DetailRecipe> = {
  stone: { macro: 2.4, macroContrast: 1, mid: 0.42, micro: 1 },
  earth: { macro: 1.5, macroContrast: 1, mid: 0.32, micro: 1 },
  wood: { macro: 1.5, macroContrast: 0.5, mid: 0.3, micro: 0.7 },
  fibre: { macro: 0.6, macroContrast: 0.5, mid: 0.09, micro: 1 },
  cloth: { macro: 1.5, macroContrast: 0.95, mid: 0, micro: 1 },
  paper: { macro: 1.5, macroContrast: 0.85, mid: 0, micro: 1 },
  metal: { macro: 4, macroContrast: 0.35, mid: 0.18, micro: 0.15 },
}

/* WHAT A PHOTOGRAPH DOES NOT ANSWER. Which family the set belongs to, how far
   apart the three scales stand, how much relief this surface's normal is
   worth, how fast the density gradient thins it, and whether it is a metal.
   Everything else is measured.

   These are also what a set is worth BEFORE its manifest lands: a scene built
   in a constructor takes the library synchronously and cannot wait for a
   fetch. The manifest's own `detail` block is the record and it refines the
   same four numbers; the two are held equal on purpose, so the two paths
   never disagree about what a set looks like. */
interface Recipe {
  cls: MaterialClass
  scales: [number, number, number]
  normalStrength: number
  falloff: number
  metalness: number
  macroContrast?: number
  micro?: number
}
const DEFAULT_RECIPE: Recipe = {
  cls: 'stone',
  scales: [2.4, 0.42, 0.035],
  normalStrength: 0.45,
  falloff: 1,
  metalness: 0,
}
const RECIPES: Record<string, Partial<Recipe>> = {
  'marble-white': {
    cls: 'stone',
    scales: [2.4, 0.42, 0.035],
    normalStrength: 0.3,
    macroContrast: 0.25,
    micro: 0.45,
  },
  'marble-lapis': { cls: 'stone', scales: [2.4, 0.42, 0.035], normalStrength: 0.35, micro: 0.6 },
  'limestone-pale': { cls: 'stone', scales: [1.8, 0.36, 0.028], normalStrength: 0.55, falloff: 1.2 },
  'stone-tuffeau': { cls: 'stone', scales: [2.0, 0.5, 0.03], normalStrength: 0.6, falloff: 1.2 },
  'brick-old-red': { cls: 'stone', scales: [1.8, 0.45, 0.03], normalStrength: 0.8, macroContrast: 0.9 },
  'slate-roof': { cls: 'stone', scales: [3.0, 0.4, 0.04], normalStrength: 0.9, macroContrast: 0.45, micro: 0.8 },
  'terracotta-tiles': { cls: 'stone', scales: [2.08, 0.52, 0.03], normalStrength: 0.6, macroContrast: 0.9 },
  'plaster-lime-aged': { cls: 'stone', scales: [1.6, 0.3, 0.02], normalStrength: 0.5 },
  'bronze-dark': { cls: 'metal', scales: [0.9, 0.18, 0.014], normalStrength: 0.28, metalness: 1 },
  'iron-forged': { cls: 'metal', scales: [0.8, 0.16, 0.012], normalStrength: 0.4, metalness: 1 },
  'gold-leaf': { cls: 'metal', scales: [0.6, 0.12, 0.01], normalStrength: 0.25, metalness: 1, micro: 0.1 },
  'oak-planks-worn': { cls: 'wood', scales: [1.5, 0.3, 0.02], normalStrength: 0.6 },
  'oak-beams': { cls: 'wood', scales: [1.0, 0, 0.02], normalStrength: 0.8 },
  'canvas-raw': { cls: 'cloth', scales: [1.5, 0, 0.006], normalStrength: 0.7, falloff: 0.7 },
  linen: { cls: 'cloth', scales: [1.5, 0, 0.008], normalStrength: 0.6, falloff: 0.7 },
  'wool-cloth': { cls: 'cloth', scales: [1.5, 0, 0.008], normalStrength: 0.7, falloff: 0.7 },
  'leather-worn': {
    cls: 'cloth',
    scales: [1.5, 0, 0.01],
    normalStrength: 0.5,
    falloff: 0.8,
    macroContrast: 0.95,
    micro: 1,
  },
  'parchment-laid': { cls: 'paper', scales: [1.5, 0, 0.008], normalStrength: 0.35, falloff: 0.7 },
  rope: { cls: 'fibre', scales: [0.4, 0.09, 0.007], normalStrength: 0.9, falloff: 0.7 },
  'earth-packed': { cls: 'earth', scales: [1.4, 0.32, 0.025], normalStrength: 0.7 },
  gravel: { cls: 'earth', scales: [1.6, 0.34, 0.025], normalStrength: 0.9 },
  'grass-short': {
    cls: 'earth',
    scales: [1.4, 0.28, 0.02],
    normalStrength: 0.6,
    macroContrast: 0.7,
    micro: 0.8,
  },
}

/* WHAT EACH TIER MAY HOLD. One map at 2048 square is 22 MB with its mip
   chain, and the calm tier's whole texture budget is 96 MB. So the tier
   decides the side of the square AND which maps are worth uploading: at one
   scale of detail nothing reads the normal or the surface, and a texture no
   shader samples is memory a phone pays for and a visitor never sees. */
export interface TextureBudget {
  size: number
  maps: Array<'albedo' | 'normal' | 'surface'>
}
export function texturesFor(tier: Tier): TextureBudget {
  if (tier.detail >= 3) return { size: 2048, maps: ['albedo', 'normal', 'surface'] }
  if (tier.detail === 2) return { size: 2048, maps: ['albedo', 'normal'] }
  return { size: 1024, maps: ['albedo'] }
}

/** what a square texture and its mip chain cost on the GPU, in bytes */
export function textureBytes(size: number): number {
  return size * size * 4 * (4 / 3)
}

function generatedEntry(name: string): ManifestEntry {
  return {
    id: `library/${name}`,
    path: `${name}/`,
    class: 'GENERATED',
    licence: 'Generated for this work, regenerable from its recipe',
    wing: 'library',
    display: true,
    prompt: `procedural stand-in for the set "${name}", which no manifest names`,
    model: 'procedural',
  }
}

export interface MaterialLibrary {
  load: (name: string) => Promise<MaterialSet>
  /** the set as an object, at once, for a material built inside a scene's
      constructor. Its textures exist from that moment and its pixels arrive
      later, so the shader is compiled once and never rebuilt. */
  sync: (name: string) => MaterialSet
  /** every entry the app has resolved, which is what the drawer prints */
  manifest: () => ManifestEntry[]
  /** what the loaded sets hold on the GPU, in megabytes */
  textureMB: () => number
  /** every set that asked for its bytes and did not get them */
  missing: () => Array<{ name: string; reason: string }>
  /** how many sets have asked for their bytes and are still waiting. A
      frame drawn while a set is in flight is a DIFFERENT frame, so the rig
      waits on this rather than on a guessed delay */
  pending: () => number
  setTier: (tier: Tier) => void
  dispose: () => void
}

/** a one-texel stand-in with the value that means "this map says nothing" */
function placeholder(rgb: [number, number, number], srgb: boolean): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
    ctx.fillRect(0, 0, 1, 1)
  }
  const tex = new Texture(canvas)
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.colorSpace = srgb ? SRGBColorSpace : LinearSRGBColorSpace
  tex.flipY = false
  tex.needsUpdate = true
  return tex
}

/** the pixels, at the side this tier holds them at. `createImageBitmap`
    resizes on the decode thread, so one file on disk serves every tier. */
async function fill(tex: Texture, url: string, size: number): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  const bitmap = await createImageBitmap(await res.blob(), {
    imageOrientation: 'flipY',
    resizeWidth: size,
    resizeHeight: size,
    resizeQuality: 'high',
  })
  tex.image = bitmap
  tex.anisotropy = 8
  tex.generateMipmaps = true
  tex.needsUpdate = true
}

export function createMaterialLibrary(tier: Tier): MaterialLibrary {
  const sets = new Map<string, MaterialSet>()
  const seen = new Map<string, ManifestEntry>()
  const held: Texture[] = []
  let remote: Map<string, ManifestEntry> | null = null
  const missing = new Map<string, string>()
  let budget = texturesFor(tier)
  let bytes = 0

  async function manifestOnce(): Promise<Map<string, ManifestEntry>> {
    if (remote) return remote
    remote = (await loadManifest()).byId
    return remote
  }

  /* THE PLANE A SET IS PROJECTED ON. A material instanced through its own
     vertex path has no uv three can trust, so the sample is taken from the
     world position straight down. One divide instead of a triplanar's three
     fetches per map; a wing that needs the sides of a rock can pass its own
     uv. */
  function planarUV(world: N | undefined): N {
    return (world ?? positionWorld).xz
  }

  /** a turn of the projection, so a second read of the same photograph at
      another size does not land on the first one's own grid */
  function turned(base: N, turn: number): N {
    if (!turn) return base
    const c = Math.cos(turn)
    const s = Math.sin(turn)
    return vec2(base.x.mul(c).sub(base.y.mul(s)), base.x.mul(s).add(base.y.mul(c)))
  }

  /** the one function that turns a manifest entry into pixels, per set */
  const resolvers = new Map<string, (entry: ManifestEntry | undefined) => Promise<void>>()

  function build(name: string): MaterialSet {
    const recipe = { ...DEFAULT_RECIPE, ...RECIPES[name] }
    const maps: MaterialMaps = {
      albedo: placeholder([128, 128, 128], true),
      normal: placeholder([128, 128, 255], false),
      surface: placeholder([128, 255, 128], false),
      size: budget.size,
    }
    const ready = uniform(0)
    /* the reciprocal of the set's own mean, as a uniform rather than a
       constant: the manifest may land after the shader is compiled, and the
       one number that must never be stale is the one the ratio divides by */
    const invMean = uniform(vec3(1, 1, 1))
    const rough = uniform(recipe.metalness > 0.5 ? 0.4 : 0.6)
    const tint = uniform(vec3(1, 1, 1))
    /* the set's own turn, as cosine and sine, and the sign of its green
       channel. Both are uniforms for the same reason the mean is: a scene
       built in a constructor compiles its shader before the manifest lands,
       and a stale turn or a stale convention is a wall lit from the wrong
       side with nothing in the frame to say so. */
    const spin = uniform(vec2(1, 0))
    const greenY = uniform(1)

    const set: MaterialSet = {
      name,
      albedo: new Color('#8a8a86'),
      variation: new Color('#5c5c58'),
      roughness: 0.6,
      metalness: recipe.metalness,
      scales: recipe.scales,
      normalStrength: recipe.normalStrength,
      falloff: recipe.falloff,
      metres: [1, 1],
      scale: [1, 1],
      cls: recipe.cls,
      detail: {
        macro: recipe.scales[0],
        macroContrast: recipe.macroContrast ?? CLASS_DETAIL[recipe.cls].macroContrast,
        mid: recipe.scales[1],
        micro: recipe.micro ?? CLASS_DETAIL[recipe.cls].micro,
      },
      entry: generatedEntry(name),
      maps,
      ready,

      sample(at = {}) {
        const size = at.metres ?? set.scale
        const tile = typeof size === 'number' ? [size, size] : size
        const flat = turned(at.uv ?? planarUV(at.world), at.turn ?? 0)
        const uv = vec2(
          flat.x.mul(spin.x).sub(flat.y.mul(spin.y)),
          flat.x.mul(spin.y).add(flat.y.mul(spin.x))
        ).div(vec2(tile[0], tile[1]))
        const colour = texture(maps.albedo, uv).rgb.mul(tint)
        const surface = texture(maps.surface, uv)
        const packed = texture(maps.normal, uv).rgb.mul(2).sub(1)
        return {
          albedo: mix(vec3(1, 1, 1), colour.mul(invMean), ready),
          colour,
          normal: mix(vec3(0, 0, 1), vec3(packed.x, packed.y.mul(greenY), packed.z), ready),
          roughness: mix(rough, surface.r, ready),
          occlusion: mix(float(1), surface.g, ready),
        }
      },

      material(opts = {}) {
        const mat = new MeshStandardNodeMaterial({
          color: set.albedo,
          roughness: set.roughness,
          metalness: set.metalness,
        })
        applyDetail(mat, set, opts)
        return mat
      },
    }

    /** the manifest's word, applied to the numbers the shader already reads */
    function adopt(entry: ManifestEntry): void {
      set.entry = entry
      seen.set(entry.id, entry)
      const m = entry.measured
      if (m) {
        set.albedo = new Color(m.albedo)
        set.variation = new Color(m.variation)
        set.roughness = m.roughness
      }
      if (entry.metres) set.metres = entry.metres
      /* the museum's own word about how the set is laid, over the record of
         how it was photographed */
      set.scale = entry.scale_m ?? set.metres
      if (entry.orientation) {
        const turn = (entry.orientation * Math.PI) / 180
        spin.value.set(Math.cos(turn), Math.sin(turn))
      }
      greenY.value = entry.normal_y === 'flip' ? -1 : 1
      if (entry.detail) {
        set.detail = {
          macro: entry.detail.macro_cm / 100,
          macroContrast: entry.detail.macro_contrast,
          mid: entry.detail.mid_cm / 100,
          micro: entry.detail.micro,
        }
        set.scales = [set.detail.macro, set.detail.mid, set.scales[2]]
      }
      if (entry.tint) {
        /* a tint is a colour and never an exposure: it is normalised to its
           own luminance, so the stone leans and the room does not brighten.
           The lean cancels exactly out of the ratio a hand-written material
           reads, which is the point: the museum's own colour graph keeps its
           say, and only a surface that takes the whole set as its material
           takes the whole lean. */
        const t = new Color(entry.tint)
        const k = 1 / luminance(t)
        const w = entry.tintStrength ?? 1
        const lean = (v: number): number => 1 + (v * k - 1) * w
        tint.value.set(lean(t.r), lean(t.g), lean(t.b))
        set.albedo.setRGB(
          set.albedo.r * lean(t.r),
          set.albedo.g * lean(t.g),
          set.albedo.b * lean(t.b)
        )
        set.variation.setRGB(
          set.variation.r * lean(t.r),
          set.variation.g * lean(t.g),
          set.variation.b * lean(t.b)
        )
      }
      invMean.value.set(1 / lin(set.albedo.r), 1 / lin(set.albedo.g), 1 / lin(set.albedo.b))
      rough.value = set.roughness
    }

    async function attach(entry: ManifestEntry): Promise<void> {
      if (entry.class === 'GENERATED') return
      const has = (m: string): boolean => (entry.maps ?? []).includes(m)
      const url = (file: string, ext: string): string =>
        `${ASSET_BASE}${entry.wing}/${entry.path}${file}.${ext}`
      const jobs: Array<Promise<void>> = [fill(maps.albedo, url('albedo', 'jpg'), budget.size)]
      let count = 1
      if (has('normal') && budget.maps.includes('normal')) {
        jobs.push(fill(maps.normal, url('normal', 'png'), budget.size))
        count++
      }
      if (has('surface') && budget.maps.includes('surface')) {
        jobs.push(fill(maps.surface, url('surface', 'png'), budget.size))
        count++
      }
      await Promise.all(jobs)
      maps.size = budget.size
      bytes += count * textureBytes(budget.size)
      held.push(maps.albedo, maps.normal, maps.surface)
      ready.value = 1
    }

    resolvers.set(name, async (entry) => {
      if (!entry) return
      if (!entry.display || entry.class === 'REFERENCE-ONLY') {
        throw new Error(`material set "${name}" may not be displayed`)
      }
      adopt(entry)
      await attach(entry)
    })
    seen.set(set.entry.id, set.entry)
    sets.set(name, set)
    return set
  }

  async function load(name: string): Promise<MaterialSet> {
    const set = sets.get(name) ?? build(name)
    if (!set.ready.value) {
      try {
        await resolvers.get(name)?.((await manifestOnce()).get(`library/${name}`))
      } catch (err) {
        missing.set(name, (err as Error).message)
        throw err
      }
    }
    return set
  }

  function sync(name: string): MaterialSet {
    const cached = sets.get(name)
    if (cached) return cached
    const set = build(name)
    /* a set whose bytes never arrive leaves `ready` at zero, and every term
       the library adds is gated on it: the scene draws exactly as it was
       authored. It says so once and does not throw, because a missing CDN is
       not a reason for a museum to go dark. */
    void manifestOnce()
      .then((index) => resolvers.get(name)?.(index.get(`library/${name}`)))
      .catch((err: Error) => {
        missing.set(name, err.message)
        console.warn(`library/${name} was not loaded: ${err.message}`)
      })
    return set
  }

  return {
    load,
    sync,
    manifest: () => [...seen.values()],
    textureMB: () => bytes / (1024 * 1024),
    missing: () => [...missing].map(([name, reason]) => ({ name, reason })),
    pending: () => [...sets.values()].filter((set) => !set.ready.value && !missing.has(set.entry.id.replace(/^library\//, ''))).length,
    setTier(next) {
      budget = texturesFor(next)
    },
    dispose() {
      for (const t of held) t.dispose()
      held.length = 0
      bytes = 0
    },
  }
}

function luminance(c: Color): number {
  return Math.max(1e-4, 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b)
}
/** three already holds a Color in linear working space; the guard is only
    against a black channel dividing the ratio by zero */
function lin(v: number): number {
  return Math.max(1e-3, v)
}

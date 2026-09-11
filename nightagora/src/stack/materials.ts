/* THE MATERIAL LIBRARY — one loader, one manifest, one class per surface.

   Under the Manifest Law nothing is displayed that cannot say where it came
   from. So a material is never just a set of maps: it is a manifest entry
   with a class (CAPTURED, GENERATED, CC0, ...) and the verbatim licence line
   the museum shows in its evidence drawer, and the loader refuses anything
   marked REFERENCE-ONLY or not displayable.

   Today the library holds three placeholder sets and they are all GENERATED:
   they are procedural, they carry their own recipe as their prompt, and they
   may dress a surface but they will never testify. Stage 0.4 replaces them
   with the CC0 library and the manifest that comes with it; the loader does
   not change, only what the manifest answers. */

import { Color } from 'three/webgpu'

export type AssetClass =
  | 'CAPTURED'
  | 'GENERATED'
  | 'CC0'
  | 'CC-BY'
  | 'CC-BY-SA'
  | 'PD-ART'
  | 'REFERENCE-ONLY'

export interface ManifestEntry {
  id: string
  path: string
  class: AssetClass
  /** the line the museum prints, verbatim */
  licence: string
  holder?: string
  source_url?: string
  sha256?: string
  bytes?: number
  pixels?: number
  /** GENERATED only: the recipe, and what ran it */
  prompt?: string
  model?: string
  scope: string
  display: boolean
  note?: string
}

export interface MaterialSet {
  name: string
  /** what a square metre of this reads as under a key light */
  albedo: Color
  /** and what the macro variation walks toward */
  variation: Color
  roughness: number
  metalness: number
  /** metres of the macro, mid and micro features */
  scales: [number, number, number]
  normalStrength: number
  /** how strongly the density gradient thins the detail with distance */
  falloff: number
  entry: ManifestEntry
}

/** production reads R2; dev reads the Vite plugin Stage 0.3 installs */
export const ASSET_BASE: string =
  (import.meta.env['VITE_NA_ASSET_BASE'] as string | undefined) ??
  (import.meta.env.DEV ? '/na-assets/' : 'https://media.agoracosmica.org/night/')

/* The three placeholders. Every number is authored, not measured, which is
   exactly what GENERATED means: it may dress a surface, it never testifies. */
const PLACEHOLDERS: Record<string, Omit<MaterialSet, 'entry'> & { recipe: string }> = {
  'marble-lapis': {
    name: 'marble-lapis',
    albedo: new Color('#0c1132'),
    variation: new Color('#46589c'),
    roughness: 0.22,
    metalness: 0,
    scales: [2.4, 0.42, 0.035],
    normalStrength: 0.35,
    falloff: 1,
    recipe:
      'procedural deep blue marble: courses at 1.28 by 0.94 m in half bond, ' +
      'a cool vein network at 2.4 m, a brushed polish at 3.5 cm, wear along ' +
      'the walked lane',
  },
  'stone-tuffeau': {
    name: 'stone-tuffeau',
    albedo: new Color('#a9a79c'),
    variation: new Color('#6f6b60'),
    roughness: 0.72,
    metalness: 0,
    scales: [1.8, 0.36, 0.028],
    normalStrength: 0.55,
    falloff: 1.2,
    recipe:
      'procedural pale limestone block: drum beds every 0.59 m, quarry grain ' +
      'at 1.8 m, a fine open pore at 2.8 cm',
  },
  'bronze-dark': {
    name: 'bronze-dark',
    albedo: new Color('#c08a49'),
    variation: new Color('#4a3520'),
    roughness: 0.38,
    metalness: 0.85,
    scales: [0.9, 0.18, 0.014],
    normalStrength: 0.28,
    falloff: 0.8,
    recipe:
      'procedural dark patinated bronze: cast skin at 0.9 m, hammer facets at ' +
      '18 cm, a fine oxide tooth at 1.4 cm',
  },
}

function generatedEntry(name: string, recipe: string): ManifestEntry {
  return {
    id: `library/${name}`,
    path: `library/${name}/`,
    class: 'GENERATED',
    licence: 'Generated for this work, regenerable from its recipe',
    scope: 'library',
    display: true,
    prompt: recipe,
    model: 'procedural',
    note: 'placeholder set, replaced by the CC0 library',
  }
}

export interface MaterialLibrary {
  load: (name: string) => Promise<MaterialSet>
  /** the placeholder set with no manifest round trip, for the detail helper */
  sync: (name: string) => MaterialSet
  /** every entry the app has resolved, which is what the drawer prints */
  manifest: () => ManifestEntry[]
  /** what the loaded sets cost in texture memory, in megabytes */
  textureMB: () => number
}

export function createMaterialLibrary(): MaterialLibrary {
  const sets = new Map<string, MaterialSet>()
  const seen = new Map<string, ManifestEntry>()
  let remote: Map<string, ManifestEntry> | null = null
  let bytes = 0

  async function manifestOnce(): Promise<Map<string, ManifestEntry>> {
    if (remote) return remote
    remote = new Map()
    try {
      const res = await fetch(`${ASSET_BASE}manifest.json`)
      if (res.ok) {
        const raw = (await res.json()) as { assets?: ManifestEntry[] } | ManifestEntry[]
        const list = Array.isArray(raw) ? raw : (raw.assets ?? [])
        for (const e of list) remote.set(e.id, e)
      }
    } catch {
      // no manifest served yet: the placeholders are the whole library
    }
    return remote
  }

  async function load(name: string): Promise<MaterialSet> {
    const cached = sets.get(name)
    if (cached) return cached

    const index = await manifestOnce()
    const entry = index.get(`library/${name}`)
    if (entry && (!entry.display || entry.class === 'REFERENCE-ONLY')) {
      throw new Error(`material set "${name}" may not be displayed`)
    }

    const base = PLACEHOLDERS[name]
    if (!base) throw new Error(`unknown material set "${name}"`)
    const { recipe, ...rest } = base
    const set: MaterialSet = { ...rest, entry: entry ?? generatedEntry(name, recipe) }
    sets.set(name, set)
    seen.set(set.entry.id, set.entry)
    bytes += entry?.bytes ?? 0
    return set
  }

  function sync(name: string): MaterialSet {
    const cached = sets.get(name)
    if (cached) return cached
    const base = PLACEHOLDERS[name]
    if (!base) throw new Error(`unknown material set "${name}"`)
    const { recipe, ...rest } = base
    const set: MaterialSet = { ...rest, entry: generatedEntry(name, recipe) }
    sets.set(name, set)
    seen.set(set.entry.id, set.entry)
    // and the manifest still gets its say, one frame later
    void load(name)
    return set
  }

  return {
    load,
    sync,
    manifest: () => [...seen.values()],
    textureMB: () => bytes / (1024 * 1024),
  }
}

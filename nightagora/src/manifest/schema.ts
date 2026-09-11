/* THE MANIFEST — one entry per asset, and the law that nothing is shown
   which cannot say where it came from.

   The entries live outside this repository, in the arm's own asset store,
   one `manifest.json` per scope (the lobby, the shared library, each wing).
   A build step merges them into one file the app fetches once; the bytes
   themselves are served from the media origin, never from the bundle.

   Three rules the type enforces and the check enforces the rest of:

   · a GENERATED asset carries its recipe, what ran it and when, or it is
     not shown. `record: 'open'` is the one honest exception: an inherited
     asset whose production record is held elsewhere. It is counted and
     named in every gate report, and a wing may never carry one.
   · REFERENCE-ONLY and `display: false` never reach a surface. The loader
     throws and the check fails the build before the loader ever runs.
   · the licence line is verbatim: what the museum prints in its evidence
     drawer is the string in this file, not a summary of it. */

export type AssetClass =
  | 'CAPTURED'
  | 'GENERATED'
  | 'CC0'
  | 'CC-BY'
  | 'CC-BY-SA'
  | 'PD-ART'
  | 'REFERENCE-ONLY'

/** the classes that may carry a green (documented) label: the truth itself,
    and a photograph of a work old enough to be nobody's property */
export const TESTIFYING: readonly AssetClass[] = ['CAPTURED', 'PD-ART']

/** the scope an asset belongs to: a wing's slug, or the two shared stores */
export type Scope = string

export interface ManifestEntry {
  /** `<scope>/<name>`, unique across the whole museum */
  id: string
  /** relative to the asset base, `*` where one entry names a family */
  path: string
  class: AssetClass
  /** the line the museum prints, verbatim */
  licence: string
  holder?: string
  source_url?: string
  /** of the file on disk; absent for a family, a procedural set or a
      remote asset, and the check says which */
  sha256?: string
  bytes?: number
  pixels?: number
  tris?: number
  /** GENERATED only, and all three or none */
  prompt?: string
  model?: string
  date?: string
  /** the wing's slug, or `lobby`, or `library` */
  wing: Scope
  /** false forces REFERENCE-ONLY handling: never displayed, never textured */
  display: boolean
  /** an inherited asset whose production record is held elsewhere. Named in
      every gate report; a wing scope may not use it */
  record?: 'open'
  note?: string

  /* WHAT A MATERIAL SET ADDS. A set is a folder, so its entry is a family
     entry, and these five fields are what the loader needs that a licence
     line cannot say. They are written by the fetch tool from the source's
     own metadata and from the maps themselves, never by hand. */

  /** the real-world size of one tile of the source photograph, in metres */
  metres?: [number, number]
  /** which maps the folder holds */
  maps?: string[]
  /** which one-channel maps ride in surface.png, in r, g, b order */
  packed?: string[]
  /** measured off the maps: the mean albedo in linear light written back as
      sRGB, the mean of its darkest fifth, and the mean of the two data
      channels. A set that says what it is has no authored numbers left. */
  measured?: {
    albedo: string
    variation: string
    roughness: number
    occlusion: number
  }
  /** a colour the loader leans the albedo toward, declared here so the drawer
      can say that the museum's stone is not the source's colour, and how far
      from it. A hex can only say which way; `tintStrength` says how far, and
      1 is the whole lean. */
  tint?: string
  tintStrength?: number
}

export interface Manifest {
  assets: ManifestEntry[]
}

/** the merged manifest, written by the asset plugin, served from the app's
    own origin: the record travels with the code, the bytes with the CDN */
export const MANIFEST_URL = '/na-manifest.json'

/** may this entry be put on a surface at all */
export const displayable = (e: ManifestEntry): boolean =>
  e.display && e.class !== 'REFERENCE-ONLY'

/** may a label anchored on this class say "documented" */
export const mayTestify = (c: AssetClass | 'procedural'): boolean =>
  c === 'procedural' || TESTIFYING.includes(c)

/** a family entry names many files with one `*`; this matches a path or a
    URL against it without pulling in a glob library for one character */
export function matchesPath(pattern: string, candidate: string): boolean {
  if (!pattern.includes('*')) return pattern === candidate
  const parts = pattern.split('*')
  const head = parts[0] ?? ''
  const tail = parts.slice(1).join('*')
  return (
    candidate.length >= head.length + tail.length &&
    candidate.startsWith(head) &&
    candidate.endsWith(tail)
  )
}

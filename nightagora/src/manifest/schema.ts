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

  /* WHAT THE MUSEUM DECIDES, DECLARED. `metres` above is the record: the size
     the source photographed. The three below are the museum's own word about
     how the set is laid, and they live here rather than in the code so the
     drawer can print them beside the licence line. */

  /** the world size one tile is laid at, when that is not the size the source
      photographed (an ashlar cut to the house's own course, say) */
  scale_m?: [number, number]
  /** degrees the projection is turned by before the set is read: the grain of
      a beam runs along the beam, not up the wall it was photographed on */
  orientation?: number
  /** `flip` inverts the normal map's green channel, for a set published in
      the DirectX convention. A flipped green lights every joint from the
      wrong side and nothing else in a frame says so. */
  normal_y?: 'keep' | 'flip'
  /** what the empty-plane helper may lay over this set. A macro mottle at
      full contrast is invisible on quarried stone and it is the whole surface
      on a weave, so the term belongs to the material and not to the stack.
      `macro_contrast` and `micro` are fractions of the helper's own swing. */
  detail?: {
    macro_cm: number
    macro_contrast: number
    /** 0 when the set carries no mid band of its own */
    mid_cm: number
    micro: number
  }
  /** the museum's own floor under the roughness the source measured. A
      building limestone photographed honed measures 0.037, which renders as
      polished travertine with a mirror in it; the floor is what the same
      stone is when it is a wall. `measured.roughness` stays the record. */
  roughness_floor?: number
  /** metres of the mask that breaks a visible tile repeat. A half-metre tile
      laid across a two-metre plane stamps the same knot sixteen times; a
      second read of the map, turned and at another size, chosen by a mask
      this coarse, removes the lattice. Absent leaves the tiling alone. */
  detile_m?: number
  /* WHAT A MODEL ADDS. A model is a folder too, so its entry is a family
     entry, and these five say what a licence line cannot: how big the thing
     is, where its foot stands, what a wing asks for it by, whether the
     period could have held it, and how coarse its own maps are. All of them
     except the last two are MEASURED off the delivered glTF and its buffer,
     never taken from the catalogue's claim about the source. */

  /** the body's own size in metres, x by y by z, y upright */
  bounds_m?: [number, number, number]
  /** the y of its lowest point in its own frame, so a loader can put its
      foot on the ground rather than its origin */
  floor_m?: number
  /** what a wing asks for it by: door, barrel, tool, shrub, rock */
  category?: string
  /** one line saying what the thing IS, in the museum's own words rather
      than the catalogue's. Several of the source's assets are SETS laid out
      over their whole bounds (a row of small plants, a cooper's yard of
      staves and hoops) rather than one body, and a wing that places one
      believing it is a single bush gets a row. So the line says so. */
  role?: string
  /** one word of honesty about the period a wing puts it in. `generic` is a
      thing with no period in it either way: a stone, a stump, a plank. */
  period_fit?: 'plausible-1517' | 'modern' | 'generic'
  /* named `gltf` and not `model`: `model` is already taken, by the GENERATED
     class, for what produced an image. */
  gltf?: {
    /** the document inside the folder, relative to it */
    file: string
    /** the resolution of the set that was taken, `2k` unless the 2K set was
        over the size cap and the 1K set was taken instead */
    resolution: string
    maps: string[]
    /** what the source's own maps deliver, measured off the file's own uv
        against its own world area. Under a few hundred, one texel is a
        centimetre and the room-scale band of the empty-plane rule is simply
        not in the picture. */
    texels_per_m: number
    /** the library set whose macro band is laid over this model where its
        own maps are too coarse to carry one. Declared for every model; only
        read for the coarse ones, so the decision stays a measurement. */
    detail_set?: string
  }

  /** THE BAND A PHOTOGRAPH CANNOT GIVE. A weave is far finer than the plane
      it is laid on can resolve: linen's is 0.7 mm, a sixth of a pixel at the
      distance a wall is read from, so the map averages to its own mean and
      the surface goes to flat colour. What the eye reads on a hanging cloth
      at that distance is the drape, not the weave: a fold, a slub run, a
      crease, a chain line, a grain wave. A soft set declares its own here. */
  grain?: {
    kind: 'ridges' | 'knit' | 'creases' | 'laid' | 'wave' | 'grit'
    /** centimetres between one ridge, row, crease or chain line and the next */
    pitch_cm: number
    /** degrees the run of the field makes with the tile's own u axis */
    angle: number
    /** how much relief it carries, 0..1 */
    relief: number
    /** how much of it reaches the albedo, 0..1 */
    shade: number
    /** how far the roughness swings across it, 0..1 */
    sheen: number
    /** centimetres of the drape above it; 0 for none */
    fold_cm: number
    /** centimetres of the tooth under it; 0 for none */
    tooth_cm: number
  }
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

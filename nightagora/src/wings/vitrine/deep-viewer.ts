/** THE DEEP VIEWER, fetched only when a visitor asks for the whole plate.
 *
 * A painting is seen as closely as its reproduction allows through a tile
 * pyramid, which one texture cannot carry. The library that draws it stands
 * behind one dynamic import, so a visitor who never opens a whole plate
 * never downloads it, and the museum's own entry chunk does not grow.
 *
 * The tile source is built here from the store's own record. The museum
 * never fetches an `info.json`: the record travels in the bundle, so a
 * deploy cannot quote a pyramid it did not carry, and a development id can
 * never differ from the one production serves.
 */

/** The library itself: a callable namespace, so its types are read through
 * the module rather than imported. */
export type DeepViewerLibrary = typeof import('openseadragon')
export type DeepViewer = import('openseadragon').Viewer
export type DeepViewerRect = import('openseadragon').Rect
export type DeepViewerPoint = import('openseadragon').Point

let loading: Promise<DeepViewerLibrary> | null = null

/** One import for the page's whole life. A UMD build reaches an ES module
 * as a namespace with the library on `default`; a bundler that hands it
 * over directly is answered by the same line. */
export function loadDeepViewer(): Promise<DeepViewerLibrary> {
  loading ??= import('openseadragon').then(loaded => {
    const module = loaded as DeepViewerLibrary & { default?: DeepViewerLibrary }
    return module.default ?? module
  })
  return loading
}

/** A static IIIF Image API 3 level-0 pyramid in the store: what the record
 * says about the bytes, and nothing the record does not say. */
export interface DeepTilePyramid {
  /** The folder the pyramid stands in, with no trailing slash. */
  readonly base: string
  readonly width: number
  readonly height: number
  readonly tileSize: number
  /** 1, 2, 4 ... one per level, coarsest last. */
  readonly scaleFactors: readonly number[]
}

/** The tile source as the viewer reads it: the shape of an `info.json`,
 * built from the record, never fetched. The profile is what tells the
 * viewer the pieces are files on a shelf and not a server it may ask for
 * an arbitrary region. */
export function deepTileSource(pyramid: DeepTilePyramid): Record<string, unknown> {
  return {
    '@context': 'http://iiif.io/api/image/3/context.json',
    id: pyramid.base,
    type: 'ImageService3',
    protocol: 'http://iiif.io/api/image',
    profile: 'level0',
    width: pyramid.width,
    height: pyramid.height,
    tiles: [{ width: pyramid.tileSize, scaleFactors: [...pyramid.scaleFactors] }],
  }
}

/** The whole source as one file, for a plate whose pyramid is not cut yet.
 * The ceiling is then the admitted file's own pixels, which is still the
 * whole of what the museum holds. */
export function deepImageSource(url: string): Record<string, unknown> {
  return { type: 'image', url }
}

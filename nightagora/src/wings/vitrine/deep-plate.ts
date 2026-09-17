/** THE WHOLE PLATE, over the paused frame.
 *
 * The close look shows the work where the room hangs it. This shows the
 * reproduction itself, as closely as the admitted file allows: a tile
 * pyramid in a viewer that stands in the DOM over the held canvas, so the
 * room draws nothing while it is open and the screen bounds the memory
 * instead of the image.
 *
 * It opens on the work's own rectangle, so the first frame is the frame the
 * visitor was already looking at, and eases once to the fit. Home is the
 * display window, the share of the source the room hangs; panning reaches
 * the whole source, because the photograph's margins are evidence.
 */
import css from './deep-plate.css?inline'
import { deepImageSource, deepTileSource, loadDeepViewer, type DeepTilePyramid } from './deep-viewer'
import type { VitrinePayload, VitrinePayloadHost, VitrineRect } from './types'

/** The share of the source the room shows, in fractions from its top left. */
export interface DeepPlateWindow { left: number; top: number; right: number; bottom: number }

/** Where the pixels come from: the pyramid where the store holds one, and
 * the admitted file itself where it does not. Either way the ceiling is the
 * source's own pixels. */
export interface DeepPlateSource {
  /** The store's record for this plate's pyramid, read once the manifest is
   * in hand; null where none is cut and the file itself is the source. */
  pyramid: DeepTilePyramid | null | Promise<DeepTilePyramid | null>
  /** The admitted file, whole and unchanged. */
  file: string
  width: number
  height: number
}

export interface DeepPlateWords {
  /** The control that puts the work back in the window. */
  whole: string
  /** What the view says when there is no more of the source to show. */
  ceiling: string
  /** The rule's numerals, each with the centimetres it names. */
  rule: readonly { label: string; cm: number }[]
}

export interface DeepPlatePayload extends VitrinePayload {
  /** The work's rectangle on the held frame while the viewer seats itself
   * on it, and null once it has: the window dims the room behind a plate
   * that no longer stands where the room drew it. */
  origin(): VitrineRect | null
}

/** Tiles a viewer may hold, by tier. A 256 px tile is 0.25 MB as RGBA8, so
 * these are 50, 37.5, 25 and 20 MB beside the room's own texture. The room
 * has released its one full plate by the time this opens. */
const TILE_CAP = { hero: 200, standard: 150, calm: 100, phone: 80 } as const
export type DeepPlateTier = 'hero' | 'standard' | 'calm'

/** THE CEILING IS THE SOURCE'S OWN PIXELS: one pixel of the file to one CSS
 * pixel of the screen, and no further. A spring settles on its target rather
 * than reaching it, so this is what counts as standing there. */
const AT_THE_CEILING = .999

/** One tile as RGBA8 in megabytes, which is what a cache count costs. */
const tileMB = (size: number): number => size * size * 4 / 1e6

/** The rule is a reading, so it is never a stub and never runs past the
 * plate: the numeral chosen is the largest one whose bar stands inside
 * these bounds of the viewport's own width. */
const RULE_SHORTEST = 24
const RULE_SHARE = .42

export function createDeepPlatePayload(options: {
  /** The work's own name, and the viewport's accessible name where no
   * description is written for it. */
  title: string
  /** What is on the plate, for a visitor who cannot see it. */
  description?: string | null
  source: DeepPlateSource
  window: DeepPlateWindow | null
  words: DeepPlateWords
  /** The work's rectangle on the frame the room is holding, or null where
   * the eye did not walk to it. */
  from(): VitrineRect | null
  tier(): DeepPlateTier
  /** Pixels of the source across one centimetre of the work, through the
   * display window the museum hangs it by. Null where the register holds no
   * measured extent, and then no rule is drawn. */
  pxPerCm: number | null
}): DeepPlatePayload {
  let host: VitrinePayloadHost | undefined
  let root: HTMLDivElement | undefined, stage: HTMLDivElement | undefined
  let rule: HTMLDivElement | undefined, ruleBar: HTMLDivElement | undefined, ruleLabel: HTMLSpanElement | undefined
  let viewer: import('openseadragon').Viewer | undefined
  let library: typeof import('openseadragon') | undefined
  let live = false, seated = false, tileSize = 256, said = ''
  let seat: VitrineRect | null = null
  const cut = options.window ?? { left: 0, top: 0, right: 1, bottom: 1 }
  const { width, height } = options.source

  /** The display window in the viewer's own coordinates, where the whole
   * image is one unit wide. */
  function windowBounds(): import('openseadragon').Rect {
    const Rect = library!.Rect
    return new Rect(cut.left, cut.top * height / width, cut.right - cut.left, (cut.bottom - cut.top) * height / width)
  }

  /** THE FIRST FRAME DOES NOT JUMP. The bounds that put the display window
   * exactly where the room drew it, in the viewport's own container. */
  function seatBounds(): import('openseadragon').Rect | null {
    if (!host || !seat || !library) return null
    const view = host.viewport()
    if (view.width <= 0 || view.height <= 0 || seat.width <= 0) return null
    const work = windowBounds()
    // CSS pixels per unit of the viewer's coordinates, taken from the width
    // the room gives the work on the frame it is holding.
    const scale = seat.width / work.width
    return new library.Rect(work.x - (seat.left - view.left) / scale, work.y - (seat.top - view.top) / scale,
      view.width / scale, view.height / scale)
  }

  /** What the viewer is asked to hold, and what it may draw with. A canvas
   * tile is CPU memory, which is what the phone's own ceiling counts. */
  function drawing(): { drawer: ('webgl' | 'canvas')[]; cap: number } {
    const tier = options.tier()
    const phone = tier === 'calm' && Boolean(host?.narrow)
    const cap = phone ? TILE_CAP.phone : TILE_CAP[tier]
    // Our scene already holds a WebGL context on this engine, and a second
    // one beside it is what the phone lane cannot carry.
    const webkit = /apple/i.test(navigator.vendor)
    return tier === 'calm' || webkit ? { drawer: ['canvas'], cap: Math.round(cap / 2) } : { drawer: ['webgl', 'canvas'], cap }
  }

  /** What a rig reads off the payload without a console: the drawer that
   * landed, the tiles held, the cache in megabytes and the magnification. */
  function readout(): void {
    if (!root || !viewer) return
    const tiles = viewer.tileCache.numCachesLoaded()
    root.dataset['drawer'] = viewer.drawer.getType() ?? 'unknown'
    root.dataset['tiles'] = String(tiles)
    root.dataset['cacheMb'] = (tiles * tileMB(tileSize)).toFixed(1)
    root.dataset['zoom'] = magnification().toFixed(3)
    measure()
    speak()
  }

  /** THE RULE MEASURES THE WORK, NOT THE SCREEN. Ten centimetres of the
   * painting are this many pixels of the glass at the magnification
   * standing now, whatever size the glass is: the view never claims that
   * ten centimetres on the screen are ten centimetres of the panel, which
   * would need a pixel pitch a browser does not know. */
  function measure(): void {
    if (!rule || !ruleBar || !ruleLabel || !root) return
    const perCm = options.pxPerCm, zoom = magnification()
    if (!perCm || !(zoom > 0) || !options.words.rule.length) { rule.hidden = true; return }
    const steps = [...options.words.rule].sort((a, b) => a.cm - b.cm)
    const most = root.clientWidth * RULE_SHARE
    let chosen = steps[0]!
    for (const step of steps) if (step.cm * perCm * zoom <= most) chosen = step
    const width = chosen.cm * perCm * zoom
    // A bar too short to read against is no measurement.
    if (width < RULE_SHORTEST) { rule.hidden = true; return }
    rule.hidden = false
    ruleBar.style.width = `${Math.round(width)}px`
    ruleLabel.textContent = chosen.label
    root.dataset['rule'] = `${chosen.label} ${Math.round(width)}px`
  }

  /** The one line under the viewport. At the ceiling it says so, in the
   * words the wing wrote, and says nothing the rest of the time: the plate
   * is what the visitor came to look at. */
  function speak(): void {
    if (!host) return
    const wanted = magnification() >= AT_THE_CEILING ? options.words.ceiling : ''
    if (said === wanted) return
    said = wanted
    host.caption.textContent = wanted
  }

  /** CSS pixels per pixel of the source: 1 is the source's own pixels. */
  function magnification(): number {
    const item = viewer?.world.getItemAt(0)
    return item && viewer ? item.viewportToImageZoom(viewer.viewport.getZoom(true)) : 0
  }

  /** The one motion of the opening: the work grows from where the room drew
   * it to the window, or stands at the window at once. */
  function seatAndFit(): void {
    if (!viewer || !host) return
    const start = seatBounds()
    if (start) viewer.viewport.fitBounds(start, true)
    seated = true
    // The frozen work is no longer under the plate, so the room dims whole.
    seat = null
    host.surface('hold')
    viewer.viewport.fitBounds(windowBounds(), !start || host.reducedMotion)
  }

  async function mountViewer(): Promise<void> {
    const [loaded, pyramid] = await Promise.all([loadDeepViewer(), options.source.pyramid])
    if (!live || !stage || !host) return
    library = loaded
    const { drawer, cap } = drawing()
    const source = pyramid ? deepTileSource(pyramid) : deepImageSource(options.source.file)
    if (pyramid) tileSize = pyramid.tileSize
    const made = new loaded.Viewer({
      element: stage,
      tileSources: source as unknown as string,
      drawer,
      maxImageCacheCount: cap,
      // The tiles are files on another origin and the WebGL drawer reads
      // their pixels, which it may only do on a request that said so.
      crossOriginPolicy: 'Anonymous',
      showNavigationControl: false,
      showNavigator: false,
      showSequenceControl: false,
      showZoomControl: false,
      showHomeControl: false,
      showFullPageControl: false,
      // Every control is ours and every key is the payload's: the viewer's
      // canvas is not in the tab order and its own key actions are off.
      tabIndex: -1,
      animationTime: host.reducedMotion ? 0 : 0.4,
      // No pixel of the source may be shown larger than itself: what a
      // visitor reaches here is the whole of what the museum holds.
      maxZoomPixelRatio: 1,
      springStiffness: 8,
      // Home is the display window and the pan is bounded by the source.
      minZoomImageRatio: 1,
      visibilityRatio: 1,
      constrainDuringPan: true,
      autoResize: true,
      preserveImageSizeOnResize: false,
      gestureSettingsMouse: { clickToZoom: false, dblClickToZoom: true, scrollToZoom: true, flickEnabled: false },
    })
    if (!live) { made.destroy(); return }
    viewer = made
    // THE CAP FOLLOWS THE DRAWER THAT LANDED, not the one we asked for: the
    // drawer is chosen while the viewer is built, before a tile is read.
    const landed = made.drawer.getType()
    if (landed === 'canvas' && drawer[0] === 'webgl') {
      made.tileCache = new loaded.TileCache({ maxImageCacheCount: Math.round(cap / 2) })
    }
    made.addHandler('canvas-key', event => { event.preventDefaultAction = true })
    made.addHandler('open', () => { if (!seated) seatAndFit() })
    made.addHandler('viewport-change', () => readout())
    made.addHandler('tile-drawn', () => readout())
    readout()
  }

  function press(label: string, run: () => void): HTMLButtonElement {
    const button = host!.element.ownerDocument.createElement('button')
    button.type = 'button'
    button.className = 'vitrine-control'
    button.textContent = label
    button.addEventListener('click', run)
    return button
  }

  return {
    kind: 'deep-plate',
    origin() { return seated ? null : seat },
    mount(next) {
      host = next
      live = true
      seated = false
      said = ''
      const document = next.element.ownerDocument
      root = document.createElement('div')
      root.className = 'deep-plate'
      const style = document.createElement('style')
      style.textContent = css
      stage = document.createElement('div')
      stage.className = 'deep-plate-stage'
      rule = document.createElement('div')
      rule.className = 'deep-rule'
      rule.hidden = true
      ruleBar = document.createElement('div')
      ruleBar.className = 'deep-rule-bar'
      ruleLabel = document.createElement('span')
      ruleLabel.className = 'deep-rule-label'
      rule.append(ruleBar, ruleLabel)
      root.append(style, stage, rule)
      next.element.append(root)
      next.element.tabIndex = 0
      next.describe(options.description ?? options.title)
      seat = options.from()
      next.surface('hold')
      next.controls.append(press(options.words.whole, () => {
        if (viewer && library) viewer.viewport.fitBounds(windowBounds(), host?.reducedMotion ?? false)
      }))
      void mountViewer()
    },
    layout() {
      // The stage moved under the viewer. Its own resize watch takes the
      // new container; the view the visitor made is left where it is.
      if (!seated) seat = options.from()
      measure()
    },
    key(event) {
      if (!viewer) return false
      const step = event.shiftKey ? .25 : .1
      const pan = (x: number, y: number): boolean => {
        const bounds = viewer!.viewport.getBounds()
        viewer!.viewport.panBy(new library!.Point(bounds.width * x, bounds.height * y))
        viewer!.viewport.applyConstraints()
        return true
      }
      switch (event.key) {
        case 'ArrowLeft': return pan(-step, 0)
        case 'ArrowRight': return pan(step, 0)
        case 'ArrowUp': return pan(0, -step)
        case 'ArrowDown': return pan(0, step)
        case '+': case '=': viewer.viewport.zoomBy(1.4); viewer.viewport.applyConstraints(); return true
        case '-': viewer.viewport.zoomBy(1 / 1.4); viewer.viewport.applyConstraints(); return true
        case '0': viewer.viewport.fitBounds(windowBounds(), host?.reducedMotion ?? false); return true
        default: return false
      }
    },
    unmount() {
      live = false
      // v6 destroys only what it made, and the stage it stood in goes with
      // the payload's own root.
      viewer?.destroy()
      viewer = undefined
      root?.remove()
      root = undefined; stage = undefined; host = undefined; library = undefined
      rule = undefined; ruleBar = undefined; ruleLabel = undefined
      seat = null; seated = false
    },
  }
}

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

/** A rectangle a line points at, in fractions of the source from its top
 * left, with the name the wing's own register gives it. */
export interface DeepPlateDetail { x: number; y: number; w: number; h: number; name: string }

export interface DeepPlateWords {
  /** The control that puts the work back in the window. */
  whole: string
  /** One step nearer and one step further, for a hand with no wheel, no
   * pinch and no keyboard. */
  nearer: string
  further: string
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

/** One step nearer, which is what a press and a key each take. */
const ZOOM_STEP = 1.4

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
  /** What a line of this wing points at on this plate. */
  details?: readonly DeepPlateDetail[]
}): DeepPlatePayload {
  let host: VitrinePayloadHost | undefined
  let root: HTMLDivElement | undefined, stage: HTMLDivElement | undefined
  let rule: HTMLDivElement | undefined, ruleBar: HTMLDivElement | undefined, ruleLabel: HTMLSpanElement | undefined
  let viewer: import('openseadragon').Viewer | undefined
  let library: typeof import('openseadragon') | undefined
  let live = false, seated = false, tileSize = 256, said = ''
  let framed: DeepPlateDetail | null = null
  let grown = false, waiting = 0
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

  /** The one line under the viewport: at the ceiling the wing's own
   * sentence, otherwise the name of the detail the view is standing on, and
   * nothing at all the rest of the time. The plate is what the visitor came
   * to look at. */
  function speak(): void {
    if (!host) return
    const wanted = magnification() >= AT_THE_CEILING ? options.words.ceiling : standingOn()
    if (said === wanted) return
    said = wanted
    host.caption.textContent = wanted
  }

  /** The framed detail's name while its middle is still in the view, and
   * nothing once the visitor has panned off it. */
  function standingOn(): string {
    if (!framed || !viewer || !library) return ''
    const rect = detailBounds(framed), view = viewer.viewport.getBounds(true)
    const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2
    if (x >= view.x && x <= view.x + view.width && y >= view.y && y <= view.y + view.height) return framed.name
    framed = null
    return ''
  }

  /** A detail's rectangle in the viewer's own coordinates. */
  function detailBounds(detail: DeepPlateDetail): import('openseadragon').Rect {
    return new library!.Rect(detail.x, detail.y * height / width, detail.w, detail.h * height / width)
  }

  /** THE TEXT NEVER STANDS ON THE DETAIL. The caption and the payload's own
   * row take the foot of the viewport, so the frame is given that much
   * empty room under the rectangle and the detail rides above it. */
  function frame(detail: DeepPlateDetail): void {
    if (!viewer || !library || !host || !root) return
    const bounds = detailBounds(detail)
    const margin = .1
    const wide = bounds.width * (1 + margin * 2), high = bounds.height * (1 + margin * 2)
    const box = new library.Rect(bounds.x - bounds.width * margin, bounds.y - bounds.height * margin, wide, high)
    const container = root.clientHeight
    const foot = host.caption.getBoundingClientRect().height
      + (host.narrow ? 0 : host.controls.getBoundingClientRect().height + 16)
    framed = detail
    viewer.viewport.fitBoundsWithConstraints(box, host.reducedMotion)
    // The detail is lifted by half the band the words take, in the units the
    // fit just chose; where the plate ends there, the constraint wins.
    const target = viewer.viewport.getBounds()
    const band = container > 0 ? Math.min(.4, foot / container) * target.height : 0
    if (band > 0) {
      viewer.viewport.panBy(new library.Point(0, band / 2), host.reducedMotion)
      viewer.viewport.applyConstraints(host.reducedMotion)
    }
    said = ''
    speak()
  }

  /** CSS pixels per pixel of the source: 1 is the source's own pixels. */
  function magnification(): number {
    const item = viewer?.world.getItemAt(0)
    return item && viewer ? item.viewportToImageZoom(viewer.viewport.getZoom(true)) : 0
  }

  /** THE FIRST FRAME IS THE FRAME THE VISITOR HAD. The viewer is stood on
   * the work's own rectangle and nothing moves yet: the room's frozen work
   * is still what is seen through it, until the first tile is drawn. */
  function seatNow(): void {
    if (!viewer) return
    const start = seatBounds()
    grown = Boolean(start)
    if (start) viewer.viewport.fitBounds(start, true)
    else fit()
  }

  /** The one motion of the opening. The room dims whole at the same moment,
   * because from here the plate no longer stands where the room drew it. */
  function fit(): void {
    if (!viewer || !host || seated) return
    seated = true
    seat = null
    if (root) root.dataset['seated'] = 'true'
    host.surface('hold')
    viewer.viewport.fitBounds(windowBounds(), !grown || host.reducedMotion)
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
    made.addHandler('open', () => seatNow())
    made.addHandler('viewport-change', () => readout())
    made.addHandler('tile-drawn', () => { fit(); readout() })
    // A source that never draws a tile may not leave the window standing on
    // a frame the room is no longer keeping.
    waiting = setTimeout(() => fit(), 1500) as unknown as number
    if (made.world.getItemCount() > 0) seatNow()
    readout()
  }

  /** Nearer or further by one step, bounded by the same constraints the
   * wheel and the keys are bounded by, so no press passes the ceiling. */
  function zoom(factor: number): void {
    if (!viewer || !host) return
    const now = host.reducedMotion
    viewer.viewport.zoomBy(factor, undefined, now)
    viewer.viewport.applyConstraints(now)
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
      framed = null
      const document = next.element.ownerDocument
      root = document.createElement('div')
      root.className = 'deep-plate'
      root.dataset['seated'] = 'false'
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
        framed = null
        if (viewer && library) viewer.viewport.fitBounds(windowBounds(), host?.reducedMotion ?? false)
      }))
      // A HAND THAT CANNOT SPIN A WHEEL still reaches the ceiling: the two
      // steps stand beside the fit, at the row's own size.
      next.controls.append(press(options.words.nearer, () => zoom(ZOOM_STEP)),
        press(options.words.further, () => zoom(1 / ZOOM_STEP)))
      // ONE CONTROL PER LINE THAT POINTS: the name is the one the wing's own
      // register already carries, in both languages.
      for (const detail of options.details ?? []) next.controls.append(press(detail.name, () => frame(detail)))
      void mountViewer()
    },
    layout() {
      // The stage moved under the viewer. Its own resize watch takes the
      // new container; the view the visitor made is left where it is.
      if (!seated) seat = options.from()
      measure()
    },
    key(event) {
      // THE KEYS OF AN OPEN PLATE ARE THE PLATE'S, from the moment it is
      // mounted: arrows that walked the wall would otherwise carry the
      // visitor off the work while the viewer is still arriving.
      const mine = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '0']
      if (!mine.includes(event.key)) return false
      if (!viewer || !library || !host) return true
      const now = host.reducedMotion, step = event.shiftKey ? .25 : .1
      const pan = (x: number, y: number): void => {
        const bounds = viewer!.viewport.getBounds()
        viewer!.viewport.panBy(new library!.Point(bounds.width * x, bounds.height * y), now)
        viewer!.viewport.applyConstraints(now)
      }
      if (event.key === 'ArrowLeft') pan(-step, 0)
      else if (event.key === 'ArrowRight') pan(step, 0)
      else if (event.key === 'ArrowUp') pan(0, -step)
      else if (event.key === 'ArrowDown') pan(0, step)
      else if (event.key === '0') { framed = null; viewer.viewport.fitBounds(windowBounds(), now) }
      else zoom(event.key === '-' ? 1 / ZOOM_STEP : ZOOM_STEP)
      return true
    },
    unmount() {
      live = false
      clearTimeout(waiting)
      waiting = 0
      // v6 destroys only what it made, and the stage it stood in goes with
      // the payload's own root.
      viewer?.destroy()
      viewer = undefined
      root?.remove()
      root = undefined; stage = undefined; host = undefined; library = undefined
      rule = undefined; ruleBar = undefined; ruleLabel = undefined
      seat = null; seated = false; framed = null
    },
  }
}

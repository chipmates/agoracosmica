import {
  Box3, Matrix4, Mesh, Raycaster, Vector2, Vector3,
  type InstancedMesh, type Intersection, type Material, type Object3D, type PerspectiveCamera,
} from 'three/webgpu'
import { deskStageHeight } from '../desk-stage'

export type VinciLabelMode = 0 | 1 | 2
export interface VinciLabelRect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface VinciLabelAnchor {
  /** A null anchor means there is no built object for this station to name. */
  setAnchor(point: Readonly<Vector3> | null, accessibleLabel?: string): void
  setMode(mode: VinciLabelMode): void
  /** Call after the rail updates the camera. `panels` are the boxes of every
   * panel standing on the frame; `pointAt` is the one the leader runs to. */
  update(panels?: readonly VinciLabelRect[] | null, pointAt?: VinciLabelRect | null, now?: number): void
  /** Invalidate after a retained opaque object changes position or geometry. */
  invalidate(): void
  dispose(): void
}

/** A MARK NEVER STANDS ON A PANEL. The station card, the hang strip, the
 * sources window and the bar are read over the room, and a 44 px target on
 * their words is either drawn across a sentence or buried under one, where a
 * hand cannot reach it and a keyboard still can. A mark whose own box meets a
 * standing panel is not drawn, not pressable and out of the tab order, and it
 * comes back the moment the panel leaves. */
function underPanel(x: number, y: number, panels: readonly VinciLabelRect[] | null): boolean {
  if (!panels) return false
  for (const rect of panels) {
    if (x + 22 >= rect.left && x - 22 <= rect.right && y + 22 >= rect.top && y - 22 <= rect.bottom) return true
  }
  return false
}

function opaqueMaterial(material: Material | undefined): boolean {
  if (!material || !material.visible || material.transparent || material.opacity < 1) return false
  const physical = material as Material & { transmission?: number; transmissionNode?: unknown }
  return !(physical.transmission && physical.transmission > 0) && physical.transmissionNode == null
}

function visibleAncestors(object: Object3D): boolean {
  for (let parent: Object3D | null = object; parent; parent = parent.parent) {
    if (!parent.visible) return false
  }
  return true
}

/** THE ONE SIGHT TEST both layers read. A binary visibility query: the first
 * eligible opaque hit before the anchor blocks it, and a transparent group is
 * skipped by its material. The tolerance keeps an anchor on a surface from
 * reading as its own occluder. */
export function vinciSightBlocked(eye: Readonly<Vector3>, anchor: Readonly<Vector3>,
  occluders: readonly Mesh[], ray: Raycaster, hits: Intersection<Mesh>[], tolerance = 0.08): boolean {
  const direction = new Vector3().subVectors(anchor, eye)
  const distance = direction.length()
  if (distance <= tolerance) return true
  ray.set(eye as Vector3, direction.multiplyScalar(1 / distance))
  ray.near = 0
  ray.far = distance - tolerance
  for (const mesh of occluders) {
    if (!visibleAncestors(mesh)) continue
    mesh.updateWorldMatrix(true, false)
    hits.length = 0
    ray.intersectObject(mesh, false, hits)
    for (const hit of hits) {
      const material = Array.isArray(mesh.material)
        ? mesh.material[hit.face?.materialIndex ?? 0]
        : mesh.material
      if (opaqueMaterial(material)) return true
    }
  }
  return false
}

/** Static scene membership is collected once. Water's opaque banks and bed
 * remain eligible; only its reflective surface meshes are excluded. */
export function collectVinciLabelOccluders(root: Object3D): Mesh[] {
  const meshes: Mesh[] = []
  root.traverse(object => {
    if (!(object instanceof Mesh) || object.userData['labelOccluder'] === false) return
    if (object.userData['manifestId'] === 'vinci/sky' || /(?:^|\/)(?:stream-water|stream-reflection)$/.test(object.name)) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    if (!materials.some(opaqueMaterial)) return
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox()
    meshes.push(object)
  })
  return meshes
}

/** A reconstructed shell's dot is always amber. This helper supplies no
 * historical copy and cannot turn a future station into a built exhibit. */
export function createVinciLabelAnchor(options: {
  host: HTMLElement
  camera: PerspectiveCamera
  occluders: readonly Mesh[]
  onOpen: () => void
}): VinciLabelAnchor {
  const { host, camera, occluders, onOpen } = options
  const document = host.ownerDocument
  const view = document.defaultView!
  const dot = document.createElement('button')
  dot.className = 'vinci-dot'
  dot.type = 'button'
  dot.hidden = true
  // the station's own mark opens a label where the visitor stands: the other
  // kind, and it says so under a name an export can ask for
  dot.id = 'vinci-mark-station'
  dot.dataset['mark'] = 'detail'
  dot.style.width = dot.style.height = '44px'
  dot.dataset['naClaim'] = 'inferred'
  dot.dataset['naAnchorClass'] = 'GENERATED'
  dot.dataset['naAnchor'] = 'vinci/shell'
  dot.addEventListener('click', onOpen)
  const leader = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  leader.classList.add('vinci-leader')
  leader.setAttribute('width', '100%')
  leader.setAttribute('height', '100%')
  leader.setAttribute('aria-hidden', 'true')
  leader.style.visibility = 'hidden'
  const line = document.createElementNS(leader.namespaceURI, 'line')
  leader.append(line)
  host.prepend(leader)
  host.append(dot)

  const anchor = new Vector3()
  const observedEye = new Vector3(Infinity, 0, 0)
  const eye = new Vector3(), projected = new Vector3()
  const ray = new Raycaster()
  const hits: Intersection<Mesh>[] = []
  let mode: VinciLabelMode = 1, hasAnchor = false, dirty = true, occluded = true
  const foot = VINCI_MARK_BAND.foot
  let changedAt = -Infinity, disposed = false
  const tolerance = 0.08
  const settleMs = 80

  function hide(): void {
    dot.hidden = true
    leader.style.visibility = 'hidden'
  }

  function invalidate(): void {
    dirty = true
    occluded = true
    changedAt = view.performance.now()
    hide()
  }

  function blocked(): boolean {
    return vinciSightBlocked(eye, anchor, occluders, ray, hits, tolerance)
  }

  return {
    setAnchor(point, accessibleLabel) {
      if (disposed) return
      const changed = point ? !hasAnchor || !anchor.equals(point) : hasAnchor
      hasAnchor = point !== null
      if (point) {
        anchor.copy(point)
        dot.setAttribute('aria-label', accessibleLabel ?? '')
      }
      if (changed) invalidate()
      if (!hasAnchor) hide()
    },
    setMode(next) {
      mode = next
      if (mode === 0) hide()
      else if (mode !== 2) leader.style.visibility = 'hidden'
    },
    update(panels = null, pointAt = null, now = view.performance.now()) {
      if (disposed || !hasAnchor || mode === 0) { hide(); return }
      camera.updateWorldMatrix(true, false)
      camera.getWorldPosition(eye)
      if (eye.distanceToSquared(observedEye) > 1e-10) {
        observedEye.copy(eye)
        changedAt = now
        dirty = true
      }
      // A translated eye has a new sightline. Keep it unclaimed until it
      // settles, avoiding stale dots and repeated full-terrain raycasts.
      if (dirty) {
        if (now - changedAt < settleMs) { hide(); return }
        occluded = blocked()
        dirty = false
      }
      projected.copy(anchor).project(camera)
      // the picture's own box, which is the window where no band stands
      const width = view.innerWidth, height = deskStageHeight()
      const x = (projected.x * 0.5 + 0.5) * width
      const y = (-projected.y * 0.5 + 0.5) * height
      const visible = !occluded && !underPanel(x, y, panels) && projected.z > -1 && projected.z < 1
        && vinciMarkInBand(x, y, width, height, foot)
      if (!visible) { hide(); return }
      dot.hidden = false
      dot.style.left = `${x}px`
      dot.style.top = `${y}px`
      if (mode !== 2 || !pointAt) { leader.style.visibility = 'hidden'; return }
      // The nearest clamped point lies on the card's boundary because the
      // anchor has already been rejected when covered by that rectangle.
      const endX = Math.max(pointAt.left, Math.min(pointAt.right, x))
      const endY = Math.max(pointAt.top, Math.min(pointAt.bottom, y))
      line.setAttribute('x1', String(x))
      line.setAttribute('y1', String(y))
      line.setAttribute('x2', String(endX))
      line.setAttribute('y2', String(endY))
      leader.style.visibility = 'visible'
    },
    invalidate,
    dispose() {
      disposed = true
      dot.removeEventListener('click', onOpen)
      dot.remove()
      leader.remove()
      hits.length = 0
    },
  }
}

/** One exhibit's mark, as the wing hands it to the layer. */
export interface VinciExhibitMark {
  id: string
  /** Just off the object's own face, so it is not its own occluder. */
  anchor: Readonly<Vector3>
  /** The exhibit's own name. A mark names, it never claims. */
  label: string
  /** The certainty colour of this object, which is a fact, not a style. */
  colour: string
  /** The object itself: a mark stands only while its exhibit is drawn. */
  object: Object3D
  /** TWO KINDS OF MARK, AND THE SHAPE SAYS WHICH. A press that moves the
   * body wears the ring and the walk glyph; a press that opens a label where
   * the visitor stands keeps the certainty bead. The wing decides, because
   * only the wing knows whether the rail will run. */
  walks?: boolean
  /** The walking mark's word at rest, from the card data by key. */
  word?: string
  /** A FLAT WORK, a painting or a sheet: its mark stands under its face and
   * beside the name under it, never on either. */
  face?: boolean
}

/** How far a mark's drawing reaches from its centre, halo included: the
 * walking ring, and the film's 28 px ring that every mark the film reads
 * from here is drawn as, the detail marks included. */
const MARK_REACH = { walk: 23, detail: 20 }
/** The air a mark keeps from a work's face and from a name. */
const MARK_GAP = 4

const MARK_SVG = 'http://www.w3.org/2000/svg'
/** the whole circumference of the walking mark's counted ring, in user units */
const MARK_RING = 2 * Math.PI * 15.5

/** A mark's own name in the DOM, keyed by the exhibit and not by the pool
 * slot it happens to take, so an export and a test name the same mark after
 * a rebuild. */
export const vinciMarkDomId = (exhibit: string): string =>
  `vinci-mark-${exhibit.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`

/** THE WALKING MARK'S BODY: a gold ring of 34 px inside the 44 px target,
 * the walk glyph in it, and the counted arc that fills on press. The arc is
 * the leg itself, never a timer. The film draws every one of its marks with
 * this same body. */
export function walkingRing(document: Document): SVGSVGElement {
  const svg = document.createElementNS(MARK_SVG, 'svg')
  svg.setAttribute('viewBox', '0 0 34 34')
  svg.setAttribute('class', 'vinci-mark-ring')
  svg.setAttribute('aria-hidden', 'true')
  const leg = document.createElementNS(MARK_SVG, 'circle')
  leg.setAttribute('cx', '17')
  leg.setAttribute('cy', '17')
  leg.setAttribute('r', '15.5')
  leg.setAttribute('class', 'vinci-mark-leg')
  leg.setAttribute('stroke-dasharray', `0 ${MARK_RING.toFixed(1)}`)
  const glyph = document.createElementNS(MARK_SVG, 'path')
  glyph.setAttribute('d', 'M17 22V10M12 15l5-5 5 5')
  glyph.setAttribute('class', 'vinci-mark-glyph')
  svg.append(leg, glyph)
  return svg
}
/** THE COUNTED ARC of a mark's ring: `share` of the leg under way, 0 to 1. */
export function setWalkingLeg(dot: Element, share: number): void {
  const arc = dot.querySelector<SVGCircleElement>('.vinci-mark-leg')
  arc?.setAttribute('stroke-dasharray', `${(MARK_RING * share).toFixed(1)} ${MARK_RING.toFixed(1)}`)
}


/** THE BAND A MARK MAY STAND IN. The head is the brand line and the bar at
 * the top of the frame; the foot was written as a fixed 220 px for a room
 * seen from a station, and at a viewing eye a work fills the frame, so its
 * own mark landed in that reserve and no mark stood at all. The foot is now
 * whatever stands at the foot of this frame: the row at rest, measured, with
 * a hand's width over it. */
export const VINCI_MARK_BAND = { head: 120, foot: 220 }
export const vinciMarkInBand = (x: number, y: number, width: number, height: number, foot: number): boolean =>
  x > 22 && x < width - 22 && y > VINCI_MARK_BAND.head && y < height - foot

/** One work's region on the frame: the outline its bounds project to, in
 * frame pixels, and how far it stands from the eye, so the nearer of two
 * overlapping works takes the press. */
export interface VinciWorkRegion { id: string; points: [number, number][]; depth: number }

/** WHERE A WORK LIES ON THE FRAME: its own vertices projected, a few
 * thousand at most, so a machine's outline follows the machine and not the
 * box round it. Null where any of it stands behind the eye. */
const vertex = new Vector3(), placed = new Matrix4(), copy = new Matrix4()
export function vinciWorkPoints(object: Object3D, camera: PerspectiveCamera, width: number, height: number, budget = 3000): [number, number][] | null {
  const meshes: Mesh[] = []
  object.traverseVisible(child => { if ((child as Mesh).isMesh && (child as Mesh).geometry?.attributes['position']) meshes.push(child as Mesh) })
  if (!meshes.length) return null
  const each = Math.max(24, Math.floor(budget / meshes.length))
  const points: [number, number][] = []
  for (const mesh of meshes) {
    const position = mesh.geometry.attributes['position']!
    const instanced = (mesh as InstancedMesh).isInstancedMesh === true
    const copies = instanced ? Math.min((mesh as InstancedMesh).count, 64) : 1
    const step = Math.max(1, Math.ceil((position.count * copies) / each))
    for (let c = 0; c < copies; c++) {
      if (instanced) { (mesh as InstancedMesh).getMatrixAt(c, copy); placed.multiplyMatrices(mesh.matrixWorld, copy) } else placed.copy(mesh.matrixWorld)
      for (let i = 0; i < position.count; i += step) {
        vertex.fromBufferAttribute(position, i).applyMatrix4(placed).project(camera)
        if (vertex.z <= -1 || vertex.z >= 1) return null
        points.push([(vertex.x * .5 + .5) * width, (-vertex.y * .5 + .5) * height])
      }
    }
  }
  return points
}
/** The convex outline of a set of points, counter-clockwise on the frame. */
function hull(points: [number, number][]): [number, number][] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o: [number, number], a: [number, number], b: [number, number]): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: [number, number][] = [], upper: [number, number][] = []
  for (const p of sorted) { while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop(); lower.push(p) }
  for (const p of [...sorted].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop(); upper.push(p) }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}
/** An outline cut to the frame, one edge of the frame at a time. */
function clipToFrame(points: [number, number][], width: number, height: number): [number, number][] {
  const edges: [(p: [number, number]) => number][] = [[p => p[0]], [p => width - p[0]], [p => p[1]], [p => height - p[1]]]
  let out = points
  for (const [inside] of edges) {
    const next: [number, number][] = []
    for (let i = 0; i < out.length; i++) {
      const a = out[i]!, b = out[(i + 1) % out.length]!
      const da = inside(a), db = inside(b)
      if (da >= 0) next.push(a)
      if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); next.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]) }
    }
    out = next
    if (!out.length) break
  }
  return out
}
/** THE WORKS A PRESS ON THE PICTURE CAN REACH: every work the frame shows,
 * as the convex outline of its projected vertices, where its own mark's
 * anchor or its middle is in sight. A work partly behind the eye has none. */
export function vinciWorkRegions(works: readonly { id: string; object: Object3D; anchor: Readonly<Vector3> }[],
  camera: PerspectiveCamera, occluders: readonly Mesh[], width: number, height: number): VinciWorkRegion[] {
  const out: VinciWorkRegion[] = []
  const eye = new Vector3(), middle = new Vector3(), bounds = new Box3()
  const ray = new Raycaster(), hits: Intersection<Mesh>[] = []
  camera.updateWorldMatrix(true, false)
  camera.getWorldPosition(eye)
  for (const work of works) {
    if (!visibleAncestors(work.object)) continue
    bounds.setFromObject(work.object)
    if (bounds.isEmpty()) continue
    const points = vinciWorkPoints(work.object, camera, width, height)
    if (!points) continue
    const outline = clipToFrame(hull(points), width, height)
    if (outline.length < 3) continue
    bounds.getCenter(middle)
    if (vinciSightBlocked(eye, work.anchor, occluders, ray, hits) && vinciSightBlocked(eye, middle, occluders, ray, hits)) continue
    out.push({ id: work.id, points: outline.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]), depth: Math.round(eye.distanceTo(middle) * 1000) / 1000 })
  }
  return out
}

export interface VinciExhibitDots {
  setExhibits(marks: readonly VinciExhibitMark[]): void
  setMode(mode: VinciLabelMode): void
  /** Which exhibit stands open, so each mark says whether it opened it. */
  setOpen(id: string | null): void
  /** Three on calm, six on standard, eight on hero. */
  setLimit(limit: number): void
  /** How much of the frame's foot is reserved, in pixels. */
  setFoot(pixels: number): void
  /** `panels` are the boxes of every panel standing on the frame. */
  /** `names` are the boxes of the names standing under works: a mark keeps
   * clear of them as it keeps clear of the works' faces. */
  update(panels?: readonly VinciLabelRect[] | null, now?: number, names?: readonly VinciLabelRect[] | null): void
  invalidate(): void
  dispose(): void
}

/** THE EXHIBIT DOTS LIVE IN THE LABEL LAYER `L` ALREADY OWNS, in the mode the
 * grammar calls dots, so they are not a fourth persistent mark. The set is
 * capped per tier and chosen by nearness to the frame's centre: what is in
 * front of the visitor is what carries a mark.
 */
export function createVinciExhibitDots(options: {
  host: HTMLElement
  camera: PerspectiveCamera
  occluders: readonly Mesh[]
  onOpen: (id: string, dot: HTMLButtonElement) => void
  /** The drawer every mark opens, named on the mark itself. */
  controls: string
  limit?: number
  /** The word a pressed walking mark takes, from the card data by key. */
  pressedWord?: () => string
  /** How much of the leg under way is walked, 0 to 1, or null at rest. */
  leg?: () => number | null
}): VinciExhibitDots {
  const { host, camera, occluders, onOpen } = options
  const document = host.ownerDocument
  const view = document.defaultView!
  const POOL = 8
  const buttons: HTMLButtonElement[] = []
  const pressed = new Map<HTMLButtonElement, string>()
  /* THE MARK'S OWN WORD, beside it on the pointer and on focus alike, so
     nothing here lives on a rollover. One chip for the layer: one mark is
     under the hand or under the focus at a time. It is aria-hidden because
     the same words are the mark's accessible name. */
  const chip = document.createElement('span')
  chip.className = 'vinci-mark-chip'
  chip.hidden = true
  chip.setAttribute('aria-hidden', 'true')
  const chipWord = document.createElement('span')
  chipWord.className = 'vinci-mark-chip-word'
  const chipName = document.createElement('span')
  chipName.className = 'vinci-mark-chip-name'
  chip.append(chipWord, chipName)
  host.append(chip)
  /* THE ANSWER THE PRESS OWES. The wing empties the pool in the same frame a
     mark is pressed, so the mark the hand pressed would be gone before the
     browser paints. The pressed walking mark is held out of every sweep for
     the length of its answer and takes its leave with the walking state. */
  const ANSWER_MS = 600
  let answering: HTMLButtonElement | null = null, answeredAt = 0
  let named: HTMLButtonElement | null = null
  const forge = (): boolean => document.body.classList.contains('forge')

  function placeChip(dot: HTMLButtonElement): void {
    const word = dot.dataset['word'] ?? ''
    chipWord.textContent = word
    chipWord.hidden = !word
    chipName.textContent = dot.dataset['name'] ?? ''
    chip.dataset['mark'] = dot.dataset['mark'] ?? 'detail'
    chip.hidden = false
    const x = parseFloat(dot.style.left) || 0, y = parseFloat(dot.style.top) || 0
    const width = chip.offsetWidth, stage = view.innerWidth
    // a mark that stands left of a name says its word on the side away from it
    const right = dot.dataset['beside'] !== 'left' && x + 26 + width <= stage - 22
    chip.dataset['side'] = right ? 'right' : 'left'
    chip.style.left = `${right ? x + 26 : x - 26 - width}px`
    chip.style.top = `${y - 18}px`
  }
  function nameMark(dot: HTMLButtonElement): void {
    if (dot.hidden || !pressed.has(dot)) return
    named = dot
    placeChip(dot)
  }
  function hushMark(dot: HTMLButtonElement): void {
    if (named !== dot || dot === answering) return
    named = null
    chip.hidden = true
  }
  /** The mark answers before the camera moves: its state, its word and its
   * ring are written now and the walk is asked for after that paint. */
  function answer(dot: HTMLButtonElement): void {
    answering = dot
    answeredAt = view.performance.now()
    dot.dataset['state'] = 'walking'
    dot.dataset['word'] = options.pressedWord?.() ?? dot.dataset['word'] ?? ''
    setLeg(dot, 0)
    placeChip(dot)
  }
  const setLeg = setWalkingLeg
  function release(): void {
    if (!answering) return
    delete answering.dataset['state']
    setLeg(answering, 0)
    if (named === answering) { named = null; chip.hidden = true }
    answering = null
  }
  for (let i = 0; i < POOL; i++) {
    const dot = document.createElement('button')
    dot.className = 'vinci-dot vinci-exhibit-dot'
    dot.type = 'button'
    dot.hidden = true
    dot.dataset['mark'] = 'detail'
    dot.style.width = dot.style.height = '44px'
    dot.setAttribute('aria-controls', options.controls)
    dot.setAttribute('aria-expanded', 'false')
    dot.append(walkingRing(document))
    dot.addEventListener('click', () => {
      const id = pressed.get(dot)
      if (!id) return
      if (dot.dataset['mark'] === 'walk') answer(dot)
      // the answer is painted first, then the walk is asked for: two frames
      // at 60 Hz, which is inside the tenth of a second the mark owes. A rig
      // composes one moment at a time, so there it opens in the same tick.
      if (dot.dataset['mark'] !== 'walk' || forge()) { onOpen(id, dot); return }
      view.requestAnimationFrame(() => view.requestAnimationFrame(() => onOpen(id, dot)))
    })
    dot.addEventListener('pointerenter', () => nameMark(dot))
    dot.addEventListener('pointerleave', () => hushMark(dot))
    dot.addEventListener('focus', () => nameMark(dot))
    dot.addEventListener('blur', () => hushMark(dot))
    buttons.push(dot)
    host.append(dot)
  }
  const eye = new Vector3(), observedEye = new Vector3(Infinity, 0, 0), projected = new Vector3()
  const box = new Box3(), corner = new Vector3()

  /** The work's own face on the frame, or null where a corner is behind the eye. */
  function faceOf(object: Object3D, width: number, height: number): VinciLabelRect | null {
    box.setFromObject(object)
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      corner.set(x, y, z).project(camera)
      if (corner.z <= -1 || corner.z >= 1) return null
      const px = (corner.x * .5 + .5) * width, py = (-corner.y * .5 + .5) * height
      left = Math.min(left, px); right = Math.max(right, px); top = Math.min(top, py); bottom = Math.max(bottom, py)
    }
    return { left, top, right, bottom }
  }
  /** WHERE A FLAT WORK'S MARK STANDS: where it was anchored while that
   * covers neither the work's face nor a name under a work; else under the
   * face, beside the name at its middle, or beside the face's foot, the first
   * of these the frame has room for. Null where none has. */
  function clearOf(mark: VinciExhibitMark, x: number, y: number, width: number, height: number,
    names: readonly VinciLabelRect[] | null, fits: (x: number, y: number) => boolean)
    : { x: number; y: number; beside: '' | 'left' | 'right' } | null {
    const reach = mark.walks ? MARK_REACH.walk : MARK_REACH.detail
    const face = faceOf(mark.object, width, height)
    const meets = (px: number, py: number, rect: VinciLabelRect): boolean =>
      px + reach + MARK_GAP > rect.left && px - reach - MARK_GAP < rect.right
      && py + reach + MARK_GAP > rect.top && py - reach - MARK_GAP < rect.bottom
    const nameAt = (px: number, py: number): VinciLabelRect | undefined => names?.find(name => meets(px, py, name))
    const clear = (px: number, py: number): boolean => !(face && meets(px, py, face)) && !nameAt(px, py)
    if (clear(x, y) && fits(x, y)) return { x, y, beside: '' }
    const under = face ? face.bottom + MARK_GAP + reach : y
    const tries: { x: number; y: number; beside: '' | 'left' | 'right' }[] = [{ x, y: under, beside: '' }]
    const name = nameAt(x, under)
    if (name) {
      const middle = (name.top + name.bottom) / 2
      tries.push({ x: name.left - MARK_GAP - reach, y: middle, beside: 'left' },
        { x: name.right + MARK_GAP + reach, y: middle, beside: 'right' })
    }
    if (face) {
      const foot = face.bottom - reach
      tries.push({ x: face.left - MARK_GAP - reach, y: foot, beside: '' }, { x: face.right + MARK_GAP + reach, y: foot, beside: '' })
    }
    return tries.find(at => at.x - reach >= 0 && at.x + reach <= width && clear(at.x, at.y) && fits(at.x, at.y)) ?? null
  }
  /** the point of the work itself under a point of the frame, or null where the frame shows something else there */
  const surface = new Raycaster(), ndc = new Vector2()
  function surfaceAt(object: Object3D, px: number, py: number, width: number, height: number): Vector3 | null {
    surface.setFromCamera(ndc.set((px / width) * 2 - 1, -(py / height) * 2 + 1), camera)
    const hit = surface.intersectObject(object, true).find(h => visibleAncestors(h.object))
    return hit ? hit.point.clone() : null
  }
  /** A WORK WHOSE MARK HAS NO PLACE BESIDE IT, its anchor outside the band
   * or under a panel, wears the mark on itself: on what the band shows of
   * it, from its foot up, under the anchor where it can, so the work a frame
   * is about can always be opened. The mark stands where a ray meets the
   * work, never on the room beside it. Null where none such fits. */
  function onWork(mark: VinciExhibitMark, x: number, width: number, height: number,
    fits: (x: number, y: number) => boolean): { x: number; y: number; beside: ''; seen: Vector3 } | null {
    const points = vinciWorkPoints(mark.object, camera, width, height, 1200)
    if (!points) return null
    let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity
    for (const [px, py] of points) { l = Math.min(l, px); r = Math.max(r, px); t = Math.min(t, py); b = Math.max(b, py) }
    const inset = (mark.walks ? MARK_REACH.walk : MARK_REACH.detail) + MARK_GAP
    const left = Math.max(l, 0) + inset, right = Math.min(r, width) - inset
    const top = Math.max(t, VINCI_MARK_BAND.head) + inset, bottom = Math.min(b, height - foot) - inset
    if (right < left || bottom < top) return null
    const under = Math.max(left, Math.min(right, x))
    // rows from the foot up, each tried nearest the anchor's column first
    const columns = [under, left, right, (left + right) / 2, (under + left) / 2, (under + right) / 2]
    for (let row = 0; row < 4; row++) {
      const y = bottom - ((bottom - top) * row) / 3
      for (const cx of columns) {
        if (!fits(cx, y)) continue
        const seen = surfaceAt(mark.object, cx, y, width, height)
        if (seen) return { x: cx, y, beside: '', seen }
      }
    }
    return null
  }
  const ray = new Raycaster()
  const hits: Intersection<Mesh>[] = []
  const sight = new Map<string, boolean>()
  let marks: readonly VinciExhibitMark[] = []
  let mode: VinciLabelMode = 1, limit = options.limit ?? 6, opened: string | null = null
  let foot = VINCI_MARK_BAND.foot
  let dirty = true, changedAt = -Infinity, disposed = false
  const settleMs = 80

  function hide(): void {
    for (const dot of buttons) {
      if (dot === answering) continue
      dot.hidden = true
      pressed.delete(dot)
      delete dot.dataset['exhibit']
      dot.removeAttribute('id')
    }
    if (!answering) { chip.hidden = true; named = null }
  }

  function invalidate(): void {
    dirty = true
    sight.clear()
    changedAt = view.performance.now()
    hide()
  }

  return {
    setExhibits(next) {
      marks = next
      invalidate()
    },
    setMode(next) {
      mode = next
      if (mode === 0) hide()
    },
    setOpen(id) {
      opened = id
      for (const dot of buttons) dot.setAttribute('aria-expanded', String(pressed.get(dot) === opened && opened !== null))
    },
    setLimit(next) {
      const value = Math.max(0, Math.min(POOL, Math.floor(next)))
      if (value === limit) return
      limit = value
      invalidate()
    },
    setFoot(pixels) {
      const value = Math.max(0, Math.round(pixels))
      if (value === foot) return
      foot = value
      invalidate()
    },
    update(panels = null, now = view.performance.now(), names = null) {
      // THE PRESSED MARK KEEPS ITS PLACE while it answers, and its ring is
      // the leg itself: the walk's own share, never a clock.
      if (answering) {
        if (now - answeredAt > ANSWER_MS) release()
        else {
          setLeg(answering, Math.max(0, Math.min(1, options.leg?.() ?? 0)))
          // the word belongs to the answer while the answer stands, whatever
          // the hand and the focus have done since the press
          named = answering
          placeChip(answering)
        }
      }
      if (disposed || mode === 0 || !marks.length || limit === 0) { hide(); return }
      camera.updateWorldMatrix(true, false)
      camera.getWorldPosition(eye)
      if (eye.distanceToSquared(observedEye) > 1e-10) {
        observedEye.copy(eye)
        changedAt = now
        dirty = true
        sight.clear()
      }
      // A DOT IS NOT PLACED WHILE THE EYE IS TRAVELLING. A new sightline has
      // to settle, exactly as the station's own mark does, so nothing stale
      // stands on the frame and the raycast is paid once per standing.
      if (dirty) {
        if (now - changedAt < settleMs) { hide(); return }
        dirty = false
      }
      // the picture's own box, which is the window where no band stands
      const width = view.innerWidth, height = deskStageHeight()
      const centreX = width / 2, centreY = height / 2
      const candidates: { mark: VinciExhibitMark; x: number; y: number; from: number; beside: string; seen: Vector3 | null }[] = []
      for (const mark of marks) {
        if (!mark.object.visible) continue
        projected.copy(mark.anchor as Vector3).project(camera)
        if (projected.z <= -1 || projected.z >= 1) continue
        const at = { x: (projected.x * .5 + .5) * width, y: (-projected.y * .5 + .5) * height, beside: '' }
        const fits = (px: number, py: number): boolean => vinciMarkInBand(px, py, width, height, foot) && !underPanel(px, py, panels)
        const placed = (mark.face ? clearOf(mark, at.x, at.y, width, height, names, fits) : fits(at.x, at.y) ? at : null)
          ?? onWork(mark, at.x, width, height, fits)
        if (!placed) continue
        const { x, y, beside } = placed
        // which marks stand is chosen by where the works are, not where their marks stepped to
        candidates.push({ mark, x, y, from: Math.hypot(at.x - centreX, at.y - centreY), beside, seen: (placed as { seen?: Vector3 }).seen ?? null })
      }
      candidates.sort((a, b) => a.from - b.from)
      const shown: typeof candidates = []
      for (const candidate of candidates) {
        if (shown.length >= limit) break
        let clear = sight.get(candidate.mark.id)
        if (clear === undefined) {
          // a mark worn on the work is in sight where the work's own point under it is
          clear = !vinciSightBlocked(eye, candidate.seen ?? candidate.mark.anchor, occluders, ray, hits)
          sight.set(candidate.mark.id, clear)
        }
        if (clear) shown.push(candidate)
      }
      // Tab order is reading order: the marks are placed left to right, so a
      // hand and a keyboard meet them in the same sequence.
      shown.sort((a, b) => a.x - b.x)
      /* THE MARK THAT IS ANSWERING ITS OWN PRESS KEEPS THE SLOT IT STANDS IN,
         and its exhibit is not handed to a second button: two marks on one
         object would be the loudest thing in the room for half a second. */
      const held = answering?.dataset['exhibit']
      if (held) {
        const at = shown.findIndex(candidate => candidate.mark.id === held)
        if (at >= 0) shown.splice(at, 1)
      }
      const free = buttons.filter(dot => dot !== answering)
      for (let i = 0; i < free.length; i++) {
        const dot = free[i]!, entry = shown[i]
        // the mark carries the exhibit it opens, so an export can name it
        if (!entry) {
          dot.hidden = true; pressed.delete(dot); delete dot.dataset['exhibit']
          dot.removeAttribute('id'); hushMark(dot); continue
        }
        dot.hidden = false
        dot.dataset['exhibit'] = entry.mark.id
        // a name of the exhibit's own, not of the pool slot it took
        dot.id = vinciMarkDomId(entry.mark.id)
        dot.style.left = `${entry.x}px`
        dot.style.top = `${entry.y}px`
        if (entry.beside) dot.dataset['beside'] = entry.beside
        else delete dot.dataset['beside']
        dot.style.setProperty('--certainty', entry.mark.colour)
        /* THE SHAPE SAYS WHAT THE PRESS DOES, and the word says it in words:
           gold moves you, a certainty colour tells you something. */
        dot.dataset['mark'] = entry.mark.walks ? 'walk' : 'detail'
        dot.dataset['name'] = entry.mark.label
        dot.dataset['word'] = entry.mark.walks ? entry.mark.word ?? '' : ''
        const name = entry.mark.walks && entry.mark.word
          ? `${entry.mark.word} · ${entry.mark.label}` : entry.mark.label
        if (dot.getAttribute('aria-label') !== name) dot.setAttribute('aria-label', name)
        pressed.set(dot, entry.mark.id)
        dot.setAttribute('aria-expanded', String(entry.mark.id === opened))
        if (named === dot) placeChip(dot)
      }
    },
    invalidate,
    dispose() {
      disposed = true
      answering = null
      named = null
      for (const dot of buttons) dot.remove()
      chip.remove()
      buttons.length = 0
      pressed.clear()
      hits.length = 0
    },
  }
}

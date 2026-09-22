import {
  Mesh, Raycaster, Vector3,
  type Intersection, type Material, type Object3D, type PerspectiveCamera,
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
  // kind, and it says so
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
}

const MARK_SVG = 'http://www.w3.org/2000/svg'
/** the whole circumference of the walking mark's counted ring, in user units */
const MARK_RING = 2 * Math.PI * 15.5

/** THE WALKING MARK'S BODY: a gold ring of 34 px inside the 44 px target,
 * the walk glyph in it, and the counted arc that fills on press. The arc is
 * the leg itself, never a timer. */
function walkingRing(document: Document): SVGSVGElement {
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


/** THE BAND A MARK MAY STAND IN. The head is the brand line and the bar at
 * the top of the frame; the foot was written as a fixed 220 px for a room
 * seen from a station, and at a viewing eye a work fills the frame, so its
 * own mark landed in that reserve and no mark stood at all. The foot is now
 * whatever stands at the foot of this frame: the row at rest, measured, with
 * a hand's width over it. */
export const VINCI_MARK_BAND = { head: 120, foot: 220 }
export const vinciMarkInBand = (x: number, y: number, width: number, height: number, foot: number): boolean =>
  x > 22 && x < width - 22 && y > VINCI_MARK_BAND.head && y < height - foot

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
  update(panels?: readonly VinciLabelRect[] | null, now?: number): void
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
    const right = x + 26 + width <= stage - 22
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
  function setLeg(dot: HTMLButtonElement, share: number): void {
    const arc = dot.querySelector<SVGCircleElement>('.vinci-mark-leg')
    arc?.setAttribute('stroke-dasharray', `${(MARK_RING * share).toFixed(1)} ${MARK_RING.toFixed(1)}`)
  }
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
      if (dot.dataset['mark'] !== 'walk' || forge()) { onOpen(id, dot); return }
      // the answer is painted first, then the walk is asked for: two frames
      // at 60 Hz, which is inside the tenth of a second the mark owes
      answer(dot)
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
    update(panels = null, now = view.performance.now()) {
      // THE PRESSED MARK KEEPS ITS PLACE while it answers, and its ring is
      // the leg itself: the walk's own share, never a clock.
      if (answering) {
        if (now - answeredAt > ANSWER_MS) release()
        else {
          setLeg(answering, Math.max(0, Math.min(1, options.leg?.() ?? 0)))
          if (named === answering) placeChip(answering)
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
      const candidates: { mark: VinciExhibitMark; x: number; y: number; from: number }[] = []
      for (const mark of marks) {
        if (!mark.object.visible) continue
        projected.copy(mark.anchor as Vector3).project(camera)
        if (projected.z <= -1 || projected.z >= 1) continue
        const x = (projected.x * .5 + .5) * width, y = (-projected.y * .5 + .5) * height
        if (!vinciMarkInBand(x, y, width, height, foot)) continue
        if (underPanel(x, y, panels)) continue
        candidates.push({ mark, x, y, from: Math.hypot(x - centreX, y - centreY) })
      }
      candidates.sort((a, b) => a.from - b.from)
      const shown: typeof candidates = []
      for (const candidate of candidates) {
        if (shown.length >= limit) break
        let clear = sight.get(candidate.mark.id)
        if (clear === undefined) {
          clear = !vinciSightBlocked(eye, candidate.mark.anchor, occluders, ray, hits)
          sight.set(candidate.mark.id, clear)
        }
        if (clear) shown.push(candidate)
      }
      // Tab order is reading order: the marks are placed left to right, so a
      // hand and a keyboard meet them in the same sequence.
      shown.sort((a, b) => a.x - b.x)
      // the mark that is answering its own press keeps the slot it stands in
      const free = buttons.filter(dot => dot !== answering)
      for (let i = 0; i < free.length; i++) {
        const dot = free[i]!, entry = shown[i]
        // the mark carries the exhibit it opens, so an export can name it
        if (!entry) {
          dot.hidden = true; pressed.delete(dot); delete dot.dataset['exhibit']
          hushMark(dot); continue
        }
        dot.hidden = false
        dot.dataset['exhibit'] = entry.mark.id
        dot.style.left = `${entry.x}px`
        dot.style.top = `${entry.y}px`
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

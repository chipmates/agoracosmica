import {
  Mesh, Raycaster, Vector3,
  type Intersection, type Material, type Object3D, type PerspectiveCamera,
} from 'three/webgpu'

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
      const width = view.innerWidth, height = view.innerHeight
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
}): VinciExhibitDots {
  const { host, camera, occluders, onOpen } = options
  const document = host.ownerDocument
  const view = document.defaultView!
  const POOL = 8
  const buttons: HTMLButtonElement[] = []
  const pressed = new Map<HTMLButtonElement, string>()
  for (let i = 0; i < POOL; i++) {
    const dot = document.createElement('button')
    dot.className = 'vinci-dot vinci-exhibit-dot'
    dot.type = 'button'
    dot.hidden = true
    dot.style.width = dot.style.height = '44px'
    dot.setAttribute('aria-controls', options.controls)
    dot.setAttribute('aria-expanded', 'false')
    dot.addEventListener('click', () => { const id = pressed.get(dot); if (id) onOpen(id, dot) })
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
    for (const dot of buttons) { dot.hidden = true; pressed.delete(dot) }
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
      const width = view.innerWidth, height = view.innerHeight
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
      for (let i = 0; i < buttons.length; i++) {
        const dot = buttons[i]!, entry = shown[i]
        if (!entry) { dot.hidden = true; pressed.delete(dot); continue }
        dot.hidden = false
        dot.style.left = `${entry.x}px`
        dot.style.top = `${entry.y}px`
        dot.style.setProperty('--certainty', entry.mark.colour)
        if (dot.getAttribute('aria-label') !== entry.mark.label) dot.setAttribute('aria-label', entry.mark.label)
        pressed.set(dot, entry.mark.id)
        dot.setAttribute('aria-expanded', String(entry.mark.id === opened))
      }
    },
    invalidate,
    dispose() {
      disposed = true
      for (const dot of buttons) dot.remove()
      buttons.length = 0
      pressed.clear()
      hits.length = 0
    },
  }
}

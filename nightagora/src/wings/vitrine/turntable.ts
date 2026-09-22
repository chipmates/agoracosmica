/** THE MACHINE ON ITS TURNTABLE.
 *
 * The room's own body is lent to a scene of its own: a dark ground under the
 * wing's key and fill, drawn through the museum's one stack while the room
 * holds still, and handed back at rest. The machine's clock is a scalar the
 * visitor's hand writes: a drag across the model, the slider under it, the
 * arrow keys, a step in the list. The steps light the part they name, and a
 * tap on the model names the part it lands on.
 */
import {
  AdditiveBlending, Box3, BoxGeometry, CircleGeometry, Color, Group, Mesh, MeshBasicNodeMaterial,
  MeshStandardNodeMaterial, PerspectiveCamera, PointLight, Raycaster, Scene, Sphere, Vector2, Vector3,
  type BufferGeometry, type Object3D,
} from 'three/webgpu'
import { float, fog, rangeFogFactor } from 'three/tsl'
import type { Grade, KeyLight, Stack, StackLightOptions } from '../../stack'
import { createBenchBackdrop } from '../vinci/machines/bench/backdrop'
import {
  advancePlayback, initialPlayback, type PlaybackSchedule, type PlaybackState,
} from '../vinci/machines/bench/playback'
import { LOOK_RULE } from '../vinci/input'
import { deskStageHeight } from '../desk-stage'
import type { VitrinePayload, VitrinePayloadHost } from './types'

export interface TurntableBody {
  object: Object3D
  ready: Promise<void>
  animate(t: number, dt: number): void
  part?(id: string): { node: Object3D; geometry: BufferGeometry } | null
}

export interface TurntableStep {
  /** A fraction of the period, 0 to 1. */
  at: number
  part: string
  /** The caption, in the page's language. */
  text: string
  certainty: string
}

export type TurntableViewpoint = 'whole' | 'drive' | 'working-part'

export interface TurntableOptions {
  stack: Stack
  body: TurntableBody
  title: string
  schedule: PlaybackSchedule
  steps: readonly TurntableStep[]
  /** The dossier's own tree, child to parent, so a tap on a fitting finds
   * the step that speaks of the part it belongs to. */
  parents: ReadonlyMap<string, string>
  /** The part each viewpoint looks at; `whole` looks at the machine. */
  viewpoints: readonly { id: TurntableViewpoint; label: string; part: string | null }[]
  words: { play: string; pause: string; again: string; clock: string }
  /** Where a part lives in a body that was not built from its dossier. */
  nodeNames?: Readonly<Record<string, string>>
  /** Every part's own name by its dossier id, in the page's language. */
  partNames?: ReadonlyMap<string, string>
  /** The parts that are this machine's screen: what its demonstration lands
   * on. The light marks them by their edge instead of filling their face. */
  screens?: ReadonlySet<string>
  light: {
    key: StackLightOptions
    fill: { color: string; groundColor: string; intensity: number }
    environmentIntensity: number
    fitting: { color: string; intensity: number; distance: number; decay: number; height: number }
  }
  grade: Grade
  /** The folio beside the model: its thumbnail where the store holds one. */
  sheet?: { src: Promise<string | null> | null; label: string; open(): void }
  /** Hand the stage back to the room. */
  restore(): void
  /** True once the eye stands where it walked for this machine: the room
   * draws the walk until then, and the body is lent only after it. */
  standing?(): boolean
}

const DEG = Math.PI / 180
/** The whole machine three quarters on, the way the bench shows it. */
const WHOLE = { yaw: 35 * DEG, pitch: 16 * DEG }
const PITCH = { least: 3 * DEG, most: 58 * DEG }
const EASE_S = .7
/** A full drag across the viewport is one period of the machine's clock. */
const DRAG_PERIODS = 1
/** An arrow key turns the crank by this share of the period. */
const KEY_SHARE = 1 / 24
const OVERLAY = { color: '#f2c77a', opacity: .3 }
/** The border that marks a screen: a share of its shorter side, never thinner
 * than this, and standing a little proud of the sheet so it reads from both
 * faces of something as thin as paper. */
const EDGE = { share: .04, least: .006 }
/** The sphere fit leaves a machine's box corners air; the table stands it a
 * little nearer. */
const WHOLE_FIT = .86
/** Air around the box the whole view fits. */
const WHOLE_MARGIN = 1.04

interface View { yaw: number; pitch: number; distance: number; target: Vector3 }

export function createTurntablePayload(options: TurntableOptions): VitrinePayload {
  const { stack, body, schedule, steps } = options
  const period = schedule.kind === 'static' ? 0 : schedule.period
  let host: VitrinePayloadHost | undefined
  let scene: Scene | undefined, camera: PerspectiveCamera | undefined, key: KeyLight | undefined
  let ground: Mesh | undefined, fitting: PointLight | undefined
  let lent: { parent: Object3D | null; position: Vector3; quaternion: import('three/webgpu').Quaternion; scale: Vector3; visible: boolean } | undefined
  const shadows = new Map<Mesh, boolean>()
  let state: PlaybackState = { clock: 0, playing: false, fixed: false }
  let standing = false, mounted = false
  let radius = 1, centre = new Vector3()
  const view: View = { ...WHOLE, distance: 1, target: new Vector3() }
  let goal: View | null = null, from: View | null = null, eased = 0
  let chosen: TurntableViewpoint = 'whole'
  let active = -1
  const overlays = new Map<string, Mesh[]>()
  /** Geometry the overlay built itself, which it owns and gives back. */
  const owned = new Set<BufferGeometry>()
  const overlayMaterial = new MeshBasicNodeMaterial({ color: new Color(OVERLAY.color), transparent: true,
    opacity: OVERLAY.opacity, depthWrite: false, blending: AdditiveBlending, fog: false })
  overlayMaterial.polygonOffset = true
  overlayMaterial.polygonOffsetFactor = -2
  overlayMaterial.polygonOffsetUnits = -2
  const ray = new Raycaster()
  let tapped: { node: Object3D; local: Vector3; text: string } | null = null

  // The controls, built once per mount.
  let play: HTMLButtonElement | undefined, slider: HTMLInputElement | undefined
  let stepButtons: HTMLButtonElement[] = [], viewButtons = new Map<TurntableViewpoint, HTMLButtonElement>()
  let leader: SVGSVGElement | undefined, leaderLine: SVGLineElement | undefined, leaderText: HTMLElement | undefined

  const share = (): number => {
    if (!period) return 0
    if (schedule.kind === 'loop') return (state.clock % period) / period
    return Math.min(1, state.clock / period)
  }
  /** Where each step starts on the dial. A last step at the cycle's own end
   * stands for the second half of the way from the step before it, so the
   * end of a turn is read before the turn begins again. */
  const starts = steps.map((step, i) => step.at >= 1 && i > 0 ? (steps[i - 1]!.at + 1) / 2 : step.at)
  function stepAt(u: number): number {
    let found = -1
    for (let i = 0; i < steps.length; i++) if (u + 1e-6 >= starts[i]!) found = i
    return found
  }

  function setClock(clock: number, playing = false): void {
    const bounded = schedule.kind === 'finite' ? Math.min(period, Math.max(0, clock)) : Math.max(0, clock)
    state = { clock: bounded, playing, fixed: false }
  }
  /** RELEASE: a finite demonstration coasts to its end and a continuous one
   * keeps its schedule. Under reduced motion the hand's pose is kept. */
  function release(): void {
    if (!period || host?.reducedMotion) return
    state = { clock: state.clock, playing: schedule.kind === 'loop' || state.clock < period, fixed: false }
  }

  function make<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
    const n = host!.element.ownerDocument.createElement(tag)
    n.className = cls
    if (text !== undefined) n.textContent = text
    return n
  }

  // ---- the part a step names, and the light on it
  function nodeFor(id: string): { node: Object3D; geometries: { node: Object3D; geometry: BufferGeometry }[] } | null {
    const built = body.part?.(id)
    if (built) return { node: built.node, geometries: [built] }
    const name = options.nodeNames?.[id] ?? id
    const node = body.object.getObjectByName(name)
    if (!node) return null
    const geometries: { node: Object3D; geometry: BufferGeometry }[] = []
    node.traverse(child => { if (child instanceof Mesh && !child.userData['vitrineOverlay']) geometries.push({ node: child, geometry: child.geometry }) })
    return geometries.length ? { node, geometries } : null
  }
  /** A part and every part the dossier hangs from it: a leaf is its stile,
   * its panels and its beams. A part another step names is that step's own,
   * so the mast lights without the sail it carries. */
  const children = new Map<string, string[]>()
  for (const [child, parent] of options.parents) children.set(parent, [...children.get(parent) ?? [], child])
  const named = new Set(steps.map(step => step.part))
  function family(id: string): string[] {
    const out = [id]
    for (let i = 0; i < out.length; i++) out.push(...(children.get(out[i]!) ?? []).filter(child => !named.has(child)))
    return out
  }
  /** A SCREEN IS MARKED BY ITS EDGE. The step that names a machine's screen is
   * the step about what lands on it, and a fill over the face hides exactly
   * that, so the light runs a border round the part instead of covering it.
   * The border is built off the part's own box, in the part's own space. */
  function border(geometry: BufferGeometry): BufferGeometry[] {
    if (!geometry.boundingBox) geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    const size = box.getSize(new Vector3()), middle = box.getCenter(new Vector3())
    const axes = ['x', 'y', 'z'] as const
    const thin = axes.reduce((least, axis) => size[axis] < size[least] ? axis : least, 'x' as typeof axes[number])
    const face = axes.filter(axis => axis !== thin) as [typeof axes[number], typeof axes[number]]
    const band = Math.max(Math.min(size[face[0]], size[face[1]]) * EDGE.share, EDGE.least)
    const bars: BufferGeometry[] = []
    for (const along of face) {
      const across = along === face[0] ? face[1] : face[0]
      for (const side of [-1, 1]) {
        const width = { x: 0, y: 0, z: 0 }
        width[along] = size[along]
        width[across] = band
        width[thin] = size[thin] + band * .5
        const bar = new BoxGeometry(width.x, width.y, width.z)
        const at = middle.clone()
        at[across] = middle[across] + side * (size[across] - band) / 2
        bar.translate(at.x, at.y, at.z)
        bars.push(bar)
      }
    }
    return bars
  }
  function light(id: string | null): void {
    for (const [part, meshes] of overlays) for (const mesh of meshes) mesh.visible = part === id
    if (!id || overlays.has(id)) return
    /* A mark built for the hand is not what the light lands on: it is the
       reach of a tap, and its own mark stands beside it. */
    const found = family(id).flatMap(part => (nodeFor(part)?.geometries ?? []).map(hit => ({ ...hit, part })))
      .filter(({ node }) => !node.userData['vitrineTarget'])
    const meshes: Mesh[] = []
    for (const { node, geometry, part } of found) {
      const screen = options.screens?.has((node.userData['partId'] as string | undefined) ?? part) === true
      for (const shape of screen ? border(geometry) : [geometry]) {
        if (screen) owned.add(shape)
        const mesh = new Mesh(shape, overlayMaterial)
        mesh.userData['vitrineOverlay'] = true
        mesh.renderOrder = 10
        mesh.frustumCulled = false
        node.add(mesh)
        meshes.push(mesh)
      }
    }
    overlays.set(id, meshes)
  }

  // ---- the eye on its bounded orbit
  function viewportFit(): { left: number; top: number; width: number; height: number } {
    const rect = host!.viewport()
    // The caption and the row under the work take the viewport's foot. Where
    // the label carries the row, the caption alone is what has to stay clear.
    const foot = host!.narrow ? 34 : host!.banded ? 52 : 118
    return { left: rect.left, top: rect.top, width: rect.width, height: Math.max(80, rect.height - foot) }
  }
  function fitDistance(r: number): number {
    const fit = viewportFit(), w = innerWidth, h = deskStageHeight()
    const tanY = Math.tan(camera!.fov * DEG / 2) * fit.height / h
    const tanX = Math.tan(camera!.fov * DEG / 2) * (w / h) * fit.width / w
    return r / Math.sin(Math.atan(Math.min(tanX, tanY))) * 1.02
  }
  /** THE WHOLE MACHINE FILLS ITS VIEWPORT: every corner of its rest box
   * stands inside the viewport from the whole view's own bearing, which a
   * sphere cannot do for a tall crane or a flat gate. */
  let rest = new Box3()
  /** How many moments of the run the fitted box is measured over. */
  const RUN_SAMPLES = 8
  /** THE BOX THE RUN NEEDS. A machine's rest pose is not its widest moment:
   * the legs open, the arm swings. Where the work owns the stage it is fitted
   * to the box the whole run stands in, so no step of it is ever cut. */
  function runBox(from: Box3): Box3 {
    if (!period) return from
    const union = from.clone(), sample = new Box3()
    for (let i = 1; i < RUN_SAMPLES; i++) {
      body.animate(period * i / RUN_SAMPLES, 0)
      body.object.updateMatrixWorld(true)
      union.union(sample.setFromObject(body.object, true))
    }
    body.animate(0, 0)
    body.object.updateMatrixWorld(true)
    return union
  }
  function wholeDistance(): number {
    if (rest.isEmpty()) return fitDistance(radius) * WHOLE_FIT
    const fit = viewportFit(), w = innerWidth, h = deskStageHeight()
    const tanY = Math.tan(camera!.fov * DEG / 2) * fit.height / h
    const tanX = Math.tan(camera!.fov * DEG / 2) * (w / h) * fit.width / w
    const cos = Math.cos(WHOLE.pitch)
    const toward = new Vector3(Math.sin(WHOLE.yaw) * cos, Math.sin(WHOLE.pitch), Math.cos(WHOLE.yaw) * cos)
    const right = new Vector3().crossVectors(new Vector3(0, 1, 0), toward).normalize()
    const up = new Vector3().crossVectors(toward, right).normalize()
    const corner = new Vector3()
    let distance = radius * .5
    for (const x of [rest.min.x, rest.max.x]) for (const y of [rest.min.y, rest.max.y]) for (const z of [rest.min.z, rest.max.z]) {
      corner.set(x, y, z).sub(centre)
      const depth = corner.dot(toward)
      distance = Math.max(distance, depth + Math.abs(corner.dot(right)) / tanX, depth + Math.abs(corner.dot(up)) / tanY)
    }
    return Math.min(distance * WHOLE_MARGIN, fitDistance(radius) * WHOLE_FIT)
  }
  function goalFor(id: TurntableViewpoint): View {
    const entry = options.viewpoints.find(v => v.id === id)
    const part = entry?.part ? family(entry.part).flatMap(name => nodeFor(name)?.geometries ?? []) : []
    if (!part.length || id === 'whole') return { ...WHOLE, distance: wholeDistance(), target: centre.clone() }
    const box = new Box3()
    for (const { node, geometry } of part) {
      if (!geometry.boundingBox) geometry.computeBoundingBox()
      box.union(geometry.boundingBox!.clone().applyMatrix4(node.matrixWorld))
    }
    const sphere = box.getBoundingSphere(new Sphere())
    const whole = wholeDistance()
    const toward = new Vector3(Math.sin(WHOLE.yaw), 0, Math.cos(WHOLE.yaw))
    const across = new Vector3(sphere.center.x - centre.x, 0, sphere.center.z - centre.z)
    // A part on the far side of the machine is looked at from its own side,
    // so the body does not stand between the eye and it.
    const yaw = across.dot(toward) < -radius * .1 ? WHOLE.yaw + Math.PI : WHOLE.yaw
    // A STEP IN, NEVER A NEW PLACE: the eye comes a third to two thirds of
    // the way toward the part, which keeps the machine it belongs to in the
    // frame and the eye inside the air the whole view stands in.
    const distance = Math.min(whole * .7, Math.max(whole * .35, fitDistance(sphere.radius * 2.6)))
    return { yaw, pitch: WHOLE.pitch + 4 * DEG, distance, target: centre.clone().lerp(sphere.center, .75) }
  }
  function choose(id: TurntableViewpoint): void {
    chosen = id
    for (const [name, button] of viewButtons) button.setAttribute('aria-pressed', String(name === id))
    const next = goalFor(id)
    if (host?.reducedMotion) { Object.assign(view, next); goal = null; return }
    from = { ...view, target: view.target.clone() }
    goal = next
    eased = 0
  }
  function orbit(dx: number, dy: number): void {
    goal = null
    view.yaw -= dx
    view.pitch = Math.min(PITCH.most, Math.max(PITCH.least, view.pitch + dy))
    chosen = 'whole'
    for (const [, button] of viewButtons) button.setAttribute('aria-pressed', 'false')
  }
  function placeCamera(dt: number): void {
    if (!camera || !host) return
    if (goal && from) {
      eased = Math.min(1, eased + dt / EASE_S)
      const k = eased * eased * (3 - 2 * eased)
      let turn = goal.yaw - from.yaw
      turn = Math.atan2(Math.sin(turn), Math.cos(turn))
      view.yaw = from.yaw + turn * k
      view.pitch = from.pitch + (goal.pitch - from.pitch) * k
      view.distance = from.distance + (goal.distance - from.distance) * k
      view.target.lerpVectors(from.target, goal.target, k)
      if (eased >= 1) goal = null
    }
    const cos = Math.cos(view.pitch)
    camera.position.set(Math.sin(view.yaw) * cos, Math.sin(view.pitch), Math.cos(view.yaw) * cos)
      .multiplyScalar(view.distance).add(view.target)
    camera.lookAt(view.target)
    const w = innerWidth, h = deskStageHeight(), fit = viewportFit()
    // The work stands in the middle of its own viewport, not of the stage.
    camera.aspect = w / h
    camera.setViewOffset(w, h, w / 2 - (fit.left + fit.width / 2), h / 2 - (fit.top + fit.height / 2), w, h)
    camera.updateProjectionMatrix()
  }

  // ---- the words that follow the clock
  function paint(): void {
    if (!host) return
    const u = share()
    const at = stepAt(u)
    if (slider && document.activeElement !== slider) slider.value = String(Math.round(u * 1000))
    if (slider) slider.setAttribute('aria-valuetext', period ? `${state.clock.toFixed(1)} s / ${period} s` : '')
    if (play) {
      const held = schedule.kind === 'finite' && state.clock >= period
      const text = state.playing ? options.words.pause : held ? options.words.again : options.words.play
      if (play.textContent !== text) play.textContent = text
      play.setAttribute('aria-pressed', String(state.playing))
    }
    if (at !== active) {
      active = at
      const step = steps[at]
      host.caption.textContent = step?.text ?? ''
      host.caption.lang = host.lang
      // THE RUN'S CAPTIONS, ONE AT A TIME, and the clock that counts them:
      // the label reads which step is under way, never a second hand.
      host.step?.(at, steps.length)
      stepButtons.forEach((button, i) => { if (i === at) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current') })
      light(step?.part ?? null)
      host.describe(step ? `${options.title}. ${step.text}` : options.title)
    }
    paintLeader()
  }
  function paintLeader(): void {
    if (!leader || !leaderLine || !leaderText || !camera || !host) return
    if (!tapped) { leader.style.display = 'none'; leaderText.hidden = true; return }
    const point = tapped.node.localToWorld(tapped.local.clone()).project(camera)
    const x = (point.x * .5 + .5) * innerWidth, y = (-point.y * .5 + .5) * deskStageHeight()
    const rect = host.viewport()
    const box = leaderText.getBoundingClientRect()
    // The name stands at the viewport's upper corner on the far side of the
    // part, and its line rides the part as the machine moves.
    // The phone's folio stands in its viewport's upper right, so the name keeps
    // to the left there.
    const left = host.narrow ? rect.left + 8 : x < rect.left + rect.width / 2 ? rect.left + rect.width - box.width - 16 : rect.left + 16
    const top = rect.top + (host.narrow ? 8 : 16)
    leaderText.style.left = `${Math.round(left)}px`
    leaderText.style.top = `${Math.round(top)}px`
    leaderLine.setAttribute('x1', String(x))
    leaderLine.setAttribute('y1', String(y))
    leaderLine.setAttribute('x2', String(x < rect.left + rect.width / 2 ? left : left + box.width))
    leaderLine.setAttribute('y2', String(top + box.height / 2))
    leader.style.display = ''
    leaderText.hidden = false
  }

  // ---- a tap names a part, a drag turns the crank, two fingers turn the table
  function stepFor(part: string): number {
    for (let id: string | undefined = part; id; id = options.parents.get(id)) {
      const at = steps.findIndex(step => step.part === id)
      if (at >= 0) return at
    }
    return -1
  }
  /** The dossier id a node of the body stands for: its own name, or the name
   * a body built outside its record gives that part. */
  const idsByNode = new Map(Object.entries(options.nodeNames ?? {}).map(([part, node]) => [node, part]))
  /** WHAT THE FRAME ACTUALLY DRAWS. A ray does not care whether a part is
   * visible, so a wall a cutaway has lifted still catches every tap and names
   * itself over the open chamber behind it. A tap lands on what a visitor can
   * see: every node up the chain drawn, the material on, and never the light's
   * own overlay. A mark built for the hand alone is the one exception, because
   * nothing draws it and a hand has to reach it. */
  function drawn(object: Object3D): boolean {
    if (object.userData['vitrineOverlay']) return false
    for (let node: Object3D | null = object; node; node = node.parent) if (!node.visible) return false
    const material = (object as Mesh).material
    if (object.userData['vitrineTarget']) return true
    return !(material && !Array.isArray(material) && material.visible === false)
  }
  function tap(x: number, y: number): void {
    if (!camera) return
    ray.setFromCamera(new Vector2(x / innerWidth * 2 - 1, -(y / deskStageHeight()) * 2 + 1), camera)
    const hit = ray.intersectObject(body.object, true).find(h => drawn(h.object))
    tapped = null
    if (hit) {
      for (let node: Object3D | null = hit.object; node && node !== body.object; node = node.parent) {
        const name = node.name.replace(/:(surface|rigid-surfaces)$/, '')
        const part = options.partNames?.has(name) ? name : idsByNode.get(name)
        const named = part ? options.partNames?.get(part) : undefined
        // A PART IS NAMED BY ITS OWN NAME. Where the record names none, the step
        // that speaks of it still does.
        let at = named ? -1 : stepFor(name)
        if (!named && at < 0 && part) at = stepFor(part)
        if (!named && at < 0) continue
        const text = named ?? steps[at]!.text
        tapped = { node: hit.object, local: hit.object.worldToLocal(hit.point.clone()), text }
        if (leaderText) { leaderText.textContent = text; leaderText.lang = host!.lang }
        light(named ? part! : steps[at]!.part)
        break
      }
    }
    paintLeader()
  }

  const pointers = new Map<number, { x: number; y: number }>()
  /** THE FIRST FINGER OWNS THE CLOCK. A press, a drag and a tap are told apart
   * by the tracked path from where it went down, never by the lifting event's
   * own coordinates, which WebKit does not promise; a second contact turns the
   * table and takes the tap away. */
  let press: { id: number; x: number; y: number; clock: number; moved: boolean; orbit: boolean } | null = null
  const listening = new AbortController()
  function clear(): void {
    pointers.clear()
    press = null
  }
  function bindHand(surface: HTMLElement): void {
    const signal = listening.signal
    surface.addEventListener('contextmenu', event => event.preventDefault(), { signal })
    surface.addEventListener('pointerdown', event => {
      if ((event.target as Element).closest('button,a,input')) return
      if (pointers.has(event.pointerId)) return
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      // WebKit refuses capture for a pointer it no longer tracks.
      try { surface.setPointerCapture(event.pointerId) } catch { /* the viewport covers the model either way */ }
      event.preventDefault()
      if (pointers.size === 1) press = { id: event.pointerId, x: event.clientX, y: event.clientY, clock: state.clock, moved: false, orbit: event.button === 2 }
      else if (press) { press.orbit = true; press.moved = true }
    }, { signal })
    surface.addEventListener('pointermove', event => {
      const last = pointers.get(event.pointerId)
      if (!last || !press) return
      const dx = event.clientX - last.x, dy = event.clientY - last.y
      last.x = event.clientX; last.y = event.clientY
      if (!press.moved && event.pointerId === press.id
        && Math.hypot(event.clientX - press.x, event.clientY - press.y) > LOOK_RULE.slopPx) press.moved = true
      if (!press.moved) return
      if (press.orbit) { orbit(dx * .008 / Math.max(1, pointers.size), dy * .006 / Math.max(1, pointers.size)); return }
      if (!period || event.pointerId !== press.id) return
      tapped = null
      const across = viewportFit().width
      setClock(press.clock + (event.clientX - press.x) / across * period * DRAG_PERIODS)
    }, { signal })
    surface.addEventListener('pointerup', event => {
      if (!pointers.delete(event.pointerId) || !press || pointers.size) return
      const was = press
      press = null
      if (!was.moved && event.pointerId === was.id) tap(was.x, was.y)
      else if (!was.orbit && period) release()
    }, { signal })
    // A cancelled or lost contact ends as nothing at all: no tap, no coast.
    const lost = (event: PointerEvent): void => {
      if (!pointers.delete(event.pointerId)) return
      if (!pointers.size) press = null
    }
    surface.addEventListener('pointercancel', lost, { signal })
    surface.addEventListener('lostpointercapture', lost, { signal })
    const view = surface.ownerDocument.defaultView
    view?.addEventListener('blur', clear, { signal })
    surface.ownerDocument.addEventListener('visibilitychange', clear, { signal })
    surface.addEventListener('wheel', event => event.preventDefault(), { signal, passive: false })
  }

  function buildControls(next: VitrinePayloadHost): void {
    const row = next.controls
    const clock = make('div', 'vitrine-clock')
    play = make('button', 'vitrine-control vitrine-play')
    play.type = 'button'
    play.disabled = !period
    play.addEventListener('click', () => {
      if (!period) return
      if (schedule.kind === 'finite' && state.clock >= period) setClock(0, true)
      else state = { clock: state.clock, playing: !state.playing, fixed: false }
      paint()
    }, { signal: listening.signal })
    slider = make('input', 'vitrine-slider')
    slider.type = 'range'
    slider.min = '0'; slider.max = '1000'; slider.step = '1'
    slider.disabled = !period
    slider.setAttribute('aria-label', options.words.clock)
    slider.addEventListener('input', () => {
      if (!period) return
      tapped = null
      const u = Number(slider!.value) / 1000
      const cycle = schedule.kind === 'loop' ? Math.floor(state.clock / period) : 0
      setClock((cycle + Math.min(u, schedule.kind === 'loop' ? .9999 : 1)) * period)
    }, { signal: listening.signal })
    slider.addEventListener('change', () => release(), { signal: listening.signal })
    slider.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault(); event.stopPropagation()
      turn(event.key === 'ArrowRight' ? 1 : -1)
    }, { signal: listening.signal })
    const track = make('div', 'vitrine-track')
    track.append(slider)
    for (const start of starts) {
      const tick = make('span', 'vitrine-tick')
      tick.style.left = `${start * 100}%`
      tick.setAttribute('aria-hidden', 'true')
      track.append(tick)
    }
    clock.append(play, track)
    const views = make('div', 'vitrine-views')
    viewButtons = new Map()
    for (const entry of options.viewpoints) {
      const button = make('button', 'vitrine-control vitrine-viewpoint', entry.label)
      button.type = 'button'
      button.disabled = entry.id !== 'whole' && (!entry.part || !nodeFor(entry.part))
      button.setAttribute('aria-pressed', String(entry.id === chosen))
      button.addEventListener('click', () => choose(entry.id), { signal: listening.signal })
      viewButtons.set(entry.id, button)
      views.append(button)
    }
    row.append(views, clock)
    // THE STEPS ARE THE TEXT ALTERNATIVE FOR THE MOTION, one button each.
    stepButtons = []
    if (steps.length) {
      const list = make('ul', 'vitrine-steps')
      list.setAttribute('role', 'list')
      steps.forEach((step, i) => {
        const item = make('li', '')
        const button = make('button', 'vitrine-step-item')
        button.type = 'button'
        button.lang = next.lang
        const dot = make('span', 'vinci-title-dot')
        dot.dataset['certainty'] = step.certainty
        dot.setAttribute('aria-hidden', 'true')
        button.append(dot, make('span', '', step.text))
        button.addEventListener('click', () => jump(i), { signal: listening.signal })
        stepButtons.push(button)
        item.append(button)
        list.append(item)
      })
      next.aside.append(list)
    }
    // THE SHEET BESIDE THE MODEL: the folio the machine was read from.
    if (options.sheet) {
      const sheet = make('button', 'vitrine-folio')
      sheet.type = 'button'
      sheet.setAttribute('aria-label', options.sheet.label)
      const label = options.sheet.label
      if (options.sheet.src) {
        void options.sheet.src.then(src => {
          if (!mounted) return
          if (!src) { sheet.textContent = label; return }
          const image = make('img', 'vitrine-folio-thumb')
          image.alt = ''
          image.decoding = 'async'
          image.src = src
          sheet.append(image)
        })
      } else sheet.textContent = label
      sheet.addEventListener('click', () => options.sheet?.open(), { signal: listening.signal })
      next.element.append(sheet)
    }
    const svg = next.element.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('class', 'vitrine-leader')
    svg.setAttribute('aria-hidden', 'true')
    leaderLine = next.element.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'line')
    svg.append(leaderLine)
    leader = svg
    leaderText = make('p', 'vitrine-part-name')
    leaderText.hidden = true
    next.element.append(svg, leaderText)
  }

  function jump(index: number): void {
    const step = steps[index]
    if (!step || !period) return
    tapped = null
    const at = step.at >= 1 ? (schedule.kind === 'finite' ? 1 : starts[index]! + .02) : starts[index]!
    const cycle = schedule.kind === 'loop' ? Math.floor(state.clock / period) : 0
    setClock((cycle + at) * period)
    active = -2
    paint()
  }
  function turn(direction: number): void {
    if (!period) return
    tapped = null
    setClock(state.clock + direction * period * KEY_SHARE)
  }

  let bodyReady = false
  function stand(): void {
    if (!mounted || !host || standing) return
    // A body out of the store names its parts only once it stands.
    for (const entry of options.viewpoints) {
      const button = viewButtons.get(entry.id)
      if (button) button.disabled = entry.id !== 'whole' && (!entry.part || !nodeFor(entry.part))
    }
    scene = new Scene()
    scene.background = new Color('#1a2026')
    const backdrop = createBenchBackdrop()
    scene.backgroundNode = backdrop
    camera = new PerspectiveCamera(host.narrow ? 40 : 34, innerWidth / deskStageHeight(), .01, 1000)
    const table = new Group()
    table.name = 'vitrine/turntable'
    scene.add(table)
    const object = body.object
    lent = { parent: object.parent, position: object.position.clone(), quaternion: object.quaternion.clone(),
      scale: object.scale.clone(), visible: object.visible }
    // THE REST POSE IS WHAT THE TABLE MEASURES, so every machine stands on
    // the ground at the same place however far its clock had gone.
    body.animate(0, 0)
    table.add(object)
    object.position.set(0, 0, 0)
    object.quaternion.identity()
    object.visible = true
    object.updateMatrixWorld(true)
    const box = new Box3().setFromObject(object, true)
    const size = box.getSize(new Vector3())
    object.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2)
    object.updateMatrixWorld(true)
    rest = new Box3().setFromObject(object, true)
    radius = Math.max(.05, box.getBoundingSphere(new Sphere()).radius)
    centre = new Vector3(0, size.y / 2, 0)
    if (host.banded) {
      rest = runBox(rest)
      centre.setY((rest.min.y + rest.max.y) / 2)
      radius = Math.max(radius, rest.getBoundingSphere(new Sphere()).radius)
    }
    const span = Math.max(size.x, size.y, size.z)
    object.traverse(child => {
      if (!(child instanceof Mesh) || child.userData['vitrineOverlay']) return
      shadows.set(child, child.castShadow)
      child.castShadow = true
    })
    ground = new Mesh(new CircleGeometry(span * 14, 72), new MeshStandardNodeMaterial({ color: new Color('#2b2e2c'), roughness: .94, metalness: 0 }))
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    ground.name = 'vitrine/ground'
    scene.add(ground)
    camera.near = Math.max(.005, span / 400)
    camera.far = span * 80
    stack.setScene(scene, camera, options.grade)
    const reach = span * 3.4
    key = stack.light({ ...options.light.key, reach: Math.max(24, span * 6), cascades: [span * 1.25, reach] })
    key.light.shadow.normalBias = span * .0002
    key.light.shadow.bias = -span * .00001
    key.fill.color.set(options.light.fill.color)
    key.fill.groundColor.set(options.light.fill.groundColor)
    key.fill.intensity = options.light.fill.intensity
    scene.environmentIntensity = options.light.environmentIntensity
    const f = options.light.fitting
    fitting = new PointLight(f.color, f.intensity, Math.max(f.distance, span * 3), f.decay)
    fitting.position.set(-span * .35, Math.max(f.height, size.y + 1), span * .45)
    fitting.castShadow = false
    scene.add(fitting)
    view.target.copy(centre)
    view.distance = wholeDistance()
    view.yaw = WHOLE.yaw; view.pitch = WHOLE.pitch
    placeCamera(0)
    const near = view.distance + span * .5, far = view.distance + span * 2.4
    scene.fogNode = fog(backdrop, rangeFogFactor(float(near), float(far)))
    standing = true
    host.surface('own')
    active = -2
    paint()
  }

  return {
    kind: 'machine',
    mount(next) {
      host = next
      mounted = true
      state = initialPlayback(schedule, { reducedMotion: next.reducedMotion })
      buildControls(next)
      bindHand(next.element)
      next.element.tabIndex = 0
      next.describe(options.title)
      paint()
      void body.ready.then(() => { bodyReady = true }).catch(error => console.error(error))
    },
    update(dt) {
      // THE WALK COMES FIRST: the room draws the leg to the plinth, and the
      // body is lent to the table in the frame after the eye stands.
      if (!standing && mounted && bodyReady && (options.standing?.() ?? true)) stand()
      if (!standing || !host) return
      if (!press || press.orbit) state = advancePlayback(schedule, state, Math.min(.1, dt))
      body.animate(state.clock, dt)
      placeCamera(dt)
      paint()
    },
    layout() {
      if (!standing) return
      if (!goal && chosen === 'whole') view.distance = wholeDistance()
      placeCamera(0)
    },
    key(event) {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const direction = event.key === 'ArrowRight' ? 1 : -1
        if (event.shiftKey) orbit(direction * 12 * DEG, 0)
        else turn(direction)
        return true
      }
      if (event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        orbit(0, (event.key === 'ArrowUp' ? 1 : -1) * 6 * DEG)
        return true
      }
      return false
    },
    unmount() {
      mounted = false
      listening.abort()
      for (const meshes of overlays.values()) for (const mesh of meshes) mesh.removeFromParent()
      overlays.clear()
      for (const shape of owned) shape.dispose()
      owned.clear()
      overlayMaterial.dispose()
      if (lent) {
        // BACK TO THE ROOM AT REST, where it stood and as it stood.
        const object = body.object
        body.animate(0, 0)
        for (const [mesh, cast] of shadows) mesh.castShadow = cast
        shadows.clear()
        object.removeFromParent()
        lent.parent?.add(object)
        object.position.copy(lent.position)
        object.quaternion.copy(lent.quaternion)
        object.scale.copy(lent.scale)
        object.visible = lent.visible
        object.updateMatrixWorld(true)
        lent = undefined
      }
      if (standing) {
        key?.dispose()
        fitting?.dispose()
        if (ground) { ground.geometry.dispose(); (ground.material as MeshStandardNodeMaterial).dispose() }
        scene?.clear()
        options.restore()
      }
      standing = false
      key = undefined; scene = undefined; camera = undefined; ground = undefined; fitting = undefined
      host = undefined
    },
  }
}

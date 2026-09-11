/* THE OBJECT BENCH — one built body, alone, under the museum's own hour.
 *
 * The other benches stand a thing this app makes. This one stands a thing the
 * Blender kit made: a glTF out of the store, packed at three tiers, whose
 * colour, relief, roughness, metal and occlusion were measured off its own
 * geometry. Nothing of the wing is here. There is a ground for the shadow to
 * fall on, the air, and the body. What is being judged is the object.
 *
 * NO BAKED LIGHT CROSSES. The export carries no emissive channel and no light
 * atlas, and this file clears both anyway, so a later repack cannot smuggle an
 * hour in. The occlusion arrives in the ORM texture, which is where glTF puts
 * occlusion, and three gives it to the ambient term alone. What models the
 * brick is the stack's key light at the object's own named hour.
 *
 * Four stations, and each one is a question about the object. `approach`
 * three quarters on at twelve metres: is it a building. `near` at two metres:
 * is the material true. `detail` at sixty centimetres on one joint: does it
 * hold at the distance a hand would reach. `phone` upright: does it survive
 * the frame most visitors will actually see.
 */

import {
  Box3,
  Color,
  DoubleSide,
  Fog,
  Group,
  Mesh,
  MeshStandardNodeMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  type BufferGeometry,
  type Object3D,
  type Texture,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import type { KeyLight, Stack } from '../../../../stack'
import type { BenchModule, BenchOptions } from '../../../../bench'
import { IDENTITY } from '../../../../stack/grade'
import { loadManifest, type ManifestEntry } from '../../../../manifest'
import { readLabels } from '../../../../core/labels'
import { metrePlane } from '../../../../stack/parts/common'
import { OBJECT_STATES, objectFor, objectIds, type BenchObject, type ObjectState, type Station } from './catalog'
import css from './object-bench.css?inline'

// a composed TSL graph outruns its own overload types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { color, float, materialAO, mix, mx_noise_float, positionWorld, positionWorldDirection, smoothstep, bumpMap } =
  TSL as unknown as Record<string, any>

const GRADE = { ...IDENTITY, name: 'object bench', exposure: 1.0, grain: 0.002, vignette: 0.08 }

const node = (tag: string, className: string, text = ''): HTMLElement => {
  const el = document.createElement(tag)
  el.className = className
  if (text) el.textContent = text
  return el
}

export function createObjectBench(stack: Stack): BenchModule {
  const stage = stack.renderer.domElement.parentElement
  const scene = new Scene()
  const camera = new PerspectiveCamera(46, 1, 0.05, 400)
  const around = new Group()
  scene.add(around)

  let piece: BenchObject | null = null
  let state: ObjectState = 'approach'
  let body: Object3D | null = null
  let bounds = new Box3()
  let key: KeyLight | null = null
  let probe: Texture | undefined
  let probeEntry: ManifestEntry | undefined
  let entries: ManifestEntry[] = []
  let ground: Mesh | null = null
  let groundMaterial: MeshStandardNodeMaterial | null = null
  let bodyMaterials = new Set<MeshStandardNodeMaterial>()
  let counted = { tris: 0, draws: 0, textureMB: 0, texelsPerMetre: 0 }

  let host: HTMLElement | null = null
  let viewport: HTMLElement | null = null
  let drawer: HTMLElement | null = null
  let drawerButton: HTMLButtonElement | null = null
  let controls: HTMLButtonElement[] = []
  let note: HTMLElement | null = null
  let events: AbortController | null = null
  let returnFocus: HTMLElement | null = null
  let active = false
  let ready = false
  let serial = 0
  let width = 0
  let height = 0
  let labelMode = 1

  const narrow = (): boolean => innerWidth < 760

  /* ---------------------------------------------------------------- the air */
  function dress(): void {
    scene.background = new Color('#aeb1a6')
    scene.fog = new Fog('#b3b3a6', 45, 190)
    const lift = smoothstep(-0.09, 0.62, positionWorldDirection.y)
    scene.backgroundNode = mix(color('#c9bfa6'), color('#8ea3a6'), lift).mul(
      mx_noise_float(positionWorldDirection.mul(6)).mul(0.02).add(1)
    )
  }

  function laid(): Mesh {
    if (ground) return ground
    const material = new MeshStandardNodeMaterial({ color: '#7b7359', roughness: 0.97 })
    material.name = 'bench ground'
    material.side = DoubleSide
    const set = stack.materials.sync('earth-packed')
    stack.detail(material, set, { maps: 0.55, count: 3, scales: [3.6, 0.62, 0.07], mid: 0.22, macro: 0.62, fade: [34, 170] })
    const grit = mx_noise_float(positionWorld.mul(46))
    const bulk = mx_noise_float(positionWorld.mul(1.7))
    material.colorNode = material.colorNode!.mul(grit.mul(0.07).add(bulk.mul(0.16)).add(0.9))
    material.normalNode = bumpMap(grit.mul(0.002).add(bulk.mul(0.006)), 1)
    /* the body carries its own occlusion and cannot cast it onto a ground it
       was never baked with, so the sky's fill is closed at its foot the way a
       wall closes it: full at the face, gone a stride out */
    const skirt = float(1).sub(
      smoothstep(0, 1.4, positionWorld.x.abs().max(positionWorld.z.abs()).sub(4.05).max(0))
    )
    material.aoNode = float(1).sub(skirt.mul(0.45))
    groundMaterial = material
    const mesh = new Mesh(metrePlane(220, 220, 40, 40), material)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = -0.02
    mesh.receiveShadow = true
    mesh.name = 'The bench ground'
    ground = mesh
    around.add(mesh)
    return mesh
  }

  /* ------------------------------------------------------------- the body */
  async function stand(want: BenchObject): Promise<void> {
    const slug = want.tiers[stack.tierName()]
    const asset = await stack.models.load(slug)
    const placed = await stack.models.place(slug, { position: [0, 0, 0], snap: 'origin' })
    placed.name = want.title
    around.add(placed)
    body = placed
    bounds = new Box3().setFromObject(placed as never)
    bodyMaterials = new Set()
    counted = { tris: 0, draws: 0, textureMB: asset.textureMB, texelsPerMetre: asset.texelsPerMetre }
    placed.traverse((child: Object3D) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      counted.draws += 1
      const geometry = mesh.geometry as BufferGeometry
      const index = geometry.getIndex()
      counted.tris += Math.floor((index ? index.count : (geometry.getAttribute('position')?.count ?? 0)) / 3)
      mesh.castShadow = true
      mesh.receiveShadow = true
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        bodyMaterials.add(material as MeshStandardNodeMaterial)
      }
    })
    for (const material of bodyMaterials) {
      /* the bake's own light is not carried: no emissive channel arrives and
         none is invented here */
      material.emissive.setRGB(0, 0, 0)
      material.emissiveMap = null
      material.emissiveIntensity = 1
      /* A FLOOR UNDER THE MEASURED OCCLUSION. It reaches zero where the bake
         found a closed pocket, and zero ambient draws that pocket as a hole
         punched through the wall rather than as shade. */
      material.aoNode = materialAO.mul(0.84).add(0.16)
      material.needsUpdate = true
    }
  }

  /* ---------------------------------------------------------- the stations */
  function radiusAlong(direction: Vector3): number {
    const size = bounds.getSize(new Vector3())
    return (
      Math.abs(direction.x) * size.x * 0.5 +
      Math.abs(direction.y) * size.y * 0.5 +
      Math.abs(direction.z) * size.z * 0.5
    )
  }

  /** the vertical field that holds the whole body from where the eye stands */
  function fitted(at: Vector3, look: Vector3, aspect: number): number {
    const forward = look.clone().sub(at).normalize()
    const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize()
    const up = new Vector3().crossVectors(right, forward).normalize()
    let tan = 0.08
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          const corner = new Vector3(x, y, z).sub(at)
          const depth = corner.dot(forward)
          if (depth <= 0.05) continue
          tan = Math.max(tan, Math.abs(corner.dot(up)) / depth, Math.abs(corner.dot(right)) / depth / aspect)
        }
      }
    }
    return Math.min(70, (Math.atan(tan * 1.08) * 360) / Math.PI)
  }

  function aim(): void {
    if (!viewport || !piece || !body) return
    const rect = viewport.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return
    if (rect.width !== width || rect.height !== height) {
      width = rect.width
      height = rect.height
      stack.setSize(width, height)
    }
    const station: Station = piece.stations[state]
    const phone = narrow()
    const look = new Vector3(...station.at)
    const bearing = new Vector3(...station.from).normalize()
    const fov = phone ? (station.phoneFov ?? station.fov) : station.fov
    const distance = fov ? station.metres : station.metres + radiusAlong(bearing)
    const at = look.clone().addScaledVector(bearing, distance)
    camera.aspect = width / height
    camera.position.copy(at)
    camera.lookAt(look)
    camera.fov = fov ?? fitted(at, look, camera.aspect)
    camera.near = Math.max(0.02, station.metres / 40)
    camera.far = Math.max(200, distance * 12)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld(true)
  }

  function lighting(): void {
    if (!piece) return
    const hour = piece.hour
    key = stack.light({
      azimuth: hour.azimuth,
      elevation: hour.elevation,
      kelvin: hour.kelvin,
      lux: hour.lux,
      ambient: 0.36,
      /* a twelve metre body under a seventeen degree sun throws its shadow
         forty metres: a nearer cascade cuts it off in a straight line across
         the ground, which reads as a second building nobody built */
      reach: 68,
      cascades: [24, 52],
      probe,
    })
    key.fill.color.set('#b9bec0')
    key.fill.groundColor.set('#6d6349')
    key.fill.intensity = 0.34
    scene.environmentIntensity = 0.4
  }

  /* ----------------------------------------------------------- the chrome */
  function build(): void {
    host = node('main', 'ob')
    host.tabIndex = -1
    const style = node('style', '')
    style.textContent = css
    host.append(style)
    viewport = node('section', 'ob-viewport')
    viewport.setAttribute('aria-label', `${piece?.title ?? 'An object'} on the bench, seen from four stations`)
    if (stack.renderer.domElement) viewport.append(stack.renderer.domElement)
    host.append(viewport)

    const header = node('header', 'ob-header')
    const brand = node('p', 'ob-brand', 'Agora Cosmica')
    brand.dataset['naBrand'] = ''
    header.append(brand, node('p', 'ob-kicker', piece?.kicker ?? ''), node('h1', 'ob-heading', piece?.title ?? ''))
    header.append(node('p', 'ob-hour', piece?.hour.label ?? ''))
    host.append(header)

    note = node('aside', 'ob-label', piece?.label ?? '')
    note.id = 'ob-label'
    note.dataset['naClaim'] = piece?.certainty ?? 'inferred'
    note.dataset['naAnchor'] = piece ? piece.tiers[stack.tierName()] : ''
    note.dataset['naAnchorClass'] = 'GENERATED'
    host.append(note)

    drawer = node('aside', 'ob-drawer')
    drawer.id = 'ob-drawer'
    drawer.dataset['register'] = 'drawer'
    drawer.tabIndex = -1
    drawer.hidden = true
    drawer.setAttribute('role', 'region')
    drawer.setAttribute('aria-labelledby', 'ob-drawer-title')
    const drawerTitle = node('h2', '', 'How this object was made')
    drawerTitle.id = 'ob-drawer-title'
    drawer.append(drawerTitle)
    for (const paragraph of piece?.sources ?? []) drawer.append(node('p', '', paragraph))
    const record = node('div', 'ob-record')
    record.dataset['register'] = 'record'
    record.append(node('h3', '', 'The record'))
    for (const line of piece?.record ?? []) record.append(node('p', '', line))
    record.append(node('p', 'ob-record-live', ''))
    for (const entry of entries) {
      record.append(node('p', '', `${entry.id} · ${entry.class} · ${entry.licence}`))
    }
    drawer.append(record)
    const close = document.createElement('button')
    close.type = 'button'
    close.textContent = 'Close'
    close.onclick = () => showDrawer(false)
    drawer.append(close)
    host.append(drawer)

    const footer = node('footer', 'ob-footer')
    const rail = node('nav', 'ob-rail')
    rail.setAttribute('aria-label', 'Stations')
    rail.dataset['naPersistent'] = ''
    controls = OBJECT_STATES.map((id, i) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = `0${i + 1}  ${piece?.stations[id].title ?? id}`
      button.onclick = () => select(id, true)
      rail.append(button)
      return button
    })
    const claim = document.createElement('button')
    claim.type = 'button'
    claim.className = 'ob-certainty'
    claim.textContent = `●  ${piece?.certaintyWord ?? ''}`
    claim.setAttribute('aria-controls', 'ob-label')
    claim.dataset['naClaim'] = piece?.certainty ?? 'inferred'
    claim.dataset['naAnchor'] = piece ? piece.tiers[stack.tierName()] : ''
    claim.dataset['naAnchorClass'] = 'GENERATED'
    claim.dataset['naPersistent'] = ''
    claim.onclick = () => {
      labelMode = labelMode === 2 ? 1 : 2
      sync()
    }
    const sources = document.createElement('button')
    sources.type = 'button'
    sources.className = 'ob-sources'
    sources.textContent = 'How this was made'
    sources.dataset['naPersistent'] = ''
    sources.setAttribute('aria-controls', 'ob-drawer')
    sources.setAttribute('aria-expanded', 'false')
    sources.onclick = () => showDrawer(drawer?.hidden ?? false)
    drawerButton = sources
    footer.append(node('p', 'ob-station', ''), rail, claim, sources)
    host.append(footer)
    document.body.append(host)

    events = new AbortController()
    addEventListener('keydown', keydown, { signal: events.signal })
    addEventListener('resize', () => {
      width = 0
      height = 0
    }, { signal: events.signal })
    host.focus({ preventScroll: true })
  }

  function showDrawer(show: boolean): void {
    if (!drawer) return
    const restore = !show && drawer.contains(document.activeElement)
    drawer.hidden = !show
    drawerButton?.setAttribute('aria-expanded', String(show))
    if (show) drawer.focus({ preventScroll: true })
    else if (restore) drawerButton?.focus({ preventScroll: true })
  }

  function keydown(event: KeyboardEvent): void {
    if (!active || event.ctrlKey || event.metaKey || event.altKey) return
    if (event.target instanceof Element && event.target.closest('input,select,textarea')) return
    if (event.key.toLowerCase() === 'l') {
      event.preventDefault()
      labelMode = (labelMode + 1) % 3
      sync()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      showDrawer(false)
      labelMode = 1
      sync()
      return
    }
    if (!drawer?.hidden) return
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const here = OBJECT_STATES.indexOf(state)
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
    const next =
      event.key === 'Home' ? 0
      : event.key === 'End' ? OBJECT_STATES.length - 1
      : Math.min(OBJECT_STATES.length - 1, Math.max(0, here + (forward ? 1 : -1)))
    select(OBJECT_STATES[next] as ObjectState, true)
    controls[next]?.focus({ preventScroll: true })
  }

  function sync(): void {
    if (!host || !piece) return
    host.dataset['state'] = state
    host.dataset['object'] = piece.id
    controls.forEach((button, i) => button.setAttribute('aria-pressed', String(OBJECT_STATES[i] === state)))
    if (note) note.hidden = labelMode < 2
    const claim = host.querySelector<HTMLButtonElement>('.ob-certainty')
    if (claim) {
      claim.hidden = labelMode === 0
      claim.setAttribute('aria-expanded', String(labelMode === 2))
    }
    const station = piece.stations[state]
    const line = host.querySelector('.ob-station')
    // a phone has no room for the second clause and no need of it: the note
    // says how the station was composed, which is a desk reading
    if (line) line.textContent = narrow() ? station.title : `${station.title} · ${station.note}`
    const live = host.querySelector('.ob-record-live')
    if (live) {
      const cost = stack.cost()
      live.textContent =
        `Standing at ${stack.tierName()}: ${counted.draws} draw calls, ${counted.tris.toLocaleString('en')} triangles, ` +
        `${counted.textureMB.toFixed(1)} MB of texture on the body and ${cost.textureMB.toFixed(1)} MB in the frame, ` +
        `${counted.texelsPerMetre} texels per metre on the atlas.`
    }
    /* a station standing in a wall's own shade is graded for that, the way a
       room inside a building is: the museum's exposure, at this station */
    stack.setScene(scene, camera, { ...GRADE, exposure: station.exposure ?? GRADE.exposure })
    aim()
  }

  function select(id: ObjectState, address = false): void {
    state = id
    sync()
    if (address && piece && location.pathname !== `/bench/vinci/object/${piece.id}`) {
      history.replaceState({}, '', `/bench/vinci/object/${piece.id}${location.search}`)
    }
  }

  async function open(options: BenchOptions = {}): Promise<void> {
    const ticket = ++serial
    const wanted = String(options['slug'] ?? options['object'] ?? piece?.id ?? objectIds()[0] ?? '')
    const asked = String(options['state'] ?? '')
    const next = objectFor(wanted)
    if (!next) {
      console.warn(`the object bench has no object named ${wanted}`)
      return
    }
    if ((OBJECT_STATES as readonly string[]).includes(asked)) state = asked as ObjectState
    document.body.dataset['forge'] = 'pending'
    if (piece && piece.id !== next.id) clear()
    piece = next
    if (!body) {
      dress()
      const manifest = await loadManifest()
      if (ticket !== serial) return
      const sky = await stack.hdri(next.hour.sky)
      if (ticket !== serial) return
      probe = sky.texture
      probeEntry = sky.entry
      await stand(next)
      if (ticket !== serial) return
      entries = [
        ...Object.values(next.tiers).flatMap((id) => {
          const entry = manifest.byId.get(id)
          return entry ? [entry] : []
        }),
        ...(probeEntry ? [probeEntry] : []),
      ]
      laid()
    }
    if (!active) {
      active = true
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
      build()
    }
    /* THE SCENE BEFORE THE KEY. The stack keeps one key per scene and installs
       it into the scene it is holding, so a light asked for before this bench
       has handed over its own scene lands in the one before it, and the body
       stands in a frame with no sun in it at all. */
    stack.setScene(scene, camera, GRADE)
    if (!key?.live()) lighting()
    ready = true
    sync()
    if (options['sources'] === true) showDrawer(true)
    document.body.dataset['phase'] = 'bench'
    document.body.dataset['forge'] = 'bench'
  }

  function clear(): void {
    if (body) {
      around.remove(body)
      body = null
    }
    bodyMaterials.clear()
    entries = []
  }

  function close(): void {
    serial++
    events?.abort()
    events = null
    active = false
    ready = false
    key?.dispose()
    key = null
    clear()
    if (ground) {
      around.remove(ground)
      ground.geometry.dispose()
      ground = null
    }
    groundMaterial?.dispose()
    groundMaterial = null
    const restore = host?.contains(document.activeElement)
    if (stage && stack.renderer.domElement) stage.append(stack.renderer.domElement)
    host?.remove()
    host = null
    viewport = null
    note = null
    drawer = null
    drawerButton = null
    controls = []
    width = 0
    height = 0
    stack.setSize(innerWidth, innerHeight)
    if (restore && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true })
    returnFocus = null
  }

  return {
    open,
    close,
    frame(dt: number) {
      if (!active) return
      aim()
      stack.render(dt)
    },
    reading: () => ({
      station: Math.max(0, OBJECT_STATES.indexOf(state)),
      stations: OBJECT_STATES.length,
      stationId: state,
      stationIds: [...OBJECT_STATES],
      texturesPending: ready ? stack.materials.pending() + stack.models.pending() : 1,
    }),
    manifest: () => entries,
    ids: () => OBJECT_STATES,
    station(id: string) {
      if ((OBJECT_STATES as readonly string[]).includes(id)) {
        select(id as ObjectState, true)
        return true
      }
      if (objectFor(id)) {
        void open({ slug: id })
        return true
      }
      return false
    },
    telemetry: () => ({
      object: piece?.id ?? null,
      state,
      ready,
      tier: stack.tierName(),
      viewport: narrow() ? 'mobile' : 'desktop',
      body: { ...counted, bounds: bounds.getSize(new Vector3()).toArray(), floor: bounds.min.y },
      camera: { position: camera.position.toArray(), fov: camera.fov, aspect: camera.aspect },
      key: piece ? { ...piece.hour, direction: key?.direction.toArray() ?? null } : null,
      cost: stack.cost(),
      labels: readLabels(),
      manifest: entries.map((entry) => ({ id: entry.id, class: entry.class, licence: entry.licence })),
      baked: { light: false, occlusion: 'orm.r' },
    }),
    relight: () => {
      if (active && ready) lighting()
    },
    lights: () => ({ rigs: key?.live() ? 1 : 0, sceneObjects: scene.children.length }),
    reloadOnTier: true,
  }
}

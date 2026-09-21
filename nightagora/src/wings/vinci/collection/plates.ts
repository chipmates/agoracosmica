/** The picture module's sources on the room's existing measured fields.
 * The room owns the placements and its light. The picture module owns source
 * admission, source windows, image decoding, upload sizes and transitions. */
import {
  BufferGeometry, ClampToEdgeWrapping, DataArrayTexture, Float32BufferAttribute, Group, LinearFilter,
  LinearMipmapLinearFilter, Matrix3, Mesh, MeshBasicNodeMaterial, PlaneGeometry, RGBAFormat, SRGBColorSpace,
  TSL as THREE_TSL, UnsignedByteType, Vector3,
} from 'three/webgpu'
import { loadManifest, type ManifestIndex } from '../../../manifest'
import type { Stack, TierName } from '../../../stack'
import { findPlateEntries, getWork, reproductionCardSize, type PictureWork, type ResolvedPicturePlate } from '../pictures/register'
import { trueScale } from '../pictures/scale'
import { pictureDisplayUV, pictureDisplayWindow } from '../pictures/registration'
import { ARCH_MASK_MANIFEST_ID, buildArchShoulderGeometry, pictureArchMask } from '../pictures/arch-mask'
import { createPlateStream, type PlateStream } from '../pictures/stream'
import { registerVinciStripThumb, releaseVinciStripThumb } from './strip'
import { vinciApproachReachMetres } from './approaches'
import { bodySheetSources, type BodySheetSource } from './body-wall'
import { hangPlacements } from './hang'
import { COURT, SUPPER_WALL } from './layout'
import { collectionInteriorMaterial, collectionPlateTone } from './materials'

export interface CollectionPictureSource {
  readonly work: PictureWork
  readonly entry: ResolvedPicturePlate
}
interface Placement extends CollectionPictureSource {
  readonly width: number
  readonly height: number
  readonly position: readonly [number, number, number]
  readonly bearing: number
}
interface Card {
  /** The manifest record the room's one full-resolution slot is keyed on. */
  id: string
  mesh: Mesh
  stream: PlateStream
  normal: Vector3
  /** The wall whose one draw carries this card's preview; null draws itself. */
  wall: Wall | null
}
type Wall = 'paintings' | 'sheets'
/** One wall's previews in one draw: every preview a layer of one array
 * texture, every card a quad of one geometry. */
interface Batch {
  mesh: Mesh
  texture: DataArrayTexture
  bytes: number
  arrived: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arrival: any
}

// The node overload boundary stays local to this file. The namespace comes
// through `three/webgpu`, the one import the room's offline check provides.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TSL = THREE_TSL as unknown as Record<string, any>

/** The wall's list and the store's register have to agree. A field whose
 * work the register does not admit is not quietly skipped: the room says so
 * and stands nothing, because a frame with nothing in it reads as a refusal
 * the register did not make. */
function placements(manifest: ManifestIndex): readonly Placement[] {
  const placed: Placement[] = []
  for (const field of hangPlacements()) {
    const work = getWork(field.id)
    const scale = trueScale(work)
    if (!scale || Math.abs(scale.widthM - field.width) > 1e-9 || Math.abs(scale.heightM - field.height) > 1e-9)
      throw new Error(`Room field disagrees with the holder's dimensions: ${work.id}`)
    const entry = findPlateEntries(work, manifest).find(source => source.face === field.face)
    if (!entry) throw new Error(`Room field has no admitted ${field.face} source: ${work.id}`)
    placed.push({ work, entry, width: field.width, height: field.height,
      position: [field.east, field.datum, -field.north], bearing: Math.PI })
  }
  // The mural uses the same policy and the existing court wall. If its source
  // is absent, the wall's original measured outline remains untouched.
  const work = getWork('last-supper'), scale = trueScale(work)
  const entry = findPlateEntries(work, manifest).find(source => source.face === 'front')
  if (entry) {
    const S = SUPPER_WALL
    if (!scale || scale.widthM !== S.field.width || scale.heightM !== S.field.height)
      throw new Error('Supper field disagrees with the holder dimensions')
    placed.push({ work, entry, width: S.field.width, height: S.field.height,
      position: [S.east + S.thickness / 2 + .0005, COURT.level + S.field.sill + S.field.height / 2, -S.north],
      bearing: Math.PI / 2 })
  }
  return placed
}

/** The source is uniformly contained inside the carrier: one axis fills it,
 * the other stays shorter. Nothing is stretched to make both axes fit. */
function containedSize(widthM: number, heightM: number, pixelWidth: number, pixelHeight: number): { widthM: number; heightM: number } {
  const metresPerPixel = Math.min(widthM / pixelWidth, heightM / pixelHeight)
  return { widthM: pixelWidth * metresPerPixel, heightM: pixelHeight * metresPerPixel }
}

export function mountCollectionPlates(host: Group, stack: Stack) {
  const group = new Group()
  group.name = 'vinci/collection-plates'
  // shown by distance, so the entry's sweep draws it once
  group.userData['naWarm'] = true
  /** the preview addresses whose thumbnails this mount registered */
  const thumbed = new Set<string>()
  host.add(group)
  const masks = collectionInteriorMaterial()
  const tone = collectionPlateTone()
  let live = true, loading = true, epoch = 0, selectedId = ''
  let tier: TierName = stack.tierName()
  let fields: readonly Placement[] = []
  let sheetFields: readonly BodySheetSource[] = []
  let cards: Card[] = []
  let batches: Batch[] = []
  /** While a payload holds the stage the room's one full slot stands empty. */
  let held = false
  /** THE SLOT DOES NOT CHASE A WALK. While an aim stands, the near rule is
   * measured from the eye the walk will land on instead of from the body, so a
   * run past twenty-five works carries one request, for the stop it ends at,
   * and has the whole leg to arrive. */
  let aimed: Vector3 | undefined
  let failure: string | null = null
  const changes = new Set<Promise<void>>()
  const reported = new Set<string>()
  const position = new Vector3(), toEye = new Vector3()
  const textureMB = () => cards.reduce((sum, card) => sum + card.stream.textureMB(), 0)
    + batches.reduce((sum, batch) => sum + batch.bytes / 1048576, 0)
  const unregisterMemory = stack.registerTextureMemory(textureMB, 'collection plates')
  const errors = (): readonly string[] => [failure, ...cards.map(card => card.stream.error())]
    .filter((error): error is string => error !== null)
  function reportErrors(): void {
    for (const error of errors()) if (!reported.has(error)) {
      reported.add(error)
      console.error(`Collection picture: ${error}`)
    }
  }

  function strike(): void {
    ++epoch
    selectedId = ''
    for (const card of cards) card.stream.dispose()
    cards = []
    for (const batch of batches) {
      batch.texture.dispose()
      ;(batch.mesh.material as MeshBasicNodeMaterial).dispose()
    }
    batches = []
    group.traverse(child => { if (child instanceof Mesh) child.geometry.dispose() })
    group.clear()
  }

  function mount(): Promise<void> {
    strike()
    mountPictures()
    mountSheets()
    group.updateMatrixWorld(true)
    const current = epoch
    return Promise.all(cards.map(card => card.stream.ready))
      .then(() => Promise.all(cards.map(card => (card.stream.thumbnail?.(128) ?? Promise.resolve(null)).then(made => {
        if (!made || !live || current !== epoch) return
        registerVinciStripThumb(made.url, URL.createObjectURL(made.blob))
        thumbed.add(made.url)
      }).catch(() => {}))))
      .then(() => {
        if (!live || current !== epoch) return
        for (const wall of ['paintings', 'sheets'] as const) batch(wall)
      })
  }

  /** A WALL OF PREVIEWS IS A FEW DRAWS. Each preview is copied once, at its
   * own upload size and from its own origin, into a layer of an array texture,
   * with its last row and column carried into the layer's margin so no mip
   * reads past the picture's edge. Previews of like proportion share an array,
   * so a portrait never pays for a landscape's width. The card keeps its mesh
   * for the pick and the close look, and draws only while its earned plate is
   * raised. */
  function batch(wall: Wall): void {
    const taken = cards.filter(card => card.wall === wall)
      .map(card => ({ card, bitmap: card.stream.takePreview?.() ?? null }))
      .filter((item): item is { card: Card; bitmap: ImageBitmap } => item.bitmap !== null)
      .sort((x, y) => x.bitmap.width / x.bitmap.height - y.bitmap.width / y.bitmap.height)
    // a new array opens where joining the last one would pad it by an eighth
    let run: typeof taken = []
    let area = 0
    for (const item of taken) {
      const next = [...run, item]
      const width = Math.max(...next.map(({ bitmap }) => bitmap.width))
      const height = Math.max(...next.map(({ bitmap }) => bitmap.height))
      const held = area + item.bitmap.width * item.bitmap.height
      if (run.length && width * height * next.length > held * 1.125) {
        pack(wall, run)
        run = [item]
        area = item.bitmap.width * item.bitmap.height
      } else {
        run = next
        area = held
      }
    }
    if (run.length) pack(wall, run)
  }

  function pack(wall: Wall, taken: readonly { card: Card; bitmap: ImageBitmap }[]): void {
    const W = Math.max(...taken.map(({ bitmap }) => bitmap.width))
    const H = Math.max(...taken.map(({ bitmap }) => bitmap.height))
    const layers = taken.length
    const data = new Uint8Array(W * H * 4 * layers)
    const canvas = new OffscreenCanvas(W, H)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('No canvas for the plate batch')
    context.imageSmoothingEnabled = false
    const position: number[] = [], normal: number[] = [], coordinates: number[] = [], layer: number[] = [], index: number[] = []
    const point = new Vector3(), facing = new Vector3(), turn = new Matrix3(), centre = new Vector3()
    for (const { card } of taken) centre.add(card.mesh.position)
    centre.divideScalar(taken.length)
    taken.forEach(({ card, bitmap }, at) => {
      const { width, height } = bitmap
      context.clearRect(0, 0, W, H)
      context.drawImage(bitmap, 0, 0)
      if (width < W) context.drawImage(bitmap, width - 1, 0, 1, height, width, 0, W - width, height)
      if (height < H) context.drawImage(bitmap, 0, height - 1, width, 1, 0, height, width, H - height)
      if (width < W && height < H) context.drawImage(bitmap, width - 1, height - 1, 1, 1, width, height, W - width, H - height)
      data.set(context.getImageData(0, 0, W, H).data, at * W * H * 4)
      bitmap.close()
      card.mesh.updateMatrix()
      turn.getNormalMatrix(card.mesh.matrix)
      const geometry = card.mesh.geometry
      const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal'), t = geometry.getAttribute('uv')
      const base = position.length / 3
      for (let i = 0; i < p.count; i++) {
        point.fromBufferAttribute(p, i).applyMatrix4(card.mesh.matrix).sub(centre)
        facing.fromBufferAttribute(n, i).applyMatrix3(turn).normalize()
        position.push(point.x, point.y, point.z)
        normal.push(facing.x, facing.y, facing.z)
        coordinates.push(t.getX(i) * width / W, t.getY(i) * height / H)
        layer.push(at)
      }
      const order = geometry.getIndex()
      for (let i = 0; i < (order?.count ?? p.count); i++) index.push(base + (order ? order.getX(i) : i))
    })
    const name = `vinci/collection-plates/${wall}/${batches.length}`
    const pages = new DataArrayTexture(data, W, H, layers)
    pages.name = name
    pages.format = RGBAFormat
    pages.type = UnsignedByteType
    pages.colorSpace = SRGBColorSpace
    pages.wrapS = ClampToEdgeWrapping
    pages.wrapT = ClampToEdgeWrapping
    pages.magFilter = LinearFilter
    pages.minFilter = LinearMipmapLinearFilter
    pages.generateMipmaps = true
    // the wall is read along its own length, so the sampler is allowed the
    // same anisotropy the stack's own sets are given
    pages.anisotropy = 8
    pages.needsUpdate = true
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(position, 3))
    geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(coordinates, 2))
    geometry.setAttribute('plateLayer', new Float32BufferAttribute(layer, 1))
    geometry.setIndex(index)
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    const arrival = TSL.uniform(0)
    const material = new MeshBasicNodeMaterial()
    material.name = name
    // the layer index is exact on every vertex; the half keeps the cast off its floor
    const sample = TSL.texture(pages, TSL.uv()).depth(TSL.attribute('plateLayer', 'float').add(.5))
    material.colorNode = sample.rgb.mul(tone)
    material.opacityNode = arrival
    material.transparent = true
    material.depthWrite = false
    material.toneMapped = false
    const mesh = new Mesh(geometry, material)
    mesh.name = name
    mesh.position.copy(centre)
    // drawn before every other transparent surface: a raised card and any
    // glass in front of the wall then sort among themselves as they did
    mesh.renderOrder = -1
    mesh.castShadow = false
    mesh.userData = { manifestId: 'vinci/collection-plates', asset: 'vinci/collection-plates',
      assetClass: 'GENERATED', previewIds: taken.map(({ card }) => card.mesh.userData['previewId']) }
    group.add(mesh)
    group.updateMatrixWorld(true)
    let bytes = 0
    for (let w = W, h = H; ; w = Math.max(1, w >> 1), h = Math.max(1, h >> 1)) {
      bytes += w * h * 4 * layers
      if (w === 1 && h === 1) break
    }
    const made: Batch = { mesh, texture: pages, bytes, arrived: performance.now(), arrival }
    batches.push(made)
  }

  function mountPictures(): void {
    for (const field of fields) {
      const { work, entry } = field
      const registration = pictureDisplayWindow(entry.plate)
      const window = registration ? pictureDisplayUV(registration) : null
      const pixels = window ? { width: window.contentAspect, height: 1 } : entry.pixels
      const size = reproductionCardSize(work, pixels)
      const geometry = new PlaneGeometry(size.widthM, size.heightM)
      if (window) {
        const uv = geometry.getAttribute('uv')
        for (let i = 0; i < uv.count; i++) uv.setXY(i,
          window.offsetU + uv.getX(i) * window.scaleU, window.offsetV + uv.getY(i) * window.scaleV)
        uv.needsUpdate = true
      }
      // The mural stands alone on its own wall and draws itself.
      const wall: Wall | null = work.id === 'last-supper' ? null : 'paintings'
      const stream = createPlateStream(entry.preview, entry.plate,
        { previewMaxEdge: tier === 'hero' ? 1024 : 512, tone, layered: wall !== null })
      const mesh = new Mesh(geometry, stream.material)
      mesh.name = `vinci/collection-plates/${entry.id}`
      mesh.position.set(...field.position)
      mesh.rotation.y = field.bearing
      mesh.visible = false
      // The existing opaque field and frame already cast their own shadows.
      // A transparent source introduces no new caster into the static cache.
      mesh.castShadow = false
      mesh.userData = {
        manifestId: entry.plate.id, asset: entry.plate.id, assetClass: entry.plate.class,
        workId: work.id, face: entry.face, previewId: entry.preview.id,
        measuredField: { widthM: field.width, heightM: field.height, centreY: field.position[1] },
        sourceWindow: window, physicalRegistration: false, light: 'collection openings and fittings',
      }
      group.add(mesh)
      cards.push({ id: entry.id, mesh, stream, normal: new Vector3(Math.sin(field.bearing), 0, Math.cos(field.bearing)), wall })
      const current = epoch
      void stream.ready.then(() => { if (live && current === epoch) mesh.visible = stream.available() })
      const arch = pictureArchMask(entry.plate)
      if (arch) {
        const geometry = buildArchShoulderGeometry(arch, { widthM: size.widthM, heightM: size.heightM, window: window ?? undefined })
        geometry.setAttribute('collectionRoomRole', new Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count).fill(4), 1))
        const mask = new Mesh(geometry, masks)
        mask.name = `vinci/collection-plates/source-shoulder/${entry.id}`
        mask.position.copy(mesh.position)
        mask.rotation.copy(mesh.rotation)
        mask.translateZ(.0004)
        mask.receiveShadow = true
        mask.userData = { manifestId: ARCH_MASK_MANIFEST_ID, asset: ARCH_MASK_MANIFEST_ID,
          assetClass: 'GENERATED', certainty: 'reconstructed', workId: work.id, physicalRegistration: false }
        group.add(mask)
      }
    }
  }

  /** The body wall. Each sheet hangs at the size its holder records, and the
   * three without a recorded size at a constant area; the reproduction is
   * contained in that field without stretching. The sheets share the room's
   * single full resolution slot with the paintings. */
  function mountSheets(): void {
    for (const source of sheetFields) {
      const { sheet, page, preview } = source
      const size = containedSize(sheet.width, sheet.height, page.width, page.height)
      const geometry = new PlaneGeometry(size.widthM, size.heightM)
      const stream = createPlateStream(preview, page,
        { previewMaxEdge: tier === 'hero' ? 1024 : 512, tone, family: 'sheet', layered: true })
      const mesh = new Mesh(geometry, stream.material)
      mesh.name = `vinci/collection-plates/${sheet.id}`
      mesh.position.set(sheet.east + .004, sheet.datum, -sheet.north)
      mesh.rotation.y = Math.PI / 2
      mesh.visible = false
      mesh.castShadow = false
      mesh.userData = {
        manifestId: page.id, asset: page.id, assetClass: page.class,
        sheetId: sheet.id, sheet: page.sheet, previewId: preview.id,
        carrier: { widthM: sheet.width, heightM: sheet.height, centreY: sheet.datum },
        measuredSheet: sheet.measured ?? null, sourceWindow: null,
        physicalRegistration: false, light: 'collection openings and fittings',
      }
      group.add(mesh)
      cards.push({ id: page.id, mesh, stream, normal: new Vector3(1, 0, 0), wall: 'sheets' })
      const current = epoch
      void stream.ready.then(() => { if (live && current === epoch) mesh.visible = stream.available() })
    }
  }

  /** One slot across BOTH walls. Every other full texture has completed its
   * release, including late decodes and fades, before the next is requested.
   * The reach is the module's own: the furthest eye the close look stands a
   * visitor at, so an arrival raises its plate and a room away raises none. */
  function streamNear(eye: Vector3): void {
    if (held) return
    let selected: Card | undefined, nearest = Math.max(2.2, vinciApproachReachMetres() + .02)
    if (tier !== 'calm') {
      const cost = stack.cost()
      const previews = cards.reduce((sum, card) => sum + card.stream.allocation().previewMB + 4 / 1048576, 0)
      const other = cost.textureMB - textureMB()
      for (const card of cards) {
        if (!card.mesh.visible || other + previews + card.stream.allocation().fullMB > cost.budget.textureMB) continue
        card.mesh.getWorldPosition(position)
        toEye.copy(eye).sub(position)
        const distance = toEye.length()
        if (distance < nearest && toEye.dot(card.normal) > 0) { selected = card; nearest = distance }
      }
    }
    const nextId = selected?.id ?? ''
    if (nextId === selectedId) return
    selectedId = nextId
    const current = ++epoch
    const change = Promise.all(cards.filter(card => card !== selected).map(card => card.stream.high(false)))
      .then(async () => { if (live && current === epoch && selected) await selected.stream.high(true) })
      .catch(error => { if (live && current === epoch) failure = String(error) })
      .then(() => { if (live) reportErrors() })
    changes.add(change)
    void change.finally(() => changes.delete(change))
  }

  const ready = loadManifest().then(manifest => {
    if (!live) return
    fields = placements(manifest)
    sheetFields = bodySheetSources(manifest)
    tier = stack.tierName()
    return mount().then(reportErrors)
  }).catch(error => { if (live) { failure = String(error); strike(); reportErrors() } }).finally(() => { loading = false })

  return {
    ready,
    sources: (): readonly CollectionPictureSource[] => fields,
    sheets: (): readonly BodySheetSource[] => sheetFields,
    errors,
    pending: () => live ? Number(loading) + changes.size + cards.reduce((sum, card) => sum + card.stream.pending(), 0) : 0,
    textureMB,
    /** A DOM PAYLOAD HOLDS THE CANVAS: the room does not update under it, so
     * the release happens here, at once, and nothing is raised until the hold
     * lets go and the next update chooses again. */
    /** Where the near rule measures from while a run is under way. Cleared on
     * arrival, when the body is the eye again. */
    aim(eye: Vector3 | null): void {
      if (!eye) { aimed = undefined; return }
      if (!aimed) aimed = new Vector3()
      aimed.copy(eye)
    },
    hold(release: boolean): void {
      if (held === release || !live) return
      held = release
      if (!release) return
      selectedId = ''
      const current = ++epoch
      const change = Promise.all(cards.map(card => card.stream.high(false)))
        .catch(error => { if (live && current === epoch) failure = String(error) })
        .then(() => { if (live) reportErrors() })
      changes.add(change)
      void change.finally(() => changes.delete(change))
    },
    /** The plates stand in the rooms and are drawn when the rooms are: from
     * the street and the house they are sixty draws behind the building. */
    show(visible: boolean): void {
      if (group.visible !== visible) group.visible = visible
    },
    update(delta: number, eye: Vector3): void {
      if (!live || loading || failure) return
      if (tier !== stack.tierName()) {
        tier = stack.tierName()
        try { void mount() } catch (error) { failure = String(error); strike(); reportErrors(); return }
      }
      for (const card of cards) {
        card.stream.update(delta)
        card.mesh.visible = card.stream.available()
        // a batched card costs a draw only while its earned plate is up
        if (card.wall !== null && card.stream.raised) card.stream.material.visible = card.stream.raised()
      }
      for (const made of batches) {
        const t = Math.min(1, (performance.now() - made.arrived) / 240)
        made.arrival.value = t * t * (3 - 2 * t)
      }
      reportErrors()
      streamNear(aimed ?? eye)
    },
    dispose(): void {
      if (!live) return
      live = false
      strike()
      for (const address of thumbed) releaseVinciStripThumb(address)
      thumbed.clear()
      unregisterMemory()
      masks.dispose()
      group.removeFromParent()
    },
  }
}

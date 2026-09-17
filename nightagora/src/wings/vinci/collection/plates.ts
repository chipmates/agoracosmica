/** The picture module's sources on the room's existing measured fields.
 * The room owns the placements and its light. The picture module owns source
 * admission, source windows, image decoding, upload sizes and transitions. */
import { Float32BufferAttribute, Group, Mesh, PlaneGeometry, Vector3 } from 'three/webgpu'
import { loadManifest, type ManifestIndex } from '../../../manifest'
import type { Stack, TierName } from '../../../stack'
import { findPlateEntries, getWork, reproductionCardSize, type PictureWork, type ResolvedPicturePlate } from '../pictures/register'
import { trueScale } from '../pictures/scale'
import { pictureDisplayUV, pictureDisplayWindow } from '../pictures/registration'
import { ARCH_MASK_MANIFEST_ID, buildArchShoulderGeometry, pictureArchMask } from '../pictures/arch-mask'
import { createPlateStream, type PlateStream } from '../pictures/stream'
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
}

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
  host.add(group)
  const masks = collectionInteriorMaterial()
  const tone = collectionPlateTone()
  let live = true, loading = true, epoch = 0, selectedId = ''
  let tier: TierName = stack.tierName()
  let fields: readonly Placement[] = []
  let sheetFields: readonly BodySheetSource[] = []
  let cards: Card[] = []
  let failure: string | null = null
  const changes = new Set<Promise<void>>()
  const reported = new Set<string>()
  const position = new Vector3(), toEye = new Vector3()
  const textureMB = () => cards.reduce((sum, card) => sum + card.stream.textureMB(), 0)
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
    group.traverse(child => { if (child instanceof Mesh) child.geometry.dispose() })
    group.clear()
  }

  function mount(): void {
    strike()
    mountPictures()
    mountSheets()
    group.updateMatrixWorld(true)
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
      const stream = createPlateStream(entry.preview, entry.plate,
        { previewMaxEdge: tier === 'hero' ? 1024 : 512, tone })
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
      cards.push({ id: entry.id, mesh, stream, normal: new Vector3(Math.sin(field.bearing), 0, Math.cos(field.bearing)) })
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

  /** The body wall. Each sheet stands in a modern carrier at the proportion
   * its reproduction has; the carrier's metres are furniture and never a
   * measurement of the sheet. The sheets share the room's single full
   * resolution slot with the paintings. */
  function mountSheets(): void {
    for (const source of sheetFields) {
      const { sheet, page, preview } = source
      const size = containedSize(sheet.width, sheet.height, page.width, page.height)
      const geometry = new PlaneGeometry(size.widthM, size.heightM)
      const stream = createPlateStream(preview, page,
        { previewMaxEdge: tier === 'hero' ? 1024 : 512, tone, family: 'sheet' })
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
      cards.push({ id: page.id, mesh, stream, normal: new Vector3(1, 0, 0) })
      const current = epoch
      void stream.ready.then(() => { if (live && current === epoch) mesh.visible = stream.available() })
    }
  }

  /** One slot across BOTH walls. Every other full texture has completed its
   * release, including late decodes and fades, before the next is requested.
   * The reach is the module's own: the furthest eye the close look stands a
   * visitor at, so an arrival raises its plate and a room away raises none. */
  function streamNear(eye: Vector3): void {
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
    mount()
    return Promise.all(cards.map(card => card.stream.ready)).then(reportErrors)
  }).catch(error => { if (live) { failure = String(error); strike(); reportErrors() } }).finally(() => { loading = false })

  return {
    ready,
    sources: (): readonly CollectionPictureSource[] => fields,
    sheets: (): readonly BodySheetSource[] => sheetFields,
    errors,
    pending: () => live ? Number(loading) + changes.size + cards.reduce((sum, card) => sum + card.stream.pending(), 0) : 0,
    textureMB,
    update(delta: number, eye: Vector3): void {
      if (!live || loading || failure) return
      if (tier !== stack.tierName()) {
        tier = stack.tierName()
        try { mount() } catch (error) { failure = String(error); strike(); reportErrors(); return }
      }
      for (const card of cards) { card.stream.update(delta); card.mesh.visible = card.stream.available() }
      reportErrors()
      streamNear(eye)
    },
    dispose(): void {
      if (!live) return
      live = false
      strike()
      unregisterMemory()
      masks.dispose()
      group.removeFromParent()
    },
  }
}

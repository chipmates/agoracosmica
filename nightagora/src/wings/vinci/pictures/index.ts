import { BufferGeometry, BoxGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshStandardNodeMaterial, PerspectiveCamera, PlaneGeometry, Vector3 } from 'three/webgpu'
import * as TSL from 'three/tsl'
import type { ManifestIndex } from '../../../manifest'
import type { Stack, TierName } from '../../../stack'
import { buildFrameBatch, FRAME_MOULDING_WIDTH_M, type FramePlacement } from './frame'
import { buildBakedFrameContact } from './directional-contact'
import { findPlateEntries, reproductionCardSize, type PictureWork, type ResolvedPicturePlate } from './register'
import { createPolicyWorkLabel, policyCertainty, policyLabelText } from './policy-label'
import { isPrintedDocument, type PolicyPaintingEntry } from './policy'
import { pictureDisplayWindow, pictureDisplayUV } from './registration'
import { pictureArchMask, buildArchShoulderGeometry, ARCH_MASK_MANIFEST_ID } from './arch-mask'
import { trueScale } from './scale'
import { createPlateStream } from './stream'
import { NORTH_WINDOW_LIGHT, plateUnderAperture, underApertureOnWall, type ApertureLight } from './aperture'
export * from './register'
export * from './scale'
export * from './aperture'

const { abs, attribute, cameraPosition, clamp, float, length, max, min, mix, mx_noise_float, positionGeometry, sin, smoothstep, uv, vec2, vec3, positionWorld } = TSL as unknown as Record<string, any>
/** The narrowest board this exhibition cuts, in metres. */
export const PICTURE_MAT_BORDER_M = .045
/** Writes the moulding's opening into a geometry whose vertices are centred
 * on the same point, so one shading term serves the board and the field. */
function setRebateHalf(geometry: BufferGeometry, halfX: number, halfY: number): void {
  const count = geometry.getAttribute('position').count
  const values = new Float32Array(count * 2)
  for (let i = 0; i < count; i++) { values[i * 2] = halfX; values[i * 2 + 1] = halfY }
  geometry.setAttribute('rebateHalf', new Float32BufferAttribute(values, 2))
}
/** How far the moulding's inner lip stands above the board it holds, in
 * metres: the section's own rise from the mount face to the top of the lip. */
const REBATE_RISE_M = .022
/** How much of the board's sky the section closes, measured in from the
 * moulding's opening; the section is 52 mm wide and 45 mm deep. */
const REBATE_SKY_M = .052
/** The board's own cockle: waves about a hand across, a third of a
 * millimetre deep. The laid chain lines stay a tone on the mount that shows
 * them; as a slope on every board they read as corduroy at arm's length. */
const COCKLE_PER_M = 7
const COCKLE_RISE_M = .00034
/** A mount is proportioned to the work it surrounds. One board width for a
 * 38 cm panel and a two-metre altarpiece leaves the altarpiece with no air at
 * all inside its rebate, which is what the phone showed. Metres of mount
 * between the measured field and the rebate, from the work's own short side. */
export function pictureMatBorderM(widthM: number, heightM: number): number {
  const short = Math.min(widthM, heightM)
  if (!Number.isFinite(short) || short <= 0) return PICTURE_MAT_BORDER_M
  return Math.min(.090, Math.max(PICTURE_MAT_BORDER_M, short * .09))
}
/** Two faces of one panel hang as a pair. What is declared is the CLEAR wall
 * between their mouldings; the separation between their fields follows the
 * boards those fields carry, so a wider mount never closes the gap. */
export const PICTURE_REVERSE_CLEAR_M = .156
export const reverseFieldGapM = (matBorderM: number): number =>
  PICTURE_REVERSE_CLEAR_M + 2 * (matBorderM + FRAME_MOULDING_WIDTH_M)
/** The pair separation for a 40 mm board, kept for callers that ask for one. */
export const PICTURE_REVERSE_FIELD_GAP_M = reverseFieldGapM(.04)
/** Modern catalogue furniture, independent of the historical painting size. */
export const PICTURE_CATALOGUE_CARRIER_M = Object.freeze({ width: 1.50, height: 1.80 })

export interface HungFrame {
  work: PictureWork
  x: number
  y: number
  width: number
  height: number
  /** The mount this work's own field carries, metres, per side. */
  matBorder: number
  /** Mount plus moulding: how far the frame stands outside the field. */
  surround: number
  left: number
  right: number
  aperture: Mesh | null
  furniture: Group
  wellLabels: Array<{ mesh: Mesh; label: HTMLElement }>
  cards: Array<{ entry: ResolvedPicturePlate; mesh: Mesh; stream: ReturnType<typeof createPlateStream> }>
  dot: HTMLButtonElement
  caption: HTMLElement
  shownFaceX?: number
}

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  el.className = className
  el.textContent = text
  return el
}

export const certaintyColour = (work: PictureWork, available = work.rights_class === 'DG'): string => policyCertainty(work, available).colour

/** The current source policy overlays the unchanged historical register. */
export const createWorkLabel = createPolicyWorkLabel

/** Metre-local wall assembly. Its owner places wall as one Object3D and
 * mounts labels in its own DOM. Every original stays on its locked datum.
 */
export function buildHang(stack: Stack, register: readonly PictureWork[], manifest: ManifestIndex,
  options: { gapM?: number; aperture?: ApertureLight; skirtingM?: number } = {}) {
  const gap = options.gapM ?? .56
  // The room's skirting, so a mark below a work that hangs near the floor
  // keeps off the stone. A gallery with a taller plinth passes its own.
  const skirting = options.skirtingM ?? .112
  // The room's own window, so the hang is lit by the opening the wall is lit
  // by. A gallery with another aperture passes its own; nothing else changes.
  const light = options.aperture ?? NORTH_WINDOW_LIGHT
  if (!Number.isFinite(gap) || gap < .12) throw new Error('Invalid picture assembly gap')
  // Reject the complete input before allocating geometry, material instances,
  // DOM or asynchronous streams. A caller cannot dispose a handle that an
  // invalid later record prevented us from returning.
  const ids = new Set<string>()
  const admitted = register.map(work => {
    if (ids.has(work.id)) throw new Error(`Duplicate picture work: ${work.id}`)
    ids.add(work.id)
    return { work, size: trueScale(work), entries: findPlateEntries(work, manifest) }
  })
  const wall = new Group()
  wall.name = 'vinci/pictures/hang'
  wall.userData['manifestId'] = 'vinci/pictures/wall'
  const labels = element('div', 'picture-anchors')
  const frames: HungFrame[] = []
  const placements: FramePlacement[] = []
  // Each face has a distinct contact-cache identity; selection still names
  // one work, so both sides of the same object appear and disappear together.
  const placementWorkIds = new Map<string, string>()
  /** Their measured field stays empty on the wall in every composition. */
  const documentOnlyIds = new Set(admitted.filter(({ entries }) => entries.length > 0
    && entries.every(entry => isPrintedDocument(entry.plate as PolicyPaintingEntry))).map(({ work }) => work.id))
  const materials: MeshStandardNodeMaterial[] = []
  const geometries: BufferGeometry[] = []
  const matSet = stack.materials.sync('canvas-raw')
  const mat = new MeshStandardNodeMaterial({ color: matSet.albedo, roughness: matSet.roughness, metalness: matSet.metalness })
  // A stretched mount retains the photograph's weave, without the library's
  // extra hanging-cloth folds. The local copy never changes its shared set.
  stack.detail(mat, { ...matSet, grain: null }, { uv: vec2(positionWorld.x, positionWorld.y).mul(8), scales: [1.2,.002,.0003], macro: .12, mid: .12, micro: .20, maps: .18, fade: [12,70], count: 3 })
  materials.push(mat)
  {
    // THE BOARD ITSELF. A mount is cut stock, not a colour: the pulp clouds
    // across a sheet, the laid chain lines run one way at 26 mm, and the
    // tooth is what a visitor sees standing at the picture. All three are
    // under a pixel from six metres, so the tooth arrives with the camera.
    const local = positionGeometry.xy
    const cloud = mx_noise_float(vec3(local.x.mul(9), local.y.mul(7), 3.3))
    const chain = sin(local.x.mul(Math.PI * 2 / .026)).mul(.5).add(.5)
      .mul(float(.55).add(mx_noise_float(vec3(local.x.mul(2.1), 1.3, 8.2)).mul(.45)))
    const closeBy = float(1).sub(smoothstep(2.6, 6.4, length(positionWorld.sub(cameraPosition))))
    const tooth = mx_noise_float(vec3(local.x.mul(430), local.y.mul(430), 7.9)).mul(closeBy)
    mat.colorNode = (mat.colorNode as any).mul(float(1).add(cloud.mul(.040))
      .sub(chain.mul(.022)).add(tooth.mul(.020)))
    mat.roughnessNode = clamp((mat.roughnessNode as any).add(chain.mul(.05)).add(tooth.mul(.09)), .55, .98)
  }
  const matColour = new Color('#b8ac92')
  mat.colorNode = (mat.colorNode as any).mul(TSL.vec3(matColour.r / matSet.albedo.r, matColour.g / matSet.albedo.g, matColour.b / matSet.albedo.b))
  mat.userData['manifestId'] = 'vinci/pictures/mats'
  /** An empty measured field is an exhibit, not a picture that failed to
   * arrive. The board is cut and ruled like a mount: a margin, one ruled
   * line, a slightly sunk window inside it, the laid tooth of the board.
   * Every dimension is a fraction of the field, so the treatment reads at
   * the wall's scale and at arm's length.
   */
  const absenceMat = new MeshStandardNodeMaterial({ color: matSet.albedo, roughness: matSet.roughness, metalness: matSet.metalness })
  stack.detail(absenceMat, { ...matSet, grain: null }, { uv: vec2(positionWorld.x, positionWorld.y).mul(8), scales: [1.2,.002,.0003], macro: .12, mid: .12, micro: .20, maps: .18, fade: [12,70], count: 3 })
  materials.push(absenceMat)
  absenceMat.name = 'vinci/pictures/absence-mount'
  absenceMat.userData['manifestId'] = 'vinci/pictures/mats'
  {
    const local = positionGeometry.xy
    const half = attribute('fieldHalf', 'vec2')
    const short = min(half.x, half.y)
    const margin = short.mul(.118)
    const edge = min(half.x.sub(abs(local.x)), half.y.sub(abs(local.y)))
    // A ruled line alone is a third of a pixel from six metres, so the board
    // is cut the way a French mount is cut: the ink line carries a wash band
    // beside it, and the wash is what holds the edge at the wall's distance.
    // Every band is a fraction of the board, so a small field keeps them all.
    const band = (from: number, to: number, soft: number): any =>
      smoothstep(margin.mul(from).sub(soft), margin.mul(from).add(soft), edge)
        .mul(float(1).sub(smoothstep(margin.mul(to).sub(soft), margin.mul(to).add(soft), edge)))
    const window = smoothstep(margin, margin.add(.0016), edge)
    const ruled = band(.40, .455, .0007)
    const wash = band(.47, .80, .0011)
    const bevel = band(.94, 1.0, .0008)
    // laid board: chain lines every 26 mm, a slow cloud in the pulp, the tooth
    const chain = sin(local.x.mul(Math.PI * 2 / .026)).mul(.5).add(.5)
      .mul(float(.62).add(mx_noise_float(vec3(local.x.mul(2.4), .7, 5.5)).mul(.38)))
    const cloud = mx_noise_float(vec3(local.x.mul(11), local.y.mul(9), 1.7))
    const tooth = mx_noise_float(vec3(local.x.mul(430), local.y.mul(430), 3.1))
    // THE WINDOW IS CUT, NOT PRINTED. The board is opened at forty five
    // degrees, so each of the four cut faces turns a different way: the one
    // opposite the glazing takes the light and the one under it falls away.
    // The band is the same ratio of cosines the mouldings take, so a mount
    // beside another window models itself without a constant being retuned.
    const a = light.aperture
    const toWindow = vec3(a.x, a.y, a.z).sub(positionWorld)
    const rayIn = toWindow.div(length(toWindow))
    const nearestIsSide = float(half.x.sub(abs(local.x)).lessThan(half.y.sub(abs(local.y))))
    const tiltX = mix(float(1), float(-1), float(local.x.greaterThan(0))).mul(nearestIsSide)
    const tiltY = mix(float(1), float(-1), float(local.y.greaterThan(0))).mul(float(1).sub(nearestIsSide))
    const cut = clamp(float(1).add(tiltX.mul(rayIn.x).add(tiltY.mul(rayIn.y)).div(max(rayIn.z, float(.05)))), .72, 1.26)
    const tone = float(1).sub(window.mul(.135)).sub(ruled.mul(.34)).sub(wash.mul(.10))
      .add(bevel.mul(.085))
      .sub(window.mul(chain).mul(.038)).add(cloud.mul(.046)).add(tooth.mul(.018))
      .mul(mix(float(1), cut, bevel))
    absenceMat.colorNode = (absenceMat.colorNode as any).mul(vec3(matColour.r / matSet.albedo.r, matColour.g / matSet.albedo.g, matColour.b / matSet.albedo.b)).mul(tone)
    absenceMat.roughnessNode = ((absenceMat.roughnessNode as any)).add((ruled as any).mul(.09)).add((wash as any).mul(.04)).sub((bevel as any).mul(.05))
  }
  /** THE REBATE'S OWN SHADOW.
   *
   * A board inside a moulding is not a plane in the open: the section stands
   * about 20 mm proud of it, so the jamb on the window side throws a band
   * across the board and all four jambs close part of its sky. Both come off
   * the section's own rise and the direction to the opening, so a wider
   * moulding or another window moves them without a constant being retuned.
   * `rebateHalf` is the moulding's inner opening, in the mesh's own metres.
   */
  function underRebate(m: MeshStandardNodeMaterial): void {
    const a = light.aperture
    const toward = vec3(a.x, a.y, a.z).sub(positionWorld)
    const dir = toward.div(length(toward))
    const slope = max(dir.z, float(.05))
    const rebate = attribute('rebateHalf', 'vec2')
    // A surface that declares no opening takes no rebate term at all.
    const framed = float(rebate.x.greaterThan(0).and(rebate.y.greaterThan(0)))
    const local = positionGeometry.xy
    // The window side of each axis is the side the light comes from.
    const fromJambX = mix(rebate.x.sub(local.x), rebate.x.add(local.x), float(dir.x.lessThan(0)))
    const fromJambY = mix(rebate.y.sub(local.y), rebate.y.add(local.y), float(dir.y.lessThan(0)))
    const reachX = clamp(abs(dir.x).div(slope).mul(REBATE_RISE_M), 0, .085)
    const reachY = clamp(abs(dir.y).div(slope).mul(REBATE_RISE_M), 0, .085)
    // A seven square metre opening is a wide source, so the edge of what it
    // throws is a ramp and never a line.
    const cast = max(float(1).sub(smoothstep(float(0), reachX, fromJambX)),
      float(1).sub(smoothstep(float(0), reachY, fromJambY)))
    // What the section takes out of the board's sky, on every side.
    const closed = max(float(1).sub(smoothstep(float(0), float(REBATE_SKY_M), min(fromJambX, fromJambY))), float(0))
    // THE BOARD IS NOT A PLANE. A mount cut and hinged in a rebate keeps a
    // slow cockle, a hand's width across and a few tenths of a millimetre
    // deep, and the laid chain lines stand above it. Neither is a tone: they
    // are slopes, so what a visitor sees is the room's own light crossing
    // them, in the same ratio of cosines the mouldings take.
    const wave = (x: unknown, y: unknown): any => mx_noise_float(vec3((x as any).mul(COCKLE_PER_M), (y as any).mul(COCKLE_PER_M), 4.4))
    const here = wave(local.x, local.y)
    const step = .012
    const slopeX = wave(local.x.add(step), local.y).sub(here).mul(COCKLE_RISE_M / step)
    const slopeY = wave(local.x, local.y.add(step)).sub(here).mul(COCKLE_RISE_M / step)
    const raking = clamp(float(1).add(slopeX.mul(dir.x).add(slopeY.mul(dir.y)).negate().div(slope)), .80, 1.20)
    m.colorNode = (m.colorNode as any).mul(float(1).sub(cast.mul(.26).add(closed.mul(.085)).mul(framed)))
      .mul(mix(float(1), raking, framed))
  }
  // A mount hangs on the wall and takes the wall's run; its own backing edge
  // turns toward the window like any other member.
  for (const m of [mat, absenceMat]) { underApertureOnWall(m, light); underRebate(m) }
  const plateTone = plateUnderAperture(light)
  let cursor = 0
  for (const { work, size, entries } of admitted) {
    const matBorder = pictureMatBorderM(size?.widthM ?? 1.15, size?.heightM ?? 1.1)
    const catalogue = work.display_mode === 'unillustrated_catalogue_card'
    const dimensionCard = work.display_mode === 'dimension_card_and_two_empty_image_wells'
    const outline = size !== null && !catalogue
    const width = outline ? size.widthM : catalogue ? PICTURE_CATALOGUE_CARRIER_M.width : 1.15
    const height = outline ? size.heightM : catalogue ? PICTURE_CATALOGUE_CARRIER_M.height : 1.1
    const windows = entries.map(entry => { const observation = pictureDisplayWindow(entry.plate); return observation ? pictureDisplayUV(observation) : null })
    const documentCarrier = size === null && entries.length > 0
    const sizes = entries.map((entry, i) => {
      const pixels = windows[i] ? { width: windows[i]!.contentAspect, height: 1 } : entry.pixels
      if (!documentCarrier) return reproductionCardSize(work, pixels)
      // This is the size of modern document furniture, never a painting extent.
      const factor = Math.min(width / pixels.width, .72 / pixels.height)
      return { widthM: pixels.width * factor, heightM: pixels.height * factor }
    })
    const mountedReverse = entries.map((entry, i) => outline && i > 0 && entry.face === 'reverse')
    const assembly = width + sizes.slice(1).reduce((n, s, i) => n
      + (mountedReverse[i + 1] ? width + reverseFieldGapM(matBorder) : s.widthM + .18), 0)
    const x = cursor + width / 2
    // Null historical/datumed height stays null in trueScale. These are
    // declared modern furniture placements, with adequate floor clearance.
    const y = size?.datumM ?? (work.id === 'last-supper' ? .50 : .80) + height / 2
    let aperture: Mesh | null = null
    if (outline) {
      const geometry = new PlaneGeometry(width, height)
      geometry.setAttribute('fieldHalf', new Float32BufferAttribute(
        [width / 2, height / 2, width / 2, height / 2, width / 2, height / 2, width / 2, height / 2], 2))
      setRebateHalf(geometry, width / 2 + matBorder, height / 2 + matBorder)
      geometries.push(geometry)
      aperture = new Mesh(geometry, mat)
      aperture.name = `measured-aperture/${work.id}`
      aperture.position.set(x, y, .021)
      aperture.receiveShadow = true
      aperture.userData['manifestId'] = 'vinci/pictures/mats'
      wall.add(aperture)
      placements.push({ id: work.id, x, y, width: width + 2 * matBorder, height: height + 2 * matBorder })
      placementWorkIds.set(work.id, work.id)
    }
    const furniture = new Group()
    furniture.name = `catalogue-furniture/${work.id}`
    furniture.userData['manifestId'] = 'vinci/pictures/mats'
    // A solid16mm exhibition backing seats the image at21mm from plaster.
    // Its actual volume participates in the directional wall shadow.
    function backingAt(px: number, name: string): void {
      const backingGeometry = new BoxGeometry(width + 2 * matBorder, height + 2 * matBorder, .016)
      setRebateHalf(backingGeometry, width / 2 + matBorder, height / 2 + matBorder)
      geometries.push(backingGeometry)
      const backing = new Mesh(backingGeometry, mat)
      backing.name = name
      backing.position.set(px, y, .0128)
      backing.castShadow = true
      backing.receiveShadow = true
      backing.userData['manifestId'] = 'vinci/pictures/mats'
      furniture.add(backing)
    }
    if (outline) backingAt(x, `physical-backing/${work.id}`)
    const wellLabels: HungFrame['wellLabels'] = []
    /** A board inside a moulding passes the opening it sits in; a card that
     * is not centred on that opening passes none, and takes no rebate term. */
    function paper(w: number, h: number, px: number, py: number, name: string, opening?: [number, number]): Mesh {
      const g = new PlaneGeometry(w, h)
      if (opening) setRebateHalf(g, opening[0], opening[1])
      geometries.push(g)
      const mesh = new Mesh(g, mat)
      mesh.name = name
      mesh.position.set(px, py, .021)
      mesh.receiveShadow = true
      mesh.userData['manifestId'] = 'vinci/pictures/mats'
      furniture.add(mesh)
      return mesh
    }
    if (catalogue) {
      const sheet = paper(width, height, x, y, `unillustrated-catalogue-card/${work.id}`, [width / 2 + matBorder, height / 2 + matBorder])
      sheet.userData['physicalPaintingExtent'] = null
      sheet.userData['modernCarrierM'] = { width, height }
    }
    if (dimensionCard && entries.length === 0) {
      paper(width, height * .46, x, y + height * .27, `dimension-card/${work.id}`)
      for (const [i, title] of ['Monochrome · RC', 'Vault · RC'].entries()) {
        const mesh = paper(width * .44, height * .40, x + (i === 0 ? -1 : 1) * width * .26, y - height * .30, `empty-image-well/${work.id}/${i}`)
        const label = element('div', 'picture-well-caption', `Absent\n${title}`)
        labels.append(label)
        wellLabels.push({ mesh, label })
      }
    }
    wall.add(furniture)
    const cards: HungFrame['cards'] = []
    let cardLeft = cursor + width
    for (const [i, entry] of entries.entries()) {
      const s = sizes[i]!
      if (documentCarrier) {
        // Modern document furniture is mounted to its own sheet, not to a
        // painted extent this work does not have.
        const sheetBorder = pictureMatBorderM(s.widthM, s.heightM)
        const g = new BoxGeometry(s.widthM + 2 * sheetBorder, s.heightM + 2 * sheetBorder, .016)
        geometries.push(g)
        const backing = new Mesh(g, mat)
        backing.name = `unmeasured-document-mount/${work.id}`
        backing.position.set(x, y, .0128); backing.castShadow = true; backing.receiveShadow = true
        backing.userData['manifestId'] = 'vinci/pictures/mats'
        backing.userData['physicalPaintingExtent'] = null
        furniture.add(backing)
        const mountId = `${work.id}:document`
        placements.push({ id: mountId, x, y, width: s.widthM + 2 * sheetBorder, height: s.heightM + 2 * sheetBorder })
        placementWorkIds.set(mountId, work.id)
      }
      const hasReverseMount = mountedReverse[i]!
      const slotWidth = hasReverseMount ? width : s.widthM
      if (i > 0) cardLeft += hasReverseMount ? reverseFieldGapM(matBorder) : .18
      const cardX = i === 0 ? x : cardLeft + slotWidth / 2
      if (hasReverseMount) {
        const mountId = `${work.id}:reverse`
        const reverseField = paper(width, height, cardX, y, `measured-reverse-aperture/${work.id}`,
          [width / 2 + matBorder, height / 2 + matBorder])
        reverseField.userData['workId'] = work.id
        reverseField.userData['face'] = 'reverse'
        backingAt(cardX, `physical-backing/${work.id}/reverse`)
        placements.push({ id: mountId, x: cardX, y, width: width + 2 * matBorder, height: height + 2 * matBorder })
        placementWorkIds.set(mountId, work.id)
      }
      // A print in this room stands in the room's light. It is never shown
      // brighter than its own scan; away from the glass it falls with the wall.
      const stream = createPlateStream(entry.preview, entry.plate,
        { previewMaxEdge: stack.tierName() === 'hero' ? 1024 : 512, tone: plateTone })
      const geometry = new PlaneGeometry(s.widthM, s.heightM)
      const window = windows[i]
      if (window) {
        const coordinates = geometry.getAttribute('uv')
        for (let point = 0; point < coordinates.count; point++) coordinates.setXY(point,
          window.offsetU + coordinates.getX(point) * window.scaleU,
          window.offsetV + coordinates.getY(point) * window.scaleV)
        coordinates.needsUpdate = true
      }
      geometries.push(geometry)
      const mesh = new Mesh(geometry, stream.material)
      mesh.name = `reproduction/${entry.id}`
      mesh.castShadow = true
      mesh.position.set(cardX, y, .023)
      mesh.userData['manifestId'] = entry.plate.id
      mesh.visible = false
      wall.add(mesh)
      const arch = pictureArchMask(entry.plate)
      if (arch) {
        const shoulders = buildArchShoulderGeometry(arch, { widthM: s.widthM, heightM: s.heightM, window: window ?? undefined })
        geometries.push(shoulders)
        const mask = new Mesh(shoulders, mat)
        mask.name = `source-shoulder-mat/${entry.id}`
        mask.position.copy(mesh.position); mask.position.z += .0004
        mask.receiveShadow = true
        mask.userData['manifestId'] = ARCH_MASK_MANIFEST_ID
        furniture.add(mask)
      }
      void stream.ready.then(() => { if (!disposed) mesh.visible = mesh.userData['selectedVisible'] !== false && stream.available() })
      cards.push({ entry, mesh, stream })
      if (i > 0) cardLeft += slotWidth
    }
    const dot = element('button', 'picture-dot')
    dot.type = 'button'
    dot.style.setProperty('--certainty', policyCertainty(work, entries.length > 0, entries).colour)
    dot.dataset['workId'] = work.id
    if (work.attribution_certainty === 'copy' || work.attribution_certainty === 'workshop') dot.dataset['hand'] = 'workshop'
    dot.setAttribute('aria-label', `${policyLabelText(work, entries).firstLine.en} ${work.height_cm ?? '?'} × ${work.width_cm ?? '?'} cm`)
    // These anchors name the declared carrier; source attribution is text.
    dot.dataset['naClaim'] = entries.length === 0 ? '' : work.attribution_certainty === 'disputed' ? 'tradition'
      : policyCertainty(work, entries.length > 0, entries).colour === '#b18b47' ? 'inferred' : 'documented'
    dot.dataset['naAnchor'] = entries[0]?.plate.id ?? 'vinci/pictures/mats'
    dot.dataset['naAnchorClass'] = entries[0]?.plate.class ?? 'GENERATED'
    const caption = element('div', 'picture-mat-caption')
    caption.append(element('span', 'picture-mat-state', size ? (work.rights_class === 'DG' ? 'Measured outline' : work.certainty_word_en) : 'Dimensions not established'))
    caption.append(element('span', 'picture-mat-size', size ? `${work.height_cm} × ${work.width_cm} cm` : work.title_en))
    caption.append(element('span', 'picture-mat-holder', work.holder))
    caption.append(element('span', 'picture-mat-class', work.rights_class === 'DG' ? 'Source reproduction within measured field' : work.rights_class))
    if (catalogue || dimensionCard) {
      if (catalogue) {
        const text = policyLabelText(work, entries)
        caption.className = 'picture-mat-caption picture-catalogue-card'
        caption.replaceChildren(element('span', 'picture-catalogue-reference', '1907 · no. 308'))
        for (const language of ['en', 'de'] as const) {
          const section = element('div', 'picture-catalogue-language')
          section.lang = language
          section.append(element('p', 'picture-catalogue-first', text.firstLine[language]))
          section.append(element('p', 'picture-catalogue-status', work[`reproduction_note_${language}`]))
          caption.append(section)
        }
        caption.append(element('span', 'picture-catalogue-reference', `Catalogue / Katalog: ${work.height_cm} × ${work.width_cm} cm`))
      } else {
        caption.replaceChildren(element('span', 'picture-mat-state', work.title_en))
        caption.append(element('span', 'picture-catalogue-copy', work.measurement.extent))
        caption.append(element('span', 'picture-mat-class', work.rights_class))
      }
    }
    labels.append(dot, caption)
    frames.push({ work, x, y, width, height, matBorder, surround: matBorder + FRAME_MOULDING_WIDTH_M, left: cursor, right: cursor + assembly, aperture, furniture, wellLabels, cards, dot, caption })
    cursor += Math.max(assembly, 1.0) + gap
  }
  const extent = Math.max(.54, cursor - gap)
  const mouldings = buildFrameBatch(stack, placements, light)
  const shadowSource = new Group()
  shadowSource.add(mouldings.group.clone())
  // Only furniture with a physical mount has a contact-cache owner. An
  // unframed catalogue sheet must not be assigned to its nearest picture.
  const mountedWorkIds = new Set(placementWorkIds.values())
  for (const frame of frames) if (mountedWorkIds.has(frame.work.id)) shadowSource.add(frame.furniture.clone())
  // A frame standing four centimetres off the wall under one window throws a
  // shadow a visitor sees from across the room. The shadow-map texel is far
  // coarser than that, so the baked visibility carries it. Each frame points
  // its own rays at the room's one opening, so the shadows agree with the
  // light: near the glass a shadow drops, far along the run it leans away.
  // The aperture is stated in the hang's own metres.
  const contact = buildBakedFrameContact(shadowSource, placements,
    { strength: .27, aperture: light.aperture })
  wall.add(mouldings.group, contact.group)
  let absentWorkIds = new Set<string>(documentOnlyIds)
  let disposed = false
  let streamEpoch = 0
  let nearId = '', lastTier: TierName = stack.tierName()
  let observer: PerspectiveCamera | null = null
  const p = new Vector3()
  const allCards = frames.flatMap(f => f.cards)
  // The default state of an empty field, before any caller composes a view.
  for (const f of frames) {
    if (!f.aperture || !(documentOnlyIds.has(f.work.id) || f.cards.length === 0)) continue
    f.aperture.material = absenceMat
    const certainty = policyCertainty(f.work, false)
    f.dot.style.setProperty('--certainty', certainty.colour)
    f.dot.dataset['naClaim'] = ''
    f.dot.dataset['naAnchor'] = 'vinci/pictures/mats'
    f.dot.dataset['naAnchorClass'] = 'GENERATED'
  }
  function stream(tier: TierName): void {
    lastTier = tier
    let selected: typeof allCards[number] | undefined
    if (observer && tier !== 'calm') {
      const cost = stack.cost()
      const previewsMB = allCards.reduce((sum, c) => sum + c.stream.allocation().previewMB + 4 / 1048576, 0)
      selected = allCards.filter(c => c.mesh.visible && cost.textureMB + previewsMB + c.stream.allocation().fullMB <= cost.budget.textureMB)
        .sort((a, b) => a.mesh.getWorldPosition(p).distanceTo(observer!.position) - b.mesh.getWorldPosition(p).distanceTo(observer!.position))[0]
      if (selected && selected.mesh.getWorldPosition(p).distanceTo(observer.position) > 2.2) selected = undefined
    }
    const nextId = selected?.entry.id ?? ''
    if (nextId === nearId) return
    nearId = nextId
    const epoch = ++streamEpoch
    void Promise.all(allCards.filter(c => c !== selected).map(c => c.stream.high(false))).then(() => {
      if (!disposed && epoch === streamEpoch && selected) return selected.stream.high(true)
    })
  }
  return {
    wall, frames, labels, extent, stream, contactStats: contact.stats,
    documentOnlyIds: documentOnlyIds as ReadonlySet<string>,
    /** `reveal` is a deliberate opening of a document, never a default view. */
    setAbsent(ids: readonly string[] = [], reveal: readonly string[] = []) {
      absentWorkIds = new Set([...documentOnlyIds, ...ids].filter(id => !reveal.includes(id)))
      for (const frame of frames) {
        const absent = absentWorkIds.has(frame.work.id) || frame.cards.length === 0
        if (frame.aperture) frame.aperture.material = absent ? absenceMat : mat
        const certainty = policyCertainty(frame.work, frame.cards.length > 0 && !absentWorkIds.has(frame.work.id),
          frame.cards.map(card => card.entry))
        frame.dot.style.setProperty('--certainty', certainty.colour)
        frame.dot.dataset['naClaim'] = absent ? '' : frame.work.attribution_certainty === 'disputed' ? 'tradition'
          : certainty.colour === '#b18b47' ? 'inferred' : 'documented'
        frame.dot.dataset['naAnchor'] = absent ? 'vinci/pictures/mats' : frame.cards[0]?.entry.plate.id ?? 'vinci/pictures/mats'
        frame.dot.dataset['naAnchorClass'] = absent ? 'GENERATED' : frame.cards[0]?.entry.plate.class ?? 'GENERATED'
        frame.dot.setAttribute('aria-label', `${certainty.word.en}. ${frame.work.title_en}. ${frame.work.height_cm ?? '?'} × ${frame.work.width_cm ?? '?'} cm`)
      }
    },
    setVisible(ids?: readonly string[], reproductionsOnly = false, face?: { workId: string; reverse: boolean }) {
      const selectedWorks = ids === undefined ? null : new Set(ids)
      const visibleMountIds = reproductionsOnly ? [] : selectedWorks
        ? placements.filter(placement => selectedWorks.has(placementWorkIds.get(placement.id)!)).map(placement => placement.id) : undefined
      const faceMounts = face ? (visibleMountIds ?? placements.map(p => p.id)).filter(id => placementWorkIds.get(id) !== face.workId || id.endsWith(':reverse') === face.reverse) : visibleMountIds
      mouldings.setVisible(faceMounts)
      contact.setVisible(faceMounts)
      for (const f of frames) {
        const visible = !ids || ids.includes(f.work.id)
        const oneFace = face?.workId === f.work.id ? face : undefined
        f.shownFaceX = oneFace?.reverse ? f.cards.find(c => c.entry.face === 'reverse')?.mesh.position.x : undefined
        if (f.aperture) f.aperture.visible = visible && !reproductionsOnly && !oneFace?.reverse
        f.furniture.visible = visible && !reproductionsOnly
        for (const child of f.furniture.children) child.visible = !oneFace || (Math.abs(child.position.x - f.x) > .001) === oneFace.reverse
        for (const well of f.wellLabels) well.label.hidden = !visible || reproductionsOnly
        for (const c of f.cards) {
          const faceVisible = visible && !absentWorkIds.has(f.work.id) && (!oneFace || (c.entry.face === 'reverse') === oneFace.reverse)
          c.mesh.userData['selectedVisible'] = faceVisible
          c.mesh.visible = faceVisible && c.stream.available()
        }
      }
    },
    pending: () => allCards.reduce((n, c) => n + c.stream.pending(), 0),
    errors: () => allCards.map(c => c.stream.error()).filter(Boolean),
    textureMB: () => allCards.reduce((n, c) => n + c.stream.textureMB(), 0),
    update(camera: PerspectiveCamera, dt: number, selectedId?: string) {
      observer = camera
      camera.updateMatrixWorld()
      wall.updateMatrixWorld(true)
      for (const f of frames) {
        for (const c of f.cards) c.stream.update(dt)
        p.set(f.shownFaceX ?? f.x, f.y, .021).applyMatrix4(wall.matrixWorld).project(camera)
        const x = (p.x * .5 + .5) * innerWidth, y = (-p.y * .5 + .5) * innerHeight
        const h = new Vector3(f.shownFaceX ?? f.x, f.y + f.height / 2, .021).applyMatrix4(wall.matrixWorld).project(camera)
        const pxHeight = Math.abs(h.y - p.y) * innerHeight
        const visible = p.z > -1 && p.z < 1 && x > 20 && x < innerWidth - 20
        // The narrowest empty field in the collection is the Mona Lisa's, and
        // it is the one frame in this room that must never stand wordless.
        f.caption.hidden = f.cards.length > 0 && !absentWorkIds.has(f.work.id) || !visible || (f.aperture ? !f.aperture.visible : !f.furniture.visible) || pxHeight < 80 || pxHeight * f.width / f.height < 66
        f.caption.dataset['compact'] = String(pxHeight < 120)
        f.caption.style.left = `${x}px`
        f.caption.style.top = `${y - (f.work.display_mode === 'dimension_card_and_two_empty_image_wells' ? pxHeight * .27 : 0)}px`
        // The words belong to the mount, not to the empty field inside it, so
        // the narrowest measured size still stands on one line.
        f.caption.style.width = `${Math.max(30, pxHeight * (f.width + 2 * f.matBorder) / f.height - 10)}px`
        f.caption.style.fontSize = `${Math.max(9, Math.min(13, pxHeight / 20))}px`
        if (f.work.display_mode === 'unillustrated_catalogue_card') {
          const pxWidth = pxHeight * f.width / f.height
          f.caption.style.width = `${pxWidth}px`
          f.caption.style.height = `${pxHeight}px`
          f.caption.style.padding = `${Math.min(12, pxWidth * .06)}px`
          f.caption.style.fontSize = `${Math.max(11, Math.min(12, pxWidth / 14.72))}px`
        }
        for (const well of f.wellLabels) {
          const point = well.mesh.getWorldPosition(new Vector3()).project(camera)
          well.label.hidden = !f.furniture.visible || point.z < -1 || point.z > 1 || Math.abs(point.x) > .95
          well.label.style.left = `${(point.x * .5 + .5) * innerWidth}px`
          well.label.style.top = `${(-point.y * .5 + .5) * innerHeight}px`
        }
        // One work owns one centred mark. A paired panel owns the pair's centre.
        const anchorWorldX = f.shownFaceX ?? (f.cards.length > 1 && f.furniture.children.every(child => child.visible) ? (f.left + f.right) / 2 : f.x)
        const edge = new Vector3(anchorWorldX, f.y - f.height / 2 - f.matBorder - .052, .021)
          .applyMatrix4(wall.matrixWorld).project(camera)
        // A work hung on the datum can reach far enough down that the wall
        // below its moulding is thinner than the mark. The mark then stands
        // at the frame's own corner on the window side, the way a plate does
        // where there is no room under the picture, and never on the stone.
        const stone = new Vector3(anchorWorldX, skirting, .046).applyMatrix4(wall.matrixWorld).project(camera)
        const stoneY = (-stone.y * .5 + .5) * innerHeight
        const corner = new Vector3(f.x - f.width / 2 - f.surround, f.y - f.height / 2 - f.surround, .021)
          .applyMatrix4(wall.matrixWorld).project(camera)
        const footY = (-corner.y * .5 + .5) * innerHeight
        const beside = stoneY - footY < 30
        const anchorX = beside ? (corner.x * .5 + .5) * innerWidth - 17 : (edge.x * .5 + .5) * innerWidth
        const anchorY = beside ? footY - 6
          : Math.max(footY + 5, Math.min((-edge.y * .5 + .5) * innerHeight + 10, stoneY - 20))
        f.dot.hidden = !visible || anchorX < 22 || anchorX > innerWidth - 22 || anchorY > innerHeight - 100
        f.dot.style.left = `${anchorX}px`
        f.dot.style.top = `${anchorY - 22}px`
        f.dot.setAttribute('aria-pressed', String(f.work.id === selectedId))
      }
      stream(lastTier)
    },
    dispose() {
      if (disposed) return
      disposed = true
      contact.dispose()
      mouldings.dispose()
      for (const c of allCards) c.stream.dispose()
      for (const g of geometries) g.dispose()
      for (const m of materials) m.dispose()
      wall.removeFromParent()
      labels.remove()
    },
  }
}

import { Mesh, MeshStandardNodeMaterial, PlaneGeometry, Texture } from 'three/webgpu'
import inscriptionCollection from '../words/data/inscriptions.json'
import { Construction, exhibitionFloor, plasterWall, type ExhibitMaterials, type ExhibitionObject } from './construction'

export type { ExhibitMaterials, ExhibitionObject } from './construction'

export const INGRES_MANIFEST_ID = 'vinci/place-plate/jean-auguste-dominique-ingres-francois-ier-recoit-les-derniers-soupirs__petit-palais-musee-des-beaux-arts-de-la-ville-de-paris__4096x3252'
export const INGRES_DISPLAY = {
  width: 5,
  height: 5 * 3252 / 4096,
  depth: 0.09,
  originalWidth: 0.505,
  originalHeight: 0.4,
  imageWidth: 4096,
  imageHeight: 3252,
  label: 'Enlarged exhibition support: 3.9697 × 5.0 m. Original painting: 40 × 50.5 cm.',
} as const

export const DEATHBED_EVIDENCE = {
  claim: 'The king was at the bedside and cradled Leonardo’s head.',
  earliestSource: 'Vasari, 1568. A later account; Vasari was not a witness.',
  vasari: "Per la qual cosa rizzatosi il re e presoli la testa per aiutarlo e porgerli favore, acciò che il male lo allegerisse, lo spirito suo, che divinissimo era, conoscendo non potere avere maggiore onore, spirò in braccio a quel re nella età sua d'anni 75.",
  correction: 'A royal act was issued at Saint-Germain-en-Laye on 3 May 1519, the day after the death. Melzi’s letter of 1 June 1519 says nothing about the king being present. Champollion argued a chancellor could sign in the king’s absence: the act alone does not prove where the king was on 2 May.',
  verdict: 'Not disproved, not supported by any record.',
  age: 'Vasari gives 75. Leonardo was 67.',
} as const

/** Five-metre enlargement of the complete Q084 image, preserving its native aspect ratio. */
export function createMythDeathbed(materials: ExhibitMaterials, plateTexture?: Texture): ExhibitionObject {
  const build = new Construction(materials, 'vinci-myth-deathbed')
  exhibitionFloor(build)
  plasterWall(build, 8.6, 6.05, 2.92, -0.29)
  const centreY = 2.8
  build.box(0, centreY, -0.04, INGRES_DISPLAY.width, INGRES_DISPLAY.height, INGRES_DISPLAY.depth, materials.dark)

  // Four stepped mitre-like profiles hold the canvas away from the wall.
  const profiles = [
    { w: 0.17, offset: 0.08, z: 0.015, d: 0.19, material: materials.dark },
    { w: 0.10, offset: 0.16, z: 0.085, d: 0.18, material: materials.bronze },
    { w: 0.026, offset: 0.226, z: 0.16, d: 0.075, material: materials.dark },
    { w: 0.020, offset: 0.012, z: 0.135, d: 0.055, material: materials.bronze },
  ]
  for (const p of profiles) {
    const halfW = INGRES_DISPLAY.width / 2 + p.offset
    const halfH = INGRES_DISPLAY.height / 2 + p.offset
    for (const side of [-1, 1]) {
      build.box(side * halfW, centreY, p.z, p.w, halfH * 2 + p.w, p.d, p.material)
      build.box(0, centreY + side * halfH, p.z, halfW * 2 - p.w, p.w, p.d, p.material)
    }
  }
  // Small carved beads catch real light on the inner moulding.
  const halfHeight = INGRES_DISPLAY.height / 2
  for (let i = 0; i < 62; i++) {
    const x = -2.43 + i * 4.86 / 61
    for (const side of [-1, 1]) build.box(x, centreY + side * (halfHeight + 0.08), 0.19, 0.026, 0.029, 0.017, materials.bronze)
  }
  for (let i = 0; i < 49; i++) {
    const y = centreY - halfHeight + 0.06 + i * (INGRES_DISPLAY.height - 0.12) / 48
    for (const side of [-1, 1]) build.box(side * 2.58, y, 0.19, 0.029, 0.026, 0.017, materials.bronze)
  }
  build.box(-1.78, 0.41, 0.13, 1.17, 0.28, 0.095, materials.stone)
  build.text('INGRES · 1818', -2.3, 0.47, 0.18, 0.068, 1.07)
  build.text('Paris Musées · PD-Art', -2.3, 0.365, 0.18, 0.048, 1.07)
  // The size label is inked onto a shallow stone carrier bonded to the wall.
  build.box(1.50, 0.365, -0.23, 2.4, 0.36, 0.14, materials.stone)
  build.text('5.0 m · enlarged support', 0.40, 0.46, -0.16, 0.078, 2.2)
  build.text('Original: 40 × 50.5 cm', 0.40, 0.30, -0.16, 0.066, 2.2)
  build.finish()

  const plateMaterial = new MeshStandardNodeMaterial({ roughness: 0.83, metalness: 0, map: plateTexture ?? null })
  plateMaterial.name = 'Ingres-PD-ART-reproduction-paint-surface'
  const paint = new Mesh(new PlaneGeometry(INGRES_DISPLAY.width, INGRES_DISPLAY.height), plateMaterial)
  paint.name = 'Ingres-full-image-unwarped'
  paint.visible = plateTexture !== undefined
  paint.position.set(0, centreY, 0.012)
  paint.receiveShadow = true
  paint.userData = { manifestId: INGRES_MANIFEST_ID, manifestClass: 'PD-ART', originalSizeM: [INGRES_DISPLAY.originalWidth, INGRES_DISPLAY.originalHeight], supportSizeM: [INGRES_DISPLAY.width, INGRES_DISPLAY.height], imagePixels: [INGRES_DISPLAY.imageWidth, INGRES_DISPLAY.imageHeight], imageUncropped: true }
  build.group.add(paint)
  const metadata = { kind: 'myth-deathbed', plate: INGRES_MANIFEST_ID, display: INGRES_DISPLAY, evidence: DEATHBED_EVIDENCE, anchors: { plate: [0, 2.8, 0.012], label: [-1.78, 0.41, 0.18] } }
  build.group.userData.exhibit = metadata
  return { group: build.group, metadata, dispose: () => { build.dispose(); plateMaterial.dispose() } }
}

export const APOCRYPHA = inscriptionCollection.apocrypha

export interface MythQuotesOptions {
  /** Phone owns a single physical wall leaf; the host scrolls through all six. */
  mobile?: boolean
  quoteIndex?: number
}

/** Exact apocrypha and exact origins, physically inked into one plaster object. */
export function createMythQuotes(materials: ExhibitMaterials, options: MythQuotesOptions = {}): ExhibitionObject {
  const build = new Construction(materials, 'vinci-myth-quotes')
  const mobile = options.mobile === true
  const width = mobile ? 3.7 : 9.0
  const height = mobile ? 4.9 : 5.4
  exhibitionFloor(build, mobile ? 8 : 13)
  plasterWall(build, width, height, height / 2, -0.1)
  // plasterWall's broad face is z - 0.01. Sink the ink bases slightly into
  // that face so the 1.8 mm extrusion reads as pigment attached to plaster.
  const wallFaceZ = -0.11
  const inkZ = wallFaceZ - 0.0002
  const strikeZ = wallFaceZ + 0.001
  const selected = Math.min(APOCRYPHA.length - 1, Math.max(0, options.quoteIndex ?? 0))
  const rows = mobile ? [{ record: APOCRYPHA[selected]!, index: selected }] : APOCRYPHA.map((record, index) => ({ record, index }))
  const allText: string[] = []
  for (const { record, index } of rows) {
    const column = mobile ? 0 : Math.floor(index / 3)
    const row = mobile ? 0 : index % 3
    const x = mobile ? -1.55 : -4.14 + column * 4.46
    const y = mobile ? 4.27 : 4.88 - row * 1.56
    const textWidth = mobile ? 3.10 : 3.78
    const quoteSize = mobile ? 0.173 : 0.143
    const originSize = mobile ? 0.125 : 0.088
    build.text(String(index + 1).padStart(2, '0'), x, y + 0.3, inkZ, mobile ? 0.10 : 0.084, 0.3, materials.bronze)
    const quotation = build.text(record.quote, x, y, inkZ, quoteSize, textWidth)
    // Strike each wrapped line once, with a thin physical pigment ridge.
    // Consistent mid-cap crossings read as deliberate editorial cancellation.
    for (let lineIndex = 0; lineIndex < quotation.lines.length; lineIndex++) {
      const lineWidth = quotation.lineWidths[lineIndex] ?? quotation.width
      const strikeY = y - quoteSize * 0.39 - lineIndex * quoteSize * 1.45
      build.beam([x - 0.014, strikeY - 0.008, strikeZ], [x + lineWidth, strikeY + 0.012, strikeZ], 0.011, 0.006, materials.bronze)
    }
    const originY = y - quotation.height - (mobile ? 0.18 : 0.13)
    build.text(record.actual_origin, x, originY, inkZ, originSize, textWidth)
    allText.push(record.quote, record.actual_origin)
  }
  if (!mobile) build.box(0, 2.76, wallFaceZ - 0.004, 0.014, 4.81, 0.012, materials.stone)
  build.finish()
  const metadata = { kind: 'myth-quotes', quoteCount: APOCRYPHA.length, visibleQuotes: rows.map(({ index }) => index), exactText: allText, textClass: 'GENERATED', source: 'brief/collection/inscriptions.json#apocrypha', mobile, wallSizeM: [width, height] }
  build.group.userData.exhibit = metadata
  return { group: build.group, metadata, dispose: () => build.dispose() }
}

import { ExtrudeGeometry, Shape, SphereGeometry, Mesh, MeshStandardNodeMaterial, PlaneGeometry, Texture } from 'three/webgpu'
import { createText } from '../words'
import inscriptionCollection from '../words/data/inscriptions.json'
import { Construction, exhibitionFloor, plasterWall, type ExhibitMaterials, type ExhibitionObject } from './construction'

export type { ExhibitMaterials, ExhibitionObject } from './construction'

/** These two stand on the line bench's stage, and nowhere else: the walk holds
 * no station for them. The stage runs past the frame at every bench pose. */
const BENCH_STAGE = { width: 40, depth: 60 } as const

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
export function createMythDeathbed(materials: ExhibitMaterials, plateTexture?: Texture, language: 'en' | 'de' = 'en', options:{mobile?:boolean}={}): ExhibitionObject {
  const build = new Construction(materials, 'vinci-myth-deathbed')
  // The bench's own stage: a floor that runs past every frame of it.
  exhibitionFloor(build, BENCH_STAGE.width, BENCH_STAGE.depth)
  plasterWall(build, 8.6, 6.05, 2.92, -0.29)
  const centreY = 2.8
  build.box(0, centreY, -0.04, INGRES_DISPLAY.width, INGRES_DISPLAY.height, INGRES_DISPLAY.depth, materials.dark)

  // Four stepped mitre-like profiles hold the canvas away from the wall.
  const profiles = [
    { w: 0.17, offset: 0.08, z: 0.015, d: 0.19, material: materials.dark },
    { w: 0.10, offset: 0.16, z: 0.085, d: 0.18, material: materials.bronze },
    { w: 0.026, offset: 0.226, z: 0.16, d: 0.075, material: materials.dark },
    { w: 0.020, offset: 0.018, z: 0.135, d: 0.055, material: materials.bronze },
  ]
  for (const p of profiles) {
    const halfW = INGRES_DISPLAY.width / 2 + p.offset
    const halfH = INGRES_DISPLAY.height / 2 + p.offset
    const ow=halfW+p.w/2, oh=halfH+p.w/2, iw=halfW-p.w/2, ih=halfH-p.w/2
    const gap=.002
    const quads=[
      [[-ow+gap,oh],[ow-gap,oh],[iw-gap,ih],[-iw+gap,ih]],
      [[ow,oh-gap],[ow,-oh+gap],[iw,-ih+gap],[iw,ih-gap]],
      [[ow-gap,-oh],[-ow+gap,-oh],[-iw+gap,-ih],[iw-gap,-ih]],
      [[-ow,-oh+gap],[-ow,oh-gap],[-iw,ih-gap],[-iw,-ih+gap]],
    ]
    for(const corners of quads){
      const shape=new Shape();shape.moveTo(corners[0]![0]!,corners[0]![1]!)
      for(const [x,y] of corners.slice(1))shape.lineTo(x!,y!)
      shape.closePath()
      const moulding=new ExtrudeGeometry(shape,{depth:p.d,bevelEnabled:true,bevelSize:Math.min(.009,p.w*.15),bevelThickness:.006,bevelSegments:2,steps:1})
      moulding.translate(0,centreY,p.z-p.d/2);build.geometry(moulding,p.material)
    }
  }

  // Rounded beads catch the light with a curved surface, separated from the
  // four mitred mouldings. This is modern exhibition joinery.
  const bead=(x:number,y:number)=>{const geometry=new SphereGeometry(.016,8,4);geometry.translate(x,y,.19);build.geometry(geometry,materials.bronze)}
  const halfHeight = INGRES_DISPLAY.height / 2
  for (let i = 0; i < 62; i++) {
    const x = -2.43 + i * 4.86 / 61
    for (const side of [-1, 1]) bead(x,centreY+side*(halfHeight+.08))
  }
  for (let i = 0; i < 49; i++) {
    const y = centreY - halfHeight + 0.06 + i * (INGRES_DISPLAY.height - 0.12) / 48
    for (const side of [-1, 1]) bead(side*2.58,y)
  }
  // Both carriers keep a clear margin under their last line: no plate ends on
  // a baseline. Both viewports carry them: the phone frames the painting with
  // its plaques rather than hiding them behind a card, and cuts their letters
  // at the size the narrow stage can actually read.
  if (options.mobile) {
    build.box(-1.66, 0.27, 0.13, 2.28, 0.50, 0.095, materials.stone)
    build.text('INGRES 1818', -2.66, 0.45, 0.18, 0.155, 2.02)
    build.text('Paris Musées', -2.66, 0.245, 0.18, 0.125, 2.02)
    build.box(1.66, 0.27, -0.23, 2.60, 0.50, 0.14, materials.stone)
    build.text(language === 'en' ? 'A small painting' : 'Ein kleines Gemälde', 0.48, 0.45, -0.16, 0.150, 2.36)
    build.text(language === 'en' ? 'enlarged for this room' : 'für diesen Raum vergrößert', 0.48, 0.245, -0.16, 0.125, 2.36)
  } else {
    build.box(-1.78, 0.40, 0.13, 1.24, 0.38, 0.095, materials.stone)
    build.text('INGRES · 1818', -2.31, 0.515, 0.18, 0.10, 1.12)
    build.text('Paris Musées', -2.31, 0.375, 0.18, 0.072, 1.12)
    // The size label is inked onto a shallow stone carrier bonded to the wall.
    build.box(1.50, 0.37, -0.23, 2.4, 0.44, 0.14, materials.stone)
    build.text(language === 'en' ? 'A small painting' : 'Ein kleines Gemälde', 0.40, 0.505, -0.16, 0.095, 2.2)
    build.text(language === 'en' ? 'enlarged for this room' : 'für diesen Raum vergrößert', 0.40, 0.355, -0.16, 0.08, 2.2)
  }
  build.finish()

  // Varnished oil under a gallery key, not a file on a screen: the surface
  // takes the room's light instead of being lit flat.
  const plateMaterial = new MeshStandardNodeMaterial({ roughness: 0.58, metalness: 0, map: plateTexture ?? null })
  plateMaterial.name = 'Ingres-PD-ART-reproduction-paint-surface'
  const paint = new Mesh(new PlaneGeometry(INGRES_DISPLAY.width, INGRES_DISPLAY.height), plateMaterial)
  paint.name = 'Ingres-full-image-unwarped'
  paint.visible = plateTexture !== undefined
  paint.position.set(0, centreY, 0.012)
  paint.receiveShadow = true
  paint.userData = { manifestId: INGRES_MANIFEST_ID, manifestClass: 'PD-ART', originalSizeM: [INGRES_DISPLAY.originalWidth, INGRES_DISPLAY.originalHeight], supportSizeM: [INGRES_DISPLAY.width, INGRES_DISPLAY.height], imagePixels: [INGRES_DISPLAY.imageWidth, INGRES_DISPLAY.imageHeight], imageUncropped: true }
  build.group.add(paint)
  // The lowest carrier edge and the top of the frame: what a host has to hold.
  const extentY: [number, number] = [options.mobile ? 0.02 : 0.19, centreY + INGRES_DISPLAY.height / 2 + 0.27]
  const metadata = { kind: 'myth-deathbed', plate: INGRES_MANIFEST_ID, display: INGRES_DISPLAY, evidence: DEATHBED_EVIDENCE, extentY, anchors: { plate: [0, 2.8, 0.012], label: [-1.78, 0.41, 0.18] } }
  build.group.userData.exhibit = metadata
  return { group: build.group, metadata, dispose: () => { build.dispose(); plateMaterial.dispose() } }
}

export const APOCRYPHA = inscriptionCollection.apocrypha

export interface MythQuotesOptions {
  /** Phone owns a single physical wall leaf; the host scrolls through all six. */
  mobile?: boolean
  quoteIndex?: number
  /** One visitor-voice paragraph per apocryphon, in the reader's language.
   * Defaults to the catalogue's own wording when a host supplies none. */
  readings?: readonly string[]
}

/** Exact apocrypha and visitor-voice origins, physically inked into one
 * plaster wall: six bays a visitor walks along, each read at its own bay. */
export function createMythQuotes(materials: ExhibitMaterials, options: MythQuotesOptions = {}): ExhibitionObject {
  const build = new Construction(materials, 'vinci-myth-quotes')
  const mobile = options.mobile === true
  const selected = Math.min(APOCRYPHA.length - 1, Math.max(0, options.quoteIndex ?? 0))
  const readings = options.readings ?? APOCRYPHA.map(record => record.actual_origin)
  // Desktop reads the room as one made wall: three bays across, two down, so
  // all six cancellations are visible before a word is read. The phone owns a
  // single leaf and the host walks it.
  const columns = mobile ? 1 : 3
  const rowCount = mobile ? 1 : 2
  const quoteSize = mobile ? 0.16 : 0.26
  const originSize = mobile ? 0.125 : 0.182
  const bayWidth = mobile ? 3.36 : 4.62
  const textWidth = mobile ? 3.00 : 4.16
  const quoteToOrigin = mobile ? 0.18 : 0.40
  const topMargin = mobile ? 0.58 : 0.78
  const rowGap = 0.55
  const dado = mobile ? 0 : 2.25
  const measure = (value: string, size: number) => {
    const text = createText(value, { size, maxWidth: textWidth, material: materials.ink, lineHeight: 1.45 })
    const height = text.height
    text.dispose()
    return height
  }
  const rows = mobile ? [selected] : APOCRYPHA.map((_, index) => index)
  const block = (index: number) => measure(APOCRYPHA[index]!.quote, quoteSize) + quoteToOrigin + measure(readings[index] ?? '', originSize)
  // One wall size for all six, so walking the entries never rescales the room.
  const tallest = Math.max(...APOCRYPHA.map((_, index) => block(index)))
  const width = mobile ? bayWidth : bayWidth * columns + 0.52
  const height = mobile ? 1.04 + tallest : topMargin + rowCount * tallest + (rowCount - 1) * rowGap + dado
  exhibitionFloor(build, BENCH_STAGE.width, BENCH_STAGE.depth)
  plasterWall(build, width, height, height / 2, -0.1)
  // plasterWall's broad face is z - 0.01. Sink the ink bases slightly into
  // that face so the 1.8 mm extrusion reads as pigment attached to plaster.
  const wallFaceZ = -0.11
  const inkZ = wallFaceZ - 0.0002
  const strikeZ = wallFaceZ + 0.001
  // Both ends return into the room, so the wall stops as construction rather
  // than at the edge of the frame.
  for (const side of [-1, 1]) {
    // On the narrow stage the leaf is the whole frame, so the return stands
    // outside it instead of over the entry's own number.
    const at = mobile ? width / 2 + 0.12 : width / 2 - 0.025
    build.box(side * at, height / 2, -0.52, 0.22, height, 1.18, materials.plaster)
    build.box(side * (at - 0.075), height - 0.20, -0.52, 0.30, 0.15, 1.24, materials.stone)
  }
  build.box(0, 0.035, 0.02, width + 0.22, 0.08, 0.50, materials.dark)
  build.box(0, 0.15, 0.02, width + 0.16, 0.20, 0.44, materials.stone)
  if (dado > 0) {
    // The dark base the room stands on. It is also the only surface in this
    // frame a label may sit against, which is why it is this tall.
    build.box(0, dado / 2, wallFaceZ + 0.035, width + 0.06, dado, 0.08, materials.dark)
    const panels = Math.max(3, Math.round(width / 1.62))
    for (let i = 0; i < panels; i++) {
      const w = width / panels
      const cx = -width / 2 + (i + 0.5) * w
      // A raised and fielded panel: two steps out of the stile, so the raking
      // light draws two lines round every panel instead of none.
      build.box(cx, dado * 0.53, wallFaceZ + 0.083, w - 0.22, dado - 0.44, 0.018, materials.dark)
      build.box(cx, dado * 0.53, wallFaceZ + 0.096, w - 0.30, dado - 0.56, 0.026, materials.dark)
      // A pale hairline fillet in the joint between stiles.
      if (i > 0) build.box(cx - w / 2, dado / 2 - 0.06, wallFaceZ + 0.078, 0.012, dado - 0.18, 0.012, materials.stone)
    }
    build.box(0, dado + 0.055, wallFaceZ + 0.09, width + 0.13, 0.11, 0.21, materials.stone)
    build.box(0, dado - 0.028, wallFaceZ + 0.105, width + 0.06, 0.030, 0.05, materials.bronze)
    // A skirting at the foot: the band that keeps a long dark base off the floor.
    build.box(0, 0.19, wallFaceZ + 0.105, width + 0.09, 0.38, 0.06, materials.dark)
    build.box(0, 0.395, wallFaceZ + 0.125, width + 0.05, 0.035, 0.045, materials.stone)
  }
  const allText: string[] = []
  const bays: { index: number; x: number }[] = []
  const rowTop = height - topMargin
  for (const index of rows) {
    const column = mobile ? 0 : index % columns
    const row = mobile ? 0 : Math.floor(index / columns)
    const centre = mobile ? 0 : -width / 2 + 0.26 + (column + 0.5) * bayWidth
    const top = mobile ? height - topMargin : rowTop - row * (tallest + rowGap)
    const x = centre - textWidth / 2
    bays.push({ index, x: centre })
    build.text(String(index + 1).padStart(2, '0'), x, top + (mobile ? 0.30 : 0.44), inkZ, mobile ? 0.10 : 0.13, 0.4, materials.bronze)
    const quotation = build.text(APOCRYPHA[index]!.quote, x, top, inkZ, quoteSize, textWidth)
    // Strike each wrapped line once, with a thin physical pigment ridge.
    // Consistent mid-cap crossings read as deliberate editorial cancellation.
    for (let line = 0; line < quotation.lines.length; line++) {
      const lineWidth = quotation.lineWidths[line] ?? quotation.width
      const strikeY = top - quoteSize * 0.39 - line * quoteSize * 1.45
      // The cancellation is the same pigment as the words it cancels, laid on
      // thicker, so it reads as a hand crossing a line out and not as a rule.
      const drift = quoteSize * 0.03 * Math.sin(index * 2.1 + line * 1.7)
      build.beam([x - 0.020, strikeY - 0.012 + drift, strikeZ], [x + lineWidth + 0.016, strikeY + 0.010 - drift, strikeZ], quoteSize * 0.085, 0.005, materials.ink)
    }
    build.text(readings[index] ?? '', x, top - quotation.height - quoteToOrigin, inkZ, originSize, textWidth)
    allText.push(APOCRYPHA[index]!.quote, readings[index] ?? '')
    // The bay a visitor is reading carries a bronze marker beside its number.
    if (!mobile && index === selected) {
      build.box(x - 0.20, top + 0.38, wallFaceZ - 0.006, 0.035, 0.32, 0.016, materials.bronze)
    }
    // A reveal between bays: the wall is one made thing, divided into six.
    if (!mobile && column > 0) build.box(centre - bayWidth / 2, (height + dado) / 2, wallFaceZ - 0.004, 0.014, height - dado - 0.30, 0.012, materials.stone)
  }
  build.finish()
  const metadata = {
    kind: 'myth-quotes',
    quoteCount: APOCRYPHA.length,
    visibleQuotes: rows,
    selected,
    bays,
    exactText: allText,
    textClass: 'GENERATED',
    source: 'brief/collection/inscriptions.json#apocrypha',
    mobile,
    columns,
    rows: rowCount,
    dadoM: dado,
    wallSizeM: [width, height],
  }
  build.group.userData.exhibit = metadata
  return { group: build.group, metadata, dispose: () => build.dispose() }
}

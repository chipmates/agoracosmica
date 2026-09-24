import { CylinderGeometry, ExtrudeGeometry, Matrix4, Mesh, MeshStandardNodeMaterial, PlaneGeometry, Quaternion, Vector3, Shape, type BufferGeometry, type Material, type Texture } from 'three/webgpu'
import { Construction, exhibitionFloor, galleryBackdrop, type ExhibitMaterials, type ExhibitionObject } from '../myths/construction'
import { lineAdvance } from '../words'
import words from '../line/data/never-said.json'
import { GRAVE_DEATHBED, GRAVE_FRAME, GRAVE_SLAB } from './placement'
import { cutLedgerFace, ledgerStone } from './ledger'
import { createDiagram } from './diagram'

/** Kept from the local computation, not from the later sunset row. */
export const GRAVE_HOUR = {
  julianDate: '2 May 1519',
  gregorianDate: '12 May 1519',
  ut: '18:50',
  julianDay0h: 2275993.5,
  latitude: 47.4103059,
  longitude: 0.9920706,
  deltaTSeconds: 178.978,
  sunAzimuth: 292.712368,
  sunAltitude: 3.735861,
  gableBearing: 321.47,
  source: 'refs/place/notes/hour.py; refs/place/notes/hour-2may1519.txt',
  chosen: true,
} as const

export const GRAVE_EVIDENCE = {
  slab: 'LEONARDO DA VINCI',
  presumption: 'presumed remains',
  plaque: 'The chapel’s own plaque says presumed remains. Its wording belongs to a separate plaque, not to the slab.',
  dig: 'Arsène Houssaye excavated the former Saint-Florentin church in 1863 and reported a nearly complete skeleton. The identification remains presumed.',
  transfer: 'The château describes a nineteenth-century transfer to Saint-Hubert. The precise 1874 date and the letter-fragment account need the historical excavation and transfer record.',
  frame: 'Computed light · 2 May 1519 · 18:50 UT. A chosen minute, not a witnessed moment.',
} as const

/** EVERY WORD CUT INTO THE GRAVE'S STONES, in both languages. The stones are
 * the atmosphere and the card is the reading, so the close look repeats these
 * in its record rather than asking a visitor to read them off the floor. */
export const GRAVE_WORDS = {
  slab: GRAVE_EVIDENCE.slab,
  presumption: { en: 'presumed remains', de: 'mutmaßliche Überreste' },
  dig: '1863',
  identification: { en: 'The identification remains presumed.', de: 'Die Identifizierung bleibt unbewiesen.' },
  /** What the setting on the real slab holds. An absence is a sentence in
   * the record and never a piece of furniture, so nothing of it is built.
   * The bronze is a 2004 sculpture
   * whose copyright runs, so no photograph of it is admissible and the record
   * carries the fact in words. */
  medallionRecord: {
    en: 'A bronze medallion with his profile was set into the slab in 2004. It is modern work, so the museum shows the words and not the picture.',
    de: 'Ein Bronzemedaillon mit seinem Profil kam 2004 in die Grabplatte. Es ist ein modernes Werk, darum zeigt das Museum die Worte und nicht das Bild.',
  },
  diagram: { en: 'CHOSEN LIGHT · A DIAGRAM', de: 'GEWÄHLTES LICHT · EINE STUDIE' },
  diagramDate: { en: '2 MAY 1519 · JULIAN CALENDAR', de: '2. MAI 1519 · JULIANISCH' },
  disclosure: {
    en: 'Generated exhibition study; slab and gable dimensions are interpretive, not a measured architectural replica. Portrait medallion not reproduced.',
    de: 'Generierte Ausstellungsstudie. Die Maße von Grabplatte und Giebel beruhen auf einer Interpretation. Die Studie ist keine vermessene architektonische Nachbildung. Das Porträtmedaillon wird nicht wiedergegeben.',
  },
  painter: 'INGRES · 1818',
  holder: 'Paris Musées',
  enlarged: { en: 'A small painting enlarged for this room', de: 'Ein kleines Gemälde für diesen Raum vergrößert' },
} as const

/** A PART SHAPED IN ITS OWN FRAME, welded into the object's own batches.
 * A sub-assembly that stands on a group of its own costs a draw per material
 * again; the same geometry carried here costs none, and the placement it
 * would have had as a group is baked into its vertices instead. */
class Placed extends Construction {
  constructor(private readonly into: Construction, private readonly matrix: Matrix4) {
    super(into.materials, into.group.name, into.manifestId)
  }
  override geometry(geometry: BufferGeometry, material: Material): void {
    this.into.geometry(geometry.applyMatrix4(this.matrix), material)
  }
}
/** The matrix a group would have carried: rotation about X, then the place. */
function placed(into: Construction, place: { rotationX?: number; scale?: number; position: [number, number, number] }): Placed {
  const matrix = new Matrix4().compose(
    new Vector3(...place.position),
    new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), place.rotationX ?? 0),
    new Vector3().setScalar(place.scale ?? 1),
  )
  return new Placed(into, matrix)
}

/** Frame-space +Z faces the measured NW gable, +X runs right along its facade. */
export function graveSunDirection(): [number, number, number] {
  const radians = Math.PI / 180
  const bearing = (GRAVE_HOUR.sunAzimuth - GRAVE_HOUR.gableBearing) * radians
  const altitude = GRAVE_HOUR.sunAltitude * radians
  return [Math.sin(bearing) * Math.cos(altitude), Math.sin(altitude), Math.cos(bearing) * Math.cos(altitude)]
}

/** A name-only stone study and separate evidential furniture; no invented epitaph. */
export function createGrave(materials: ExhibitMaterials & {tuffeau?:Material}, language: 'en' | 'de' = 'en', options:{mobile?:boolean,tier?:'hero'|'standard'|'calm'}={}): ExhibitionObject {
  const pale=materials.tuffeau??materials.stone
  const text=(en:string,de:string)=>language==='en'?en:de
  const build = new Construction(materials, 'vinci-grave', 'vinci/grave-geometry')
  exhibitionFloor(build, 12, 13)
  galleryBackdrop(build)
  // Low masonry holds the slab in the floor. The narrow stepped reveal makes
  // its weight readable even under the grazing light of the closing room.
  const centreX = GRAVE_SLAB.x
  const centreZ = GRAVE_SLAB.z
  build.box(centreX, 0.075, centreZ, 2.16, 0.15, 3.74, materials.dark)
  // The bedding stone runs the whole length of the slab.
  build.box(centreX, 0.148, centreZ, 2.04, 0.13, 3.61, materials.stone)
  // The documented name is the ONLY writing on the slab, cut into a pale
  // honed limestone and filled. The portrait medallion is not reproduced, and
  // what the real slab carries instead is a sentence of the record, which is
  // where an absence belongs.
  const ledgerFace = cutLedgerFace({ centre: [centreX, centreZ], top: .234, width: 1.98, length: 3.55, depth: .064 })
  // the filling is the grave's own ink, so it welds into the lettering's body
  const ledger = ledgerStone()
  for (const geometry of ledgerFace.stone) build.geometry(geometry, ledger)
  for (const geometry of ledgerFace.filling) build.geometry(geometry, materials.ink)

  // A separate low lectern makes "presumed" physically separate as well.
  const plaqueX = options.mobile ? 1.50 : 1.44
  const plaqueZ = options.mobile ? 1.62 : 1.45
  // The standing label has a foot: a base course, a cap and a bronze bead, so
  // it stands on the paving instead of meeting it on an edge.
  build.box(plaqueX, 0.085, plaqueZ - 0.08, 1.88, 0.17, 0.48, materials.dark)
  build.box(plaqueX, 0.188, plaqueZ - 0.06, 1.72, 0.05, 0.42, materials.stone)
  build.box(plaqueX, 0.225, plaqueZ + 0.06, 1.64, 0.028, 0.14, materials.bronze)
  build.box(plaqueX, 0.62, plaqueZ - 0.11, 1.54, 0.88, 0.20, materials.stone)
  build.box(plaqueX, 0.66, plaqueZ + 0.014, 1.60, 0.80, 0.065, pale)
  build.text(text(GRAVE_WORDS.presumption.en,GRAVE_WORDS.presumption.de), plaqueX - 0.70, 0.98, plaqueZ + 0.05, options.mobile?(language==='de'?.135:.16):(language === 'de' ? 0.102 : 0.13), 1.40, materials.ink)
  build.text(GRAVE_WORDS.dig, plaqueX - 0.70, options.mobile?0.46:0.68, plaqueZ + 0.05, 0.095, 1.4, materials.bronze)
  if(!options.mobile)build.text(text(GRAVE_WORDS.identification.en,GRAVE_WORDS.identification.de), plaqueX - 0.70, 0.51, plaqueZ + 0.05, 0.070, 1.4)


  const gableScale=options.mobile?.84:1, gableShift:[number,number,number]=options.mobile?[-1.26,0,-1.55]:[0,0,0]
  const gableBuild=placed(build,{scale:gableScale,position:gableShift})
  // An architectural study in a deep frame, distinct from the burial object:
  // a coursed relief in a bronze box, lit by the chosen minute's own light.
  const frameX = GRAVE_FRAME.x
  const frameY = GRAVE_FRAME.y
  const frameZ = GRAVE_FRAME.z
  const diagram = createDiagram({ x: frameX, y: frameY, z: frameZ, width: GRAVE_FRAME.width, height: GRAVE_FRAME.height,
    toSun: graveSunDirection(), tier: options.tier })
  diagram.group.scale.setScalar(gableScale)
  diagram.group.position.set(...gableShift)
  // The visitor caption belongs to the object; calculation stays in the record.
  // This ledge projects beyond the frame posts: neither first glyph enters
  // their silhouette from the fixed oblique museum view.
  // Both supports reach the paving behind the projected reading ledge.
  const legSpan=options.mobile?1.50:1.42
  for(const side of [-1,1]){
    const x=frameX+side*legSpan
    gableBuild.box(x,.60,frameZ-.02,.09,1.20,options.mobile?.15:.16,materials.bronze)
    gableBuild.box(x,.035,frameZ-.02,.34,.07,.50,materials.bronze)
    gableBuild.box(x,.012,frameZ-.02,.36,.024,.52,materials.dark)
  }
  // A reading ledge raked back towards the eye. A vertical caption under a
  // camera that looks down foreshortens two lines into one; at 25 degrees the
  // face meets the visitor and the lines keep their air.
  const ledge=placed(gableBuild,{rotationX:-.44,position:[frameX,options.mobile?1.00:.95,frameZ+(options.mobile?.34:.32)]})
  const ledgeWidth=options.mobile?2.62:2.36, ledgeHeight=options.mobile?.58:.50
  const inner=ledgeWidth-.26
  ledge.box(0,0,0,ledgeWidth,ledgeHeight,.075,materials.plaster)
  ledge.box(0,-ledgeHeight/2+.02,.035,ledgeWidth,.045,.075,materials.bronze)
  ledge.box(0,ledgeHeight/2-.012,.02,ledgeWidth,.028,.065,materials.stone)
  // Each line takes the largest cap height that keeps it ON one line. Caps run
  // wider than a lowercase sentence and German runs wider again; a size typed
  // once for English wraps the caption and the two lines then collide.
  const fit=(value:string,cap:number)=>Math.min(cap,inner/Math.max(1e-6,lineAdvance(value,1))*.985)
  const first=text(GRAVE_WORDS.diagram.en,GRAVE_WORDS.diagram.de)
  const second=text(GRAVE_WORDS.diagramDate.en,GRAVE_WORDS.diagramDate.de)
  ledge.text(first, -inner/2, ledgeHeight/2-.085, .042, fit(first,options.mobile?.155:.118), inner)
  ledge.text(second, -inner/2, -.075, .042, fit(second,options.mobile?.115:.082), inner)
  build.finish()
  // the ledger's cut face lies flat in the court's shade and casts nothing
  // the sun's cascades could hold; its letters are thousands of faces
  build.group.traverse(o => { if (o instanceof Mesh && o.material === ledger) o.castShadow = false })
  build.group.add(diagram.group)
  // The points a frame has to hold: nothing of the burial or its diagram may
  // fall under a card, so the host composes from these and not from a guess.
  const gablePoint=(x:number,y:number,z:number):[number,number,number]=>[x*gableScale+gableShift[0],y*gableScale+gableShift[1],z*gableScale+gableShift[2]]
  const framePoints:[number,number,number][]=[
    [centreX-0.99,0.24,centreZ+1.775],[centreX+0.99,0.24,centreZ+1.775],
    [centreX-0.99,0.24,centreZ-1.775],[centreX+0.99,0.24,centreZ-1.775],
    [plaqueX-0.80,1.12,plaqueZ],[plaqueX+0.80,0.02,plaqueZ+0.10],
    gablePoint(frameX-1.66,0.0,frameZ),gablePoint(frameX+1.66,frameY+1.33,frameZ),
  ]
  const metadata = {
    kind: 'grave',
    slabText: GRAVE_EVIDENCE.slab,
    plaqueText: text(GRAVE_WORDS.presumption.en,GRAVE_WORDS.presumption.de),
    evidence: GRAVE_EVIDENCE,
    hour: GRAVE_HOUR,
    sunDirection: graveSunDirection(),
    classification: 'GENERATED',
    framePoints,
    geometryDisclosure: text(GRAVE_WORDS.disclosure.en,GRAVE_WORDS.disclosure.de),
    anchors: { slab: [centreX, 0.24, centreZ], plaque: [plaqueX, 0.9, plaqueZ + 0.05], computedFrame: options.mobile?[frameX*.84-1.26,frameY*.84,(frameZ+.1)*.84-1.55]:[frameX, frameY, frameZ + 0.1] },
  }
  build.group.userData.exhibit = metadata
  return { group: build.group, metadata, dispose: () => { build.dispose(); diagram.dispose(); ledger.dispose() } }
}

/* THE PAINTING OF A DEATH NOBODY WITNESSED, at the grave it belongs to.
   A French painter imagined the scene three hundred years after it, and the
   museum hangs it where the record of that afternoon is read, not as the
   likeness of an hour. The label is cut into the wall beside it and the card
   carries the record: at this distance a label is a label, and the reading is
   in the card. */
const DEATHBED = words.deathbed_label
/** The far wall stands fourteen metres from the eye, and the painting's place
 * is the one band of it both viewports hold whole: east of the card's edge on
 * the wide stage, west of the diagram frame's own silhouette, and inside the
 * narrow stage's much shorter field. Wider than this and the phone cuts it. */
const DEATHBED_DISPLAY = GRAVE_DEATHBED

/** Hangs the reproduction on the grave's backdrop wall. The frame is built
 * INSIDE the plate's own promise, so a plate that never arrives leaves the
 * wall as it was: no empty frame stands in this museum. */
export function createGraveDeathbed(
  materials: ExhibitMaterials, plateTexture: Texture, plateManifestId: string,
  language: 'en' | 'de' = 'en',
): ExhibitionObject {
  const text = (en: string, de: string) => language === 'en' ? en : de
  const build = new Construction(materials, 'vinci-grave-deathbed', 'vinci/grave-geometry')
  const D = DEATHBED_DISPLAY
  const x = D.centreX, y = D.centreY, z = D.faceZ
  // The support, then two stepped mouldings that take the grazing light.
  build.box(x, y, z + .045, D.width, D.height, .09, materials.dark)
  for (const [inset, thickness, depth, material] of [
    [.10, .13, .13, materials.dark], [.21, .09, .085, materials.bronze],
  ] as const) {
    const halfW = D.width / 2 + inset, halfH = D.height / 2 + inset
    for (const [dx, dy, w, h] of [
      [0, halfH, halfW * 2 + thickness, thickness], [0, -halfH, halfW * 2 + thickness, thickness],
      [-halfW, 0, thickness, halfH * 2 - thickness], [halfW, 0, thickness, halfH * 2 - thickness],
    ] as const) build.box(x + dx, y + dy, z + .09 + depth / 2, w, h, depth, material)
  }
  // The label on the wall under it. The card is the reading; this says whose
  // hand, which year, and that the painting on the wall is an enlargement.
  const labelWidth = 1.55, labelLeft = x - labelWidth / 2
  const labelTop = 1.22
  build.box(x, labelTop - .34, z + .045, labelWidth + .22, .90, .07, materials.stone)
  build.box(x, labelTop - .80, z + .075, labelWidth + .16, .035, .06, materials.bronze)
  const title = build.text(text(DEATHBED.title_en, DEATHBED.title_de), labelLeft, labelTop, z + .085, .115, labelWidth)
  build.text(GRAVE_WORDS.painter, labelLeft, labelTop - title.height - .10, z + .085, .082, labelWidth, materials.bronze)
  build.text(GRAVE_WORDS.holder, labelLeft, labelTop - title.height - .26, z + .085, .058, labelWidth)
  build.text(text(GRAVE_WORDS.enlarged.en, GRAVE_WORDS.enlarged.de),
    labelLeft, labelTop - title.height - .40, z + .085, .058, labelWidth)
  build.finish()
  // Varnished oil under a gallery key, not a file on a screen.
  const plate = new MeshStandardNodeMaterial({ roughness: .58, metalness: 0, map: plateTexture })
  plate.name = 'Ingres-PD-ART-reproduction-paint-surface'
  const paint = new Mesh(new PlaneGeometry(D.width, D.height), plate)
  paint.name = 'Ingres-full-image-unwarped'
  paint.position.set(x, y, z + .098)
  paint.receiveShadow = true
  paint.castShadow = false
  paint.userData = {
    manifestId: plateManifestId, manifestClass: 'PD-ART',
    originalSizeM: [D.originalWidth, D.originalHeight], supportSizeM: [D.width, D.height],
    imagePixels: [D.imageWidth, D.imageHeight], imageUncropped: true,
  }
  build.group.add(paint)
  const metadata = {
    kind: 'grave-deathbed', plate: plateManifestId, display: D,
    label: text(DEATHBED.label_en, DEATHBED.label_de),
    record: text(DEATHBED.record_en, DEATHBED.record_de),
    lastWords: text(DEATHBED.last_words_en, DEATHBED.last_words_de),
    certainty: DEATHBED.certainty,
    anchors: { plate: [x, y, z + .098], label: [x, labelTop, z + .085] },
  }
  build.group.userData.exhibit = metadata
  return { group: build.group, metadata, dispose: () => { build.dispose(); plate.dispose() } }
}

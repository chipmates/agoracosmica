import { CylinderGeometry, ExtrudeGeometry, LatheGeometry, Mesh, MeshStandardNodeMaterial, PlaneGeometry, Vector2, Path, Shape, type Material, type Texture } from 'three/webgpu'
import { Construction, exhibitionFloor, galleryBackdrop, type ExhibitMaterials, type ExhibitionObject } from '../myths/construction'
import { lineAdvance } from '../words'
import words from '../line/data/never-said.json'

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

/** Frame-space +Z faces the measured NW gable, +X runs right along its facade. */
export function graveSunDirection(): [number, number, number] {
  const radians = Math.PI / 180
  const bearing = (GRAVE_HOUR.sunAzimuth - GRAVE_HOUR.gableBearing) * radians
  const altitude = GRAVE_HOUR.sunAltitude * radians
  return [Math.sin(bearing) * Math.cos(altitude), Math.sin(altitude), Math.cos(bearing) * Math.cos(altitude)]
}

/** A name-only stone study and separate evidential furniture; no invented epitaph. */
export function createGrave(materials: ExhibitMaterials & {tuffeau?:Material}, language: 'en' | 'de' = 'en', options:{mobile?:boolean}={}): ExhibitionObject {
  const pale=materials.tuffeau??materials.stone
  const text=(en:string,de:string)=>language==='en'?en:de
  const build = new Construction(materials, 'vinci-grave', 'vinci/grave-geometry')
  exhibitionFloor(build, 12, 13)
  galleryBackdrop(build)
  // Low masonry holds the slab in the floor. The narrow stepped reveal makes
  // its weight readable even under the grazing light of the closing room.
  const centreX = -0.95
  const centreZ = 0.65
  build.box(centreX, 0.075, centreZ, 2.16, 0.15, 3.74, materials.dark)
  // The bedding stone stops short of the empty setting on both sides, so the
  // well under the bezel is a real void and not the course's own top face.
  const medallionZ = centreZ - 0.7
  for (const [from, to] of [[centreZ - 1.805, medallionZ - 0.62], [medallionZ + 0.62, centreZ + 1.805]] as [number, number][]) {
    build.box(centreX, 0.148, (from + to) / 2, 2.04, 0.13, to - from, materials.stone)
  }
  const slabFace=new Shape();slabFace.moveTo(-.99,-1.775);slabFace.lineTo(.99,-1.775);slabFace.lineTo(.99,1.775);slabFace.lineTo(-.99,1.775);slabFace.closePath()
  const voidPath=new Path();voidPath.absarc(0,.7,.53,0,Math.PI*2,true);slabFace.holes.push(voidPath)
  const top=new ExtrudeGeometry(slabFace,{depth:.06,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:2,curveSegments:36})
  top.rotateX(-Math.PI/2);top.translate(centreX,.17,centreZ);build.geometry(top,pale)

  // The documented name is the ONLY writing on the slab. The portrait
  // medallion is omitted from this openly generated study; no face invented.
  const slabName = new Construction(materials, 'vinci-grave-slab-name', 'vinci/grave-geometry')
  const labelWidth = 1.92
  slabName.text(options.mobile?'LEONARDO\nDA VINCI':GRAVE_EVIDENCE.slab, -labelWidth / 2, 0, 0, options.mobile?.20:.153, labelWidth, materials.ink, 0.003)
  const slabText = slabName.finish()
  slabText.rotation.x = -Math.PI / 2
  slabText.position.set(centreX, 0.2348, centreZ + (options.mobile?.76:1.06))
  build.group.add(slabText)

  // Beaten bronze inset rings recall the mounting's material without
  // fabricating the profile carried by the modern tomb photograph.
  // The setting is empty on purpose: a bronze bezel let 95 mm into the slab,
  // its skirt reading darker than the stone, over a pale floor. A rim that
  // stands proud takes the grazing light; the well below it reads as depth.
  const rimProfile=[[.470,-.095],[.470,-.006],[.481,.010],[.523,.010],[.536,-.006],[.536,-.095],[.470,-.095]].map(([r,y])=>new Vector2(r!,y!)).reverse()
  const rim=new LatheGeometry(rimProfile,72);rim.translate(centreX,.23,medallionZ);build.geometry(rim,materials.bronze)
  const cavityFloor=new CylinderGeometry(.470,.470,.030,72)
  cavityFloor.translate(centreX,.150,medallionZ);build.geometry(cavityFloor,pale)

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
  build.text(text('presumed remains','mutmaßliche Überreste'), plaqueX - 0.70, 0.98, plaqueZ + 0.05, options.mobile?(language==='de'?.135:.16):(language === 'de' ? 0.102 : 0.13), 1.40, materials.ink)
  build.text('1863', plaqueX - 0.70, options.mobile?0.46:0.68, plaqueZ + 0.05, 0.095, 1.4, materials.bronze)
  if(!options.mobile)build.text(text('The identification remains presumed.','Die Identifizierung bleibt unbewiesen.'), plaqueX - 0.70, 0.51, plaqueZ + 0.05, 0.070, 1.4)

  // Absence carries a label of its own, on its own carrier, off the pale slab.
  const noteX=centreX-.30, noteZ=centreZ-1.86
  const noteWords=text('The portrait medallion\nis left empty here.','Das Porträtmedaillon\nbleibt hier leer.')
  if(options.mobile){
    // The phone reads the same words from a floor-set strip: no standing plate
    // crowds the slab, and the caption stays inside the narrow stage.
    const strip=new Construction(materials,'vinci-grave-medallion-note','vinci/grave-geometry')
    // Local XY becomes the paving plane once the strip is laid down, so the
    // plate's thickness is its local Z and its depth is its local Y.
    strip.box(0,-.30,-.028,2.06,.72,.056,pale)
    strip.box(0,-.665,-.030,2.10,.05,.060,materials.bronze)
    strip.text(noteWords,-.94,-.08,.004,.150,1.90)
    const floorNote=strip.finish()
    floorNote.rotation.x=-Math.PI/2
    floorNote.position.set(centreX+.34,.062,centreZ-2.74)
    build.group.add(floorNote)
  }else{
    build.box(noteX,.20,noteZ-.09,1.18,.40,.14,materials.dark)
    build.box(noteX,.43,noteZ,1.56,.56,.07,pale)
    build.box(noteX,.145,noteZ+.02,1.60,.06,.11,materials.bronze)
    build.text(noteWords,noteX-.70,.60,noteZ+.04,.112,1.42)
  }

  const gableBuild=new Construction(materials,'vinci-computed-gable','vinci/grave-geometry')
  // An architectural study in a deep frame, distinct from the burial object.
  // Its three-dimensional stones and roof catch the computed low sun.
  const frameX = 1.20
  const frameY = 2.46
  const frameZ = -1.34
  const fw = 3.13
  const fh = 2.55
  gableBuild.box(frameX, frameY, frameZ - 0.22, fw, fh, 0.13, materials.dark)
  // Mitred solid strips retain the frame footprint; a small bevel catches
  // the grazing sun and exposes the corner joint as actual construction.
  const ow=fw/2+.045,oh=fh/2+.045,iw=fw/2-.045,ih=fh/2-.045,gap=.002
  const strips=[
    [[-ow+gap,oh],[ow-gap,oh],[iw-gap,ih],[-iw+gap,ih]],
    [[ow,oh-gap],[ow,-oh+gap],[iw,-ih+gap],[iw,ih-gap]],
    [[ow-gap,-oh],[-ow+gap,-oh],[-iw+gap,-ih],[iw-gap,-ih]],
    [[-ow,-oh+gap],[-ow,oh-gap],[-iw,ih-gap],[-iw,-ih+gap]],
  ]
  for(const corners of strips){
    const shape=new Shape();shape.moveTo(corners[0]![0]!,corners[0]![1]!)
    for(const [x,y] of corners.slice(1))shape.lineTo(x!,y!)
    shape.closePath()
    const strip=new ExtrudeGeometry(shape,{depth:.40,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:1,steps:1})
    strip.translate(frameX,frameY,frameZ-.22);gableBuild.geometry(strip,materials.bronze)
  }
  const gable = new Shape()
  gable.moveTo(-0.95, -0.68)
  gable.lineTo(0.95, -0.68)
  gable.lineTo(0.95, 0.28)
  gable.lineTo(0, 1.07)
  gable.lineTo(-0.95, 0.28)
  gable.closePath()
  const gableGeometry = new ExtrudeGeometry(gable, { depth: 0.20, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.012, bevelSegments: 1, steps: 1 })
  gableGeometry.translate(frameX, frameY - 0.12, frameZ - 0.14)
  gableBuild.geometry(gableGeometry, materials.stone)
  // Ashlar courses, a heavy sill, and finer recessed mortar preserve scale.
  for (let i = 0; i < 8; i++) {
    const y = frameY - 0.77 + i * 0.185
    const available = Math.min(1.87, Math.max(0.32, (frameY + 0.94 - y) * 2.40))
    // Joints read as joints when they are darker than the block, and lie in
    // the face rather than standing 8 mm off it.
    gableBuild.box(frameX, y, frameZ + 0.0745, available, 0.013, 0.007, materials.dark)
    const offset = i % 2 === 0 ? -0.5 : -0.21
    for (let j = 0; j < 3; j++) {
      const x = offset + j * 0.52
      if (Math.abs(x) < available / 2 - 0.1) gableBuild.box(frameX + x, y + 0.093, frameZ + 0.0745, 0.008, 0.17, 0.007, materials.dark)
    }
  }
  gableBuild.beam([frameX - 1.03, frameY + 0.17, frameZ + 0.09], [frameX, frameY + 1.03, frameZ + 0.09], 0.075, 0.16, materials.dark)
  gableBuild.beam([frameX, frameY + 1.03, frameZ + 0.09], [frameX + 1.03, frameY + 0.17, frameZ + 0.09], 0.075, 0.16, materials.dark)
  // Slate leaves sit over the existing roof supports. The nine courses,
  // 9 mm thickness and alternating joints are authored exhibition geometry,
  // not a measured claim about the chapel. Every leaf uses the same dark
  // material, so welding adds neither a draw nor a texture allocation.
  const pitchLength = Math.hypot(1.03, 0.86)
  const courseGauge = pitchLength / 9
  const roofDepth = 0.312
  for (const side of [-1, 1]) {
    const uphillX = -side * 1.03 / pitchLength
    const uphillY = 0.86 / pitchLength
    const outwardX = side * uphillY
    const outwardY = Math.abs(uphillX)
    // A thin fascia closes the observed gap to the masonry without moving
    // the gable or its roof. Its front is 22 mm behind the slate overhang.
    gableBuild.beam(
      [frameX + side * 1.03 - outwardX * 0.0225, frameY + 0.17 - outwardY * 0.0225, frameZ + 0.065],
      [frameX - outwardX * 0.0225, frameY + 1.03 - outwardY * 0.0225, frameZ + 0.065],
      0.085, 0.290, materials.dark,
    )
    for (let course = 0; course < 9; course++) {
      const lower = course * courseGauge
      const upper = Math.min(pitchLength, lower + courseGauge + 0.026)
      // Half-leaves at alternate course ends break the continuous joints.
      const joints = course % 2 === 0 ? [0, 0.104, 0.208, roofDepth] : [0, 0.052, 0.156, 0.260, roofDepth]
      for (let tile = 0; tile < joints.length - 1; tile++) {
        const a = joints[tile]!
        const b = joints[tile + 1]!
        const z = frameZ - 0.08 + (a + b) / 2
        // Each butt stands just above the preceding head. This small slope
        // makes the overlap a lit edge instead of two coplanar dark strips.
        gableBuild.beam(
          [frameX + side * 1.03 + uphillX * lower + outwardX * 0.050, frameY + 0.17 + uphillY * lower + outwardY * 0.050, z],
          [frameX + side * 1.03 + uphillX * upper + outwardX * 0.039, frameY + 0.17 + uphillY * upper + outwardY * 0.039, z],
          0.009, b - a - 0.003, materials.dark,
        )
      }
    }
  }
  // Three shallow cap pieces close the junction of the two slate pitches.
  for (let cap = 0; cap < 3; cap++) {
    gableBuild.box(frameX, frameY + 1.067, frameZ - 0.08 + (cap + 0.5) * 0.104, 0.090, 0.012, 0.101, materials.dark)
  }
  gableBuild.box(frameX, frameY - 0.41, frameZ + 0.081, 0.34, 0.52, 0.04, materials.dark)
  gableBuild.box(frameX, frameY - 0.67, frameZ + 0.13, 0.44, 0.06, 0.16, materials.stone)
  gableBuild.box(frameX, frameY - 0.41, frameZ + 0.13, 0.025, 0.47, 0.035, materials.bronze)
  gableBuild.box(frameX, frameY - 0.40, frameZ + 0.13, 0.30, 0.025, 0.035, materials.bronze)
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
  const ledge=new Construction(materials,'vinci-light-caption','vinci/grave-geometry')
  const ledgeWidth=options.mobile?2.62:2.36, ledgeHeight=options.mobile?.58:.50
  const inner=ledgeWidth-.26
  ledge.box(0,0,0,ledgeWidth,ledgeHeight,.075,materials.plaster)
  ledge.box(0,-ledgeHeight/2+.02,.035,ledgeWidth,.045,.075,materials.bronze)
  ledge.box(0,ledgeHeight/2-.012,.02,ledgeWidth,.028,.065,materials.stone)
  // Each line takes the largest cap height that keeps it ON one line. Caps run
  // wider than a lowercase sentence and German runs wider again; a size typed
  // once for English wraps the caption and the two lines then collide.
  const fit=(value:string,cap:number)=>Math.min(cap,inner/Math.max(1e-6,lineAdvance(value,1))*.985)
  const first=text('CHOSEN LIGHT · A DIAGRAM','GEWÄHLTES LICHT · EINE STUDIE')
  const second=text('2 MAY 1519 · JULIAN CALENDAR','2. MAI 1519 · JULIANISCH')
  ledge.text(first, -inner/2, ledgeHeight/2-.085, .042, fit(first,options.mobile?.155:.118), inner)
  ledge.text(second, -inner/2, -.075, .042, fit(second,options.mobile?.115:.082), inner)
  const caption=ledge.finish()
  caption.rotation.x=-.44
  caption.position.set(frameX,options.mobile?1.00:.95,frameZ+(options.mobile?.34:.32))
  gableBuild.group.add(caption)
  const framedGable=gableBuild.finish()
  const gableScale=options.mobile?.84:1, gableShift:[number,number,number]=options.mobile?[-1.26,0,-1.55]:[0,0,0]
  if(options.mobile){framedGable.scale.setScalar(gableScale);framedGable.position.set(...gableShift)}
  build.group.add(framedGable);build.finish()
  // The points a frame has to hold: nothing of the burial or its diagram may
  // fall under a card, so the host composes from these and not from a guess.
  const placed=(x:number,y:number,z:number):[number,number,number]=>[x*gableScale+gableShift[0],y*gableScale+gableShift[1],z*gableScale+gableShift[2]]
  const framePoints:[number,number,number][]=[
    [centreX-0.99,0.24,centreZ+1.775],[centreX+0.99,0.24,centreZ+1.775],
    [centreX-0.99,0.24,centreZ-1.775],[centreX+0.99,0.24,centreZ-1.775],
    [plaqueX-0.80,1.12,plaqueZ],[plaqueX+0.80,0.02,plaqueZ+0.10],
    placed(frameX-1.66,0.0,frameZ),placed(frameX+1.66,frameY+1.33,frameZ),
    options.mobile?[centreX+.34,.12,centreZ-2.74]:[noteX-.78,.72,noteZ],
    options.mobile?[centreX-.60,.12,centreZ-2.20]:[noteX+.78,.06,noteZ],
  ]
  const metadata = {
    kind: 'grave',
    slabText: GRAVE_EVIDENCE.slab,
    plaqueText: text(GRAVE_EVIDENCE.presumption,'mutmaßliche Überreste'),
    evidence: GRAVE_EVIDENCE,
    hour: GRAVE_HOUR,
    sunDirection: graveSunDirection(),
    classification: 'GENERATED',
    framePoints,
    geometryDisclosure: text('Generated exhibition study; slab and gable dimensions are interpretive, not a measured architectural replica. Portrait medallion not reproduced.','Generierte Ausstellungsstudie. Die Maße von Grabplatte und Giebel beruhen auf einer Interpretation. Die Studie ist keine vermessene architektonische Nachbildung. Das Porträtmedaillon wird nicht wiedergegeben.'),
    anchors: { slab: [centreX, 0.24, centreZ], plaque: [plaqueX, 0.9, plaqueZ + 0.05], computedFrame: options.mobile?[frameX*.84-1.26,frameY*.84,(frameZ+.1)*.84-1.55]:[frameX, frameY, frameZ + 0.1] },
  }
  build.group.userData.exhibit = metadata
  return { group: build.group, metadata, dispose: () => build.dispose() }
}

/* THE PAINTING OF A DEATH NOBODY WITNESSED, at the grave it belongs to.
   A French painter imagined the scene three hundred years after it, and the
   museum hangs it where the record of that afternoon is read, not as the
   likeness of an hour. The label is cut into the wall beside it and the card
   carries the record: at this distance a label is a label, and the reading is
   in the card. */
const DEATHBED = words.deathbed_label
/** The reproduction is 40 by 50.5 cm. It hangs here at 1.9 m across, and the
 * wall says so. The far wall stands fourteen metres from the eye, and this is
 * the one band of it both viewports hold whole: east of the card's edge on the
 * wide stage, west of the diagram frame's own silhouette, and inside the
 * narrow stage's much shorter field. Wider than this and the phone cuts it. */
const DEATHBED_DISPLAY = {
  width: 1.9, height: 1.9 * 3252 / 4096, imageWidth: 4096, imageHeight: 3252,
  originalWidth: 0.505, originalHeight: 0.4,
  centreX: -0.42, centreY: 2.62, faceZ: -5.39,
} as const

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
  build.text('INGRES · 1818', labelLeft, labelTop - title.height - .10, z + .085, .082, labelWidth, materials.bronze)
  build.text('Paris Musées', labelLeft, labelTop - title.height - .26, z + .085, .058, labelWidth)
  build.text(text('A small painting enlarged for this room', 'Ein kleines Gemälde für diesen Raum vergrößert'),
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

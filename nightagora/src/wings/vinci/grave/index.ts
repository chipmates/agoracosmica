import { CylinderGeometry, ExtrudeGeometry, Shape } from 'three/webgpu'
import { Construction, exhibitionFloor, type ExhibitMaterials, type ExhibitionObject } from '../myths/construction'

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
export function createGrave(materials: ExhibitMaterials): ExhibitionObject {
  const build = new Construction(materials, 'vinci-grave', 'vinci/grave-geometry')
  exhibitionFloor(build, 12, 13)
  // Low masonry holds the slab in the floor. The narrow stepped reveal makes
  // its weight readable even under the grazing light of the closing room.
  const centreX = -0.95
  const centreZ = 0.65
  build.box(centreX, 0.075, centreZ, 2.16, 0.15, 3.74, materials.dark)
  build.box(centreX, 0.148, centreZ, 2.04, 0.13, 3.61, materials.stone)
  build.box(centreX, 0.211, centreZ, 1.98, 0.025, 3.55, materials.plaster)

  // The documented name is the ONLY writing on the slab. The portrait
  // medallion is omitted from this openly generated study; no face invented.
  const slabName = new Construction(materials, 'vinci-grave-slab-name', 'vinci/grave-geometry')
  const labelWidth = 1.74
  slabName.text(GRAVE_EVIDENCE.slab, -labelWidth / 2, 0, 0, 0.137, labelWidth, materials.ink, 0.003)
  const slabText = slabName.finish()
  slabText.rotation.x = -Math.PI / 2
  slabText.position.set(centreX, 0.227, centreZ + 1.06)
  build.group.add(slabText)

  // Beaten bronze inset rings recall the mounting's material without
  // fabricating the profile carried by the modern tomb photograph.
  const ringOuter = new CylinderGeometry(0.52, 0.52, 0.015, 72)
  ringOuter.translate(centreX, 0.235, centreZ - 0.7)
  build.geometry(ringOuter, materials.bronze)
  const ringInner = new CylinderGeometry(0.47, 0.47, 0.018, 72)
  ringInner.translate(centreX, 0.239, centreZ - 0.7)
  build.geometry(ringInner, materials.dark)

  // Fine stone-edge dents collect toward the foot, leaving the name clear.
  for (let i = 0; i < 35; i++) {
    const z = centreZ - 1.66 + i / 34 * 3.32
    const side = i % 2 === 0 ? -1 : 1
    build.box(centreX + side * 0.989, 0.229, z, 0.012 + (i % 3) * 0.005, 0.006, 0.009 + (i % 5) * 0.012, materials.stone)
  }

  // A separate low lectern makes "presumed" physically separate as well.
  const plaqueX = 1.44
  const plaqueZ = 1.45
  build.box(plaqueX, 0.48, plaqueZ - 0.11, 1.54, 0.96, 0.20, materials.stone)
  build.box(plaqueX, 0.71, plaqueZ + 0.014, 1.60, 0.76, 0.065, materials.plaster)
  build.text('presumed remains', plaqueX - 0.70, 0.98, plaqueZ + 0.05, 0.13, 1.40, materials.ink)
  build.text('1863', plaqueX - 0.70, 0.68, plaqueZ + 0.05, 0.095, 1.4, materials.bronze)
  build.text('The identification remains presumed.', plaqueX - 0.70, 0.51, plaqueZ + 0.05, 0.070, 1.4)

  // An architectural study in a deep frame, distinct from the burial object.
  // Its three-dimensional stones and roof catch the computed low sun.
  const frameX = 1.20
  const frameY = 2.46
  const frameZ = -1.34
  const fw = 3.13
  const fh = 2.55
  build.box(frameX, frameY, frameZ - 0.22, fw, fh, 0.13, materials.dark)
  for (const side of [-1, 1]) {
    build.box(frameX + side * fw / 2, frameY, frameZ - 0.02, 0.09, fh + 0.09, 0.40, materials.bronze)
    build.box(frameX, frameY + side * fh / 2, frameZ - 0.02, fw - 0.09, 0.09, 0.40, materials.bronze)
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
  build.geometry(gableGeometry, materials.stone)
  // Ashlar courses, a heavy sill, and finer recessed mortar preserve scale.
  for (let i = 0; i < 8; i++) {
    const y = frameY - 0.77 + i * 0.185
    const available = Math.min(1.87, Math.max(0.32, (frameY + 0.94 - y) * 2.40))
    build.box(frameX, y, frameZ + 0.067, available, 0.011, 0.008, materials.plaster)
    const offset = i % 2 === 0 ? -0.5 : -0.21
    for (let j = 0; j < 3; j++) {
      const x = offset + j * 0.52
      if (Math.abs(x) < available / 2 - 0.1) build.box(frameX + x, y + 0.086, frameZ + 0.068, 0.009, 0.16, 0.009, materials.plaster)
    }
  }
  build.beam([frameX - 1.03, frameY + 0.17, frameZ + 0.09], [frameX, frameY + 1.03, frameZ + 0.09], 0.075, 0.16, materials.dark)
  build.beam([frameX, frameY + 1.03, frameZ + 0.09], [frameX + 1.03, frameY + 0.17, frameZ + 0.09], 0.075, 0.16, materials.dark)
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
    build.beam(
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
        build.beam(
          [frameX + side * 1.03 + uphillX * lower + outwardX * 0.050, frameY + 0.17 + uphillY * lower + outwardY * 0.050, z],
          [frameX + side * 1.03 + uphillX * upper + outwardX * 0.039, frameY + 0.17 + uphillY * upper + outwardY * 0.039, z],
          0.009, b - a - 0.003, materials.dark,
        )
      }
    }
  }
  // Three shallow cap pieces close the junction of the two slate pitches.
  for (let cap = 0; cap < 3; cap++) {
    build.box(frameX, frameY + 1.067, frameZ - 0.08 + (cap + 0.5) * 0.104, 0.090, 0.012, 0.101, materials.dark)
  }
  build.box(frameX, frameY - 0.41, frameZ + 0.081, 0.34, 0.52, 0.04, materials.dark)
  build.box(frameX, frameY - 0.67, frameZ + 0.13, 0.44, 0.06, 0.16, materials.stone)
  build.box(frameX, frameY - 0.41, frameZ + 0.13, 0.025, 0.47, 0.035, materials.bronze)
  build.box(frameX, frameY - 0.40, frameZ + 0.13, 0.30, 0.025, 0.035, materials.bronze)
  // The arithmetic is cut into a distinct mount below the computed object.
  build.box(frameX, 0.91, frameZ - 0.015, 3.12, 0.38, 0.12, materials.plaster)
  build.text('2 MAY 1519 · 18:50–18:51 UT', frameX - 1.43, 1.035, frameZ + 0.051, 0.092, 2.84)
  build.text('START AZ 292.712° · ALT 3.736° · CHOSEN MINUTE', frameX - 1.43, 0.872, frameZ + 0.051, 0.064, 2.84)
  build.finish()
  const metadata = {
    kind: 'grave',
    slabText: GRAVE_EVIDENCE.slab,
    plaqueText: GRAVE_EVIDENCE.presumption,
    evidence: GRAVE_EVIDENCE,
    hour: GRAVE_HOUR,
    sunDirection: graveSunDirection(),
    classification: 'GENERATED',
    geometryDisclosure: 'Generated exhibition study; slab and gable dimensions are interpretive, not a measured architectural replica. Portrait medallion not reproduced.',
    anchors: { slab: [centreX, 0.24, centreZ], plaque: [plaqueX, 0.9, plaqueZ + 0.05], computedFrame: [frameX, frameY, frameZ + 0.1] },
  }
  build.group.userData.exhibit = metadata
  return { group: build.group, metadata, dispose: () => build.dispose() }
}

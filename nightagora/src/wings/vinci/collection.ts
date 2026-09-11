/** Contemporary collection massing, separately authored from the maquette's
 * placement schedule. Metres are east, north, height above the house datum.
 * This module never changes an IGN sample and imports no photographic asset.
 * Its grade proposals must be composed by terrain-mesh before it is mounted.
 */
import {
  BackSide, BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute,
  Group, Mesh, MeshStandardNodeMaterial, Vector3,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { world } from './site'

type Point = [east: number, north: number]
type Point3 = [east: number, north: number, height: number]
type Bounds = { minE: number; maxE: number; minN: number; maxN: number }
type SurfaceRole = 0 | 1 | 2 | 3 | 4
export interface CollectionGradeRegion {
  id: string
  points: Point[]
  bounds: Bounds
  height: number
  levelAt: (east: number, north: number) => number
  gradient: Point
  surface: 'earth'
}

/** Fixed design coordinates from the reference, not historic measurements. */
export const collectionLayout = {
  west: -62, east: -22, south: -64, north: -34, floor: -6.4,
  galleryDepth: 8, galleryClear: 4.7, hallClear: 6.7,
  apron: { west: -65, east: -19, south: -67, north: -31, height: -6.44 },
  rooms: [
    { id: 'picture-room', bounds: [-61.6, -41.7, -22.4, -34.3], clear: 4.7 },
    { id: 'mechanism-hall', bounds: [-61.6, -63.6, -39, -42.1], clear: 6.7 },
    { id: 'reading-table', bounds: [-38.6, -49, -22.4, -42.1], clear: 4.7 },
    { id: 'line', bounds: [-38.6, -55.8, -22.4, -49.4], clear: 4.7 },
    { id: 'corrections', bounds: [-38.6, -63.6, -31, -56.2], clear: 4.7 },
    { id: 'grave', bounds: [-30.6, -63.6, -22.4, -56.2], clear: 4.7 },
  ],
  stair: { east: -20.7, north: -15, south: -30, top: -1.9, width: 2.5, count: 27 },
  topLanding: { west: -21.95, east: -19.45, south: -15, north: -13, height: -1.9 },
  channel: { west: -61.5, east: -27.8, south: -32.8, north: -32, water: -6.56, bed: -6.82 },
} as const

const rectangle = (west: number, south: number, east: number, north: number): Point[] =>
  [[west, south], [east, south], [east, north], [west, north]]
const bounds = (points: Point[]): Bounds => ({
  minE: Math.min(...points.map(p => p[0])), maxE: Math.max(...points.map(p => p[0])),
  minN: Math.min(...points.map(p => p[1])), maxN: Math.max(...points.map(p => p[1])),
})
const C = collectionLayout, A = C.apron, S = C.stair, W = C.channel
const apronOutline = rectangle(A.west, A.south, A.east, A.north)
const stairTread = (i: number) => {
  const depth = (S.north - S.south) / S.count
  const north = S.north - i * depth, south = north - depth
  const height = S.top + (C.floor - S.top) * (i + 1) / S.count
  return { north, south, height, points: rectangle(S.east - S.width / 2, south, S.east + S.width / 2, north) }
}
const region = (id: string, points: Point[], height: number): CollectionGradeRegion =>
  ({ id, points, bounds: bounds(points), height, levelAt: () => height, gradient: [0, 0], surface: 'earth' })

/** The pavilion/apron keep the registered platforms' priority. Only the
 * precise modern approach and landing footprints cut the terrace. Terrain
 * owns the exposed cut/fill banks; this module owns the paving and cheeks.
 */
export function getCollectionGradeRegions(): CollectionGradeRegion[] {
  return [
    region('collection-apron', apronOutline.map(p => [...p]), A.height - .06),
    region('collection-entry-landing', rectangle(S.east - S.width / 2, -34, S.east + S.width / 2, -30), C.floor - .06),
    region('collection-top-landing', rectangle(C.topLanding.west, C.topLanding.south, C.topLanding.east, C.topLanding.north), C.topLanding.height - .06),
    ...Array.from({ length: S.count }, (_, i) => {
      const tread = stairTread(i)
      return region(`collection-approach-${i + 1}`, tread.points, tread.height - .06)
    }),
    // The existing 140 mm finish cheeks stand on these exact strips.
    // Terrain supplies their complete cut/fill support down to the retained
    // surrounding grade, including both landing heads. The inner walking
    // width and every stair/landing finish level remain unchanged.
    ...approachPieces().flatMap((piece, i) => [-1, 1].map(side => {
      const inside = S.east + side * S.width / 2, outside = inside + side * .14
      return region(`collection-approach-cheek-${side < 0 ? 'west' : 'east'}-${i}`,
        rectangle(Math.min(inside, outside), piece.south, Math.max(inside, outside), piece.north), piece.height - .22)
    })),
    region('collection-water-channel', rectangle(W.west, W.south, W.east, W.north), W.bed - .04),
  ]
}

export const isCollectionApproachRegion = (id: string): boolean =>
  id.startsWith('collection-approach-') || id === 'collection-entry-landing' || id === 'collection-top-landing'

// Continuous 140 mm coping cheeks belong to the construction, including
// their two landings. Their exact height band is also the terrain's only
// exclusion: any bank above or below it remains an exposed concrete face.
const approachPieces = () => [
  { north: C.topLanding.north, south: C.topLanding.south, height: C.topLanding.height },
  ...Array.from({ length: S.count }, (_, i) => stairTread(i)),
  { north: S.south, south: C.north, height: C.floor },
]
export function collectionCheekBand(a: Point, b: Point): { bottom: number; top: number } | undefined {
  const epsilon = 1e-6, pieces = approachPieces()
  const band = (piece: typeof pieces[number]) => ({ bottom: piece.height - .22, top: piece.height + .09 })
  // A cut can expose either face of the cheek. Omit only the actual
  // finish interval; the continuous terrain lining owns all support below
  // it and every retained bank above it, including at the landing heads.
  if (Math.abs(a[0] - b[0]) < epsilon) {
    const planes = [-1, 1].flatMap(side => [S.east + side * S.width / 2, S.east + side * (S.width / 2 + .14)])
    if (!planes.some(e => Math.abs(e - a[0]) < epsilon)) return
    const north = (a[1] + b[1]) / 2
    const piece = pieces.find(p => north > p.south - epsilon && north < p.north + epsilon)
    if (piece && Math.min(a[1], b[1]) >= piece.south - epsilon && Math.max(a[1], b[1]) <= piece.north + epsilon) return band(piece)
  }
  if (Math.abs(a[1] - b[1]) < epsilon) {
    const piece = Math.abs(a[1] - C.topLanding.north) < epsilon ? pieces[0]
      : Math.abs(a[1] - C.north) < epsilon ? pieces[pieces.length - 1] : undefined
    if (!piece) return
    const acrossCheek = [-1, 1].some(side => {
      const inner = S.east + side * S.width / 2, outer = inner + side * .14
      return Math.min(a[0], b[0]) >= Math.min(inner, outer) - epsilon && Math.max(a[0], b[0]) <= Math.max(inner, outer) + epsilon
    })
    if (acrossCheek) return band(piece)
  }
}

/** Exclude every planted crown, trunk, root and ground-dressing triangle from
 * these outlines. Callers can add their object's physical radius as a margin.
 */
export const collectionExclusions: readonly { id: string; points: Point[]; bounds: Bounds }[] = [
  { id: 'collection-pavilions-and-apron', points: apronOutline, bounds: bounds(apronOutline) },
  { id: 'collection-approach-and-cheeks', points: rectangle(S.east - S.width / 2 - .14, -34, S.east + S.width / 2 + .14, C.topLanding.north),
    bounds: { minE: S.east - S.width / 2 - .14, maxE: S.east + S.width / 2 + .14, minN: -34, maxN: C.topLanding.north } },
  { id: 'collection-entrance-canopy', points: rectangle(-22.8, -41.75, -18.55, -34.05),
    bounds: { minE: -22.8, maxE: -18.55, minN: -41.75, maxN: -34.05 } },
]

export const collectionLabel = {
  en: 'The collection is the museum’s own insertion, built in our century. Its proposed pavilions occupy a 40 by 30 m envelope west of the garden, with their floor 6.4 m below the house datum. The maquette supplies this placement. It does not document a building here in 1517. Rooms and exhibits are in construction.',
  de: 'Die Sammlung ist ein eigener Einbau des Museums aus unserem Jahrhundert. Die vorgeschlagenen Pavillons nehmen westlich des Gartens eine Fläche von 40 mal 30 m ein. Ihr Boden liegt 6,4 m unter dem Höhendatum des Hauses. Diese Lage stammt aus der Maquette. Sie belegt hier kein Gebäude im Jahr 1517. Räume und Ausstellungsstücke sind im Bau.',
}
export const collectionProvenance = {
  manifestId: 'vinci/collection', assetClass: 'GENERATED', certainty: 'reconstructed',
  source: ['brief/COMMISSION.md § Judges list 10', 'brief/maquette/maquette.ts COLLECTION, collectionCut and garden approach', 'brief/CONCEPT.md §2 two grounds'],
  label: collectionLabel,
  parameterLabel: {
    en: 'Exhibition design ranges, not survey errors: pavilion width 38–42 m and depth 28–32 m, floor −7.0 to −5.8 m, lower clear height 4.4–5.0 m and hall clear height 6.4–7.0 m. Fixed maquette nominals are 40 m, 30 m, −6.4 m, 4.7 m and 6.7 m. Proposed post sections 0.08–0.14 m and grid 3.5–4.2 m, roof thickness 0.16–0.30 m and apron width 2.5–3.5 m. The new ornamental channel is 0.8 m wide within a 0.6–1.2 m design range. Materials, joints and weathering are authored surface choices. All four roof soffits share the pale cast-concrete finish of the pavilion base. The two 0.10 m entrance posts retain their centres and floor-level feet; their inclined heads meet the existing canopy underside exactly, giving centre heights 4.62292 and 4.70474 m. These are construction dimensions derived from the same proposed canopy, not new survey measurements.',
    de: 'Entwurfsbereiche der Ausstellung, keine Vermessungsfehler: Pavillonbreite 38–42 m und Tiefe 28–32 m, Bodenhöhe −7,0 bis −5,8 m, untere lichte Höhe 4,4–5,0 m und lichte Hallenhöhe 6,4–7,0 m. Die festen Nennwerte der Maquette sind 40 m, 30 m, −6,4 m, 4,7 m und 6,7 m. Vorgeschlagene Stützenquerschnitte 0,08–0,14 m und Raster 3,5–4,2 m, Dachstärke 0,16–0,30 m und Vorbereichsbreite 2,5–3,5 m. Der neue Zierwasserkanal ist 0,8 m breit innerhalb eines Entwurfsbereichs von 0,6–1,2 m. Materialien, Fugen und Verwitterung sind gestaltete Oberflächen. Alle vier Dachuntersichten erhalten denselben hellen Ortbeton wie der Pavillonsockel. Die beiden 0,10 m starken Eingangsstützen behalten ihre Mittelpunkte und ihre Füße auf Bodenhöhe; ihre geneigten Köpfe treffen die vorhandene Vordachuntersicht genau, mit mittleren Höhen von 4,62292 und 4,70474 m. Diese Konstruktionsmaße ergeben sich aus demselben vorgeschlagenen Vordach und sind keine neuen Vermessungswerte.',
  },
  approachLabel: {
    en: 'Modern museum proposal: a 2.5 × 2 m top landing occupies E −21.95 to −19.45 m, N −15 to −13 m at H −1.9 m. Its paving and the 27 maquette treads alone cut the registered terrace within their exact footprints; grade is 0.06 m beneath the paving. Landing design ranges are 2.3–2.7 m wide, 1.8–2.2 m long and H −2.0 to −1.8 m; these are design choices, not measured uncertainty. Concrete finish cheeks are 0.14 m wide [0.12–0.18], rise 0.09 m [0.06–0.12] and extend 0.22 m below each paving level [0.18–0.26]. Their exact footprints now receive structural support from the existing grade to the finish underside, including both landing heads. This derived support is a modern construction proposal with no fixed historical depth. All uncovered cut and fill boundaries remain closed with modern concrete. Raw IGN samples and registered platform coordinates are unchanged.',
    de: 'Moderner Museumsvorschlag: Ein oberes Podest von 2,5 × 2 m liegt bei E −21,95 bis −19,45 m, N −15 bis −13 m auf H −1,9 m. Nur sein Belag und die 27 Stufen der Maquette schneiden innerhalb ihrer genauen Grundrisse in die registrierte Terrasse ein; das Planum liegt 0,06 m unter dem Belag. Die Entwurfsbereiche des Podests sind 2,3–2,7 m Breite, 1,8–2,2 m Länge und H −2,0 bis −1,8 m; dies sind Entwurfsentscheidungen, keine Messunsicherheiten. Die sichtbaren Betonwangen sind 0,14 m breit [0,12–0,18], stehen 0,09 m hoch [0,06–0,12] und reichen 0,22 m unter jeden Belag [0,18–0,26]. Ihre genauen Grundrisse erhalten nun einen tragenden Unterbau vom vorhandenen Gelände bis zur Unterseite, auch an beiden Podestenden. Dieser abgeleitete Unterbau ist ein moderner Konstruktionsvorschlag ohne festgelegte historische Tiefe. Alle unbedeckten Abgrabungs- und Aufschüttungskanten bleiben durch modernen Beton geschlossen. Die IGN-Rohwerte und registrierten Plattformkoordinaten bleiben unverändert.',
  },
  recipe: 'Original welded geometry from the commissioned maquette envelope and reserved rooms. Three low roof volumes with the existing pale cast-concrete finish on every soffit, slender steel bays, entrance posts whose inclined heads are derived from the retained canopy underside plane, actual full-height glass planes with recessed dark enclosure, concrete base, saw-cut paving, twenty-seven garden treads, a separately proposed 2.5 × 2 m top landing and ornamental water channel. Exact modern walking and 140 mm cheek footprints override terrace grade; no raw IGN sample or registered platform coordinate changes. Each cheek underside has a supporting cut/fill region at paving minus 220 mm. Continuous concrete finish replaces only its actual covered height band on both side planes and the two landing heads; terrain closes all remaining support. Buried underside faces and internal underside riser caps are omitted. No period collection, machinery, paintings or occupied interiors are asserted. No reference image is sampled. Three independently filtered procedural material scales, no new texture assets.',
  date: '2026-09-09',
} as const

/** Welded opaque batches. Per-face colour and material role preserve dark
 * steel, slate, shaded interiors and paving; cast concrete is separate.
 * These are ordinary welded meshes, so the shared shadow pass sees them.
 */
class CollectionBatch {
  private p: number[] = []; private n: number[] = []; private u: number[] = []
  private c: number[] = []; private r: number[] = []
  private vertex(p: Vector3, n: Vector3, u: Point, colour: Color, role: SurfaceRole): void {
    this.p.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z); this.u.push(...u)
    this.c.push(colour.r, colour.g, colour.b); this.r.push(role)
  }
  quad(a: Point3, b: Point3, c: Point3, d: Point3, colour: string, role: SurfaceRole = 0, facing?: Point3): void {
    const v = [world(...a), world(...b), world(...c), world(...d)], colourValue = new Color(colour)
    const normal = v[1]!.clone().sub(v[0]!).cross(v[2]!.clone().sub(v[0]!)).normalize()
    const tex: Point[] = [[0, 0], [v[0]!.distanceTo(v[1]!), 0], [v[0]!.distanceTo(v[1]!), v[1]!.distanceTo(v[2]!)], [0, v[0]!.distanceTo(v[3]!)]]
    // Preserve each original triangle and its diagonal; only its winding
    // and geometric normal may change to the stated physical exterior.
    const reverse = facing !== undefined && normal.dot(world(...facing)) < 0
    if (reverse) normal.negate()
    for (const i of reverse ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]) this.vertex(v[i]!, normal, tex[i]!, colourValue, role)
  }
  box(e: number, n: number, h: number, width: number, depth: number, height: number, colour: string, role: SurfaceRole = 0): void {
    if (Math.min(width, depth, height) <= 0) return
    const geometry = new BoxGeometry(width, height, depth)
    geometry.translate(e, h, -n)
    const p = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), u = geometry.getAttribute('uv'), colourValue = new Color(colour)
    for (let j = 0; j < geometry.index!.count; j++) {
      const i = geometry.index!.getX(j), nx = Math.abs(normal.getX(i)), ny = Math.abs(normal.getY(i))
      this.vertex(new Vector3(p.getX(i), p.getY(i), p.getZ(i)), new Vector3(normal.getX(i), normal.getY(i), normal.getZ(i)),
        [u.getX(i) * (nx > .5 ? depth : width), u.getY(i) * (ny > .5 ? depth : height)], colourValue, role)
    }
    geometry.dispose()
  }
  geometry(): BufferGeometry {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new Float32BufferAttribute(this.n, 3))
    g.setAttribute('uv', new Float32BufferAttribute(this.u, 2)); g.setAttribute('color', new Float32BufferAttribute(this.c, 3))
    g.setAttribute('collectionRole', new Float32BufferAttribute(this.r, 1)); g.computeBoundingBox(); g.computeBoundingSphere()
    return g
  }
}

function architectureMaterial(): MeshStandardNodeMaterial {
  // Keep the composable node overload boundary local to this material.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type N = any
  const { attribute, cameraViewMatrix, float, floor, fract, length, mix, mx_noise_float,
    normalWorldGeometry, positionView, positionWorld, smoothstep, uv } = TSL as unknown as Record<string, N>
  const m = new MeshStandardNodeMaterial({ roughness: .82, side: DoubleSide, shadowSide: BackSide })
  const P = positionWorld, U = uv(), role = attribute('collectionRole', 'float')
  const pixel = length(P.dFdx()).add(length(P.dFdy())).max(.000001)
  const resolved = (metres: number) => smoothstep(2, 4, float(metres).div(pixel))
  const macro = mx_noise_float(P.mul(.36)).mul(resolved(2.78)).toVar()
  const middle = mx_noise_float(P.mul(6.25)).mul(resolved(.16)).toVar()
  const grain = mx_noise_float(P.mul(180)).mul(resolved(.0055)).toVar()
  const isSlate = role.equal(2), isSteel = role.equal(1), isPaving = role.equal(4)
  const footprint = (coordinate: N): N => coordinate.dFdx().abs().add(coordinate.dFdy().abs()).max(.000001)
  const px = footprint(U.x), py = footprint(U.y), xx = U.x.div(.34), yy = U.y.div(.20)
  const fx = px.div(.34).max(.0001), fy = py.div(.20).max(.0001), roofRow = floor(yy)
  const roofDetail = smoothstep(.65, 1.7, float(.34).div(px).min(float(.20).div(py)))
  const coverage = (centre: N, width: N, lo: N, hi: N): N =>
    centre.add(width.mul(.5)).min(hi).sub(centre.sub(width.mul(.5)).max(lo)).max(0).div(width)
  let total: N = float(0), weight: N = float(0), jointArea: N = float(0)
  // Integrate the nine neighbouring cells, including staggered row offsets.
  // Their inner rectangles exclude the real 6/8 mm joints, so colour and
  // seam coverage use the same pixel area. Fade to the exact mean once the
  // footprint outgrows this neighbourhood; never sample a hard cell hash.
  for (let j = -1; j <= 1; j++) {
    const row = roofRow.add(j), offset = fract(row.mul(.5)), x = xx.add(offset), column = floor(x)
    const wy = coverage(yy, fy, row, row.add(1))
    const innerY = coverage(yy, fy, row.add(.004 / .20), row.add(1 - .004 / .20))
    for (let i = -1; i <= 1; i++) {
      const cell = column.add(i), wx = coverage(x, fx, cell, cell.add(1)), area = wx.mul(wy)
      const innerX = coverage(x, fx, cell.add(.003 / .34), cell.add(1 - .003 / .34))
      const value = fract(cell.mul(31.17).add(row.mul(13.713)).sin().mul(4317.1))
      total = total.add(value.mul(area)); weight = weight.add(area)
      jointArea = jointArea.add(area.sub(innerX.mul(innerY)).max(0))
    }
  }
  const roofJointMean = 1 - (1 - .006 / .34) * (1 - .008 / .20)
  const slateTone = mix(float(.5), total.div(weight.max(.000001)), roofDetail).sub(.5).mul(.18).toVar()
  const roofJoint = mix(float(roofJointMean), jointArea.div(weight.max(.000001)).clamp(0, 1), roofDetail).toVar()
  const line = (coordinate: N, spacing: number, width: number): N => {
    const phase = coordinate.div(spacing).add(width / spacing / 2), span = footprint(coordinate).div(spacing)
    const primitive = (x: N): N => floor(x).mul(width / spacing).add(fract(x).clamp(0, width / spacing))
    return primitive(phase.add(span.mul(.5))).sub(primitive(phase.sub(span.mul(.5)))).div(span).clamp(0, 1)
  }
  const jointX = line(P.x, 1.5, .012), jointZ = line(P.z, 1.5, .012)
  const pavingJoint = float(1).sub(float(1).sub(jointX).mul(float(1).sub(jointZ))).toVar()
  const joints = isSlate.select(roofJoint.mul(.20), isPaving.select(pavingJoint.mul(.25), float(0)))
  const drift = isSlate.select(slateTone, float(0))
  m.colorNode = attribute('color', 'vec3').mul(macro.mul(.11).add(middle.mul(.075)).add(grain.mul(.026)).add(drift).add(1)).mul(float(1).sub(joints))
  m.roughnessNode = isSteel.select(float(.47), isSlate.select(float(.71), float(.87))).add(grain.mul(.025)).clamp(.44, .90)
  m.metalnessNode = isSteel.select(float(.65), float(0))
  // Procedural world-height derivatives avoid an inferred tangent frame on
  // every indexed box triangle. Geometric normals remain the common datum;
  // the bounded gradient converges to them as each physical scale fades.
  const relief = isSlate.select(roofJoint.sub(roofJointMean).mul(-.0007).mul(roofDetail),
    isPaving.select(pavingJoint.mul(-.0006), float(0)))
  const height = macro.mul(.0002).add(middle.mul(.00045)).add(grain.mul(.00002)).add(relief)
    .mul(isSteel.select(float(.18), float(1))).toVar()
  const viewNormal = normalWorldGeometry.transformDirection(cameraViewMatrix), sx = positionView.dFdx(), sy = positionView.dFdy()
  const rx = sy.cross(viewNormal), ry = viewNormal.cross(sx), det = sx.dot(rx)
  const gradient = rx.mul(height.dFdx()).add(ry.mul(height.dFdy())).mul(det.sign()).div(det.abs().max(1e-10)).toVar()
  m.normalNode = viewNormal.sub(gradient.div(length(gradient).div(.12).max(1))).normalize()
  m.name = 'vinci/collection/three-scale-architecture'; m.userData['provenance'] = collectionProvenance.recipe
  m.userData['normalGradientLimit'] = .12
  m.userData['filtering'] = 'Original 2.78 m drift, 0.16 m structure and 5.5 mm grain; exact nine-cell pixel coverage of 0.34 × 0.20 m staggered slate and 6/8 mm joints, blending to their area mean. Paving saw cuts integrate a 12 mm band on a 1.5 m world grid. Relief uses bounded world/view derivatives, no tangent-space normal map.'
  return m
}

/** The pavilion, cheek and terrain lining share the same contemporary cast
 * concrete. Continuous world projections prevent seams at clipped strips;
 * all fine detail fades by pixel footprint instead of shimmering in motion.
 */
export function collectionConcreteMaterial(closedCaster = false): MeshStandardNodeMaterial {
  const { cameraViewMatrix, float, floor, fract, length, mix, mx_noise_float, normalWorldGeometry, positionView, positionWorld, smoothstep, vec2, vec3 } = TSL
  // Terrain retaining strips and hall returns are single surfaces. Only
  // the explicitly closed construction batches cast their back faces.
  const m = new MeshStandardNodeMaterial({ roughness: .88, side: DoubleSide, shadowSide: closedCaster ? BackSide : DoubleSide })
  const P = positionWorld, n = normalWorldGeometry
  const vertical = float(1).sub(smoothstep(.4, .8, n.y.abs()))
  const axis = vec2(n.z, n.x.negate()).div(length(n.xz).max(.00001))
  const U = vec2(mix(P.x, P.x.mul(axis.x).add(P.z.mul(axis.y)), vertical), mix(P.z, P.y, vertical))
  const pixel = length(P.dFdx()).add(length(P.dFdy())).max(.000001)
  const resolved = (metres: number) => smoothstep(2, 4, float(metres).div(pixel))
  const line = (coordinate: typeof P.x, spacing: number, width: number) => {
    const f = fract(coordinate.div(spacing)), edge = f.min(float(1).sub(f)).mul(spacing)
    return float(1).sub(smoothstep(float(width).sub(pixel.mul(.5)).max(0), float(width).add(pixel.mul(.5)), edge)).mul(resolved(spacing))
  }
  const drift = mx_noise_float(P.mul(.31)).mul(resolved(3.2))
  const aggregate = mx_noise_float(P.mul(10)).mul(resolved(.10))
  const pores = smoothstep(.32, .66, mx_noise_float(P.mul(220))).mul(resolved(.0045))
  const panelX = floor(U.x.div(1.2)), panelY = floor(U.y.div(.6))
  const panel = fract(panelX.mul(17.37).add(panelY.mul(31.71)).sin().mul(43758.54)).sub(.5).mul(resolved(.6))
  const joint = line(U.x, 1.2, .002).max(line(U.y, .6, .002))
  const board = line(U.y, .15, .0007).mul(vertical)
  const tiePosition = vec2(fract(U.x.div(.6)).sub(.5), fract(U.y.div(.6)).sub(.5)).mul(.6)
  const tie = float(1).sub(smoothstep(float(.009).sub(pixel.mul(.5)).max(0), float(.013).add(pixel.mul(.5)), length(tiePosition))).mul(resolved(.024)).mul(vertical)
  const colour = new Color('#a7a295')
  m.colorNode = vec3(colour.r, colour.g, colour.b).mul(drift.mul(.12).add(aggregate.mul(.065)).add(panel.mul(.065)).add(1))
    .mul(float(1).sub(pores.mul(.16)).sub(joint.mul(.13)).sub(board.mul(.035)).sub(tie.mul(.28)))
  m.roughnessNode = float(.88).add(aggregate.mul(.035)).add(pores.mul(.035)).clamp(.80, .98)
  const height = aggregate.mul(.0008).sub(pores.mul(.0005)).sub(joint.mul(.0015)).sub(board.mul(.0004)).sub(tie.mul(.002)).toVar()
  const viewNormal = n.transformDirection(cameraViewMatrix), sx = positionView.dFdx(), sy = positionView.dFdy()
  const rx = sy.cross(viewNormal), ry = viewNormal.cross(sx), det = sx.dot(rx)
  const gradient = rx.mul(height.dFdx()).add(ry.mul(height.dFdy())).mul(det.sign()).div(det.abs().max(1e-10)).toVar()
  m.normalNode = viewNormal.sub(gradient.div(length(gradient).div(.24).max(1))).normalize()
  m.name = 'vinci/collection/filtered-cast-concrete'
  m.userData = { manifestId: collectionProvenance.manifestId, assetClass: 'GENERATED', certainty: 'reconstructed',
    recipe: 'Original museum concrete: filtered 3.2 m weather drift, 0.10 m aggregate and 4.5 mm pores; continuous 1.2 × 0.6 m form panels, restrained 0.15 m board lines, 4 mm finish joints and 24 mm tie recesses on a 0.6 m grid. Combined derivative relief is bounded to a 0.24 normal gradient. No textures or historical concrete claim.',
    label: { en: 'Modern cast-concrete proposal: panels 1.0–1.4 × 0.5–0.8 m; board lines 0.12–0.20 m; joints 3–6 mm; tie marks 18–30 mm. These are authored finish choices, not survey measurements.',
      de: 'Vorschlag für modernen Ortbeton: Schalungsfelder 1,0–1,4 × 0,5–0,8 m; Brettlinien 0,12–0,20 m; Fugen 3–6 mm; Ankerstellen 18–30 mm. Dies sind gestaltete Oberflächen, keine Vermessungswerte.' } }
  return m
}

function glazingMaterial(water = false): MeshStandardNodeMaterial {
  const { cameraViewMatrix, float, length, mx_noise_float, normalWorldGeometry, positionView, positionWorld, smoothstep, vec3 } = TSL
  const m = new MeshStandardNodeMaterial({ color: water ? '#344b4d' : '#a5b2ae', roughness: water ? .22 : .17,
    metalness: water ? .34 : .12, transparent: !water, opacity: water ? 1 : .27, depthWrite: water, side: DoubleSide })
  m.forceSinglePass = true
  const P = positionWorld, pixel = length(P.dFdx()).add(length(P.dFdy())).max(.000001)
  const resolved = (metres: number) => smoothstep(2, 4, float(metres).div(pixel))
  const broad = mx_noise_float(P.mul(.23)).mul(resolved(4.35)).toVar()
  const middle = mx_noise_float(P.mul(water ? vec3(2, 1, 6) : vec3(2, 7, 2))).mul(resolved(water ? .167 : .143)).toVar()
  const fine = mx_noise_float(P.mul(60)).mul(resolved(.017)).toVar()
  m.roughnessNode = float(water ? .21 : .17).add(broad.mul(.018)).add(middle.mul(.013)).add(fine.mul(.008)).clamp(water ? .18 : .14, water ? .25 : .21)
  const height = broad.mul(water ? .0005 : .00003).add(middle.mul(water ? .00016 : .000005))
    .add(fine.mul(water ? .000008 : .0000007)).toVar()
  const viewNormal = normalWorldGeometry.transformDirection(cameraViewMatrix), sx = positionView.dFdx(), sy = positionView.dFdy()
  const rx = sy.cross(viewNormal), ry = viewNormal.cross(sx), det = sx.dot(rx)
  const gradient = rx.mul(height.dFdx()).add(ry.mul(height.dFdy())).mul(det.sign()).div(det.abs().max(1e-10)).toVar()
  const limit = water ? .045 : .006
  m.normalNode = viewNormal.sub(gradient.div(length(gradient).div(limit).max(1))).normalize()
  m.name = water ? 'vinci/collection/still-channel' : 'vinci/collection/full-height-glazing'
  m.userData['provenance'] = 'Original static exhibition glass. Broad drift, middle waviness and filtered microscopic surface grain. No animated water, transmission pass, photographic texture or historical glazing claim.'
  m.userData['normalGradientLimit'] = limit
  m.userData['filtering'] = 'Independent pixel filtering of 4.35 m drift, 0.143/0.167 m waviness and 17 mm grain; world/view height derivatives preserve each geometric plane and bound its surface-normal slope.'
  return m
}

/** The four meshes are identical on all tiers. No content room is implied
 * complete: enclosure supplies credible depth behind the contemporary glass.
 */
export function createCollection(): Group {
  const opaque = new CollectionBatch(), castConcrete = new CollectionBatch(), castConcreteReturns = new CollectionBatch(), glass = new CollectionBatch(), water = new CollectionBatch()
  const concrete = '#9b9789', steel = '#323b3c', slate = '#424e58', interior = '#454941', paving = '#a6a393'
  const floor = C.floor, top = floor + C.galleryClear
  castConcrete.box(-42, -49, floor - .34, 40, 30, .68, concrete)
  // The apron is four non-overlapping strips. Its saw cuts are filtered in
  // world metres and do not become hundreds of additional draw calls.
  opaque.box(-42, -65.5, A.height - .03, 46, 3, .06, paving, 4)
  opaque.box(-63.5, -49, A.height - .03, 3, 30, .06, paving, 4)
  opaque.box(-20.5, -49, A.height - .03, 3, 30, .06, paving, 4)
  // North apron is split around its actual water void.
  for (const [west, south, east, north] of [[A.west, -34, A.east, W.south], [A.west, W.north, A.east, A.north], [A.west, W.south, W.west, W.north], [W.east, W.south, A.east, W.north]])
    opaque.box((west! + east!) / 2, (south! + north!) / 2, A.height - .03, east! - west!, north! - south!, .06, paving, 4)
  // Floor, back wall and recessed returns create a dark volume behind glass.
  opaque.box(-42, -49, floor + .045, 39.5, 29.5, .09, '#555a4d', 3)
  castConcrete.box(-42, -63.83, floor + 2.25, 40, .34, 4.5, concrete)
  castConcrete.box(-61.83, -49, floor + 2.25, .34, 30, 4.5, concrete)
  opaque.box(-42.3, -41.92, floor + 2.2, 36.4, .24, 4.4, interior, 3)
  opaque.box(-38.9, -53.2, floor + 2.2, .24, 18.0, 4.4, interior, 3)
  opaque.box(-30.45, -62.9, floor + 2.1, 15.3, .18, 4.2, interior, 3)
  // A 4 m north elevation grid, 80 mm mullions and 140 mm perimeter posts.
  for (let east: number = C.west; east <= C.east; east += 4) {
    opaque.box(east, C.north, floor + 2.35, .14, .14, 4.7, steel, 1)
    if (east === C.east) continue
    glass.quad([east + .075, C.north - .04, floor + .10], [east + .075, C.north - .04, top - .18], [east + 3.925, C.north - .04, top - .18], [east + 3.925, C.north - .04, floor + .10], '#ffffff')
    opaque.box(east + 2, C.north - .01, floor + 2.35, .08, .08, 4.5, steel, 1)
  }
  for (const height of [floor + .08, top - .10]) opaque.box(-42, C.north, height, 40.25, .18, .16, steel, 1)
  // East pavilion bays and an actual recessed entrance under the canopy.
  const bays = [-64, -60, -56, -52, -48, -44, -40, -36, -34]
  for (let i = 0; i < bays.length; i++) {
    const north = bays[i]!
    opaque.box(C.east, north, floor + 2.35, .14, .14, 4.7, steel, 1)
    if (!i) continue
    const south = bays[i - 1]!
    // The northmost 2 m bay is the entrance, with a glazed leaf set back.
    const east = i === bays.length - 1 ? C.east - .6 : C.east - .04
    glass.quad([east, south + .075, floor + .1], [east, north - .075, floor + .1], [east, north - .075, top - .18], [east, south + .075, top - .18], '#ffffff')
    if (i === bays.length - 1) {
      opaque.box(east + .025, south + .25, floor + 1.05, .06, .055, .5, steel, 1)
      opaque.box(C.east + .10, (south + north) / 2, floor + .03, 1.4, north - south, .06, paving, 4)
    }
  }
  for (const height of [floor + .08, top - .10]) opaque.box(C.east, -49, height, .18, 30, .16, steel, 1)
  // Two low solid slabs and a higher, shallow south-falling hall roof.
  const roof = (west: number, south: number, east: number, north: number, low: number, high: number) => {
    const thickness = .20
    opaque.quad([west, south, low], [east, south, low], [east, north, high], [west, north, high], slate, 2)
    // The underside is the same pale, weathered cast concrete as the base.
    // Its real downward normal receives the shared sky/ground environment.
    castConcrete.quad([west, north, high - thickness], [east, north, high - thickness], [east, south, low - thickness], [west, south, low - thickness], concrete)
    opaque.quad([west, south, low - thickness], [east, south, low - thickness], [east, south, low], [west, south, low], steel, 1)
    opaque.quad([east, north, high - thickness], [west, north, high - thickness], [west, north, high], [east, north, high], steel, 1)
    opaque.quad([west, north, high - thickness], [west, south, low - thickness], [west, south, low], [west, north, high], steel, 1)
    opaque.quad([east, south, low - thickness], [east, north, high - thickness], [east, north, high], [east, south, low], steel, 1)
  }
  roof(-62.7, -42.7, -21.3, -33.3, top + .13, top + .25)
  roof(-39.7, -64.6, -21.3, -42.7, top + .13, top + .25)
  const hallNorth = floor + 7.65, hallSouth = floor + 6.9
  roof(-62.7, -64.7, -38.9, -42.5, hallSouth, hallNorth)
  // The taller hall remains closed at all off-rail angles. Its north-facing
  // clerestory is glass, with actual interior depth rather than a pale decal.
  castConcrete.box(-50.5, -63.83, (top + hallSouth) / 2, 23, .34, hallSouth - top, concrete)
  for (const east of [-61.83, -39.08]) {
    castConcreteReturns.quad([east, -64, top], [east, -42.5, top], [east, -42.5, hallNorth - .2], [east, -64, hallSouth - .2], concrete, 0, [east < -50 ? -1 : 1, 0, 0])
  }
  glass.quad([-61.9, -42.53, top + .25], [-61.9, -42.53, hallNorth - .22], [-39.1, -42.53, hallNorth - .22], [-39.1, -42.53, top + .25], '#ffffff')
  for (let east = -62; east < -39; east += 3.8) opaque.box(east, -42.5, (top + .25 + hallNorth - .2) / 2, .10, .16, hallNorth - .45 - top, steel, 1)
  opaque.box(-50.5, -43, hallNorth - .4, 22.6, .16, .35, '#343d38', 3)
  // Thin metal caps follow the actual roof slope. Their three-millimetre
  // relief is attached to the cladding rather than held in a horizontal row.
  const capHeight = (north: number) => top + .13 + (north + 42.7) / 9.4 * .12 + .003
  for (let east = -61.9; east <= -22; east += 4) opaque.quad(
    [east - .0175, -42.4, capHeight(-42.4)], [east + .0175, -42.4, capHeight(-42.4)],
    [east + .0175, -33.6, capHeight(-33.6)], [east - .0175, -33.6, capHeight(-33.6)], '#727b7c', 1)
  roof(-22.8, -41.75, -18.55, -34.05, top + .12, top + .21)
  // Derive each closed post head from the actual canopy underside plane.
  // The retained 100 mm section and buried floor-level foot do not move.
  const canopyUnderside = (north: number) => top + .12 - .20 + (north + 41.75) / 7.7 * .09
  for (const north of [-41.5, -34.5]) {
    const west = -18.75, east = -18.65, south = north - .05, end = north + .05
    const low = canopyUnderside(south), high = canopyUnderside(end)
    opaque.quad([west, south, floor], [east, south, floor], [east, south, low], [west, south, low], steel, 1, [0, -1, 0])
    opaque.quad([east, end, floor], [west, end, floor], [west, end, high], [east, end, high], steel, 1, [0, 1, 0])
    opaque.quad([west, end, floor], [west, south, floor], [west, south, low], [west, end, high], steel, 1, [-1, 0, 0])
    opaque.quad([east, south, floor], [east, end, floor], [east, end, high], [east, south, low], steel, 1, [1, 0, 0])
    opaque.quad([west, south, low], [east, south, low], [east, end, high], [west, end, high], steel, 1, [0, 0, 1])
    opaque.quad([west, end, floor], [east, end, floor], [east, south, floor], [west, south, floor], steel, 1, [0, 0, -1])
  }
  // The garden stair keeps its maquette run. The additional top landing
  // meets the terrace at the same -1.9 m level, over a 60 mm lower grade.
  for (let i = 0; i < S.count; i++) {
    const tread = stairTread(i), north = (tread.north + tread.south) / 2, depth = tread.north - tread.south
    // A 60 mm finish cap meets the declared grade exactly. Terrain owns the
    // structural riser below it, so their transverse faces never overlap.
    opaque.box(S.east, north, tread.height - .03, S.width, depth, .06, paving, 4)
  }
  opaque.box(S.east, (C.topLanding.north + C.topLanding.south) / 2, C.topLanding.height - .03, S.width, C.topLanding.north - C.topLanding.south, .06, paving, 4)
  opaque.box(S.east, -32, floor - .03, S.width, 4, .06, paving, 4)
  // The finish and its full terrain support share their exact underside.
  // No unsupported bottom-return plates remain between consecutive treads.
  // Both side planes and the landing heads clip only the visible finish
  // interval out of the structural lining, leaving every other bank closed.
  const cheekPieces = approachPieces()
  for (const side of [-1, 1]) {
    const inside = S.east + side * S.width / 2, outside = inside + side * .14
    for (let i = 0; i < cheekPieces.length; i++) {
      const p = cheekPieces[i]!, bottom = p.height - .22, crest = p.height + .09
      castConcrete.quad([outside, p.south, bottom], [outside, p.north, bottom], [outside, p.north, crest], [outside, p.south, crest], concrete, 0, [side, 0, 0])
      // The paving cap owns its 60 mm side strip at the inner plane.
      for (const [low, high] of [[bottom, p.height - .06], [p.height, crest]])
        castConcrete.quad([inside, p.south, low!], [inside, p.north, low!], [inside, p.north, high!], [inside, p.south, high!], concrete, 0, [-side, 0, 0])
      castConcrete.quad([inside, p.south, crest], [outside, p.south, crest], [outside, p.north, crest], [inside, p.north, crest], concrete, 0, [0, 0, 1])
      const across = (north: number, low: number, high: number, facingNorth: number) => {
        if (Math.abs(high - low) > 1e-8) castConcrete.quad([inside, north, low], [outside, north, low], [outside, north, high], [inside, north, high], concrete, 0, [0, facingNorth, 0])
      }
      if (!i) across(p.north, bottom, crest, 1)
      const next = cheekPieces[i + 1]
      if (!next) across(p.south, bottom, crest, -1)
      else {
        across(p.south, next.height + .09, crest, -1)
      }
    }
  }
  // This is a modern ornamental channel, separate from the mapped Amasse.
  opaque.box((W.west + W.east) / 2, (W.south + W.north) / 2, W.bed - .03, W.east - W.west, W.north - W.south, .06, '#3d4640', 3)
  for (const north of [W.south - .045, W.north + .045]) castConcrete.box((W.west + W.east) / 2, north, (W.bed + A.height) / 2, W.east - W.west + .18, .09, A.height - W.bed, concrete)
  for (const east of [W.west - .045, W.east + .045]) castConcrete.box(east, (W.south + W.north) / 2, (W.bed + A.height) / 2, .09, W.north - W.south, A.height - W.bed, concrete)
  water.quad([W.west, W.south, W.water], [W.east, W.south, W.water], [W.east, W.north, W.water], [W.west, W.north, W.water], '#ffffff')
  const group = new Group(); group.name = 'vinci/collection-modern-insertion'
  const parts = [
    { batch: opaque, material: architectureMaterial(), name: 'architecture', cast: true },
    { batch: castConcrete, material: collectionConcreteMaterial(true), name: 'cast-concrete', cast: true },
    { batch: castConcreteReturns, material: collectionConcreteMaterial(), name: 'cast-concrete-hall-returns', cast: true },
    { batch: glass, material: glazingMaterial(), name: 'glazing', cast: false },
    { batch: water, material: glazingMaterial(true), name: 'channel-water', cast: false },
  ]
  for (const part of parts) {
    const mesh = new Mesh(part.batch.geometry(), part.material)
    mesh.name = `vinci/collection/${part.name}`; mesh.castShadow = part.cast; mesh.receiveShadow = true
    mesh.userData = { manifestId: collectionProvenance.manifestId, assetClass: 'GENERATED', certainty: 'reconstructed', component: part.name }
    group.add(mesh)
  }
  group.userData = { ...collectionProvenance, layout: collectionLayout,
    visibleMeshes: 5, shadowCasters: 3,
    triangles: group.children.reduce((sum, child) => sum + (child as Mesh).geometry.getAttribute('position').count / 3, 0) }
  return group
}

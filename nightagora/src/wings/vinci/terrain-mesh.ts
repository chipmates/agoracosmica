/* The measured slope and the assumed platforms meet at an edge. There is
   no interpolated apron: a raised platform has a retaining face, and a cut
   platform exposes an earth bank. Modern collection boundaries use their
   declared concrete lining. Every platform keeps its dossier outline. */
import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2 } from 'three/webgpu'
import { dossier, feature, polygon, surveyedHeight, type Feature, type Quantity } from './site'
import { getWaterCuts, waterBedAt } from './water'
import { getPathCorridors } from './paths'
import { getRoadGradeRegions } from './road-grade'
import { getApronRegions, isApronFacadeEdge } from './apron'
import { getInnerCourtRegions, isInnerCourtFacadeEdge } from './inner-court'
import { collectionCheekBand, getCollectionGradeRegions, isCollectionApproachRegion } from './collection'
import { collectionAccessCheekBand, getCollectionAccessRegions } from './collection-access'
import { isLinedGateEdge } from './gate-passage'
import type { TierName } from '../../stack/tier'

type Point = [number, number]
type Point3 = [number, number, number]
interface Bounds { minE: number; maxE: number; minN: number; maxN: number }
interface Region { id: string; points: Point[]; bounds: Bounds; levelAt: (e:number,n:number)=>number; normal: Point3; surface: 'earth' | 'grass' }
interface Cutter { points: Point[]; bounds: Bounds }
interface Batch { position: number[]; normal: number[]; uv: number[] }

const EPS = 1e-8
const DOMAIN = { minE: -200, maxE: 200, minN: -360, maxN: 200 }
const asPoint = (p: number[]): Point => [p[0]!, p[1]!]
const lerp = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
const area = (points: Point[]): number => points.reduce((sum, a, i) => {
  const b = points[(i + 1) % points.length]!
  return sum + a[0] * b[1] - b[0] * a[1]
}, 0) / 2
const ccw = (points: Point[]): Point[] => area(points) < 0 ? [...points].reverse() : points
const bounds = (points: Point[]): Bounds => ({
  minE: Math.min(...points.map(p => p[0])), maxE: Math.max(...points.map(p => p[0])),
  minN: Math.min(...points.map(p => p[1])), maxN: Math.max(...points.map(p => p[1])),
})
const overlaps = (a: Bounds, b: Bounds): boolean =>
  a.minE < b.maxE - EPS && a.maxE > b.minE + EPS && a.minN < b.maxN - EPS && a.maxN > b.minN + EPS
const halfPlane = (a: Point, b: Point, p: Point): number =>
  (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
const contains = (region: Cutter, e: number, n: number): boolean =>
  e >= region.bounds.minE - EPS && e <= region.bounds.maxE + EPS && n >= region.bounds.minN - EPS && n <= region.bounds.maxN + EPS &&
  region.points.every((a, i) => halfPlane(a, region.points[(i + 1) % region.points.length]!, [e, n]) >= -EPS)

const footprint = ccw(dossier.site.footprint.map(p => asPoint(p.value)))
const footprintTriangles: Cutter[] = ShapeUtils.triangulateShape(footprint.map(p => new Vector2(...p)), [])
  .map(indices => {
    const points = ccw(indices.map(i => footprint[i]!))
    return { points, bounds: bounds(points) }
  })

// The retained clipped stream profile owns its assumed channel section.
// Modern mapped pond basins are excluded from the historical default.
const waterCutters: Cutter[] = getWaterCuts().map(cut => {
  const points = ccw(cut.points)
  return { points, bounds: bounds(points) }
})
const pathCorridors = getPathCorridors()

function rectangle(a: Point, b: Point, width: number): Point[] {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1])
  const dx = -(b[1] - a[1]) / length * width / 2
  const dn = (b[0] - a[0]) / length * width / 2
  return ccw([[a[0] + dx, a[1] + dn], [b[0] + dx, b[1] + dn], [b[0] - dx, b[1] - dn], [a[0] - dx, a[1] - dn]])
}

/** Material-only closure of the narrow retained bank between the east
 * court edge and the gallery. Project to its actual G4/G5 facade chain;
 * neither the court polygon nor any sampled elevation is moved. */
const galleryFacades = (dossier as unknown as { facades: { id: string; from: Quantity<number[]>; to: Quantity<number[]> }[] }).facades
const galleryFacade = (id: string) => galleryFacades.find(facade => facade.id === id)!
const galleryCourt = polygon('courtyard').map(asPoint)
const projectToGallery = (point: Point, id: string): Point => {
  const facade = galleryFacade(id), a = asPoint(facade.from.value), b = asPoint(facade.to.value)
  const dx = b[0] - a[0], dn = b[1] - a[1]
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dn) / (dx * dx + dn * dn)))
  return lerp(a, b, t)
}
const galleryBankOutline = ccw([galleryCourt[1]!, galleryCourt[2]!, projectToGallery(galleryCourt[2]!, 'G4'),
  asPoint(galleryFacade('G4').to.value), projectToGallery(galleryCourt[1]!, 'G5')])
const galleryBankCaps: Cutter[] = ShapeUtils.triangulateShape(galleryBankOutline.map(point => new Vector2(...point)), [])
  .map(indices => { const points = ccw(indices.map(i => galleryBankOutline[i]!)); return { points, bounds: bounds(points) } })
const surfaceCorridors: Cutter[] = [...pathCorridors, ...galleryBankCaps]
export const galleryBankCapProvenance = {
  manifestId: 'vinci/terrain-mesh', assetClass: 'GENERATED', certainty: 'conjectural',
  source: ['A-SITE', 'A-LAYOUT', 'OSM-AREA'],
  label: {
    en: 'Proposed mineral ground follows the narrow bank beneath the gallery.',
    de: 'Vorgeschlagener mineralischer Boden folgt dem schmalen Geländestreifen unter der Galerie.',
  },
  record: {
    en: 'The material-only polygon joins courtyard points 1 and 2 to their nearest points on registered facades G5 and G4, retaining the shared facade corner. It classifies the existing exposed slope as earth instead of grass. Every resulting vertex still samples the unchanged IGN height field; existing court, gate, building and water cuts retain priority. Its extent and mineral surface are a conjectural museum finish, not a claim about a surviving 1517 cap.',
    de: 'Das reine Materialpolygon verbindet die Hofpunkte 1 und 2 mit ihren nächsten Punkten auf den registrierten Fassaden G5 und G4 und übernimmt deren gemeinsame Ecke. Es stellt den vorhandenen offenen Hang als Erde statt Gras dar. Jeder entstehende Eckpunkt erhält weiterhin seine Höhe aus dem unveränderten IGN-Höhenfeld; vorhandene Hof-, Tor-, Gebäude- und Gewässerausschnitte behalten Vorrang. Ausdehnung und mineralische Oberfläche sind eine vermutete museale Ausgestaltung, kein Beleg einer erhaltenen Abdeckung von 1517.',
  },
  outline: galleryBankOutline, area_m2: Math.abs(area(galleryBankOutline)),
} as const

function makeRegion(id: string, points: Point[], height: number|Region['levelAt'], surface: Region['surface'] = 'earth', gradient:Point=[0,0]): Region {
  const outline = ccw(points)
  const length=Math.hypot(gradient[0],1,gradient[1])
  return { id, points: outline, bounds: bounds(outline), levelAt:typeof height==='number'?()=>height:height,
    normal:[-gradient[0]/length,1/length,gradient[1]/length], surface }
}

// Broad collection placement remains below the literal platform priority.
// Its precisely bounded approach is appended separately as a modern cut.
const collectionRegions = [...getCollectionGradeRegions(), ...getCollectionAccessRegions()]
const regions: Region[] = [
  ...collectionRegions.filter(region=>!isCollectionApproachRegion(region.id)).map(region=>makeRegion(region.id,region.points,region.levelAt,'earth',region.gradient)),
  ...getInnerCourtRegions().map(court=>makeRegion(court.id,court.points,court.height)),
  ...getApronRegions().map(apron=>makeRegion(apron.id,apron.points,apron.height)),
  ...getRoadGradeRegions().map(road=>makeRegion(road.id,road.points,road.levelAt,'earth',road.gradient)),
  ...['courtyard', 'terrace', 'period-garden', 'street-grade'].map(id =>
    makeRegion(id, polygon(id).map(asPoint), feature(id).height_m!.value, id === 'period-garden' ? 'grass' : 'earth')),
]

interface StairFeature extends Feature {
  count: Quantity<number>
  tread_m: Quantity<number>
}
const stair = feature('gate-steps') as StairFeature
const stairPoints = polygon('gate-steps')
const stairA = asPoint(stairPoints[0]!)
const stairB = asPoint(stairPoints[1]!)
const stairLength = Math.hypot(stairB[0] - stairA[0], stairB[1] - stairA[1])
const stairWidth = stair.width_m!.value
const upper = stairPoints[0]![2]!
const lower = stairPoints[1]![2]!
const street = regions.find(region => region.id === 'street-grade')!
const streetEntry = lerp(street.points[0]!, street.points[1]!, 0.5)
const streetCentre = street.points.reduce<Point>((sum, p) => [sum[0] + p[0] / street.points.length, sum[1] + p[1] / street.points.length], [0, 0])
const centreDistance = Math.hypot(streetCentre[0] - streetEntry[0], streetCentre[1] - streetEntry[1])
const roadLanding = lerp(streetEntry, streetCentre, Math.min(1, stairWidth / 2 / centreDistance))
const turn: Point = [2 * stairA[0] - stairB[0], 2 * stairA[1] - stairB[1]]
const courtLanding: Point = [2 * stairB[0] - stairA[0], 2 * stairB[1] - stairA[1]]

/** Proposed A-SITE access only: a corridor, at the recorded upper landing
    level and stair width, joins the separately registered road and stair.
    The turn extends the stair axis by its own recorded length. This added
    connection is an assumed layout, not an additional surveyed polygon. */
export const gateApproachRoute: readonly Point3[] = [
  [roadLanding[0], roadLanding[1], upper],
  [turn[0], turn[1], upper],
  [stairA[0], stairA[1], upper],
  [stairB[0], stairB[1], lower],
  [courtLanding[0], courtLanding[1], lower],
]
regions.push(makeRegion('gate-approach-road', rectangle(roadLanding, turn, stairWidth), upper))
regions.push(makeRegion('gate-approach-landing', rectangle(turn, stairA, stairWidth), upper))
regions.push(makeRegion('gate-court-connection', rectangle(stairB, courtLanding, stairWidth), lower))

const tread = stair.tread_m.value
const count = Math.round(stair.count.value)
const landing = Math.max(0, stairLength - count * tread) / 2
const stairAt = (distance: number): Point => lerp(stairA, stairB, distance / stairLength)
if (landing > EPS) regions.push(makeRegion('gate-upper-landing', rectangle(stairA, stairAt(landing), stairWidth), upper))
for (let step = 0; step < count; step++) {
  const from = landing + step * tread
  const to = Math.min(stairLength, from + tread)
  regions.push(makeRegion(`gate-tread-${step + 1}`, rectangle(stairAt(from), stairAt(to), stairWidth), upper + (lower - upper) * (step + 1) / count))
}
if (landing > EPS) regions.push(makeRegion('gate-lower-landing', rectangle(stairAt(stairLength - landing), stairB, stairWidth), lower))

// Explicit contemporary insertion only: do not change the registered
// terrace outline or raw IGN. These exact paving footprints own their cut.
regions.push(...collectionRegions.filter(region=>isCollectionApproachRegion(region.id))
  .map(region=>makeRegion(region.id,region.points,region.levelAt,'earth',region.gradient)))

function regionAt(e: number, n: number): Region | undefined {
  for (let i = regions.length - 1; i >= 0; i--) if (contains(regions[i]!, e, n)) return regions[i]
  return undefined
}
const inHouse = (e: number, n: number): boolean => footprintTriangles.some(triangle => contains(triangle, e, n))

/** The rail, vegetation and ground must call the same grade. Outside the
    literal platforms, the declared apron, road and gate connections and stream basin,
    this is IGN exactly. Water owns the excavated bed and bank geometry.
    The house footprint is a void in the outdoor mesh; zero there denotes the
    reconstruction's floor datum for a caller that samples the threshold. */
export function gradeAt(e: number, n: number): number {
  const survey = surveyedHeight(e, n)
  const bed = waterBedAt(e, n)
  if (bed !== undefined) return bed
  if (inHouse(e, n)) return Math.min(0, survey)
  return regionAt(e, n)?.levelAt(e,n) ?? survey
}

function clean(points: Point[]): Point[] {
  const result = points.filter((p, i) => {
    const before = points[(i + points.length - 1) % points.length]!
    return Math.hypot(p[0] - before[0], p[1] - before[1]) > EPS
  })
  return result.length >= 3 && Math.abs(area(result)) > EPS ? result : []
}

function clip(points: Point[], a: Point, b: Point, positive: boolean): Point[] {
  const output: Point[] = []
  const sign = positive ? 1 : -1
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!, q = points[(i + 1) % points.length]!
    const dp = halfPlane(a, b, p) * sign, dq = halfPlane(a, b, q) * sign
    if (dp >= -EPS) output.push(p)
    if ((dp > EPS && dq < -EPS) || (dp < -EPS && dq > EPS)) output.push(lerp(p, q, dp / (dp - dq)))
  }
  return clean(output)
}

/** Subtract one convex outline, retaining disjoint convex pieces. */
function subtract(points: Point[], cutter: Cutter): Point[][] {
  if (!overlaps(bounds(points), cutter.bounds)) return [points]
  const pieces: Point[][] = []
  let remaining = points
  for (let edge = 0; edge < cutter.points.length && remaining.length; edge++) {
    const a = cutter.points[edge]!, b = cutter.points[(edge + 1) % cutter.points.length]!
    const outside = clip(remaining, a, b, false)
    if (outside.length) pieces.push(outside)
    remaining = clip(remaining, a, b, true)
  }
  return pieces
}

function subtractAll(points: Point[], cutters: Cutter[]): Point[][] {
  let pieces = [points]
  for (const cutter of cutters) {
    pieces = pieces.flatMap(piece => subtract(piece, cutter))
    if (!pieces.length) break
  }
  return pieces
}

const batch = (): Batch => ({ position: [], normal: [], uv: [] })
function push(target: Batch, p: Point, height: number, normal: Point3, vertical = false, along = 0): void {
  target.position.push(p[0], height, -p[1])
  target.normal.push(...normal)
  target.uv.push(vertical ? along : p[0], vertical ? height : -p[1])
}

function surveyNormal(e: number, n: number): Point3 {
  const e0 = Math.max(DOMAIN.minE, e - 0.05), e1 = Math.min(DOMAIN.maxE, e + 0.05)
  const n0 = Math.max(DOMAIN.minN, n - 0.05), n1 = Math.min(DOMAIN.maxN, n + 0.05)
  const east = (surveyedHeight(e1, n) - surveyedHeight(e0, n)) / (e1 - e0)
  const north = (surveyedHeight(e, n1) - surveyedHeight(e, n0)) / (n1 - n0)
  const length = Math.hypot(east, 1, north)
  return [-east / length, 1 / length, north / length]
}

function top(target: Batch, points: Point[], region?: Region): void {
  for (let i = 1; i < points.length - 1; i++) {
    for (const p of [points[0]!, points[i]!, points[i + 1]!]) {
      const h = region?.levelAt(...p) ?? surveyedHeight(...p)
      push(target, p, h, region?.normal ?? surveyNormal(...p))
    }
  }
}

function wall(target: Batch, a: Point, b: Point, a0: number, b0: number, a1: number, b1: number, positive: boolean, covered?: { bottom: number; top: number }): void {
  const dx = b[0] - a[0], dn = b[1] - a[1], length = Math.hypot(dx, dn)
  if(length<EPS)return
  const normal: Point3 = positive ? [dn / length, 0, dx / length] : [-dn / length, 0, -dx / length]
  const vertices: Array<[Point, number, number]> = [[a, a1, 0], [a, a0, 0], [b, b0, length], [a, a1, 0], [b, b0, length], [b, b1, length]]
  if (!positive) {
    for (let i = 0; i < vertices.length; i += 3) [vertices[i + 1], vertices[i + 2]] = [vertices[i + 2]!, vertices[i + 1]!]
  }
  for(let i=0;i<vertices.length;i+=3){
    if(Math.abs(i===0?a1-a0:b1-b0)<EPS)continue
    const triangle=vertices.slice(i,i+3)
    if(!covered){for(const [p,h,u]of triangle)push(target,p,h,normal,true,u);continue}
    // Clip actual wall triangles in along-edge/height coordinates. This
    // also resolves a sloping grade crossing either cheek limit exactly;
    // clamping just the endpoints would leave triangular overlaps or gaps.
    const section:Point[]=triangle.map(([,h,u])=>[u,h])
    const pieces=[clip(section,[0,covered.bottom],[length,covered.bottom],false),
      clip(section,[0,covered.top],[length,covered.top],true)]
    for(const piece of pieces)for(let j=1;j<piece.length-1;j++)
      for(const [u,h]of[piece[0]!,piece[j]!,piece[j+1]!])push(target,lerp(a,b,u/length),h,normal,true,u)
  }
}

function finish(source: Batch, name: string): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.name = name
  geometry.setAttribute('position', new Float32BufferAttribute(source.position, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(source.normal, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(source.uv, 2))
  geometry.computeBoundingSphere()
  geometry.userData = { galleryBankCap: galleryBankCapProvenance, basis: 'IGN bilinear grid and A-SITE platform levels; exact platform, proposed road-cut and clipped-stream boundaries. A separate flat 1 m house-side apron fills only the derived gap from F01/F02/G2/G1 to the retained road-cut west edge, with explicit terminal retaining edges and no smoothing into walls. The separate 5 m road approach continues the nominal 1 m grade through the mapped gallery crossing and interpolates to the next mapped point at IGN height; literal platforms and gate connections retain priority. Other mapped path corridors and the derived court-to-G4/G5 mineral bank cap classify the existing slope as earth without changing its elevation. Exact exterior collection-cheek strips now support their existing finish and close both landing heads. Stream beds and banks are supplied by water.ts; modern ponds omitted.', triangles: source.position.length / 9 }
  return geometry
}

/** Break a retaining edge exactly where another region starts or ends, so
    midpoint classification never leaves half a wall across a gateway. */
function edgeBreaks(a: Point, b: Point): number[] {
  const dx = b[0] - a[0], dn = b[1] - a[1], length = Math.hypot(dx, dn)
  const divisions = Math.max(1, Math.ceil(length / 0.65))
  const values = Array.from({ length: divisions + 1 }, (_, i) => i / divisions)
  // Inside one IGN cell the sampled surface is bilinear. These crossings
  // keep the later cut/fill root calculation on a single quadratic section.
  if(Math.abs(dx)>EPS)for(let e=DOMAIN.minE;e<=DOMAIN.maxE;e+=40){const t=(e-a[0])/dx;if(t>EPS&&t<1-EPS)values.push(t)}
  if(Math.abs(dn)>EPS)for(let n=DOMAIN.minN;n<=DOMAIN.maxN;n+=40){const t=(n-a[1])/dn;if(t>EPS&&t<1-EPS)values.push(t)}
  for (const outline of [...regions.map(region => region.points), ...waterCutters.map(cutter=>cutter.points), footprint]) {
    for (let i = 0; i < outline.length; i++) {
      const p = outline[i]!, q = outline[(i + 1) % outline.length]!
      const ex = q[0] - p[0], en = q[1] - p[1]
      const determinant = dx * en - dn * ex
      if (Math.abs(determinant) < EPS) {
        if (Math.abs(halfPlane(a, b, p)) < EPS) {
          for (const end of [p, q]) {
            const t = ((end[0] - a[0]) * dx + (end[1] - a[1]) * dn) / (length * length)
            if (t > EPS && t < 1 - EPS) values.push(t)
          }
        }
        continue
      }
      const ox = p[0] - a[0], on = p[1] - a[1]
      const t = (ox * en - on * ex) / determinant
      const u = (ox * dn - on * dx) / determinant
      if (t > EPS && t < 1 - EPS && u >= -EPS && u <= 1 + EPS) values.push(t)
    }
  }
  return values.sort((x, y) => x - y).filter((value, i, sorted) => i === 0 || value - sorted[i - 1]! > EPS)
}

/** A straight edge through one bilinear IGN cell has quadratic height.
 * Split exactly where its cut changes into fill, including the road's
 * terminal centre, so neither bank orientation can erase a small triangle.
 */
function gradeRoots(d0:number,dm:number,d1:number):number[] {
  const a=2*(d0+d1-2*dm),b=d1-d0-a,c=d0
  let roots:number[]=[]
  if(Math.abs(a)<EPS){if(Math.abs(b)>EPS)roots=[-c/b]}
  else{
    const discriminant=b*b-4*a*c
    if(discriminant>=0){const q=-.5*(b+(b<0?-1:1)*Math.sqrt(discriminant));roots=Math.abs(q)>EPS?[q/a,c/q]:[-b/(2*a)]}
  }
  return[0,...roots.filter(t=>t>EPS&&t<1-EPS),1].sort((a,b)=>a-b).filter((t,i,values)=>i===0||t-values[i-1]!>EPS)
}

export function buildTerrainMeshes(tier: TierName): { earth: BufferGeometry; grass: BufferGeometry; retaining: BufferGeometry; collectionRetaining: BufferGeometry } {
  const earth = batch(), grass = batch(), retaining = batch(), collectionRetaining = batch()
  const cutters: Cutter[] = [...regions, ...footprintTriangles, ...waterCutters]
  const cutBounds = bounds(cutters.flatMap(cutter => cutter.points))
  const step = tier === 'calm' ? 3 : 2
  const axis = (min: number, max: number): number[] => {
    const values = new Set<number>([max])
    for (let x = min; x < max; x += step) values.add(x)
    // A calm triangle must not bridge a change between two IGN cells.
    for (let x = min; x <= max; x += 40) values.add(x)
    return [...values].sort((a, b) => a - b)
  }
  const east = axis(DOMAIN.minE, DOMAIN.maxE), north = axis(DOMAIN.minN, DOMAIN.maxN)
  for (let ni = 0; ni < north.length - 1; ni++) for (let ei = 0; ei < east.length - 1; ei++) {
    const e = east[ei]!, n = north[ni]!, nextE = east[ei + 1]!, nextN = north[ni + 1]!
    const cellBounds = { minE: e, maxE: nextE, minN: n, maxN: nextN }
    const local = overlaps(cellBounds, cutBounds) ? cutters.filter(cutter => overlaps(cellBounds, cutter.bounds)) : []
    const localPaths = surfaceCorridors.filter(corridor => overlaps(cellBounds, corridor.bounds))
    const corners: Point[] = [[e, n], [nextE, n], [nextE, nextN], [e, nextN]]
    for (const triangle of [[corners[0]!, corners[1]!, corners[2]!], [corners[0]!, corners[2]!, corners[3]!]]) {
      for (const piece of local.length ? subtractAll(triangle, local) : [triangle]) {
        // Paths share the triangulated slope. Classifying and subtracting
        // each intersection keeps a single surface, including at bends.
        let grassPieces = [piece]
        for (const corridor of localPaths) {
          const remainder: Point[][] = []
          for (const fragment of grassPieces) {
            if (!overlaps(bounds(fragment), corridor.bounds)) {
              remainder.push(fragment)
              continue
            }
            let pathPiece = fragment
            for (let edge = 0; edge < corridor.points.length && pathPiece.length; edge++) {
              pathPiece = clip(pathPiece, corridor.points[edge]!, corridor.points[(edge + 1) % corridor.points.length]!, true)
            }
            if (pathPiece.length) top(earth, pathPiece)
            remainder.push(...subtract(fragment, corridor))
          }
          grassPieces = remainder
        }
        for (const fragment of grassPieces) top(grass, fragment)
      }
    }
  }

  for (let i = 0; i < regions.length; i++) {
    const region = regions[i]!
    const later: Cutter[] = [...regions.slice(i + 1), ...footprintTriangles, ...waterCutters]
    const visiblePieces=subtractAll(region.points, later)
    for (const piece of visiblePieces) top(region.surface === 'grass' ? grass : earth, piece, region)

    // Sampling along an exact edge resolves the coarse IGN cell crossings.
    // Adjacent equal-height regions emit nothing, and the higher of two
    // touching platforms owns their shared face exactly once.
    // Clipping a low-priority sloping road under an existing flat corridor
    // creates new edges inside its original polygon. Those visible edges
    // own the same boundary treatment as the retained outer outline.
    for (const piece of visiblePieces) for (let edge = 0; edge < piece.length; edge++) {
      const start = piece[edge]!, end = piece[(edge + 1) % piece.length]!
      if(region.id.startsWith('inner-court-')&&isInnerCourtFacadeEdge(start,end))continue
      if(region.id.startsWith('apron-')&&isApronFacadeEdge(start,end))continue
      const dx = end[0] - start[0], dn = end[1] - start[1], distance = Math.hypot(dx, dn)
      const breaks = edgeBreaks(start, end)
      const outward: Point = [dn / distance * 0.002, -dx / distance * 0.002]
      for (let part = 0; part < breaks.length - 1; part++) {
        const a = lerp(start, end, breaks[part]!), b = lerp(start, end, breaks[part + 1]!), mid = lerp(a, b, 0.5)
        const inner: Point = [mid[0] - outward[0], mid[1] - outward[1]], outer: Point = [mid[0] + outward[0], mid[1] + outward[1]]
        if (inHouse(...inner) || inHouse(...outer) || waterBedAt(...inner)!==undefined || waterBedAt(...outer)!==undefined || regionAt(...inner)?.id !== region.id) continue
        const neighbour = regionAt(...outer)
        const modern=region.id.startsWith('collection-')||Boolean(neighbour?.id.startsWith('collection-'))
        const otherAt=(p:Point):number=>neighbour?.levelAt(...p)??surveyedHeight(...p)
        const differenceAt=(p:Point):number=>region.levelAt(...p)-otherAt(p)
        const roots=gradeRoots(differenceAt(a),differenceAt(mid),differenceAt(b))
        for(let section=0;section<roots.length-1;section++){
          const from=lerp(a,b,roots[section]!),to=lerp(a,b,roots[section+1]!)
          const difference=differenceAt(lerp(from,to,.5))
          if(Math.abs(difference)<EPS||(neighbour&&difference<0))continue
          const aOwn=region.levelAt(...from),bOwn=region.levelAt(...to),aOther=otherAt(from),bOther=otherAt(to)
          const covered=modern?(collectionCheekBand(from,to)??collectionAccessCheekBand(from,to)):undefined
          if(difference>0)wall(modern?collectionRetaining:retaining,from,to,Math.min(aOther,aOwn),Math.min(bOther,bOwn),aOwn,bOwn,true,covered)
          else if(!isLinedGateEdge(from,to)){
            const roadLining=!modern&&(region.id==='street-grade'||region.id.startsWith('road-cut-'))
            wall(modern?collectionRetaining:roadLining?retaining:earth,from,to,aOwn,bOwn,Math.max(aOther,aOwn)+(roadLining?.035:0),Math.max(bOther,bOwn)+(roadLining?.035:0),false,covered)
            if(roadLining){
              // Proposed 220 mm masonry lining extends into the retained
              // bank. Its cap follows the unchanged IGN crest, 35 mm proud.
              const far=(p:Point):Point=>[p[0]+outward[0]*110,p[1]+outward[1]*110]
              const cap=ccw([from,to,far(to),far(from)])
              top(retaining,cap,makeRegion('road-wall-cap',cap,(e,n)=>surveyedHeight(e,n)+.035))
            }
          }
        }
      }
    }
  }
  return {
    earth: finish(earth, 'vinci A-SITE earth platforms and cut banks'),
    grass: finish(grass, 'vinci IGN slope and registered garden platform'),
    retaining: finish(retaining, 'vinci A-SITE vertical retaining faces and stair risers'),
    collectionRetaining: finish(collectionRetaining, 'vinci modern collection concrete cut and fill lining; exact cheek interval omitted'),
  }
}

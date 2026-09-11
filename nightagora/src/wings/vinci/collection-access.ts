/** Separately declared contemporary circulation between court and terrace.
 * The literal platform outlines/levels and all raw IGN samples are retained;
 * only these exact landing/tread footprints receive an authored grade cut.
 */
import { BufferGeometry, Float32BufferAttribute, Group, Mesh } from 'three/webgpu'
import { polygon, world } from './site'
import { collectionConcreteMaterial, type CollectionGradeRegion } from './collection'

type Point = [east: number, north: number]
type Point3 = [east: number, north: number, height: number]
const edge = polygon('terrace'), a = edge[1]!, b = edge[2]!
const length = Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!)
const tangent: Point = [(b[0]! - a[0]!) / length, (b[1]! - a[1]!) / length]
const outward: Point = [tangent[1], -tangent[0]]
const crossing: Point = [a[0]! + (b[0]! - a[0]!) * .046, a[1]! + (b[1]! - a[1]!) * .046]

export const collectionAccessLayout = {
  crossing, outward, tangent, width: 2, run: 3.6, count: 12, tread: .3,
  upper: 0, lower: -1.9, riser: 1.9 / 12, landingDepth: .75,
  cheekWidth: .14, cheekRise: .09, cheekDepth: .22, pavingDepth: .06,
} as const
const L = collectionAccessLayout
export const collectionAccessPoint = (along: number, across = 0): Point =>
  [crossing[0] + outward[0] * along + tangent[0] * across,
    crossing[1] + outward[1] * along + tangent[1] * across]
const outline = (low: number, high: number, halfWidth = L.width / 2): Point[] =>
  [collectionAccessPoint(low, -halfWidth), collectionAccessPoint(high, -halfWidth),
    collectionAccessPoint(high, halfWidth), collectionAccessPoint(low, halfWidth)]
const bounds = (points: Point[]) => ({ minE: Math.min(...points.map(p => p[0])), maxE: Math.max(...points.map(p => p[0])),
  minN: Math.min(...points.map(p => p[1])), maxN: Math.max(...points.map(p => p[1])) })
const pieces = [
  { id: 'top-landing', low: L.run / 2, high: L.run / 2 + L.landingDepth, height: L.upper },
  ...Array.from({ length: L.count }, (_, i) => ({ id: `tread-${i + 1}`, low: L.run / 2 - (i + 1) * L.tread,
    high: L.run / 2 - i * L.tread, height: L.upper + (L.lower - L.upper) * (i + 1) / L.count })),
  { id: 'bottom-landing', low: -L.run / 2 - L.landingDepth, high: -L.run / 2, height: L.lower },
]

export function getCollectionAccessRegions(): CollectionGradeRegion[] {
  return pieces.map(piece => {
    const points = outline(piece.low, piece.high), height = piece.height - L.pavingDepth
    return { id: `collection-approach-court-${piece.id}`, points, bounds: bounds(points), height,
      levelAt: () => height, gradient: [0, 0], surface: 'earth' }
  })
}
const fullOutline = outline(-L.run / 2 - L.landingDepth, L.run / 2 + L.landingDepth, L.width / 2 + L.cheekWidth)
export const collectionAccessExclusions = [{ id: 'collection-court-terrace-access', points: fullOutline, bounds: bounds(fullOutline) }]

/** Exact interior cheek planes, in the same local coordinates as the mesh.
 * Terrain clips only this occupied band, preserving uncovered wall faces.
 */
export function collectionAccessCheekBand(a: Point, b: Point): { bottom: number; top: number } | undefined {
  const local = (p: Point): Point => [(p[0] - crossing[0]) * outward[0] + (p[1] - crossing[1]) * outward[1],
    (p[0] - crossing[0]) * tangent[0] + (p[1] - crossing[1]) * tangent[1]]
  const p = local(a), q = local(b), epsilon = 1e-6
  if (Math.abs(p[1] - q[1]) > epsilon || Math.abs(Math.abs(p[1]) - L.width / 2) > epsilon) return
  const mid = (p[0] + q[0]) / 2
  const piece = pieces.find(piece => mid > piece.low - epsilon && mid < piece.high + epsilon)
  if (!piece || Math.min(p[0], q[0]) < piece.low - epsilon || Math.max(p[0], q[0]) > piece.high + epsilon) return
  return { bottom: piece.height - L.cheekDepth, top: piece.height + L.cheekRise }
}

export const collectionAccessProvenance = {
  manifestId: 'vinci/collection-access', assetClass: 'GENERATED', certainty: 'reconstructed',
  source: ['brief/COMMISSION.md § Judges list 10', 'src/wings/vinci/data/closluce.json retained courtyard and terrace platforms'],
  label: {
    en: 'Modern museum access proposal. A 2.0 m wide stair joins the court at H 0.00 m to the terrace at H −1.90 m. Twelve 0.1583 m risers and 0.30 m treads occupy a 3.60 m run, with a 0.75 m landing at each end. Its exact position is derived from the registered terrace edge; it is not evidence of a historical stair. Only its paving footprints receive grade 0.06 m below finish. Raw IGN samples and registered platform outlines and levels remain unchanged.',
    de: 'Vorschlag für einen modernen Museumszugang. Eine 2,0 m breite Treppe verbindet den Hof auf H 0,00 m mit der Terrasse auf H −1,90 m. Zwölf Steigungen von 0,1583 m und Auftritte von 0,30 m liegen auf einer Lauflänge von 3,60 m, mit je einem 0,75 m langen Podest. Die genaue Lage wird aus der registrierten Terrassenkante abgeleitet; sie belegt keine historische Treppe. Nur unter den Belagsgrundrissen liegt das Planum 0,06 m unter der fertigen Oberfläche. IGN-Rohwerte sowie registrierte Plattformumrisse und -höhen bleiben unverändert.',
  },
  parameterLabel: {
    en: 'Authored design ranges: width 1.8–2.2 m, tread 0.28–0.32 m, riser 0.14–0.18 m, landing length 0.6–0.9 m; the fixed total rise follows the existing 0.00/−1.90 m platform levels. Placement crosses the terrace east edge 4.6% from its southern endpoint; proposed placement range 4.0–5.0%. Concrete cheeks are 0.14 m wide [0.12–0.18], rise 0.09 m [0.06–0.12] and extend 0.22 m beneath the paving [0.18–0.26]. These are design choices, not survey uncertainties.',
    de: 'Gestaltete Entwurfsbereiche: Breite 1,8–2,2 m, Auftritt 0,28–0,32 m, Steigung 0,14–0,18 m, Podestlänge 0,6–0,9 m; der feste Gesamthöhenunterschied folgt den vorhandenen Plattformhöhen 0,00/−1,90 m. Die Lage kreuzt die östliche Terrassenkante bei 4,6% ab ihrem südlichen Endpunkt; vorgeschlagener Lagebereich 4,0–5,0%. Betonwangen sind 0,14 m breit [0,12–0,18], stehen 0,09 m hoch [0,06–0,12] und reichen 0,22 m unter den Belag [0,18–0,26]. Dies sind Entwurfsentscheidungen, keine Vermessungsunsicherheiten.',
  },
  recipe: 'One original welded contemporary concrete mesh, fourteen 60 mm finish caps and continuous 140 mm side cheeks. Structural risers are the actual shared modern terrain batch. Exact inner cheek bands are subtracted from terrain wall triangles; no coplanar offsets or hidden uncovered cut. Shared filtered cast-concrete material, no texture assets. Centreline and footprint use the retained terrace edge, a 4.6% crossing fraction and orthonormal outward/transverse axes.',
  date: '2026-09-10',
} as const

export function createCollectionAccess(): Group {
  const position: number[] = [], normal: number[] = [], uv: number[] = []
  const quad = (a: Point3, b: Point3, c: Point3, d: Point3, facing: Point3) => {
    const points = [a, b, c, d].map(p => world(...p))
    const n = points[1]!.clone().sub(points[0]!).cross(points[2]!.clone().sub(points[0]!)).normalize()
    // Retain the original diagonal, vertices and world UVs exactly.
    const reverse = n.dot(world(...facing)) < 0
    if (reverse) n.negate()
    for (const i of reverse ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]) { const p = points[i]!; position.push(p.x, p.y, p.z); normal.push(n.x, n.y, n.z); uv.push(p.x, p.z) }
  }
  const faceAlong = (sign: number): Point3 => [outward[0] * sign, outward[1] * sign, 0]
  const faceAcross = (sign: number): Point3 => [tangent[0] * sign, tangent[1] * sign, 0]
  const p = (along: number, across: number, height: number): Point3 => [...collectionAccessPoint(along, across), height]
  const cap = (low: number, high: number, top: number, openLow: boolean, openHigh: boolean) => {
    const west = -L.width / 2, east = L.width / 2, bottom = top - L.pavingDepth
    quad(p(low, west, top), p(high, west, top), p(high, east, top), p(low, east, top), [0, 0, 1])
    quad(p(low, east, bottom), p(high, east, bottom), p(high, west, bottom), p(low, west, bottom), [0, 0, -1])
    for (const across of [west, east]) quad(p(low, across, bottom), p(high, across, bottom), p(high, across, top), p(low, across, top), faceAcross(across < 0 ? -1 : 1))
    for (const along of [...(openLow ? [] : [low]), ...(openHigh ? [] : [high])]) quad(p(along, west, bottom), p(along, east, bottom), p(along, east, top), p(along, west, top), faceAlong(along === low ? -1 : 1))
  }
  pieces.forEach((piece, i) => cap(piece.low, piece.high, piece.height, pieces[i + 1]?.height === piece.height, pieces[i - 1]?.height === piece.height))
  for (const side of [-1, 1]) {
    const inside = side * L.width / 2, outside = inside + side * L.cheekWidth
    const across = (along: number, low: number, high: number, facingAlong: number) => {
      if (Math.abs(high - low) > 1e-8) quad(p(along, inside, low), p(along, outside, low), p(along, outside, high), p(along, inside, high), faceAlong(facingAlong))
    }
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i]!, bottom = piece.height - L.cheekDepth, top = piece.height + L.cheekRise
      quad(p(piece.low, outside, bottom), p(piece.high, outside, bottom), p(piece.high, outside, top), p(piece.low, outside, top), faceAcross(side))
      for (const [low, high] of [[bottom, piece.height - L.pavingDepth], [piece.height, top]])
        quad(p(piece.low, inside, low!), p(piece.high, inside, low!), p(piece.high, inside, high!), p(piece.low, inside, high!), faceAcross(-side))
      quad(p(piece.low, inside, top), p(piece.low, outside, top), p(piece.high, outside, top), p(piece.high, inside, top), [0, 0, 1])
      quad(p(piece.high, inside, bottom), p(piece.high, outside, bottom), p(piece.low, outside, bottom), p(piece.low, inside, bottom), [0, 0, -1])
      if (!i) across(piece.high, bottom, top, 1)
      const next = pieces[i + 1]
      if (!next) across(piece.low, bottom, top, -1)
      else { across(piece.low, next.height + L.cheekRise, top, -1); across(piece.low, next.height - L.cheekDepth, bottom, 1) }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3)); geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3)); geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  geometry.userData = { basis: collectionAccessProvenance.recipe, triangles: position.length / 9 }
  const mesh = new Mesh(geometry, collectionConcreteMaterial(true)); mesh.name = 'vinci/collection-access/concrete'
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData = { ...collectionAccessProvenance }
  const group = new Group(); group.name = 'vinci/collection-court-terrace-access'; group.userData = { ...collectionAccessProvenance, layout: L, meshes: 1, triangles: position.length / 9 }
  group.add(mesh); return group
}

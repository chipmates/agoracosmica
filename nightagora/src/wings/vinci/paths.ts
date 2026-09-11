/** Material boundaries only: mapped/assumed centre lines keep their dossier
 * width, while the consuming terrain mesh supplies every elevation. */
import { feature, polygon, type Quantity } from './site'

export type PathPoint = [east: number, north: number]
export type PathId = 'street' | 'garden-descent'
export interface PathBounds { minE: number; maxE: number; minN: number; maxN: number }
export interface PathSpecification {
  id: PathId
  name: { en: string; de: string }
  centreline: PathPoint[]
  width: Quantity<number>
  alignmentCertainty: 'measured' | 'assumed'
  alignmentSource: string[]
  sourceLabel: { en: string; de: string }
}
export interface PathCorridor {
  id: PathId
  segment: number
  points: PathPoint[]
  bounds: PathBounds
  width_m: number
  assetClass: 'GENERATED'
  certainty: 'conjectural'
}

export const pathSpecifications: readonly PathSpecification[] = [
  {
    id: 'street',
    name: { en: 'Rue du Clos Lucé', de: 'Rue du Clos Lucé' },
    centreline: polygon('street').map(p => [p[0]!, p[1]!]),
    width: feature('street').width_m!,
    alignmentCertainty: 'measured',
    alignmentSource: ['OSM-AREA'],
    sourceLabel: {
      en: 'Rue du Clos Lucé follows the mapped modern alignment. A medieval route is plausible; its precise paving is unknown. Nominal width: 5 m; assumed range: 3.5–6.5 m. Grade follows IGN samples except the separately proposed road cut.',
      de: 'Die Rue du Clos Lucé folgt dem kartierten heutigen Verlauf. Ein mittelalterlicher Weg ist plausibel; sein genauer Belag ist unbekannt. Angenommene Nennbreite: 5 m; Bereich: 3,5–6,5 m. Das Gefälle folgt den IGN-Höhenwerten, mit Ausnahme des gesondert vorgeschlagenen Straßeneinschnitts.',
    },
  },
  {
    id: 'garden-descent',
    name: { en: 'Proposed descent to park', de: 'Vorgeschlagener Abstieg zum Park' },
    centreline: polygon('garden-descent').map(p => [p[0]!, p[1]!]),
    width: feature('garden-descent').width_m!,
    alignmentCertainty: 'assumed',
    alignmentSource: ['A-LAYOUT'],
    sourceLabel: {
      en: 'Proposed display circulation, not an authenticated period path. Nominal width: 1.8 m; assumed range: 1.3–2.5 m. The surface follows the surveyed slope; no additional levelling or stairs are inferred.',
      de: 'Vorgeschlagener Besucherweg, kein belegter Weg aus dieser Zeit. Angenommene Nennbreite: 1,8 m; Bereich: 1,3–2,5 m. Die Oberfläche folgt dem vermessenen Hang; zusätzliche Einebnungen oder Stufen werden daraus nicht abgeleitet.',
    },
  },
]

export const pathProvenance = {
  manifestId: 'vinci/path-surfaces',
  assetClass: 'GENERATED',
  certainty: 'conjectural',
  recipe: 'Exact dossier centre lines and nominal widths, straight segments joined by intersections of their parallel offsets, butt ends at the supplied endpoints. Convex polygons classify existing terrain triangles as earth. No added elevations, crossfall, aprons, stairs or raised overlay. IGN height samples and the existing explicit grade overlays remain the only ground-height inputs.',
  source: ['OSM-AREA', 'A-SITE', 'A-LAYOUT'],
  translation: 'English source-card wording is a museum summary of the supplied dossier. German is a faithful museum translation; no locked German label was supplied.',
}

const area = (points: PathPoint[]): number => points.reduce((sum, a, i) => {
  const b = points[(i + 1) % points.length]!
  return sum + a[0] * b[1] - b[0] * a[1]
}, 0) / 2

/** Shared miter sections close each bend without overlapping segment quads.
 * Width remains the perpendicular distance between parallel segment edges.
 * The supplied lines have moderate bends; no smoothing moves their vertices. */
function corridorsFor(specification: PathSpecification): PathCorridor[] {
  const line = specification.centreline
  const halfWidth = specification.width.value / 2
  const normals = line.slice(1).map((b, i): PathPoint => {
    const a = line[i]!, dx = b[0] - a[0], dn = b[1] - a[1]
    const length = Math.hypot(dx, dn)
    if (!length) throw new RangeError(`Repeated path point in ${specification.id}`)
    return [-dn / length, dx / length]
  })
  const offsets = line.map((_, i): PathPoint => {
    if (i === 0) return [normals[0]![0] * halfWidth, normals[0]![1] * halfWidth]
    if (i === line.length - 1) return [normals[i - 1]![0] * halfWidth, normals[i - 1]![1] * halfWidth]
    const a = normals[i - 1]!, b = normals[i]!
    const x = a[0] + b[0], n = a[1] + b[1]
    const magnitude = Math.hypot(x, n)
    const denominator = magnitude ? (x * b[0] + n * b[1]) / magnitude : 0
    if (denominator < 1e-8) throw new RangeError(`Reversing path segment in ${specification.id}`)
    return [x / magnitude * halfWidth / denominator, n / magnitude * halfWidth / denominator]
  })
  const side = (index: number, sign: number): PathPoint => [
    line[index]![0] + offsets[index]![0] * sign,
    line[index]![1] + offsets[index]![1] * sign,
  ]
  return normals.map((_, segment): PathCorridor => {
    let points = [side(segment, 1), side(segment + 1, 1), side(segment + 1, -1), side(segment, -1)]
    if (area(points) < 0) points = points.reverse()
    return {
      id: specification.id,
      segment,
      points,
      bounds: {
        minE: Math.min(...points.map(p => p[0])), maxE: Math.max(...points.map(p => p[0])),
        minN: Math.min(...points.map(p => p[1])), maxN: Math.max(...points.map(p => p[1])),
      },
      width_m: specification.width.value,
      assetClass: 'GENERATED',
      certainty: 'conjectural',
    }
  })
}

export function getPathCorridors(): PathCorridor[] {
  return pathSpecifications.flatMap(corridorsFor)
}

/* Landscape dressing only. The modern garden photographs inform the open
   branching and the scale of foliage; neither species nor planting positions
   are evidence for the garden in the reconstructed year. All of this geometry
   is GENERATED and conjectural. No photograph is sampled or displayed. */

import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardNodeMaterial,
  Vector3,
} from 'three/webgpu'
import { mix, positionWorld, sin, vec3 } from 'three/tsl'
import type { TierName } from '../../stack/tier'
import { dossier, edgeDistance, feature, inside, polygon, type Quantity } from './site'
import { getApronOutlines } from './apron'

interface GeometryBatch {
  positions: number[]
  normals: number[]
  colours: number[]
}

interface TreePlan {
  east: number
  north: number
  height: number
  spread: number
  seed: number
  near: boolean
}

const PROVENANCE = {
  manifestId: 'vinci/vegetation',
  assetClass: 'GENERATED',
  certainty: 'conjectural',
  basis: 'Modern garden plates Q119, Q128 and Q178; branching character only. Planting positions and tree dimensions are not period evidence.',
  recipe: 'Deterministic curved tapering trunks ending within irregular broad crowns, unequal rising forks, dense terminal twig sprays and individually folded broad leaves in muted October colours. Four proposed near trees frame the exterior views; up to twenty-four distant trees make open woodland after circulation exclusions. Root flares and litter exclude the dossier masonry, platforms and circulation routes. Species, positions and dimensions remain conjectural.',
}

const UP = new Vector3(0, 1, 0)
const LEAF_COLOURS = [
  '#596335', '#68713e', '#788048', '#877d42', '#9a8448', '#6b6b39', '#456047',
].map((value) => new Color(value))
const BARK = new Color('#655f4e')
const LICHEN = new Color('#77785e')

function randomSource(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function batch(): GeometryBatch {
  return { positions: [], normals: [], colours: [] }
}

function vertex(target: GeometryBatch, p: Vector3, n: Vector3, colour: Color): void {
  target.positions.push(p.x, p.y, p.z)
  target.normals.push(n.x, n.y, n.z)
  target.colours.push(colour.r, colour.g, colour.b)
}

function triangle(target: GeometryBatch, a: Vector3, b: Vector3, c: Vector3, colour: Color): void {
  const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize()
  vertex(target, a, n, colour)
  vertex(target, b, n, colour)
  vertex(target, c, n, colour)
}

/** Round tapered branches. The small unevenness follows a branch along its
    length, so bark has longitudinal ridges rather than independent bumps. */
function limb(
  target: GeometryBatch,
  start: Vector3,
  finish: Vector3,
  radius0: number,
  radius1: number,
  sides: number,
  seed: number,
): void {
  const axis = finish.clone().sub(start).normalize()
  const side = axis.clone().cross(Math.abs(axis.y) > 0.94 ? new Vector3(1, 0, 0) : UP).normalize()
  const cross = axis.clone().cross(side).normalize()
  for (let i = 0; i < sides; i++) {
    const ring = (index: number, radius: number, centre: Vector3): [Vector3, Vector3] => {
      const angle = (index / sides) * Math.PI * 2
      const normal = side.clone().multiplyScalar(Math.cos(angle)).addScaledVector(cross, Math.sin(angle))
      const furrow = 1 + 0.10 * Math.sin(index * 4.7 + seed)
      return [centre.clone().addScaledVector(normal, radius * furrow), normal]
    }
    const [a, an] = ring(i, radius0, start)
    const [b, bn] = ring(i + 1, radius0, start)
    const [c, cn] = ring(i + 1, radius1, finish)
    const [d, dn] = ring(i, radius1, finish)
    const colour = BARK.clone().lerp(LICHEN, Math.max(0, -an.z) * 0.42)
      .multiplyScalar(0.80 + 0.18 * Math.sin(seed + i * 2.8) ** 2)
    vertex(target, a, an, colour)
    vertex(target, b, bn, colour)
    vertex(target, c, cn, colour)
    vertex(target, a, an, colour)
    vertex(target, c, cn, colour)
    vertex(target, d, dn, colour)
  }
}

/** A leaf is a shallow folded kite with a real pointed silhouette, two
    triangular faces and an actual midrib crease. There is no alpha card. */
function leaf(
  target: GeometryBatch,
  centre: Vector3,
  length: number,
  angle: number,
  tilt: number,
  colour: Color,
): void {
  const along = new Vector3(Math.sin(angle) * Math.cos(tilt), Math.sin(tilt), Math.cos(angle) * Math.cos(tilt))
  const across = new Vector3(Math.cos(angle), 0, -Math.sin(angle))
  const start = centre.clone().addScaledVector(along, -length * 0.48)
  const tip = centre.clone().addScaledVector(along, length * 0.52)
  const left = centre.clone().addScaledVector(across, length * 0.30).addScaledVector(UP, -length * 0.08)
  const right = centre.clone().addScaledVector(across, -length * 0.30).addScaledVector(UP, -length * 0.09)
  triangle(target, start, left, tip, colour)
  triangle(target, start, tip, right, colour.clone().multiplyScalar(0.91))
}

function geometry(source: GeometryBatch): BufferGeometry {
  const result = new BufferGeometry()
  result.setAttribute('position', new Float32BufferAttribute(source.positions, 3))
  result.setAttribute('normal', new Float32BufferAttribute(source.normals, 3))
  result.setAttribute('color', new Float32BufferAttribute(source.colours, 3))
  result.computeBoundingSphere()
  return result
}

function distanceToRoute(east: number, north: number, points: number[][]): number {
  let nearest = Infinity
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!
    const dx = b[0]! - a[0]!, dn = b[1]! - a[1]!
    const square = dx * dx + dn * dn
    const t = square ? Math.max(0, Math.min(1, ((east - a[0]!) * dx + (north - a[1]!) * dn) / square)) : 0
    nearest = Math.min(nearest, Math.hypot(east - a[0]! - t * dx, north - a[1]! - t * dn))
  }
  return nearest
}

/** X is east, Y is elevation, Z is minus north. The sampler alone decides
    where every root meets the surveyed terrain. */
export function createVegetation(
  heightAt: (east: number, north: number) => number,
  tier: TierName,
): Group {
  const group = new Group()
  group.name = 'vinci generated conjectural landscape trees'
  group.userData = { ...PROVENANCE }
  const wood = batch()
  const foliage = batch()
  const calm = tier === 'calm'
  const plans: TreePlan[] = [
    { east: 21.4, north: -2.1, height: 14, spread: 6.7, seed: 417, near: true },
    { east: -26, north: -20, height: 11.7, spread: 5.3, seed: 953, near: true },
    { east: -8, north: -36, height: 9.3, spread: 5.2, seed: 1739, near: true },
    { east: -31, north: -64, height: 14.8, spread: 6.8, seed: 1287, near: true },
  ]
  const place = randomSource(73821)
  for (let i = 0; i < 24; i++) {
    const bank = i % 3
    plans.push({
      east: bank === 0 ? 72 + place() * 88 : bank === 1 ? -88 - place() * 70 : -75 + place() * 215,
      north: bank === 2 ? -148 - place() * 66 : -135 + place() * 255,
      height: 11.5 + place() * 10.5,
      spread: 4.8 + place() * 3.7,
      seed: 2103 + i * 347,
      near: false,
    })
  }

  const excluded = [
    dossier.site.footprint.map(p => p.value),
    dossier.site.build_envelope.map(p => p.value),
    ...['courtyard', 'terrace', 'street-grade'].map(polygon),
    ...getApronOutlines().map(apron=>apron.points),
    ...dossier.site.features.filter(f => f.id.startsWith('annex-'))
      .map(f => (f.geometry as Quantity<number[]>[]).map(p => p.value)),
  ]
  const routes = ['street', 'gate-steps', 'garden-descent'].map(id => ({
    points: polygon(id), halfWidth: feature(id).width_m!.value / 2,
  }))
  const clearGround = (east: number, north: number, margin: number): boolean =>
    !excluded.some(points => inside(east, north, points) || edgeDistance(east, north, points) < margin) &&
    !routes.some(route => distanceToRoute(east, north, route.points) < route.halfWidth + margin)
  const retainedPlans = plans.filter(plan => clearGround(plan.east, plan.north, plan.height * 0.028 * 4))

  for (const plan of retainedPlans) {
    const random = randomSource(plan.seed)
    const leafRandom = randomSource(plan.seed + 98873)
    const base = new Vector3(plan.east, heightAt(plan.east, plan.north) - 0.06, -plan.north)
    const trunkRadius = plan.height * (plan.near ? 0.028 : 0.023)
    const lean = new Vector3((random() - 0.5) * 1.3, 0, (random() - 0.5) * 1.3)
    const trunkAt = (fraction: number): Vector3 => base.clone()
      .addScaledVector(UP, plan.height * fraction)
      .addScaledVector(lean, fraction * fraction)
      .add(new Vector3(Math.sin(fraction * 6 + plan.seed) * fraction * 0.18, 0, Math.sin(fraction * 4) * 0.15))
    const trunkSegments = plan.near ? 7 : 4
    for (let section = 0; section < trunkSegments; section++) {
      const a = section / trunkSegments
      const b = (section + 1) / trunkSegments
      limb(wood, trunkAt(a * 0.78), trunkAt(b * 0.78), trunkRadius * (1 - a * 0.94), trunkRadius * (1 - b * 0.94), plan.near ? 8 : 5, plan.seed)
    }
    if (plan.near) {
      for (let root = 0; root < 6; root++) {
        const angle = root * 2.399 + random() * 0.4
        const x = plan.east + Math.cos(angle) * trunkRadius * (2.8 + random())
        const north = plan.north + Math.sin(angle) * trunkRadius * (2.8 + random())
        limb(wood, base.clone().addScaledVector(UP, 0.34), new Vector3(x, heightAt(x, north) + 0.04, -north), trunkRadius * 0.36, 0.015, 5, root)
      }
    }

    const crownTurn = random() * Math.PI * 2
    const leaders = plan.near ? 12 : 7
    for (let branch = 0; branch < leaders; branch++) {
      const fraction = 0.23 + (branch / leaders) * 0.42 + (random() - 0.5) * 0.055
      const azimuth = branch * 2.39996 + crownTurn + (random() - 0.5) * 0.95
      const outward = new Vector3(Math.cos(azimuth), 0, Math.sin(azimuth))
      const reach = plan.spread * (0.60 + random() * 0.40) * (1 - (branch / leaders) * 0.20)
      const origin = trunkAt(fraction)
      const knee = origin.clone().addScaledVector(outward, reach * 0.48)
        .addScaledVector(UP, plan.height * (0.075 + random() * 0.09))
      const end = knee.clone().addScaledVector(outward, reach * 0.52)
        .addScaledVector(UP, plan.height * (0.09 + random() * 0.12))
      const radius = trunkRadius * (0.38 - (branch / leaders) * 0.19)
      limb(wood, origin, knee, radius, radius * 0.54, plan.near ? 6 : 4, branch)
      limb(wood, knee, end, radius * 0.54, radius * 0.19, plan.near ? 5 : 4, branch)

      const forks = plan.near ? 3 : 2
      for (let fork = 0; fork < forks; fork++) {
        const source = knee.clone().lerp(end, 0.25 + fork * 0.30)
        const direction = azimuth + (fork - (forks - 1) / 2) * 0.94 + (random() - 0.5) * 0.60
        const bough = new Vector3(Math.cos(direction), 0.22 + random() * 0.58, Math.sin(direction))
        const twigEnd = source.clone().addScaledVector(bough, plan.spread * (0.22 + random() * 0.15))
        limb(wood, source, twigEnd, radius * 0.25, 0.012, plan.near ? 4 : 3, fork + branch)
        const twigs = plan.near ? 3 : 2
        for (let twig = 0; twig < twigs; twig++) {
          const twigStart = source.clone().lerp(twigEnd, 0.36 + twig * 0.24)
          const twigAngle = direction + (twig % 2 ? 0.82 : -0.78)
          const tip = twigStart.clone().add(new Vector3(Math.cos(twigAngle) * 0.78, 0.21 + random() * 0.51, Math.sin(twigAngle) * 0.78))
          if (plan.near) limb(wood, twigStart, tip, 0.019, 0.004, 3, twig)
          const count = plan.near ? (calm ? 42 : 84) : (calm ? 36 : 72)
          for (let i = 0; i < count; i++) {
            // An elongated spray follows the twig. Its uneven edges and
            // unfilled centre leave the branch hierarchy legible from afar.
            const along = leafRandom()
            const curl = i * 2.39996 + leafRandom() * 0.5
            const spray = (0.15 + Math.sin(along * Math.PI) * 0.50) * (plan.near ? 1 : 1.65)
            const point = twigStart.clone().lerp(tip, along)
              .add(new Vector3(Math.cos(curl) * spray, (leafRandom() - 0.5) * spray * 0.9, Math.sin(curl) * spray))
            const palette = LEAF_COLOURS[Math.floor(leafRandom() * LEAF_COLOURS.length)] ?? LEAF_COLOURS[0]!
            const leafColour = palette.clone().multiplyScalar(0.73 + 0.30 * along + leafRandom() * 0.18)
            const size = (plan.near ? 0.18 : 0.20) * (0.7 + leafRandom() * 0.65)
            leaf(foliage, point, size, curl, (leafRandom() - 0.45) * 1.55, leafColour)
          }
        }
      }
    }

    // Fallen leaves belong to the same draw and concentrate around the roots.
    // Their positions follow the height field, including the uphill side.
    if (plan.near) {
      for (let i = 0; i < 95; i++) {
        const angle = random() * Math.PI * 2
        const radius = Math.sqrt(random()) * plan.spread * 0.72
        const x = plan.east + Math.cos(angle) * radius
        const north = plan.north + Math.sin(angle) * radius
        if (!clearGround(x, north, 0.18)) continue
        leaf(foliage, new Vector3(x, heightAt(x, north) + 0.035, -north), 0.16 + random() * 0.09,
          angle, 0.05, new Color('#796447').multiplyScalar(0.8 + random() * 0.4))
      }
    }
  }

  const bark = new MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.98 })
  bark.name = 'vinci generated bark with longitudinal grain'
  bark.userData = { ...PROVENANCE }
  const broad = sin(positionWorld.y.mul(0.74).add(positionWorld.x.mul(1.8))).mul(0.06).add(0.95)
  const ridge = sin(positionWorld.x.mul(39).add(sin(positionWorld.y.mul(0.7)).mul(2.2)).add(positionWorld.z.mul(32))).mul(0.5).add(0.5)
  const tooth = sin(positionWorld.x.mul(147).add(positionWorld.y.mul(213)).add(positionWorld.z.mul(171))).mul(0.035).add(0.965)
  bark.colorNode = vec3(1).mul(broad).mul(mix(0.78, 1.03, ridge)).mul(tooth)
  const leafMaterial = new MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.88, side: DoubleSide })
  leafMaterial.name = 'vinci generated October folded leaves'
  leafMaterial.userData = { ...PROVENANCE }

  const branches = new Mesh(geometry(wood), bark)
  branches.name = 'vinci generated trunks roots and branching limbs'
  branches.castShadow = !calm
  branches.receiveShadow = true
  branches.userData = { ...PROVENANCE }
  const leaves = new Mesh(geometry(foliage), leafMaterial)
  leaves.name = 'vinci generated individual leaves and root litter'
  leaves.receiveShadow = true
  // Opaque folded leaves need no alpha hash and make no screen door shadow.
  // The distant woodland does not pay another two full foliage shadow passes.
  leaves.castShadow = false
  leaves.userData = { ...PROVENANCE }
  group.add(branches, leaves)
  group.userData['trees'] = retainedPlans.length
  group.userData['triangles'] = (wood.positions.length + foliage.positions.length) / 9
  group.userData['draws'] = 2
  group.userData['treePlans'] = retainedPlans.map((plan) => ({ ...plan }))
  group.userData['excluded'] = ['cadastre', 'build envelope', 'mapped annexes', 'courtyard', 'terrace', 'street grade', 'house-side apron', 'street', 'gate steps', 'garden descent']
  return group
}

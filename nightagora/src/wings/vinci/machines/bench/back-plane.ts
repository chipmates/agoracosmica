/* THE SECOND PLANE.
 *
 * A machine alone in the air is a machine with no size. The eye reads distance
 * from the things it can measure one against another, and a bench that holds
 * one object over a floor that fades into fog gives it nothing to measure: the
 * object could be a metre or a tower. So the bench stands a wall behind the
 * machine at a stated distance, low, in the wing's own stone, lit by the same
 * key and standing on the same floor, and the line where that floor meets it
 * is the measurement.
 *
 * It is dressing and it says so: a modern hall for one object, not a claim
 * about where any of these machines stood. It carries its own record.
 *
 * `BENCH_BACK_PLANE` is the switch, default on and true on this bench only:
 * the wing's own hall is another seat's, and nothing here reaches it.
 */

import {
  DoubleSide, Mesh, MeshStandardNodeMaterial, PlaneGeometry, Vector3,
  type BufferGeometry,
} from 'three/webgpu'
import { float, mix, mx_noise_float, smoothstep, uv, vec2, vec3 } from 'three/tsl'
import type { MaterialSet, Stack } from '../../../../stack'

/** the bench stands its second plane; the wing's hall is not this seat's */
export const BENCH_BACK_PLANE = true

/** how far behind the platform's centre the wall stands, in metres */
export const BACK_PLANE_METRES = 12

/** how deep in the air the wall stands: the fraction of the fog's own ramp
 * it is read through, the same on every machine whatever the key does to it */
export const BACK_PLANE_AIR = 0.62

/** how high the wall stands, in metres: a hall's wall, not a horizon. A
 * machine the eye looks steeply down on needs more of it, because the frame's
 * own top edge then falls below the wall's; the height is measured against
 * that edge and held between these two, which are a room and a hall. */
export const BACK_PLANE_HEIGHT = 3.2
export const BACK_PLANE_HEIGHT_MAX = 4.4

/** the course of the wing's stone, in metres */
const COURSE = 0.42
/** what the wall keeps of the stone's own value, so it stays behind */
const WALL_VALUE = 0.3
const BLOCK = 0.86

/** the wall's own surface: the wing's stone, coursed, with three scales on it
 * and a density that thins with distance, so the plane is never flat colour. */
export function backPlaneMaterial(stack: Stack, stone: MaterialSet): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ roughness: stone.roughness, metalness: 0 })
  material.name = 'vinci/bench/back-plane'
  material.side = DoubleSide
  // the wall's own uv is in metres: along it, and up from its foot
  const along = uv().x, up = uv().y
  const detail = stack.detail(material, {
    ...stone,
    scale: [1.2, 1.2], scales: [2.4, .21, .004], normalStrength: .34,
    detail: { ...stone.detail, macro: 2.4, macroContrast: .07, mid: .42, micro: .45 },
  }, { count: 3, uv: vec2(along, up), maps: .45, fade: [30, 190] })
  // the courses. A joint is a line of shadow, not a drawn line: it darkens,
  // it roughens, and the block above it sits a hair proud of the one below.
  const row = up.div(COURSE)
  const course = row.floor()
  const stagger = course.mul(.5).fract()
  const block = along.div(BLOCK).add(stagger)
  const bed = row.fract().min(float(1).sub(row.fract()))
  const perpend = block.fract().min(float(1).sub(block.fract()))
  const joint = float(1)
    .sub(smoothstep(0, .05, bed).mul(smoothstep(0, .032, perpend)))
    .clamp(0, 1)
  // every block is cut from its own stone, so no two are the same value
  const cut = mx_noise_float(vec3(block.floor().mul(.37), course.mul(.71), 2.13)).clamp(-1, 1)
  const face = float(1).add(cut.mul(.06)).mul(float(1).sub(joint.mul(.34)))
  const foot = float(1).sub(smoothstep(0, .55, up)).mul(.5)
  const albedo = detail.albedo.mul(face).mul(float(1).sub(foot.mul(.42)))
  // A hall's wall at twelve metres is not the subject. It is held a full
  // stop under the object it stands behind, so the frame keeps one hero.
  material.colorNode = vec3(stone.albedo.r * WALL_VALUE, stone.albedo.g * WALL_VALUE, stone.albedo.b * WALL_VALUE).mul(albedo).mul(detail.occlusion)
  material.roughnessNode = mix(detail.roughness, float(.97), joint).clamp(.55, .99)
  // the floor closes the ambient at the foot of a wall the way a corner does
  material.aoNode = float(1).sub(foot.mul(.6)).mul(float(1).sub(joint.mul(.3)))
  return material
}

export interface BackPlane {
  mesh: Mesh
  geometry: BufferGeometry
}

/** Stand the wall behind the machine, square to the eye, on the same floor. */
export function buildBackPlane(options: {
  centre: Vector3
  /** the direction from the machine toward the camera */
  toward: Vector3
  floorY: number
  /** how far the camera stands off the machine, so the wall covers the frame */
  cameraDistance: number
  /** the half angle of the frame, in radians, for the height the top needs */
  halfFieldRad?: number
}): BackPlane {
  const { centre, toward, floorY, cameraDistance } = options
  const flat = new Vector3(toward.x, 0, toward.z).normalize()
  const width = Math.max(24, (cameraDistance + BACK_PLANE_METRES) * 1.7)
  // WHERE THE FRAME'S TOP EDGE CROSSES THE WALL. A machine the eye looks
  // steeply down on (the flywheel is pitched 32 degrees) puts the top of the
  // frame below the top of a three metre wall, and the second plane is then
  // not in the picture at all. The ray of that top edge is intersected with
  // the wall's own plane and the wall is built to reach it.
  const eye = centre.clone().addScaledVector(toward, cameraDistance)
  const forward = toward.clone().multiplyScalar(-1).normalize()
  const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize()
  const up = new Vector3().crossVectors(right, forward).normalize()
  const top = forward.clone().addScaledVector(up, Math.tan(options.halfFieldRad ?? 17 * Math.PI / 180)).normalize()
  const wallAt = new Vector3(centre.x - flat.x * BACK_PLANE_METRES, floorY, centre.z - flat.z * BACK_PLANE_METRES)
  const toWall = wallAt.clone().sub(eye).dot(flat.clone().multiplyScalar(-1))
  const along = top.dot(flat.clone().multiplyScalar(-1))
  const reach = along > 0.05 ? eye.y + top.y * (toWall / along) - floorY : BACK_PLANE_HEIGHT
  const height = Math.min(BACK_PLANE_HEIGHT_MAX, Math.max(BACK_PLANE_HEIGHT, reach * 1.06))
  const geometry = new PlaneGeometry(width, height, 12, 4)
  // metres along the wall and up from its foot, so the courses are courses
  const coordinates = geometry.getAttribute('uv')
  const position = geometry.getAttribute('position')
  for (let i = 0; i < coordinates.count; i++) {
    coordinates.setXY(i, position.getX(i) + width / 2, position.getY(i) + height / 2)
  }
  const mesh = new Mesh(geometry, new MeshStandardNodeMaterial())
  mesh.name = 'vinci/bench/back-plane'
  mesh.position.set(
    centre.x - flat.x * BACK_PLANE_METRES,
    floorY + height / 2,
    centre.z - flat.z * BACK_PLANE_METRES,
  )
  mesh.lookAt(mesh.position.clone().add(flat))
  mesh.castShadow = false
  mesh.receiveShadow = true
  mesh.userData['assetClass'] = 'GENERATED'
  mesh.userData['manifestId'] = 'vinci/bench/back-plane'
  return { mesh, geometry }
}

/** the distance from the eye to the wall, for the air that has to reach it */
export function backPlaneReach(cameraDistance: number): number {
  return cameraDistance + BACK_PLANE_METRES
}

/** the record's own numbers, for the drawer that quotes them */
export const BACK_PLANE_RECIPE = Object.freeze({
  class: 'GENERATED',
  name: 'vinci/bench/back-plane',
  metres: BACK_PLANE_METRES,
  height: BACK_PLANE_HEIGHT,
  course: COURSE,
  block: BLOCK,
  description:
    'A modern hall wall for one object: the wing’s stone, coursed at 42 cm with 86 cm blocks, standing 12 m behind the platform’s centre on the bench’s own floor, lit by the bench’s own key. Dressing, and no claim about where any machine stood.',
})

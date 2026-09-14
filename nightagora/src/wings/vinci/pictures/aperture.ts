/**
 * THE ROOM'S LIGHT IS AN OPENING, NOT A LAMP.
 *
 * A north window admits no sun, so nothing here projects one. What reaches a
 * surface is the sky seen through the glazing: a finite area source at the
 * aperture's centre, with the cosine at the receiver and the cosine at the
 * source, then compressed by a declared exponent so one bay reads like a room
 * with bounce in it rather than the 13 to 1 a single opening gives with one
 * reflection. The compression is the generated stand-in for interreflection.
 * It is dressing, not a measurement of illuminance.
 *
 * The wall took this term first. The frames on it take the SAME one, because
 * a two metre altarpiece two metres from the glass cannot be lit like one
 * eight metres away. Two pieces make that work on a turned surface:
 *
 *   the RUN, evaluated with the hanging wall's own facing, so a frame's flat
 *   front is exactly as bright as the plaster it hangs on; and
 *
 *   the FACING, the ratio between a member's own cosine and that flat one, so
 *   the window side of a moulding lifts and the far side falls without either
 *   of them leaving the wall's run.
 *
 * The hang owns this record so the module stays self-contained: a gallery
 * with another window passes its own and nothing else changes.
 */
import * as TSL from 'three/tsl'
import type { MeshStandardNodeMaterial } from 'three/webgpu'

// TSL composition uses the same narrow untyped boundary as the stack helper.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { clamp, dot, float, max, min, mix, normalGeometry, positionWorld, pow, vec3 } =
  TSL as unknown as Record<string, N>

export interface ApertureLight {
  /** The glazing's centre in the room's own metres, and its area. */
  readonly aperture: { readonly x: number; readonly y: number; readonly z: number; readonly area_m2: number }
  /** Half the area over pi: the disk's own softening near the glass. */
  readonly nearTerm: number
  readonly reference: number
  readonly compression: number
  readonly range: readonly [number, number]
  /** Past the compressed range the room keeps falling, at this fraction of
      its own slope, so the far end of a long wall is a gradient and not a
      level. The bounce that holds it up is the stand-in, not a measurement. */
  readonly shoulder: number
  /** Where that shallow slope itself stops. Nothing in the room is darker. */
  readonly shoulderFloor: number
  /** Above the band the same holds: a surface at the glass is not one level
      either. The slope kept there, and the ceiling it reaches. */
  readonly crest: number
  readonly crestCeiling: number
  /** The return off the boards is a floor under the direct term, and it is
      not the same everywhere: the pool of light is at the glass. This is the
      reach, in square metres, at which that return is halved. */
  readonly floorFraction: number
  readonly floorReach: number
  readonly warmFar: readonly [number, number, number]
  /** What a member's own facing may do to the flat value at the same place. */
  readonly facing: { readonly compression: number; readonly range: readonly [number, number] }
  /** A lit surface carries a material tone at the strength its ambient and
      key leave it; an unlit print carries it whole. This is the exponent
      that puts a reproduction's falloff back at the strength the plaster
      beside it actually shows. */
  readonly plateFalloff: number
}

export const NORTH_WINDOW_LIGHT: ApertureLight = Object.freeze({
  aperture: { x: -1.38, y: 1.855, z: 1.65, area_m2: 7.08 },
  nearTerm: 2.25,
  reference: .0189,
  compression: .13,
  range: [.845, 1.145] as [number, number],
  shoulder: .40,
  shoulderFloor: .615,
  crest: .40,
  crestCeiling: 1.235,
  floorFraction: .30,
  floorReach: 12,
  warmFar: [1.018, 1.001, .978] as [number, number, number],
  facing: { compression: .42, range: [.76, 1.20] as [number, number] },
  plateFalloff: .40,
})

/** The unit vector from the shaded point toward the aperture's centre. */
function toward(light: ApertureLight): { unit: N; squared: N } {
  const w = light.aperture
  const to = vec3(w.x, w.y, w.z).sub(positionWorld)
  const squared = dot(to, to)
  return { unit: to.div(squared.sqrt()), squared }
}

/** The cosine at the aperture itself; its normal is +X, into the room. */
const atWindow = (unit: N): N => clamp(unit.x.negate(), 0, 1)

/**
 * The declared term for a receiver with the given normal: the tone that
 * multiplies its colour, and how far along the run it stands (0 at the glass,
 * 1 at the far end) for whatever warms with distance.
 */
export function apertureTone(light: ApertureLight, normal: N = normalGeometry): { tone: N; far: N } {
  const { unit, squared } = toward(light)
  const raw = clamp(dot(unit, normal), 0, 1).mul(atWindow(unit)).div(squared.add(light.nearTerm))
  // A constant floor made two thirds of a nine metre wall one value. The
  // return off the boards falls away from the glass like everything else, so
  // the direct term stays the term that models the wall along its whole run.
  const bounce = float(light.reference * light.floorFraction)
    .mul(float(light.floorReach).div(squared.add(light.floorReach)))
  const lit = max(raw, bounce)
  const level = pow(lit.div(light.reference), light.compression)
  // Below the compressed band the room keeps a shallow slope of its own
  // rather than stopping, and that slope has its own end.
  const shallow = float(light.range[0]).add(min(level.sub(light.range[0]), float(0)).mul(light.shoulder))
  // The same at the top: a mount two metres from the glass was pinned to the
  // band's ceiling across its whole width, which is why an empty field read
  // as one value rather than as a lit surface.
  const steep = float(light.range[1]).add(max(level.sub(light.range[1]), float(0)).mul(light.crest))
  const tone = clamp(min(max(level, shallow), steep), light.shoulderFloor, light.crestCeiling)
  const far = clamp(float(light.range[1]).sub(tone).div(light.range[1] - light.range[0]), 0, 1)
  return { tone, far }
}

/** The run a surface parallel to the hanging wall takes, whatever it is. */
export const apertureRun = (light: ApertureLight): { tone: N; far: N } =>
  apertureTone(light, vec3(0, 0, 1))

/**
 * What a member's own facing does to that run. Exactly 1 on a surface
 * parallel to the wall, above it on the window side, below it on the other.
 * The ratio is of cosines only, so this never moves the run itself.
 */
export function apertureFacing(light: ApertureLight, normal: N = normalGeometry): N {
  const { unit } = toward(light)
  const flat = max(unit.z, float(.05))
  const ratio = clamp(clamp(dot(unit, normal), 0, 1).div(flat), .002, 40)
  return clamp(pow(ratio, light.facing.compression), light.facing.range[0], light.facing.range[1])
}

/** The sky is cool; what returns from the oak floor at the far end is not. */
function warmed(node: N, far: N, light: ApertureLight): N {
  const w = light.warmFar
  return node.mul(mix(vec3(1, 1, 1), vec3(w[0], w[1], w[2]), far))
}

/** A room surface, shaded by its own geometry: floor, reveals, plinth, wall. */
export function underAperture(m: MeshStandardNodeMaterial, light: ApertureLight): void {
  const { tone, far } = apertureTone(light)
  m.colorNode = warmed((m.colorNode as N).mul(tone), far, light)
}

/**
 * A piece of furniture on the hanging wall: the run of the wall it hangs on,
 * plus the modelling its own turned faces earn.
 */
export function underApertureOnWall(m: MeshStandardNodeMaterial, light: ApertureLight): void {
  const { tone, far } = apertureRun(light)
  m.colorNode = warmed((m.colorNode as N).mul(tone).mul(apertureFacing(light)), far, light)
}

/**
 * A reproduction is never shown brighter than its own scan. It takes the
 * room's falloff away from the window and nothing else, so a print at the
 * glass is the plate and a print at the far end is the plate in that light.
 */
export function plateUnderAperture(light: ApertureLight): N {
  const { tone } = apertureRun(light)
  const fall = clamp(tone.div(light.range[1]), light.shoulderFloor / light.range[1], 1)
  return pow(fall, light.plateFalloff)
}

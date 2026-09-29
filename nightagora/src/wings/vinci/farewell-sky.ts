/** THE EVENING'S SKY: the twilight the analytic dome does not carry once the
 * sun is down, and the night that follows it.
 *
 * The Preetham dome goes dark two degrees under the horizon, so below it the
 * sky is this: the glow over the sunset, rising and fading as the sun sinks;
 * the earth's own shadow in the opposite sky with the band of rose above it;
 * and a zenith deepening from blue to night. The twilight's colours and levels
 * are a scenic assumption (the rig's night rule), a type of an October evening.
 *
 * The night is `farewell-night.ts`: the stars are the record, the sky over
 * Clos Lucé at 21:00 local apparent time on the day, held fixed while the
 * evening runs, and the Milky Way is drawn after the real one.
 */
import { Color, Vector3, type Object3D } from 'three/webgpu'
import { cross, exp, float, length, max, mix, normalize, pow, smoothstep, step, uniform, vec3 } from 'three/tsl'
import { createFarewellNight, type FarewellNight } from './farewell-night'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any

/** The uniforms the evening moves: the sun's direction (engine frame), how far
 * it stands under the horizon in degrees, the twilight's share, and the
 * share of the farewell's own sun disc (0 outside the farewell). */
export interface EveningSky { sun: N; depression: N; share: N; disc: N }
export function createEveningSky(): EveningSky {
  return { sun: uniform(new Vector3(0, 1, 0)), depression: uniform(0), share: uniform(0), disc: uniform(0) }
}

/** THE LOW SUN AS A DISC: half a degree across, warm, redder and dimmer as
 * the air it crosses thickens toward the horizon, with a small aureole of a
 * degree or so. The dome's own disc is folded into its compressed glow, so
 * this one is added after the compression; whatever stands in front of the
 * sky hides it, and it sinks away as its centre passes under the horizon. */
const SUN_RADIUS = Math.sin(.26 * Math.PI / 180), SUN_EDGE = SUN_RADIUS * .12
export function sunDiscRadiance(ray: N, evening: EveningSky): N {
  const sun = evening.sun
  const off = length(cross(ray, sun)), facing = step(0, ray.dot(sun))
  const low = smoothstep(.14, 0, sun.y)
  const colour = mix(vec3(1, .84, .6), vec3(1, .42, .14), low)
  const disc = smoothstep(SUN_RADIUS + SUN_EDGE, SUN_RADIUS - SUN_EDGE, off)
  const aureole = exp(off.negate().div(.012)).mul(.5)
  const level = mix(float(12), float(3.2), low).mul(smoothstep(-.0045, .0015, sun.y))
  return colour.mul(disc.mul(level).add(aureole.mul(level.mul(.12)))).mul(facing).mul(evening.disc)
}

const rgb = (hex: string): N => { const c = new Color(hex); return vec3(c.r, c.g, c.b) }

/** The twilight's own radiance along a ray, in the dome's linear units. */
export function twilightRadiance(ray: N, evening: EveningSky): N {
  const up = max(ray.y, 0)
  const flatRay = normalize(vec3(ray.x, 0, ray.z).add(vec3(1e-5, 0, 0)))
  const flatSun = normalize(vec3(evening.sun.x, 0, evening.sun.z).add(vec3(1e-5, 0, 0)))
  const towardSun = flatRay.dot(flatSun)
  const d = evening.depression
  // the glow over the sunset: bright and warm on the horizon, spreading over
  // a third of the sky round the sun's azimuth, fading as the sun goes down
  const spread = pow(towardSun.mul(.5).add(.5), 5)
  const glowLevel = exp(d.negate().div(2.4)).mul(.7)
  const low = exp(up.negate().div(.09))
  const mid = exp(up.negate().div(.3))
  const glow = mix(rgb('#ff9a55'), rgb('#ff5a2c'), low).mul(low.mul(.8).add(mid.mul(.45))).mul(spread).mul(glowLevel)
  // the earth's shadow opposite, and the rose band above it
  const anti = pow(towardSun.negate().mul(.5).add(.5), 2)
  const shadowTop = d.mul(.017).add(.02)
  const belt = smoothstep(shadowTop, shadowTop.add(.07), up).mul(smoothstep(shadowTop.add(.34), shadowTop.add(.1), up))
  const rose = rgb('#d78fa2').mul(belt).mul(anti).mul(exp(d.negate().div(3.4)).mul(.38))
  // the dome's blue, deepening toward the night
  const zenithLevel = exp(d.negate().div(4.2)).mul(.34).add(.012)
  const dome = mix(rgb('#243a78'), rgb('#101a40'), smoothstep(0, 1, up)).mul(zenithLevel)
  return dome.add(glow).add(rose).mul(evening.share)
}

export interface EveningStars { sprite: Object3D; uDepression: N; uLevel: N; uTime: N; night: FarewellNight }
/** THE NIGHT, mounted where the stars always hung: its group rides with the
 * eye, and the evening alone sets it. */
export function createEveningStars(): EveningStars {
  const night = createFarewellNight()
  return { sprite: night.group, uDepression: night.uDepression, uLevel: night.uLevel, uTime: night.uTime, night }
}

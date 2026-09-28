/** THE EVENING'S SKY: the twilight the analytic dome does not carry once the
 * sun is down, and the stars that come out in it.
 *
 * The Preetham dome goes dark two degrees under the horizon, so below it the
 * sky is this: the glow over the sunset, rising and fading as the sun sinks;
 * the earth's own shadow in the opposite sky with the band of rose above it;
 * and a zenith deepening from blue to night. Every colour and level here is a
 * scenic assumption (the rig's night rule), not a measured sky.
 *
 * The stars are one instanced field hung at a fixed distance round the eye,
 * each with its own magnitude, which sets the depression of the sun at which
 * it is first seen: the brightest in the civil twilight, the rest as the sky
 * darkens. None is smaller than two pixels, so none shimmers as a grain.
 */
import { AdditiveBlending, Color, InstancedBufferAttribute, PointsNodeMaterial, Sprite, Vector3 } from 'three/webgpu'
import { clamp, cross, exp, float, instancedBufferAttribute, length, max, mix, normalize, pow, sin, smoothstep, step, uniform, uv, vec2, vec3 } from 'three/tsl'

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

/** A seeded draw, so the same sky stands at every visit. */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

export interface EveningStars { sprite: Sprite; uDepression: N; uLevel: N; uTime: N }
/** THE STARS, one field of `count` round the eye at `radius` metres. */
export function createEveningStars(count = 2600, radius = 620): EveningStars {
  const rand = seeded(15171010)
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), size = new Float32Array(count), seen = new Float32Array(count * 2)
  const tints = [new Color('#dfe7ff'), new Color('#f4f6ff'), new Color('#fff2dc'), new Color('#ffdcb4'), new Color('#cfdcff')]
  for (let i = 0; i < count; i++) {
    // a uniform sky, a little below the horizon too, which the ground hides
    const y = -.08 + rand() * 1.08, th = rand() * Math.PI * 2, r = Math.sqrt(Math.max(0, 1 - y * y))
    pos[i * 3] = Math.cos(th) * r * radius; pos[i * 3 + 1] = y * radius; pos[i * 3 + 2] = Math.sin(th) * r * radius
    // magnitudes weighted to the faint, as the sky's own count is
    const magnitude = -1.2 + 6.8 * Math.pow(rand(), .42)
    const tint = tints[Math.floor(rand() * tints.length)]!
    const bright = Math.min(1, Math.pow(10, -.4 * (magnitude - 1)) * .9 + .12)
    col[i * 3] = tint.r * bright; col[i * 3 + 1] = tint.g * bright; col[i * 3 + 2] = tint.b * bright
    size[i] = 2 + Math.max(0, 4.6 - magnitude) * .48
    // the depression at which it is first seen, and a phase for its scintillation
    seen[i * 2] = 2.2 + 2.1 * (magnitude + 1.2)
    seen[i * 2 + 1] = rand() * Math.PI * 2
  }
  const uDepression: N = uniform(0), uLevel: N = uniform(0), uTime: N = uniform(0)
  const mat = new PointsNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending })
  const posN: N = instancedBufferAttribute(new InstancedBufferAttribute(pos, 3))
  const sizeN: N = instancedBufferAttribute(new InstancedBufferAttribute(size, 1))
  const colN: N = instancedBufferAttribute(new InstancedBufferAttribute(col, 3))
  const seenN: N = instancedBufferAttribute(new InstancedBufferAttribute(seen, 2))
  mat.positionNode = posN
  mat.sizeAttenuation = false
  mat.sizeNode = sizeN
  mat.fog = false
  const dir = normalize(posN)
  // more air toward the horizon: less light, and gone under three degrees
  const air = smoothstep(.05, .5, dir.y).mul(.75).add(.25).mul(smoothstep(.02, .09, dir.y))
  const out = smoothstep(seenN.x.sub(1.6), seenN.x.add(1.6), uDepression)
  // the small ones scintillate a little; the bright ones burn steady
  const scint = smoothstep(float(3.2), float(2), sizeN)
  const twinkle = float(1).sub(sin(uTime.mul(2.3).add(seenN.y.mul(7))).mul(.5).add(.5).mul(scint.mul(.28)))
  const kernel = smoothstep(.5, .06, length(uv().sub(vec2(.5, .5))))
  mat.colorNode = colN
  mat.opacityNode = clamp(kernel.mul(out).mul(air).mul(twinkle).mul(uLevel), 0, 1)
  const sprite = new Sprite(mat)
  sprite.count = count
  sprite.frustumCulled = false
  sprite.renderOrder = -1
  sprite.visible = false
  sprite.name = 'vinci/evening-stars'
  return { sprite, uDepression, uLevel, uTime }
}

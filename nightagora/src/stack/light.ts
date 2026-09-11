/* THE ONE KEY LIGHT — a direction, a temperature, a level, and the shadow it
   throws.

   Every scene of the museum is lit by ONE key. Not because a second lamp is
   expensive but because a room with two keys has no time of day: the whole
   claim of this museum is that you are standing in a real place at a real
   hour, and an hour is a single direction. Everything else in the frame is
   the ambient the sky and the ground give back, which the probe supplies, and
   whatever the scene's own sources emit (a fire is not a key: it is an object
   that happens to glow).

   The key casts cascaded shadows (CSM) so that one shadow map can serve both
   the column two metres away and the stoa thirty metres out without either
   turning to porridge.

   The rig this file hands back is deliberately usable from UNLIT materials:
   most of the night is hand-authored TSL with no lighting model at all, and
   those materials still deserve to know whether the sky reaches them. That is
   what `shadow`, `ambient()` and `key()` are for. */

import {
  Color,
  DirectionalLight,
  HemisphereLight,
  Object3D,
  Scene,
  SRGBColorSpace,
  Texture,
  Vector3,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import { bakeSky, type SkyRecipe } from './sky'
import type { Tier } from './tier'

/* A hand-composed TSL graph outruns its own overload types; the cast happens
   once here and the shader code below stays readable. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const {
  cameraPosition,
  clamp,
  dot,
  float,
  length,
  max,
  mix,
  normalWorld,
  pmremTexture,
  positionWorld,
  shadow,
  smoothstep,
  uniform,
  vec3,
} = TSL as unknown as Record<string, N>

/** One hundred lux is intensity 1. The stack's authored reference, so a
    scene can be written in lux and still read as a picture. */
const LUX_REF = 100

export interface KeyLightOptions {
  /** degrees, 0 = the light stands behind -Z, growing clockwise seen from
      above. Optional only because a probe can answer for it: a sky knows
      where its own sun stands, and `Stack.light({ hdri })` reads it there. */
  azimuth?: number
  /** degrees above the horizon */
  elevation?: number
  kelvin?: number
  lux?: number
  /** a loaded equirectangular probe out of the library. A light is built
      inside a scene's constructor and an HDRI is a network fetch, so the
      fetch is `Stack.hdri(name)` and this is where its result goes; without
      one the probe is baked from `sky` */
  probe?: Texture
  sky?: Partial<SkyRecipe>
  /** how much of the probe reaches a surface that faces nothing in particular */
  ambient?: number
  /** how far out the key still needs to throw a shadow */
  reach?: number
  /** the half-width of each cascade's box, in metres, near first. The near
      one must still CONTAIN the casters whose shadows reach it, not only the
      ground it shades. */
  cascades?: [number, number]
}

export interface KeyLight {
  light: DirectionalLight
  fill: HemisphereLight
  /** the scene this rig was installed into: the stack keeps one key per
      scene, so it needs to know which rig a new one replaces */
  scene: Scene
  direction: Vector3
  colour: Color
  /** 0..1 at the shaded point: 1 in the key, 0 in the shadow of the colonnade */
  shadow: N
  /** the same term for a material whose world position three cannot infer
      (anything instanced through its own vertex path) */
  shadowAt: (world: N) => N
  /** the sky and ground irradiance arriving at a surface with this normal */
  ambient: (normal?: N) => N
  /** the key's own contribution, already shadowed */
  key: (normal: N) => N
  probe: Texture | null
  setTier: (tier: Tier) => void
  setCamera: (camera: unknown) => void
  /** takes every object this rig put in the scene back out, releases the
      shadow maps and the baked probe. Safe to call twice. */
  dispose: () => void
  /** false once dispose has run, so a stale handle cannot be re-listed */
  live: () => boolean
}

/** Kelvin to a linear RGB colour, the usual blackbody approximation. */
export function kelvinToColour(kelvin: number): Color {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100
  let r: number
  let g: number
  let b: number
  if (t <= 66) {
    r = 255
    g = 99.4708025861 * Math.log(t) - 161.1195681661
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592)
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492)
    b = 255
  }
  const c = new Color()
  c.setRGB(
    Math.min(1, Math.max(0, r / 255)),
    Math.min(1, Math.max(0, g / 255)),
    Math.min(1, Math.max(0, b / 255)),
    SRGBColorSpace
  )
  return c
}

const DEFAULT_SKY: SkyRecipe = {
  zenith: '#05070f',
  horizon: '#101a3c',
  ground: '#05060f',
  key: { azimuth: 0, elevation: 40, colour: '#c8d6ff', size: 0.9, intensity: 1 },
  stars: 1,
}

/**
 * Install the scene's one key light, its fill and its probe.
 *
 * The returned rig is shared: a scene calls this once and every material that
 * wants to know about the light reads the same nodes, so the room lights as
 * one body instead of as forty loops.
 */
export function createKeyLight(scene: Scene, tier: Tier, opts: KeyLightOptions): KeyLight {
  const az = ((opts.azimuth ?? 0) * Math.PI) / 180
  const el = ((opts.elevation ?? 40) * Math.PI) / 180
  const dir = new Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    -Math.cos(az) * Math.cos(el)
  ).normalize()

  const colour = kelvinToColour(opts.kelvin ?? 5200)
  const light = new DirectionalLight(colour.getHex(), (opts.lux ?? 200) / LUX_REF)
  const reach = opts.reach ?? tier.shadow.maxFar
  light.position.copy(dir).multiplyScalar(Math.max(24, reach * 0.8))
  /* EVERY OBJECT THIS RIG PUTS IN THE SCENE, so dispose takes all of them
     out again. A wing that rebuilds its key at each station otherwise
     leaves a directional light and a target behind per jump, and the far
     cascade was never removed at all. */
  const owned: Object3D[] = []
  const own = <T extends Object3D>(o: T): T => {
    scene.add(o)
    owned.push(o)
    return o
  }
  const target = own(new Object3D())
  light.target = target
  own(light)

  // the fill is the ground's own answer to the sky: it is NOT a second key,
  // it carries no direction of its own beyond up versus down
  const fill = own(new HemisphereLight(0x2b3a72, 0x05060f, 0.35))

  const probe: Texture | null = opts.probe
    ? opts.probe
    : bakeSky({
        ...DEFAULT_SKY,
        ...opts.sky,
        key: {
          ...DEFAULT_SKY.key,
          ...opts.sky?.key,
          azimuth: opts.azimuth ?? 0,
          elevation: opts.elevation ?? 40,
          colour: `#${colour.getHexString()}`,
        },
      })
  if (probe) scene.environment = probe

  /* THE CASCADES. One shadow map stretched over both the column two metres
     away and the stoa thirty metres out is a map that serves neither: the
     near shadow goes blocky and the far one disappears. So the key throws
     two, a tight one over the court and a wide one over everything else,
     and a surface reads whichever one it stands in.

     They are built at the top tier and STAY built, because the shadow term
     is compiled into hand-written materials all over the night and a tier
     switch may not recompile forty shaders mid-visit. What the tier changes
     is whether the maps are rendered at all and whether the materials listen:
     `shadowMix` at 0 gives every surface full key, which is what calm wants.

     Not three's own CSMShadowNode: its cascade select is built out of `If`
     blocks around shadow nodes, and that graph cannot be consumed from a
     material's colorNode (it throws inside AssignNode.generate). Almost every
     material in this museum is unlit and hand-written, so being usable from a
     colorNode is the requirement, and two hand-fitted cascades meet it. */
  const cascades: Array<{ light: DirectionalLight; half: number }> = []
  const halves = opts.cascades ?? [14, reach * 0.62]
  const SPLITS: Array<[number, number]> = [
    [halves[0], 1],
    [halves[1], 0],
  ]
  for (const [half, isKey] of SPLITS) {
    const l = isKey ? light : new DirectionalLight(colour.getHex(), 0)
    if (!isKey) {
      l.position.copy(light.position)
      l.target = own(new Object3D())
      own(l)
    }
    l.castShadow = true
    l.shadow.mapSize.setScalar(tier.shadow.mapSize)
    l.shadow.bias = -0.0009
    l.shadow.normalBias = 0.03
    l.shadow.camera.near = 0.5
    l.shadow.camera.far = Math.max(60, reach * 1.6)
    l.shadow.camera.left = -half
    l.shadow.camera.right = half
    l.shadow.camera.top = half
    l.shadow.camera.bottom = -half
    l.shadow.camera.updateProjectionMatrix()
    cascades.push({ light: l, half })
  }
  const near = shadow(cascades[0]!.light)
  const far = shadow(cascades[1]!.light)
  const shadowMix = uniform(tier.shadow.on ? 1 : 0)
  /** the split, in metres from the eye, and the metre it blends over */
  const SPLIT = cascades[0]!.half * 0.7
  const BLEND = 1.6

  function shadowAt(world: N = positionWorld): N {
    const dist = length(world.sub(cameraPosition))
    const pick = mix(near, far, smoothstep(SPLIT - BLEND, SPLIT, dist))
    return mix(float(1), pick, shadowMix)
  }

  function setTier(next: Tier): void {
    shadowMix.value = next.shadow.on ? 1 : 0
    for (const cas of cascades) {
      cas.light.castShadow = next.shadow.on
      cas.light.shadow.autoUpdate = next.shadow.on
      cas.light.shadow.needsUpdate = next.shadow.on
      cas.light.shadow.mapSize.setScalar(next.shadow.mapSize)
    }
  }
  setTier(tier)
  const shadowNode: N = shadowAt()

  let alive = true
  const amb = opts.ambient ?? 1
  const probeNode: N | null = probe ? pmremTexture(probe) : null
  const skyColour = c(fill.color)
  const groundColour = c(fill.groundColor)

  function ambient(normal: N = normalWorld): N {
    // hemisphere first: it is the term that never lies about up and down
    const up = clamp(normal.y.mul(0.5).add(0.5), 0, 1)
    const hemi = mix(groundColour, skyColour, up).mul(fill.intensity)
    if (!probeNode) return hemi.mul(amb)
    // and the probe on top of it, sampled at the diffuse end of the mip
    // chain, which is what an irradiance probe actually is
    const irradiance = probeNode.sample(normal, float(0.96)).rgb
    return hemi.add(irradiance).mul(amb * 0.5)
  }

  function key(normal: N): N {
    const nl = max(dot(normal, vec3(dir.x, dir.y, dir.z)), 0)
    return c(colour).mul(nl).mul(light.intensity).mul(shadowNode)
  }

  return {
    light,
    fill,
    direction: dir,
    colour,
    shadow: shadowNode,
    shadowAt,
    ambient,
    key,
    scene,
    probe,
    setTier,
    setCamera() {
      /* the cascades are fitted around the visitor's own seat, which in this
         museum is the origin of every scene; a wing that walks a rail refits
         them from its station */
    },
    dispose() {
      if (!alive) return
      alive = false
      for (const o of owned) scene.remove(o)
      owned.length = 0
      // a shadow map is a render target, and a cascade holds one each
      for (const cas of cascades) {
        cas.light.shadow.dispose()
        cas.light.dispose()
      }
      // a baked sky belongs to this light; a library probe is shared and
      // outlives every scene that borrows it
      if (!opts.probe) probe?.dispose()
      if (scene.environment === probe) scene.environment = null
    },
    live: () => alive,
  }
}

function c(col: Color): N {
  return vec3(col.r, col.g, col.b)
}

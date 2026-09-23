// THE LIGHTS AS DATA, and each one's Cycles equal. Three's physical units:
// a spot or a point is candela, a rectangle is luminance (cd/m2); a pixel of a
// white Lambert surface under a spot of I cd at d m is I cos / (pi d2) in the
// engine's linear light. Cycles gives a point or spot of P "watts" a radiant
// intensity of P / 4 pi and a Lambert area light of P a radiance of P / (pi A),
// so the same linear light is P = 4 pi I and P = pi A L: the frames compare at
// the same exposure, with no luminous efficacy between them (see README).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l) }
const sub = (a, b) => a.map((x, i) => x - b[i])

/** the kelvin each hall light was authored at (hall-light.ts) */
function authoredKelvins(appRoot) {
  const src = readFileSync(join(appRoot, 'src/wings/vinci/collection/hall-light.ts'), 'utf8')
  const out = {}
  for (const m of src.matchAll(/name: '([a-z-]+)', at:[^\n]*?kelvin: (\d+)/g)) out[m[1]] = Number(m[2])
  const c = /const CLERESTORY = \{[\s\S]*?kelvin: (\d+)/.exec(src)
  if (c) out.clerestory = Number(c[1])
  return out
}

/** the lamp face each spot shines from (hall-light.ts fixtures: the lens, a
 * 50 mm radius disc a hand inside the hood) */
const LAMP_RADIUS_M = 0.05

export function translateLights(scan, appRoot) {
  const kelvins = authoredKelvins(appRoot)
  const lights = [], elsewhere = []
  for (const l of scan.lights) {
    const short = (l.name || '').split('/').pop()
    if (/collection-hall-light\//.test(l.name) && l.type === 'SpotLight') {
      const dir = norm(sub(l.target, l.position))
      const outer = l.angle, inner = l.angle * (1 - l.penumbra)
      lights.push({
        name: l.name, kind: 'spot', position: l.position, target: l.target, direction: dir,
        colour: l.color, kelvin: kelvins[short] ?? null,
        intensity: { value: l.intensity, unit: 'cd' },
        cone: { outerHalfAngle: outer, innerHalfAngle: inner, penumbra: l.penumbra, law: 'smoothstep(cos outer, cos inner, cos theta)' },
        falloff: { decay: l.decay, reach: l.distance, law: 'I / d^decay x (1 - (d/reach)^4)^2, clamped' },
        shadow: { engine: l.shadow ? { mapPx: l.shadow.mapSize[0], filterTexels: l.shadow.radius, bias: l.shadow.bias, normalBias: l.shadow.normalBias, near: l.shadow.near, far: l.shadow.far } : null },
        receivers: 'the hall\'s own surfaces only (material.lightsNode), and the hall\'s air',
        cycles: {
          type: 'SPOT', power_w: 4 * Math.PI * l.intensity, spot_size: 2 * outer,
          spot_blend: (Math.cos(inner) - Math.cos(outer)) / (1 - Math.cos(outer)),
          radius: LAMP_RADIUS_M, reachWindow: true, receivers: 'everything (real light)',
          shadow: `ray traced from a ${LAMP_RADIUS_M * 1000} mm lamp face, replacing a ${l.shadow?.mapSize?.[0]} px map filtered over ${l.shadow?.radius} texels`,
        },
      })
    } else if (/collection-hall-light\//.test(l.name) && l.type === 'RectAreaLight') {
      const area = l.width * l.height
      lights.push({
        name: l.name, kind: 'area', position: l.position, forward: norm(l.forward), up: norm(l.up), width: l.width, height: l.height,
        colour: l.color, kelvin: kelvins.clerestory ?? null,
        intensity: { value: l.intensity, unit: 'cd/m2 (luminance)' },
        shadow: { engine: 'none: three\'s rectangle lights cast no shadow' },
        receivers: 'the hall\'s own surfaces only (material.lightsNode); never the air',
        cycles: { type: 'AREA', shape: 'RECTANGLE', power_w: Math.PI * area * l.intensity, size: l.width, size_y: l.height, spread: Math.PI,
          receivers: 'everything but the air (light linking)', shadow: 'ray traced: the light shelf, the beams and the machines now shade the window\'s light' },
      })
    } else if (/hall-fitting$/.test(l.name)) {
      lights.push({
        name: l.name, kind: 'point', position: l.position, colour: l.color,
        intensity: { value: l.intensity, unit: 'cd' }, falloff: { decay: l.decay, reach: l.distance },
        receivers: 'every surface except the hall\'s own: the hall takes only its own rig',
        cycles: { type: 'POINT', power_w: 4 * Math.PI * l.intensity, radius: 0.05, enabled: false,
          why: 'in the engine these five reach no surface of the hall that the frames show; Cycles would light the whole room with them' },
      })
    } else {
      elsewhere.push({ name: l.name || l.type, type: l.type, intensity: l.intensity, why: l.inBox ? 'lights another room' : 'outside the room: the sun and the sky\'s fill reach no hall surface' })
    }
  }
  return { lights, elsewhere }
}

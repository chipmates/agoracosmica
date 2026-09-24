/** THE BODY WALL'S DECLARED LIGHT ON ITS SHEETS. A sheet is a self-lit plate
 * in this engine, so the light the cabinet's own table puts on the wall is
 * declared on it here, from the same numbers that build the lamps: the six
 * wallwashers through their optic, the head over the sheet apart, and the
 * cabinet's bounce. No daylight reaches them. A renderer that lights the
 * plates as surfaces reads the table and drops this term.
 */
import { Color, Vector3 } from 'three/webgpu'
import * as TSL from 'three/tsl'
import { BODY_LIGHTS, CHEST, LINING, v3, type BodyLight, type WashOptic } from './body-wall-plan'

// The node overload boundary stays local to this file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any

const { cos, dot, exp, float, max, min, select, smoothstep, sqrt, uniform, vec3 } = TSL as unknown as Record<string, N>

/** The live levels, shared by the lamps and the sheets so a change to one
 * is a change to both. */
const engineLights = BODY_LIGHTS.filter(light => light.engine !== false && light.kind === 'spot')
export const BODY_PLATE = {
  levels: Object.fromEntries(engineLights.map(light => [light.name, uniform(light.intensity)])) as Record<string, N>,
  colours: Object.fromEntries(engineLights.map(light => [light.name, uniform(new Color(light.colour))])) as Record<string, N>,
  /** the paper's share of the light over the mat's, and the bounce it sees */
  gain: uniform(1.4),
  ambient: uniform(new Color(.05, .047, .043)),
}

/** The band's share at `height` on the optic's plane, `off` along the wall
 * from the lamp's line: `washBand` of the plan, as nodes. */
function band(o: WashOptic, height: N, off: N): N {
  const lateral = exp(off.mul(off).mul(-1 / (2 * o.spread * o.spread)))
  const crown = float(o.crown).sub(off.mul(off).mul(o.arc))
  const lit = smoothstep(o.foot - o.footSoft, o.foot, height)
  const foot = exp(min(height.sub(o.foot), 0).div(o.tailFall)).mul(o.tail).mul(float(1).sub(lit)).add(lit)
  return lateral.mul(float(1).sub(smoothstep(crown.sub(o.crownSoft), crown, height))).mul(foot)
}

/** WHAT A WALLWASHER SENDS TOWARD P, as a multiple of its level: the wash
 * at the ray's hit on the optic's plane times the cube of that distance over
 * the lamp's reach to the plane. A surface then takes the level times this,
 * over its own square distance and on its own cosine, which is the level
 * times the wash wherever it is the plane. Nothing east of the lamp. */
export function washToward(P: N, light: BodyLight): N {
  const o = light.wash!, [east, north, height] = light.at
  const reach = east - o.plane
  const d = P.sub(vec3(east, height, -north))
  const west = float(east).sub(P.x)
  const t = float(reach).div(max(west, .02))
  const off = d.z.negate().mul(t)
  const hit = float(height).add(d.y.mul(t))
  const far = sqrt(dot(d, d)).mul(t)
  return select(west.greaterThan(.02), band(o, hit, off).mul(far.mul(far).mul(far)).div(reach), float(0))
}

/** What a spot of the table lays on a surface at P with normal n: its
 * candela through its cone's soft edge (and its optic, where it has one),
 * over the square of the distance, on the cosine of the surface. The same
 * falloff the lamps are drawn with. */
function irradiance(P: N, n: N, light: BodyLight, level: N): N {
  const at = v3(...light.at), aim = v3(...light.aim)
  const axis = new Vector3().subVectors(aim, at).normalize()
  const toP = P.sub(vec3(at.x, at.y, at.z))
  const d2 = dot(toP, toP).max(1e-4)
  const dir = toP.div(sqrt(d2))
  const cone = smoothstep(cos(float(light.angle)), cos(float(light.angle * (1 - light.penumbra))), dot(dir, vec3(axis.x, axis.y, axis.z)))
  const optic = light.wash ? washToward(P, light) : float(1)
  return level.mul(cone).mul(optic).mul(max(dot(n, dir.negate()), 0)).div(d2)
}

/** True on the body wall's own sheets: the plates on the partition's
 * gallery face, between the lining's south end and the head over the sheet
 * apart. */
export function onBodyWall(P: N, n: N): N {
  return n.x.greaterThan(.5).and(P.x.greaterThan(LINING.face - .5)).and(P.x.lessThan(LINING.face))
    .and(P.z.greaterThan(-(CHEST.north + 2))).and(P.z.lessThan(-(CHEST.south - .5)))
}

/** The sheets' light as a colour: every engine lamp of the table's, each in
 * its own warmth, as a lit paper would take it, and the cabinet's bounce. */
export function bodyWallPlateLight(P: N, n: N): N {
  let sum: N = vec3(0, 0, 0)
  for (const light of engineLights)
    sum = sum.add(BODY_PLATE.colours[light.name].mul(irradiance(P, n, light, BODY_PLATE.levels[light.name])))
  return sum.mul(1 / Math.PI).mul(BODY_PLATE.gain).add(BODY_PLATE.ambient)
}

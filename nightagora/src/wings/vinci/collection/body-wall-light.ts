/** THE BODY WALL'S DECLARED LIGHT ON ITS SHEETS. A sheet is a self-lit plate
 * in this engine, so the light the cabinet's own table puts on the wall is
 * declared on it here, from the same numbers that build the lamps: the wash
 * and the head over the sheet apart, and the cabinet's bounce. No daylight
 * reaches them. A renderer that lights the plates as surfaces reads the
 * table and drops this term.
 */
import { Color, Vector3 } from 'three/webgpu'
import * as TSL from 'three/tsl'
import { BODY_LIGHTS, CHEST, LINING, v3, type BodyLight } from './body-wall-plan'

// The node overload boundary stays local to this file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any

const { cos, dot, float, max, smoothstep, sqrt, uniform, vec3 } = TSL as unknown as Record<string, N>

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

/** What a spot of the table lays on a surface at P with normal n: its
 * candela through its cone's soft edge, over the square of the distance, on
 * the cosine of the surface. The same falloff the lamps are drawn with. */
function irradiance(P: N, n: N, light: BodyLight, level: N): N {
  const at = v3(...light.at), aim = v3(...light.aim)
  const axis = new Vector3().subVectors(aim, at).normalize()
  const toP = P.sub(vec3(at.x, at.y, at.z))
  const d2 = dot(toP, toP).max(1e-4)
  const dir = toP.div(sqrt(d2))
  const cone = smoothstep(cos(float(light.angle)), cos(float(light.angle * (1 - light.penumbra))), dot(dir, vec3(axis.x, axis.y, axis.z)))
  return level.mul(cone).mul(max(dot(n, dir.negate()), 0)).div(d2)
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

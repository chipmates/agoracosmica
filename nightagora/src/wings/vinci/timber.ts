/** Member-local texture coordinates. Positions stay in the measured ENH frame.
 * This is a procedural grain orientation, not a captured historical surface.
 */
import { Vector3 } from 'three/webgpu'

type Point=[number,number,number]
type UV=[number,number]

/** A single affine metre frame for a complete panel, before roof clipping.
 * Reusing it for every resulting polygon avoids fan-dependent grain fields.
 */
export function timberPanelFrame(points:Point[]):{uv:(point:Point)=>UV;seed:number} {
  const origin=new Vector3(...points[0]!),across=new Vector3(...points[1]!).sub(origin).normalize()
  const normal=across.clone().cross(new Vector3(...points[2]!).sub(origin)).normalize()
  const along=normal.clone().cross(across).normalize()
  let hash=2166136261
  for(const coordinate of origin.toArray())hash=Math.imul(hash^Math.round(coordinate*100),16777619)>>>0
  return {seed:hash/4294967296,uv:point=>{const offset=new Vector3(...point).sub(origin);return[offset.dot(across),offset.dot(along)]}}
}

/** U crosses the fibres; V follows the member in metres. End faces instead
 * retain two transverse coordinates for the exposed growth-ring field.
 */
export function timberFaceCoordinates(points:Point[],origin:Point,axis:Point):{uv:UV[];endGrain:boolean} {
  const along=new Vector3(...axis).normalize()
  const first=new Vector3(...points[0]!),edge=new Vector3(...points[1]!).sub(first)
  const normal=edge.clone().cross(new Vector3(...points[2]!).sub(first)).normalize()
  const endGrain=Math.abs(normal.dot(along))>.9
  const across=endGrain?edge.normalize():along.clone().cross(normal).normalize()
  const vertical=endGrain?normal.clone().cross(across).normalize():along
  const centre=new Vector3(...origin)
  return {endGrain,uv:points.map(p=>{const offset=new Vector3(...p).sub(centre);return[offset.dot(across),offset.dot(vertical)]})}
}

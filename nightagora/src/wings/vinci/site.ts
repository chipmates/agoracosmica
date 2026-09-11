import raw from './data/closluce.json?raw'
import terrainRaw from './data/terrain.json?raw'
import lightRaw from './data/light-rig.json?raw'
import { Vector3 } from 'three/webgpu'

export interface Quantity<T> { value: T; certainty: string; source: string[]; basis: string; range?: number[] }
export interface Feature {
  id: string
  geometry: Quantity<number[]>[] | Quantity<number[]>
  height_m?: Quantity<number>
  width_m?: Quantity<number>
  thickness_m?: Quantity<number>
  position?: Quantity<number[]>
}
interface SiteData {
  site: { footprint: Quantity<number[]>[]; build_envelope: Quantity<number[]>[]; features: Feature[] }
  stations: { id: string; position: Quantity<number[]> }[]
}
export const dossier = JSON.parse(raw) as SiteData
const terrain = JSON.parse(terrainRaw) as { heights_m: Quantity<number[][]> }
export const heights = terrain.heights_m.value
export const feature = (id: string): Feature => dossier.site.features.find((f) => f.id === id)!
export const polygon = (id: string): number[][] => (feature(id).geometry as Quantity<number[]>[]).map((p) => p.value)
export const world = (e: number, n: number, h: number): Vector3 => new Vector3(e, h, -n)

/** IGN samples are bilinear in their cells, never extrapolated. */
export function surveyedHeight(e: number, n: number): number {
  if (e < -200 || e > 200 || n < -360 || n > 200) throw new RangeError('Outside the retained IGN grid')
  const col = (e + 200) / 40, row = (200 - n) / 40
  const c = Math.min(9, Math.floor(col)), r = Math.min(13, Math.floor(row))
  const u = col - c, v = row - r
  const a = heights[r]!, b = heights[r + 1]!
  return (a[c]! * (1-u) + a[c+1]! * u) * (1-v) + (b[c]! * (1-u) + b[c+1]! * u) * v
}
export function inside(e: number, n: number, points: number[][]): boolean {
  let hit = false
  for (let i = 0, j = points.length - 1; i < points.length; j=i++) {
    const a = points[i]!, b=points[j]!
    if ((a[1]!>n)!==(b[1]!>n) && e < (b[0]!-a[0]!)*(n-a[1]!)/(b[1]!-a[1]!)+a[0]!) hit=!hit
  }
  return hit
}
export function edgeDistance(e: number, n: number, points: number[][]): number {
  let best = Infinity
  for (let i=0;i<points.length;i++) {
    const a=points[i]!, b=points[(i+1)%points.length]!
    const dx=b[0]!-a[0]!,dy=b[1]!-a[1]!
    const t=Math.max(0,Math.min(1,((e-a[0]!)*dx+(n-a[1]!)*dy)/(dx*dx+dy*dy)))
    best=Math.min(best,Math.hypot(e-a[0]!-t*dx,n-a[1]!-t*dy))
  }
  return best
}
const pads = ['courtyard','terrace','period-garden','street-grade'].map((id)=>({ points: polygon(id), h: feature(id).height_m!.value, id }))
const gateSteps=polygon('gate-steps')
const footprint=dossier.site.footprint.map((p)=>p.value)
/** A-SITE platforms retain explicit levels; a 3m apron joins the sampled slope. */
export function groundHeight(e:number,n:number):number {
  let h=surveyedHeight(e,n)
  for(const p of pads) {
    const d=inside(e,n,p.points)?0:edgeDistance(e,n,p.points)
    if(d<3) { const t=d/3; const s=t*t*(3-2*t); h=p.h*(1-s)+h*s }
  }
  if(inside(e,n,footprint)) h=Math.min(h,0)
  // A-SITE road landing and six-riser gallery descent. Local grade is an
  // explicit assumed cut; surrounding IGN samples remain unchanged.
  const a=gateSteps[0]!,b=gateSteps[1]!
  const dx=b[0]!-a[0]!,dy=b[1]!-a[1]!,l2=dx*dx+dy*dy
  const t=((e-a[0]!)*dx+(n-a[1]!)*dy)/l2
  const across=Math.abs((e-a[0]!)*dy-(n-a[1]!)*dx)/Math.sqrt(l2)
  if(t>-2&&t<1.45&&across<3.1){const edge=Math.max(0,(across-1.5)/1.6);const blend=edge*edge*(3-2*edge);const z=1-Math.min(1,Math.max(0,t));h=z*(1-blend)+h*blend}

  return h
}
interface HourKey { label: string; sun_azimuth_deg: Quantity<number>; sun_elevation_deg: Quantity<number> }
const dates=(JSON.parse(lightRaw) as { dates: {julian_date:string;keyframes:HourKey[]}[] }).dates
export const hourKey=dates.find((d)=>d.julian_date==='1517-10-10')!.keyframes[0]!

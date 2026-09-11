/** Separate A-SITE proposal. Only the previously uncovered interval between
 * registered street facades and the retained road-cut edge is regraded.
 * All coordinates below are derived; no new nominal apron width is imposed.
 */
import { ShapeUtils, Vector2 } from 'three/webgpu'
import { dossier, feature, polygon, type Quantity } from './site'
import { getRoadGradeRegions, type RoadGradeBounds, type RoadPoint } from './road-grade'

interface Facade { id:string;from:Quantity<number[]>;to:Quantity<number[]> }
export interface ApronOutline {
  id:string;facadeId:string;points:RoadPoint[];bounds:RoadGradeBounds
  height:number;derivedWidths:readonly [number,number]
}
export interface ApronRegion {
  id:string;facadeId:string;points:RoadPoint[];height:number
}
const facades=(dossier as unknown as {facades:Facade[]}).facades
const ids=['F01','F02','G2','G1']
const original=polygon('street-grade'),road=getRoadGradeRegions()
const point=(p:number[]):RoadPoint=>[p[0]!,p[1]!]
const westEdge:RoadPoint[]=[point(original[3]!),point(original[0]!),road[0]!.points[1]!,road[0]!.points[2]!,road[1]!.points[2]!]
const nominal=feature('street-grade').height_m!.value
const range=feature('street-grade').height_m!.range!
const distance=(a:RoadPoint,b:RoadPoint):number=>Math.hypot(a[0]-b[0],a[1]-b[1])
const signedArea=(points:RoadPoint[]):number=>points.reduce((sum,a,i)=>{
  const b=points[(i+1)%points.length]!
  return sum+a[0]*b[1]-a[1]*b[0]
},0)/2
const bounds=(points:RoadPoint[]):RoadGradeBounds=>({minE:Math.min(...points.map(p=>p[0])),maxE:Math.max(...points.map(p=>p[0])),minN:Math.min(...points.map(p=>p[1])),maxN:Math.max(...points.map(p=>p[1]))})
function project(p:RoadPoint,a:RoadPoint,b:RoadPoint):RoadPoint {
  const dx=b[0]-a[0],dn=b[1]-a[1]
  const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dn)/(dx*dx+dn*dn)))
  return[a[0]+t*dx,a[1]+t*dn]
}
function nearest(p:RoadPoint):{point:RoadPoint;distance:number;segment:number} {
  return westEdge.slice(1).map((b,segment)=>{
    const projected=project(p,westEdge[segment]!,b)
    return{point:projected,distance:distance(p,projected),segment}
  }).sort((a,b)=>a.distance-b.distance)[0]!
}
const outlines:ApronOutline[]=ids.map(id=>{
  const facade=facades.find(f=>f.id===id)!,from=point(facade.from.value),to=point(facade.to.value)
  const a=nearest(from),b=nearest(to),points:RoadPoint[]=[from,a.point]
  if(a.segment>b.segment)for(let j=a.segment;j>b.segment;j--)points.push(westEdge[j]!)
  else if(b.segment>a.segment)for(let j=a.segment+1;j<=b.segment;j++)points.push(westEdge[j]!)
  points.push(b.point,to)
  if(signedArea(points)<0)points.reverse()
  return{id:`apron-${id}`,facadeId:id,points,bounds:bounds(points),height:nominal,derivedWidths:[a.distance,b.distance]}
})
// The G1 outline follows an existing small corner in the road-cut boundary.
// Ear clipping retains that concavity; convex terrain subtraction then gives
// all pre-existing road, literal platform, stair, house and water areas priority.
const regions:ApronRegion[]=outlines.flatMap(outline=>
  ShapeUtils.triangulateShape(outline.points.map(p=>new Vector2(...p)),[]).map((indices,i)=>{
    const points=indices.map(index=>outline.points[index]!)
    if(signedArea(points)<0)points.reverse()
    return{id:`${outline.id}-${i}`,facadeId:outline.facadeId,points,height:nominal}
  }))

export function getApronOutlines():ApronOutline[]{return outlines}
export function getApronRegions():ApronRegion[]{return regions}

/** A retaining bank must not be drawn on the same plane as the registered
 * gallery wall. Its interior DEM remains outside this apron proposal.
 * F01/F02 have the main-house void too; G1/G2 need this explicit edge rule.
 */
export function isApronFacadeEdge(a:RoadPoint,b:RoadPoint):boolean {
  return ids.some(id=>{
    const facade=facades.find(f=>f.id===id)!,from=point(facade.from.value),to=point(facade.to.value)
    const dx=to[0]-from[0],dn=to[1]-from[1],squared=dx*dx+dn*dn,length=Math.sqrt(squared)
    return[a,b].every(p=>{
      const off=Math.abs(dx*(p[1]-from[1])-dn*(p[0]-from[0]))/length
      const t=((p[0]-from[0])*dx+(p[1]-from[1])*dn)/squared
      return off<1e-6&&t>=-1e-6&&t<=1+1e-6
    })
  })
}

const derivedWidthRange=[Math.min(...outlines.flatMap(o=>o.derivedWidths)),Math.max(...outlines.flatMap(o=>o.derivedWidths))]
export const apronProvenance={
  id:'wing-vinci/house-side-apron',manifestId:'vinci/house-side-apron',assetClass:'GENERATED',certainty:'assumed',
  source:['A-SITE','OSM','OSM-AREA','IGN'],facadeIds:ids,nominal_m:nominal,range_m:range,
  derivedWidthRange_m:derivedWidthRange,grossArea_m2:outlines.reduce((sum,o)=>sum+signedArea(o.points),0),
  licence:'OpenStreetMap contributors, ODbL 1.0; IGN, Licence Ouverte 2.0; original procedural reconstruction proposal, 2026-09-09.',
  derivation:'Join F01, F02, G2 and G1 facade endpoints to their nearest points on the retained road-cut west boundary, following every existing boundary corner between those projections. Hold the nominal A-SITE local grade at 1 m. Existing road, literal platforms, stairs, house and water retain priority. Keep the explicit southern road seam up to 0.3504 m and northern cut about 0.68 m; do not smooth into walls or invent a gallery interior floor. Packed earth excludes generated vegetation and ground dressing.',
  label:{
    en:'Proposed house-side apron. Its outline joins registered street facades to the nearest retained road-cut edge. Derived widths of 1.75–2.66 m are not surveyed apron measurements. Local grade: +1.00 m; scenario range: −0.50–2.50 m. Its historic extent and elevation remain unknown. The proposed nominal leaves 0.55 m below the street-window openings; existing stair and road levels retain priority, with explicit terminal retaining edges.',
    de:'Vorgeschlagener Vorbereich an der Hausseite. Sein Umriss verbindet die registrierten Straßenfassaden mit der nächstgelegenen Kante des beibehaltenen Straßeneinschnitts. Die abgeleiteten Breiten von 1,75–2,66 m sind keine vermessenen Maße dieses Vorbereichs. Lokale Höhe: +1,00 m; Szenariobereich: −0,50–2,50 m. Historische Ausdehnung und Höhe bleiben unbekannt. Die vorgeschlagene Nennhöhe lässt 0,55 m bis zu den Straßenfensteröffnungen frei; vorhandene Treppen- und Straßenhöhen haben Vorrang, mit ausdrücklich dargestellten Stützkanten an den Enden.',
  },
} as const

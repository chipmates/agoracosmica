/** Separate A-SITE access proposal, derived from the retained street and gate.
 * The supplied street-grade polygon and all IGN samples remain unchanged.
 * This module is inert until the terrain and rail explicitly consume it.
 */
import { feature, polygon, surveyedHeight } from './site'

export type RoadPoint = [number,number]
export interface RoadGradeBounds { minE:number;maxE:number;minN:number;maxN:number }
export interface RoadGradeRegion {
  id:string
  points:RoadPoint[]
  bounds:RoadGradeBounds
  levelAt:(e:number,n:number)=>number
  gradient:RoadPoint
  heightRange:readonly [number,number]
  certainty:'assumed'
}
export interface RoadGradeBoundary {
  from:RoadPoint;to:RoadPoint;fromHeight:number;toHeight:number
  side:'left'|'right'|'start'|'end'
}

const street=polygon('street'),original=polygon('street-grade'),steps=polygon('gate-steps')
const a=street[3]!,end:RoadPoint=[street[4]![0]!,street[4]![1]!]
const direction:RoadPoint=[end[0]-a[0]!,end[1]-a[1]!]
const length=Math.hypot(...direction)
const width=feature('street').width_m!.value
const nominal=feature('street-grade').height_m!.value
const range=(feature('street-grade').height_m!.range??[-.5,2.5]) as [number,number]
const normal:RoadPoint=[-direction[1]/length,direction[0]/length]
const endHeight=surveyedHeight(...end)
function intersection(from:number[],to:number[],side=0):RoadPoint {
  const edge:RoadPoint=[to[0]!-from[0]!,to[1]!-from[1]!]
  const origin:RoadPoint=[a[0]!+normal[0]*width/2*side,a[1]!+normal[1]*width/2*side]
  const determinant=direction[0]*edge[1]-direction[1]*edge[0]
  if(Math.abs(determinant)<1e-9)throw new Error('Registered road and crossing cannot be parallel')
  const t=((from[0]!-origin[0])*edge[1]-(from[1]!-origin[1])*edge[0])/determinant
  return[origin[0]+direction[0]*t,origin[1]+direction[1]*t]
}
const start=intersection(original[0]!,original[1]!)
const crossing=intersection(steps[0]!,steps[1]!)
const offset=(p:RoadPoint,side:number):RoadPoint=>[p[0]+normal[0]*width/2*side,p[1]+normal[1]*width/2*side]
// The retained terminal edge is slightly oblique to the road. Intersect each
// 5 m corridor side with that exact edge, retaining neither a gap nor overlap.
const firstLeft=intersection(original[0]!,original[1]!,1)
const firstRight=intersection(original[0]!,original[1]!,-1)
function region(id:string,from:RoadPoint,to:RoadPoint,z0:number,z1:number,first=false):RoadGradeRegion {
  const points=[first?firstLeft:offset(from,1),first?firstRight:offset(from,-1),offset(to,-1),offset(to,1)]
  const dx=to[0]-from[0],dn=to[1]-from[1],squared=dx*dx+dn*dn
  return {id,points,bounds:{minE:Math.min(...points.map(p=>p[0])),maxE:Math.max(...points.map(p=>p[0])),minN:Math.min(...points.map(p=>p[1])),maxN:Math.max(...points.map(p=>p[1]))},
    levelAt:(e,n)=>z0+(z1-z0)*Math.max(0,Math.min(1,((e-from[0])*dx+(n-from[1])*dn)/squared)),
    gradient:[dx*(z1-z0)/squared,dn*(z1-z0)/squared],
    heightRange:range,certainty:'assumed'}
}
const regions:RoadGradeRegion[]=[
  region('road-cut-to-gateway',start,crossing,nominal,nominal,true),
  region('road-cut-to-ign',crossing,end,nominal,endHeight),
]
const contains=(r:RoadGradeRegion,e:number,n:number):boolean=>
  e>=r.bounds.minE-1e-8&&e<=r.bounds.maxE+1e-8&&n>=r.bounds.minN-1e-8&&n<=r.bounds.maxN+1e-8&&
  r.points.every((p,i)=>{const q=r.points[(i+1)%r.points.length]!;return(q[0]-p[0])*(n-p[1])-(q[1]-p[1])*(e-p[0])>=-1e-8})

/** Two adjacent, convex, counter-clockwise 5 m-wide polygons. */
export function getRoadGradeRegions():RoadGradeRegion[] {return regions}
export function roadGradeAt(e:number,n:number):number|undefined {return regions.find(r=>contains(r,e,n))?.levelAt(e,n)}

/** Outer edges only: no duplicate internal face across the gateway crossing.
 * Compare these against neighbouring grade before emitting retaining faces.
 * The terminal centre matches IGN; its lateral edges are still an A section.
 */
export function getRoadGradeBoundaries():RoadGradeBoundary[] {
  const boundary:RoadGradeBoundary[]=[]
  for(const side of [-1,1]){
    for(const [from,to,z0,z1]of[[start,crossing,nominal,nominal],[crossing,end,nominal,endHeight]] as [RoadPoint,RoadPoint,number,number][])
      boundary.push({from:from===start?(side===1?firstLeft:firstRight):offset(from,side),to:offset(to,side),fromHeight:z0,toHeight:z1,side:side===1?'left':'right'})
  }
  boundary.push({from:firstRight,to:firstLeft,fromHeight:nominal,toHeight:nominal,side:'start'})
  boundary.push({from:offset(end,1),to:offset(end,-1),fromHeight:endHeight,toHeight:endHeight,side:'end'})
  return boundary
}

export const roadGradeProvenance={
  id:'wing-vinci/road-grade-extension',certainty:'assumed',class:'GENERATED',
  source:['OSM-AREA','A-SITE','IGN'],licence:'OpenStreetMap contributors, ODbL 1.0; IGN, Licence Ouverte 2.0; original procedural grade proposal, 2026-09-09.',
  start,crossing,end,width_m:width,nominal_m:nominal,range_m:range,endCentreNGF_m:endHeight+68.6,
  derivation:'Intersect the mapped Rue du Clos Lucé segment with the supplied street-grade terminal edge and the gate-steps axis. Retain mapped nominal road width 5 m, trimming its two side lines exactly against the original terminal edge. Hold the proposed 1 m local grade through the gate crossing, then interpolate to the bilinear IGN level at the next mapped road point. This is a separate reconstruction overlay; the original polygon and all 165 IGN samples are retained.',
  label:{
    en:`Road approach reconstructed. The alignment follows today's mapped street; the historic road level is unknown. Proposed local grade 1.00 m (range −0.50–2.50 m) continues through the gallery crossing, then joins the IGN centreline level ${endHeight.toFixed(3)} m at the next mapped point. Width 5.00 m (dossier range 3.50–6.50 m). The added cut is an exhibition proposal.`,
    de:`Rekonstruierter Straßenzugang. Die Trasse folgt der heute kartierten Straße; ihre historische Höhe ist unbekannt. Die vorgeschlagene lokale Höhe 1,00 m (Bereich −0,50–2,50 m) wird bis zum Galeriedurchgang fortgeführt und anschließend an die IGN-Mittelachsenhöhe ${endHeight.toFixed(3).replace('.',',')} m des nächsten kartierten Punkts angeschlossen. Breite 5,00 m (Dossierbereich 3,50–6,50 m). Der zusätzliche Einschnitt ist ein Ausstellungsvorschlag.`,
  },
} as const

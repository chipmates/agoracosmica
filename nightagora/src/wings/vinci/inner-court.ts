/** A separate proposed court connection, derived from the existing facade
 * chain and court edge. The IGN samples and supplied courtyard stay intact.
 * This module supplies data to terrain; it never imports the terrain factory.
 */
import {
  BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh,
  MeshStandardNodeMaterial, ShapeUtils, Vector2, Vector3,
} from 'three/webgpu'
import { cameraPosition, float, length, mx_noise_float, normalMap, positionWorld, smoothstep, vec2, vec3 } from 'three/tsl'
import type { TierName } from '../../stack/tier'
import { dossier, edgeDistance, feature, inside, polygon, type Feature, type Quantity } from './site'

export type CourtPoint = [east:number,north:number]
export interface InnerCourtRegion {
  id:string
  points:CourtPoint[]
  height:number
  kind:'apron'|'tread'|'landing'
}
interface Facade { id:string;from:Quantity<number[]>;to:Quantity<number[]> }
interface Threshold extends Feature {
  rise_m:Quantity<number>;tread_m:Quantity<number>;riser_m:Quantity<number>;count:Quantity<number>
}
const point=(p:number[]):CourtPoint=>[p[0]!,p[1]!]
const facades=(dossier as unknown as {facades:Facade[]}).facades
const facade=(id:string):Facade=>facades.find(f=>f.id===id)!
const facadeIds=['F18','CH0','CH1','CH2','ENTRY','F23','E-GABLE']
const court=polygon('courtyard').map(point)
const level=feature('courtyard').height_m!
const threshold=feature('court-threshold') as Threshold
const thresholdLine=polygon('court-threshold').map(point)
const entry=facade('ENTRY'),entryA=point(entry.from.value),entryB=point(entry.to.value)
const entryLength=Math.hypot(entryB[0]-entryA[0],entryB[1]-entryA[1])
const entryAxis:CourtPoint=[(entryB[0]-entryA[0])/entryLength,(entryB[1]-entryA[1])/entryLength]
const area=(points:CourtPoint[]):number=>points.reduce((sum,a,i)=>{
  const b=points[(i+1)%points.length]!
  return sum+a[0]*b[1]-b[0]*a[1]
},0)/2
const ccw=(points:CourtPoint[]):CourtPoint[]=>area(points)<0?[...points].reverse():points
const half=(a:CourtPoint,b:CourtPoint,p:CourtPoint):number=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])
const outline=ccw([
  court[3]!,court[2]!,point(facade('E-GABLE').to.value),point(facade('E-GABLE').from.value),
  point(facade('F23').from.value),point(entry.from.value),point(facade('CH2').from.value),
  point(facade('CH1').from.value),point(facade('CH0').from.value),point(facade('F18').from.value),
])
const triangles=ShapeUtils.triangulateShape(outline.map(p=>new Vector2(...p)),[])
  .map(indices=>ccw(indices.map(i=>outline[i]!)))

/** Convex intersection lets a nominal tread terminate at the actual chapel
 * and east-wall planes; neither the tread nor its retaining riser crosses them.
 */
function intersection(subject:CourtPoint[],boundary:CourtPoint[]):CourtPoint[] {
  let result=subject
  for(let edge=0;edge<boundary.length&&result.length;edge++){
    const a=boundary[edge]!,b=boundary[(edge+1)%boundary.length]!,next:CourtPoint[]=[]
    for(let i=0;i<result.length;i++){
      const p=result[i]!,q=result[(i+1)%result.length]!,dp=half(a,b,p),dq=half(a,b,q)
      if(dp>=-1e-8)next.push(p)
      if((dp>1e-8&&dq< -1e-8)||(dp< -1e-8&&dq>1e-8)){
        const t=dp/(dp-dq);next.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t])
      }
    }
    result=next.filter((p,i)=>{
      const prior=next[(i+next.length-1)%next.length]!
      return Math.hypot(p[0]-prior[0],p[1]-prior[1])>1e-8
    })
  }
  return result.length>=3&&Math.abs(area(result))>1e-8?ccw(result):[]
}

const stairA=thresholdLine[0]!,stairB=thresholdLine[1]!
const stairWidth=Math.hypot(stairB[0]-stairA[0],stairB[1]-stairA[1])
const outward:CourtPoint=[(stairB[1]-stairA[1])/stairWidth,-(stairB[0]-stairA[0])/stairWidth]
if((entryA[0]-stairA[0])*outward[0]+(entryA[1]-stairA[1])*outward[1]>0){outward[0]*=-1;outward[1]*=-1}
const shifted=(p:CourtPoint,distance:number):CourtPoint=>[p[0]+outward[0]*distance,p[1]+outward[1]*distance]
const projectToEntry=(p:CourtPoint):CourtPoint=>{
  const along=Math.max(0,Math.min(entryLength,(p[0]-entryA[0])*entryAxis[0]+(p[1]-entryA[1])*entryAxis[1]))
  return[entryA[0]+entryAxis[0]*along,entryA[1]+entryAxis[1]*along]
}
const stairCount=Math.round(threshold.count.value),tread=threshold.tread_m.value,rise=threshold.rise_m.value
const regions:InnerCourtRegion[]=triangles.map((points,i)=>({id:`inner-court-apron-${i}`,points,height:level.value,kind:'apron'}))
function addClipped(id:string,points:CourtPoint[],height:number,kind:InnerCourtRegion['kind']):void {
  for(const [i,triangle]of triangles.entries()){
    const clipped=intersection(ccw(points),triangle)
    if(clipped.length)regions.push({id:`${id}-${i}`,points:clipped,height,kind})
  }
}
for(let step=0;step<stairCount;step++){
  const far=(stairCount-step)*tread,near=far-tread
  addClipped(`inner-court-tread-${step+1}`,[shifted(stairA,far),shifted(stairB,far),shifted(stairB,near),shifted(stairA,near)],level.value+rise*(step+1)/stairCount,'tread')
}
addClipped('inner-court-landing',[stairA,stairB,projectToEntry(stairB),projectToEntry(stairA)],level.value+rise,'landing')

/** Ordered low to high priority. Insert before existing literal platforms and
 * gate connections. Every returned outline is convex, as terrain requires.
 */
export function getInnerCourtRegions():InnerCourtRegion[]{return regions}
export function getInnerCourtOutlines():Array<{id:string;points:CourtPoint[];height:number}>{
  return[{id:'inner-court-apron',points:outline,height:level.value}]
}
/** Skip any derived retaining face coincident with a registered facade. */
export function isInnerCourtFacadeEdge(a:CourtPoint,b:CourtPoint):boolean {
  return facadeIds.some(id=>{
    const f=facade(id),p=point(f.from.value),q=point(f.to.value),dx=q[0]-p[0],dn=q[1]-p[1],squared=dx*dx+dn*dn
    return[a,b].every(v=>Math.abs(half(p,q,v))/Math.sqrt(squared)<1e-6&&
      ((v[0]-p[0])*dx+(v[1]-p[1])*dn)/squared>=-1e-6&&
      ((v[0]-p[0])*dx+(v[1]-p[1])*dn)/squared<=1+1e-6)
  })
}

export const innerCourtProvenance={
  id:'wing-vinci/inner-court',manifestId:'vinci/inner-court',assetClass:'GENERATED',certainty:'assumed',
  source:['A-SITE','A-LAYOUT','A-HEIGHT','OSM','Q124'],facadeIds,
  nominal_m:level.value,range_m:level.range,grossArea_m2:area(outline),
  threshold:{width_m:stairWidth,rise_m:rise,riseRange_m:threshold.rise_m.range,
    count:stairCount,tread_m:tread,treadRange_m:threshold.tread_m.range,
    riser_m:rise/stairCount,riserRange_m:threshold.riser_m.range},
  derivation:'Close only the gap between the retained courtyard house-facing edge and F18, CH0, CH1, CH2, ENTRY, F23 and E-GABLE. Triangulate the concave 33.87 square metre outline at the existing court nominal. Treat the supplied threshold line as the upper-landing front edge, project its ends to ENTRY, and place five nominal treads outward, clipped to the recess. The line-to-facade landing placement is a declared interpretation. Raw IGN heights, the supplied court polygon and all masonry remain unchanged.',
  label:{
    en:'Reconstructed inner court. A derived 33.87 m² apron joins the proposed courtyard to the registered facades at local level 0.00 m, with the existing scenario range −0.60–0.60 m. The threshold proposal uses five 0.16 m risers and 0.30 m treads to a +0.80 m landing. Q124 constrains the connected court and steps; their exact historic extent, levels and finish remain unknown. IGN samples and the supplied courtyard outline are unchanged.',
    de:'Rekonstruierter innerer Hof. Ein abgeleiteter Vorbereich von 33,87 m² verbindet den vorgeschlagenen Hof mit den registrierten Fassaden auf der lokalen Höhe 0,00 m; der bestehende Szenariobereich beträgt −0,60–0,60 m. Der Schwellenvorschlag verwendet fünf Steigungen von 0,16 m und Auftritte von 0,30 m bis zu einem Podest auf +0,80 m. Q124 begrenzt die Interpretation des verbundenen Hofs und der Stufen; genaue historische Ausdehnung, Höhen und Oberflächen bleiben unbekannt. IGN-Höhenwerte und der vorgegebene Hofumriss bleiben unverändert.',
  },
} as const

export const courtDressingProvenance={
  manifestId:'vinci/inner-court',assetClass:'GENERATED',certainty:'conjectural',
  source:['A-SITE','A-LAYOUT','Q124'],
  recipe:'Seed 171019. Sparse four-face limestone chips, 0.025–0.075 m, concentrated toward court edges. Two shallow cart-wear traces 1.40 m apart with 0.08–0.14 m width. A proposed 0.08 m drainage seam leads from the lower stair toward the existing court centre. Stone tread wear varies within 0.008 m; continuous procedural quarry mottle, millimetre tooth and distance-filtered grain. No photographic texture or claim of surviving period wear.',
  label:{
    en:'Conjectural court finish. Gravel, cart traces, the narrow drainage seam and worn stone surfaces are museum dressing, not surviving evidence of 1517. Proposed chips span 0.025–0.075 m; cart traces are 1.40 m apart and the drainage seam is 0.08 m wide. The wear relief stays within 0.008 m.',
    de:'Vermutete Hofoberfläche. Kies, Wagenspuren, die schmale Entwässerungsfuge und abgenutzte Steinflächen sind museale Ausgestaltung, keine erhaltenen Belege von 1517. Vorgeschlagene Steinchen messen 0,025–0,075 m; Wagenspuren liegen 1,40 m auseinander, die Entwässerungsfuge ist 0,08 m breit. Das Abnutzungsrelief bleibt innerhalb von 0,008 m.',
  },
} as const

type HeightAt=(east:number,north:number)=>number
interface Batch {positions:number[];colours:number[]}
const batch=():Batch=>({positions:[],colours:[]})
function tri(target:Batch,a:Vector3,b:Vector3,c:Vector3,colour:Color):void {
  for(const p of[a,b,c]){target.positions.push(p.x,p.y,p.z);target.colours.push(colour.r,colour.g,colour.b)}
}
const world=(p:CourtPoint,height:number):Vector3=>new Vector3(p[0],height,-p[1])
function material():MeshStandardNodeMaterial {
  const result=new MeshStandardNodeMaterial({vertexColors:true,roughness:.94,side:DoubleSide})
  const p=positionWorld,pixel=length(p.dFdx()).add(length(p.dFdy())).max(.000001)
  const density=float(1).sub(smoothstep(6,38,length(p.sub(cameraPosition))))
  const mid=mx_noise_float(p.mul(17)).mul(smoothstep(1,3,float(.059).div(pixel)))
  const fine=mx_noise_float(p.mul(145)).mul(smoothstep(1,3,float(.007).div(pixel)))
  result.colorNode=vec3(1,1,1).mul(mx_noise_float(p.mul(.47)).mul(.10).add(1))
    .mul(mid.mul(density).mul(.12).add(1)).mul(fine.mul(density).mul(.07).add(1))
  result.roughnessNode=mid.mul(.055).add(.91)
  result.normalNode=normalMap(vec3(mid.mul(.024).add(.5),fine.mul(.012).add(.5),1),vec2(.35,.35))
  return result
}
function meshOf(source:Batch,name:string):Mesh {
  const geometry=new BufferGeometry()
  geometry.setAttribute('position',new Float32BufferAttribute(source.positions,3))
  geometry.setAttribute('color',new Float32BufferAttribute(source.colours,3))
  geometry.computeVertexNormals();geometry.computeBoundingSphere()
  const mesh=new Mesh(geometry,material());mesh.name=name;mesh.receiveShadow=true;mesh.castShadow=false
  mesh.userData['manifestId']='vinci/inner-court';mesh.userData['labelOccluder']=false
  return mesh
}

/** Supplemental surface detail only; physical court/stair levels come from
 * getInnerCourtRegions through the caller's single shared grade sampler.
 */
export function createInnerCourtDressing(heightAt:HeightAt,tier:TierName):Group {
  const stone=batch(),chips=batch(),wear=batch(),stoneColour=new Color('#a99f89')
  let seed=171019
  const random=():number=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
  const ground=(p:CourtPoint,lift=.008):Vector3=>world(p,heightAt(...p)+lift)
  const stonePoint=(p:CourtPoint,height:number):Vector3=>{
    const along=(p[0]-entryA[0])*entryAxis[0]+(p[1]-entryA[1])*entryAxis[1]
    const hollow=Math.exp(-(((along-.95)/.48)**2))
    return world(p,height+.010-hollow*.008)
  }
  for(const region of regions.filter(r=>r.kind!=='apron')){
    const centre:CourtPoint=[region.points.reduce((sum,p)=>sum+p[0],0)/region.points.length,region.points.reduce((sum,p)=>sum+p[1],0)/region.points.length]
    // The front edges need real intermediate vertices for the shallow worn
    // hollow to affect the silhouette, not only the centre of a flat fan.
    for(let i=0;i<region.points.length;i++){
      const a=region.points[i]!,b=region.points[(i+1)%region.points.length]!,count=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.10)
      const at=(t:number):CourtPoint=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]
      for(let j=0;j<count;j++)tri(stone,stonePoint(at(j/count),region.height),stonePoint(at((j+1)/count),region.height),stonePoint(centre,region.height),stoneColour)
    }
  }
  const envelope=dossier.site.build_envelope.map(p=>p.value)
  const hardGround=(p:CourtPoint):boolean=>(inside(...p,court)||inside(...p,outline))&&
    !inside(...p,envelope)&&edgeDistance(...p,envelope)>.22&&Math.abs(heightAt(...p)-level.value)<.02
  const minE=Math.min(...court.map(p=>p[0]),...outline.map(p=>p[0])),maxE=Math.max(...court.map(p=>p[0]),...outline.map(p=>p[0]))
  const minN=Math.min(...court.map(p=>p[1]),...outline.map(p=>p[1])),maxN=Math.max(...court.map(p=>p[1]),...outline.map(p=>p[1]))
  const chipCount=tier==='calm'?240:420
  let placed=0
  for(let attempt=0;attempt<chipCount*18&&placed<chipCount;attempt++){
    const p:CourtPoint=[minE+(maxE-minE)*random(),minN+(maxN-minN)*random()]
    if(!hardGround(p))continue
    const edge=Math.min(edgeDistance(...p,court),edgeDistance(...p,outline))
    if(random()>.20+.65*Math.exp(-edge/1.3))continue
    const size=.025+random()*.05,angle=random()*Math.PI*2
    const corners=Array.from({length:4},(_,i):CourtPoint=>{
      const a=angle+i*Math.PI/2,r=size*(i%2?.40:.65)
      return[p[0]+Math.cos(a)*r,p[1]+Math.sin(a)*r]
    })
    if(corners.some(c=>!hardGround(c)))continue
    const top=ground(p,size*.28),colour=new Color('#b4aa94').multiplyScalar(.78+random()*.35)
    for(let i=0;i<4;i++)tri(chips,ground(corners[i]!),ground(corners[(i+1)%4]!),top,colour.clone().multiplyScalar(.86+i*.04))
    placed++
  }
  function ribbon(from:CourtPoint,to:CourtPoint,width:number,colour:Color,segments:number):void {
    const dx=to[0]-from[0],dn=to[1]-from[1],distance=Math.hypot(dx,dn)
    const across:CourtPoint=[-dn/distance,dx/distance]
    for(let i=0;i<segments;i++){
      const points=[i/segments,(i+1)/segments].map(t=>{
        const sway=Math.sin(t*13)*.015+Math.sin(t*71)*.008,w=width*(.78+.15*Math.sin(t*19)+.07*Math.sin(t*83))
        return[-1,1].map(sign=>[from[0]+dx*t+across[0]*(sway+sign*w/2),from[1]+dn*t+across[1]*(sway+sign*w/2)] as CourtPoint)
      })
      const a=points[0]![0]!,b=points[0]![1]!,c=points[1]![1]!,d=points[1]![0]!
      if(![a,b,c,d].every(hardGround))continue
      tri(wear,ground(a,.003),ground(b,.003),ground(c,.003),colour)
      tri(wear,ground(a,.003),ground(c,.003),ground(d,.003),colour)
    }
  }
  const axisLength=Math.hypot(court[1]![0]-court[0]![0],court[1]![1]-court[0]![1])
  const along:CourtPoint=[(court[1]![0]-court[0]![0])/axisLength,(court[1]![1]-court[0]![1])/axisLength]
  const inward:CourtPoint=[-along[1],along[0]]
  for(const offset of[-.7,.7]){
    const at=(t:number):CourtPoint=>[court[0]![0]+along[0]*axisLength*t+inward[0]*(3.1+offset),court[0]![1]+along[1]*axisLength*t+inward[1]*(3.1+offset)]
    ribbon(at(.12),at(.89),.11,new Color('#8f8068'),110)
  }
  const centre:CourtPoint=[court.reduce((s,p)=>s+p[0],0)/court.length,court.reduce((s,p)=>s+p[1],0)/court.length]
  const foot=shifted([(stairA[0]+stairB[0])/2,(stairA[1]+stairB[1])/2],stairCount*tread+.08)
  ribbon(foot,centre,.08,new Color('#696651'),24)
  const group=new Group();group.name='vinci generated inner court dressing'
  group.userData={...courtDressingProvenance,triangles:(stone.positions.length+chips.positions.length+wear.positions.length)/9,placedChips:placed}
  for(const [source,name]of[[stone,'tread stone'],[chips,'court gravel'],[wear,'court wear and drainage']] as const){
    if(source.positions.length)group.add(meshOf(source,`vinci/inner-court/${name}`))
  }
  return group
}

/** Separate A-SITE/A-OPENING passage proposal. The retained stair is the
 * floor datum; this module adds construction around it without regrading.
 */
import { BufferGeometry, Float32BufferAttribute, Group, Mesh } from 'three/webgpu'
import { float, floor, length, mix, smoothstep, uv } from 'three/tsl'
import type { TierName } from '../../stack/tier'
import { dossier, feature, polygon, surveyedHeight, type Quantity } from './site'
import { createShellSurface, prepareSurfaceGeometry, type ShellSurfaceKind } from './surface'
import { timberFaceCoordinates } from './timber'

type Point = [east:number,north:number]
type Point3 = [east:number,north:number,height:number]
type UV = [number,number]
interface Facade { id:string;from:Quantity<number[]>;to:Quantity<number[]>;length_m:Quantity<number>;
  openings:{id:string;from_m:Quantity<number>;width_m:Quantity<number>;height_m:Quantity<number>}[] }
interface Stair { width_m:Quantity<number>;count:Quantity<number>;tread_m:Quantity<number> }
const facades=(dossier as unknown as {facades:Facade[]}).facades
const street=facades.find(f=>f.id==='G1')!,court=facades.find(f=>f.id==='G5')!
const gate=court.openings.find(o=>o.id==='gallery-gateway')!
const stair=feature('gate-steps') as unknown as Stair,line=polygon('gate-steps')
const a:Point=[line[0]![0]!,line[0]![1]!],b:Point=[line[1]![0]!,line[1]![1]!]
const stairLength=Math.hypot(b[0]-a[0],b[1]-a[1]),halfWidth=stair.width_m.value/2
const along:Point=[(b[0]-a[0])/stairLength,(b[1]-a[1])/stairLength]
const across:Point=[-along[1],along[0]],upper=line[0]![2]!,lower=line[1]![2]!
const count=Math.round(stair.count.value),tread=stair.tread_m.value
const landing=(stairLength-count*tread)/2
const HEAD=3.20,SOFFIT_THICKNESS=.16,RETURN_THICKNESS=.24
const EPS=1e-6
const at=(distance:number,offset:number,height:number):Point3=>[
  a[0]+along[0]*distance+across[0]*offset,a[1]+along[1]*distance+across[1]*offset,height,
]
const distanceAt=(p:Point):number=>(p[0]-a[0])*along[0]+(p[1]-a[1])*along[1]
const offsetAt=(p:Point):number=>(p[0]-a[0])*across[0]+(p[1]-a[1])*across[1]
const xy=(p:Point3):Point=>[p[0],p[1]]
const facadeAxis=(f:Facade):Point=>[(f.to.value[0]!-f.from.value[0]!)/f.length_m.value,
  (f.to.value[1]!-f.from.value[1]!)/f.length_m.value]
const facadeAt=(f:Facade,distance:number):Point=>{
  const axis=facadeAxis(f)
  return[f.from.value[0]!+axis[0]*distance,f.from.value[1]!+axis[1]*distance]
}
/** Intersect a line at a fixed stair offset with the actual facade plane. */
function crossing(from:number[],to:number[],offset:number):number {
  const dx=to[0]!-from[0]!,dn=to[1]!-from[1]!,p=at(0,offset,0)
  return(dx*(p[1]-from[1]!)-dn*(p[0]-from[0]!))/(dn*along[0]-dx*along[1])
}
const mouth=(f:Facade,offset:number):number=>crossing(f.from.value,f.to.value,offset)
const courtCentre=facadeAt(court,gate.from_m.value+gate.width_m.value/2)
const streetAxis=facadeAxis(street)
const streetCentre=(courtCentre[0]-street.from.value[0]!)*streetAxis[0]+(courtCentre[1]-street.from.value[1]!)*streetAxis[1]
function apertureEnds(f:Facade,centre:number):Point[] {
  return[-1,1].map(side=>facadeAt(f,centre+side*gate.width_m.value/2)).sort((p,q)=>offsetAt(p)-offsetAt(q))
}
const streetEnds=apertureEnds(street,streetCentre),courtEnds=apertureEnds(court,gate.from_m.value+gate.width_m.value/2)
const courtOutline=polygon('courtyard')
const returnEnd=(offset:number):number=>crossing(courtOutline[1]!,courtOutline[2]!,offset)
const sides=[-1,1].map((side,index)=>({side,offset:side*halfWidth,
  start:mouth(street,side*halfWidth),mouth:mouth(court,side*halfWidth),end:returnEnd(side*halfWidth),
  streetOuter:streetEnds[index]!,courtOuter:courtEnds[index]!,
}))

/** Call on each already-split terrain edge. Only the exact two lined stair
 * sides between G1 and the court boundary are owned here; risers, transverse
 * cuts, the road and every other DEM edge retain their existing treatment.
 */
export function isLinedGateEdge(start:Point,end:Point):boolean {
  return sides.some(side=>[start,end].every(p=>Math.abs(offsetAt(p)-side.offset)<EPS&&
    distanceAt(p)>=side.start-EPS&&distanceAt(p)<=side.end+EPS))
}

export const gatePassageProvenance={
  id:'wing-vinci/gate-passage',manifestId:'vinci/gate-passage',assetClass:'GENERATED',certainty:'assumed',
  source:['A-SITE','A-LAYOUT','A-OPENING','OSM-AREA','IGN','Q134'],facadeIds:['G1','G5'],
  licence:'OpenStreetMap contributors, ODbL 1.0; IGN, Licence Ouverte 2.0; original procedural reconstruction proposal, 2026-09-09.',
  dimensions:{clearWidth_m:stair.width_m.value,apertureWidth_m:gate.width_m.value,
    apertureWidthRange_m:gate.width_m.range,head_m:HEAD,headRange_m:gate.height_m.range,
    soffitThickness_m:SOFFIT_THICKNESS,returnThickness_m:RETURN_THICKNESS,
    streetFloor_m:upper,courtFloor_m:lower,streetHeadroom_m:HEAD-upper,
    stairLength_m:stairLength,count,tread_m:tread,riser_m:(upper-lower)/count,landing_m:landing,
    leaf:{width_m:2.50,height_m:2.45,thickness_m:.065,bottom_m:.06,openAngle_deg:90,
      hingeDistance_m:Math.max(...sides.map(side=>side.end))+.02}},
  derivation:'Project the registered G5 gate centre onto G1, matching the shell cut. Intersect both facade planes with the retained 2.60 m stair sides. Solid masonry fills the derived 0.23–0.37 m jamb-to-lining intervals. Six 0.30 m treads and two 0.500012 m landings retain every existing elevation from +1.00 to 0.00 m. The common +3.20 m head is an explicit choice inside the supplied 2.38–3.22 m opening-height scenario, giving 2.20 m road-side headroom. Masonry returns terminate exactly at the original courtyard edge and retain the surrounding IGN crest. A single proposed 2.50 × 2.45 × 0.065 m oak leaf hinges at the outer end of the court-mouth return and opens 90 degrees into the level court, outside the clear stair corridor. No source establishes these passage details in 1517.',
  recipe:'Procedural tuffeau quarry mottle, centimetre grain and millimetre pores; metre weathering, centimetre timber structure and submillimetre fibres/checks from createShellSurface. Broad side-face tone is 0.62 of the inherited stone response. Individual vertical boards, cross rails, brace and hinge blocks have member-local metre UVs. No photograph or imported bitmap is sampled. Threshold surfaces use polygon offset at the existing grade, not a raised floor.',
  label:{
    en:'Reconstructed gate passage. The 2.60 m clear stair and its six 0.1667 m risers retain the proposed +1.00 to 0.00 m descent. Masonry lining, a common +3.20 m head (scenario 2.38–3.22 m), stone thresholds and an outward-open oak leaf are explicit museum proposals. The leaf is 2.50 × 2.45 × 0.065 m (assumed ranges 2.20–2.80 × 2.20–2.65 × 0.045–0.085 m); lining thickness .24 m [.18–.30], soffit .16 m [.12–.22] are construction proposals. Q134 constrains the gallery and timber-gate interpretation, not these dimensions or their presence in 1517. Surrounding IGN heights remain unchanged.',
    de:'Rekonstruierter Tordurchgang. Die 2,60 m lichte Treppe und ihre sechs Steigungen von 0,1667 m behalten den vorgeschlagenen Abstieg von +1,00 auf 0,00 m bei. Mauerwerksauskleidung, eine gemeinsame Durchgangsoberkante auf +3,20 m (Szenario 2,38–3,22 m), Steinschwellen und ein nach außen geöffnetes Eichentor sind ausdrückliche museale Vorschläge. Der Torflügel misst 2,50 × 2,45 × 0,065 m (angenommene Bereiche 2,20–2,80 × 2,20–2,65 × 0,045–0,085 m); Auskleidung 0,24 m [0,18–0,30] und Decke 0,16 m [0,12–0,22] sind Konstruktionsvorschläge. Q134 begrenzt die Interpretation von Galerie und Holztor, belegt jedoch weder diese Maße noch ihren Bestand im Jahr 1517. Die umgebenden IGN-Höhen bleiben unverändert.',
  },
} as const

class Batch {
  positions:number[]=[];uvs:number[]=[];tones:number[]=[];roles:number[]=[]
  constructor(readonly kind:ShellSurfaceKind){}
  quad(points:Point3[],normal:Point3,tone=1,timberAxis?:Point3):void {
    const p=points[0]!,q=points[1]!,r=points[2]!
    const u=q.map((v,i)=>v-p[i]!),v=r.map((x,i)=>x-p[i]!)
    const n=[u[1]!*v[2]!-u[2]!*v[1]!,u[2]!*v[0]!-u[0]!*v[2]!,u[0]!*v[1]!-u[1]!*v[0]!]
    if(n.reduce((sum,x,i)=>sum+x*normal[i]!,0)<0)points=[...points].reverse()
    let coordinates:UV[],role=0
    if(timberAxis){const frame=timberFaceCoordinates(points,points[0]!,timberAxis);coordinates=frame.uv;role=frame.endGrain?3:0}
    else {const start=points[0]!,next=points[1]!,length=Math.hypot(next[0]-start[0],next[1]-start[1],next[2]-start[2]);
      const axis=next.map((x,i)=>(x-start[i]!)/length),cross=[normal[1]*axis[2]!-normal[2]*axis[1]!,normal[2]*axis[0]!-normal[0]*axis[2]!,normal[0]*axis[1]!-normal[1]*axis[0]!]
      coordinates=points.map(point=>[point.reduce((sum,x,i)=>sum+(x-start[i]!)*axis[i]!,0),point.reduce((sum,x,i)=>sum+(x-start[i]!)*cross[i]!,0)])}
    for(const i of[0,1,2,0,2,3]){const point=points[i]!;this.positions.push(point[0],point[2],-point[1]);this.uvs.push(...coordinates[i]!);this.tones.push(tone);this.roles.push(role)}
  }
}

/** Extruded quadrilateral with individually oriented, metre-scaled faces. */
function prism(batch:Batch,outline:Point[],bottom:number,top:number,tone=1,axis?:Point3):void {
  batch.quad(outline.map(p=>[...p,top]),[0,0,1],tone,axis)
  batch.quad(outline.map(p=>[...p,bottom]),[0,0,-1],tone,axis)
  const centre:Point=[outline.reduce((sum,p)=>sum+p[0],0)/outline.length,outline.reduce((sum,p)=>sum+p[1],0)/outline.length]
  for(let i=0;i<outline.length;i++){
    const p=outline[i]!,q=outline[(i+1)%outline.length]!,dx=q[0]-p[0],dn=q[1]-p[1],length=Math.hypot(dx,dn)
    let normal:Point3=[dn/length,-dx/length,0]
    if(((p[0]+q[0])/2-centre[0])*normal[0]+((p[1]+q[1])/2-centre[1])*normal[1]<0)normal=[-normal[0],-normal[1],0]
    batch.quad([[...p,bottom],[...q,bottom],[...q,top],[...p,top]],normal,tone,axis)
  }
}
function rectangle(from:number,to:number,left:number,right:number):Point[] {
  return[xy(at(from,left,0)),xy(at(to,left,0)),xy(at(to,right,0)),xy(at(from,right,0))]
}
function member(batch:Batch,s0:number,s1:number,c0:number,c1:number,z0:number,z1:number,axis:Point3):void {
  prism(batch,rectangle(s0,s1,c0,c1),z0,z1,1,axis)
}

export function createGatePassage(tier:TierName):Group {
  const lining=new Batch('stone'),threshold=new Batch('stone'),oak=new Batch('oak'),hardware=new Batch('stone')
  for(const side of sides){
    const innerStreet=xy(at(side.start,side.offset,0)),innerCourt=xy(at(side.mouth,side.offset,0))
    prism(lining,[innerStreet,innerCourt,side.courtOuter,side.streetOuter],lower,HEAD,1)
    // The exposed court return follows the actual cut crest, with a flat
    // cap set just above its maximum; the DEM and floor are not modified.
    const outer=side.offset+side.side*RETURN_THICKNESS
    const crest=Math.max(surveyedHeight(...xy(at(side.mouth,side.offset,0))),surveyedHeight(...xy(at(side.end,side.offset,0))))+.035
    prism(lining,rectangle(side.mouth,side.end,Math.min(side.offset,outer),Math.max(side.offset,outer)),lower,crest,.94)
  }
  const ceiling=[xy(at(sides[0]!.start,-halfWidth,0)),xy(at(sides[1]!.start,halfWidth,0)),
    xy(at(sides[1]!.mouth,halfWidth,0)),xy(at(sides[0]!.mouth,-halfWidth,0))]
  prism(lining,ceiling,HEAD,HEAD+SOFFIT_THICKNESS,.92)
  const walk=(from:number,to:number,height:number):void=>threshold.quad(rectangle(from,to,-halfWidth,halfWidth).map(p=>[...p,height]),[0,0,1],.96)
  walk(0,landing,upper)
  for(let step=0;step<count;step++){
    const from=landing+step*tread,to=from+tread,height=upper+(lower-upper)*(step+1)/count
    walk(from,to,height)
    threshold.quad([at(from,-halfWidth,height),at(from,halfWidth,height),at(from,halfWidth,height+(upper-lower)/count),at(from,-halfWidth,height+(upper-lower)/count)],[along[0],along[1],0],.93)
  }
  walk(stairLength-landing,stairLength,lower)
  threshold.quad([at(stairLength,-halfWidth,lower),at(stairLength,halfWidth,lower),
    at(sides[1]!.end,halfWidth,lower),at(sides[0]!.end,-halfWidth,lower)],[0,0,1],.94)

  // One full-width gate leaf hinges at the outer tip of the north return,
  // wholly outside the clear route and masonry. Its lower edge clears level
  // zero by 60 mm; opening outward avoids all six rising stair treads.
  const hinge=Math.max(...sides.map(side=>side.end))+.02,leafLength=2.50,leafBottom=lower+.06,leafTop=leafBottom+2.45
  const leafCentre=-halfWidth-.11,leafHalf=.065/2,boards=tier==='calm'?8:10
  for(let board=0;board<boards;board++){
    const s0=hinge+board*leafLength/boards+.0015,s1=hinge+(board+1)*leafLength/boards-.0015
    member(oak,s0,s1,leafCentre-leafHalf,leafCentre+leafHalf,leafBottom,leafTop,[0,0,1])
  }
  for(const h of[leafBottom+.36,leafTop-.36])member(oak,hinge+.035,hinge+leafLength-.035,
    leafCentre+leafHalf,leafCentre+leafHalf+.055,h-.055,h+.055,[along[0],along[1],0])
  // The diagonal brace is a vertical rectangle extruded across the leaf.
  const braceLow=leafBottom+.44,braceHigh=leafTop-.44,s0=hinge+.12,s1=hinge+leafLength-.12
  const low0=at(s0,leafCentre+leafHalf+.058,braceLow-.05),low1=at(s1,leafCentre+leafHalf+.058,braceHigh-.05)
  const high1=at(s1,leafCentre+leafHalf+.058,braceHigh+.05),high0=at(s0,leafCentre+leafHalf+.058,braceLow+.05)
  const braceAxis:Point3=[along[0]*(s1-s0),along[1]*(s1-s0),braceHigh-braceLow]
  oak.quad([low0,low1,high1,high0],[across[0],across[1],0],1,braceAxis)
  for(const h of[leafBottom+.30,leafTop-.30]){
    member(hardware,hinge-.045,hinge+.06,-halfWidth-.16,-halfWidth-.015,h-.10,h+.10,[0,0,1])
    member(hardware,hinge+.02,hinge+.52,leafCentre+leafHalf+.058,leafCentre+leafHalf+.077,h-.026,h+.026,[along[0],along[1],0])
  }

  const group=new Group();group.name='wing-vinci/gate-passage'
  for(const [batch,name,darken,surfaceOnly]of[[lining,'masonry lining',.62,false],[threshold,'stone thresholds',1,true],
    [oak,'open oak gate',1,false],[hardware,'gate ironwork',.25,false]] as const){
    const geometry=new BufferGeometry()
    geometry.setAttribute('position',new Float32BufferAttribute(batch.positions,3))
    geometry.setAttribute('uv',new Float32BufferAttribute(batch.uvs,2))
    geometry.setAttribute('tone',new Float32BufferAttribute(batch.tones,1))
    geometry.computeVertexNormals();geometry.computeBoundingSphere()
    prepareSurfaceGeometry(geometry,batch.kind,batch.roles)
    const material=createShellSurface(batch.kind)
    material.colorNode=material.colorNode!.mul(darken)
    if(name==='masonry lining'){
      const U=uv(),row=floor(U.y.div(.28)),course=U.y.div(.28).fract()
      const head=U.x.div(.62).add(row.mod(2).mul(.5)).fract()
      const edge=course.min(float(1).sub(course)).mul(.28).min(head.min(float(1).sub(head)).mul(.62))
      const pixel=length(U.dFdx()).add(length(U.dFdy())).mul(.6).max(.002)
      const face=smoothstep(float(.006).sub(pixel),float(.006).add(pixel),edge)
      material.colorNode=material.colorNode!.mul(mix(float(.70),float(1),face))
    }
    if(name==='gate ironwork'){material.metalness=.55;material.roughness=.76;material.normalNode=null;material.roughnessNode=null}
    if(surfaceOnly){material.polygonOffset=true;material.polygonOffsetFactor=-1;material.polygonOffsetUnits=-2}
    const mesh=new Mesh(geometry,material);mesh.name=`wing-vinci/gate-passage/${name}`
    mesh.castShadow=!surfaceOnly;mesh.receiveShadow=true;mesh.userData={manifestId:'vinci/gate-passage',labelOccluder:!surfaceOnly}
    group.add(mesh)
  }
  group.userData={...gatePassageProvenance,tier,triangles:[lining,threshold,oak,hardware].reduce((sum,batch)=>sum+batch.positions.length/9,0),
    suppressibleEdges:sides.map(side=>({from:xy(at(side.start,side.offset,0)),to:xy(at(side.end,side.offset,0))}))}
  return group
}

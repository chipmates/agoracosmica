/** Unfurnished threshold envelope from the existing A-LAYOUT entry polygon.
 * It closes the omitted structure behind the exterior doorway. The room's
 * identity, fittings and occupation are not reconstructed by this module.
 */
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardNodeMaterial } from 'three/webgpu'
import * as TSL from 'three/tsl'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const {attribute,float,mx_noise_float,positionWorld,vec3}=TSL as unknown as Record<string,any>
import { createEntryMineralSurface } from './entry-mineral-surface'
import type { TierName } from '../../stack/tier'
import { dossier, type Quantity } from './site'
import { createShellSurface, prepareSurfaceGeometry } from './surface'
import { timberFaceCoordinates } from './timber'
import { applyPassageLight, passageLight } from './house-hall'

type Point = [east:number,north:number]
type Point3 = [east:number,north:number,height:number]
type UV = [number,number]
interface Portal { id:string; wall:string; from_m:Quantity<number>; width_m:Quantity<number>;
  sill_m:Quantity<number>; height_m:Quantity<number>; connects_to?:string }
interface Room { id:string; polygon:Quantity<Point>[]; height_m:Quantity<number>;
  width_m:Quantity<number>; depth_m:Quantity<number>; openings:Portal[];
  ceiling:{beam_spacing_m:Quantity<number>;beam_section_m:Quantity<Point>} }
interface Level { id:string; level_m:Quantity<number>; slab_m:Quantity<number>; rooms:Room[] }
interface Wall {id:string;facade_id?:string;from:Quantity<Point>;to:Quantity<Point>;thickness_m:Quantity<number>}
interface EntryDossier { floors:Level[];walls:Wall[];
  materials:{id:string;colour_srgb:string;roughness:Quantity<number>}[];
  interior_detail_parameters:{terracotta_tile_m:Quantity<number>;tile_joint_m:Quantity<number>} }
const spec=dossier as unknown as EntryDossier
const ground=spec.floors.find(f=>f.id==='ground')!,first=spec.floors.find(f=>f.id==='first')!
const entry=ground.rooms.find(r=>r.id==='entry')!,outline=entry.polygon.map(p=>p.value)
const floorZ=ground.level_m.value,ceilingZ=floorZ+entry.height_m.value,upperZ=first.level_m.value
const slab=ground.slab_m.value,beamWidth=entry.ceiling.beam_section_m.value[0]
const beamDepth=entry.ceiling.beam_section_m.value[1],beamSpacing=entry.ceiling.beam_spacing_m.value
const tileSize=spec.interior_detail_parameters.terracotta_tile_m.value
const tileJoint=spec.interior_detail_parameters.tile_joint_m.value
const range=(q:Quantity<number>):number[]=>q.range??[q.value,q.value]
const wallFor=(letter:string):Wall=>spec.walls.find(w=>w.id===`entry:w${letter}`)!
const exterior=spec.walls.find(w=>w.facade_id==='ENTRY')!
const interpolate=(a:Point,b:Point,t:number):Point=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]
const centroid:Point=[outline.reduce((s,p)=>s+p[0],0)/4,outline.reduce((s,p)=>s+p[1],0)/4]

/** A small registration seam joins the supplied room boundary to the real
 * inner face of ENTRY. Its depth is derived, not a replacement room layout.
 */
const exteriorLength=Math.hypot(exterior.to.value[0]-exterior.from.value[0],exterior.to.value[1]-exterior.from.value[1])
const exteriorAxis:Point=[(exterior.to.value[0]-exterior.from.value[0])/exteriorLength,
  (exterior.to.value[1]-exterior.from.value[1])/exteriorLength]
const exteriorNormal:Point=[exteriorAxis[1],-exteriorAxis[0]]
function innerFacadeProjection(p:Point):Point {
  const distance=(p[0]-exterior.from.value[0])*exteriorNormal[0]+(p[1]-exterior.from.value[1])*exteriorNormal[1]
  const shift=-exterior.thickness_m.value-distance
  return[p[0]+exteriorNormal[0]*shift,p[1]+exteriorNormal[1]*shift]
}
const frontA=outline[0]!,frontB=outline[1]!
const joinOutline:Point[]=[innerFacadeProjection(frontA),innerFacadeProjection(frontB),frontB,frontA]
const joinDepth=joinOutline.slice(0,2).map((p,i)=>Math.hypot(p[0]-outline[i]![0],p[1]-outline[i]![1]))

export const entryPassageProvenance={
  id:'wing-vinci/entry-passage',manifestId:'vinci/entry-passage',assetClass:'GENERATED',certainty:'assumed',
  source:['A-LAYOUT','A-HEIGHT','A-MASONRY','A-MATERIAL','Q124','REGISTRATION'],
  licence:'Original procedural threshold reconstruction proposal; no photograph or imported bitmap is sampled.',
  dimensions:{polygon:entry.polygon,floor_m:ground.level_m,ceiling_m:ceilingZ,firstFloor_m:first.level_m,
    clearHeight_m:entry.height_m,width_m:entry.width_m,depth_m:entry.depth_m,slab_m:ground.slab_m,
    partitionThickness_m:wallFor('C').thickness_m,beamSpacing_m:entry.ceiling.beam_spacing_m,
    beamSection_m:entry.ceiling.beam_section_m,tile_m:spec.interior_detail_parameters.terracotta_tile_m,
    tileJoint_m:spec.interior_detail_parameters.tile_joint_m,registrationJoinDepth_m:joinDepth,
    portals:entry.openings.filter(o=>o.connects_to)},
  derivation:'The supplied entry polygon retains its four coordinates and 6 m depth. Its three non-exterior partitions are extruded outward by their supplied 0.25 m thickness; the rear partition has no aperture and both side portals retain their listed cuts. The floor is +0.80 m, structural ceiling underside +4.00 m and next finished floor +4.30 m. Oak beams are flush with the limewashed underside, occupying the lower 0.23 m of the 0.30 m floor assembly. The small plan-registration seam at the facade is closed by continuing the floor, ceiling and end returns to the existing inner shell plane; no exterior opening is generated twice.',
  recipe:'Original warm limewash over the proposed brick partitions; rough unglazed terracotta tiles and oak ceiling members. Metre mottle, centimetre mineral grain and millimetre pores are derivative-filtered. Tile size and joints use A-MASONRY nominals. Oak uses the existing member-local procedural timber surface. No furnishings, painted image, camera-facing screen or shortened passage is added.',
  label:{
    en:'Proposed entrance passage structure, A-LAYOUT. Its supplied 3.35 × 6.00 m clear plan (ranges 2.68–4.02 × 4.80–7.20 m; polygon displacement bound ±1 m) is retained. Floor +0.80 m [0.30–1.30], clear height 3.20 m [2.85–3.55], ceiling underside +4.00 m derived, next floor +4.30 m [3.80–4.80], slab .30 m [.20–.45]. Partitions .25 m [.15–.40] preserve the two 1.00 × 2.20 m side portals [.85–1.15 × 1.98–2.42]; their start distances 1.5000/1.5001 m retain ±.20 m ranges, their zero sills [0–.15 m]. Oak beams .18 × .23 m (each ±.05), spacing .60 m [.40–.80]; terracotta tiles .22 m [.16–.28], joints .008 m [.004–.012]. A-HEIGHT, A-MASONRY and A-MATERIAL supply these construction proposals. Warm limewash over brick and a flush beam/infill underside are explicit finish assumptions. Q124 constrains the exterior entry, not this plan or its presence in 1517. This is an unfurnished threshold enclosure, not a claim to reconstruct an occupied room.',
    de:'Vorgeschlagene Struktur des Eingangsgangs, A-LAYOUT. Der vorgegebene lichte Grundriss von 3,35 × 6,00 m (Bereiche 2,68–4,02 × 4,80–7,20 m; Verschiebungsgrenze des Polygons ±1 m) bleibt erhalten. Boden +0,80 m [0,30–1,30], lichte Höhe 3,20 m [2,85–3,55], abgeleitete Deckenunterkante +4,00 m, nächster Boden +4,30 m [3,80–4,80], Deckenstärke 0,30 m [0,20–0,45]. Wände 0,25 m [0,15–0,40] behalten beide seitlichen Durchgänge von 1,00 × 2,20 m [0,85–1,15 × 1,98–2,42]; deren Anfangsabstände 1,5000/1,5001 m behalten Bereiche von ±0,20 m und die Schwellen auf null [0–0,15 m]. Eichenbalken 0,18 × 0,23 m (je ±0,05), Abstand 0,60 m [0,40–0,80]; Terrakottaplatten 0,22 m [0,16–0,28], Fugen 0,008 m [0,004–0,012]. A-HEIGHT, A-MASONRY und A-MATERIAL liefern diese Konstruktionsvorschläge. Warme Kalktünche über Ziegeln sowie bündige Balken und Ausfachungen sind ausdrückliche Oberflächenannahmen. Q124 begrenzt den äußeren Eingang, belegt aber weder diesen Grundriss noch dessen Bestand 1517. Dies ist eine unmöblierte bauliche Einfassung der Schwelle, keine Rekonstruktion eines bewohnten Raums.',
  },
} as const

class Batch {
  positions:number[]=[];uvs:number[]=[];tones:number[]=[];roles:number[]=[];light:number[]=[]
  constructor(readonly kind:'plaster'|'terracotta'|'oak'){}
  quad(points:Point3[],normal:Point3,axis?:Point3):void {
    const a=points[0]!,b=points[1]!,c=points[2]!
    const u=b.map((v,i)=>v-a[i]!),v=c.map((x,i)=>x-a[i]!)
    const n=[u[1]!*v[2]!-u[2]!*v[1]!,u[2]!*v[0]!-u[0]!*v[2]!,u[0]!*v[1]!-u[1]!*v[0]!]
    if(Math.hypot(...n)<1e-9)return
    if(n.reduce((s,x,i)=>s+x*normal[i]!,0)<0)points=[...points].reverse()
    let coordinates:UV[],role=0
    if(axis){const frame=timberFaceCoordinates(points,points[0]!,axis);coordinates=frame.uv;role=frame.endGrain?3:0}
    else if(Math.abs(normal[2])>.9){
      const dx=frontB[0]-frontA[0],dn=frontB[1]-frontA[1],length=Math.hypot(dx,dn)
      coordinates=points.map(p=>[((p[0]-frontA[0])*dx+(p[1]-frontA[1])*dn)/length,
        (-(p[0]-frontA[0])*dn+(p[1]-frontA[1])*dx)/length])
    }else coordinates=points.map(p=>[p[0]*normal[1]-p[1]*normal[0],p[2]])
    for(const i of[0,1,2,0,2,3]){const p=points[i]!;this.positions.push(p[0],p[2],-p[1]);
      this.uvs.push(...coordinates[i]!);this.tones.push(1);this.roles.push(role);this.light.push(...passageLight(p,normal))}
  }
}
function prism(batch:Batch,polygon:Point[],bottom:number,top:number,axis?:Point3):void {
  if(top-bottom<1e-7)return
  batch.quad(polygon.map(p=>[...p,top]),[0,0,1],axis)
  batch.quad(polygon.map(p=>[...p,bottom]),[0,0,-1],axis)
  const centre:Point=[polygon.reduce((s,p)=>s+p[0],0)/4,polygon.reduce((s,p)=>s+p[1],0)/4]
  for(let i=0;i<4;i++){
    const a=polygon[i]!,b=polygon[(i+1)%4]!,length=Math.hypot(b[0]-a[0],b[1]-a[1])
    if(length<1e-7)continue
    let normal:Point3=[(b[1]-a[1])/length,-(b[0]-a[0])/length,0]
    if(((a[0]+b[0])/2-centre[0])*normal[0]+((a[1]+b[1])/2-centre[1])*normal[1]<0)
      normal=[-normal[0],-normal[1],0]
    batch.quad([[...a,bottom],[...b,bottom],[...b,top],[...a,top]],normal,axis)
  }
}
function wallPiece(batch:Batch,a:Point,b:Point,thickness:number,bottom:number,top:number):void {
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<1e-7)return
  let normal:Point=[(b[1]-a[1])/length,-(b[0]-a[0])/length]
  if(((a[0]+b[0])/2-centroid[0])*normal[0]+((a[1]+b[1])/2-centroid[1])*normal[1]<0)
    normal=[-normal[0],-normal[1]]
  prism(batch,[a,b,[b[0]+normal[0]*thickness,b[1]+normal[1]*thickness],
    [a[0]+normal[0]*thickness,a[1]+normal[1]*thickness]],bottom,top)
}
/** Original mineral finish; geometry and the documentary parameter source stay here. */
function mineralSurface(kind:'plaster'|'terracotta'):MeshStandardNodeMaterial {
  const source=spec.materials.find(m=>m.id===kind)!
  return createEntryMineralSurface(kind,{colour:source.colour_srgb,
    roughness:source.roughness.value,tile:tileSize,joint:tileJoint,floor:floorZ})
}

/** THE HALL'S CONTEMPORARY LEDGE. A plain modern shelf against the wall the
 * hall lies behind, between the hall's own doorway and the entrance: the one
 * place in this house where something of the collection stands, and plainly
 * of our century, not of 1517. Its geometry is part of the passage, so the
 * clearance certificate is written against it.
 */
const LEDGE={along:3.4,length:1.2,depth:.3,thickness:.055,top:.9,bracket:{width:.07,depth:.22,drop:.24}}
const ledgeWall=wallFor('D')
const ledgeAxis=(():{point:Point;along:Point;inward:Point}=>{
  const a=ledgeWall.from.value as Point,b=ledgeWall.to.value as Point
  const length=Math.hypot(b[0]-a[0],b[1]-a[1])
  const along:Point=[(b[0]-a[0])/length,(b[1]-a[1])/length]
  let inward:Point=[along[1],-along[0]]
  const at=interpolate(a,b,LEDGE.along/length)
  if((centroid[0]-at[0])*inward[0]+(centroid[1]-at[1])*inward[1]<0)inward=[-inward[0],-inward[1]]
  // The face of the wall the shelf is fixed to, not its axis.
  return {point:[at[0]+inward[0]*ledgeWall.thickness_m.value/2,at[1]+inward[1]*ledgeWall.thickness_m.value/2],along,inward}
})()
/** Where the shelf stands and what stands on it, for the approach that is
 * walked to it and for the body the hall mounts on it. */
export const hallLedge={
  east:ledgeAxis.point[0]+ledgeAxis.inward[0]*LEDGE.depth/2,
  north:ledgeAxis.point[1]+ledgeAxis.inward[1]*LEDGE.depth/2,
  /** the finished top of the shelf, in world height */
  top:floorZ+LEDGE.top,
  lengthM:LEDGE.length,depthM:LEDGE.depth,
  /** the bearing the shelf's own face turns to the room, in degrees */
  facing:Math.atan2(ledgeAxis.inward[0],ledgeAxis.inward[1])*180/Math.PI,
  /** where a body standing on it is centred */
  stand:{
    east:ledgeAxis.point[0]+ledgeAxis.inward[0]*LEDGE.depth*.55,
    north:ledgeAxis.point[1]+ledgeAxis.inward[1]*LEDGE.depth*.55,
  },
} as const

export const hallLedgeProvenance={
  manifestId:'vinci/entry-passage/ledge',assetClass:'GENERATED',certainty:'assumed',
  source:['A-LAYOUT','modern museum fitting'],
  recipe:'A 1.20 by 0.30 m shelf of oiled oak, 55 mm thick, on two blackened steel brackets, fixed to the entry passage\u2019s west partition at 0.90 m over the supplied +0.80 m floor. Square, unmoulded and unpainted: a fitting of this museum and of no other century.',
  recipeDe:'Ein Brett aus ge\u00f6lter Eiche von 1,20 mal 0,30 m, 55 mm stark, auf zwei geschw\u00e4rzten Stahlkonsolen, an der Westwand des Eingangsgangs 0,90 m \u00fcber dem vorgegebenen Boden auf +0,80 m. Rechtwinklig, ohne Profil und ohne Fassung: ein Einbau dieses Museums und keines anderen Jahrhunderts.',
} as const

function ledgeBody(batch:Batch):void {
  const {point,along,inward}=ledgeAxis
  const half=LEDGE.length/2
  const corner=(u:number,v:number):Point=>[point[0]+along[0]*u+inward[0]*v,point[1]+along[1]*u+inward[1]*v]
  const top=floorZ+LEDGE.top
  prism(batch,[corner(-half,0),corner(half,0),corner(half,LEDGE.depth),corner(-half,LEDGE.depth)],top-LEDGE.thickness,top)
  for(const side of[-1,1]){
    const u=side*(half-.14)
    prism(batch,[corner(u-LEDGE.bracket.width/2,0),corner(u+LEDGE.bracket.width/2,0),
      corner(u+LEDGE.bracket.width/2,LEDGE.bracket.depth),corner(u-LEDGE.bracket.width/2,LEDGE.bracket.depth)],
    top-LEDGE.thickness-LEDGE.bracket.drop,top-LEDGE.thickness)
  }
}
/** THE LEDGE AS THE MUSEUM MADE IT: an oiled oak board on blackened steel,
 * a hair proud of the certified shelf, which stays the solid it always was
 * inside it. Its own mesh under the ledge's own record. */
/** How far the finished board stands proud of the certified shelf. */
export const LEDGE_FINISH_PROUD_M=.003
function ledgeFinish(perPixel:boolean):Mesh {
  const {point,along,inward}=ledgeAxis
  // three millimetres proud on every face the room sees; none against the wall
  const half=LEDGE.length/2+.003,top=floorZ+LEDGE.top+LEDGE_FINISH_PROUD_M,e=.003
  const positions:number[]=[],finish:number[]=[],light:number[]=[]
  const box=(u0:number,u1:number,v0:number,v1:number,z0:number,z1:number,kind:number):void=>{
    const c=(u:number,v:number,z:number):Point3=>[point[0]+along[0]*u+inward[0]*v,point[1]+along[1]*u+inward[1]*v,z]
    const faces:[Point3[],Point3][]=[
      [[c(u0,v0,z1),c(u1,v0,z1),c(u1,v1,z1),c(u0,v1,z1)],[0,0,1]],[[c(u0,v0,z0),c(u0,v1,z0),c(u1,v1,z0),c(u1,v0,z0)],[0,0,-1]],
      [[c(u0,v1,z0),c(u0,v1,z1),c(u1,v1,z1),c(u1,v1,z0)],[inward[0],inward[1],0]],[[c(u0,v0,z0),c(u1,v0,z0),c(u1,v0,z1),c(u0,v0,z1)],[-inward[0],-inward[1],0]],
      [[c(u0,v0,z0),c(u0,v0,z1),c(u0,v1,z1),c(u0,v1,z0)],[-along[0],-along[1],0]],[[c(u1,v0,z0),c(u1,v1,z0),c(u1,v1,z1),c(u1,v0,z1)],[along[0],along[1],0]],
    ]
    for(const [q,n] of faces.filter((_,k)=>k!==3)){
      const a=q[0]!,b=q[1]!,d=q[2]!
      const g=[(b[1]-a[1])*(d[2]-a[2])-(b[2]-a[2])*(d[1]-a[1]),(b[2]-a[2])*(d[0]-a[0])-(b[0]-a[0])*(d[2]-a[2]),(b[0]-a[0])*(d[1]-a[1])-(b[1]-a[1])*(d[0]-a[0])]
      const pts=g[0]!*n[0]+g[1]!*n[1]+g[2]!*n[2]<0?[...q].reverse():q
      for(const i of[0,1,2,0,2,3]){const p=pts[i]!;positions.push(p[0],p[2],-p[1]);finish.push(kind);light.push(...passageLight(p,n))}
    }
  }
  box(-half,half,e,LEDGE.depth+e,top-LEDGE.thickness-e*2,top,0)
  // each bracket where the certified one stands, a centimetre fuller all round
  for(const side of[-1,1]){
    const u=side*(LEDGE.length/2-.14)
    box(u-LEDGE.bracket.width/2-.01,u+LEDGE.bracket.width/2+.01,e,LEDGE.bracket.depth+.01,top-LEDGE.thickness-LEDGE.bracket.drop-.013,top-LEDGE.thickness-e*2,1)
  }
  const geometry=new BufferGeometry()
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3))
  geometry.setAttribute('finish',new Float32BufferAttribute(finish,1))
  geometry.setAttribute('passage',new Float32BufferAttribute(light,2))
  geometry.computeVertexNormals();geometry.computeBoundingSphere()
  const m=new MeshStandardNodeMaterial({metalness:0,roughness:.7})
  const kind=attribute('finish','float'),grain=mx_noise_float(vec3(positionWorld.x.mul(40),positionWorld.y.mul(4),positionWorld.z.mul(40))).mul(.1).add(1)
  // blackened steel is a dark grey with a satin face, not a void
  m.colorNode=kind.lessThan(.5).select(vec3(.52,.30,.15).mul(grain),vec3(.058,.055,.051))
  m.roughnessNode=kind.lessThan(.5).select(float(.68),float(.4))
  m.metalnessNode=kind.lessThan(.5).select(float(0),float(.55))
  applyPassageLight(m,perPixel)
  m.name='vinci/entry-passage/ledge-finish'
  const mesh=new Mesh(geometry,m);mesh.name='wing-vinci/entry-passage/ledge-finish'
  mesh.castShadow=false;mesh.receiveShadow=true
  mesh.userData={manifestId:hallLedgeProvenance.manifestId,labelOccluder:true}
  return mesh
}

/** THE COMPASS'S OWN MOUNT on the ledge: the plate, the stem and the collar
 * the exhibition holds this instrument by at its pivot, in the machine's
 * frame (up +Y, forward +Z, metres), placed where the machine stands. */
export function createLedgeMount(boxes:readonly {size:[number,number,number];centre:[number,number,number]}[],
  stand:{east:number;north:number;height:number;bearingRad:number},perPixel:boolean):Mesh {
  const cos=Math.cos(stand.bearingRad),sin=Math.sin(stand.bearingRad)
  // the machine's +X and +Z in east/north, as its object's yaw turns them
  const toWorld=(x:number,y:number,z:number):Point3=>[stand.east+x*cos+z*sin,stand.north+x*sin-z*cos,stand.height+y]
  const turn=(x:number,y:number,z:number):Point3=>[x*cos+z*sin,x*sin-z*cos,y]
  const positions:number[]=[],light:number[]=[]
  for(const {size,centre} of boxes){
    const [w,h,d]=size.map(v=>v/2) as [number,number,number]
    const faces:[[number,number,number][],[number,number,number]][]=[
      [[[-w,h,-d],[w,h,-d],[w,h,d],[-w,h,d]],[0,1,0]],[[[-w,-h,-d],[-w,-h,d],[w,-h,d],[w,-h,-d]],[0,-1,0]],
      [[[-w,-h,d],[-w,h,d],[w,h,d],[w,-h,d]],[0,0,1]],[[[-w,-h,-d],[w,-h,-d],[w,h,-d],[-w,h,-d]],[0,0,-1]],
      [[[w,-h,-d],[w,-h,d],[w,h,d],[w,h,-d]],[1,0,0]],[[[-w,-h,-d],[-w,h,-d],[-w,h,d],[-w,-h,d]],[-1,0,0]],
    ]
    for(const [q,n] of faces){
      const world=q.map(([x,y,z])=>toWorld(centre[0]+x,centre[1]+y,centre[2]+z)),normal=turn(...n)
      const a=world[0]!,b=world[1]!,c=world[2]!
      const g=[(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])]
      const pts=g[0]!*normal[0]+g[1]!*normal[1]+g[2]!*normal[2]<0?[...world].reverse():world
      for(const i of[0,1,2,0,2,3]){const p=pts[i]!;positions.push(p[0],p[2],-p[1]);light.push(...passageLight(p,normal))}
    }
  }
  const geometry=new BufferGeometry()
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3))
  geometry.setAttribute('passage',new Float32BufferAttribute(light,2))
  geometry.computeVertexNormals();geometry.computeBoundingSphere()
  // bronze, the museum's metal for what a hand or an eye finds, so the
  // stem reads between the compass's legs against the shaded wall
  const m=new MeshStandardNodeMaterial({metalness:.6,roughness:.38})
  m.colorNode=vec3(.30,.20,.095)
  applyPassageLight(m,perPixel)
  m.name='vinci/entry-passage/ledge-mount'
  const mesh=new Mesh(geometry,m);mesh.name='wing-vinci/entry-passage/ledge-mount'
  mesh.castShadow=true;mesh.receiveShadow=true
  mesh.userData={manifestId:hallLedgeProvenance.manifestId,labelOccluder:false}
  return mesh
}

export function createEntryPassage(tier:TierName):Group {
  const plaster=new Batch('plaster'),tile=new Batch('terracotta'),oak=new Batch('oak')
  for(const letter of['B','C','D']){
    const wall=wallFor(letter),a=wall.from.value,b=wall.to.value,length=Math.hypot(b[0]-a[0],b[1]-a[1])
    const openings=entry.openings.filter(o=>o.wall===wall.id).sort((p,q)=>p.from_m.value-q.from_m.value)
    const at=(d:number):Point=>interpolate(a,b,d/length)
    let cursor=0
    for(const opening of openings){
      const from=opening.from_m.value,to=from+opening.width_m.value,bottom=floorZ+opening.sill_m.value,head=bottom+opening.height_m.value
      wallPiece(plaster,at(cursor),at(from),wall.thickness_m.value,floorZ,ceilingZ)
      wallPiece(plaster,at(from),at(to),wall.thickness_m.value,floorZ,bottom)
      wallPiece(plaster,at(from),at(to),wall.thickness_m.value,head,ceilingZ)
      cursor=to
    }
    wallPiece(plaster,at(cursor),b,wall.thickness_m.value,floorZ,ceilingZ)
  }
  ledgeBody(plaster)
  prism(tile,outline,floorZ-slab,floorZ)
  prism(tile,joinOutline,floorZ-slab,floorZ)
  prism(plaster,joinOutline,ceilingZ,upperZ)
  wallPiece(plaster,joinOutline[0]!,frontA,wallFor('D').thickness_m.value,floorZ,ceilingZ)
  wallPiece(plaster,frontB,joinOutline[1]!,wallFor('B').thickness_m.value,floorZ,ceilingZ)

  // The floor assembly occupies the actual +4.00 to +4.30 m storey gap.
  // Adjacent infill strips share faces with beams, with no overlapping
  // visible undersides; the complete top layer closes every possible ray.
  const depth=entry.depth_m.value
  const strip=(from:number,to:number):Point[]=>[
    interpolate(outline[0]!,outline[3]!,from/depth),interpolate(outline[1]!,outline[2]!,from/depth),
    interpolate(outline[1]!,outline[2]!,to/depth),interpolate(outline[0]!,outline[3]!,to/depth)]
  const beamAxis:Point3=[frontB[0]-frontA[0],frontB[1]-frontA[1],0]
  let cursor=0
  for(let centre=beamSpacing/2;centre<depth;centre+=beamSpacing){
    const from=Math.max(cursor,centre-beamWidth/2),to=Math.min(depth,centre+beamWidth/2)
    if(from>cursor)prism(plaster,strip(cursor,from),ceilingZ,upperZ)
    prism(oak,strip(from,to),ceilingZ,ceilingZ+beamDepth,beamAxis)
    prism(plaster,strip(from,to),ceilingZ+beamDepth,upperZ)
    cursor=to
  }
  if(cursor<depth)prism(plaster,strip(cursor,depth),ceilingZ,upperZ)

  const group=new Group();group.name='wing-vinci/entry-passage'
  for(const batch of[plaster,tile,oak]){
    const geometry=new BufferGeometry()
    geometry.setAttribute('position',new Float32BufferAttribute(batch.positions,3))
    geometry.setAttribute('uv',new Float32BufferAttribute(batch.uvs,2))
    geometry.setAttribute('tone',new Float32BufferAttribute(batch.tones,1))
    geometry.setAttribute('passage',new Float32BufferAttribute(batch.light,2))
    geometry.computeVertexNormals();geometry.computeBoundingSphere()
    if(batch.kind==='oak')prepareSurfaceGeometry(geometry,'oak',batch.roles)
    const material=batch.kind==='oak'?createShellSurface('oak'):mineralSurface(batch.kind)
    applyPassageLight(material,tier!=='calm')
    const mesh=new Mesh(geometry,material);mesh.name=`wing-vinci/entry-passage/${batch.kind}`
    // Calm copies these same triangles into the already existing single
    // shell caster. The three visible materials and complete geometry stay.
    mesh.castShadow=tier!=='calm';mesh.receiveShadow=true;mesh.userData={manifestId:'vinci/entry-passage',labelOccluder:true}
    group.add(mesh)
  }
  group.add(ledgeFinish(tier!=='calm'))
  group.userData={...entryPassageProvenance,tier,triangles:[plaster,tile,oak].reduce((n,b)=>n+b.positions.length/9,0)}
  return group
}

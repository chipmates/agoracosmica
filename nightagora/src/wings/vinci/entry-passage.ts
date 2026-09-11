/** Unfurnished threshold envelope from the existing A-LAYOUT entry polygon.
 * It closes the omitted structure behind the exterior doorway. The room's
 * identity, fittings and occupation are not reconstructed by this module.
 */
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardNodeMaterial } from 'three/webgpu'
import { createEntryMineralSurface } from './entry-mineral-surface'
import type { TierName } from '../../stack/tier'
import { dossier, type Quantity } from './site'
import { createShellSurface, prepareSurfaceGeometry } from './surface'
import { timberFaceCoordinates } from './timber'

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
  positions:number[]=[];uvs:number[]=[];tones:number[]=[];roles:number[]=[]
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
      this.uvs.push(...coordinates[i]!);this.tones.push(1);this.roles.push(role)}
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
    roughness:source.roughness.value,tile:tileSize,joint:tileJoint})
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
    geometry.computeVertexNormals();geometry.computeBoundingSphere()
    if(batch.kind==='oak')prepareSurfaceGeometry(geometry,'oak',batch.roles)
    const material=batch.kind==='oak'?createShellSurface('oak'):mineralSurface(batch.kind)
    const mesh=new Mesh(geometry,material);mesh.name=`wing-vinci/entry-passage/${batch.kind}`
    // Calm copies these same triangles into the already existing single
    // shell caster. The three visible materials and complete geometry stay.
    mesh.castShadow=tier!=='calm';mesh.receiveShadow=true;mesh.userData={manifestId:'vinci/entry-passage',labelOccluder:true}
    group.add(mesh)
  }
  group.userData={...entryPassageProvenance,tier,triangles:[plaster,tile,oak].reduce((n,b)=>n+b.positions.length/9,0)}
  return group
}

/** Surviving shell reconstructed from the registered dossier nominals.
 * The metric choices retain their assumptions; no plate supplies a texture.
 * XYZ below is east / north / up until emitted as three.js X / Y / Z.
 */
import {
  BufferGeometry, Color, Float32BufferAttribute, Group, Mesh,
  MeshStandardNodeMaterial, MeshPhysicalNodeMaterial, Vector3,
} from 'three/webgpu'
import * as TSL from 'three/tsl'
import type { MaterialLibrary } from '../../stack/materials'
import { createShellSurface, prepareSurfaceGeometry, type ShellSurfaceKind } from './surface'
import { timberFaceCoordinates, timberPanelFrame } from './timber'
import { gatePassageProvenance } from './gate-passage'
import { foundationPlinthFaces, foundationPlinthProvenance } from './foundation-plinth'
import { createHouseGlazing, houseGlazingProvenance, type GlazedLight } from './house-glazing'
import { createDormerRooms, createHouseRooms, houseRoomsProvenance, type DormerRoom } from './house-rooms'
import { HALL_WINDOWS } from './house-hall'
import { createHouseTracery, houseTraceryProvenance, type DressingStone, type SillSpec, type TraceryWindow } from './house-tracery'
import { bakeDressingShadows, bakeDressingSky, type DressingBox } from './house-sun'
import dossierText from './data/closluce.json?raw'

// TSL's composable overload graph is represented once at this boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { attribute, cameraPosition, clamp, float, floor, fract, length, mix, mx_noise_float,
  normalMap, positionLocal, positionWorld, smoothstep, uv, vec2, vec3 } = TSL as unknown as Record<string, N>
type V2 = [number, number]
type V3 = [number, number, number]
type Tier = 'hero' | 'standard' | 'calm'
type MatKey = 'brick' | 'stone' | 'slate' | 'oak' | 'iron' | 'lead' | 'glass' | 'glassSky' | 'dark' | 'clay'
interface Opening { id:string; type:string; from_m:number; width_m:number; base_m:number; height_m:number; render:boolean }
interface Facade { id:string; from:V2; to:V2; length_m:number; openings:Opening[]; render:boolean; gable_segment?:string; pattern:{field:string} }
interface Wall { facade_id?:string; from:V2; to:V2; base_m:number; height_m:number; thickness_m:number; render:boolean }
interface Roof { id:string; footprint:V2[]; ridge:[V3,V3]; eaves_m:number; half_span_m:number; type:string; overhang_m?:number }
interface Detail { id:string; segment:string; position:V3; size_m:V3; facing_deg:number; top_m:number; pots:number }
interface Spec { facades:Facade[]; walls:Wall[]; roof:{segments:Roof[]; dormers:Detail[]; chimneys:Detail[]; turret:{footprint:V2[]; base_m:number;eaves_m:number}} }
function values(x:unknown):unknown {
  if (!x || typeof x !== 'object') return x
  if ('value' in x) return (x as {value:unknown}).value
  if (Array.isArray(x)) return x.map(values)
  return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,values(v)]))
}
const spec = values(JSON.parse(dossierText)) as Spec
const hash = (a:number,b=0):number => { const n=Math.sin(a*127.1+b*311.7)*43758.5453123; return n-Math.floor(n) }
const sub=(a:V3,b:V3):V3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]]
const cross=(a:V3,b:V3):V3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
const dot=(a:V3,b:V3):number=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
const lerp=(a:V3,b:V3,t:number):V3=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]
const world=(p:V3):V3=>[p[0],p[2],-p[1]]

function surface(kind:MatKey,library?:MaterialLibrary,valleys:readonly [V3,V3][]=[]):MeshStandardNodeMaterial {
  if(kind==='brick'||kind==='stone'||kind==='slate'||kind==='oak')return createShellSurface(kind,library,valleys)
  const glazing=kind==='glass'||kind==='glassSky'
  const palette={lead:'#7b807f',iron:'#302e29',glass:'#243132',glassSky:'#3a4a4d',dark:'#282721',clay:'#915941'}
  const mat=glazing?new MeshPhysicalNodeMaterial({roughness:.21,metalness:0,ior:1.5,transmission:0,thickness:.003,specularIntensity:kind==='glassSky'?.28:.06,envMapIntensity:kind==='glassSky'?.55:.08}):new MeshStandardNodeMaterial({roughness:kind==='lead'?.61:kind==='iron'?.76:.88,metalness:kind==='lead'?.7:0})
  const c=new Color(palette[kind]); const p=positionWorld
  const density=float(1).sub(smoothstep(18,72,length(p.sub(cameraPosition))))
  const macro=mx_noise_float(p.mul(.29)).mul(.14).add(.96)
  const grain=mx_noise_float(p.mul(19)).mul(.06).mul(density).add(1)
  const micro=mx_noise_float(p.mul(115)).mul(.035).mul(density)
  const U=uv();const colour=vec3(c.r,c.g,c.b).mul(macro).mul(grain).mul(attribute('tone','float'))
  // Three spatial scales and thinning grain share one physical material.
  mat.colorNode=colour
  mat.roughnessNode=glazing?clamp(float(.21).add(micro),.18,.23):kind==='lead'?clamp(float(.61).add(micro),.48,.72):kind==='iron'?clamp(float(.76).add(micro),.58,.80):clamp(float(.87).add(micro),.1,1)
  if(!glazing&&kind!=='dark') {
    const n1=mx_noise_float(p.mul(24)); const n2=mx_noise_float(p.add(vec3(.025,0,.02)).mul(24))
    mat.normalNode=normalMap(vec3(n1.sub(n2).mul(.045).mul(density).add(.5),n2.mul(.024).mul(density).add(.5),1),vec2(.65,.65))
  }
  if(glazing){
    // Leaded quarries: diamonds on a 0.155 m pitch, 7 mm cames, each quarry
    // its own tone and its own slight tilt, which is why old glass never
    // reflects a window's worth of sky as one flat sheet.
    const pitch=.155,came=.0035,rot=Math.SQRT1_2/pitch
    const r=vec2(U.x.add(U.y).mul(rot),U.y.sub(U.x).mul(rot))
    const cell=floor(r),unit=fract(r)
    const edge=unit.x.min(float(1).sub(unit.x)).min(unit.y.min(float(1).sub(unit.y))).mul(pitch)
    const pixel=length(U.dFdx()).add(length(U.dFdy())).mul(.5).max(.00005)
    const held=smoothstep(1.1,2.4,float(pitch).div(pixel))
    const lead=float(1).sub(smoothstep(float(came).sub(pixel).max(0),float(came).add(pixel),edge)).mul(held)
    const quarry=(salt:number)=>fract(cell.x.mul(27.13).add(cell.y.mul(41.71)).add(salt).sin().mul(4317.1))
    const leadColour=new Color(palette.lead)
    mat.colorNode=colour.mul(quarry(3.1).sub(.5).mul(.17).add(1))
      .mul(float(1).sub(lead.mul(.45))).add(vec3(leadColour.r,leadColour.g,leadColour.b).mul(lead.mul(.26)))
    const tilt=vec2(quarry(7.7).sub(.5),quarry(11.3).sub(.5)).mul(held.mul(.16))
    mat.normalNode=normalMap(vec3(tilt.x.add(U.x.mul(22).sin().mul(.008)).add(.5),tilt.y.add(U.y.mul(17).sin().mul(.006)).add(.5),1),vec2(.25,.25))
  }
  mat.name=`vinci/${kind}`
  return mat
}

class Batch {
  constructor(readonly timber=false) {}
  positions:number[]=[]; uvs:number[]=[]; tones:number[]=[]; roles:number[]=[]; oakSeeds:number[]=[]; surfaceRole=0
  /** Emissions made while `retire` holds stay certified solids and leave the
   * colour pass: their replacement is drawn by the house's own modules. */
  retired:number[]=[]; retire=false
  tri(a:V3,b:V3,c:V3,ta:V2=[a[0],a[2]],tb:V2=[b[0],b[2]],tc:V2=[c[0],c[2]],tone=1,oakSeed=NaN):void {
    if(Math.hypot(...cross(sub(b,a),sub(c,a)))<1e-9)return
    for(const p of [a,b,c])this.positions.push(...world(p));this.uvs.push(...ta,...tb,...tc);this.tones.push(tone,tone,tone);this.roles.push(this.surfaceRole,this.surfaceRole,this.surfaceRole)
    const r=this.retire?1:0;this.retired.push(r,r,r)
    if(this.timber)this.oakSeeds.push(oakSeed,oakSeed,oakSeed)
  }
  quad(a:V3,b:V3,c:V3,d:V3,ta:V2=[a[0],a[2]],tb:V2=[b[0],b[2]],tc:V2=[c[0],c[2]],td:V2=[d[0],d[2]],tone=1):void {
    this.tri(a,b,c,ta,tb,tc,tone);this.tri(a,c,d,ta,tc,td,tone)
  }
  memberFace(points:V3[],origin:V3,axis:V3,tone=1):void {
    if(!this.timber){this.quad(points[0]!,points[1]!,points[2]!,points[3]!,undefined,undefined,undefined,undefined,tone);return}
    const face=timberFaceCoordinates(points,origin,axis),prior=this.surfaceRole
    this.surfaceRole=face.endGrain?3:0
    this.quad(points[0]!,points[1]!,points[2]!,points[3]!,face.uv[0],face.uv[1],face.uv[2],face.uv[3],tone)
    this.surfaceRole=prior
  }
  polygon(p:V3[],tex?:(p:V3)=>V2,tone=1,oakSeed=NaN):void { for(let i=1;i<p.length-1;i++)this.tri(p[0]!,p[i]!,p[i+1]!,tex?.(p[0]!),tex?.(p[i]!),tex?.(p[i+1]!),tone,oakSeed) }
  mesh(material:MeshStandardNodeMaterial):Mesh {
    const geo=new BufferGeometry();geo.setAttribute('position',new Float32BufferAttribute(this.positions,3));geo.setAttribute('uv',new Float32BufferAttribute(this.uvs,2));geo.setAttribute('tone',new Float32BufferAttribute(this.tones,1));geo.computeVertexNormals();geo.computeBoundingSphere();const kind=material.userData['surfaceKind'] as ShellSurfaceKind|undefined;if(kind)prepareSurfaceGeometry(geo,kind,this.roles,this.oakSeeds)
    geo.setAttribute('retired',new Float32BufferAttribute(this.retired,1))
    // A retired vertex collapses in the vertex stage; the buffer keeps it.
    if(this.retired.some(r=>r>0)&&!material.positionNode)material.positionNode=attribute('retired','float').greaterThan(.5).select(vec3(0,0,0),positionLocal)
    const m=new Mesh(geo,material);m.castShadow=true;m.receiveShadow=true;return m
  }
}
type Batches=Record<MatKey,Batch>
function solid(b:Batch,centre:V3,size:V3,angle=0,tone=1):void {
  const c=Math.cos(angle),s=Math.sin(angle);const p=(x:number,y:number,z:number):V3=>[centre[0]+x*c-y*s,centre[1]+x*s+y*c,centre[2]+z]
  const a=size[0]/2,d=size[1]/2,h=size[2]/2
  const corners=[p(-a,-d,-h),p(a,-d,-h),p(a,d,-h),p(-a,d,-h),p(-a,-d,h),p(a,-d,h),p(a,d,h),p(-a,d,h)]
  const axis:V3=size[2]>=Math.max(size[0],size[1])?[0,0,1]:size[0]>=size[1]?[c,s,0]:[-s,c,0]
  for(const q of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])b.memberFace(q.map(i=>corners[i]!),centre,axis,tone)
}
function beam(b:Batch,a:V3,c:V3,width:number,depth=width):void {
  const dir=new Vector3(...sub(c,a)).normalize();const side=new Vector3(-dir.y,dir.x,0);if(side.length()<.01)side.set(1,0,0);side.normalize().multiplyScalar(width/2)
  const other=new Vector3().crossVectors(dir,side).normalize().multiplyScalar(depth/2)
  const at=(p:V3,s:number,t:number):V3=>[p[0]+side.x*s+other.x*t,p[1]+side.y*s+other.y*t,p[2]+side.z*s+other.z*t]
  const q=[at(a,-1,-1),at(a,1,-1),at(a,1,1),at(a,-1,1),at(c,-1,-1),at(c,1,-1),at(c,1,1),at(c,-1,1)]
  for(const ids of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])b.memberFace(ids.map(i=>q[i]!),a,sub(c,a))
}
interface Plane { fn:(p:V3)=>number }
function clip(poly:V3[],fn:(p:V3)=>number,positive=true):V3[] {
  const result:V3[]=[];for(let i=0;i<poly.length;i++){const a=poly[i]!,b=poly[(i+1)%poly.length]!;const fa=fn(a)*(positive?1:-1),fb=fn(b)*(positive?1:-1);if(fa>=-1e-7)result.push(a);if((fa>0)!==(fb>0))result.push(lerp(a,b,fa/(fa-fb)))}return result
}
function subtract(poly:V3[],planes:Plane[]):V3[][] {
  const outside:V3[][]=[];let inside=poly
  for(const p of planes){if(inside.length<3)break;const out=clip(inside,p.fn,false);if(out.length>=3)outside.push(out);inside=clip(inside,p.fn)}
  return outside
}
interface RoofFace {id:string; polygon:V3[]; normal:V3; z:(x:number,y:number)=>number; tex:(p:V3)=>V2; planes:Plane[]}
function roofFaces():RoofFace[] {
  const faces:RoofFace[]=[]
  for(const roof of spec.roof.segments){const ridge=roof.ridge;const pts=roof.footprint.map((p):V3=>[p[0],p[1],roof.eaves_m]);let polys:V3[][]=[]
    if(roof.type==='gable') {
      const dir=sub(ridge[1],ridge[0]);const len=Math.hypot(dir[0],dir[1]);const ax:V2=[dir[0]/len,dir[1]/len]
      const signed=(p:V3)=> (p[0]-ridge[0][0])*(-ax[1])+(p[1]-ridge[0][1])*ax[0]
      for(const side of [-1,1]){const edge=pts.filter(p=>signed(p)*side>0);edge.sort((a,b)=>dot(sub(a,ridge[0]),dir)-dot(sub(b,ridge[0]),dir));if(edge.length>=2)polys.push([edge[0]!,edge[1]!,ridge[1],ridge[0]])}
    }else polys=pts.map((p,i)=>[p,pts[(i+1)%pts.length]!,ridge[0]])
    for(let poly of polys){let n=cross(sub(poly[1]!,poly[0]!),sub(poly[2]!,poly[0]!));if(n[2]<0){poly=poly.reverse();n=cross(sub(poly[1]!,poly[0]!),sub(poly[2]!,poly[0]!))}
      const p0=poly[0]!;const z=(x:number,y:number)=>p0[2]-(n[0]*(x-p0[0])+n[1]*(y-p0[1]))/n[2]
      const e=sub(poly[1]!,poly[0]!);const l=Math.hypot(e[0],e[1]);const tx=e[0]/l,ty=e[1]/l
      const tex=(p:V3):V2=>[(p[0]-p0[0])*tx+(p[1]-p0[1])*ty,Math.hypot((p[0]-p0[0])*(-ty)+(p[1]-p0[1])*tx,p[2]-p0[2])]
      const planes:Plane[]=poly.map((p,i)=>{const q=poly[(i+1)%poly.length]!;return {fn:(a:V3)=>(q[0]-p[0])*(a[1]-p[1])-(q[1]-p[1])*(a[0]-p[0])}})
      planes.push({fn:(p:V3)=>z(p[0],p[1])-p[2]-.001})
      faces.push({id:roof.id,polygon:poly,normal:n,z,tex,planes})
    }
  }return faces
}

/** Visible roof-plane intersections derive the damp lines, never a painted
 * stripe chosen in screen space. Only north-facing junctions are retained. */
function roofValleys(faces:RoofFace[]):[V3,V3][] {
  const lines:[V3,V3][]=[]
  for(let i=0;i<faces.length;i++)for(let j=i+1;j<faces.length;j++){
    const a=faces[i]!,b=faces[j]!
    if(a.id===b.id||Math.max(a.normal[1],b.normal[1])<=0)continue
    let overlap=a.polygon
    for(const plane of b.planes.slice(0,-1))overlap=clip(overlap,plane.fn)
    if(overlap.length<3)continue
    const hits:V3[]=[],delta=(p:V3)=>a.z(p[0],p[1])-b.z(p[0],p[1])
    for(let k=0;k<overlap.length;k++){
      const p=overlap[k]!,q=overlap[(k+1)%overlap.length]!,u=delta(p),v=delta(q)
      if(Math.abs(u)<1e-6)hits.push(p)
      if(u*v<0)hits.push(lerp(p,q,u/(u-v)))
    }
    if(hits.length<2)continue
    let pair:[V3,V3]=[hits[0]!,hits[1]!],span=0
    for(const p of hits)for(const q of hits){const d=Math.hypot(...sub(q,p));if(d>span){span=d;pair=[p,q]}}
    if(span<.3)continue
    const mid=lerp(...pair,.5)
    if(mid[1]<-12||faces.some(f=>f!==a&&f!==b&&f.planes.slice(0,-1).every(p=>p.fn(mid)>0)&&f.z(mid[0],mid[1])>mid[2]+.02))continue
    lines.push(pair.map(p=>world(p)) as [V3,V3])
  }
  return lines
}

/** Keep inward gable backing below the union of the actual roof solids.
 * Test its offset EN coordinates, not the outer facade profile. The 70 mm
 * allowance is the existing oak underside in drawRoofs. Outside every roof
 * footprint the original wall remains, so clipping cannot open a side seam.
 */
function clipGableBacking(poly:V3[],faces:RoofFace[]):V3[][] {
  let pending=[poly];const retained:V3[][]=[]
  for(const face of faces){
    const planes=[...face.planes.slice(0,-1),{fn:(p:V3)=>face.z(p[0],p[1])-.07-p[2]}]
    pending=pending.flatMap(part=>{
      let inside=part
      for(const plane of planes)inside=clip(inside,plane.fn)
      if(inside.length>=3)retained.push(inside)
      return subtract(part,planes)
    })
  }
  // Pending polygons lie above all applicable roof undersides. Remove only
  // their footprint-covered portions; preserve unroofed masonry unchanged.
  for(const face of faces)pending=pending.flatMap(part=>subtract(part,face.planes.slice(0,-1)))
  return[...retained,...pending]
}

/** What one createShell call hands the house's own modules: the lights to
 * glaze, the traceried windows to carve, the window backs a room opens. */
interface HouseBuild { glaze:boolean; carve:boolean; openBacks:ReadonlySet<string>; lights:GlazedLight[]; tracery:TraceryWindow[]; sills:SillSpec[]; dormers:DormerRoom[]
  /** dressing stones cut back from an opening, redrawn by the carving */
  stones:DressingStone[]
  /** facade ends (`id:start`, `id:end`) where the same wall runs on in line */
  runsOn:ReadonlySet<string>
  /** every dressing laid proud of a facade, for the shadows it throws on it */
  dressings:DressingBox[]; casting:ReadonlySet<Batch>
  /** timber members redrawn outside the certified set */
  posts:Batch }
let house:HouseBuild|null=null
/** The new glass stands in front of every retired pane and saddle bar (the
 * bars' faces reach -40 mm), so no retired piece can win a pixel over it
 * in a pass that draws the buffer as built. */
const GLASS_OUT=-.038
/** A layer no camera renders; the shadow cameras render 0 and 1 only. */
export const RETIRED_LAYER=30
function lightOf(f:Facade,id:string,outline:V2[],out:number,kind:GlazedLight['kind'],bars:number[]):GlazedLight {
  const lo=Math.min(...outline.map(p=>p[1])),hi=Math.max(...outline.map(p=>p[1]))
  return {id,from:f.from,to:f.to,length:f.length_m,outline,out,kind,bars:bars.filter(z=>z>lo+.05&&z<hi-.05)}
}
function facadePoint(f:Facade,x:number,z:number,out=0):V3 {
  const dx=(f.to[0]-f.from[0])/f.length_m,dy=(f.to[1]-f.from[1])/f.length_m
  return [f.from[0]+dx*x+dy*out,f.from[1]+dy*x-dx*out,z]
}
function faceBox(b:Batch,f:Facade,x:number,z:number,w:number,h:number,depth:number,out=0,tone=1):void {
  if(house?.casting.has(b)&&!b.retire&&out>.004)house.dressings.push({facade:f.id,u0:x-w/2,u1:x+w/2,z0:z-h/2,z1:z+h/2,front:out})
  const p=facadePoint(f,x,z,out-depth/2)
  solid(b,p,[w,depth,h],Math.atan2(f.to[1]-f.from[1],f.to[0]-f.from[0]),tone)
}
/** What each rendered opening's surround and sill take of its facade, in
 * the facade frame: no other dressing stone may run into it. */
interface Zone { o:Opening; u0:number; u1:number; z0:number; z1:number }
function surroundZones(f:Facade):Zone[] {
  if(f.id.startsWith('tower-crown-'))return[]
  return f.openings.filter(o=>o.render&&o.type!=='blind-recess').map(o=>{
    const open=o.type==='gate'||o.type==='open-arcade',jamb=o.type==='open-arcade'?.14:o.type==='gate'?.27:.16
    return{o,u0:o.from_m-jamb,u1:o.from_m+o.width_m+jamb,z0:o.base_m-(open?0:.16),z1:o.base_m+o.height_m+jamb}
  })
}
/** A certified dressing stone cut back or stretched: on the carving tier the
 * certified one leaves the colour pass and the carving draws this one, so
 * the rail's solids stay exactly what they were. */
function redress(f:Facade,u0:number,u1:number,z0:number,z1:number,depth:number,out:number,tone:number):void {
  if(!house||u1-u0<.04)return
  house.stones.push({from:f.from,to:f.to,length:f.length_m,u0,u1,z0,z1,back:out-depth,front:out,tone})
  if(out>.004)house.dressings.push({facade:f.id,u0,u1,z0,z1,front:out})
}
/** Facade ends where the next registered facade carries the same wall on in
 * the same line (within a degree, same base and height): a cadastral join,
 * not a corner, so no dressed quoin belongs there. */
function runsOn(facades:readonly Facade[]):Set<string> {
  const ends=new Set<string>(),wallOf=(f:Facade)=>spec.walls.find(w=>w.facade_id===f.id&&w.render)
  const unit=(f:Facade):V2=>[(f.to[0]-f.from[0])/f.length_m,(f.to[1]-f.from[1])/f.length_m]
  for(const f of facades)for(const g of facades){
    const wf=wallOf(f),wg=wallOf(g),df=unit(f),dg=unit(g)
    if(f===g||!wf||!wg||Math.abs(wf.base_m-wg.base_m)>.01||Math.abs(wf.base_m+wf.height_m-wg.base_m-wg.height_m)>.01)continue
    if(df[0]*dg[0]+df[1]*dg[1]<Math.cos(Math.PI/180))continue
    if(Math.hypot(f.to[0]-g.from[0],f.to[1]-g.from[1])<.05)ends.add(`${f.id}:end`)
    if(Math.hypot(f.from[0]-g.to[0],f.from[1]-g.to[1])<.05)ends.add(`${f.id}:start`)
  }
  return ends
}
function rectPlanes(x0:number,x1:number,z0:number,z1:number):Plane[] {return [
  {fn:p=>p[0]-x0},{fn:p=>x1-p[0]},{fn:p=>p[2]-z0},{fn:p=>z1-p[2]},
]}
function facadeFrom(id:string,a:V2,b:V2,field='brick'):Facade {return {id,from:a,to:b,length_m:Math.hypot(b[0]-a[0],b[1]-a[1]),openings:[],render:true,pattern:{field}}}
function drawFacade(f:Facade,wall:Wall,b:Batches,tier:Tier,faces:RoofFace[]):void {
  const base=wall.base_m,top=base+wall.height_m;const isGable=Boolean(f.gable_segment)
  const roof=spec.roof.segments.find(r=>r.id===f.gable_segment)
  const heightAt=(x:number):number=>{
    if(!roof)return top
    const p=facadePoint(f,x,top);const a=roof.ridge[0],d=sub(roof.ridge[1],a);const len=Math.hypot(d[0],d[1]);const off=Math.abs((p[0]-a[0])*(-d[1]/len)+(p[1]-a[1])*(d[0]/len))
    // Facade registration and roof regularisation differ by centimetres.
    return Math.max(top,roof.ridge[0][2]-(roof.ridge[0][2]-roof.eaves_m)*off/roof.half_span_m)
  }
  const peak=roof?Math.max(0,Math.min(f.length_m,((roof.ridge[0][0]-f.from[0])*(f.to[0]-f.from[0])+(roof.ridge[0][1]-f.from[1])*(f.to[1]-f.from[1]))/f.length_m)):f.length_m/2
  const peakOther=roof?Math.max(0,Math.min(f.length_m,((roof.ridge[1][0]-f.from[0])*(f.to[0]-f.from[0])+(roof.ridge[1][1]-f.from[1])*(f.to[1]-f.from[1]))/f.length_m)):peak
  let outline:V3[]=[[0,0,base],[f.length_m,0,base],[f.length_m,0,heightAt(f.length_m)]]
  for(const x of [...new Set([peak,peakOther])].sort((a,c)=>c-a))if(x>0.001&&x<f.length_m-.001)outline.push([x,0,heightAt(x)])
  outline.push([0,0,heightAt(0)])
  let panels=[outline]
  for(const o of f.openings.filter(o=>o.render&&o.type!=='blind-recess'))panels=panels.flatMap(p=>subtract(p,rectPlanes(o.from_m,o.from_m+o.width_m,o.base_m,o.base_m+o.height_m)))
  const emit=(batch:Batch,p:V3[],out:number,tone=1):void=>{
    const polygon=p.map(v=>facadePoint(f,v[0],v[2],out))
    const pieces=batch===b.dark&&isGable?clipGableBacking(polygon,faces):[polygon]
    for(const piece of pieces)batch.polygon(piece,v=>{
      const x=(v[0]-f.from[0])*(f.to[0]-f.from[0])/f.length_m+(v[1]-f.from[1])*(f.to[1]-f.from[1])/f.length_m;return [x,v[2]]
    },tone)
  }
  const stoneField=f.pattern.field==='tuffeau'
  for(const panel of panels){b.stone.surfaceRole=stoneField?2:1;emit(b.stone,panel,0,.76);b.stone.surfaceRole=0;emit(b.dark,[...panel].reverse(),-wall.thickness_m,.88)}
  // Every brick course is shallow, bevelled geometry; vertical joints retain
  // the dossier's 240 × 45 mm bond and twelve-millimetre mortar module.
  const maxHeight=Math.max(...outline.map(p=>p[2]));const stride=tier==='calm'?3.8:2.3
  // The basement is dressed in the same 280mm stone module as the stone
  // field; only the brickwork above +0.70m uses the thin57mm laid module.
  const bands=stoneField?[{lo:base,hi:maxHeight,unit:.28,stone:true}]:[{lo:base,hi:Math.min(.7,maxHeight),unit:.28,stone:true},{lo:Math.max(base,.7),hi:maxHeight,unit:.057,stone:false}]
  for(const band of bands)for(let row=Math.floor(band.lo/band.unit);row*band.unit<band.hi;row++) {
    const y0=Math.max(band.lo,row*band.unit+(band.stone?.007:.006)),y1=Math.min(band.hi,(row+1)*band.unit-(band.stone?.007:.006));if(y1<=y0)continue
    for(const panel of panels){let strip=clip(clip(panel,p=>p[2]-y0),p=>y1-p[2]);if(strip.length<3)continue
      const lo=Math.min(...strip.map(p=>p[0])),hi=Math.max(...strip.map(p=>p[0]));
      for(let x=lo;x<hi;x+=stride){const chunk=clip(clip(strip,p=>p[0]-x),p=>Math.min(x+stride,hi)-p[0]);if(chunk.length<3)continue
        const mat=band.stone?b.stone:b.brick;const tone=.91+hash(row+f.length_m,x)*.14
        emit(mat,chunk,.015,tone)
        // Laid course lips catch low sun without shader screen-door noise.
        if(tier!=='calm')for(let i=0;i<chunk.length;i++){const a=chunk[i]!,c=chunk[(i+1)%chunk.length]!;if(Math.abs(a[2]-c[2])<.0001&&a[2]===y1){mat.quad(facadePoint(f,a[0],a[2],.015),facadePoint(f,c[0],c[2],.015),facadePoint(f,c[0],c[2]+.004,0),facadePoint(f,a[0],a[2]+.004,0),[a[0],a[2]],[c[0],c[2]],[c[0],c[2]+.004],[a[0],a[2]+.004],tone)}}
      }
    }
  }
  // Alternating dressed quoins are kept off almost collinear cadastral joins.
  // A dressing below a wall's own foot stands on a wall that is not there,
  // and on coursed ashlar a quoin laid half a course off the beds breaks
  // every joint it meets: both stay certified and leave the colour pass.
  // A quoin stops at an opening's surround: a door 0.35 m from the corner
  // took every long quoin 0.23 m into the doorway.
  const zones=surroundZones(f)
  const corner=(x:number):void=>{for(let z=.7,n=0;z<heightAt(x)-.2;z+=.28,n++){
    const w=n%2?.38:.58,tone=.91+hash(n,f.length_m)*.10,z0=z+.002,z1=z+.264
    const kept=stoneField||z<base||Boolean(house?.runsOn.has(`${f.id}:${x===0?'start':'end'}`))
    const hits=zones.filter(q=>q.z0<z1&&q.z1>z0&&(x===0?q.u0<w&&q.u1>0:q.u1>f.length_m-w&&q.u0<f.length_m))
    const inner=x===0?Math.min(w,...hits.map(q=>q.u0)):Math.max(f.length_m-w,...hits.map(q=>q.u1))
    const cut=Boolean(house?.carve)&&!kept&&Math.abs(inner-(x===0?w:f.length_m-w))>1e-6
    b.stone.retire=kept||cut;faceBox(b.stone,f,x===0?w/2:f.length_m-w/2,z+.133,w,.262,.10,.055,tone)
    if(cut)redress(f,x===0?0:inner,x===0?inner:f.length_m,z0,z1,.10,.055,tone)
  }b.stone.retire=false}
  if(f.length_m>2.5){corner(0);corner(f.length_m)}
  // The plinth course marks a brick wall's stone foot; on coursed ashlar it
  // lies half a course off the beds and its sky-lit top reads as a ribbon.
  for(const z of [.69,top-.12]){
    b.stone.retire=z<base||(stoneField&&z<1)
    let runs:[number,number][]=[[0,f.length_m]]
    for(const o of f.openings){
      if(!o.render||o.type==='blind-recess'||o.base_m>=z+.085||o.base_m+o.height_m<=z-.085)continue
      const left=o.from_m,right=left+o.width_m
      runs=runs.flatMap(([a,c]):[number,number][]=>{
        if(c<=left||a>=right)return[[a,c]]
        const pieces:[number,number][]=[]
        if(a<left)pieces.push([a,left]);if(c>right)pieces.push([right,c]);return pieces
      })
    }
    for(const [a,c]of runs)if(c-a>.001)faceBox(b.stone,f,(a+c)/2,z,c-a,.17,.16,.07,.95)
    b.stone.retire=false
  }
  // Every reveal, sill, mullion and transom stands in the real wall aperture.
  if(!f.id.startsWith('tower-crown-'))for(const o of f.openings)if(o.render)drawOpening(f,o,wall.thickness_m,b)
  if(isGable&&roof){
    const p=peak>0.1&&peak<f.length_m-.1?peak:peakOther
    const pa=facadePoint(f,0,heightAt(0)+.06,.05),pb=facadePoint(f,p,heightAt(p)+.09,.05),pc=facadePoint(f,f.length_m,heightAt(f.length_m)+.06,.05)
    beam(b.stone,pa,pb,.20,.24);beam(b.stone,pb,pc,.20,.24)
    // the raked coping stands 150 mm proud: its shadow is traced as short steps
    if(house)for(let x=0;x<f.length_m;x+=.16){const mid=Math.min(f.length_m,x+.08),rise=mid<=p?.06+.03*mid/Math.max(p,.01):.06+.03*(f.length_m-mid)/Math.max(f.length_m-p,.01),hc=heightAt(mid)+rise
      house.dressings.push({facade:f.id,u0:x,u1:Math.min(f.length_m,x+.16),z0:hc-.13,z1:hc+.13,front:.15})}
    // Stepped inner stones follow the sloping coping, as read from Q124.
    for(const [a,c] of [[0,p],[p,f.length_m]] as [number,number][])for(let x=a+.3;x<c-.1;x+=.42)faceBox(b.stone,f,x,heightAt(x)-.20,.43,.42,.10,.042,.92)
    const peakPoint=facadePoint(f,p,heightAt(p)+.28,.05);finial(b,peakPoint,.65)
  }
}
function finial(b:Batches,p:V3,h:number):void {
  solid(b.stone,[p[0],p[1],p[2]+h*.12],[h*.28,h*.28,h*.15]);solid(b.stone,[p[0],p[1],p[2]+h*.36],[h*.12,h*.12,h*.50])
  solid(b.stone,[p[0],p[1],p[2]+h*.53],[h*.44,h*.16,h*.12]);solid(b.stone,[p[0],p[1],p[2]+h*.72],[h*.19,h*.19,h*.22])
}
function drawOpening(f:Facade,o:Opening,thickness:number,b:Batches):void {
  const x=o.from_m,w=o.width_m,z=o.base_m,h=o.height_m;const open=o.type==='gate'||o.type==='open-arcade';const wooden=o.type==='open-arcade'
  if(o.type==='blind-recess'){faceBox(b.stone,f,x+w/2,z+h/2,w,h,.05,-.015,.72);return}
  const surround=wooden?b.oak:b.stone;const jamb=wooden?.14:o.type==='gate'?.27:.16
  // An arcade post over the gateway stands on its lintel; the certified one
  // runs down through the passage's ceiling.
  const gates=wooden&&house?.carve?surroundZones(f).filter(q=>q.o.type==='gate'):[]
  for(const u of [x-jamb/2,x+w+jamb/2]){
    const foot=z-jamb/2,top=z+h+jamb/2,prior=surround.retire
    const head=Math.max(foot,...gates.filter(q=>q.u0<u+jamb/2&&q.u1>u-jamb/2&&q.z0<top&&q.z1>foot).map(q=>q.z1))
    surround.retire=prior||head>foot
    faceBox(surround,f,u,z+h/2,jamb,h+jamb,thickness+.11,.09)
    surround.retire=prior
    if(head>foot&&head<top){faceBox(house!.posts,f,u,(head+top)/2,jamb,top-head,thickness+.11,.09);house!.dressings.push({facade:f.id,u0:u-jamb/2,u1:u+jamb/2,z0:head,z1:top,front:.09})}
  }
  faceBox(surround,f,x+w/2,z+h+jamb/2,w+jamb*2,jamb,thickness+.11,.09)
  if(!open) {
    // A window's slab sill gives way to a weathered one cut with a drip;
    // a door's stays: it is the threshold a foot crosses.
    const recut=Boolean(house?.carve)&&o.type!=='door'
    b.stone.retire=recut
    faceBox(b.stone,f,x+w/2,z-.05,w+.40,.12,thickness+.24,.20,.88)
    faceBox(b.stone,f,x+w/2,z-.13,w+.29,.05,.22,.16,.82)
    b.stone.retire=false
    if(recut){house!.sills.push({from:f.from,to:f.to,length:f.length_m,x,w,z});house!.dressings.push({facade:f.id,u0:x-.12,u1:x+w+.12,z0:z-.10,z1:z+.012,front:.10})}
  }
  if(open){if(wooden){faceBox(b.oak,f,x+w/2,z+.64,w,.13,.17,.11);const left=facadePoint(f,x+.03,z+.08,.08),right=facadePoint(f,x+w-.03,z+.61,.08);beam(b.oak,left,right,.09);beam(b.oak,facadePoint(f,x+w-.03,z+.08,.08),facadePoint(f,x+.03,z+.61,.08),.09)}return}
  if(o.type==='door') {
    // The door is held open into the passage; the threshold remains traversable.
    const leaf=facadePoint(f,x+.02,z+h/2,-thickness-.43)
    // The entrance's leaf is drawn again, planked and ironed, by the great
    // hall's module inside this same volume; this one stays the certified solid.
    const redrawn=Boolean(house?.glaze)&&o.id==='entrance-door'
    b.oak.retire=redrawn;b.iron.retire=redrawn
    solid(b.oak,leaf,[.085,w*.91,h-.07],Math.atan2(f.to[1]-f.from[1],f.to[0]-f.from[0]),.72)
    for(let i=0;i<7;i++){const y=(i-3)*w*.12;solid(b.iron,[leaf[0]+y*(f.to[1]-f.from[1])/f.length_m,leaf[1]-y*(f.to[0]-f.from[0])/f.length_m,leaf[2]],[.025,.025,h-.14])}
    b.oak.retire=false;b.iron.retire=false
    drawPortal(f,x,z,w,h,b);return
  }
  if(o.type==='traceried-window') {
    // The glazed polygons and stone spandrels share exactly one contour.
    // Plain leaded glass is a period proposal; the modern painted panes are
    // reference-only. The paired lights retain the printed 1.80 m height.
    const panes=w>1.2?2:1, tip=z+(panes===2?Math.min(1.8,h-.04):h-.04)
    const spring=tip-(panes===2?.46:.40), contours:V3[][]=[]
    const pane=(poly:V3[],batch:Batch,out:number,tone:number):void=>batch.polygon(poly.map(v=>facadePoint(f,v[0],v[2],out)),v=>[
      (v[0]-f.from[0])*(f.to[0]-f.from[0])/f.length_m+(v[1]-f.from[1])*(f.to[1]-f.from[1])/f.length_m,v[2]],tone)
    // The carved tracery replaces the flat pieces below in the colour pass;
    // they stay in the buffer as the certified solids they always were.
    const carve=Boolean(house?.carve),glaze=Boolean(house?.glaze)
    b.dark.retire=Boolean(house?.openBacks.has(o.id))
    faceBox(b.dark,f,x+w/2,z+h/2,w,h,.025,-thickness-.24,.55)
    b.dark.retire=false
    const lancets:V2[][]=[],barLines:number[]=[]
    for(let i=0;i<panes;i++){
      const pw=w/panes-.10,px=x+i*w/panes+.05,mid=px+pw/2
      const contour:V3[]=[[px,0,z+.015],[px+pw,0,z+.015],[px+pw,0,spring]]
      // Twelve chords follow each pointed head, tangent to its upright.
      for(let j=1;j<=12;j++){const t=j/12;contour.push([px+pw-pw*.5*t*t,0,spring+(tip-spring)*t])}
      for(let j=11;j>=0;j--){const t=j/12;contour.push([px+pw*.5*t*t,0,spring+(tip-spring)*t])}
      contours.push(contour);lancets.push(contour.map(p=>[p[0],p[2]] as V2))
      const transom=z+(tip-z)*.63
      pane(clip(contour,p=>transom-p[2]),b.glass,-.055,.78)
      pane(clip(contour,p=>p[2]-transom),b.glassSky,-.055,.78)
      const arch=contour.slice(2)
      b.stone.retire=carve
      for(let j=0;j<arch.length-1;j++)beam(b.stone,facadePoint(f,arch[j]![0],arch[j]![2],.04),facadePoint(f,arch[j+1]![0],arch[j+1]![2],.04),.065)
      if(i>0)faceBox(b.stone,f,px-.05,z+(spring-z)/2,.10,spring-z,.15,.015)
      b.stone.retire=false
      const topAt=(u:number):number=>spring+(tip-spring)*Math.sqrt(Math.max(0,1-Math.abs(u-mid)/(pw/2)))
      b.iron.retire=glaze
      for(let j=1;j<3;j++){const u=px+j*pw/3,top=topAt(u);faceBox(b.iron,f,u,(z+.015+top)/2,.012,top-z-.015,.019,-.042,.75)}
      for(let v=z+.30;v<tip-.10;v+=.30){const t=Math.max(0,(v-spring)/(tip-spring)),inset=pw*.5*t*t;faceBox(b.iron,f,mid,v,pw-2*inset,.013,.019,-.042,.75);if(i===0)barLines.push(v)}
      b.iron.retire=false
    }
    const lobes:{centre:V2;radius:number}|null=panes===2?{centre:[x+w/2,z+h-.20],radius:.085}:null
    if(panes===2)for(let i=0;i<4;i++){
      const a=i*Math.PI/2,cx=x+w/2+Math.cos(a)*.085,cy=z+h-.20+Math.sin(a)*.085,disc:V3[]=[]
      b.stone.retire=carve
      for(let j=0;j<24;j++){const t=j*Math.PI/12,q=(j+1)*Math.PI/12;disc.push([cx+Math.cos(t)*.085,0,cy+Math.sin(t)*.085]);beam(b.stone,facadePoint(f,cx+Math.cos(t)*.094,cy+Math.sin(t)*.094,.04),facadePoint(f,cx+Math.cos(q)*.094,cy+Math.sin(q)*.094,.04),.024)}
      b.stone.retire=false
      contours.push(disc);pane(disc,b.glassSky,-.055,.78)
    }
    let spandrels:V3[][]=[[[x,0,z],[x+w,0,z],[x+w,0,z+h],[x,0,z+h]]]
    for(const contour of contours){const planes=contour.map((p,i)=>{const q=contour[(i+1)%contour.length]!;return{fn:(v:V3)=>(q[0]-p[0])*(v[2]-p[2])-(q[2]-p[2])*(v[0]-p[0])}});spandrels=spandrels.flatMap(poly=>subtract(poly,planes))}
    b.stone.retire=carve
    for(const poly of spandrels)pane(poly,b.stone,.005,.96)
    b.stone.retire=false
    if(house&&glaze){
      for(const [i,outline] of lancets.entries())house.lights.push(lightOf(f,`${o.id}-${i}`,outline,GLASS_OUT,'lancet',barLines))
      if(lobes)for(let i=0;i<4;i++){
        // Four convex pieces, one per lobe, parted along the cusps' diagonals.
        const a=i*Math.PI/2,c:V2=[lobes.centre[0]+Math.cos(a)*lobes.radius,lobes.centre[1]+Math.sin(a)*lobes.radius],piece:V2[]=[lobes.centre]
        for(let j=0;j<=12;j++){const t=a-Math.PI/2+j*Math.PI/12;piece.push([c[0]+Math.cos(t)*lobes.radius,c[1]+Math.sin(t)*lobes.radius])}
        house.lights.push(lightOf(f,`${o.id}-lobe-${i}`,piece,GLASS_OUT,'lobe',[]))
      }
    }
    if(house&&carve)house.tracery.push({id:o.id,from:f.from,to:f.to,length:f.length_m,x,z,w,h,thickness,lancets,mullions:lancets.slice(1).map((_,i)=>x+(i+1)*w/panes),lobes,glassOut:GLASS_OUT})
  } else {
    const mullion=h>1.6&&w>1?.12:.055;const transom=z+h*.63
    // A shallow 55 mm rebate remains visible under the street's raking view.
    // Upper panes admit a restrained sky reflection; lower panes retain the
    // dark room's response without screen-space transmission artefacts.
    faceBox(b.glass,f,x+w/2,z+h*.315,w-.07,h*.63-.035,.009,-.055,.78)
    faceBox(b.glassSky,f,x+w/2,z+h*.815,w-.07,h*.37-.035,.009,-.055,.78)
    // A dark inner reveal is spatial depth behind reflective small panes,
    // until a room is built behind the window.
    b.dark.retire=Boolean(house?.openBacks.has(o.id))
    faceBox(b.dark,f,x+w/2,z+h/2,w,h,.025,-thickness-.24,.55)
    b.dark.retire=false
    faceBox(b.stone,f,x+w/2,z+h/2,mullion,h,.19,-.02,.91)
    if(h>1.6)faceBox(b.stone,f,x+w/2,transom,w,.105,.20,-.005,.95)
    // Iron saddle bars hold the leaded panels; the quarries themselves are
    // in the glass, where a 7 mm came filters instead of aliasing.
    const bars=Math.max(2,Math.round(h/.44))
    b.iron.retire=Boolean(house?.glaze)
    for(let i=1;i<bars;i++)faceBox(b.iron,f,x+w/2,z+i*h/bars,w,.013,.02,-.040,.77)
    b.iron.retire=false
    if(house?.glaze){
      // The lights between jambs, mullion and transom, in the facade's frame.
      const barLines=Array.from({length:bars-1},(_,i)=>z+(i+1)*h/bars)
      const columns:[number,number][]=[[x,x+w/2-mullion/2],[x+w/2+mullion/2,x+w]]
      const rows:[number,number][]=h>1.6?[[z+.01,transom-.0525],[transom+.0525,z+h]]:[[z+.01,z+h]]
      for(const [ci,[u0,u1]] of columns.entries())for(const [ri,[v0,v1]] of rows.entries())
        house.lights.push(lightOf(f,`${o.id}-${ci}${ri}`,[[u0,v0],[u1,v0],[u1,v1],[u0,v1]],GLASS_OUT,'window',barLines))
    }
    // Two loose 25 mm fillets once stood proud of each jamb and never met
    // their head: from the court they read as a doubled jamb. They stay
    // certified and leave the colour pass.
    b.stone.retire=true
    for(const offset of [.035,.085]) {
      faceBox(b.stone,f,x-offset,z+h/2,.025,h+.05,.065,.095+offset/2)
      faceBox(b.stone,f,x+w+offset,z+h/2,.025,h+.05,.065,.095+offset/2)
      faceBox(b.stone,f,x+w/2,z+h+offset,w+offset*2,.025,.065,.095+offset/2)
    }
    b.stone.retire=false
    // Between two openings closer than a long stone and a hand, the jamb
    // stones fill the pier: a short stone left a sliver of brick between
    // the two surrounds. A window's right-hand pier is its neighbour's to
    // fill when that neighbour is a window too.
    const zones=house?.carve?surroundZones(f).filter(q=>q.o.id!==o.id):[]
    const plain=(q:Zone):boolean=>q.o.type!=='door'&&q.o.type!=='gate'&&q.o.type!=='open-arcade'&&q.o.type!=='traceried-window'
    for(let j=0;j<h/.28;j++){const len=j%2?.10:.23,zc=z+.14+j*.28,tone=.91+hash(j,x)*.09;for(const side of [-1,1]){
      const near=side<0?x-.16:x+w+.16,beside=zones.filter(q=>q.z0<zc+.1275&&q.z1>zc-.1275&&(side<0?q.u1<=near+1e-6:q.u0>=near-1e-6))
      const edge=beside.length?(side<0?Math.max(...beside.map(q=>q.u1)):Math.min(...beside.map(q=>q.u0))):NaN
      const neighbour=beside.find(q=>(side<0?q.u1:q.u0)===edge)
      const pier=neighbour!==undefined&&Math.abs(near-edge)<.33
      b.stone.retire=pier
      faceBox(b.stone,f,side<0?x-.16-len/2:x+w+.16+len/2,zc,len,.255,.065,.035,tone)
      if(pier&&!(side>0&&plain(neighbour)))redress(f,Math.min(near,edge),Math.max(near,edge),zc-.1275,zc+.1275,.065,.035,tone)
    }}
    b.stone.retire=false
  }
}
function drawPortal(f:Facade,x:number,z:number,w:number,h:number,b:Batches):void {
  const cx=x+w/2,top=z+h
  // The measured photograph provides form; the envelope follows its A opening.
  const arch:V2[]=[];for(let i=0;i<=24;i++){const a=Math.PI-i*Math.PI/24;arch.push([cx+Math.cos(a)*(w/2+.17),top-.18+Math.sin(a)*.24])}
  for(let i=1;i<arch.length;i++)beam(b.stone,facadePoint(f,arch[i-1]![0],arch[i-1]![1],.16),facadePoint(f,arch[i]![0],arch[i]![1],.16),.11,.16)
  const shoulders:V2[]=[[x-.19,top-.15],[x-.08,top+.25],[cx-.21,top+.52],[cx,top+.95],[cx+.21,top+.52],[x+w+.08,top+.25],[x+w+.19,top-.15]]
  for(let i=1;i<shoulders.length;i++)beam(b.stone,facadePoint(f,shoulders[i-1]![0],shoulders[i-1]![1],.16),facadePoint(f,shoulders[i]![0],shoulders[i]![1],.16),.085,.12)
  for(const side of [-1,1]){faceBox(b.stone,f,cx+side*(w/2+.27),top+.20,.11,.89,.13,.16);finial(b,facadePoint(f,cx+side*(w/2+.27),top+.66,.16),.24)}
  // A restrained feathered relief follows Q015, without a photographic sample.
  faceBox(b.stone,f,cx,top+.35,w*.90,.13,.07,.16,.96)
  for(const side of [-1,1])for(let i=0;i<7;i++){const px=cx+side*(.08+i*.048);const py=top+.56-i*.021;beam(b.stone,facadePoint(f,px,py,.19),facadePoint(f,px+side*.11,py-.13,.22),.045,.027)}
  faceBox(b.stone,f,cx,top+.52,.14,.27,.11,.23)
  const letters:Record<string,V2[][]>={D:[[[0,0],[0,1],[.6,.84],[.65,.22],[0,0]]],I:[[[.25,0],[.25,1]]],E:[[[.65,0],[0,0],[0,1],[.65,1]],[[0,.5],[.45,.5]]],V:[[[0,1],[.32,0],[.65,1]]],A:[[[0,0],[.32,1],[.65,0]],[[.16,.45],[.49,.45]]],N:[[[0,0],[0,1],[.65,0],[.65,1]]],T:[[[0,1],[.65,1]],[[.32,1],[.32,0]]],O:[[[.1,0],[0,.25],[0,.8],[.1,1],[.55,1],[.65,.8],[.65,.2],[.55,0],[.1,0]]]}
  const text='DIEV AVANT TOVT',scale=.065;let start=cx-text.length*scale*.42
  for(const letter of text){for(const line of letters[letter]??[])for(let i=1;i<line.length;i++)beam(b.dark,facadePoint(f,start+line[i-1]![0]*scale,top+.27+line[i-1]![1]*scale,.201),facadePoint(f,start+line[i]![0]*scale,top+.27+line[i]![1]*scale,.201),.004,.002);start+=scale*.84}
}
function drawRoofs(b:Batches,faces:RoofFace[],tier:Tier):void {
  for(const face of faces){let visible=[face.polygon]
    const underside=(p:V3):V3=>[p[0],p[1],p[2]-.07]
    const timber=timberPanelFrame(face.polygon.map(underside))
    for(const other of faces)if(other.id!==face.id)visible=visible.flatMap(p=>subtract(p,other.planes))
    // Exclude the projected dormer bodies from the parent slate surface.
    for(const dormer of spec.roof.dormers.filter(d=>d.segment===face.id)){
      const az=dormer.facing_deg*Math.PI/180,nx=Math.sin(az),ny=Math.cos(az),tx=Math.cos(az),ty=-Math.sin(az);const p=dormer.position;const hw=dormer.size_m[0]/2,dep=dormer.size_m[1]
      const planes:Plane[]=[{fn:a=>(a[0]-p[0])*tx+(a[1]-p[1])*ty+hw},{fn:a=>hw-((a[0]-p[0])*tx+(a[1]-p[1])*ty)},{fn:a=>(a[0]-p[0])*nx+(a[1]-p[1])*ny+dep},{fn:a=>.05-((a[0]-p[0])*nx+(a[1]-p[1])*ny)}]
      const base=p[2]-.9,peak=base+dormer.size_m[2],upper=base+dormer.size_m[2]*.72,slope=(peak-upper)/hw
      for(const sign of [-1,1])planes.push({fn:a=>peak-sign*((a[0]-p[0])*tx+(a[1]-p[1])*ty)*slope-a[2]})
      visible=visible.flatMap(poly=>subtract(poly,planes))
    }
    for(const poly of visible){b.slate.polygon(poly,face.tex,.96+hash(poly[0]![0])* .10)
      b.oak.polygon([...poly].reverse().map(underside),timber.uv,.7,timber.seed)
      const min=Math.min(...poly.map(p=>face.tex(p)[1])),max=Math.max(...poly.map(p=>face.tex(p)[1]));const len=Math.hypot(...face.normal);const offset=(p:V3,h:number):V3=>[p[0]+face.normal[0]/len*h,p[1]+face.normal[1]/len*h,p[2]+face.normal[2]/len*h]
      // Course membership uses a 1 nm numerical grid; this is arithmetic
      // tolerance, not survey precision. Integer rows avoid accumulated drift.
      const courseNM=140000000, widthNM=13000000, minNM=Math.round(min*1e9), maxNM=Math.round(max*1e9)
      const firstCourse=Math.ceil(minNM/courseNM), endCourse=Math.ceil(maxNM/courseNM)
      for(let row=firstCourse;row<endCourse;row++){
        const v=row*courseNM/1e9, upper=(row*courseNM+widthNM)/1e9
        const strip=clip(clip(poly,p=>face.tex(p)[1]-v),p=>upper-face.tex(p)[1])
        if(strip.length<3)continue
        b.slate.polygon(strip.map(p=>offset(p,.009)),face.tex,.83)
      }
      // Thin eave edges retain the roof's weight against the sky.
      for(let i=0;i<poly.length;i++){const a=poly[i]!,c=poly[(i+1)%poly.length]!;if(Math.abs(a[2]-spec.roof.segments.find(r=>r.id===face.id)!.eaves_m)<.015&&Math.abs(c[2]-a[2])<.01){beam(b.oak,[a[0],a[1],a[2]-.045],[c[0],c[1],c[2]-.045],.10,.12)}}
    }
  }
  for(const roof of spec.roof.segments.filter(r=>r.type==='gable')) {
    const direction=sub(roof.ridge[1],roof.ridge[0]),length=Math.hypot(direction[0],direction[1])
    for(let i=0;i<roof.footprint.length;i++) {
      const a=roof.footprint[i]!,c=roof.footprint[(i+1)%roof.footprint.length]!,ex=c[0]-a[0],ey=c[1]-a[1]
      if(Math.abs(ex*direction[0]+ey*direction[1])/(Math.hypot(ex,ey)*length)>.2)continue
      const mid:V3=[(a[0]+c[0])/2,(a[1]+c[1])/2,roof.eaves_m]
      const registered=spec.facades.some(f=>f.render&&f.gable_segment===roof.id&&Math.hypot((f.from[0]+f.to[0])/2-mid[0],(f.from[1]+f.to[1])/2-mid[1])<2)
      if(registered)continue
      const peak=roof.ridge.reduce((p,q)=>Math.hypot(p[0]-mid[0],p[1]-mid[1])<Math.hypot(q[0]-mid[0],q[1]-mid[1])?p:q)
      const other=peak===roof.ridge[0]?roof.ridge[1]:roof.ridge[0],offset:V3=[(other[0]-peak[0])/length*.14,(other[1]-peak[1])/length*.14,0]
      const shift=(p:V3):V3=>[p[0]+offset[0],p[1]+offset[1],p[2]]
      const pa=shift([a[0],a[1],roof.eaves_m]),pc=shift([c[0],c[1],roof.eaves_m]),pt=shift(peak)
      b.brick.tri(pa,pc,pt);b.brick.tri(pc,pa,pt)
    }
  }
  for(const roof of spec.roof.segments){const [a,c]=roof.ridge
    if(roof.type==='gable'){const len=Math.hypot(...sub(c,a));const count=Math.ceil(len/.35)
      for(let i=0;i<count;i++){const p=lerp(a,c,i/count),q=lerp(a,c,(i+1)/count),m=lerp(p,q,.5);const hidden=faces.some(f=>f.id!==roof.id&&f.planes.slice(0,-1).every(pl=>pl.fn(m)>0)&&f.z(m[0],m[1])>m[2]+.05);if(hidden)continue;beam(b.lead,[p[0],p[1],p[2]+.035],[q[0],q[1],q[2]+.035],.24,.075)}
    }else if(roof.id!=='chapel-cover'){beam(b.iron,[a[0],a[1],a[2]-.07],[a[0],a[1],a[2]+.54],.045);solid(b.iron,[a[0],a[1],a[2]+.35],[.28,.03,.03])}
  }
  void tier
}
function drawDormer(d:Detail,b:Batches):void {
  const az=d.facing_deg*Math.PI/180;const t:V2=[-Math.cos(az),Math.sin(az)],n:V2=[Math.sin(az),Math.cos(az)]
  const w=d.size_m[0],depth=d.size_m[1],h=d.size_m[2];const p=d.position;const base=p[2]-.9
  const at=(x:number,z:number,inside=0):V3=>[p[0]+t[0]*x-n[0]*inside,p[1]+t[1]*x-n[1]*inside,z]
  const f=facadeFrom(d.id,[p[0]-t[0]*w/2,p[1]-t[1]*w/2],[p[0]+t[0]*w/2,p[1]+t[1]*w/2],'oak')
  const a=at(-w/2,base),c=at(w/2,base),upper=base+h*.72,peak=base+h
  // Where the house is glazed, the dark back leaves the camera for leaded
  // lights and the roof space behind them; it stays a certified solid.
  const glaze=Boolean(house?.glaze)
  b.dark.retire=glaze;b.dark.quad(a,c,at(w/2,upper),at(-w/2,upper));b.dark.retire=false
  b.oak.tri(at(-w/2,upper),at(w/2,upper),at(0,peak))
  if(glaze&&house){
    const x0=.075,x1=w-.075,z0=base+h*.035,z1=base+h*.685,mx=w/2,mz=base+h*.37,bar=.0325
    const panes:[number,number,number,number][]=[[x0,mx-bar,z0,mz-bar],[mx+bar,x1,z0,mz-bar],[x0,mx-bar,mz+bar,z1],[mx+bar,x1,mz+bar,z1]]
    for(const [i,[u0,u1,v0,v1]] of panes.entries())house.lights.push(lightOf(f,`${d.id}-${i}`,[[u0,v0],[u1,v0],[u1,v1],[u0,v1]],GLASS_OUT,'dormer',[]))
    house.dormers.push({id:d.id,centre:[p[0],p[1]],along:t,out:n,base,top:upper,width:w,depth})
  }
  for(const side of [-1,1]) {
    const edge=side*w/2;const cheek=[at(edge,base),at(edge,base,depth),at(edge,upper,depth),at(edge,upper)]
    const cap=[at(edge,upper,-.12),at(edge,upper,depth),at(0,peak,depth),at(0,peak,-.12)]
    b.slate.polygon(side<0?cheek.reverse():cheek);b.slate.polygon(side<0?cap.reverse():cap)
    beam(b.oak,at(edge,base,-.05),at(edge,upper,-.05),.11);beam(b.oak,at(edge,upper,-.13),at(0,peak,-.13),.12)
    // Pointed joinery has a shallow inward curve below its gable.
    const arc:V3[]=[];for(let i=0;i<=8;i++){const k=i/8;arc.push(at(side*(w*.40)*(1-k),upper-.20+Math.sin(k*Math.PI/2)*.31,-.065))}
    for(let i=1;i<arc.length;i++)beam(b.oak,arc[i-1]!,arc[i]!,.055)
  }
  faceBox(b.glass,f,w/2,base+h*.36,w-.15,h*.65,.012,-.045,.73)
  faceBox(b.oak,f,w/2,base+h*.36,.065,h*.71,.095,.05)
  faceBox(b.oak,f,w/2,base+h*.37,w,.065,.095,.06)
  faceBox(b.oak,f,w/2,base-.01,w+.14,.10,.18,.08)
  // A dormer's pane stands behind its own dark front panel and is never
  // seen, so the dormers keep their joinery and bars as they are.
  for(let i=1;i<4;i++)faceBox(b.iron,f,w/2,base+i*h*.17,w-.16,.018,.014,.025)
}
function drawChimney(d:Detail,b:Batches,faces:RoofFace[]):void {
  const p=d.position;const under=faces.filter(f=>f.planes.slice(0,-1).every(pl=>pl.fn([p[0],p[1],0])>=-.01));const roofZ=Math.max(7.7,...under.map(f=>f.z(p[0],p[1])))
  if(roofZ>=d.top_m-.12)return
  const h=d.top_m-roofZ+.22;const c:V3=[p[0],p[1],roofZ+h/2-.22];const angle=33*Math.PI/180
  solid(b.brick,c,[d.size_m[0],d.size_m[1],h],angle,.80)
  solid(b.stone,[p[0],p[1],roofZ+.035],[d.size_m[0]+.13,d.size_m[1]+.13,.16],angle,.61)
  for(const z of [d.top_m-.28,d.top_m-.09,d.top_m])solid(z===d.top_m-.28?b.brick:b.stone,[p[0],p[1],z],[d.size_m[0]+.12,d.size_m[1]+.12,.095],angle,.82)
  for(let i=0;i<d.pots;i++){const offset=(i-(d.pots-1)/2)*.43;const cx=p[0]-Math.sin(angle)*offset,cy=p[1]+Math.cos(angle)*offset
    const sides=8;for(let s=0;s<sides;s++){const a=s*Math.PI*2/sides,c=(s+1)*Math.PI*2/sides;const r=.115,rt=.082;b.clay.quad([cx+Math.cos(a)*r,cy+Math.sin(a)*r,d.top_m+.04],[cx+Math.cos(c)*r,cy+Math.sin(c)*r,d.top_m+.04],[cx+Math.cos(c)*rt,cy+Math.sin(c)*rt,d.top_m+.4],[cx+Math.cos(a)*rt,cy+Math.sin(a)*rt,d.top_m+.4])}
    solid(b.dark,[cx,cy,d.top_m+.392],[.12,.12,.008])
  }
}

/** One metre remains one metre; the group may be added directly to the site. */
export function createShell(tier:Tier,library?:MaterialLibrary):Group {
  const b: Batches={brick:new Batch(),stone:new Batch(),slate:new Batch(),oak:new Batch(true),iron:new Batch(),lead:new Batch(),glass:new Batch(),glassSky:new Batch(),dark:new Batch(),clay:new Batch()}
  // THE HOUSE'S OWN LAYER above the certified shell: live tiers that can
  // afford it get the leaded glazing, the rooms behind it and the carving;
  // calm keeps the flat panes and dark backs it was budgeted with.
  const full=tier!=='calm'
  const rooms=full?createHouseRooms(tier==='hero'?.45:.9):null
  // The carving is one more draw; standard stands at its draw ceiling.
  // The great hall is its own module's room; its four windows open too.
  house={glaze:full,carve:tier==='hero',openBacks:new Set([...(rooms?.openedBacks??[]),...(full?HALL_WINDOWS:[])]),lights:[],tracery:[],sills:[],dormers:[],stones:[],runsOn:new Set(),dressings:[],casting:new Set([b.stone,b.oak]),posts:new Batch(true)}
  const faces=roofFaces(),valleys=roofValleys(faces)
  const facades=spec.facades.filter(f=>f.render).map(f=>({...f,openings:f.openings.map(o=>({...o}))}))
  house.runsOn=runsOn(facades)
  // One through-gateway is cut in both exterior faces of the covered way.
  const court=facades.find(f=>f.id==='G5')!,street=facades.find(f=>f.id==='G1')!;const gate=court.openings.find(o=>o.type==='gate')!
  gate.height_m=gatePassageProvenance.dimensions.head_m-gate.base_m
  const center=facadePoint(court,gate.from_m+gate.width_m/2,0);const projected=((center[0]-street.from[0])*(street.to[0]-street.from[0])+(center[1]-street.from[1])*(street.to[1]-street.from[1]))/street.length_m
  street.openings.push({...gate,id:'gallery-gateway-street-reveal',from_m:projected-gate.width_m/2})
  for(const f of facades){const wall=spec.walls.find(w=>w.facade_id===f.id&&w.render);if(wall)drawFacade(f,wall,b,tier,faces)}
  // The chapel replaces the lower cadastral returns. Their upper shell
  // continues to the registered west eaves: A-HEIGHT derived closure.
  for(const id of ['F19','F20','F21']){const source=spec.facades.find(f=>f.id===id);if(source){const f={...source,render:true,openings:[]};drawFacade(f,{from:f.from,to:f.to,base_m:4.55,height_m:3.15,thickness_m:.6,render:true},b,tier,faces)}}
  const turret=spec.roof.turret
  for(let i=0;i<turret.footprint.length;i++){const a=turret.footprint[i]!,c=turret.footprint[(i+1)%turret.footprint.length]!;const f=facadeFrom(`turret-${i}`,a,c)
    drawFacade(f,{from:a,to:c,base_m:turret.base_m,height_m:turret.eaves_m-turret.base_m,thickness_m:.4,render:true},b,tier,faces)
    // Narrow dressed angles articulate the octagonal stair without a generic cylinder.
    faceBox(b.stone,f,.14,(turret.base_m+turret.eaves_m)/2,.28,turret.eaves_m-turret.base_m,.10,.07)
  }
  // The square tower has a distinct upper stage, independent of low services.
  const tower=spec.roof.segments.find(r=>r.id==='north-east-tower')!
  for(let i=0;i<tower.footprint.length;i++){const a=tower.footprint[i]!,c=tower.footprint[(i+1)%tower.footprint.length]!;const f=facadeFrom(`tower-crown-${i}`,a,c)
    const tx=(c[0]-a[0])/f.length_m,tn=(c[1]-a[1])/f.length_m
    for(const source of facades)for(const o of source.openings){
      if(!o.render||o.base_m+o.height_m<=5.08)continue
      const p=facadePoint(source,o.from_m+o.width_m/2,o.base_m)
      const along=(p[0]-a[0])*tx+(p[1]-a[1])*tn,away=(p[0]-a[0])*tn-(p[1]-a[1])*tx
      if(Math.abs(away)<.22&&along>0&&along<f.length_m)f.openings.push({...o,from_m:along-o.width_m/2})
    }
    drawFacade(f,{from:a,to:c,base_m:5.08,height_m:3.62,thickness_m:.6,render:true},b,tier,faces)
  }
  drawRoofs(b,faces,tier);for(const d of spec.roof.dormers)drawDormer(d,b);for(const d of spec.roof.chimneys)drawChimney(d,b,faces)
  // Append below-grade masonry after every existing emission, preserving the
  // original geometry prefix and adding no draw. Structure precedes relief.
  const foundationStart=b.stone.positions.length/3
  let foundationStructuralVertices=0
  for(const face of foundationPlinthFaces(tier)){
    b.stone.surfaceRole=face.structural?2:0
    const before=b.stone.positions.length/3
    for(let i=1;i<face.points.length-1;i++)b.stone.tri(face.points[0]!,face.points[i]!,face.points[i+1]!,face.uv[0],face.uv[i],face.uv[i+1],face.tone)
    if(face.structural)foundationStructuralVertices+=b.stone.positions.length/3-before
  }
  b.stone.surfaceRole=0
  const foundationRange={startVertex:foundationStart,structuralVertices:foundationStructuralVertices,allVertices:b.stone.positions.length/3-foundationStart,provenance:foundationPlinthProvenance}
  const group=new Group();group.name='vinci/registered-shell';group.userData['asset']='vinci/registered-shell';group.userData['certainty']='reconstructed'
  const unweld=typeof location!=='undefined'&&new URLSearchParams(location.search).has('noweld')
  const built=house;house=null
  // before any batch becomes a mesh: the faces read the map as they compile
  if(built){bakeDressingShadows(built.dressings);bakeDressingSky(built.dressings)}
  for(const [name,batch] of Object.entries(b) as [MatKey,Batch][]){if(!batch.positions.length)continue;const mesh=batch.mesh(surface(name,library,name==='slate'?valleys:[]));mesh.name=`vinci/shell/${name}`;mesh.userData['asset']=`vinci/shell-${name}`;if(name==='stone')mesh.userData['foundationPlinth']=foundationRange;if(name==='glass'||name==='glassSky')mesh.castShadow=false
    // The flat panes stay certified and leave the camera's layer.
    if((name==='glass'||name==='glassSky')&&built?.glaze)mesh.layers.set(RETIRED_LAYER)
    if(unweld){ // A/B preserves the exact same geometry and shading.
      const stride=18000;for(let start=0;start<batch.positions.length;start+=stride){const piece=new Batch();piece.positions=batch.positions.slice(start,start+stride);piece.uvs=batch.uvs.slice(start/3*2,(start+stride)/3*2);piece.tones=batch.tones.slice(start/3,(start+stride)/3);piece.roles=batch.roles.slice(start/3,(start+stride)/3);piece.retired=batch.retired.slice(start/3,(start+stride)/3);piece.oakSeeds=batch.oakSeeds.slice(start/3,(start+stride)/3);const part=piece.mesh(mesh.material as MeshStandardNodeMaterial);part.name=mesh.name;if(name==='stone'){const a=Math.max(start/3,foundationRange.startVertex),z=Math.min((start+stride)/3,foundationRange.startVertex+foundationRange.allVertices);if(z>a)part.userData['foundationPlinth']={...foundationRange,startVertex:a-start/3,structuralVertices:Math.max(0,Math.min(z,foundationRange.startVertex+foundationRange.structuralVertices)-a),allVertices:z-a}}group.add(part)}mesh.geometry.dispose()
    }else group.add(mesh)
  }
  // The house's own meshes join the shell as siblings of its batches, each
  // under its own manifest id, so the certified set is exactly what it was.
  const adopt=(g:Group):void=>{for(const child of [...g.children])group.add(child)}
  if(built?.glaze){const glazing=createHouseGlazing(built.lights,tier==='hero'?2:1);adopt(glazing.group);group.userData['glazing']={lights:built.lights.length,quarries:glazing.quarries,cames:glazing.cames,triangles:glazing.triangles,provenance:houseGlazingProvenance}}
  if(rooms){adopt(rooms.group);group.userData['rooms']={rooms:rooms.rooms,openedBacks:[...rooms.openedBacks],triangles:rooms.triangles,provenance:houseRoomsProvenance}}
  if(built?.dormers.length){const attic=createDormerRooms(built.dormers);if(attic.mesh)group.add(attic.mesh);group.userData['dormerRooms']={dormers:built.dormers.length,triangles:attic.triangles}}
  if(built?.carve&&built.posts.positions.length){const posts=built.posts.mesh(surface('oak',library));posts.name='vinci/house-tracery/arcade-posts';posts.userData['manifestId']=houseTraceryProvenance.manifestId;posts.userData['asset']=houseTraceryProvenance.manifestId;group.add(posts)}
  if(built?.carve&&(built.tracery.length||built.sills.length||built.stones.length)){const tracery=createHouseTracery(built.tracery,tier,library,built.sills,built.stones);adopt(tracery.group);group.userData['tracery']={windows:built.tracery.length,sills:built.sills.length,stones:built.stones.length,triangles:tracery.triangles,provenance:houseTraceryProvenance}}
  group.userData['foundationPlinth']=foundationPlinthProvenance
  group.userData['northValleys']=valleys
  group.userData['triangles']=Object.values(b).reduce((n,batch)=>n+batch.positions.length/9,0)
  group.userData['provenance']='Registered facades, real reveal cuts and unioned roofs from brief/building/closluce.json; procedural grain, brick bond, lead cames and carved envelope. Q001 Q015 Q019 Q124 Q127 Q131 Q134 Q175; no photographic texture.'
  return group
}

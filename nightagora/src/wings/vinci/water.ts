/** A-SITE water: retained Amasse alignment, assumed width, section and levels.
 * Modern mapped ponds are available only for an explicit present-site comparison.
 * No photograph, modern park fixture or unsourced horizontal water datum is used.
 */
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshPhysicalNodeMaterial,
  MeshStandardNodeMaterial, ShapeUtils, Vector2, DoubleSide, type Scene } from 'three/webgpu'
import * as TSL from 'three/tsl'
import raw from './data/closluce.json?raw'
import { surveyedHeight } from './site'
import type { Stack } from '../../stack'
import type { Reflection } from '../../stack/reflector'

type XY = [number, number]
type XYZ = [number, number, number]
interface Profile { xy: XY; water_level_m: number }
interface WaterFeature { id: string; geometry: XY[]; water_profile?: Profile[]; width_m?: number;
  depth_m: number; water_level_m?: number; period_action?: string }
export interface WaterCut { id: string; points: XY[]; levelAt: (e: number, n: number) => number; depth: number }
export interface WaterOptions { /** Requires a visible present-site comparison label. */ comparison?: boolean }
export type WaterGroup = Group & { dispose(): void }

function unwrap(x: unknown): unknown {
  if (!x || typeof x !== 'object') return x
  if ('value' in x) return (x as { value: unknown }).value
  if (Array.isArray(x)) return x.map(unwrap)
  return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, unwrap(v)]))
}
const features = (unwrap(JSON.parse(raw)) as { site: { features: WaterFeature[] } }).site.features
const stream = features.find(f => f.id === 'stream')!
const profile = stream.water_profile!
const ponds = features.filter(f => f.id.startsWith('pond-'))
const hash = (n: number): number => { const x = Math.sin(n * 127.1 + 63.2) * 43758.5453; return x - Math.floor(x) }
const cross2 = (a: XY, b: XY, p: XY): number => (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])
const area = (p: XY[]): number => p.reduce((s,a,i) => { const b=p[(i+1)%p.length]!; return s+a[0]*b[1]-b[0]*a[1] },0)/2
const ccw = (p: XY[]): XY[] => area(p)<0 ? [...p].reverse() : p
const lerp2 = (a: XY,b: XY,t: number): XY => [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]
function domainClip(input: XY[]): XY[] {
  let poly=input
  for(const test of [(p:XY)=>p[0]+200,(p:XY)=>200-p[0],(p:XY)=>p[1]+360,(p:XY)=>200-p[1]]) {
    const out:XY[]=[]
    for(let i=0;i<poly.length;i++){const a=poly[i]!,b=poly[(i+1)%poly.length]!,fa=test(a),fb=test(b);if(fa>=0)out.push(a);if((fa>0)!==(fb>0))out.push(lerp2(a,b,fa/(fa-fb)))}
    poly=out
  }
  return ccw(poly)
}
function offsetAt(i: number): XY {
  const a=profile[Math.max(0,i-1)]!.xy,b=profile[Math.min(profile.length-1,i+1)]!.xy
  const d:XY=[b[0]-a[0],b[1]-a[1]],l=Math.hypot(...d),normal:XY=[-d[1]/l,d[0]/l]
  const next=profile[Math.min(profile.length-1,i+1)]!.xy,current=profile[i]!.xy
  const segment=i===profile.length-1?[current[0]-a[0],current[1]-a[1]]:[next[0]-current[0],next[1]-current[1]]
  const sl=Math.hypot(...segment),cos=Math.abs(normal[0]*(-segment[1]!/sl)+normal[1]*(segment[0]!/sl))
  const width=(stream.width_m??2.8)/2/Math.max(.55,cos)
  return [normal[0]*width,normal[1]*width]
}
const edges=profile.map((p,i)=>{const o=offsetAt(i);return {left:[p.xy[0]+o[0],p.xy[1]+o[1]] as XY,right:[p.xy[0]-o[0],p.xy[1]-o[1]] as XY}})
const streamCuts:WaterCut[]=profile.slice(1).map((b,i)=>{
  const a=profile[i]!,dx=b.xy[0]-a.xy[0],dn=b.xy[1]-a.xy[1],length2=dx*dx+dn*dn
  const levelAt=(e:number,n:number):number=>a.water_level_m+(b.water_level_m-a.water_level_m)*Math.max(0,Math.min(1,((e-a.xy[0])*dx+(n-a.xy[1])*dn)/length2))
  return {id:`stream-${i}`,points:domainClip([edges[i]!.left,edges[i]!.right,edges[i+1]!.right,edges[i+1]!.left]),levelAt,depth:stream.depth_m}
})
const pondCuts:WaterCut[]=ponds.flatMap(pond=>{
  const outline=ccw(pond.geometry)
  return ShapeUtils.triangulateShape(outline.map(p=>new Vector2(...p)),[]).map(indices=>({id:pond.id,points:ccw(indices.map(i=>outline[i]!)),levelAt:()=>pond.water_level_m!,depth:pond.depth_m}))
})
/** Convex polygons: subtract these from the outdoor terrain, without changing IGN samples. */
export function getWaterCuts(comparison=false): WaterCut[] { return comparison?[...streamCuts,...pondCuts]:streamCuts }
export function waterBedAt(e:number,n:number,comparison=false): number|undefined {
  for(const cut of getWaterCuts(comparison))if(cut.points.every((p,i)=>cross2(p,cut.points[(i+1)%cut.points.length]!,[e,n])>=-1e-7))return cut.levelAt(e,n)-cut.depth
  return undefined
}

class GeometryBatch {
  positions:number[]=[];uvs:number[]=[]
  triangle(a:XYZ,b:XYZ,c:XYZ):void {for(const p of [a,b,c]){this.positions.push(p[0],p[2],-p[1]);this.uvs.push(p[0],p[1])}}
  top(points:XY[],height:(e:number,n:number)=>number):void {for(let i=1;i<points.length-1;i++)this.triangle(...[points[0]!,points[i]!,points[i+1]!].map(p=>[p[0],p[1],height(...p)] as XYZ) as [XYZ,XYZ,XYZ])}
  wall(a:XY,b:XY,za:number,zb:number,topA:number,topB:number):void {
    this.triangle([a[0],a[1],za],[b[0],b[1],zb],[b[0],b[1],topB]);this.triangle([a[0],a[1],za],[b[0],b[1],topB],[a[0],a[1],topA])
  }
  geometry():BufferGeometry {const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(this.positions,3));g.setAttribute('uv',new Float32BufferAttribute(this.uvs,2));g.computeVertexNormals();g.computeBoundingSphere();return g}
}
const {cameraPosition,positionWorld,normalWorld,mx_noise_float,mix,vec2,vec3,float,normalMap}=TSL
function waterMaterial():MeshPhysicalNodeMaterial {
  const m=new MeshPhysicalNodeMaterial({roughness:.16,metalness:0,ior:1.333,envMapIntensity:.75})
  const P=positionWorld,far=mx_noise_float(P.mul(.23)),ripple=mx_noise_float(P.mul(vec3(3.7,1,8.3))),fine=mx_noise_float(P.mul(57))
  m.colorNode=mix(vec3(.027,.045,.040),vec3(.055,.075,.055),far.mul(.5).add(.5)).mul(fine.mul(.025).add(1))
  m.roughnessNode=ripple.mul(.025).add(.16)
  m.normalNode=normalMap(vec3(ripple.mul(.035).add(.5),mx_noise_float(P.add(vec3(.07,0,.06)).mul(vec3(3.7,1,8.3))).mul(.035).add(.5),1),vec2(.35,.35))
  m.name='wing-vinci/amas se-water'.replace(' ','')
  return m
}
function bankMaterial():MeshStandardNodeMaterial {
  const m=new MeshStandardNodeMaterial({roughness:.96,side:DoubleSide}),P=positionWorld
  const broad=mx_noise_float(P.mul(.3)),grain=mx_noise_float(P.mul(9)),fine=mx_noise_float(P.mul(83))
  m.colorNode=mix(vec3(.09,.095,.054),vec3(.19,.16,.09),broad.mul(.5).add(.5)).mul(grain.mul(.12).add(1)).mul(fine.mul(.055).add(1))
  m.normalNode=normalMap(vec3(grain.mul(.06).add(.5),fine.mul(.025).add(.5),1),vec2(.35,.35));m.name='wing-vinci/channel-earth';return m
}

/** One planar pass, only when its surface is visible; calm retains identical water geometry. */
export function createWater(scene:Scene,stack:Stack,options:WaterOptions={}):WaterGroup {
  const group=new Group() as WaterGroup;group.name='wing-vinci/amas se'.replace(' ','')
  const cuts=getWaterCuts(options.comparison),ordinary=new GeometryBatch(),mirror=new GeometryBatch(),bed=new GeometryBatch(),banks=new GeometryBatch(),rushes=new GeometryBatch()
  // The longest constant-level reach is the first three profile points.
  // Its level is supplied (-9.963m), never a second assumed pond datum.
  const mirrorLevel=profile[0]!.water_level_m
  for(const cut of cuts){const reflects=cut.id.startsWith('stream-')&&cut.points.every(p=>Math.abs(cut.levelAt(...p)-mirrorLevel)<1e-6);(reflects?mirror:ordinary).top(cut.points,cut.levelAt);bed.top(cut.points,(e,n)=>cut.levelAt(e,n)-cut.depth)}
  const addBank=(a:XY,b:XY,level:(e:number,n:number)=>number,depth:number,seed:number):void=>{
    const distance=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.max(1,Math.ceil(distance/1.6))
    for(let i=0;i<steps;i++){
      const p=lerp2(a,b,i/steps),q=lerp2(a,b,(i+1)/steps)
      if([p,q].some(v=>v[0]<-200||v[0]>200||v[1]<-360||v[1]>200))continue
      const za=surveyedHeight(...p),zb=surveyedHeight(...q)
      banks.wall(p,q,level(...p)-depth,level(...q)-depth,za,zb)
      if(hash(seed+i)<.37&&za>level(...p)-.08&&za<level(...p)+.8)for(let blade=0;blade<3;blade++){
        const h=.35+hash(seed+i+blade*17)*.58,r=.10*hash(seed+i+blade*7),angle=hash(seed+i+blade*11)*Math.PI*2
        const centre:XY=[Math.max(-200,Math.min(200,p[0]+Math.cos(angle)*r)),Math.max(-360,Math.min(200,p[1]+Math.sin(angle)*r))],base=surveyedHeight(...centre),tip:XYZ=[centre[0]+Math.cos(angle)*h*.24,centre[1]+Math.sin(angle)*h*.24,base+h]
        const w=.012; rushes.triangle([centre[0]-w,centre[1],base],[centre[0]+w,centre[1],base],tip)
      }
    }
  }
  for(let i=0;i<streamCuts.length;i++)for(const side of ['left','right'] as const)addBank(edges[i]![side],edges[i+1]![side],streamCuts[i]!.levelAt,stream.depth_m,i*53+(side==='left'?0:13))
  if(options.comparison)for(const pond of ponds)for(let i=0;i<pond.geometry.length;i++)addBank(pond.geometry[i]!,pond.geometry[(i+1)%pond.geometry.length]!,()=>pond.water_level_m!,pond.depth_m,1000+i)
  const water=waterMaterial(),earth=bankMaterial(),reed=new MeshStandardNodeMaterial({color:'#777b42',roughness:.94,side:DoubleSide})
  // Fine blade geometry and varied lengths provide the smaller vegetation scales.
  reed.colorNode=mix(vec3(.16,.20,.055),vec3(.28,.25,.10),mx_noise_float(positionWorld.mul(8)).mul(.5).add(.5)).mul(mx_noise_float(positionWorld.mul(57)).mul(.05).add(1))
  const add=(name:string,b:GeometryBatch,m:MeshStandardNodeMaterial):Mesh=>{const mesh=new Mesh(b.geometry(),m);mesh.name=`wing-vinci/${name}`;mesh.userData['asset']=mesh.name;mesh.receiveShadow=true;group.add(mesh);return mesh}
  add('stream-water',ordinary,water);add('channel-bed',bed,earth);add('channel-bank',banks,earth);add('riparian-rush',rushes,reed)
  const reflective=add('stream-reflection',mirror,waterMaterial())
  let reflection:Reflection|undefined
  if(stack.tierName()!=='calm'){
    // Reflector contract is local XY; geometry is converted before the plane is rotated.
    const g=reflective.geometry,p=g.getAttribute('position'),n=g.getAttribute('normal')
    for(let i=0;i<p.count;i++){const e=p.getX(i),north=-p.getZ(i);p.setXYZ(i,e,north,0);n.setXYZ(i,0,0,1)}
    p.needsUpdate=true;n.needsUpdate=true;g.computeBoundingSphere();reflective.rotation.x=-Math.PI/2;reflective.position.y=mirrorLevel
    group.updateWorldMatrix(true,true);reflection=stack.reflector(reflective,{resolutionScale:.5,bounces:false,generateMipmaps:false})
    const view=cameraPosition.sub(positionWorld).normalize(),fresnel=float(1).sub(normalWorld.dot(view).abs()).pow(5).mul(.978).add(.022)
    const material=reflective.material as MeshPhysicalNodeMaterial
    material.colorNode=material.colorNode!.mul(float(1).sub(fresnel));material.emissiveNode=reflection.node.rgb.mul(fresnel.mul(.85))
    reflective.userData['reflection']='One planar scene pass, half resolution, no bounces; calm uses the installed environment.'
  }
  group.userData['certainty']=options.comparison?'modern-reference':'reconstructed'
  group.userData['provenance']='OSM contributors ODbL1.0: dossier clipped Amasse water_profile; A-SITE width2.8m, depth0.5m, supplied water levels. IGN165-sample ground retained; exact cut banks. Procedural2026-09-09, no source textures.'
  group.userData['comparisonPonds']=Boolean(options.comparison)
  group.userData['triangles']=group.children.reduce((s,o)=>s+(o as Mesh).geometry.getAttribute('position').count/3,0)
  group.dispose=()=>{reflection?.dispose();const materials=new Set<MeshStandardNodeMaterial>();group.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();materials.add(o.material as MeshStandardNodeMaterial)}});for(const material of materials)material.dispose();group.removeFromParent()}
  void scene
  return group
}

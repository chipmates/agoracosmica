/**
 * Geometry-derived visibility toward the picture room's one north-window key.
 * Unlike the retired hemisphere receiver, this bake cannot paint an even halo:
 * every ray points into a small disk around the SAME declared key direction.
 * Cast silhouettes therefore fall below/right of raised joinery and supports.
 *
 * This is a generated, composited direct-shadow approximation for shadow maps
 * whose world texels cannot resolve centimetre-deep frames. `strength` is the
 * declared fraction of final wall radiance suppressed by a fully blocked key;
 * it is not a measurement of illuminance, ambient occlusion, or diffuse GI.
 * Keep the actual stack key and its shadows. Set strength=0 when those resolve
 * the joinery adequately, avoiding an additional composite attenuation.
 *
 * Source meshes and receivers are in the supplied group's local metre space;
 * wall z=0 faces +Z. Pass the actual key direction transformed into that space
 * if the owner rotates the hang or changes its illumination. The default is
 * exactly the bench's azimuth 235°, elevation 34° convention in stack/light.ts.
 * Sources can contain both welded mouldings and opaque picture supports.
 */
import {
  BufferAttribute, BufferGeometry, Group, Matrix4, Mesh,
  MeshBasicNodeMaterial, Vector3, type Object3D,
} from 'three/webgpu'
import type { FramePlacement } from './frame'
import type { ContactBakeStats } from './contact'

type Triple = [number, number, number]
export const DIRECTIONAL_CONTACT_RECIPE = Object.freeze({
  version: 1,
  method: 'actual-triangle visibility toward one finite directional source',
  azimuthDeg: 235,
  elevationDeg: 34,
  raysPerReceiver: 25,
  angularRadiusDeg: 9,
  strength: .17,
  nearGridM: .006,
  interiorGridM: .035,
  rayMaxM: .60,
  wallRayOriginM: .00005,
  receiverOffsetM: .0006,
  ambientTerm: 0,
  /** The smallest standoff a per-aperture ray disk may keep from the wall.
   * Far along the run the opening is almost edge-on and the geometric
   * shadow runs away without end; this is the declared stop. */
  minStandoff: .42,
})
/** Compatibility with callers that expose the recipe under the old name. */
export const CONTACT_BAKE_RECIPE = DIRECTIONAL_CONTACT_RECIPE

export interface DirectionalContactOptions {
  /** Unit or non-unit vector FROM the receiver TOWARD the scene's one key. */
  direction?: readonly [number, number, number]
  /** The room's opening, in the same local metres. Given it, every frame
   * takes its own direction toward that one window instead of a single
   * declared vector: near the glass a shadow drops, far along the run the
   * light is grazing and the shadow leans away from it. One window, one
   * direction per receiver, never a second light. */
  aperture?: { readonly x: number; readonly y: number; readonly z: number }
  /** Artistic size of the same source; no second light is introduced. */
  angularRadiusDeg?: number
  /** Approximate key fraction of the final wall radiance, in [0,1]. */
  strength?: number
}
export type ResolvedDirectionalContactRecipe = Omit<typeof DIRECTIONAL_CONTACT_RECIPE,
  'azimuthDeg' | 'elevationDeg' | 'angularRadiusDeg' | 'strength'> & {
  azimuthDeg: number
  elevationDeg: number
  direction: Triple
  angularRadiusDeg: number
  strength: number
  aperture: { x: number; y: number; z: number } | null
  /** One per frame when the aperture drives them, in placement order. */
  frameDirections: Triple[] | null
}
export interface DirectionalContactStats extends ContactBakeStats {
  direction: Triple
  angularRadiusDeg: number
  strength: number
  /** Maximum receiver alpha, after the declared radiance fraction. */
  peakOpacity: number
  recipe: ResolvedDirectionalContactRecipe
}
interface Triangle {
  a: Triple; e1: Triple; e2: Triple
  low: Triple; high: Triple; centre: Triple
}
interface Branch { low: Triple; high: Triple; left?: Branch; right?: Branch; triangles?: Triangle[] }
interface Bounds { low: Triple; high: Triple; count: number }
interface Patch { id: string; positions: Float32Array; colours: Float32Array; indices: Uint32Array }
interface Clip { low: [number, number]; high: [number, number] }
const RECIPE = DIRECTIONAL_CONTACT_RECIPE

function triangle(a: Vector3, b: Vector3, c: Vector3): Triangle {
  return {
    a: a.toArray() as Triple,
    e1: b.clone().sub(a).toArray() as Triple,
    e2: c.clone().sub(a).toArray() as Triple,
    low: [Math.min(a.x,b.x,c.x),Math.min(a.y,b.y,c.y),Math.min(a.z,b.z,c.z)],
    high: [Math.max(a.x,b.x,c.x),Math.max(a.y,b.y,c.y),Math.max(a.z,b.z,c.z)],
    centre: [(a.x+b.x+c.x)/3,(a.y+b.y+c.y)/3,(a.z+b.z+c.z)/3],
  }
}
function sourceTriangles(group: Object3D): Triangle[] {
  group.updateWorldMatrix(true, true)
  const inverse = group.matrixWorld.clone().invert(), transform = new Matrix4()
  const a = new Vector3(), b = new Vector3(), c = new Vector3()
  const result: Triangle[] = []
  group.traverse(object => {
    if (!(object instanceof Mesh)) return
    if ('isInstancedMesh' in object && object.isInstancedMesh)
      throw new Error('Directional contact requires welded meshes, not unexpanded instance transforms')
    const position = object.geometry.getAttribute('position')
    if (!position) return
    transform.multiplyMatrices(inverse, object.matrixWorld)
    const index = object.geometry.getIndex(), count = index?.count ?? position.count
    const start = object.geometry.drawRange.start
    const end = Math.min(count, start + object.geometry.drawRange.count)
    for (let i=start;i+2<end;i+=3) {
      a.fromBufferAttribute(position,index ? index.getX(i) : i).applyMatrix4(transform)
      b.fromBufferAttribute(position,index ? index.getX(i+1) : i+1).applyMatrix4(transform)
      c.fromBufferAttribute(position,index ? index.getX(i+2) : i+2).applyMatrix4(transform)
      if (![...a.toArray(),...b.toArray(),...c.toArray()].every(Number.isFinite))
        throw new Error('Directional contact found a non-finite source vertex')
      if (b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 1e-20)
        result.push(triangle(a,b,c))
    }
  })
  return result
}
function tree(triangles: Triangle[]): Branch {
  const low: Triple = [Infinity,Infinity,Infinity], high: Triple = [-Infinity,-Infinity,-Infinity]
  for (const t of triangles) for (let i=0;i<3;i++) {
    low[i] = Math.min(low[i]!,t.low[i]!); high[i] = Math.max(high[i]!,t.high[i]!)
  }
  if (triangles.length<=8) return { low,high,triangles }
  const size = high.map((v,i)=>v-low[i]!)
  const axis = size[0]!>=size[1]! && size[0]!>=size[2]! ? 0 : size[1]!>=size[2]! ? 1 : 2
  triangles.sort((a,b)=>a.centre[axis]!-b.centre[axis]!)
  const half = triangles.length>>1
  return { low,high,left:tree(triangles.slice(0,half)),right:tree(triangles.slice(half)) }
}
function directions(direction: Vector3, angularRadiusDeg: number): Triple[] {
  const tangent = new Vector3(0,1,0).cross(direction).normalize()
  const bitangent = direction.clone().cross(tangent).normalize()
  const radius = Math.tan(angularRadiusDeg*Math.PI/180)
  return Array.from({ length: RECIPE.raysPerReceiver },(_,i)=>{
    // Hammersley quadrature over projected source area, not hemisphere area.
    let bits=i,inverse=0,scale=.5
    while (bits) { inverse+=(bits&1)*scale;bits>>>=1;scale*=.5 }
    const r=radius*Math.sqrt((i+.5)/RECIPE.raysPerReceiver), angle=2*Math.PI*(inverse+.17320508075688773)
    return direction.clone().addScaledVector(tangent,r*Math.cos(angle))
      .addScaledVector(bitangent,r*Math.sin(angle)).normalize().toArray() as Triple
  })
}
function intersectsTriangle(t: Triangle,x:number,y:number,d:Triple): boolean {
  const px=d[1]*t.e2[2]-d[2]*t.e2[1],py=d[2]*t.e2[0]-d[0]*t.e2[2],pz=d[0]*t.e2[1]-d[1]*t.e2[0]
  const det=t.e1[0]*px+t.e1[1]*py+t.e1[2]*pz
  if (Math.abs(det)<1e-12) return false
  const inverse=1/det,tx=x-t.a[0],ty=y-t.a[1],tz=RECIPE.wallRayOriginM-t.a[2]
  const u=(tx*px+ty*py+tz*pz)*inverse
  if (u< -1e-8 || u>1+1e-8) return false
  const qx=ty*t.e1[2]-tz*t.e1[1],qy=tz*t.e1[0]-tx*t.e1[2],qz=tx*t.e1[1]-ty*t.e1[0]
  const v=(d[0]*qx+d[1]*qy+d[2]*qz)*inverse
  if (v< -1e-8 || u+v>1+1e-8) return false
  const distance=(t.e2[0]*qx+t.e2[1]*qy+t.e2[2]*qz)*inverse
  return distance>1e-6 && distance<=RECIPE.rayMaxM
}
function blocked(root:Branch,x:number,y:number,d:Triple,stats:ContactBakeStats): boolean {
  stats.boundsTests++
  let near:number=0,far:number=RECIPE.rayMaxM
  for (let axis=0;axis<3;axis++) {
    const origin=axis===0 ? x : axis===1 ? y : RECIPE.wallRayOriginM
    if (Math.abs(d[axis]!)<1e-12) {
      if (origin<root.low[axis]! || origin>root.high[axis]!) return false
      continue
    }
    const a=(root.low[axis]!-origin)/d[axis]!,b=(root.high[axis]!-origin)/d[axis]!
    near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b))
    if (near>far) return false
  }
  if (root.triangles) {
    for (const t of root.triangles) { stats.triangleTests++;if (intersectsTriangle(t,x,y,d)) return true }
    return false
  }
  return blocked(root.left!,x,y,d,stats) || blocked(root.right!,x,y,d,stats)
}
function projectedBounds(source:readonly Triangle[],rays:readonly Triple[]): Bounds {
  const bounds:Bounds={low:[Infinity,Infinity,Infinity],high:[-Infinity,-Infinity,-Infinity],count:source.length}
  for (const t of source) for (const p of [t.a,t.a.map((v,i)=>v+t.e1[i]!) as Triple,t.a.map((v,i)=>v+t.e2[i]!) as Triple]) {
    if (p[2]<=RECIPE.wallRayOriginM) continue
    for (const d of rays) {
      const travel=(p[2]-RECIPE.wallRayOriginM)/d[2]
      if (travel>RECIPE.rayMaxM) continue
      const projected:Triple=[p[0]-travel*d[0],p[1]-travel*d[1],0]
      for (let i=0;i<3;i++) { bounds.low[i]=Math.min(bounds.low[i]!,projected[i]!);bounds.high[i]=Math.max(bounds.high[i]!,projected[i]!) }
    }
  }
  return bounds
}
function axisGrid(low:number,high:number,innerLow:number,innerHigh:number): number[] {
  const breaks=[low,innerLow,innerHigh,high].filter(v=>v>=low && v<=high).sort((a,b)=>a-b)
  const points:number[]=[]
  for (let i=0;i+1<breaks.length;i++) {
    const a=breaks[i]!,b=breaks[i+1]!
    if (b<=a) continue
    const step=a>=innerLow && b<=innerHigh ? RECIPE.interiorGridM : RECIPE.nearGridM
    const count=Math.max(1,Math.ceil((b-a)/step))
    for (let j=0;j<count;j++) points.push(a+(b-a)*j/count)
  }
  points.push(high)
  return points
}
function patch(f:FramePlacement,bounds:Bounds,clip:Clip,root:Branch,rays:Triple[],stats:DirectionalContactStats): Patch {
  const empty=():Patch=>({id:f.id,positions:new Float32Array(),colours:new Float32Array(),indices:new Uint32Array()})
  if (!Number.isFinite(bounds.low[0])) return empty()
  const margin=RECIPE.nearGridM
  const lowX=Math.max(clip.low[0],bounds.low[0]-margin),highX=Math.min(clip.high[0],bounds.high[0]+margin)
  const lowY=Math.max(clip.low[1],bounds.low[1]-margin),highY=Math.min(clip.high[1],bounds.high[1]+margin)
  if (lowX>=highX || lowY>=highY) return empty()
  const xs=axisGrid(lowX,highX,f.x-f.width/2,f.x+f.width/2)
  const ys=axisGrid(lowY,highY,f.y-f.height/2,f.y+f.height/2)
  const positions:number[]=[],colours:number[]=[],indices:number[]=[]
  const vertices=new Map<number,number>()
  const receiver=(ix:number,iy:number):number=>{
    const key=iy*xs.length+ix,old=vertices.get(key)
    if (old!==undefined) return old
    const x=xs[ix]!,y=ys[iy]!
    let hits=0
    for (const d of rays) if (blocked(root,x,y,d,stats)) hits++
    const occlusion=hits/rays.length,alpha=occlusion*stats.strength
    stats.receivers++;stats.rays+=rays.length;stats.blockedRays+=hits
    stats.peakOcclusion=Math.max(stats.peakOcclusion,occlusion)
    stats.peakOpacity=Math.max(stats.peakOpacity,alpha)
    const index=positions.length/3
    positions.push(x,y,RECIPE.receiverOffsetM);colours.push(0,0,0,alpha);vertices.set(key,index)
    return index
  }
  for (let iy=0;iy+1<ys.length;iy++) for (let ix=0;ix+1<xs.length;ix++) {
    const x=(xs[ix]!+xs[ix+1]!)/2,y=(ys[iy]!+ys[iy+1]!)/2
    // An opaque painting/support covers its aperture; no wall receiver goes there.
    if (Math.abs(x-f.x)<f.width/2 && Math.abs(y-f.y)<f.height/2) continue
    const a=receiver(ix,iy),b=receiver(ix+1,iy),c=receiver(ix+1,iy+1),d=receiver(ix,iy+1)
    if (colours[a*4+3] || colours[b*4+3] || colours[c*4+3] || colours[d*4+3]) indices.push(a,b,c,a,c,d)
  }
  return { id:f.id,positions:new Float32Array(positions),colours:new Float32Array(colours),indices:new Uint32Array(indices) }
}

/** Drop-in handle for buildBakedFrameContact, with optional actual key settings. */
export function buildBakedFrameContact(sourceGroup:Object3D,frames:readonly FramePlacement[],options:DirectionalContactOptions={}): {
  group:Group;setVisible(ids?:readonly string[]):void;dispose():void;stats:DirectionalContactStats
} {
  const started=performance.now(),ids=new Set<string>()
  for (const f of frames) {
    if (ids.has(f.id) || ![f.x,f.y,f.width,f.height].every(Number.isFinite) || f.width<=0 || f.height<=0)
      throw new Error(`Invalid directional contact placement: ${f.id}`)
    ids.add(f.id)
  }
  const az=RECIPE.azimuthDeg*Math.PI/180,el=RECIPE.elevationDeg*Math.PI/180
  const direction=options.direction ? new Vector3(...options.direction)
    : new Vector3(Math.sin(az)*Math.cos(el),Math.sin(el),-Math.cos(az)*Math.cos(el))
  const angularRadiusDeg=options.angularRadiusDeg ?? RECIPE.angularRadiusDeg,strength=options.strength ?? RECIPE.strength
  if (![...direction.toArray(),angularRadiusDeg,strength].every(Number.isFinite) || direction.lengthSq()<1e-12
    || angularRadiusDeg<0 || angularRadiusDeg>12 || strength<0 || strength>1)
    throw new Error('Invalid directional contact key/source settings')
  direction.normalize()
  if (direction.z<=Math.sin(angularRadiusDeg*Math.PI/180)+.02)
    throw new Error('Directional contact source disk must stand in front of the wall')
  const window=options.aperture ?? null
  if (window && ![window.x,window.y,window.z].every(Number.isFinite))
    throw new Error('Invalid directional contact aperture')
  /** The direction one frame's own receivers point in. Without an aperture
   * every frame shares the declared vector; with one, each looks at the
   * window it is actually lit by, lifted off the wall by the declared stop. */
  const towardWindow=(f:FramePlacement):Vector3=>{
    if (!window) return direction
    const v=new Vector3(window.x-f.x,window.y-f.y,window.z).normalize()
    if (v.z<RECIPE.minStandoff) {
      const k=Math.sqrt((1-RECIPE.minStandoff**2)/Math.max(1e-9,1-v.z**2))
      v.set(v.x*k,v.y*k,RECIPE.minStandoff)
    }
    if (v.z<=Math.sin(angularRadiusDeg*Math.PI/180)+.02)
      throw new Error('Directional contact source disk must stand in front of the wall')
    return v
  }
  const frameDirection=frames.map(towardWindow)
  const frameRays=frameDirection.map(d=>directions(d,angularRadiusDeg))
  const rays=directions(direction,angularRadiusDeg)
  const triangles=sourceTriangles(sourceGroup)
  const stats:DirectionalContactStats={sourceTriangles:triangles.length,frames:frames.length,receivers:0,rays:0,
    blockedRays:0,triangleTests:0,boundsTests:0,bakeMs:0,peakOcclusion:0,visibleFrames:0,visibleTriangles:0,cpuBytes:0,
    direction:direction.toArray() as Triple,angularRadiusDeg,strength,peakOpacity:0,
    recipe:{...RECIPE,azimuthDeg:(Math.atan2(direction.x,-direction.z)*180/Math.PI+360)%360,
      elevationDeg:Math.asin(direction.y)*180/Math.PI,direction:direction.toArray() as Triple,angularRadiusDeg,strength,
      aperture:window ? {...window} : null,
      frameDirections:window ? frameDirection.map(d=>d.toArray() as Triple) : null}}
  const owned=frames.map(()=>[] as Triangle[])
  for (const t of triangles) {
    let nearest=-1,distance=Infinity
    for (let i=0;i<frames.length;i++) {
      const f=frames[i]!,dx=Math.abs(t.centre[0]-f.x)-f.width/2,dy=Math.abs(t.centre[1]-f.y)-f.height/2
      // Interior supports belong to the aperture containing them. Edge strips
      // belong to their nearest aperture perimeter. Main-row spacing disambiguates.
      const gap=dx<=0 && dy<=0 ? Math.max(dx,dy) : Math.hypot(Math.max(0,dx),Math.max(0,dy))
      if (gap<distance) {distance=gap;nearest=i}
    }
    if (nearest>=0) owned[nearest]!.push(t)
  }
  const bounds=owned.map((source,i)=>projectedBounds(source,frameRays[i]!))
  const all=frames.map((_,i)=>i)
  const bake=(active:number[]):Patch[]=>{
    if (!strength) return []
    const source=active.flatMap(i=>owned[i]!)
    if (!source.length) return []
    const root=tree(source),clips:Clip[]=frames.map(()=>({low:[-Infinity,-Infinity],high:[Infinity,Infinity]}))
    // Partition overlapping horizontal patches; all rays still see the union
    // of active sources. Thus shared wall pixels are never darkened twice.
    const sorted=[...active].sort((a,b)=>frames[a]!.x-frames[b]!.x)
    for (let j=0;j+1<sorted.length;j++) {
      const a=sorted[j]!,b=sorted[j+1]!
      const split=(frames[a]!.x+frames[a]!.width/2+frames[b]!.x-frames[b]!.width/2)/2
      clips[a]!.high[0]=split;clips[b]!.low[0]=split
    }
    return active.map(i=>patch(frames[i]!,bounds[i]!,clips[i]!,root,frameRays[i]!,stats))
  }
  const keyFor=(active:number[])=>JSON.stringify(active.map(i=>frames[i]!.id))
  const cache=new Map<string,Patch[]>(),fullKey=keyFor(all)
  cache.set(fullKey,bake(all));cache.set('[]',[])
  if (frames.length>1) for (const i of all) cache.set(keyFor([i]),bake([i]))
  let partial:string|null=null,selection:string|null=null,geometry:BufferGeometry|null=null,disposed=false
  const group=new Group()
  group.name='vinci/pictures/directional-frame-contact'
  group.userData['manifestId']='vinci/pictures/frame-contact'
  group.userData['recipe']=stats.recipe
  group.userData['contactStats']=stats
  const material=new MeshBasicNodeMaterial({color:0x000000,vertexColors:true,transparent:true,depthWrite:false,depthTest:true})
  material.name='vinci/pictures/one-key-visibility'
  material.userData['manifestId']='vinci/pictures/frame-contact'
  const cachedBytes=()=>{let bytes=0;for(const patches of cache.values())for(const p of patches)bytes+=p.positions.byteLength+p.colours.byteLength+p.indices.byteLength;return bytes}
  const setVisible=(visibleIds?:readonly string[]):void=>{
    if (disposed) return
    const admitted=visibleIds===undefined ? null : new Set(visibleIds)
    const active=all.filter(i=>!admitted || admitted.has(frames[i]!.id)),key=keyFor(active)
    if (selection===key) return
    selection=key
    if (!cache.has(key)) {
      if (partial) cache.delete(partial)
      const begin=performance.now();cache.set(key,bake(active));stats.bakeMs+=performance.now()-begin;partial=key
    }
    const visible=cache.get(key)!.filter(p=>p.indices.length)
    group.clear();geometry?.dispose();geometry=null
    stats.visibleFrames=visible.length;stats.visibleTriangles=visible.reduce((n,p)=>n+p.indices.length/3,0)
    stats.cpuBytes=cachedBytes();group.userData['receiverRanges']=[]
    if (!visible.length) return
    const vertexCount=visible.reduce((n,p)=>n+p.positions.length/3,0)
    const positions=new Float32Array(vertexCount*3),colours=new Float32Array(vertexCount*4),normals=new Float32Array(vertexCount*3)
    const indices=new Uint32Array(stats.visibleTriangles*3)
    let vertexOffset=0,indexOffset=0
    for (const p of visible) {
      group.userData['receiverRanges'].push({id:p.id,firstVertex:vertexOffset,vertexCount:p.positions.length/3})
      positions.set(p.positions,vertexOffset*3);colours.set(p.colours,vertexOffset*4)
      for(let i=0;i<p.indices.length;i++) indices[indexOffset+i]=p.indices[i]!+vertexOffset
      vertexOffset+=p.positions.length/3;indexOffset+=p.indices.length
    }
    for(let i=2;i<normals.length;i+=3) normals[i]=1
    geometry=new BufferGeometry()
    geometry.setAttribute('position',new BufferAttribute(positions,3));geometry.setAttribute('color',new BufferAttribute(colours,4))
    geometry.setAttribute('normal',new BufferAttribute(normals,3));geometry.setIndex(new BufferAttribute(indices,1))
    geometry.computeBoundingBox();geometry.computeBoundingSphere()
    stats.cpuBytes+=positions.byteLength+colours.byteLength+normals.byteLength+indices.byteLength
    const mesh=new Mesh(geometry,material);mesh.name='vinci/pictures/directional-contact-batch'
    mesh.userData['manifestId']='vinci/pictures/frame-contact';group.add(mesh)
  }
  setVisible();stats.bakeMs=performance.now()-started
  return {group,setVisible,stats,dispose(){
    if(disposed)return
    disposed=true;group.removeFromParent();group.clear();geometry?.dispose();geometry=null;material.dispose()
    cache.clear();owned.length=0;triangles.length=0;stats.cpuBytes=0;stats.visibleFrames=0;stats.visibleTriangles=0
  }}
}
export const buildDirectionalFrameContact=buildBakedFrameContact

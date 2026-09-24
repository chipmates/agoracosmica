/** Original procedural construction surfaces, 2026-09-09.
 * Q001/Q124/Q127/Q019 are form/appearance references only. No site photograph
 * is sampled. The existing CC0 Tiles143 set contributes limited fine grain.
 * Positions, nominal courses and openings remain exactly those of shell.ts.
 */
import { BufferGeometry, Color, Float32BufferAttribute, MeshStandardNodeMaterial } from 'three/webgpu'
import * as TSL from 'three/tsl'
import type { MaterialLibrary } from '../../stack/materials'
import raw from './data/closluce.json?raw'
import {aggregateField} from './mineral-microstructure'
import {denseMineralBody,denseMineralProvenance} from './dense-mineral-body'
import {slateFiniteFinish,slateFiniteProvenance} from './slate-microstructure'
import {oakFiniteFinish,oakFiniteProvenance} from './oak-microstructure'
import { anisotropicFootprint, coursedFace, dressedTuffeau } from './masonry-courses'
import { weatherAtlas, weatherUV } from './house-weather'
import { hourKey } from './site'

export type ShellSurfaceKind = 'brick' | 'stone' | 'slate' | 'oak'
// TSL overloads are composed at this one boundary, as in the shared stack.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { Fn, attribute, cameraPosition, cameraViewMatrix, clamp, float, floor, fract, length,
  mix, mx_noise_float, normalMap, normalWorldGeometry, positionView, positionWorld, smoothstep,
  texture, uv, vec2, vec3 } = TSL as unknown as Record<string,N>
const rgb=(hex:string):N=>{const c=new Color(hex);return vec3(c.r,c.g,c.b)}
/** The hour's sun, toward it, in three's frame (x east, y up, z south). */
const SUN_AZ=hourKey.sun_azimuth_deg.value*Math.PI/180,SUN_EL=hourKey.sun_elevation_deg.value*Math.PI/180
const SUN_UP=Math.sin(SUN_EL),SUN=vec3(Math.sin(SUN_AZ)*Math.cos(SUN_EL),SUN_UP,-Math.cos(SUN_AZ)*Math.cos(SUN_EL))
interface Facade { from:[number,number];to:[number,number];length_m:number;render:boolean;
  id:string;pattern:{field:string};openings:{base_m:number;width_m:number;from_m:number;render:boolean;type:string}[] }
interface Wall {facade_id:string;base_m:number;height_m:number;render:boolean}
function unwrap(x:unknown):unknown {
  if(!x||typeof x!=='object')return x
  if('value'in x)return(x as{value:unknown}).value
  if(Array.isArray(x))return x.map(unwrap)
  return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,unwrap(v)]))
}
const dossier=unwrap(JSON.parse(raw)) as {facades:Facade[];walls:Wall[]}
const facades=dossier.facades.filter(f=>f.render).map(f=>{
  const dx=(f.to[0]-f.from[0])/f.length_m,dn=(f.to[1]-f.from[1])/f.length_m
  const wall=dossier.walls.find(w=>w.facade_id===f.id&&w.render)
  return{...f,dx,dn,top:wall?wall.base_m+wall.height_m:7.7,
    minE:Math.min(f.from[0],f.to[0])-.8,maxE:Math.max(f.from[0],f.to[0])+.8,
    minN:Math.min(f.from[1],f.to[1])-.8,maxN:Math.max(f.from[1],f.to[1])+.8}
})

/** Every door's threshold stone: its middle, the facade's direction, its
 * half width and its top, where feet have crossed for forty-six years. */
const thresholds=facades.flatMap(f=>f.openings.filter(o=>o.render&&o.type==='door').map(o=>{
  const mid=o.from_m+o.width_m/2
  return{e:f.from[0]+f.dx*mid,n:f.from[1]+f.dn*mid,dx:f.dx,dn:f.dn,half:o.width_m/2,top:o.base_m+.01}
}))

/** Recover a stable face origin from its metre UV frame. Each triangle gets
 * one seed; splitting a batch cannot change it. This is variation in proposed
 * timber appearance, not a change to the member's surveyed position.
 */
function prepareOakSeeds(geometry:BufferGeometry,panelSeeds?:readonly number[]):void {
  const p=geometry.getAttribute('position'),u=geometry.getAttribute('uv'),normal=geometry.getAttribute('normal'),seeds=new Float32Array(p.count)
  for(let i=0;i<p.count;i+=3){
    const panelSeed=panelSeeds?.[i]
    if(panelSeed!==undefined&&Number.isFinite(panelSeed)){
      seeds[i]=panelSeed;seeds[i+1]=panelSeed;seeds[i+2]=panelSeed;continue
    }
    const du1=u.getX(i+1)-u.getX(i),dv1=u.getY(i+1)-u.getY(i)
    const du2=u.getX(i+2)-u.getX(i),dv2=u.getY(i+2)-u.getY(i),det=du1*dv2-du2*dv1
    const tangentU:number[]=[],tangentV:number[]=[]
    for(let axis=0;axis<3;axis++){
      const b=p.getComponent(i+1,axis)-p.getComponent(i,axis),c=p.getComponent(i+2,axis)-p.getComponent(i,axis)
      tangentU.push(Math.abs(det)>1e-10?(b*dv2-c*dv1)/det:0)
      tangentV.push(Math.abs(det)>1e-10?(c*du1-b*du2)/det:0)
    }
    const spanU=Math.max(u.getX(i),u.getX(i+1),u.getX(i+2))-Math.min(u.getX(i),u.getX(i+1),u.getX(i+2))
    const spanV=Math.max(u.getY(i),u.getY(i+1),u.getY(i+2))-Math.min(u.getY(i),u.getY(i+1),u.getY(i+2))
    const metric=spanU>.001&&spanV>.001&&Math.abs(Math.hypot(...tangentU)-1)<.005&&Math.abs(Math.hypot(...tangentV)-1)<.005&&
      Math.abs(tangentU.reduce((sum,v,axis)=>sum+v*tangentV[axis]!,0))<.005
    const plane=normal.getX(i)*p.getX(i)+normal.getY(i)*p.getY(i)+normal.getZ(i)*p.getZ(i)
    let hash=2166136261
    for(let axis=0;axis<3;axis++){
      // Non-metric roof UVs and sub-millimetre slivers cannot recover a
      // reliable member frame. Their common plane gives a stable seed.
      const origin=metric?p.getComponent(i,axis)-tangentU[axis]!*u.getX(i)-tangentV[axis]!*u.getY(i):normal.getComponent(i,axis)*plane
      // Remove float32 roundoff before selecting the centimetre bin, also
      // when the actual face origin lies exactly on a half-centimetre edge.
      hash=Math.imul(hash^Math.round(Math.round(origin*10000)/100),16777619)>>>0
    }
    const seed=hash/4294967296
    seeds[i]=seed;seeds[i+1]=seed;seeds[i+2]=seed
  }
  geometry.setAttribute('oakSeed',new Float32BufferAttribute(seeds,1))
}

/** Attach shading metadata, not geometry changes. RGB means brick-mortar,
 * physical course period, and placement-specific runoff/damp respectively.
 * Call on each finished batch before adding it to the scene (also in noweld).
 */
export function prepareSurfaceGeometry(geometry:BufferGeometry,kind:ShellSurfaceKind,roles?:readonly number[],panelSeeds?:readonly number[]):void {
  const p=geometry.getAttribute('position'),normals=geometry.getAttribute('normal'),tone=geometry.getAttribute('tone')
  const info=new Float32Array(p.count*3),weatherAt=new Float32Array(p.count*4)
  for(let i=0;i<p.count;i++){
    const e=p.getX(i),n=-p.getZ(i),z=p.getY(i),nx=normals.getX(i),nz=normals.getZ(i),h=Math.hypot(nx,nz)
    let nearest:typeof facades[number]|undefined,best=.8,along=0
    if((kind==='brick'||kind==='stone')&&h>.02)for(const f of facades){
      if(e<f.minE||e>f.maxE||n<f.minN||n>f.maxN||(nx*f.dn+nz*f.dx)/h<.7)continue
      const off=Math.abs((e-f.from[0])*f.dn-(n-f.from[1])*f.dx),x=(e-f.from[0])*f.dx+(n-f.from[1])*f.dn
      if(off<best&&x>=-.7&&x<=f.length_m+.7){nearest=f;best=off;along=x}
    }
    const t=tone?.getX(i)??1,brickWall=nearest?.pattern.field==='brick'
    // shell.ts's mortar backing has tone .76; dressed stones retain their own role.
    // The backing polygon spans the whole wall. Its role must be constant
    // through each triangle; the basement transition is evaluated per pixel.
    const mortar=kind==='stone'&&(roles?roles[i]===1:brickWall&&Math.abs(t-.76)<.002)?1:0
    const period=kind==='brick'?.057:kind==='slate'?.14:kind==='stone'?(mortar?.057:.28):0
    // North damp is shared per fragment below. Only local eave/sill marks
    // belong here: a whole backing panel cannot interpolate their footprint
    // the same way as the small physical course faces.
    // Where the weather map reaches, it carries the sill and eave marks; a
    // per-vertex copy spreads them over whole course faces as flat quads.
    const w=nearest?weatherUV(nearest.id,along,z):null
    let weather=0
    if(nearest&&!w&&z<nearest.top){
      const beneathEave=nearest.top-z
      if(beneathEave<.42)weather+=.18*(1-beneathEave/.42)
      for(const o of nearest.openings)if(o.render){
        const down=o.base_m-z
        if(down<=0||down>.8)continue
        const edge=Math.min(Math.abs(along-o.from_m),Math.abs(along-o.from_m-o.width_m))
        if(edge<.13)weather+=.22*(1-edge/.13)*(1-down/.8)
        else if(along>o.from_m&&along<o.from_m+o.width_m&&down<.22)weather+=.075*(1-down/.22)
      }
    }
    info[i*3]=kind==='oak'&&roles?.[i]===3?1:mortar;info[i*3+1]=period;info[i*3+2]=Math.min(.4,Math.max(0,weather))
    // Where this place sits in the weather map, if it lies on a facade.
    weatherAt[i*4]=w?.[0]??0;weatherAt[i*4+1]=w?.[1]??0;weatherAt[i*4+2]=w?1:0;weatherAt[i*4+3]=kind==='stone'&&roles?.[i]===2?1:0
  }
  geometry.setAttribute('surfaceInfo',new Float32BufferAttribute(info,3))
  geometry.setAttribute('weatherUV',new Float32BufferAttribute(weatherAt,4))
  if(kind==='oak')prepareOakSeeds(geometry,panelSeeds)
}


/** GENERATED finish assumptions, not surveyed pits or tool marks. Noise is
 * evaluated in metres and differentiated as a physical surface height. The
 * per-band derivative fade is applied AFTER differentiation, so a changing
 * screen footprint cannot itself become an invented ridge in the surface.
 */
function mineralFinish(kind:ShellSurfaceKind,clayWeight:N,baseNormal:N,regional:N,worldPixel:N,slopeUV?:N):{normal:N;colour:N;roughness:N} {
  const P=positionWorld,U=uv(),footprint=U.dFdx().abs().add(U.dFdy().abs())
  const n=normalWorldGeometry.transformDirection(cameraViewMatrix)
  const sx=positionView.dFdx(),sy=positionView.dFdy(),rx=sy.cross(n),ry=n.cross(sx),det=sx.dot(rx)
  const signedSafe=det.greaterThanEqual(0).select(float(1),float(-1)).mul(det.abs().max(1e-12))
  const fromUV=(g:N):N=>rx.mul(g.dot(U.dFdx())).add(ry.mul(g.dot(U.dFdy()))).div(signedSafe)
  const recipe=(clay:boolean):{gradient:N;colour:N;roughness:N}=>{
    const pores=aggregateField(U,footprint,{cell:clay?.012:.016,radius:clay?[.10,.22]:[.08,.19],probability:clay?.80:.45,seed:clay?1.173:5.719})
    const body=denseMineralBody(U,footprint,clay)
    const scale=clay?.12:.18,fade=float(1).sub(smoothstep(scale/8,scale/2,worldPixel))
    const broad=mx_noise_float(P.div(scale).add(vec3(1.73,5.19,11.71))).mul(2.4).clamp(-1,1)
    const broadHeight=broad.mul(.00018)
    const broadGradient=rx.mul(broadHeight.dFdx()).add(ry.mul(broadHeight.dFdy())).div(signedSafe).mul(fade)
    const gradient=fromUV(pores.gradient.mul(clay?-.00055:-.00038).add(body.gradient)).add(broadGradient)
    return{gradient,colour:pores.value.mul(clay?-.12:-.10).add(body.colour).add(broad.mul(.020).mul(fade)),
      roughness:pores.value.mul(.045).add(body.roughness)}
  }
  const brick=recipe(true),stone=kind==='brick'?brick:recipe(false)
  let gradient=mix(stone.gradient,brick.gradient,clayWeight)
  // A laid unit sits a fraction off the wall plane: a slope in its own UV.
  if(slopeUV)gradient=gradient.add(fromUV(slopeUV))
  gradient=gradient.sub(baseNormal.mul(gradient.dot(baseNormal)))
  gradient=gradient.mul(float(.22).div(length(gradient).max(.22)))
  return{normal:baseNormal.sub(gradient).normalize(),colour:float(1).add(mix(stone.colour,brick.colour,clayWeight)),roughness:mix(stone.roughness,brick.roughness,clayWeight)}
}

export const mineralSurfaceProvenance={
  class:'GENERATED',basis:['A-MATERIAL','A-MASONRY','brief/building/materials.csv','Q124','Q130'],
  colourPolicy:'Existing linear-converted palette; finite-pore statistical area mean subtracted and pore colour reduced; overlapping dense grain uses signed coefficients with statistical zero mean. No light is painted into albedo.',
  brick:{broadScaleM:.12,broadScaleRangeM:[.08,.18],poreCellM:.012,poreCellRangeM:[.009,.018],poreDiameterM:[.0024,.00528],poreDepthM:.00055,poreDepthRangeM:[.00030,.00075],poreCellProbability:.80,denseBody:denseMineralProvenance.recipes.brick,denseBodyAssumedRanges:denseMineralProvenance.assumedRanges.brick,poreColourCoefficient:-.12},
  tuffeau:{broadScaleM:.18,broadScaleRangeM:[.12,.28],poreCellM:.016,poreCellRangeM:[.012,.024],poreDiameterM:[.00256,.00608],poreDepthM:.00038,poreDepthRangeM:[.00020,.00060],poreCellProbability:.45,denseBody:denseMineralProvenance.recipes.stone,denseBodyAssumedRanges:denseMineralProvenance.assumedRanges.stone,poreColourCoefficient:-.10},
  filtering:'Finite quartic pores plus overlapping quadratic B-spline grain; exact axis-box integrals and held-footprint gradients. Compact pores use3x3; dense body uses5x5. Each converges to its statistical mean over1.5–2 lattice widths. Broad relief independently filtered after differentiation. Normal slope <= .22.',
  label:{
    en:'Proposed original mineral microstructure. Brick has 2.4–5.3 mm pore supports, nominal depth 0.55 mm [0.30–0.75]; tuffeau 2.6–6.1 mm, nominal depth 0.38 mm [0.20–0.60]. Broad 80–180 / 120–280 mm finish remains restrained. '+denseMineralProvenance.label.en,
    de:'Vorgeschlagene eigenständige mineralische Mikrostruktur. Ziegel erhalten Porenprofile von 2,4–5,3 mm mit nominal 0,55 mm Tiefe [0,30–0,75]; Tuffeau 2,6–6,1 mm mit nominal 0,38 mm [0,20–0,60]. Die breiten Oberflächenskalen von 80–180 / 120–280 mm bleiben zurückhaltend. '+denseMineralProvenance.label.de
  }
} as const

export const closeSurfaceProvenance={
  class:'GENERATED',
  slate:{...slateFiniteProvenance,grainCellM:.004,grainDiameterM:[.00096,.00176],grainHeightM:.000035,grainHeightRangeM:[.000015,.000060],normalSlopeLimit:.24},
  oak:oakFiniteProvenance,
  label:{
    en:slateFiniteProvenance.label.en+' '+oakFiniteProvenance.label.en,
    de:slateFiniteProvenance.label.de+' '+oakFiniteProvenance.label.de
  }
} as const

/** Analytic pixel footprints filter the physical course signal. The course
 * faces and their mortar backing converge to the SAME area-weighted colour
 * and normal below resolution; retained geometry remains visible and complete.
 */
export function createShellSurface(kind:ShellSurfaceKind,library?:MaterialLibrary,valleys:readonly [[number,number,number],[number,number,number]][]=[],options:{coursing?:boolean;tops?:number}={}):MeshStandardNodeMaterial {
  const m=new MeshStandardNodeMaterial({metalness:0,roughness:kind==='slate'?.74:kind==='oak'?.79:.88})
  const P=positionWorld,U=uv(),info=attribute('surfaceInfo','vec3'),tone=attribute('tone','float')
  const lowBase=float(1).sub(smoothstep(.65,.73,P.y))
  const period=mix(info.y,float(.28),info.x.mul(lowBase))
  const pixel=U.y.dFdx().abs().add(U.y.dFdy().abs()).max(.00001)
  const resolved=smoothstep(2,4.2,period.div(pixel))
  const isCourse=smoothstep(.001,.01,info.y)
  const detail=mix(float(1),resolved,isCourse)
  const distance=length(P.sub(cameraPosition))
  void distance
  // Continuous material fields retain readable clay firing, stone staining,
  // and slate variation after the millimetre-scale course signal averages.
  // Each field fades by its own world-space footprint, never by brick rows.
  // THE FOOTPRINT IS NOT A CIRCLE, and a scale is dropped when it cannot be
  // resolved, never because the wall is far away: a street front seen along
  // its own length is the most grazing plane in the wing and the old circular
  // footprint filtered every one of its scales away.
  const worldPixel=anisotropicFootprint(P)
  const density=float(1).sub(smoothstep(.0035,.019,worldPixel))
  const resolvedAt=(metres:number):N=>smoothstep(2,4.2,float(metres).div(worldPixel))
  const regional=mx_noise_float(P.mul(1/.8)).mul(resolvedAt(.8))
  const mottled=mx_noise_float(P.mul(1/.18).add(vec3(7.1,3.7,11.3))).mul(resolvedAt(.18))
  const macro=mx_noise_float(P.mul(.38)).mul(resolvedAt(1/.38)).mul(.11).add(1)
  const grain=kind==='oak'?mx_noise_float(vec3(U.x.mul(22),U.y.mul(mix(float(.7),float(22),info.x)),0)):mx_noise_float(P.mul(24))
  // AN EIGHT MILLIMETRE FIELD IS GATED ON EIGHT MILLIMETRES. Carried on the
  // 42 mm grain's own ramp it kept two thirds of its amplitude where the
  // pixel was already as wide as its period, on the roughness and on the
  // normal both, and that is a crawl no sample count reaches.
  const micro=mx_noise_float(P.mul(125)).mul(resolvedAt(.008))
  const salt=mx_noise_float(P.mul(vec3(5,.7,5))).mul(.5).add(.5)
  const geometric=normalWorldGeometry
  const horizontal=vec3(geometric.x,0,geometric.z)
  const horizontalLength=length(horizontal)
  const wallNormal=horizontal.div(horizontalLength.max(.00001))
  const northDamp=wallNormal.z.negate().max(0).mul(float(1).sub(P.y.add(.3).div(2.8)).max(0)).mul(.24)
  let valleyDamp:N=float(0)
  if(kind==='slate')for(const [a,b]of valleys){
    const from=vec3(...a),edge=vec3(b[0]-a[0],b[1]-a[1],b[2]-a[2])
    const along=P.sub(from).dot(edge).div(edge.dot(edge)).clamp(0,1)
    const distance=length(P.sub(from.add(edge.mul(along))))
    valleyDamp=valleyDamp.max(float(1).sub(smoothstep(.07,.55,distance)))
  }
  const damp=kind==='slate'?valleyDamp.mul(.32).mul(salt.mul(.35).add(.65)):
    northDamp.add(info.z.mul(detail)).min(.4).mul(salt.mul(.7).add(.3))
  const stone=rgb('#d2c3a6'),clay=rgb('#a46951'),mortar=rgb('#aa9e87'),slate=rgb('#464c55'),oak=rgb('#72513b')
  // Below resolved geometric courses, integrate the same laid module over
  // its actual pixel footprint. A two-pixel brick must not become flat paint.
  // Where this place lies in the weather maps: the joints' wetness is part
  // of the laid field itself, so it holds from one metre to fifty.
  const mineralKind=kind==='brick'||kind==='stone'
  const at=attribute('weatherUV','vec4')
  const weather:N=mineralKind?texture(weatherAtlas().texture,at.xy).mul(at.z):null
  const joints:N=mineralKind?texture(weatherAtlas().joints,at.xy).mul(at.z):null
  // a wet joint goes darker and a little cooler
  const mortarTone:N=mineralKind?mortar.mul(.82).mul(float(1).sub(joints.x.mul(.5))).mul(mix(vec3(1,1,1),vec3(.93,.955,.98),joints.x)):mortar.mul(.82)
  const brickFraction=.24*.045/(.252*.057)
  // The geometric chunk tone is uniform on [.91,1.05] (expectation .98).
  // The backing tone .76 has always been clamped to .82. Include these
  // physical colour factors in the average instead of brightening the far wall.
  const brickMean=mix(mortarTone,clay.mul(.98),brickFraction)
  let filteredBrick:N=brickMean,brickCoverage:N=float(brickFraction)
  if(kind==='brick'||kind==='stone'){
    const cellUV=U.div(vec2(.252,.057)),row=floor(cellUV.y)
    const footprint=U.dFdx().abs().add(U.dFdy().abs()).div(vec2(.252,.057)).max(vec2(.00001,.00001))
    // This is a conservative axis-aligned box around the derivative pixel
    // parallelogram, not its exact area integral. The nine-cell support is
    // complete through two cell widths; fade to the same mean over 1.5–2.
    // Extremely anisotropic footprints deliberately lose the short-axis signal.
    const support=float(1).sub(smoothstep(1.5,2,footprint.x.max(footprint.y)))
    const width=footprint.min(vec2(2,2)),lo=cellUV.sub(width.mul(.5)),hi=cellUV.add(width.mul(.5))
    let clayCoverage:N=float(0),firedCoverage:N=float(0)
    for(let j=-1;j<=1;j++){
      const r=row.add(j),offset=fract(r.mul(.5)),column=floor(cellUV.x.add(offset))
      const coverY=hi.y.min(r.add(1-.006/.057)).sub(lo.y.max(r.add(.006/.057))).max(0).div(width.y)
      for(let i=-1;i<=1;i++){
        const c=column.add(i),coverX=hi.x.add(offset).min(c.add(1-.006/.252)).sub(lo.x.add(offset).max(c.add(.006/.252))).max(0).div(width.x)
        const area=coverX.mul(coverY)
        const firing=fract(c.mul(13.731).add(r.mul(47.713)).sin().mul(13758.547)).mul(.20).add(.90)
        clayCoverage=clayCoverage.add(area);firedCoverage=firedCoverage.add(area.mul(firing))
      }
    }
    // Both the raised faces and the backing evaluate this same laid field.
    // The 12 mm joint is a complete mortar colour at every resolution; there
    // is no competing narrow/partial-colour near seam. Only the brick chunks'
    // zero-mean tone departure returns as their physical course resolves.
    const chunkDeparture=kind==='brick'?tone.sub(.98).mul(detail):float(0)
    const field=mortarTone.mul(float(1).sub(clayCoverage))
      .add(clay.mul(firedCoverage).mul(chunkDeparture.add(.98)))
    filteredBrick=mix(brickMean,field,support);brickCoverage=mix(float(brickFraction),clayCoverage,support)
  }
  const acrossPixel=U.x.dFdx().abs().add(U.x.dFdy().abs()).max(.00001)
  const acrossResolved=smoothstep(2,4.2,float(kind==='brick'?.252:.24).div(acrossPixel))
  let near:N,far:N,relief:N=float(0),textureNormal:N=vec3(0,0,1)
  let oakHeight:N=float(0),oakWeather:N=float(0),oakChecks:N=float(0),oakFiniteDxDy:N=vec2(0),oakFiniteRoughness:N=float(0),oakFiniteHeight:N=float(0)
  const slateBands:{dx:N;dy:N;signal:N;colour:number;roughness:number}[]=[]
  if(kind==='brick'){
    // Half-module running bond and firing use the same integrated cell above
    // at both near and far distances. The geometry still supplies the courses.
    near=filteredBrick;far=filteredBrick
  }else if(kind==='stone'){
    const pore=smoothstep(.37,.66,micro).mul(smoothstep(-.30,.35,grain))
    near=mix(stone,mortar,info.x)
    near=mix(near,filteredBrick,info.x.mul(float(1).sub(lowBase)))
    far=mix(stone,filteredBrick,info.x.mul(float(1).sub(lowBase))).mul(mix(float(1),float(.95),lowBase))
    relief=grain.mul(.075).sub(pore.mul(.10))
    if(library){
      // Fine, rotated, low-amplitude grain; no imported stone block layout.
      const maps=library.sync('stone-tuffeau').sample({uv:U,metres:.19,turn:.37})
      // Keep the licensed limestone grain on actual stone; the brick-mortar
      // backing must retain the same laid field as the raised brick faces.
      const actualStone=float(1).sub(info.x.mul(float(1).sub(lowBase)))
      near=near.mul(mix(float(1),maps.albedo.clamp(.82,1.18),density.mul(.38).mul(actualStone)))
      textureNormal=vec3(maps.normal.xy.mul(.32).mul(density),1)
    }
  }else if(kind==='slate'){
    const row=floor(U.y.div(.14)),yy=U.y.div(.14),xx=U.x.div(.24)
    const fy=pixel.div(.14).max(.004),fx=acrossPixel.div(.24).max(.004)
    let total:N=float(0),weight:N=float(0),tint:N=vec3(0),tilt:N=vec2(0)
    // Exact box coverage of the surrounding nine slate cells, including
    // their staggered bond. Colour survives down to its physical resolution
    // without hard, one-pixel changes when a cell crosses the footprint.
    // EVERY SLATE IS ITS OWN STONE: its own grey, a few leaning to the purple
    // or the green of their bed, one in eight darker where it was replaced
    // or holds the wet, the odd one paler and lifted at its foot, and each
    // set a degree or two off its neighbours, so each takes the sky apart.
    for(let j=-1;j<=1;j++){
      const r=row.add(j),offset=fract(r.mul(.5)),column=floor(xx.add(offset))
      const wy=yy.add(fy.mul(.5)).min(r.add(1)).sub(yy.sub(fy.mul(.5)).max(r)).max(0).div(fy)
      for(let i=-1;i<=1;i++){
        const c=column.add(i),u=xx.add(offset)
        const wx=u.add(fx.mul(.5)).min(c.add(1)).sub(u.sub(fx.mul(.5)).max(c)).max(0).div(fx),area=wx.mul(wy)
        const value=fract(c.mul(31.17).add(r.mul(13.713)).sin().mul(4317.1))
        const second=fract(c.mul(12.9898).add(r.mul(78.233)).sin().mul(43758.5453))
        const third=fract(c.mul(39.3468).add(r.mul(11.1351)).sin().mul(24634.6345))
        const dark=smoothstep(.86,.90,second),lifted=smoothstep(.93,.96,third)
        const bed=mix(mix(vec3(1,1,1),vec3(1.05,.96,1.04),smoothstep(.55,.85,third)),vec3(.97,1.02,.98),smoothstep(.15,.0,third))
        const own=mix(rgb('#3d4650'),rgb('#5c656e'),value).mul(bed).mul(float(1).sub(dark.mul(.30))).mul(lifted.mul(.20).add(1))
        total=total.add(value.mul(area));weight=weight.add(area)
        tint=tint.add(own.mul(area))
        tilt=tilt.add(vec2(third.sub(.5).mul(.07),second.sub(.5).mul(.05).add(lifted.mul(.06))).mul(area))
      }
    }
    const cell=total.div(weight.max(.0001)).toVar()
    const ownTone=tint.div(weight.max(.0001)).toVar(),ownTilt=tilt.div(weight.max(.0001)).toVar()
    // Integrate a 6% overlap band over the pixel footprint. Its mean stays
    // 0.06 at every scale; the near/far blend applies detail exactly once.
    const width=pixel.div(.14).max(.0001),phase=fract(U.y.div(.14)).add(.03)
    const primitive=(x:N):N=>floor(x).mul(.06).add(fract(x).clamp(0,.06))
    const seam=primitive(phase.add(width.mul(.5))).sub(primitive(phase.sub(width.mul(.5)))).div(width).clamp(0,1)
    // A roof at twenty metres shows the scale a patch of slate has, not the
    // scale a slate has: bands of replaced tile, wash under the ridge, moss
    // where the slope stays damp. All three survive a two-pixel tile, which
    // is why the roof used to read as one colour from the street.
    const patch=mx_noise_float(P.mul(vec3(.62,.9,.62)).add(vec3(5.1,2.3,8.7))).mul(resolvedAt(1.6))
    const wash=mx_noise_float(P.mul(vec3(2.4,.35,2.4))).mul(resolvedAt(.42))
    // moss holds where a valley stays wet, and lichen dots the whole pitch
    const moss=valleyDamp.mul(smoothstep(.40,.72,mx_noise_float(P.mul(3.1).add(vec3(2.7,8.3,1.9))).mul(.5).add(.5)).mul(.8).add(.2))
    const lichenDots=smoothstep(.80,.93,mx_noise_float(P.mul(17).add(vec3(5.5,1.3,9.1))).mul(.5).add(.5)).mul(resolvedAt(.06))
    const weathered=ownTone
      .mul(patch.mul(.115).add(1)).mul(wash.mul(.055).add(1))
    const mossed=mix(mix(weathered,rgb('#8e8f78'),lichenDots.mul(.28)),rgb('#4a5431'),moss.mul(.55))
    near=mossed.mul(grain.mul(.08).mul(density).add(1)).mul(float(1).sub(seam.mul(.30)))
    far=mix(rgb('#414a53'),rgb('#58616a'),.5).mul(1-.20*.06).mul(patch.mul(.115).add(1))
    relief=seam.sub(.06).mul(-.055).add(grain.mul(.035))
    // Finite irregular cleavage in the same physical staggered tile UV.
    slateBands.push(...slateFiniteFinish(U))
    slateBands.push({dx:ownTilt.dot(U.dFdx()),dy:ownTilt.dot(U.dFdy()),signal:float(0),colour:0,roughness:0})
    const slateGrain=aggregateField(U,U.dFdx().abs().add(U.dFdy().abs()),{cell:.004,radius:[.12,.22],probability:1,seed:31.719,signed:true})
    slateBands.push({dx:slateGrain.gradient.dot(U.dFdx()).mul(.000035),dy:slateGrain.gradient.dot(U.dFdy()).mul(.000035),signal:slateGrain.value,colour:.085,roughness:.025})

  }else{
    // Exhibition recipe, not measured historic grain: U crosses each member
    // and V follows it. Finite compact fibres, 18 mm broader structure and gently
    // irregular end rings resolve independently at their UV footprint.
    const footprint=(v:N):N=>v.dFdx().abs().add(v.dFdy().abs()).max(.000001)
    const filtered=(v:N,metres:number):N=>smoothstep(2,4.2,float(metres).div(footprint(v)))
    const seed=attribute('oakSeed','float'),side=float(1).sub(info.x)
    const random=(cell:N,salt:number):N=>fract(cell.mul(17.173).add(seed.mul(137.31)).add(salt).sin().mul(43758.5453))
    const knotCell=floor(U.y.div(1.1).add(.5)),knotOn=smoothstep(.30,.38,random(knotCell,8.1))
    const knotX=random(knotCell,1.7).sub(.5).mul(.075)
    const knotY=knotCell.mul(1.1).add(random(knotCell,3.8).sub(.5).mul(.36))
    const radiusX=random(knotCell,7.2).mul(.006).add(.004),radiusY=random(knotCell,5.4).mul(.0125).add(.0075)
    const dx=U.x.sub(knotX),dy=U.y.sub(knotY),oval=length(vec2(dx.div(radiusX),dy.div(radiusY)))
    // Fibres bend around an embedded branch, with a continuous deflection.
    // The sparse 8–20 by 15–40 mm knots are conjectural exhibition dressing.
    const sx=dx.div(radiusX.mul(4)),sy=dy.div(radiusY.mul(5))
    const influence=sx.mul(sx).add(sy.mul(sy)).negate().exp().mul(knotOn)
    const bend=dx.div(dx.mul(dx).add(radiusX.mul(radiusX).mul(.35)).sqrt()).mul(radiusX.mul(1.7)).mul(influence)
    const warp=mx_noise_float(vec3(U.x.mul(4),U.y.mul(3),seed.mul(7))).mul(.005)
      .add(mx_noise_float(vec3(U.x.mul(11),U.y.mul(8),seed.mul(13))).mul(.0012))
    const across=U.x.add(warp).add(bend).toVar()
    const structure=mx_noise_float(vec3(across.div(.018),U.y.div(.24),seed.mul(19).add(1.3))).mul(filtered(across,.018)).toVar()
    // The wood has a continuous fibrous body; compact marks interrupt it.
    // The shorter longitudinal fields avoid the old near-infinite stripes.
    const bodyFine=mx_noise_float(vec3(across.div(.00055),U.y.div(.065),seed.mul(17))).toVar()
    const bodyWide=mx_noise_float(vec3(across.div(.0012),U.y.div(.14),seed.mul(11).add(2.3))).toVar()
    const bodyFineFade=filtered(across,.00055).mul(filtered(U.y,.065))
    const bodyWideFade=filtered(across,.0012).mul(filtered(U.y,.14))
    const body=bodyFine.mul(.58).mul(bodyFineFade).add(bodyWide.mul(.42).mul(bodyWideFade)).toVar()
    const bodyDxDy=vec2(bodyFine.dFdx(),bodyFine.dFdy()).mul(.58).mul(bodyFineFade)
      .add(vec2(bodyWide.dFdx(),bodyWide.dFdy()).mul(.42).mul(bodyWideFade)).mul(.000025)
    const finite=oakFiniteFinish(U.y,across,seed)
    // Differentiate raw body fields first, then filter their physical slopes.
    oakFiniteDxDy=finite.heightDxDy.add(bodyDxDy).mul(side)
    oakFiniteHeight=finite.height.add(body.mul(.000025)).mul(side)
    oakFiniteRoughness=finite.roughness.add(body.mul(.012)).mul(side)
    const knotEdge=oval.add(mx_noise_float(vec3(U.mul(240),seed.mul(23))).mul(.14))
    const knotCore=float(1).sub(smoothstep(.55,1,knotEdge)).mul(knotOn).mul(filtered(U.x,.008)).mul(side).toVar()
    const endOffset=vec2(seed.mul(.065).add(.055),seed.mul(.038).add(.019))
    const endPoint=U.add(endOffset).mul(vec2(1,seed.mul(.10).add(.95)))
    const radial=length(endPoint)
    // A common centre remains readable, with changing growth spacing and
    // shallow noncircular wander rather than equally spaced perfect arcs.
    const radialWander=mx_noise_float(vec3(U.div(.046),seed.mul(41))).mul(.0012)
    const ringPhase=radial.add(radialWander).div(.0031)
      .add(radial.div(.011).add(seed.mul(20)).sin().mul(.62))
      .add(radial.div(.031).add(seed.mul(31)).sin().mul(.34))
    const endRings=ringPhase.mul(Math.PI*2).sin().mul(filtered(ringPhase,1)).toVar()
    const latewood=smoothstep(.15,.78,ringPhase.mul(Math.PI*2).sin()).mul(filtered(ringPhase,1))
    // Sparse 0.8–1.5 mm checks taper over 80–350 mm. Integrate the narrow
    // strip across the pixel instead of erasing it as soon as it gets thin.
    const checkCell=floor(U.y.div(.48).add(.5)),checkOn=smoothstep(.40,.48,random(checkCell,11.6))
    const checkY=checkCell.mul(.48).add(random(checkCell,2.4).sub(.5).mul(.08))
    const checkLength=random(checkCell,4.3).mul(.135).add(.04)
    const taper=float(1).sub(smoothstep(.70,1,U.y.sub(checkY).abs().div(checkLength)))
    const checkX=random(checkCell,6.2).sub(.5).mul(.105).add(warp.mul(.32))
    const checkDistance=U.x.sub(checkX),halfWidth=random(checkCell,9.7).mul(.00035).add(.0004).mul(taper)
    const halfPixel=footprint(checkDistance).mul(.5).max(.00001)
    const covered=checkDistance.add(halfPixel).min(halfWidth).sub(checkDistance.sub(halfPixel).max(halfWidth.negate())).max(0)
    oakChecks=covered.div(halfPixel.mul(2)).mul(checkOn).mul(side).mul(float(1).sub(knotCore)).toVar()
    const wearBroad=mx_noise_float(vec3(U.x.div(.12),U.y.div(.28),seed.mul(29)))
    const wearFine=mx_noise_float(vec3(across.div(.03),U.y.div(.08),seed.mul(31)))
    // Continuous low-contrast weathering retains the timber's body colour;
    // thresholding this field produces pale camouflage patches.
    oakWeather=float(.30).add(wearBroad.mul(.065)).add(wearFine.mul(.035)).add(structure.mul(.025))
      .clamp(.15,.45).mul(filtered(U.x,.03)).toVar()
    const weathered=mix(oak,rgb('#807466'),oakWeather)
    const sideColour=weathered.mul(structure.mul(.10).add(1)).mul(body.mul(.30).add(finite.colour).add(1)).mul(float(1).sub(oakChecks.mul(.38))).mul(float(1).sub(knotCore.mul(.34)))
    const endColour=weathered.mul(.86).mul(float(1.035).sub(latewood.mul(.16)))
    near=mix(sideColour,endColour,info.x);far=mix(weathered,weathered.mul(.86),info.x)
    // Existing broad relief and sparse checks/end rings retain their member frame.
    // Finite-fibre relief is added below through its held-footprint gradient.
    oakHeight=mix(structure.mul(.00004).sub(oakChecks.mul(.00035)).sub(knotCore.mul(.00016)),endRings.mul(.00008),info.x)
      .clamp(-.00035,.00018).toVar()
  }
  // The integrated brick field already contains the physical .98/.82 tone
  // factors. Applying the backing tone a second time would restore the drift.
  const ordinaryTone=mix(float(1),tone.clamp(.82,1.10),detail)
  const individualTone=kind==='brick'?float(1):kind==='stone'?
    mix(ordinaryTone,float(1),info.x.mul(float(1).sub(lowBase))):ordinaryTone
  // Mortar backing and brick faces share this factor above the stone base.
  // Otherwise colour matching alone would leave a repeating distant signal.
  const clayWeight=kind==='brick'?float(1):kind==='stone'?info.x.mul(float(1).sub(lowBase)):float(0)
  const clayRegion=vec3(1,1,1).add(regional.mul(vec3(.21,.15,.11))).add(mottled.mul(vec3(.13,.10,.08)))
  const stoneRegion=vec3(1,1,1).add(regional.mul(vec3(.075,.073,.066))).add(mottled.mul(.065))
  const surfaceRegion=kind==='slate'?vec3(1,1,1).add(regional.mul(vec3(.32,.34,.39))).add(mottled.mul(.16)):
    kind==='oak'?vec3(1,1,1).add(regional.mul(.12)).add(mottled.mul(.07)):mix(stoneRegion,clayRegion,clayWeight)
  const colour=mix(far,near,kind==='slate'?smoothstep(.65,1.7,float(.14).div(pixel)):detail).mul(macro).mul(surfaceRegion).mul(individualTone).mul(float(1).sub(damp))
  m.colorNode=mix(colour,colour.mul(vec3(.74,.82,.63)),damp.mul(.40)).max(vec3(.003,.003,.003))
  const roughRange=kind==='slate'?[.61,.83]:kind==='oak'?[.60,.82]:kind==='brick'?[.74,.96]:[.78,1]
  const roughness=kind==='oak'?float(.72).add(oakWeather.mul(.12)).add(oakChecks.mul(.025)).add(oakFiniteRoughness).add(micro.mul(.02)).sub(damp.mul(.10)):
    float(kind==='slate'?.73:.89).add(regional.mul(.025)).add(micro.mul(.045)).sub(damp.mul(.10))
  m.roughnessNode=clamp(roughness,roughRange[0],roughRange[1])
  const nx=grain.mul(.04).add(relief).mul(density).mul(detail).add(textureNormal.x)
  const ny=micro.mul(.018).mul(detail).add(textureNormal.y)
  const detailedNormal=normalMap(vec3(nx,ny,1).normalize().mul(.5).add(.5),vec2(.65,.65))
  // A microscopic course bevel must converge to its wall plane, not retain
  // a bright one-pixel strip after the colour signal has been filtered.
  const wallCourse=kind==='brick'||kind==='stone'?isCourse.mul(smoothstep(.02,.12,horizontalLength)):float(0)
  const filteredWorld=mix(geometric,wallNormal,wallCourse.mul(float(1).sub(detail))).normalize()
  const filteredView=filteredWorld.transformDirection(cameraViewMatrix)
  if(kind==='brick'||kind==='stone'){
    // EVERY BRICK SITS A LITTLE OFF THE PLANE, which is what a raking sun
    // finds: up to 1.4 degrees each way, faded where a brick is sub-pixel.
    let slope:N|undefined
    if(kind==='brick'){
      const cellUV=U.div(vec2(.252,.057)),row=floor(cellUV.y),column=floor(cellUV.x.add(fract(row.mul(.5))))
      const cellFoot=U.dFdx().abs().add(U.dFdy().abs()).div(vec2(.252,.057))
      const held=float(1).sub(smoothstep(.9,1.8,cellFoot.x.max(cellFoot.y)))
      const hx=fract(column.mul(12.9898).add(row.mul(78.233)).sin().mul(43758.5453)).sub(.5)
      const hy=fract(column.mul(39.3468).add(row.mul(11.1351)).sin().mul(24634.6345)).sub(.5)
      slope=vec2(hx,hy).mul(.05).mul(held)
    }
    const mineral=mineralFinish(kind,clayWeight,filteredView,regional,worldPixel,slope)
    m.colorNode=(m.colorNode as N).mul(mineral.colour)
    m.roughnessNode=clamp((m.roughnessNode as N).add(mineral.roughness),roughRange[0],roughRange[1])
    m.normalNode=mineral.normal
    // Carved work is cut from a few large stones: it takes no laid coursing.
    if(kind==='stone'&&options.coursing!==false){
      // ONE STONE IS NOT THE NEXT, on the house as on the garden wall. The
      // dressed faces carried a continuous stain and a course line and
      // nothing from block to block, so the chapel's ashlar, the largest
      // pale plane in the wing, read as one tone with lines on it. A quarry
      // sends beds of different colour and a few stones drink and stay dark.
      // Colour only, keyed to each block's own number, never a pattern.
      const laid=coursedFace(U,{...dressedTuffeau,courseM:.28,courseSwing:0,blockM:.66,jointM:.012,faceSwing:.052,seed:4.63})
      const face=float(1).sub(info.x.mul(float(1).sub(lowBase)))
      const bed=laid.cell.sub(.5).mul(laid.held)
      const soaked=smoothstep(.76,.97,laid.cell).mul(laid.held)
      const dressed=laid.tone.mul(mix(float(1),float(.88),laid.joint))
        .mul(bed.mul(.34).add(1)).mul(float(1).sub(soaked.mul(.16)))
      // Beds of one quarry differ in hue as well: some blocks lean to the
      // yellow of fresh tuffeau, some to the grey of a harder bed.
      const hue=fract(laid.cell.mul(91.7)).sub(.5).mul(laid.held)
      const tint=mix(vec3(1,1,1),vec3(1.035,1.0,.93),hue.max(0).mul(2)).mul(mix(vec3(1,1,1),vec3(.96,.985,1.02),hue.negate().max(0).mul(2)))
      m.colorNode=(m.colorNode as N).mul(mix(vec3(1,1,1),dressed.mul(tint),face))
      m.roughnessNode=clamp((m.roughnessNode as N).add(laid.joint.mul(.03).mul(face)),roughRange[0],roughRange[1])
    }
    // RAIN COMES BACK OFF THE GROUND. A wall under a slate roof with no gutter
    // takes the splash at its foot: a darker, greener band with a wandering
    // top edge, half a metre up and strongest at the courses just above the
    // base. The largest plane in the arrival frame had no weathering at all.
    // A face the weather map does not reach keeps a splash band at the
    // court's own level; every mapped face takes its foot from the map.
    const splashEdge=P.y.sub(mx_noise_float(vec3(P.x.mul(1.9),P.y.mul(.5),P.z.mul(1.9))).mul(.07))
    const splash=float(1).sub(smoothstep(.11,.47,splashEdge)).mul(smoothstep(-.05,.06,splashEdge)).mul(float(1).sub(at.z))
    m.colorNode=mix(m.colorNode as N,(m.colorNode as N).mul(vec3(.87,.885,.845)),splash.mul(.55))
    m.roughnessNode=clamp((m.roughnessNode as N).add(splash.mul(.03)),roughRange[0],roughRange[1])
    // WEATHER WITH CAUSES, read from the baked map of every facade: dark
    // streaks under the sills and courses, damp at the foot, lichen where a
    // face looks north, a broad grime. A fine vertical fibre breaks each
    // streak into the runs water actually takes; it fades before it aliases.
    const fibreHeld=resolvedAt(.03)
    const fibre=mix(float(.5),mx_noise_float(vec3(U.x.mul(34),U.y.mul(1.3),3.7)).mul(.5).add(.5),fibreHeld)
    // on pale stone the runs part more clearly than on the brick
    const streak=weather.x.mul(kind==='stone'?fibre.mul(.9).add(.1):fibre.mul(.7).add(.3))
    let c:N=m.colorNode as N
    const grey=c.dot(vec3(.2126,.7152,.0722))
    // Pale stone shows its soiling more than fired brick does (AD-2: the
    // soiled tuffeau under a drip is about half the weathered face).
    const soil=kind==='stone'?float(.5):float(.36)
    c=mix(c,vec3(grey).mul(vec3(.92,.90,.86)),streak.mul(.35)).mul(float(1).sub(streak.mul(soil)))
    // the brick's broad soiling drifts, greyer and darker than the clay
    const soiled=joints.y.mul(clayWeight).mul(fibre.mul(.4).add(.6))
    c=mix(c,mix(c,vec3(grey).mul(vec3(.86,.83,.80)),.4).mul(.64),soiled.mul(.85))
    // UNDERSIDES THE RAIN NEVER WASHES keep a dark crust: the soffits of
    // quoins, courses and sills, which the court's light would show brown.
    // (a crust, not a void: the head of a window seen from below is stone)
    const soffit=normalWorldGeometry.y.negate().max(0).mul(float(1).sub(smoothstep(.2,.6,horizontalLength)))
    c=mix(c,rgb('#4a4741').mul(c.dot(vec3(.33,.33,.33)).mul(1.6).add(.4)),soffit.mul(.30))
    // TOPS HOLD WHAT THE RAIN BRINGS: copings, sills and courses carry grime
    // in their pores and a skin of lichen, never the clean edge of new work.
    // (a course's own lip leans out a quarter and stays the sun's)
    // (carved work with no course lips may count its weathered slopes too)
    const top=normalWorldGeometry.y.max(0).mul(float(1).sub(smoothstep(.08,options.tops??.2,horizontalLength)))
    const skin=smoothstep(.3,.75,mx_noise_float(P.mul(9).add(vec3(5.3,1.1,7.9))).mul(.5).add(.5))
    c=mix(c,mix(c.mul(vec3(.66,.64,.58)),rgb('#8e9474'),skin.mul(.45)),top.mul(.7))
    // THE FOOT, measured from the ground each wall stands in: rising damp
    // to a tide line (the map's half), the splash of rain off the paving in
    // the lowest part of it as a speckle of grit, grime tailing off above.
    // (the tide line soft enough to read as damp, not as a laid-over sheet)
    const footMap=weather.y,tide=smoothstep(.40,.62,footMap),splashed=smoothstep(.78,.96,footMap)
    const speckHeld=resolvedAt(.024)
    const speck=mix(float(.4),smoothstep(.45,.8,mx_noise_float(P.mul(71).add(vec3(2.3,.7,5.1))).mul(.5).add(.5)),speckHeld)
    c=c.mul(float(1).sub(tide.mul(.22))).mul(mix(vec3(1,1,1),vec3(.93,.95,.90),tide))
    c=mix(c,c.mul(vec3(.62,.58,.52)),splashed.mul(speck.mul(.42).add(.4)))
    // the last hand's breadth, where the paving's dirt lies against it
    c=c.mul(float(1).sub(smoothstep(.95,.995,footMap).mul(.3)))
    // THE WALL STANDS IN ITS GROUND, NOT ON IT: the lowest course is darker
    // and wetter than the one above, and splash greys it a little higher.
    const contact=smoothstep(.84,.99,footMap).mul(at.z)
    c=mix(c,c.mul(vec3(.70,.70,.66)),contact.mul(.55))
    const lichenMask=smoothstep(.38,.72,mx_noise_float(P.mul(22).add(vec3(1.7,4.1,2.3))).mul(.5).add(.5).mul(resolvedAt(.05)).add(float(1).sub(resolvedAt(.05)).mul(.5)))
    c=mix(c,rgb('#9ba07c').mul(mottled.mul(.2).add(.9)),weather.z.mul(lichenMask).mul(.62))
    // a broad grime, heavier low on the wall where hands and splash reach
    const grime=mx_noise_float(P.mul(.35).add(vec3(3.1,7.7,1.3))).mul(.5).add(.5).mul(footMap.mul(.8).add(.2))
    c=c.mul(float(1).sub(grime.mul(.18).mul(at.z)))
    // A THRESHOLD IS WORN where feet cross it: a paler, smoother hollow down
    // its middle, the court's dirt pushed to its two ends.
    let worn:N=float(0)
    if(kind==='stone')for(const d of thresholds){
      const re=P.x.sub(d.e),rn=P.z.negate().sub(d.n)
      const across=re.mul(d.dx).add(rn.mul(d.dn)),out=re.mul(d.dn).sub(rn.mul(d.dx))
      const onTop=smoothstep(.75,.95,normalWorldGeometry.y).mul(float(1).sub(smoothstep(.02,.05,P.y.sub(d.top).abs())))
      const within=smoothstep(-.75,-.6,out).mul(float(1).sub(smoothstep(.2,.26,out)))
      const feet=across.div(d.half*.62).pow(2).negate().exp().mul(onTop).mul(within)
      const pushed=smoothstep(.55,.95,across.abs().div(d.half)).mul(onTop).mul(within)
      c=mix(c,c.mul(vec3(1.10,1.09,1.06)),feet.mul(.7)).mul(float(1).sub(pushed.mul(.22)))
      worn=worn.max(feet)
    }
    m.colorNode=c
    // THE COURT'S SUN, SENT BACK: a wall in shade takes warm light from the
    // sunlit ground it faces, baked per place from that ground's own sun.
    // Engine-only (`engineBounce`); the film's path tracer bounces for real.
    m.emissiveNode=c.mul(vec3(1,.73,.545)).mul(weather.w.mul(.5*.073*1.4))
    m.userData['engineBounce']=true
    m.roughnessNode=clamp((m.roughnessNode as N).add(streak.mul(.05)).add(weather.z.mul(lichenMask).mul(.08)).add(splashed.mul(.04)).sub(tide.mul(.05)).sub(worn.mul(.16)),roughRange[0]!-.12,roughRange[1])
    m.normalNode=mix(m.normalNode as N,filteredView,worn.mul(.65)).normalize()
    // THE JOINTS IN RAKING LIGHT. A recessed joint takes the sun only where
    // the brick beside it does not shade it; the fraction follows from the
    // sun's angle to this very wall. Engine-only light term: the film's
    // geometry casts this itself (`engineJointShadow`).
    const wallN=vec3(wallNormal.x,0,wallNormal.z),sunN=clamp(wallN.dot(SUN),.015,1)
    const sunAlong=float(1).sub(SUN_UP*SUN_UP).sub(sunN.mul(sunN)).max(0).sqrt()
    const bedShade=clamp(float(.015*SUN_UP).div(sunN).div(.012),0,1)
    const headShade=clamp(sunAlong.mul(.008).div(sunN).div(.012),0,1)
    // a stone field's backing is the floor of its own bed joints too
    const isBacking=kind==='stone'?info.x.mul(float(1).sub(lowBase)).max(at.w):float(0)
    const headJoint=kind==='brick'?float(1).sub(brickCoverage).mul(detail):float(0)
    const shaded=isBacking.mul(bedShade).add(headJoint.mul(headShade)).clamp(0,1)
    m.receivedShadowNode=Fn(([shadow]:N[])=>shadow.mul(float(1).sub(shaded)))
    // the ground beside the foot takes most of its sky away
    m.aoNode=float(1).sub(isBacking.mul(.32)).sub(headJoint.mul(.22)).mul(float(1).sub(smoothstep(.80,.99,weather.y).mul(at.z).mul(.45)))
    m.userData['engineJointShadow']=true
  }else if(kind==='slate'){
    const n=normalWorldGeometry.transformDirection(cameraViewMatrix),sx=positionView.dFdx(),sy=positionView.dFdy()
    const rx=sy.cross(n),ry=n.cross(sx),det=sx.dot(rx)
    const signedSafe=det.greaterThanEqual(0).select(float(1),float(-1)).mul(det.abs().max(1e-12))
    let gradient:N=vec3(0),gain:N=float(1),rough:N=m.roughnessNode as N
    for(const band of slateBands){
      gradient=gradient.add(rx.mul(band.dx).add(ry.mul(band.dy)).div(signedSafe))
      gain=gain.add(band.signal.mul(band.colour))
      rough=rough.add(band.signal.mul(band.roughness))
    }
    gradient=gradient.mul(float(.24).div(length(gradient).max(.24)))
    m.normalNode=n.sub(gradient).normalize();m.colorNode=(m.colorNode as N).mul(gain)
    m.roughnessNode=clamp(rough,.61,.83)
  }else if(kind==='oak'){
    // BumpMapNode shifts texture UVs, not raw procedural UV attributes.
    // Differentiate the height itself against view-space surface position.
    // A bounded surface gradient keeps thin edges and grazing faces stable.
    const sx=positionView.dFdx(),sy=positionView.dFdy(),n=filteredView
    const rx=sy.cross(n),ry=n.cross(sx),det=sx.dot(rx)
    const totalHeight=oakHeight.add(oakFiniteHeight)
    const unclipped=totalHeight.greaterThan(-.00035).and(totalHeight.lessThan(.00018)).select(float(1),float(0))
    const gradient=rx.mul(oakHeight.dFdx().add(oakFiniteDxDy.x)).add(ry.mul(oakHeight.dFdy().add(oakFiniteDxDy.y)))
      .mul(det.sign()).div(det.abs().max(.0000000001)).mul(unclipped).toVar()
    const bounded=gradient.div(length(gradient).div(.22).max(1))
    m.normalNode=n.sub(bounded.mul(density)).normalize()
  }else m.normalNode=mix(filteredView,detailedNormal,detail.mul(density)).normalize()
  m.name=`vinci/${kind}`;m.userData['surfaceKind']=kind
  m.userData['provenance']='Procedural 2026-09-09; dossier nominal courses and registered openings. Area-filtered fine courses; independently filtered 0.8 m and 0.18 m material variation; shared per-fragment north damp, resolved A eave/sill weathering. Member-local oak fibres and transverse end grain. Existing CC0 ambientCG Tiles143 fine grain on tuffeau only. No site-photo sample.'
  if(kind==='brick'||kind==='stone'){m.userData['mineralFinish']=mineralSurfaceProvenance;m.userData['denseMineralFinish']=denseMineralProvenance}
  if(kind==='slate'||kind==='oak')m.userData['closeFinish']=closeSurfaceProvenance
  if(kind==='slate')m.userData['finiteFinish']=slateFiniteProvenance
  if(kind==='oak')m.userData['finiteFinish']=oakFiniteProvenance
  if(kind==='oak')m.userData['provenance']+=' Oak appearance is conjectural exhibition dressing: independent seeds from actual metre UV face origins; roof linings use one affine metre frame and seed per complete roof face before clipping. Continuous curved 0.55/1.20 mm fibre-body fields with 65/140 mm longitudinal scales and up to 0.025 mm relief, interrupted by finite 0.36–0.79 / 0.84–1.81 mm fibres, 18 mm broad structure and sparse 0.48–1.41 by 2.4–7.04 mm pore fields with up to 0.03 mm pore relief; irregular end rings with nominal 3.1 mm spacing and up to 1.2 mm contour wander. Sparse knots 8–20 by 15–40 mm, checks 0.8–1.5 mm wide by 80–350 mm long, continuous grey-brown wear at 30–120 mm across grain with 15–45% colour blend where resolved. Relief clamped to -0.35/+0.18 mm, bounded normal slope 0.22, ends 14% darker. Dossier materials.csv base #72513b and roughness 0.60–0.82 retained. No observed timber dimensions, pores, knots, ring spacing or weathering claimed.'
  return m
}

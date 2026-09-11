/** Original procedural construction surfaces, 2026-09-09.
 * Q001/Q124/Q127/Q019 are form/appearance references only. No site photograph
 * is sampled. The existing CC0 Tiles143 set contributes limited fine grain.
 * Positions, nominal courses and openings remain exactly those of shell.ts.
 */
import { BufferGeometry, Color, Float32BufferAttribute, MeshStandardNodeMaterial } from 'three/webgpu'
import * as TSL from 'three/tsl'
import type { MaterialLibrary } from '../../stack/materials'
import raw from './data/closluce.json?raw'

export type ShellSurfaceKind = 'brick' | 'stone' | 'slate' | 'oak'
// TSL overloads are composed at this one boundary, as in the shared stack.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any
const { attribute, cameraPosition, cameraViewMatrix, clamp, float, floor, fract, length,
  mix, mx_noise_float, normalMap, normalWorldGeometry, positionView, positionWorld, smoothstep,
  uv, vec2, vec3 } = TSL as unknown as Record<string,N>
const rgb=(hex:string):N=>{const c=new Color(hex);return vec3(c.r,c.g,c.b)}
interface Facade { from:[number,number];to:[number,number];length_m:number;render:boolean;
  id:string;pattern:{field:string};openings:{base_m:number;width_m:number;from_m:number;render:boolean}[] }
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
  const info=new Float32Array(p.count*3)
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
    let weather=0
    if(nearest&&z<nearest.top){
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
  }
  geometry.setAttribute('surfaceInfo',new Float32BufferAttribute(info,3))
  if(kind==='oak')prepareOakSeeds(geometry,panelSeeds)
}

/** Analytic pixel footprints filter the physical course signal. The course
 * faces and their mortar backing converge to the SAME area-weighted colour
 * and normal below resolution; retained geometry remains visible and complete.
 */
export function createShellSurface(kind:ShellSurfaceKind,library?:MaterialLibrary):MeshStandardNodeMaterial {
  const m=new MeshStandardNodeMaterial({metalness:0,roughness:kind==='slate'?.74:kind==='oak'?.79:.88})
  const P=positionWorld,U=uv(),info=attribute('surfaceInfo','vec3'),tone=attribute('tone','float')
  const lowBase=float(1).sub(smoothstep(.65,.73,P.y))
  const period=mix(info.y,float(.28),info.x.mul(lowBase))
  const pixel=U.y.dFdx().abs().add(U.y.dFdy().abs()).max(.00001)
  const resolved=smoothstep(2,4.2,period.div(pixel))
  const isCourse=smoothstep(.001,.01,info.y)
  const detail=mix(float(1),resolved,isCourse)
  const distance=length(P.sub(cameraPosition))
  const density=float(1).sub(smoothstep(8,48,distance))
  // Continuous material fields retain readable clay firing, stone staining,
  // and slate variation after the millimetre-scale course signal averages.
  // Each field fades by its own world-space footprint, never by brick rows.
  const worldPixel=length(P.dFdx()).add(length(P.dFdy())).max(.00001)
  const resolvedAt=(metres:number):N=>smoothstep(2,4.2,float(metres).div(worldPixel))
  const microDensity=density.mul(float(1).sub(smoothstep(.004,.020,worldPixel)))
  const regional=mx_noise_float(P.mul(1/.8)).mul(resolvedAt(.8))
  const mottled=mx_noise_float(P.mul(1/.18).add(vec3(7.1,3.7,11.3))).mul(resolvedAt(.18))
  const macro=mx_noise_float(P.mul(.38)).mul(resolvedAt(1/.38)).mul(.11).add(1)
  const grain=kind==='oak'?mx_noise_float(vec3(U.x.mul(22),U.y.mul(mix(float(.7),float(22),info.x)),0)):mx_noise_float(P.mul(24))
  const micro=mx_noise_float(P.mul(125))
  const salt=mx_noise_float(P.mul(vec3(5,.7,5))).mul(.5).add(.5)
  const geometric=normalWorldGeometry
  const horizontal=vec3(geometric.x,0,geometric.z)
  const horizontalLength=length(horizontal)
  const wallNormal=horizontal.div(horizontalLength.max(.00001))
  const northDamp=wallNormal.z.negate().max(0).mul(float(1).sub(P.y.add(.3).div(2.8)).max(0)).mul(.24)
  const damp=northDamp.add(info.z.mul(detail)).min(.4).mul(salt.mul(.7).add(.3))
  const stone=rgb('#d2c3a6'),clay=rgb('#a46951'),mortar=rgb('#aa9e87'),slate=rgb('#464c55'),oak=rgb('#72513b')
  const brickMean=mix(clay,mortar,.012/.057)
  const acrossPixel=U.x.dFdx().abs().add(U.x.dFdy().abs()).max(.00001)
  const acrossResolved=smoothstep(2,4.2,float(kind==='brick'?.252:.24).div(acrossPixel))
  const firing=fract(floor(U.x.div(.252)).mul(13.731).add(floor(U.y.div(.057)).mul(47.713)).sin().mul(13758.547))
  let near:N,far:N,relief:N=float(0),textureNormal:N=vec3(0,0,1)
  let oakHeight:N=float(0),oakWeather:N=float(0),oakChecks:N=float(0)
  if(kind==='brick'){
    // The 240×45mm brick module remains a geometric datum. Joints wander
    // only in their colour edge by <2mm, within the mortar surface.
    const course=floor(U.y.div(.057)),offset=fract(course.mul(.5)).mul(.5)
    const jointX=fract(U.x.div(.252).add(offset).add(grain.mul(.007)))
    const jointWidth=U.x.dFdx().abs().add(U.x.dFdy().abs()).div(.252).max(.005)
    const edge=jointX.min(float(1).sub(jointX))
    const seam=float(1).sub(smoothstep(.011,jointWidth.add(.019),edge)).mul(detail)
    near=clay.mul(mix(float(1),firing.mul(.20).add(.90),acrossResolved)).mul(grain.mul(.105).mul(density).add(1))
    near=mix(near,mortar.mul(.88),seam.mul(.76));far=brickMean
    relief=seam.mul(-.10).add(grain.mul(.055))
  }else if(kind==='stone'){
    const pore=smoothstep(.37,.66,micro).mul(smoothstep(-.30,.35,grain))
    near=stone.mul(grain.mul(.10).mul(density).add(1)).mul(float(1).sub(pore.mul(.24).mul(microDensity)))
    near=mix(near,mortar.mul(grain.mul(.12).mul(density).add(1)),info.x)
    far=mix(stone,brickMean,info.x.mul(float(1).sub(lowBase))).mul(mix(float(1),float(.95),lowBase))
    relief=grain.mul(.075).sub(pore.mul(.10))
    if(library){
      // Fine, rotated, low-amplitude grain; no imported stone block layout.
      const maps=library.sync('stone-tuffeau').sample({uv:U,metres:.19,turn:.37})
      near=near.mul(mix(float(1),maps.albedo.clamp(.82,1.18),density.mul(.38)))
      textureNormal=vec3(maps.normal.xy.mul(.32).mul(density),1)
    }
  }else if(kind==='slate'){
    const row=floor(U.y.div(.14)),cell=fract(floor(U.x.div(.24).add(fract(row.mul(.5)))).mul(31.17).add(row.mul(13.713)).sin().mul(4317.1))
    // Integrate a 6% overlap band over the pixel footprint. Its mean stays
    // 0.06 at every scale; the near/far blend applies detail exactly once.
    const width=pixel.div(.14).max(.0001),phase=fract(U.y.div(.14)).add(.03)
    const primitive=(x:N):N=>floor(x).mul(.06).add(fract(x).clamp(0,.06))
    const seam=primitive(phase.add(width.mul(.5))).sub(primitive(phase.sub(width.mul(.5)))).div(width).clamp(0,1)
    near=slate.mul(mix(float(1.01),cell.mul(.22).add(.90),acrossResolved)).mul(grain.mul(.08).mul(density).add(1)).mul(float(1).sub(seam.mul(.20)))
    far=slate.mul(1.01*(1-.20*.06));relief=seam.sub(.06).mul(-.055).add(grain.mul(.035))
  }else{
    // Exhibition recipe, not measured historic grain: U crosses each member
    // and V follows it. 2.8/5.5 mm fibres, 18 mm broader structure and gently
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
    const fibreFine=mx_noise_float(vec3(across.div(.0028),U.y.div(.45),seed.mul(17))).mul(filtered(across,.0028))
    const fibreWide=mx_noise_float(vec3(across.div(.0055),U.y.div(.8),seed.mul(11).add(2.3))).mul(filtered(across,.0055))
    const fibres=fibreFine.mul(.58).add(fibreWide.mul(.42)).toVar()
    const structure=mx_noise_float(vec3(across.div(.018),U.y.div(.24),seed.mul(19).add(1.3))).mul(filtered(across,.018)).toVar()
    // Intermittent elongated pores interrupt the continuous soft stripes.
    // These are proposed 1.4 by 6 mm surface fields, not measured vessels.
    const pores=smoothstep(.40,.72,mx_noise_float(vec3(across.div(.0014),U.y.div(.006),seed.mul(37))))
      .mul(filtered(across,.0014)).mul(side).toVar()
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
    // thresholding this field produced pale camouflage patches in R22.
    oakWeather=float(.30).add(wearBroad.mul(.065)).add(wearFine.mul(.035)).add(structure.mul(.025))
      .clamp(.15,.45).mul(filtered(U.x,.03)).toVar()
    const weathered=mix(oak,rgb('#807466'),oakWeather)
    const sideColour=weathered.mul(structure.mul(.26).add(1)).mul(fibres.mul(.29).add(1))
      .mul(float(1).sub(pores.mul(.12))).mul(float(1).sub(oakChecks.mul(.38))).mul(float(1).sub(knotCore.mul(.34)))
    const endColour=weathered.mul(.86).mul(float(1.035).sub(latewood.mul(.16)))
    near=mix(sideColour,endColour,info.x);far=mix(weathered,weathered.mul(.86),info.x)
    // Shallow procedural relief in metres: fibres up to 0.10 mm, broader
    // structure 0.08 mm, sparse checks 0.35 mm and end rings 0.08 mm.
    oakHeight=mix(fibres.mul(.00010).add(structure.mul(.00008)).sub(oakChecks.mul(.00035)).sub(knotCore.mul(.00016)).sub(pores.mul(.00004)),endRings.mul(.00008),info.x)
      .clamp(-.00035,.00018).toVar()
  }
  const individualTone=mix(float(1),tone.clamp(.82,1.10),detail)
  // Mortar backing and brick faces share this factor above the stone base.
  // Otherwise colour matching alone would leave a repeating distant signal.
  const clayWeight=kind==='brick'?float(1):kind==='stone'?info.x.mul(float(1).sub(lowBase)):float(0)
  const clayRegion=vec3(1,1,1).add(regional.mul(vec3(.21,.15,.11))).add(mottled.mul(vec3(.13,.10,.08)))
  const stoneRegion=vec3(1,1,1).add(regional.mul(vec3(.075,.073,.066))).add(mottled.mul(.065))
  const surfaceRegion=kind==='slate'?vec3(1,1,1).add(regional.mul(vec3(.17,.19,.23))).add(mottled.mul(.11)):
    kind==='oak'?vec3(1,1,1).add(regional.mul(.12)).add(mottled.mul(.07)):mix(stoneRegion,clayRegion,clayWeight)
  const colour=mix(far,near,detail).mul(macro).mul(surfaceRegion).mul(individualTone).mul(float(1).sub(damp))
  m.colorNode=mix(colour,colour.mul(vec3(.74,.82,.63)),damp.mul(.40)).max(vec3(.003,.003,.003))
  const roughRange=kind==='slate'?[.61,.83]:kind==='oak'?[.60,.82]:kind==='brick'?[.74,.96]:[.78,1]
  const roughness=kind==='oak'?float(.72).add(oakWeather.mul(.12)).add(oakChecks.mul(.025)).add(micro.mul(.02).mul(microDensity)).sub(damp.mul(.10)):
    float(kind==='slate'?.73:.89).add(regional.mul(.025)).add(micro.mul(.045).mul(microDensity)).sub(damp.mul(.10))
  m.roughnessNode=clamp(roughness,roughRange[0],roughRange[1])
  const nx=grain.mul(.04).add(relief).mul(density).mul(detail).add(textureNormal.x)
  const ny=micro.mul(.018).mul(microDensity).mul(detail).add(textureNormal.y)
  const detailedNormal=normalMap(vec3(nx,ny,1).normalize().mul(.5).add(.5),vec2(.65,.65))
  // A microscopic course bevel must converge to its wall plane, not retain
  // a bright one-pixel strip after the colour signal has been filtered.
  const wallCourse=kind==='brick'||kind==='stone'?isCourse.mul(smoothstep(.02,.12,horizontalLength)):float(0)
  const filteredWorld=mix(geometric,wallNormal,wallCourse.mul(float(1).sub(detail))).normalize()
  const filteredView=filteredWorld.transformDirection(cameraViewMatrix)
  if(kind==='oak'){
    // BumpMapNode shifts texture UVs, not raw procedural UV attributes.
    // Differentiate the height itself against view-space surface position.
    // A bounded surface gradient keeps thin edges and grazing faces stable.
    const sx=positionView.dFdx(),sy=positionView.dFdy(),n=filteredView
    const rx=sy.cross(n),ry=n.cross(sx),det=sx.dot(rx)
    const gradient=rx.mul(oakHeight.dFdx()).add(ry.mul(oakHeight.dFdy()))
      .mul(det.sign()).div(det.abs().max(.0000000001)).toVar()
    const bounded=gradient.div(length(gradient).div(.22).max(1))
    m.normalNode=n.sub(bounded.mul(density)).normalize()
  }else m.normalNode=mix(filteredView,detailedNormal,detail.mul(density)).normalize()
  m.name=`vinci/${kind}`;m.userData['surfaceKind']=kind
  m.userData['provenance']='Procedural 2026-09-09; dossier nominal courses and registered openings. Area-filtered fine courses; independently filtered 0.8 m and 0.18 m material variation; shared per-fragment north damp, resolved A eave/sill weathering. Member-local oak fibres and transverse end grain. Existing CC0 ambientCG Tiles143 fine grain on tuffeau only. No site-photo sample.'
  if(kind==='oak')m.userData['provenance']+=' Oak appearance is conjectural exhibition dressing: independent seeds from actual metre UV face origins; roof linings use one affine metre frame and seed per complete roof face before clipping. Curved 2.8/5.5 mm longitudinal fields, 18 mm structure and sparse 1.4 by 6 mm pore fields with up to 0.04 mm pore relief; irregular end rings with nominal 3.1 mm spacing and up to 1.2 mm contour wander. Sparse knots 8–20 by 15–40 mm, checks 0.8–1.5 mm wide by 80–350 mm long, continuous grey-brown wear at 30–120 mm across grain with 15–45% colour blend where resolved. Relief clamped to -0.35/+0.18 mm, bounded normal slope 0.22, ends 14% darker. Dossier materials.csv base #72513b and roughness 0.60–0.82 retained. No observed timber dimensions, pores, knots, ring spacing or weathering claimed.'
  return m
}

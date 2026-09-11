import { Group, Mesh, MeshStandardNodeMaterial, Color, DoubleSide } from 'three/webgpu'
import * as TSL from 'three/tsl'
import { buildTerrainMeshes } from './terrain-mesh'
import type { MaterialLibrary } from '../../stack/materials'
import type { TierName } from '../../stack'

// TSL graphs retain three independent scales, even on calm's complete ground.
const { positionWorld, positionView, normalWorldGeometry, cameraViewMatrix, mx_noise_float, mx_fractal_noise_float, mix, vec3, float, smoothstep, length, cameraPosition, normalMap, vec2, uv, fract, floor, dot } = TSL
function rgb(hex:string) { const c=new Color(hex); return vec3(c.r,c.g,c.b) }
export function groundMaterial(kind:'grass'|'earth'|'stone',library?:MaterialLibrary):MeshStandardNodeMaterial {
  const m=new MeshStandardNodeMaterial({roughness:0.96,side:DoubleSide})
  const P=positionWorld
  const broad=mx_fractal_noise_float(P.mul(.12),3,2,.5).mul(.5).add(.5).clamp(0,1)
  const mid=mx_noise_float(P.mul(kind==='grass'?5:11)).mul(.5).add(.5)
  const fine=mx_noise_float(P.mul(85)).mul(.5).add(.5)
  const density=float(1).sub(smoothstep(15,110,length(P.sub(cameraPosition))))
  const pair=kind==='grass'?['#485537','#879066']:kind==='earth'?['#796d57','#b4a388']:['#807968','#b8ad93']
  m.colorNode=mix(rgb(pair[0]!),rgb(pair[1]!),broad).mul(mid.sub(.5).mul(density.mul(.28)).add(1)).mul(fine.sub(.5).mul(density.mul(.15)).add(1))
  const nx=mx_noise_float(P.mul(18).add(vec3(.2,0,0))).sub(mid).mul(.18)
  const ny=mx_noise_float(P.mul(18).add(vec3(0,0,.2))).sub(mid).mul(.18)
  m.normalNode=normalMap(vec3(nx.add(.5),ny.add(.5),1),vec2(.4,.4))
  m.roughnessNode=fine.mul(.12).add(.84)
  if(kind==='stone'){const U=uv(),row=floor(U.y.div(.30)),joint=fract(U.y.div(.30)).lessThan(.038).or(fract(U.x.div(.62).add(row.mod(2).mul(.5))).lessThan(.02));m.colorNode=m.colorNode!.mul(mix(float(1),float(.67),float(joint)));}
  if(library&&kind!=='grass'){const maps=library.sync(kind==='stone'?'stone-tuffeau':'earth-packed').sample({uv:uv(),metres:kind==='stone'?.85:1.4});m.colorNode=m.colorNode!.mul(mix(float(1),maps.albedo.clamp(.35,1.8),kind==='stone'?.5:.7));m.normalNode=normalMap(maps.normal.mul(.5).add(.5),vec2(.36,.36))}
  if(library&&kind==='grass'){const maps=library.sync('grass-short').sample({uv:uv(),metres:1.4,turn:.19});const grain=dot(maps.albedo,vec3(.2126,.7152,.0722)).clamp(.4,1.7);m.colorNode=m.colorNode!.mul(mix(float(1),grain,.62));m.normalNode=normalMap(vec3(maps.normal.xy.mul(.5),1).normalize().mul(.5).add(.5),vec2(.5,.5));m.roughnessNode=maps.roughness.mul(.08).add(.87)}
  if(kind==='earth'){
    // Conjectural exposed-soil appearance on the already declared cuts.
    // These 1–12 cm clod fields, 0.12–1.55 m erosion variation and millimetre
    // relief are a regenerable surface recipe, not a geological section.
    const bank=float(1).sub(smoothstep(.1,.45,normalWorldGeometry.y.abs()))
    const pixel=length(P.dFdx()).add(length(P.dFdy())).max(.000001)
    const resolved=(metres:number)=>smoothstep(2,4,float(metres).div(pixel))
    const crust=mx_fractal_noise_float(P.mul(vec3(2.4,3.5,2.4)),3,2,.5).clamp(-1,1)
    const clods=mx_fractal_noise_float(P.mul(18),3,2,.5).clamp(-1,1).mul(resolved(.055))
    const grit=mx_noise_float(P.mul(125)).mul(resolved(.008))
    const pits=smoothstep(.20,.52,mx_noise_float(P.mul(vec3(31,18,31)))).mul(resolved(.025))
    const erosion=mx_noise_float(P.mul(vec3(8,.65,8))).mul(crust.mul(.3).add(.7))
    let bankColour=mix(rgb('#645746'),rgb('#aa9677'),crust.mul(.5).add(.5))
      .mul(clods.mul(.42).add(1)).mul(grit.mul(.16).add(1))
      .mul(float(1).sub(pits.mul(.27))).mul(erosion.mul(.18).add(1))
    if(library){
      // The cut is tessellated into many strips. World projections keep the
      // existing earth colour continuous across their local UV restarts.
      const earth=library.sync('earth-packed')
      const east=earth.sample({uv:vec2(P.z,P.y),metres:.38,turn:.27})
      const north=earth.sample({uv:vec2(P.x,P.y),metres:.38,turn:.27})
      const weight=normalWorldGeometry.x.abs().div(normalWorldGeometry.x.abs().add(normalWorldGeometry.z.abs()).max(.000001))
      bankColour=bankColour.mul(mix(float(1),mix(north.albedo,east.albedo,weight).clamp(.4,1.7),.55))
    }
    m.colorNode=mix(m.colorNode!,bankColour,bank)
    const height=clods.mul(.003).sub(pits.mul(.002)).add(grit.mul(.00035)).toVar()
    const n=normalWorldGeometry.transformDirection(cameraViewMatrix)
    const sx=positionView.dFdx(),sy=positionView.dFdy(),rx=sy.cross(n),ry=n.cross(sx),det=sx.dot(rx)
    const gradient=rx.mul(height.dFdx()).add(ry.mul(height.dFdy()))
      .mul(det.sign()).div(det.abs().max(1e-10)).toVar()
    const bounded=gradient.div(length(gradient).div(.4).max(1))
    m.normalNode=mix(m.normalNode! as ReturnType<typeof vec3>,n.sub(bounded).normalize(),bank).normalize()
    m.userData['bankAppearance']='GENERATED conjectural surface recipe: clod fields 0.01–0.12 m, erosion variation 0.12–1.55 m, combined height field bounded by 0.006 m with finer 0.00035 m grain. Existing CC0 earth-packed sampled at 0.38 m in blended continuous world projections. No altered cut outline, surveyed height, geological strata or period surface measurement.'
  }
  m.name=`wing-vinci/${kind}`
  return m
}

export function createGround(tier:TierName,library?:MaterialLibrary):Group {
  const group=new Group();group.name='wing-vinci/terrain'
  const batches=buildTerrainMeshes(tier)
  for(const [name,geometry] of Object.entries(batches)) {
    const kind=name==='retaining'?'stone':name==='grass'?'grass':'earth'
    const mesh=new Mesh(geometry,groundMaterial(kind,library));mesh.receiveShadow=true;mesh.name=`wing-vinci/${name}`;group.add(mesh)
  }
  return group
}

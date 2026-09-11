import { Group, Mesh, MeshStandardNodeMaterial, Color, DoubleSide } from 'three/webgpu'
import * as TSL from 'three/tsl'
import { buildTerrainMeshes } from './terrain-mesh'
import type { MaterialLibrary } from '../../stack/materials'
import type { TierName } from '../../stack'
import { roadSurfaceNode } from './road-dressing'
import { foundationVisibility } from './foundation'
import { collectionConcreteMaterial, collectionProvenance } from './collection'
import { collectionAccessProvenance } from './collection-access'
import { coursedFace, dressedTuffeau } from './masonry-courses'

// TSL graphs retain three independent scales, even on calm's complete ground.
const { positionWorld, positionView, normalWorldGeometry, cameraViewMatrix, mx_noise_float, mx_fractal_noise_float, mix, vec3, float, smoothstep, length, cameraPosition, normalMap, vec2, uv, fract, floor, dot } = TSL
function rgb(hex:string) { const c=new Color(hex); return vec3(c.r,c.g,c.b) }
export function groundMaterial(kind:'grass'|'earth'|'stone',library?:MaterialLibrary):MeshStandardNodeMaterial {
  const m=new MeshStandardNodeMaterial({roughness:0.96,side:DoubleSide})
  m.aoNode=foundationVisibility()
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
  const earthMaps=library&&kind==='earth'?library.sync('earth-packed').sample({uv:uv(),metres:1.4}):undefined
  if(earthMaps){m.colorNode=m.colorNode!.mul(mix(float(1),earthMaps.albedo.clamp(.35,1.8),.7));m.normalNode=normalMap(earthMaps.normal.mul(.5).add(.5),vec2(.36,.36))}
  if(kind==='stone'){
    // Each cut strip previously restarted a stretched local texture. A
    // continuous horizontal tangent and true height now lay the whole wall.
    const n=normalWorldGeometry,vertical=float(1).sub(smoothstep(.4,.8,n.y.abs()))
    const axis=vec2(n.z,n.x.negate()).div(length(n.xz).max(.00001))
    const U=vec2(mix(P.x,P.x.mul(axis.x).add(P.z.mul(axis.y)),vertical),mix(P.z,P.y,vertical))
    const pixel=U.dFdx().abs().add(U.dFdy().abs()).max(vec2(.00001,.00001))
    const worldPixel=length(P.dFdx()).add(length(P.dFdy())).max(.00001)
    const resolved=(metres:number)=>smoothstep(2,4,float(metres).div(worldPixel))
    const laid=coursedFace(U,{...dressedTuffeau,courseM:.30,blockM:.62,jointM:.015,seed:7.31})
    const seam=laid.joint,block=laid.tone.sub(1).mul(resolved(.30))
    const drift=mx_noise_float(P.mul(.24)),cleft=mx_noise_float(P.mul(16)).mul(resolved(.0625))
    const pores=smoothstep(.38,.68,mx_noise_float(P.mul(220))).mul(resolved(.0045))
    const damp=float(1).sub(smoothstep(1.02,1.85,P.y)).mul(mx_noise_float(P.mul(vec3(1.2,.7,1.2))).mul(.3).add(.7))
    // A capped tuffeau wall weathers in metre-scale bands: rain washes it in
    // vertical streaks and the foot greens. These survive a grazing angle,
    // where the courses themselves compress below one pixel.
    const streak=mx_noise_float(vec3(U.x.mul(3.1),U.y.mul(.22),0)).mul(smoothstep(.7,2.4,float(.42).div(worldPixel)))
    const foot=float(1).sub(smoothstep(.35,2.2,P.y.sub(-.2))).mul(mx_noise_float(P.mul(vec3(.9,2.2,.9))).mul(.35).add(.65))
    let stone=rgb('#b8aa8e').mul(block.mul(.20).add(1)).mul(drift.mul(.20).add(1))
      .mul(streak.mul(.13).add(1)).mul(cleft.mul(.09).add(1)).mul(float(1).sub(pores.mul(.22)))
    stone=mix(stone,rgb('#7d8168'),foot.mul(.26).mul(vertical))
    if(library){const maps=library.sync('stone-tuffeau').sample({uv:U,metres:.19,turn:.37});stone=stone.mul(mix(float(1),maps.albedo.clamp(.78,1.22),resolved(.03).mul(.40)))}
    m.colorNode=mix(stone,rgb('#8c826d'),seam.mul(.58)).mul(float(1).sub(damp.mul(.15)))
    // Recessed joints and the damp foot see less sky than the block faces.
    m.aoNode=foundationVisibility().mul(float(1).sub(seam.mul(.45)).sub(foot.mul(.12).mul(vertical)))
    m.roughnessNode=float(.89).add(cleft.mul(.035)).sub(damp.mul(.06)).clamp(.78,1)
    const height=cleft.mul(.0009).sub(pores.mul(.0007)).add(laid.depthM).toVar()
    const viewNormal=n.transformDirection(cameraViewMatrix),sx=positionView.dFdx(),sy=positionView.dFdy()
    const rx=sy.cross(viewNormal),ry=viewNormal.cross(sx),det=sx.dot(rx)
    const gradient=rx.mul(height.dFdx()).add(ry.mul(height.dFdy())).mul(det.sign()).div(det.abs().max(1e-10)).toVar()
    m.normalNode=viewNormal.sub(gradient.div(length(gradient).div(.32).max(1))).normalize()
    m.userData['retainingAppearance']='GENERATED reconstruction choice: hand-laid coursing near .62 × .30 m, courses and blocks each varying by a third [.45–.80 × .24–.38], 15 mm joints [8–20], shallow joint relief. Continuous world tangent, block variation, 4m weather drift, 6cm cleft and filtered4.5mm pores. Q001/Q124 masonry character; no measured historic retaining-wall bond or texture.'
  }
  if(library&&kind==='grass'){const maps=library.sync('grass-short').sample({uv:uv(),metres:1.4,turn:.19});const grain=dot(maps.albedo,vec3(.2126,.7152,.0722)).clamp(.4,1.7);m.colorNode=m.colorNode!.mul(mix(float(1),grain,.62));m.normalNode=normalMap(vec3(maps.normal.xy.mul(.5),1).normalize().mul(.5).add(.5),vec2(.5,.5));m.roughnessNode=maps.roughness.mul(.08).add(.87)}
  if(kind==='grass'){
    // October below a manor: rough sward, not a mown lawn. Tussocks at about
    // a metre, bleached dry ground between them, and thin scrapes where the
    // slope wears. Colour and surface normal only; the surveyed grade is
    // untouched and no blade is implied by this field.
    const tussock=mx_fractal_noise_float(P.mul(vec3(.86,.42,.86)),3,2,.5).clamp(-1,1)
    const patch=mx_noise_float(P.mul(vec3(.34,.2,.34)).add(vec3(11.3,5.1,7.7))).clamp(-1,1)
    const swardFade=float(1).sub(smoothstep(40,150,length(P.sub(cameraPosition))))
    const dry=smoothstep(.02,.62,tussock.mul(.6).add(patch.mul(.4))).mul(swardFade)
    const scrape=smoothstep(.62,.92,patch).mul(swardFade)
    const clump=mx_noise_float(P.mul(vec3(2.9,1.2,2.9)).add(vec3(3.7,1.9,8.3))).clamp(-1,1)
    m.colorNode=mix(m.colorNode!,rgb('#9d9670'),dry.mul(.42)).mul(float(1).sub(scrape.mul(.10))).mul(clump.mul(.055).mul(swardFade).add(1))
    m.colorNode=mix(m.colorNode!,rgb('#8a7d63'),scrape.mul(.42))
    const relief=tussock.mul(.115).add(patch.mul(.05)).add(clump.mul(.028)).mul(swardFade).toVar()
    const gn=normalWorldGeometry.transformDirection(cameraViewMatrix)
    const gsx=positionView.dFdx(),gsy=positionView.dFdy(),grx=gsy.cross(gn),gry=gn.cross(gsx),gdet=gsx.dot(grx)
    const ggrad=grx.mul(relief.dFdx()).add(gry.mul(relief.dFdy())).mul(gdet.sign()).div(gdet.abs().max(1e-10)).toVar()
    m.normalNode=gn.sub(ggrad.div(length(ggrad).div(.22).max(1))).normalize()
    m.userData['swardAppearance']='GENERATED October sward: tussock relief near 1.2 m within 0.03-0.19 m, a 0.35 m clump scale, bleached dry fraction and sparse thin scrapes. Surface finish only; no surveyed height, mowing regime or species is claimed.'
  }
  if(kind==='earth'){
    // Conjectural exposed-soil appearance on the already declared cuts.
    // These 1-12 cm clod fields, 0.12-1.55 m erosion variation, 4 cm stones and
    // millimetre relief are a regenerable surface recipe, not a geological section.
    const bank=float(1).sub(smoothstep(.1,.45,normalWorldGeometry.y.abs()))
    const pixel=length(P.dFdx()).add(length(P.dFdy())).max(.000001)
    const resolved=(metres:number)=>smoothstep(2,4,float(metres).div(pixel))
    const crust=mx_fractal_noise_float(P.mul(vec3(2.4,3.5,2.4)),3,2,.5).clamp(-1,1)
    const clods=mx_fractal_noise_float(P.mul(18),3,2,.5).clamp(-1,1).mul(resolved(.055))
    const grit=mx_noise_float(P.mul(125)).mul(resolved(.008))
    const pits=smoothstep(.20,.52,mx_noise_float(P.mul(vec3(31,18,31)))).mul(resolved(.025))
    const erosion=mx_noise_float(P.mul(vec3(8,.65,8))).mul(crust.mul(.3).add(.7))
    // Small stones stand out of a cut face and catch the sky; without them
    // the bank reads as one soft blur at three metres.
    const stones=smoothstep(.52,.78,mx_noise_float(P.mul(vec3(26,26,26)).add(vec3(4.1,9.3,2.7)))).mul(resolved(.04))
    let bankColour=mix(rgb('#645746'),rgb('#aa9677'),crust.mul(.5).add(.5))
      .mul(clods.mul(.52).add(1)).mul(grit.mul(.16).add(1))
      .mul(float(1).sub(pits.mul(.34))).mul(erosion.mul(.18).add(1))
      .mul(stones.mul(.22).add(1))
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
    const height=clods.mul(.006).sub(pits.mul(.004)).add(stones.mul(.0035)).add(grit.mul(.00035)).toVar()
    const n=normalWorldGeometry.transformDirection(cameraViewMatrix)
    const sx=positionView.dFdx(),sy=positionView.dFdy(),rx=sy.cross(n),ry=n.cross(sx),det=sx.dot(rx)
    const gradient=rx.mul(height.dFdx()).add(ry.mul(height.dFdy()))
      .mul(det.sign()).div(det.abs().max(1e-10)).toVar()
    const bounded=gradient.div(length(gradient).div(.4).max(1))
    m.normalNode=mix(m.normalNode! as ReturnType<typeof vec3>,n.sub(bounded).normalize(),bank).normalize()
    m.userData['bankAppearance']='GENERATED conjectural surface recipe: clod fields 0.01–0.12 m, erosion variation 0.12–1.55 m, combined height field bounded by 0.006 m with finer 0.00035 m grain. Existing CC0 earth-packed sampled at 0.38 m in blended continuous world projections. No altered cut outline, surveyed height, geological strata or period surface measurement.'
  }
  if(kind==='earth'){
    const flat=smoothstep(.90,.985,normalWorldGeometry.y.abs()),road=roadSurfaceNode(),mask=road.mask.mul(flat)
    // Reuse the already sampled CC0 earth set. Its luminance ratio retains
    // real grain without importing the preview's moss colour or new maps.
    const ratio=earthMaps?dot(earthMaps.albedo,vec3(.2126,.7152,.0722)).clamp(.45,1.7):float(1)
    m.colorNode=mix(m.colorNode!,road.colour.mul(mix(float(1),ratio,.88)),mask)
    m.roughnessNode=mix(m.roughnessNode! as ReturnType<typeof float>,road.roughness,mask)
    const h=road.height.toVar(),n=normalWorldGeometry.transformDirection(cameraViewMatrix)
    const sx=positionView.dFdx(),sy=positionView.dFdy(),rx=sy.cross(n),ry=n.cross(sx),det=sx.dot(rx)
    const gradient=rx.mul(h.dFdx()).add(ry.mul(h.dFdy())).mul(det.sign()).div(det.abs().max(1e-10))
    const base=m.normalNode! as ReturnType<typeof vec3>,bounded=gradient.div(length(gradient).div(.25).max(1))
    m.normalNode=mix(base,base.sub(bounded).normalize(),mask).normalize()
    // A rut is a groove: it sees less of the sky than the crown beside it.
    // Occlusion on the indirect term is what lets the tracks read where the
    // road lies in the wall's own shade, which is most of this street.
    m.aoNode=float(1).sub(road.wear.mul(.34).mul(mask))
    m.userData['roadAppearance']='GENERATED conjectural grey-beige compacted earth and mineral finish; existing library/earth-packed albedo and normals, retained 1.4 m map projection, 2.8 m compaction variation, 7 cm aggregate and 6 mm grit. Existing mapped corridor mask, wheel-track spacing and depth retained. Surface normals only, gradient bounded .25; no displaced terrain or new paving.'
  }
  m.name=`wing-vinci/${kind}`
  return m
}

export function createGround(tier:TierName,library?:MaterialLibrary):Group {
  const group=new Group();group.name='wing-vinci/terrain'
  const batches=buildTerrainMeshes(tier)
  for(const [name,geometry] of Object.entries(batches)) {
    const kind=name==='retaining'?'stone':name==='grass'?'grass':'earth'
    const modern=name==='collectionRetaining'
    const mesh=new Mesh(geometry,modern?collectionConcreteMaterial():groundMaterial(kind,library));mesh.receiveShadow=true;mesh.castShadow=name==='retaining'||modern;mesh.name=`wing-vinci/${name}`
    if(modern){mesh.userData={manifestId:collectionProvenance.manifestId,assetClass:'GENERATED',certainty:'reconstructed',component:'collection-cut-and-fill-lining',label:collectionProvenance.approachLabel,accessLabel:collectionAccessProvenance.label};geometry.userData.basis=collectionProvenance.recipe+' '+collectionAccessProvenance.recipe}
    group.add(mesh)
  }
  return group
}

/** Original finish proposal. All wavelengths, relief and colour
 * amplitudes below are declared finish assumptions, never surveyed traces.
 */
import { Color, MeshStandardNodeMaterial } from 'three/webgpu'
import * as TSL from 'three/tsl'
import {aggregateField} from './mineral-microstructure'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N=any
const {attribute,cameraViewMatrix,clamp,float,floor,fract,length,mix,mx_noise_float,
  normalWorldGeometry,positionView,positionWorld,smoothstep,uv,vec2,vec3}=TSL as unknown as Record<string,N>

export function createEntryMineralSurface(kind:'plaster'|'terracotta',
  parameters:{colour:string;roughness:number;tile:number;joint:number}):MeshStandardNodeMaterial {
  const material=new MeshStandardNodeMaterial({roughness:parameters.roughness,metalness:0})
  const colour=new Color(parameters.colour),P=positionWorld,U=uv()
  const rho=length(U.dFdx()).max(length(U.dFdy())).max(1e-6)
  const resolve=(L:number):N=>float(1).sub(smoothstep(L/8,L/2,rho))
  const noise=(point:N):N=>mx_noise_float(point).mul(1.55).clamp(-1,1)
  let albedo:N=vec3(colour.r,colour.g,colour.b),roughness:N=float(parameters.roughness)
  const heightBands:{height:N;resolution:N}[]=[],uvGradients:N[]=[]
  if(kind==='plaster'){
    const washRaw=noise(vec3(U.x.div(.60),U.y.div(.60),.271)),wash=washRaw.mul(resolve(.60))
    const footprint=U.dFdx().abs().add(U.dFdy().abs())
    const trowel=aggregateField(U,footprint,{cell:.070,radius:[.16,.22],aspect:.35,probability:.70,seed:3.729,signed:true})
    const grain=aggregateField(U,footprint,{cell:.005,radius:[.12,.22],probability:1,seed:9.113,signed:true})
    const pores=aggregateField(U,footprint,{cell:.018,radius:[.04,.08],probability:.24,seed:13.731})
    albedo=albedo.mul(wash.mul(.11).add(trowel.value.mul(.035)).add(grain.value.mul(.15)).sub(pores.value.mul(.25)).add(1))
    heightBands.push({height:washRaw.mul(.00030),resolution:resolve(.60)})
    uvGradients.push(trowel.gradient.mul(.00016).add(grain.gradient.mul(.000050)).sub(pores.gradient.mul(.00018)))
    roughness=roughness.add(wash.mul(.015)).add(trowel.value.mul(.025)).add(grain.value.mul(.035)).add(pores.value.mul(.040))
  }else{
    const size=parameters.tile,joint=parameters.joint,cell=floor(U.div(size)),part=fract(U.div(size))
    const seed=noise(vec3(cell.x,cell.y,.317)),tileFade=resolve(size)
    const clayRaw=noise(vec3(U.x.div(.018).add(seed.mul(31)),U.y.div(.018),5.713)),clay=clayRaw.mul(resolve(.018))
    const grainRaw=noise(vec3(U.x.div(.0025).add(seed.mul(71)),U.y.div(.0025),7.919)),grain=grainRaw.mul(resolve(.0025))
    // Analytic integral of periodic one-dimensional joint coverage, so the
    // unresolved grid tends to its exact physical area fraction.
    const coverage=(x:N,width:N):N=>{
      const half=width.mul(.5).max(1e-7),ratio=joint/size
      const primitive=(t:N):N=>floor(t).mul(ratio).add(fract(t).min(ratio))
      return primitive(x.add(half).add(ratio/2)).sub(primitive(x.sub(half).add(ratio/2))).div(half.mul(2)).clamp(0,1)
    }
    const pixelU=U.x.dFdx().abs().add(U.x.dFdy().abs()).div(size).max(1e-6)
    const pixelV=U.y.dFdx().abs().add(U.y.dFdy().abs()).div(size).max(1e-6)
    const jointU=coverage(U.x.div(size),pixelU),jointV=coverage(U.y.div(size),pixelV)
    const jointArea=float(1).sub(float(1).sub(jointU).mul(float(1).sub(jointV)))
    const edge=part.min(float(1).sub(part)).mul(size),edgeDistance=edge.x.min(edge.y)
    const body=albedo.mul(seed.mul(.12).mul(tileFade).add(clay.mul(.065)).add(grain.mul(.018)).add(1))
    const jointColour=vec3(colour.r*.64,colour.g*.69,colour.b*.74)
    albedo=mix(body,jointColour,jointArea)
    const dish=float(1).sub(part.x.mul(2).sub(1).pow(2)).mul(float(1).sub(part.y.mul(2).sub(1).pow(2)))
    const groove=float(1).sub(smoothstep(joint/2,joint/2+.002,edgeDistance))
    heightBands.push({height:dish.mul(-.0004),resolution:tileFade},
      {height:clayRaw.mul(.000080),resolution:resolve(.018)},
      {height:grainRaw.mul(.000015),resolution:resolve(.0025)},
      {height:groove.mul(-.0012),resolution:resolve(.004)})
    roughness=roughness.add(seed.mul(.025).mul(tileFade)).add(clay.mul(.035)).add(grain.mul(.035)).add(jointArea.mul(.035))
  }
  material.colorNode=albedo.mul(attribute('tone','float'))
  material.roughnessNode=clamp(roughness,kind==='plaster'?.78:.74,kind==='plaster'?1:.96)
  // Convert a height field in metres into a physical view-space gradient.
  // There is no tangent normal map, face-diagonal or UV-orientation shortcut.
  const Nview=normalWorldGeometry.transformDirection(cameraViewMatrix),sx=positionView.dFdx(),sy=positionView.dFdy()
  const rx=sy.cross(Nview),ry=Nview.cross(sx),det=sx.dot(rx)
  const signedSafe=det.greaterThanEqual(0).select(float(1),float(-1)).mul(det.abs().max(1e-12))
  // Differentiate physical height first. A screen-space footprint fade is
  // a reconstruction filter, not a physical height and must not add a slope.
  let gradient:N=vec3(0)
  for(const band of heightBands)gradient=gradient.add(
    rx.mul(band.height.dFdx()).add(ry.mul(band.height.dFdy())).div(signedSafe).mul(band.resolution))
  for(const g of uvGradients)gradient=gradient.add(rx.mul(g.dot(U.dFdx())).add(ry.mul(g.dot(U.dFdy()))).div(signedSafe))
  gradient=gradient.mul(float(.16).div(length(gradient).max(.16)))
  material.normalNode=Nview.sub(gradient).normalize()
  material.name=`vinci/entry-${kind}`
  material.userData={source:['A-MATERIAL','A-MASONRY'],class:'GENERATED',finish:'original procedural; no reference image sampled',
    scalesM:kind==='plaster'?[.60,.070,.005]:[parameters.tile,.018,.0025],
    heightAmplitudeM:kind==='plaster'?[.00030,.00016,.000050]:[.00040,.000080,.000015],
    filtering:'Plaster: compact profiles analytically integrated in a conservative UV pixel box; held-footprint height gradients. Broad wash and terracotta noise gradients filtered after differentiation; analytic tile joint area',
    normalSlopeLimit:.16,roughnessRange:kind==='plaster'?[.78,1]:[.74,.96]}
  return material
}

export const entryMineralSurfaceProvenance={
  class:'GENERATED',source:['A-MATERIAL','A-MASONRY','brief/building/materials.csv'],
  recipe:'Original procedural mineral finish; geometry, levels, portals, sun and exposure unchanged. Physical metre-height gradients are independently filtered after differentiation. No reference image is sampled.',
  plaster:{washScaleM:.60,washScaleRangeM:[.40,.90],trowelCellM:.070,trowelCellRangeM:[.050,.090],trowelSupportM:[[.0224,.0308],[.00784,.01078]],trowelHeightM:.00016,trowelHeightRangeM:[.00008,.00025],grainCellM:.005,grainDiameterM:[.0012,.0022],grainHeightM:.000050,grainHeightRangeM:[.000025,.000080],poreCellM:.018,poreDiameterM:[.00144,.00288],poreDepthM:.00018,poreDepthRangeM:[.00008,.00030],roughnessRange:[.78,1]},
  terracotta:{scaleM:[.22,.018,.0025],scaleRangeM:[[.16,.28],[.012,.028],[.0015,.004]],heightAmplitudeM:[.00040,.000080,.000015],heightAmplitudeRangeM:[[.00020,.00060],[.00004,.00012],[.000008,.000025]],jointM:.008,jointRangeM:[.004,.012],grooveM:.0012,grooveRangeM:[.0006,.0018],roughnessRange:[.74,.96]},
  label:{
    en:'Proposed mineral finish, A-MATERIAL and A-MASONRY. Limewash retains a 0.40–0.90 m wash. Assumed short application profiles span 22–31 by 8–11 mm, relief 0.16 mm [0.08–0.25]; signed grain spans 1.2–2.2 mm, relief 0.050 mm [0.025–0.080]. Sparse 1.4–2.9 mm pore supports have depth 0.18 mm [0.08–0.30]. Terracotta tiles remain .22 m [.16–.28] with .008 m joints [.004–.012]; assumed clay scales 12–28 and 1.5–4 mm, dish/body/grain amplitudes 0.20–0.60, 0.04–0.12 and 0.008–0.025 mm. A shallow joint shading profile is 0.6–1.8 mm deep, nominal 1.2 mm; no geometry is displaced. Original procedural dressing, not measured historic surface texture; no photograph is sampled.',
    de:'Vorgeschlagene mineralische Oberfläche, A-MATERIAL und A-MASONRY. Kalktünche behält ihre breite Skala von 0,40–0,90 m. Angenommene kurze Auftragsprofile messen 22–31 mal 8–11 mm, Relief 0,16 mm [0,08–0,25]; wechselnde Kornprofile 1,2–2,2 mm, Relief 0,050 mm [0,025–0,080]. Vereinzelte Porenprofile von 1,4–2,9 mm erhalten 0,18 mm Tiefe [0,08–0,30]. Terrakottaplatten bleiben 0,22 m [0,16–0,28] mit Fugen von 0,008 m [0,004–0,012]; angenommene Tonskalen 12–28 und 1,5–4 mm, Amplituden für Mulde/Körper/Korn 0,20–0,60, 0,04–0,12 und 0,008–0,025 mm. Das flache Fugenprofil der Schattierung ist 0,6–1,8 mm tief, nominal 1,2 mm; die Geometrie bleibt unverändert. Eigenständige prozedurale Ausgestaltung, keine vermessene historische Oberflächentextur; kein Foto wird abgetastet.'
  }
} as const
